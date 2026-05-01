# §4.1 D엔진 Wrapper 사양서 v1.1

> 작성: 2026-04-27
> 채택 결정: 옵션 1 (wrapper 단독, 실제 GPT-5 caller는 §4.1.5 별도)
> 자가 검토: 통과 (모호점 6건 minor, 구현 차단 0건)
> v1.2 보강 대상: 5/15 모두의창업 제출 후 별도 회기

---

## §4-1. preflight 8건 raw 인용

```
A. Gold 파일 실측
A1. samples 배열 길이: 17
A2. dryrun_inputs.json samples 길이: 17 (gold와 일치)
A3. R2_010 line 위치: 847
A4. RULE_7 트리거 샘플: 있음 — gold_R1_006
    expected_output.rule_hits = ["RULE_7_ANALYSIS_TOO_VAGUE"]
    error_type = E_LOGIC_UNCLEAR
    Phase 1 17개 active 중 RULE_7 명시 보유 sample 1개

B. 코드베이스
B5. applyMajority 시그니처:
    export function applyMajority(responses)
    responses: 3개 배열, 각 요소 { pass, error_type, rule_hits, reason, confidence }
    returns: { decision: "majority_accepted"|"needs_human", final: {...}|null, metadata: {...} }
B6. 기존 D엔진 GPT-5 호출 코드: 없음 — 신규 작성 필요
B7. GPT-5 API 라이브러리: 없음 — npm install openai 신규 필요
B8. OPENAI_API_KEY: 미정의 (Select-String 결과 0건)
```

---

## §4-2. 함수 시그니처

```javascript
export async function callDEngineWithMajority(input, options)
```

**입력:**

- `input`: D엔진 표준 입력 JSON
  - 필수 필드: `passage`, `question_text`, `choice_text`, `analysis`, `pat`, `ok`, `questionType`, `bogi`, `domain`, `precheck_signals`
  - 스키마 참조: `config/d_engine_input_schema.md`
- `options`: 객체
  - `caller`: function — GPT-5 호출 함수 (mock 또는 실제). 필수
  - `timeout`: number (기본 60000ms)
  - `max_format_retries`: number (기본 3) — JSON parse 실패 retry
  - `max_caller_retries`: number (기본 3) — 네트워크 실패 retry
  - `parallel`: boolean (기본 false, true 시 3회 호출 병렬)
  - `model`: string (기본 "gpt-5")
  - `temperature`: number (기본 0)
  - `max_tokens`: number (기본 1000)

**출력:**

```javascript
{
  decision: "single_pass" | "majority_accepted" | "needs_human",
  final: {
    pass: boolean,
    error_type: string,
    rule_hits: string[],
    reason: string,
    confidence: "high" | "mid" | "low"
  } | null,
  metadata: {
    run_count: 1 | 3,
    trigger_reason: "no_trigger" | "rule_7_detected",
    diversity_count: number,
    majority_count: number,
    low_confidence_flag: boolean,
    discarded_rule_hits: string[] | null,
    candidate_for_human_review: boolean,
    runs: Array<응답 객체>,  // length: 1 | 2 | 3 (decision에 따라)
    timestamp: string,
    api_call_durations_ms: number[],
    errors: Array<{ run_index: number, error_type: string, message: string }> | undefined
  }
}
```

---

## §4-3. Step 1~7 로직

### Step 1: 입력 검증

```
- input 객체 필수 10개 필드 존재 확인
  (passage, question_text, choice_text, analysis, pat, ok, questionType, bogi, domain, precheck_signals)
- options.caller 함수 존재 확인 (typeof === "function")
- 누락 시 throw new Error("callDEngineWithMajority: missing required field [필드명]")
```

### Step 2: 1차 D엔진 호출

```
- D_ENGINE_PROMPT const 상수 사용 (wrapper 모듈 내 인라인)
- buildPrompt(input)으로 prompt 생성
- options.caller(buildPrompt(input), { model, temperature, max_tokens }) 호출
- 응답 객체 검증:
  - 필수 필드: pass, error_type, rule_hits, reason, confidence
  - error_type enum 검증
- 형식 오류 시 max_format_retries 회 재호출
- caller throw 시 max_caller_retries 회 재호출 (지수 백오프 1s/2s/4s)
- 두 retry 카운터 독립
- 모두 실패 시:
  throw new Error("callDEngineWithMajority: 1차 호출 max_retries 실패")
- 시간 측정: api_call_durations_ms[0] = end - start
- runs[0] = 1차 응답
```

