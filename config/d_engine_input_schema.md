# d_engine_input_schema.md — 완성본 (Phase 1)

## 역할

GPT-5 기반 **독립 semantic judge**.
Claude가 생성한 `analysis`와 `pat`이 실제 오류 구조와 일치하는지 **반증 판정**한다.

핵심 원칙:

* D엔진은 **분류기**가 아니다.
* D엔진은 `pat`을 새로 만들지 않는다.
* D엔진은 **"이 pat이 틀렸다"**만 판정한다.
* 애매하면 통과시키지 말고 `fail` 또는 사람 검수 경로로 보낸다.
* Layer 0 precheck의 의미 판단을 계승하지 않는다.
* `ok`는 참고 메타데이터일 뿐, pat 정당화 근거가 아니다.

---

## 입력 스키마

```json
{
  "passage": "string",
  "question_text": "string",
  "choice_text": "string",
  "analysis": "string",
  "pat": "R1|R2|R3|R4|L1|L2|L3|L4|L5|V|null",
  "ok": true,
  "questionType": "positive|negative",
  "bogi": "string|null",
  "domain": "reading|literature",
  "precheck_signals": {
    "domain_mismatch_detected": false,
    "pat_missing_detected": false,
    "composite_label_detected": false,
    "bracket_recovery_applied": false
  }
}
```

### 필드 정의

* `passage`: 지문 전문 또는 해당 선지 판단에 필요한 관련 문단
* `question_text`: 발문 전문
* `choice_text`: 선지 전문
* `analysis`: Claude가 생성한 해설
* `pat`: Claude가 생성한 현재 pat
* `ok`: 현재 선지의 지문 사실 일치 여부 메타데이터
* `questionType`: positive / negative
* `bogi`: 보기 문항이면 보기 전문, 아니면 null
* `domain`: reading / literature
* `precheck_signals`: **참고용 플래그만 허용**

  * `domain_mismatch_detected`: 도메인 위반 감지 여부
  * `pat_missing_detected`: pat 누락 여부
  * `composite_label_detected`: 복합 오류 라벨 감지 여부
  * `bracket_recovery_applied`: exact bracket recovery 적용 여부

### 입력 금지 사항

다음은 입력에 넣지 않는다.

* `numeric_conflict_detected`
* `explicit_negation_detected`
* semantic diff_type
* entity_match 관련 필드
* 구조 위치 / 표현 블록 / N-gram 관련 필드
* suggested pat 후보

이유: D엔진 독립성 약화 방지.

---

## 출력 스키마

```json
{
  "pass": true,
  "error_type": "NONE|P_MISMATCH|E_EVIDENCE_WEAK|E_LOGIC_UNCLEAR|E_CONDITION_MISSING|E_DOMAIN_INVALID|E_COMPOSITE_ERROR",
  "rule_hits": ["RULE_ID"],
  "reason": "string",
  "confidence": "high|mid|low"
}
```

### 출력 필드 정의

* `pass`

  * `true`: 현재 pat/analysis가 반증되지 않음
  * `false`: 현재 pat/analysis에 구조적 문제가 있음
* `error_type`

  * 대표 실패 유형 1개
* `rule_hits`

  * 매칭된 규칙 ID 배열
* `reason`

  * 1~2문장
  * fail이면 구조적 이유를 구체적으로 적음
* `confidence`

  * high / mid / low

### 출력 금지 사항

* `suggested_pat`
* 새 pat enum
* 재생성된 analysis
* cs_ids 수정 제안
* ok 재판정

---

## error_type 정의

### NONE

`pass=true`일 때 사용.

### P_MISMATCH

현재 pat이 실제 오류 구조와 불일치.

예:

* analysis는 인과 전도를 지적하는데 pat=R1
* analysis는 의미 과잉을 말하는데 pat=L2
* analysis는 지문에 없는 주장이라고 하는데 pat=R1

### E_EVIDENCE_WEAK

analysis의 근거가 선지 판단에 직접 쓰이지 않음.

예:

* 선지의 핵심 조건과 직접 연결되지 않는 문장을 근거로 듦
* 배경 설명만 있고 판단 근거가 없음
* 형광펜/근거 문장이 해설 내용과 직접 이어지지 않음

### E_LOGIC_UNCLEAR

analysis의 논리 전개가 불명확하여 D엔진이 구조 판정을 확신할 수 없음.

예:

* 왜 해당 pat인지 설명이 비약적
* 결론만 있고 오류 구조 설명이 없음
* 지문/선지/분석의 연결이 흐림

### E_CONDITION_MISSING

analysis가 선지의 주요 조건 일부를 누락.

예:

* 선지의 전제 조건, 범위, 보기 적용 조건, 비교 조건을 분석하지 않음

### E_DOMAIN_INVALID

도메인 규칙 위반.

예:

* reading에서 L계열 pat
* literature에서 R계열 pat
* ok:true인데 pat 존재
* ok:false인데 허용되지 않는 pat 사용

