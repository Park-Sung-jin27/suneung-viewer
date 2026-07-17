# 회기 8: Pre-LLM Guardrail spec — 데이터 엔지니어 paste 영역

## 회기 lock

- 본 회기 = Pre-LLM Guardrail 영역 단독 영입
- 회기 1~3 병행 가능 path (sequential 의무 X)
- 레드팀 검수 사전 의무 (lock D 정합)

## 컨텍스트

### Multi-layer validation 표준 (Khanmigo / Arthur.ai 정합)

| Layer                             | 영역                                 | 본 프로젝트 영역             |
| --------------------------------- | ------------------------------------ | ---------------------------- |
| **Pre-LLM Guardrail** (본 회기)   | 입력 영역 검수 — 모델 호출 사전 차단 | step1 + step2 사전 진입 점검 |
| Layer 1 (Automated Fact-Checking) | deterministic 검증                   | step5 (✓ 영역)               |
| Layer 2 (Pedagogical Linting)     | rule-based                           | D엔진 (회기 7)               |
| Post-LLM Guardrail                | 출력 영역 검수 + 자동 release 분기   | 회기 9 영역                  |
| Layer 3 (Human-in-the-Loop)       | 5~10% 사용자 검수                    | needs_human 큐 (회기 7)      |

## Pre-LLM Guardrail 영역 작업

### file 신규 영입

`pipeline/pre_llm_guardrail.js` (신규)

### 8-1. PDF 무결성 점검

#### 페이지 수 영역

- 시험지 PDF ≥ 4페이지 (수능 영역 표준)
- 정답 PDF ≥ 1페이지
- 미달 시 → reject + 사용자 알림

#### 텍스트 추출 가능 영역

- pdf-parse v2 영역 (사용자 메모리 정합)
- 추출 실패 시 → reject + OCR path 권고

#### 합본 PDF 거부

- 28p 이상 합본 PDF 거부 (사용자 메모리 정합 — 5/3 회기 lock)
- 페이지 수 + 시험지 영역 정합 점검:
  - reading 1~~17번 + literature 18~~34번 + 어휘 35~45번 = ~~16~~24페이지 영역
  - 28페이지 이상 = 합본 가능성

```javascript
function rejectIfCombinedPDF(pdfPath) {
  const pages = await pdfParse(pdfPath).then(r => r.numpages);
  if (pages > 28) {
    throw new Error(`[pre_llm_guardrail] PDF page count (${pages}) > 28. 합본 PDF 가능성. 단일 시험 PDF 영역 영입 의무.`);
  }
}
```

### 8-2. 입력 file 영역 sanity check

#### 파일 크기 영역

- 시험지 PDF: 100KB~10MB (예상 영역)
- 정답 PDF: 10KB~1MB
- 미달 / 초과 시 → 경고 (reject X)

#### 파일 인코딩 영역

- pdf 영역 utf-8 텍스트 추출 가능 영역
- 한글 영역 깨짐 점검

#### 시험지 ↔ 정답 PDF 영역 정합

- 시험지 PDF 시험 키 ↔ 정답 PDF 시험 키 정합 (예: 2025수능*시험지.pdf + 2025수능*정답.pdf)
- 불일치 시 → reject

### 8-3. step1 + step2 사전 진입 점검

`pipeline/index.js` 영역에 호출 영입:

```javascript
// pipeline/index.js
import { runPreLLMGuardrail } from "./pre_llm_guardrail.js";

async function main() {
  const examPdfPath = process.argv[2];
  const answerPdfPath = process.argv[3];
  const examKey = process.argv[4];

  // [Pre-LLM Guardrail] step1 사전 진입 점검
  await runPreLLMGuardrail(examPdfPath, answerPdfPath, examKey);

  // step1~7 진입
  ...
}
```

### 8-4. 추가 영역 (Phase 2 — 회기 영역 X)

다음 영역 = 본 회기 영역 X (회기 영역 영입 사후 path):

- 시험지 PDF 영역 vs 정답 PDF 영역 cross-validation (정답 번호 영역 정합)
- 시험 영역 적합성 점검 (수능 / 6모 / 9모 영역 — examKey 영역 정합)
- 시각 영역 (그림 / 표) 점검

→ lock C (불필요한 고도화 회피) 정합. 본 회기 = 핵심 영역 단독.

## 산출물

### file (신규)

- `pipeline/pre_llm_guardrail.js` — 핵심 함수 영역

### file (수정)

- `pipeline/index.js` — Pre-LLM Guardrail 호출 영입 (line 영역 단독)

### 진단 로깅 영역

```
[pre_llm_guardrail] 점검 시작: examPdf=2025수능_시험지.pdf
[pre_llm_guardrail] PDF 페이지 수: 22 ✓
[pre_llm_guardrail] 텍스트 추출: ✓
[pre_llm_guardrail] 합본 PDF 점검: ✓
[pre_llm_guardrail] 시험 키 정합: ✓
[pre_llm_guardrail] 통과 — step1 진입
```

reject 시:

```
[pre_llm_guardrail] ❌ 차단: PDF 페이지 수 (32) > 28. 합본 PDF 가능성.
[pre_llm_guardrail] 사용자 작업 의무: 단일 시험 PDF 영역 영입 의무.
```

## 답변 의무 형식 (CLAUDE.md §1 정합)

산출물 file 영역 raw + 진단 로깅 영역 raw + 통과 사례 1건 + reject 사례 1건.
마무리 3종 (지금 당장 할 것 / 하지 말 것 / 가장 큰 리스크).

## 추가 lock

1. **기능 영역 변경 X** — 사전 진입 점검 영역 단독 (step1~7 영역 변경 X)
2. **reject 영역 = 사용자 알림 path 의무** — 단순 throw X. 사용자 의무 영역 명시 path
3. **레드팀 검수 사전 의무** — `pre_llm_guardrail.js` raw 발행 사전 (lock D 정합)

## ETA

1일

## 회기 영향 영역

- 회기 1~3 병행 가능 (sequential 의무 X)
- 회기 7 (D엔진 통합) 사전 영입 path 정합
- 회기 9 (Post-LLM Guardrail) 영역 cross-reference path