### Step 3: 재호출 트리거 검사

```
- response.rule_hits 배열에 "RULE_7_ANALYSIS_TOO_VAGUE" 포함 여부 검사
- 미포함 (single_pass 분기):
  decision = "single_pass"
  final = runs[0]
  metadata = {
    run_count: 1,
    trigger_reason: "no_trigger",
    diversity_count: 1,
    majority_count: 1,
    low_confidence_flag: false,        // v1.1-5 결정: 옵션 A
    discarded_rule_hits: null,
    candidate_for_human_review: false,
    runs: [runs[0]],
    timestamp: ISO 8601,
    api_call_durations_ms: [duration]
  }
  → return (Step 7 skip)
- 포함:
  metadata.trigger_reason = "rule_7_detected"
  Step 4 진입
```

### Step 4: 2회 추가 호출

```
- options.parallel === true:
  Promise.allSettled([caller(...), caller(...)])  // E3 부분 실패 호환
- options.parallel === false (기본):
  caller 2회 순차 호출
- 각 호출 응답 검증 (Step 2와 동일 절차)
- 응답 형식 오류 시 max_format_retries
- caller 실패 시 max_caller_retries (지수 백오프)
- 추가 재시도 실패 시:
  metadata.errors = [...]에 기록 (run_index, error_type, message)
- 시간 측정: api_call_durations_ms[1], api_call_durations_ms[2]

Step 4 후 검증:
  if (runs.length < 3):
    decision = "needs_human"
    final = null
    metadata.runs = runs (실제 받은 개수)
    metadata.errors = [...]
    metadata.candidate_for_human_review = true
    return  (Step 5 skip)
  
  if (runs.length === 3):
    Step 5 진입
- metadata.run_count = 3
```

### Step 5: applyMajority 호출

```
- import { applyMajority } from "./d_engine_majority.mjs"
- try { result = applyMajority(runs); }
- catch (e) {  // E6
    decision = "needs_human"
    final = null
    metadata.runs = runs
    metadata.errors = [{ run_index: -1, error_type: "majority_failure", message: e.message }]
    metadata.candidate_for_human_review = true
    return
  }
- result 구조:
  { decision: "majority_accepted" | "needs_human",
    final: {...} | null,
    metadata: { diversity_count, majority_count, low_confidence_flag,
                discarded_rule_hits, candidate_for_human_review, ... } }
```

### Step 6: metadata 통합

```
- decision = result.decision
- final = result.final
- metadata.diversity_count = result.metadata.diversity_count
- metadata.majority_count = result.metadata.majority_count
- metadata.low_confidence_flag = result.metadata.low_confidence_flag
- metadata.discarded_rule_hits = result.metadata.discarded_rule_hits
- metadata.candidate_for_human_review = result.metadata.candidate_for_human_review
- metadata.runs = runs (3개 그대로 보존)
- metadata.timestamp = new Date().toISOString()
- metadata.api_call_durations_ms = [모두 기록]
- metadata.errors = (Step 4에서 발생 시) errors 배열, 없으면 undefined
```

### Step 7: 반환

```
return { decision, final, metadata }
```

---

## §4-4. 엣지 케이스 E1~E8

### E1: caller 호출 실패 (네트워크/rate limit)

```
- caller가 throw 시 catch
- 지수 백오프 재시도 (max_caller_retries 회)
  - 재시도 간격: 1s, 2s, 4s
- max_caller_retries 모두 실패 시:
  metadata.errors[run_index] = { error_type: "caller_failure", message: error.message }
  - 1차 호출이면 throw (전체 실패)
  - 2·3차 호출이면 부분 실패 처리 (Step 4 errors 기록)
```

### E2: 응답 검증 실패 (caller가 객체 반환했지만 필수 필드 누락)

```
- 필드 검증 실패 시
- 1회 재시도 (caller 1회 추가 호출)
- 재시도 실패 시:
  metadata.errors[run_index] = { error_type: "format_failure", message: error.message }
  - 1차 호출이면 throw
  - 2·3차 호출이면 부분 실패 처리
```

