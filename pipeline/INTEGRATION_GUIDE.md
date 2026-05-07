# 파이프라인 통합 가이드

## 1. 파일 배치

```
pipeline/
  step2_postprocess.mjs   ← NEW
  step3_rules.mjs         ← NEW
  quality_gate.mjs        ← NEW
```

---

## 2. step2_extract.js 수정 (3줄)

### 상단 import 추가

```js
import { postprocess } from "./step2_postprocess.mjs";
```

### extractStructure() 함수 내부 — 캐시 저장 직전에 삽입

찾을 위치: `console.log(` ✅ ${sec} 검증 통과 (${sets.length}세트)`);` 바로 다음 줄

```js
// ↓ 이 줄 추가
postprocess(sets, sec);

if (cachePath) {
  fs.writeFileSync(cachePath, JSON.stringify(sets, null, 2), 'utf8');
```

---

## 3. step3_analysis.js 수정 (3줄)

### 상단 import 추가

```js
import { enforceRules } from "./step3_rules.mjs";
```

### postProcess() 함수 내부 — updatedChoices.push(choice) 직전에 삽입

찾을 위치:

```js
          if (okChanged) {
            console.log(`  [postProcess] analysis 재생성: ${set.id} ${q.id}번 선지${c.num}`);
            try { choice.analysis = await reanalyzeSingleChoice(set, q, choice); }
            catch (err) { console.warn(`  [postProcess] analysis 재생성 실패: ${err.message}`); }
          }

          updatedChoices.push(choice);  ← 이 줄 직전에 삽입
```

삽입할 코드:

```js
// ↓ 이 줄 추가
const warns = enforceRules(choice, q.questionType, section);
if (warns.length > 0)
  warns.forEach((w) =>
    console.warn(`  [rules] ${set.id} Q${q.id}-[${choice.num}]: ${w}`),
  );
```

---

## 4. 일상 사용법

### 신규 시험 추가 후

```bash
# 자동: step2에서 postprocess, step3에서 enforceRules가 자동 실행됨

# 최종 확인
node pipeline/quality_gate.mjs 2024_9월

# 자동수정
node pipeline/quality_gate.mjs --fix 2024_9월

# analysis 내용 반전 있으면 (Y항목)
node pipeline/reanalyze_positive.mjs 2024_9월

# WARN 0 확인
node scripts/apply_annotations.cjs
git add src/data/all_data_204.json && git commit -m "..."
```

### 전체 데이터 주기적 점검

```bash
node pipeline/quality_gate.mjs
node pipeline/quality_gate.mjs --fix
```

---

## 5. 기존 일회성 스크립트 → quality_gate로 대체

| 기존 스크립트          | quality_gate 대응           |
| ---------------------- | --------------------------- |
| fix_violations.cjs     | --fix (D항목: ok:true+pat)  |
| fix_qt_and_ok.cjs      | --fix (A항목: questionType) |
| fix_text_pollution.cjs | --fix (B,C항목)             |
| fix_question_types.cjs | --fix (A항목)               |
| fix_annotations.cjs    | --fix (F항목)               |
| patch_q21_pat0.cjs     | --fix + reanalyze_positive  |

기존 스크립트는 삭제하지 말고 scripts/ 폴더에 보관 (롤백용)
