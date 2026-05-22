# 회기 0.5: set-level checkpoint 영입 spec — 데이터 엔지니어 paste

## 회기 lock

- 본 회기 = **긴급 영역** — 사용자 작업 환경 단절 영역 ↑
- 회기 1~10 ↔ 의존성 X (independent)
- 본 회기 (현재 sequential 진행) 종결 사후 즉시 진입 path
- 레드팀 검수 사전 의무 (lock D 정합)

## 결함 사실 (raw 점검 결과)

`pipeline/index.js:140-148` — checkpoint = step1~7 단위 단독:
```javascript
function saveCheckpoint(step) {
  const cp = { lastCompletedStep: step, ... };
}
```

→ step5 영역 = 8 set sequential — 단 set-level 보존 X. 단절 + 재 시작 시 step5 첫 set 부터 재 진행 의무.

## 사용자 사례 (2026-05-08)

```
2025수능 step5 진행:
  ✓ r2025a (1~3번) 종결
  ⏳ r2025b (4~9번) retry 2/3 진행 중
↓ vscode 단절
[재 시작]
  체크포인트 = step4 완료
  → step5 첫 set (r2025a) 부터 재 시작
  → 시간 손실 ~10~15분
```

## 정정 path

### 1. step5_verify.js 영역 영입

`pipeline/step5_verify.js` 영역 + 다음 함수 영역 영입:

```javascript
// step5 진입 시 set-level progress 영역 로드
function loadStep5Progress(yearTag, dataDir) {
  const p = path.join(dataDir, `step5_progress_${yearTag}.json`);
  if (fs.existsSync(p)) {
    const prog = JSON.parse(fs.readFileSync(p, "utf8"));
    console.log(
      `  📍 step5 진행 영역 로드: ${prog.completedSets.length} set 종결 (${prog.timestamp})`
    );
    return prog;
  }
  return { completedSets: [], timestamp: null };
}

function saveStep5Progress(yearTag, dataDir, completedSets) {
  const p = path.join(dataDir, `step5_progress_${yearTag}.json`);
  fs.writeFileSync(
    p,
    JSON.stringify({
      completedSets,
      timestamp: new Date().toISOString()
    }, null, 2),
    "utf8"
  );
}

function clearStep5Progress(yearTag, dataDir) {
  const p = path.join(dataDir, `step5_progress_${yearTag}.json`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
```

### 2. set loop 영역 정정

`verifyAndFix` 영역 (또는 step5 main loop 영역):

```javascript
// 기존 set loop 영역 정정
const progress = loadStep5Progress(yearTag, dataDir);

for (const set of allSets) {
  // ── set 영역 skip 점검 ──────────────────────
  if (progress.completedSets.includes(set.id)) {
    console.log(`  ⏩  ${set.id} skip (이전 회기 종결)`);
    continue;
  }
  
  // ── 기존 set 처리 영역 그대로 ──────────────
  // - verifyDeterministic
  // - retry 3회 + step3 재호출
  // - postProcess
  // - needsReview 플래그
  
  // ── set 종결 즉시 저장 ──────────────────────
  progress.completedSets.push(set.id);
  saveStep5Progress(yearTag, dataDir, progress.completedSets);
}

// step5 종결 사후 progress file 삭제
clearStep5Progress(yearTag, dataDir);
```

### 3. step5_result file 영역 부분 보존 path

set 단위 step5_result file 영역 = 부분 보존 의무. 사례:
- r2025a 종결 → step5_result_2025수능.json 부분 영역 영입
- r2025b 단절 → step5_result_2025수능.json 영역에 r2025a 단독 영입

```javascript
// 각 set 종결 사후 step5_result file 영역 부분 저장
function appendStep5Result(yearTag, dataDir, setResult) {
  const p = path.join(dataDir, `step5_result_${yearTag}.json`);
  let allResults = { reading: [], literature: [] };
  
  if (fs.existsSync(p)) {
    allResults = JSON.parse(fs.readFileSync(p, "utf8"));
  }
  
  const section = setResult.id.startsWith("r") ? "reading" : "literature";
  // 같은 set id 영역 정합 사실 점검 (재 처리 영역 정합)
  const existingIdx = allResults[section].findIndex(s => s.id === setResult.id);
  if (existingIdx >= 0) {
    allResults[section][existingIdx] = setResult;
  } else {
    allResults[section].push(setResult);
  }
  
  fs.writeFileSync(p, JSON.stringify(allResults, null, 2), "utf8");
}
```

## 영향 점검 (회기 0.5 영입 사후)

| 시나리오 | 정정 사전 | 정정 사후 |
|---|---|---|
| step5 영역 r2025b 진행 중 단절 | 8 set 모두 재 진행 (시간 ~30~40분) | r2025a skip + r2025b 부터 진행 (시간 ~5~10분) |
| step5 영역 r2025d 진행 중 단절 | 8 set 모두 재 진행 | 4 set skip + r2025d 부터 진행 |
| 정상 종결 path | 영향 X | 영향 X (progress file 자동 삭제) |
| step3 / step4 영역 단절 | 영향 X (현재 cache 영역 정합) | 영향 X |

→ **시간 영역 절약 = 평균 ~50%** [Inference] (단절 시점 영역 무작위 가정).

## 추가 lock

1. **set-level 단독 영입** — retry-level 영역 X (정정 3 영역 = 회기 11+)
2. **step3 / step4 영역 변경 X** — 본 회기 영역 단독 (cache 영역 정합)
3. **progress file 영역 위치** = `pipeline/test_data/step5_progress_{yearTag}.json` (기존 cache 영역 정합)
4. **정상 종결 사후 progress file 자동 삭제** — 다음 회기 영향 X

## 산출물

### file (수정)
- `pipeline/step5_verify.js` — set loop 영역 정정 + 함수 3건 영입

### file (수정 X)
- `pipeline/index.js` — 영역 변경 X (step5 단독 정정)
- `pipeline/step3_analysis.js` / `step4_csids.js` — 영역 변경 X

### file (신규 — runtime 단독 영역)
- `pipeline/test_data/step5_progress_{yearTag}.json` — runtime 단독 (정상 종결 사후 자동 삭제)

## 답변 의무 형식 (CLAUDE.md §1 정합)

산출물 file 영역 raw + 정상 종결 사례 + 단절 + 재 시작 사례 (시간 영역 점검).
마무리 3종 (지금 당장 할 것 / 하지 말 것 / 가장 큰 리스크).

## ETA

1~2시간

## 진입 시점

- 사용자 본 회기 (2025수능 sequential) 종결 사후 즉시
- 회기 1 (Phase 1 측정) 사전 진입 path 정합
- 회기 1~10 영역 영향 X (independent)

## 회기 path 영역 영향

- 회기 1: 영향 X
- 회기 2~10: 영향 X
- 단 사용자 시간 영역 = 단절 사례 다수 ↓ 영역
- 2026수능 + 2022수능 추가 추출 path 영역 = 본 회기 0.5 사후 진행 path 정합