### E3: 1차 성공 + 트리거 발동 + 2·3차 부분 실패

```
- runs.length < 3 시 처리:
  - runs.length === 2:
    decision = "needs_human"
    final = null
    metadata.runs = runs (2개)
    metadata.errors = [...]
    metadata.candidate_for_human_review = true
  - runs.length === 1:
    Step 3에서 single_pass로 처리됐어야 함 — 이 경우 도달 불가
- applyMajority는 항상 3개 응답 받아야 함 → length < 3 시 호출 안 함
```

### E4: RULE_7 + 다른 규칙 동시 hit

```
- response.rule_hits에 RULE_7_ANALYSIS_TOO_VAGUE + 다른 RULE_X 포함 시
- RULE_7 트리거 우선 적용 (Step 3 트리거 발동)
- 3회 호출 진입
- applyMajority가 intersection / discarded 처리
```

### E5: input 형식 오류

```
- Step 1에서 검증 실패 시 즉시 throw
- caller 호출 안 함
- metadata.api_call_durations_ms = []
- 호출 비용 0
```

### E6: applyMajority 자체 throw

```
- Step 5에서 try/catch
- applyMajority가 throw 시:
  decision = "needs_human"
  final = null
  metadata.runs = runs (3개)
  metadata.errors = [{ run_index: -1, error_type: "majority_failure", message: error.message }]
  metadata.candidate_for_human_review = true
  return
```

### E7: caller timeout

```
- Promise.race([caller(...), timeoutPromise])
- timeoutPromise = setTimeout reject after options.timeout (60000ms)
- timeout 발생 시 caller 호출 catch
- max_caller_retries 회 재시도
- 모두 timeout 시 errors 기록 + 부분 실패 처리
```

### E8: parallel 호출 중 부분 실패

```
- options.parallel === true 시:
  Promise.allSettled([caller(...), caller(...)])
- allSettled 사용 이유:
  - all = 1개 실패 시 즉시 reject → 다른 응답 손실
  - allSettled = 모든 결과 수집 → E3 부분 실패 처리 가능
- 결과 처리:
  fulfilled → runs에 추가
  rejected → errors에 기록
```

---

## §4-5. mockCaller 인터페이스 (lock)

### 인터페이스 lock

```javascript
async function caller(prompt, options = {})

// options:
//   model: string (default "gpt-5")
//   temperature: number (default 0)
//   max_tokens: number (default 1000)

// caller 책임:
// 1. API 호출 (mock 또는 OpenAI)
// 2. 응답 raw 수신
// 3. JSON parse (실패 시 throw)
// 4. 객체 반환

// 반환 객체 형식 (mock·real 동일):
return {
  pass: boolean,
  error_type: string,
  rule_hits: string[],
  reason: string,
  confidence: "high" | "mid" | "low"
};
```

### Prompt 보관 (const 상수)

```javascript
// pipeline/d_engine_wrapper.mjs
const D_ENGINE_PROMPT = `역할: 수능 국어 오답 pat 검증 심판...`;
// d_engine_prompt.txt 내용 그대로 const 상수 (v1.2에서 SSoT 통합 예정)

function buildPrompt(input) {
  return `${D_ENGINE_PROMPT}

입력 JSON:
${JSON.stringify(input, null, 2)}

위 JSON에 대한 판정을 JSON 형식으로만 출력하라.`;
}
```

### Wrapper 내부 호출

```javascript
const response = await options.caller(buildPrompt(input), {
  model: options.model || "gpt-5",
  temperature: 0
});
```

---

## §4-6. mockCaller Phase 1 Gold 17개 매핑 정책

```
mockCaller 동작:
- 입력 prompt 안의 sample_id 또는 input.choice_text 인식
- Phase 1 Gold 17개 expected_output 사전 매핑
- 매핑된 응답 반환

회귀 테스트 시:
- gold_R1_001 input → mockCaller 호출 → expected response
- 17개 sample 전부 검증

매핑 작성 위치:
- pipeline/d_engine_wrapper.test.mjs 안에 mockCaller 정의
- 또는 별도 fixture 파일 (pipeline/d_engine_mock_responses.json)
```

---

## §4-7. 회귀 테스트

### 파일 위치

