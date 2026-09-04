# analysis schema adapter — Y.3b design spec

> 본 문서는 **schema 정의만** 산출 정합. migration 진행은 별도 회기 + 사용자 결정 의무.

## 목적

B1 ↔ D엔진 순서 결정 사전 정의. 실제 migration 영구 lock (defer).

## 현재 schema (analysis 단일 string)

```json
{
  "choice": {
    "num": 1,
    "ok": false,
    "pat": "R1",
    "analysis": "📌 지문 근거: \"...\"\n🔍 분석: ...\n🔎 정답 비교: ...\n❌ 지문과 어긋나는 부적절한 진술 [R1]",
    "cs_ids": ["..."],
    "cs_spans": [...]
  }
}
```

## 6 항목 design spec

### 3-1. footer 식별 path

현재 analysis 안 footer pattern 정규식:

- `ok:true` → `/✅ 지문과 일치하는 적절한 진술/`
- `ok:false` → `/❌ 지문과 어긋나는 부적절한 진술 \[(R[1-4]|L[1-5]|V)\]/`

`splitAnalysis(analysisString)` function 설계:

```js
function splitAnalysis(analysis) {
  const lines = analysis.split("\n");
  const lastLine = lines[lines.length - 1].trim();
  const footerOkTrue = /^✅ 지문과 일치하는 적절한 진술/;
  const footerOkFalse =
    /^❌ 지문과 어긋나는 부적절한 진술 \[(R[1-4]|L[1-5]|V)\]/;

  const footerValid =
    footerOkTrue.test(lastLine) || footerOkFalse.test(lastLine);

  return {
    body: footerValid ? lines.slice(0, -1).join("\n").trimEnd() : analysis,
    footer: footerValid ? lastLine : null,
    footer_valid: footerValid,
  };
}
```

### 3-2. analysis_body 별도 field 저장 path

schema 안 추가 field (도입 X — 정의만):

```json
{
  "choice": {
    "num": 1,
    "ok": false,
    "pat": "R1",
    "analysis_body": "📌 지문 근거: \"...\"\n🔍 분석: ...\n🔎 정답 비교: ...",
    "analysis_footer": "❌ 지문과 어긋나는 부적절한 진술 [R1]",
    "analysis": "<body + \\n + footer>"
  }
}
```

`analysis` field 기존 호환 — body + footer 결합 string. viewer 안 호환 정합.

### 3-3. D엔진 input 안 analysis_body 도입 path

`d_engine_wrapper.mjs` input field 정정:

```diff
- analysis: "📌 ... 🔍 ... 🔎 ... ❌ ... [R1]"
+ analysis_body: "📌 ... 🔍 ... 🔎 ..."
+ analysis_footer: "❌ ... [R1]"
```

D엔진 prompt 정정 의무:

- 현재 : `analysis 안 footer + body 모두 검증`
- 정정 : `analysis_body 안 pat 정합 검증 (footer 검증 외 — B1 정합)`

영향 : `pipeline/run_dryrun_all.mjs` input 정합 의무 + Gold sample 재산출 의무.

### 3-4. viewer render path

현재 : `analysis` 전체 단일 string render.

분리 사후 (Code A 영역) :

- `analysis_body` render
- `analysis_footer` 별도 render (visual 구분 가능)
- 호환 path : `analysis` field 잔존 — viewer 정합

**영향 검증 의무** : Code A chat 안 `cleanAnalysis` logic 영향 + `QuestionQA.jsx` 안 render path 정합 검증.

### 3-5. quality_gate 검사 field

현재 : `analysis` 단일 field.

분리 사후 :

- `analysis_body` 안 footer pattern 잔존 검출 path 정합
- 추가 issue_code : `ANALYSIS_BODY_FOOTER_LEAK` (body 안 footer marker 잔존 검출)
- existing : `validateAnalysisQuality` logic 정합 (`step3_analysis.js` 영역)

### 3-6. 기존 all_data migration 정책

**영구 lock** : 본 Y.3b 안 migration 영구 X (defer)

migration 진행 결정 = 별도 회기 + Code A 영역 영향 사용자 결정 의무

## migration impact 분석

| 항목           | 수치                                                                               |
| -------------- | ---------------------------------------------------------------------------------- |
| 영향 set 수    | 302                                                                                |
| 영향 choice 수 | ~50000 (302 × ~170 choices)                                                        |
| 영향 file      | `data-source/all_data_204.json` (정본)                                             |
| Code A 영역    | `dataLoader.js`, `QuestionQA.jsx`, `QuizPanel.jsx`, `cleanAnalysis` logic          |
| Code B 영역    | `step3_analysis.js`, `step5_verify.js`, `quality_gate.mjs`, `d_engine_wrapper.mjs` |
| 잠재 위험      | viewer 안 footer render 사양 미정합 시 학생 화면 footer 부재                       |

## 진행 순서 권고 (영구 lock — 사용자 결정 의무)

1. **단계 A — schema 도입 (Code B 영역)**
   - `splitAnalysis` function 도입
   - migration script 도입 (단 호출 X)
   - dry-run audit 진행 (영향 사양 정확 검증)

2. **단계 B — Code A 영역 영향 검증**
   - `cleanAnalysis` logic 영향 검증
   - viewer render path 영향 검증
   - 사용자 결정 의무

3. **단계 C — migration 실행 (사용자 명시 승인 사후)**
   - dry-run 통과 사후 production migration
   - backup + abort guard 의무

4. **단계 D — D엔진 정정 + Gold sample 재산출**
   - `d_engine_wrapper.mjs` input 정정
   - `run_dryrun_all.mjs` 정정
   - Gold sample 재산출 + 비교 검증

## 결론

**본 Y.3b 산출** : 6 항목 design spec + migration impact 분석.

**migration 진행 영구 X** : 사용자 결정 + Code A 영역 영향 검증 사후만 진행.

**B1 ↔ D엔진 순서 결정** : analysis schema adapter 도입 사후 결정.

- splitAnalysis 도입 사후 : D엔진 input = analysis_body 단독 → B1 사후 D엔진 호출 정합
- 단계 A 단독 사후 : B1 → D엔진 순서 정합 (현재 정합)