### E_COMPOSITE_ERROR

analysis가 복합 오류를 말하는데 pat이 단일로 처리됨.

예:

* "과도한 추론 및 내용 왜곡"
* "소재 기능 오독 + 시적 상황 왜곡"

---

## error_type 우선순위

중복 위반이 있을 때 대표 `error_type`는 아래 우선순위로 1개만 리턴한다.

```text
1. E_DOMAIN_INVALID
2. E_COMPOSITE_ERROR
3. P_MISMATCH
4. E_CONDITION_MISSING
5. E_EVIDENCE_WEAK
6. E_LOGIC_UNCLEAR
7. NONE
```

---

## rule_hits 정의

아래 규칙 ID를 사용한다.

```text
RULE_0_DOMAIN_INVALID
RULE_1_PAT_DEFINITION_MISMATCH
RULE_2_EVIDENCE_NOT_DIRECT
RULE_3_CONDITION_MISSING
RULE_4_COMPOSITE_ERROR
RULE_5_OK_TRUE_WITH_PAT
RULE_6_PAT_MISSING_ON_OK_FALSE
RULE_7_ANALYSIS_TOO_VAGUE
```

복수 규칙이 동시에 걸리면 `rule_hits`에 모두 기록하고, 대표 `error_type`는 우선순위에 따라 하나만 선택한다.

---

## D엔진 핵심 판정 규칙

### Rule 0. 도메인 유효성

아래면 즉시 fail.

* `domain=reading`인데 `pat ∈ {L1,L2,L3,L4,L5}`
* `domain=literature`인데 `pat ∈ {R1,R2,R3,R4}`
* `ok=true`인데 `pat != null`
* `ok=false`인데 pat가 null이고 bracket recovery도 없음

출력:

* `error_type = E_DOMAIN_INVALID`

---

### Rule 1. pat 정의 불일치

현재 pat이 analysis가 말하는 실제 오류 구조와 다르면 fail.

예시 기준:

* R1: 사실값/상태/방향 불일치
* R2: 관계·인과 전도
* R3: 지문에 없는 내용 / 비약
* R4: 개념 혼합
* L1: 표현·형식 오독
* L2: 정서·태도 오독
* L3: 주제·의미 과잉
* L4: 구조·맥락 오류
* L5: 보기 적용 오류
* V: 어휘 치환·문맥 의미 오류

출력:

* `error_type = P_MISMATCH`

---

### Rule 2. 근거 직접성 부족

analysis의 근거가 선지 판단에 직접 쓰이지 않으면 fail.

판정 질문:

* analysis의 📌 근거가 선지의 핵심 주장에 직접 연결되는가?
* 왜 맞고/틀린지 판단하는 데 필요한 문장인가?
* 단순 배경 정보나 주변 설명만 제시한 것은 아닌가?

출력:

* `error_type = E_EVIDENCE_WEAK`

---

### Rule 3. 선지 조건 누락

analysis가 선지의 핵심 조건을 빠뜨리면 fail.

판정 질문:

* 선지의 범위/조건/비교/전제/보기 적용 요소를 모두 다뤘는가?
* 복합 선지라면 각 조건을 분해해 검증했는가?

출력:

* `error_type = E_CONDITION_MISSING`

---

### Rule 4. 복합 오류를 단일 pat에 꽂음

analysis가 둘 이상의 오류 구조를 동시에 말하면 fail.

탐지 예:

* "및", "+", "/"
* "A도 틀리고 B도 틀리다" 식 복합 설명
* 사실 왜곡 + 추론 비약 동시 언급

출력:

* `error_type = E_COMPOSITE_ERROR`

---

### Rule 5. analysis가 너무 vague

analysis가 pat 검증에 필요한 구조 설명을 제공하지 못하면 fail.

예:

* "지문과 다르다"만 있고 왜 다른지 없음
* "없다"만 있고 왜 없는지 없음
* 3~4등급 학생도 따라가기 어려울 정도로 압축

출력:

* `error_type = E_LOGIC_UNCLEAR`

---

## D엔진이 하는 것 / 하지 않는 것

### 하는 것

* pat vs analysis 구조 일치성 검증
* 근거 직접성 검증
* 조건 누락 검증
* 복합 오류 검증
* 도메인 규칙 검증

### 하지 않는 것

* 새 pat 생성
* ok 재판정
* cs_ids 재매핑
* 지문 전체의 사실 진위 판단
* 선지 자체 품질 평가
* Layer 0 semantic 대체

---

## confidence 기준

### high

* 규칙 위반이 명확
* rule_hits가 직접적
* reason을 1~2문장으로 명확히 쓸 수 있음

### mid

* 위반은 보이지만 analysis 표현이 다소 애매
* 재생성하면 개선 가능성이 높음

### low

* analysis 자체가 지나치게 모호함
* 규칙 위반이 확정적이지 않음
* 사람 검수 없이는 안전 판정이 어려움