- `pipeline/d_engine_wrapper.mjs` (신규)
- `pipeline/d_engine_wrapper.test.mjs` (신규)

### 명령어 (절대경로)

```
node C:\Users\downf\suneung-viewer\pipeline\d_engine_wrapper.test.mjs
```

### 테스트 케이스 12건

```
1. Phase 1 Gold 17개 회귀 테스트
   - input: gold_R1_001 ~ gold_R2_010 (17개)
   - 검증:
     - 16개 single_pass 예상 (RULE_7 미발동)
     - 1개 majority_accepted 예상 (R1_006, RULE_7 발동)
     - needs_human 0건 예상

2. RULE_7 트리거 검증 (R1_006 단독)
   - input: gold_R1_006 input
   - 검증:
     - decision = "majority_accepted"
     - metadata.trigger_reason = "rule_7_detected"
     - metadata.run_count = 3

3. single_pass 케이스 (gold_R1_001)
   - 검증:
     - decision = "single_pass"
     - metadata.trigger_reason = "no_trigger"
     - metadata.run_count = 1

4. 입력 검증 throw (E5)
   - input 필수 필드 누락
   - 검증: throw 발생, caller 호출 안 됨

5. caller 실패 throw (E1)
   - mockCaller가 의도적으로 throw
   - 검증: max_caller_retries 후 throw

6. JSON parse 실패 (E2)
   - mockCaller가 invalid 응답 반환
   - 검증: 재시도 후 처리

7. 부분 실패 처리 (E3)
   - 2차 호출만 실패
   - 검증: needs_human 분기 + errors 기록

8. metadata 출력 스키마 검증
   - 모든 필수 필드 존재
   - 타입 정확성

9. timestamp + api_call_durations_ms 기록 정확성

10. parallel 옵션 동작 (true/false)

11. caller 응답 의도적 변형 (self-fulfilling 방지) [v1.1 신규]
    - input: gold_R1_001 (expected: pass=true, NONE)
    - mockCaller: 의도적으로 pass=false, P_MISMATCH 반환
    - 검증:
      - wrapper가 caller 응답 그대로 final에 통합 (검증 안 함)
      - wrapper의 책임 = caller 응답 통합, 정답 검증 아님
      - decision === "single_pass" (RULE_7 미발동)
      - final.error_type === "P_MISMATCH" (caller가 보낸 그대로)

12. needs_human 분기 (1/1/1) [v1.1 신규]
    - input: 임의 input
    - mockCaller: 1차/2차/3차 각각 다른 error_type 반환 (RULE_7 포함)
    - 검증:
      - decision === "needs_human"
      - final === null
      - metadata.runs.length === 3
      - metadata.diversity_count === 3
```

---

## §4-8. 환경변수 의존

```
§4.1 단계 (mock caller):
  - 환경변수 의존 0
  - mockCaller가 사전 매핑 응답 반환

§4.1.5 단계 (실제 caller):
  - OPENAI_API_KEY 필요 (현재 미정의)
  - .env에 추가 필요
  - Vercel 환경변수 등록 필요
```

---

## §4-9. step3_rules 통합 위치

```
[확인 필요 — 4/29 진행 시]
- step3_rules.js 또는 step3_rules.mjs 본문 확인
- 가정 [Inference]: 기존 step3_rules는 Anthropic Claude 호출
- callDEngineWithMajority는 step3 결과를 검증하는 후단계
- 통합 방식: step3 결과를 callDEngineWithMajority(input, options) 호출
- 정확한 통합 라인 위치는 데이터 엔지니어가 step3_rules 본문 회신 후 결정
```

---

## v1.1-5 결정 (옵션 A 채택)

**결정: single_pass 분기 시 `low_confidence_flag = false` 강제**

### 근거

- `low_confidence_flag` = "majority 그룹 신뢰도 우려 마커"
- single_pass에는 majority 그룹 자체 없음 → 마커 발동 의미 부재
- confidence 정보는 `final.confidence` 필드로만 보존
- §4.2 사양서와 의미 일관성

### 구현

```javascript
// Step 3 single_pass 분기 시
metadata.low_confidence_flag = false;  // [v1.1-5 결정: 옵션 A]
// caller 응답의 confidence가 'mid'/'low'여도 low_confidence_flag는 false 유지
// final.confidence 필드로만 신뢰도 보존
```

