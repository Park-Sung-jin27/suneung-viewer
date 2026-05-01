# Gold Sample Authoring Rules (Phase 1)

D엔진 Gold 샘플 작성 시 반드시 준수해야 할 규칙.  
정본 `d_engine_input_schema.md`의 보조 문서로서 샘플 품질 기준을 명문화함.

---

## Rule 1. 근거 인용 규칙 (Quote Integrity)

### 정식 규칙

```
📌 근거 text는 passage 안에 실제로 존재하는
연속 원문 문자열(contiguous substring exact match)이어야 한다.

- paraphrase 금지
- 말줄임표("...") 금지
- 요약 인용 금지
- 문장 전체 일치까지는 요구하지 않음
```

### 허용되는 인용 형태

**예 1: 전체 문장 인용**
```
passage: "송신기에서는 기호를 부호로 변환한다. 전송된 부호를 수신기에서 원래의 기호로 복원한다."
📌 근거: "송신기에서는 기호를 부호로 변환한다. 전송된 부호를 수신기에서 원래의 기호로 복원한다."
→ OK (문장 전체)
```

**예 2: 문장 일부 (절) 인용**
```
passage: "츠비키는 은하들의 속력으로부터 추정한 은하단의 질량이 은하들의 밝기로부터 추정한 은하단의 질량보다 훨씬 크다는 것을 확인하고..."
📌 근거: "은하들의 속력으로부터 추정한 은하단의 질량이 은하들의 밝기로부터 추정한 은하단의 질량보다 훨씬 크다"
→ OK (passage 내 연속 부분 문자열, 마침표 없음)
```

### 금지되는 인용 형태

**금지 1: paraphrase**
```
passage: "플랫폼 기업은 참여자 수가 늘수록 서비스의 가치가 높아지는 네트워크 효과를 가진다."
📌 근거 (X): "플랫폼은 사용자가 많을수록 가치가 상승한다."
→ NG (의미 동일해도 문자열 다름)
```

**금지 2: 말줄임표**
```
📌 근거 (X): "공인 중개사와 고객이 체결한 매매 계약의 경우... 계약 자체는 유효이다."
→ NG ("..."로 중간 생략)
```

**금지 3: 단어 축약**
```
passage: "은하들의 속력으로부터..."
📌 근거 (X): "속력으로부터..."
→ NG ("은하들의" 탈락)
```

**금지 4: passage 외부 문장**
```
passage: "A는 B이다."
📌 근거 (X): "A는 C이다."
→ NG (passage에 존재하지 않음)
```

---

## Rule 2. 오염 금지 (Anti-Contamination)

### 2-1. Input 오염 금지

**input.analysis / input 전 필드**에 다음 포함 금지:

- 정답 힌트 ("따라서 오답 패턴이 적용될 수 없다" 등)
- error_type 암시 ("이는 E_LOGIC_UNCLEAR이다" 등)
- rule_hits 암시 ("Rule 0 위반" 등)
- Step3 Claude 한글 라벨 (`[사실 왜곡]` 등)

### 2-2. Expected Output 오염 금지

**expected_output.reason**은 **현상 설명**만 기술:

- 허용: "선지는 지문과 일치하는 내용인데 pat이 설정되어 있다. 이 조합은 허용되지 않는다."
- 금지: "ok:true이므로 pat이 존재할 수 없다. 형식 규칙을 위반한다." (if-then 공식)
- 금지: "analysis도 '적절한 진술'로 인정하고 있음에도..." (input 해석)

### 2-3. Rationale / Test_intent 오염 금지

D엔진 행동 유도 표현 금지:

- 금지: "D엔진이 ~하는지 검증"
- 금지: "D엔진이 ~감지해야 한다"
- 금지: "precheck 힌트 없이 ~"
- 허용: "~케이스" / "~상황"

---

## Rule 3. Error Type 단일성

**Gold는 error_type 하나가 명확히 고정되어야 함.**

- 두 종류 error_type이 동시에 해석될 여지가 있으면 Gold 부적합
- 혼재 의심 시 재설계
- 경계/borderline 케이스는 Phase 2 stress test 데이터셋으로 분리

### Confidence 원칙

- Phase 1 Gold = 전원 `confidence: high`
- `confidence: low`는 Phase 2 stress test 전용
- `error_type`이 명확하면 `confidence: high`, 둘이 모순되면 Gold 부적합

---

## Rule 4. precheck_signals 정책

Gold 샘플의 `precheck_signals`는 **전부 false**.

- D엔진이 힌트 없이 semantic만으로 판정하는지 검증
- 실제 파이프라인에서는 Layer 0이 기록하지만, Gold 검증 단계에서는 의도적 무력화

---

## Rule 5. Source 필드

PDF 기반 샘플:
```json
"source": {
  "file": "3.pdf",
  "page": 1,
  "question": 25,
  "choice": 5
}
```

직접 작성 샘플 (초기 5개):
```json
"source": {
  "file": null,
  "page": null,
  "question": null,
  "choice": null,
  "validated": false,
  "note": "사용자 작성 샘플, PDF 검증 대기"
}
```

---

## Rule 6. R1/R2 판정 엄격 기준

### R1 (팩트 왜곡)
- 단일 사실값/상태/방향의 왜곡 (수치·대소·유무·증감)
- 두 실체 간 역할 교환 없음

### R2 (관계·인과 전도)
- 지문에 **"~때문에" / "~해서" / "~로 인해"** 같은 명시적 인과 접속어
- 지문 구조: A → B (A가 원인, B가 결과)
- 선지 구조: B → A (원인-결과 역할 상호 교환)

**R2가 아닌 것**:
- 함수 관계 / 대응 관계의 역추론 (R1 또는 R3)
- 정의 자체의 왜곡 (R1)
- 조건 서술 순서 변경 (의미 동일 시 pass)

---

## Rule 7. Analysis 포맷

```
📌 지문 근거: "passage 내 연속 부분 문자열"
🔍 판단 로직 (2-3문장)
✅ 지문과 일치하는 적절한 진술이다.
또는
❌ 지문과 어긋나는 부적절한 진술
```

**금지**:
- 한글 라벨 `[사실 왜곡]` 등
- 메타 설명 "따라서 pat이 ~"
- 과도한 설명 (장황함)

---

## 변경 이력

- 2026-04-22: Rule 1 "문자 그대로 일치" → "contiguous substring exact match"로 정확화
- 2026-04-22: 전 규칙 초안 작성 (Phase 1 14개 샘플 정제 경험 반영)