### 중요 규칙

```text
confidence=low 이면 pass=true 금지
```

즉:

* `confidence=low` → 항상 `pass=false`

---

## 재생성 분기 로직

```text
D fail 발생 시:

if confidence in {high, mid}:
  → Step3 재호출 1회

if confidence == low:
  → needs_human 직행

재생성 후에도 D fail:
  → temporary_override 또는 사람 검수
```

---

## GPT-5 프롬프트 완성본

```text
역할: 수능 국어 오답 pat 검증 심판.

너는 pat을 새로 만들지 않는다.
Claude가 제시한 pat이 실제 오류 구조와 맞는지, 틀렸는지만 판정한다.
"맞다"를 증명할 책임은 없고, "틀렸다"를 구조적으로 지적하는 역할만 한다.

중요:
- ok는 참고 메타데이터일 뿐, pat 정당화 근거가 아니다.
- passage + question_text + choice_text + analysis를 기준으로만 fail 여부를 판단하라.
- 애매하면 통과시키지 말고 fail로 보내라.
- confidence=low이면 pass=true를 절대 주지 마라.

입력 JSON:
{input_json}

판정 규칙:
Rule 0. 도메인 유효성 위반 여부
Rule 1. pat 정의와 analysis의 실제 오류 구조 일치 여부
Rule 2. analysis의 근거가 선지 판단에 직접 쓰이는가
Rule 3. 선지의 주요 조건이 analysis에 반영되었는가
Rule 4. 복합 오류가 단일 pat에 꽂혀 있는가
Rule 5. analysis가 너무 vague해서 pat 검증이 불가능한가

pat 정의:
- R1 팩트 왜곡: 수치/상태/방향 불일치
- R2 관계·인과 전도: 주체-객체/원인-결과 반전
- R3 과도한 추론: 지문에 없는 내용/1단계 이상 비약
- R4 개념 짜깁기: 서로 다른 문단 개념 혼합
- L1 표현·형식 오독
- L2 정서·태도 오독
- L3 주제·의미 과잉
- L4 구조·맥락 오류
- L5 보기 대입 오류
- V 어휘 치환·문맥 의미 오류

도메인 제약:
- reading: R1~R4, V만 허용
- literature: L1~L5, V만 허용

출력 JSON 스키마:
{
  "pass": boolean,
  "error_type": "NONE|P_MISMATCH|E_EVIDENCE_WEAK|E_LOGIC_UNCLEAR|E_CONDITION_MISSING|E_DOMAIN_INVALID|E_COMPOSITE_ERROR",
  "rule_hits": ["RULE_ID"],
  "reason": "1-2문장",
  "confidence": "high|mid|low"
}

출력 규칙:
- suggested_pat 출력 금지
- confidence=low 이면 반드시 pass=false
- rule_hits는 실제 매칭된 규칙만 넣어라
- error_type은 우선순위에 따라 대표값 1개만 선택하라
- reason은 fail 시 구조적 근거를 간결하게 써라
```

---

## KPI

```text
D_fail_rate = D fail 건수 / 전체 choice 수
regeneration_success_rate = 재생성 후 D pass / 재생성 시도 수
needs_human_rate = needs_human 분기 건수 / 전체 choice 수
override_rate = temporary_override 건수 / 전체 choice 수
auto_R1_false_positive_rate = 사람 검수 대비 D pass 오류율
confidence_distribution = high / mid / low 비율
```

### 초기 임계값

```text
D_fail_rate > 30% → Step3 prompt 재설계 검토
regeneration_success_rate < 50% → 재생성 로직 점검
needs_human_rate > 20% → D엔진 또는 Step3 품질 재검토
override_rate > 10% → 자동화 범위 과대 의심
auto_R1_false_positive_rate > 5% → 즉시 롤백
confidence=low > 40% → analysis 품질 또는 gold sample 확장 필요
```

---

## 운영 단계

### Stage 1. 오프라인 검증

* 2026 독서 4세트 대상
* Step3 출력 결과를 D엔진에 batch 투입
* D fail 건 사람 audit
* KPI 측정

### Stage 2. 파이프라인 통합

```text
Step3 → precheck → D엔진 → (fail 시 Step3 재호출 1회) → 확정
재생성 후 fail → temporary_override 또는 사람 검수
```

### Stage 3. 확장

* R3, R4
* 문학 L1~L5
* gold sample 점진 확대

---

## Layer 0 precheck 금지 재확인

Layer 0은 아래를 절대 하지 않는다.

* semantic diff_type 확정
* value_conflict → pat 자동 부여
* entity_match / 핵심 개념어 / 표현 블록 / 구조 위치 일치
* "같은 대상인가?" 판단
* suggested pat 생성

Layer 0은 아래만 수행한다.

* domain mismatch 감지
* pat missing 감지
* composite label 감지
* bracket recovery(A-1 only)
* supporting flag 기록