---

## minor 5건 처리 정책 (구현 시 결정 + 코드 주석 의무)

### 코드 주석 형식 표준

```javascript
// [v1.1-N 결정: 결정 내용]
// 사유: [간단 사유]
// v1.2 통합 대상
```

### v1.1-1: D_ENGINE_PROMPT 보관

```
구현 결정: const 상수 인라인
사유: I/O 1회 회피 + 단순화
v1.2 통합: SSoT (config/d_engine_prompt.txt와 단일 출처 통합)
```

### v1.1-2: caller markdown fence 처리

```
구현 결정: caller 내부 markdown fence (```json ... ```) strip 처리
사유: GPT-5 응답이 fence로 감쌀 가능성. mock 단계는 영향 없음
v1.2 통합: caller 인터페이스 사양에 strip 책임 정식 명시
```

### v1.1-3: options 객체 분리

```
구현 결정: wrapper-level vs caller-level 분리 주석
  wrapper-level: caller, timeout, parallel, max_format_retries, max_caller_retries
  caller-level: model, temperature, max_tokens
사유: 코드 가독성 + 책임 분리
v1.2 통합: options.callerOptions로 중첩 또는 별도 인자
```

### v1.1-4: retry 카운터 독립

```
구현 결정: max_format_retries와 max_caller_retries 독립 카운터
사유: 일반적 패턴 + 누적 호출 비용 예측 가능
v1.2 통합: 상호작용 정책 정식 명시
```

### v1.1-6: metadata.errors error_level

```
구현 결정: errors 배열 객체에 error_level field 추가
  { run_index: number, error_level: "caller"|"wrapper", error_type: string, message: string }
  - caller-level: run_index 0/1/2
  - wrapper-level: run_index -1
사유: 검증·로깅 시 구분
v1.2 통합: errors 배열 스키마 정식 분리
```

---

## v1.2 보강 대상 (5/15 후 별도 회기)

5/15 모두의창업 제출 후 v1.2 사양서로 통합:

1. v1.1-1: D_ENGINE_PROMPT SSoT 통합
2. v1.1-2: markdown fence strip 정식 사양화
3. v1.1-3: options 객체 정식 분리
4. v1.1-4: retry 카운터 정식 명시
5. v1.1-5: low_confidence_flag 정식 명시 (옵션 A 그대로 또는 갱신)
6. v1.1-6: metadata.errors error_level 정식 도입

---

## 자가 검토 (v1.1) 결과

**모호점 6건 (minor, 구현 차단 0건). §4.1 구현 진입 가능.**

### 12건 정정 검증

| 정정 | 평가 |
|---|---|
| Prompt const 상수 | ✅ |
| buildPrompt 함수 | ✅ |
| max_format_retries + max_caller_retries 분리 | ✅ |
| Step 3 single_pass metadata 5 필드 | ✅ |
| Step 4 length<3 단정 | ✅ |
| E6 applyMajority throw 처리 | ✅ |
| E7 Promise.race timeout | ✅ |
| E8 Promise.allSettled | ✅ |
| metadata.runs 길이 정책 | ✅ |
| Caller 응답 객체 lock | ✅ |
| Caller 시그니처 (prompt, options) | ✅ |
| 회귀 테스트 11·12 추가 | ✅ |

---

## 4/28 구현 일정 (예정)

### 오전

- (a) `HANDOVER_D_ENGINE_4_1_SPEC.md` 신규 파일 저장 (본 문서)
- (b) `pipeline/d_engine_wrapper.mjs` 작성 (코드 주석 6건 의무)
- (c) mockCaller + Phase 1 Gold 17개 매핑 작성

### 오후

- (d) `pipeline/d_engine_wrapper.test.mjs` 회귀 12건 작성
- (e) 회귀 테스트 실행 → 12/12 통과 확인
- (f) commit (4 파일):
  - HANDOVER_D_ENGINE_4_1_SPEC.md
  - pipeline/d_engine_wrapper.mjs
  - pipeline/d_engine_wrapper.test.mjs
  - mockCaller fixture (별도 파일이면)
  
  commit message: `feat: §4.1 D엔진 wrapper + mockCaller + 회귀 테스트 12건`
- (g) push

---

**문서 종결**