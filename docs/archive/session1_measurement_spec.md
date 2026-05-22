# 회기 1: Phase 1 측정 spec — 데이터 엔지니어 paste 영역

## 회기 lock

본 회기 = **측정 단독 회기**. 코드 / prompt / max_tokens 수정 금지.
산출물 4건 raw 회신 의무.

## 컨텍스트

레드팀 + 품질 심사관 + 사용자 종합 결정 (2026-05-08):
- prompt 강화 path 폐기 (label drift 위험)
- max_tokens 정정 = 측정 사후 분기 의무
- bracket repair = deterministic rendering (`normalizeAnalysisPatLabel`, append X)
- 핵심 차별점 = cs_ids 직접성 (bracket pat < cs_ids)
- 자동화 우선 (사용자 검수 ~10% 표준)

## 측정 산출물 4건

### 1. needsReview issue code histogram

**source**: `pipeline/test_data/step5_result_*수능*.json` (현재 산출 시험 영역 — 2025수능 + 옛 회기)

**필드**: `questions[].choices[]._discriminative_validation`

**산출 형식**:
```
[needsReview issue code 분포]

| issue_code           | stage         | count | ratio |
|----------------------|---------------|-------|-------|
| wrong_no_pat_code    | postProcess   | XX    | XX%   |
| correct_insufficient_refs | postProcess | XX | XX% |
| wrong_no_negation_mark | postProcess | XX | XX% |
| ... (모든 issue code)

[stage 분포]

| stage          | count | ratio |
|----------------|-------|-------|
| postProcess    | XX    | XX%   |
| reanalyze      | XX    | XX%   |
| step5          | XX    | XX%   |

[대표 raw 3건] (각 issue_code 별 setId / questionId / choiceNum + raw analysis 마지막 100자)

issue_code: wrong_no_pat_code
  case 1: r2024a Q2#1 — analysis tail: "..."
  case 2: r2024a Q2#2 — analysis tail: "..."
  case 3: ...
```

### 2. step5 FAIL-FAST 분포

**source**: 직전 turn raw log (2024수능 58건) + 2025수능 step5_result raw

**산출 형식**:
```
[step5 FAIL-FAST 분포 — 2024수능]

| 종류                   | count | ratio |
|------------------------|-------|-------|
| pat_missing            | XX    | XX%   |
| pat_out_of_domain      | XX    | XX%   |
| ok_analysis_mismatch   | XX    | XX%   |
| 기타                   | XX    | XX%   |

[setId 분포]

| setId    | count |
|----------|-------|
| r2024a   | XX    |
| r2024b   | XX    |
| ... (모든 set)

[questionId 분포]

| qId  | count |
|------|-------|
| Q2   | XX    |
| Q3   | XX    |
| ...

[2025수능 분포] (별도 표)
```

### 3. json_parse_fail 원인 분기

**source**: `pipeline/index.js` 또는 `step3_analysis.js` callAnalyze 영역
**재현 path**: 직전 turn 2024수능 r2024b retry fail 사례 (position 8531) + 다른 사례

**의무**: 본 회기 영역에서 stop_reason 로깅 영입 (코드 영역 단순 print 추가 path — 기능 변경 X)

```javascript
// step3_analysis.js callAnalyze 영역 — 진단 로깅 단독 (기능 영역 변경 X)
console.log(`[diagnostic] stop_reason=${response.stop_reason}`);
console.log(`[diagnostic] response length=${response.content[0].text.length}`);
console.log(`[diagnostic] response tail (last 100): ${response.content[0].text.slice(-100)}`);
console.log(`[diagnostic] usage=${JSON.stringify(response.usage)}`);
```

**산출 형식**:
```
[json_parse_fail 사례 분석]

사례 1: 2024수능 r2024b retry (position 8531)
  - stop_reason: "max_tokens" / "end_turn" / ...
  - 응답 길이: XXXX tokens
  - prompt 길이: XXXX tokens
  - raw response tail (마지막 100자):
    "..."
  - repair 실패 유형: 직접 파싱 fail / 따옴표 / 배열 병합 / jsonrepair
  - 해석 [Inference]: truncation / invalid JSON / 부연 설명 / ...

사례 2: ...
사례 3~5: ...

[종합 분포]

| stop_reason   | count |
|---------------|-------|
| max_tokens    | XX    |
| end_turn      | XX    |
| ...

| repair 실패 유형 | count |
|------------------|-------|
| 직접 파싱       | XX    |
| 따옴표          | XX    |
| 배열 병합       | XX    |
| jsonrepair      | XX    |
```

### 4. cs_ids 직접성 점검 (핵심 차별점)

**source**: 5 수능 step5_result + (가능 시) `quality_gate.mjs` cs_ids 영역

**산출 형식**:
```
[cs_ids 직접성 점검]

#1. cross-set leak 사례 (다른 set 영역 sentId 영입)
  사례 1: r2024d Q15#5 — cs_ids=[r2024as87, r2024as86] (set d 영역에 set a sentId)
  사례 2: r2024d Q16#5 — cs_ids=[r2024as89, r2024as90, r2024as91]
  ... (모든 사례)
  
  분포: setId 별 cross-set leak count

#2. sentId allowlist 위반 사례
  - 동 set 영역 sentId 외 영입 (예: r2024d_s99 등 존재 X sentId)
  - 사례 + 분포

#3. directness 위반 사례
  - cs_ids 영역 ↔ analysis 근거 직접성 부족 (예: cs_ids=[s5] 단 analysis 영역 = s7 인용)
  - 사례 3~5건 + 분포

#4. alignment 위반 사례
  - 정답 vs 오답 cs_ids 정합 부족 (예: 오답 선지 cs_ids 영역 = 정답 선지 cs_ids 영역과 동일)
  - 사례 3~5건 + 분포

#5. coverage 위반 사례
  - cs_ids 누락 (ok=false 단 cs_ids=[])
  - cs_ids 영역 1건 단독 (정답 선지 영역 다수 sentId 의무)
  - 사례 + 분포

[종합 평가]

핵심 차별점 영역 (cs_ids) 영향 사례:
- 학생 영역 잘못된 형광펜 도착 가능 사례 = XX건
- 학생 영역 형광펜 도착 X 사례 = XX건
- ratio = XX%
```

## 추가 lock

1. **wrong_no_pat_code 비율** = histogram 사전 숫자 영입 X
2. **bracket repair** = `appendPatCode` X. `normalizeAnalysisPatLabel` (3 case 모두) 의무
3. **analysis 영역 옛 라벨** ([패턴3], [오류유형②] 등) 정규화 path 사후 회기
4. **choice.pat** = step3 산출 + override + validation 사후 구조화 필드 단독 source of truth

## 산출물 회신 path

markdown 영역 (4 산출물 raw) → 품질 심사관 (Chat 1) 검수 → 회기 2 (정정 분기 결정) 진입

산출물 대량 시 압축 path:
- 분포 표 (count + ratio) + 대표 raw 3~5건 (raw 길이 단축)
- 전체 raw = 별도 file (예: `docs/phase1_measurement_raw.json`) 보관

## 답변 의무 형식 (CLAUDE.md §1 정합)

각 산출물 raw + 분포 표.
누락 영역 / 측정 도구 미흡 영역 식별 (있으면).
마무리 3종 (지금 당장 할 것 / 하지 말 것 / 가장 큰 리스크).

## 회기 1 종결 사후 진입

회기 2 (정정 분기 결정) — 본 chat 자율 영역 (사용자 작업 0).
