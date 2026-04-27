# D엔진 의제 1·2·3 최종 결정 및 인수인계

> 결정일: 2026-04-25
> 결정권자: 대표 (직접 재가)
> 출처 채팅: D엔진 분석 채팅 (이번 결정으로 종료)
> 후속 채팅: 데이터 엔지니어 채팅

---

## 1. 최종 결정 요약

### 의제 1 — 비결정성 처리 (확정 v1.0)

```
기본: D엔진 1회 실행

재호출 트리거 (다음 중 하나 이상):
  - rule_hits에 RULE_7 등장
  - error_type 불일치
  - NONE / P_MISMATCH / E_CONDITION_MISSING 혼재

재호출 시: 2회 추가 (총 3회)

판정:
  - 2/3 이상 일치 → majority 채택
  - 3-way 분기 → needs_human
```

### 의제 2 — RULE_7 (조건부 확정 v0.9)

```
RULE_7 카테고리 유지. 단:
  - "메타-고백형" 케이스에서만 유효
  - 그 외 발동은 신뢰하지 않음
  - 격하: "판정 rule"이 아니라 "불안정 신호"로 사용
  - 등장 시 무조건 재호출 트리거 (의제 1 트리거와 통합)
```

### 의제 3 — E_EVIDENCE_WEAK (확정 v1.0)

```
정의: 일반 카테고리가 아니라 제한적 카테고리

정책:
  - Subtype B (5조건 충족) 케이스만 허용
  - Subtype A (배경 설명만 근거) → Gold 작성 금지
  - Subtype C (정의 미수립) → 미정, 사용 안 함

엔진 변경 없음 (Gold 작성 가이드라인 갱신만)
```

---

## 2. 통합 결론 (메타)

```
엔진 문제의 본질:
  카테고리 정의 문제가 아니라
  → 경계 케이스 처리 실패

전략 방향:
  카테고리를 넓히지 말고, 좁히기
  완벽한 분류 만들지 말고, 망가지지 않는 구조 고정
```

---

## 3. 결정 근거 (요약)

| 의제 | 핵심 데이터 | 결정 근거 |
|---|---|---|
| 1 | 4 samples × 5 runs = 20회. R1_001/R2_004/R1_004 deterministic, R1_006 random | Hybrid가 비용 1.4x로 균형 최적. confidence 트리거는 R1_006에서 무효 확인 |
| 2 | RULE_7 발동 ~3회 / 미발동 ~24회 (총 27회 표본, 11% 발동률) | 표본 부족해도 메타-고백형 패턴은 R1_006 Run 2/5에서 확인. 격하 운영이 정당 |
| 3 | E_EVIDENCE_WEAK 표본 4건 (R1_003 실패 / R2_008 성공 / R2_009 부분 실패) | 구조적 차이 (A 실패, B 부분 성공). "표본 부족"이 아닌 "구조 성질" 문제로 결정 |

### 결정 근거 캐비어트

- Q1 (Subtype A/B 실제 분포): **모름**. Step3 출력 측정 데이터 없음. 정책 영향도 미확인
- Q2 (E_EVIDENCE_WEAK 중요도): 중간 (학습 UX에 의미 있음, 시스템 코어는 아님)
- Q3 (human 개입 허용): 10~20% (레드팀 권고 채택)

---

## 4. 구현 백로그 (데이터 엔지니어)

### 4.1 D엔진 실행 wrapper 수정

```
파일: 신규 또는 기존 D엔진 호출 모듈
작업:
  1. D엔진 1회 호출 → 응답 받음
  2. 재호출 트리거 체크:
     - rule_hits에 RULE_7 포함?
     - (단독 호출 시 trigger 2·3 검사 불가, 단계적 적용)
  3. 트리거 시 D엔진 2회 추가 호출 (각각 새 GPT-5 컨텍스트)
  4. 3개 응답의 majority 판정 함수 적용
  5. majority 미성립 (1/1/1 또는 모두 다름) → needs_human 큐 라우팅
```

### 4.2 majority 판정 함수

```
입력: 3개 D엔진 응답 (pass, error_type, rule_hits, confidence)
출력: 채택값 또는 needs_human 신호

로직:
  - error_type 기준 최빈값 검사
  - 3/3 일치 → 채택
  - 2/3 일치 → 채택 (저신뢰 플래그)
  - 1/1/1 또는 0개 일치 → needs_human
```

### 4.3 needs_human 큐 인터페이스

```
파일: 신규 모듈
작업:
  - majority fail 케이스 → 별도 큐 적재
  - 큐 항목: 입력 데이터, 3개 응답, 시점
  - 운영자 검수 인터페이스 미정 (별도 설계 필요)
```

### 4.4 Gold 작성 가이드 업데이트

```
파일: config/gold_authoring_rules.md (이미 존재)
추가 조항:
  - Subtype A (배경 설명만 근거) 의도 샘플 작성 금지
  - E_EVIDENCE_WEAK는 Subtype B 5조건 충족 케이스만 허용
  - Subtype C는 정의 미수립 영역, 신규 샘플 작성 보류
```

### 4.5 로깅 항목 추가

D엔진 호출별로 다음 지표 기록:

```
1. RULE_7 발생률 (rule_hits에 RULE_7 포함된 호출 / 전체 호출)
2. 재호출 발생률 (트리거 발동된 호출 / 전체 호출)
3. needs_human 분기율 (needs_human / 전체 호출)
4. E_EVIDENCE_WEAK 발동률
5. E_EVIDENCE_WEAK ↔ E_CONDITION_MISSING 분기율 (같은 입력 재호출 시 두 값 사이 변동)
6. T1 트리거 후 majority가 1회 결과와 다른 비율 (T1 trigger value 측정)
```

---

## 5. Stage 2 검증 항목

Pilot 운영 시 모니터링하고 정기 보고:

```
1. RULE_7 발생률 (%)
2. E_EVIDENCE_WEAK 실제 분포 (Subtype B 5조건 충족률)
3. needs_human 비율 (목표: 10~20%)
4. 재호출 비율 (목표: <30%)
5. Step3 출력의 Subtype A/B 분포 (Q1 미답변 보완 측정)
```

---

## 6. 유효 범위 (재검토 트리거)

본 결정은 다음 조건 중 하나 발생 시 재검토:

```
1. needs_human > 25%  → 의제 1 v1.0 재설계
2. RULE_7 발생률 > 15%  → 의제 2 격하 정책 재검토
3. E_EVIDENCE_WEAK 거의 미발생 (<2%)  → 의제 3 카테고리 폐기 검토
4. Step3 출력의 Subtype A 비율 > 20%  → 의제 3 정책 영향 재평가
```

추가 재검토 트리거 (분석 채팅 미해결 사항):

```
5. Decision 1·2·3 통합 메타 분석 시점 (Stage 2 pilot 데이터 누적 후)
6. 의제 4 (R4 → R2 흡수 현상) 재논의 — R1_008 추가 측정 후
```

---

## 7. 본 D엔진 채팅 활용 종료

```
종료 선언: 2026-04-25
이관 대상: 데이터 엔지니어 채팅
이관 항목: 본 문서 (구현 백로그 + Stage 2 검증 + 유효 범위)

재오픈 조건:
  - Stage 2 pilot 결과 분석 시
  - 재검토 트리거 (§6) 발동 시
  - 의제 4 (R4 → R2 흡수) 처리 시
```

---

## 8. 처리 안 한 사항 (의도적 보류)

```
- 의제 4 (R4 → R2 흡수): 별도 세션 처리. R1_008 추가 측정 선결.
- Step3 출력 Subtype A/B 분포 측정: 운영 데이터 누적 후 측정.
- E_EVIDENCE_WEAK 5조건 N조건 확장: R2_009 수정본 추가 측정 후.
- Subtype C 정의: 운영 데이터에서 패턴 발견 후.
- 의제 1·2·3 통합 메타 분석: Stage 2 pilot 후 별도 세션.
```

---

## 9. 한 줄 요약

```
지금은 완벽한 분류를 만드는 단계가 아니라
"망가지지 않는 구조를 고정하는 단계"다.
```

---

## 10. Phase 1 Gold 최종 상태 (누락 보완)

### Gold 18개 확정 (2026-04-25)

본 인수인계 문서 §1·2·3 결정과 별도로, Phase 1 Gold 샘플은 **18개로 종결** (17개 아님).

| 분포 | 개수 | 비고 |
|---|---|---|
| NONE | 6/6 | 완료 |
| P_MISMATCH | 5/5 | 완료 |
| E_CONDITION_MISSING | 2/2 | 완료 |
| E_DOMAIN_INVALID | 1/1 | 완료 |
| E_EVIDENCE_WEAK | 1/2 | R2_009 영구 폐기, 1/2로 마감 |
| E_LOGIC_UNCLEAR | 1/2 | R1_010 영구 폐기, 1/2로 마감 |
| **E_COMPOSITE_ERROR** | **2/2** | **R2_010 추가 (3/3 E_COMPOSITE_ERROR 검증 완료)** |
| **합계** | **18/20** | **완료율 90%** |

### R2_010 정보

```json
{
  "sample_id": "gold_R2_010",
  "input": {
    "passage": "늑대가 초원에서 사라지자 사슴 개체수가 증가했다. 사슴의 증가로 초원의 풀이 급격히 줄어 들판이 황폐해졌다.",
    "question_text": "윗글에 대한 이해로 가장 적절하지 않은 것은?",
    "choice_text": "초원의 풀이 줄어든 것이 사슴 개체수를 증가시켰으며, 늑대가 초원에서 사라졌음에도 사슴 개체수는 증가하지 않았다.",
    "analysis": "📌 지문 근거: \"늑대가 초원에서 사라지자 사슴 개체수가 증가했다. 사슴의 증가로 초원의 풀이 급격히 줄어 들판이 황폐해졌다.\" 🔍 선지는 사슴과 풀의 인과 관계를 뒤집었을 뿐 아니라, 늑대가 초원에서 사라지자 사슴 개체수가 증가했다는 지문 진술과 정면으로 충돌한다. ❌ 지문과 어긋나는 부적절한 진술",
    "pat": "R2",
    "ok": false,
    "questionType": "negative",
    "bogi": null,
    "domain": "reading",
    "precheck_signals": {
      "domain_mismatch_detected": false,
      "pat_missing_detected": false,
      "composite_label_detected": false,
      "bracket_recovery_applied": false
    }
  },
  "expected_output": {
    "pass": false,
    "error_type": "E_COMPOSITE_ERROR",
    "rule_hits": ["RULE_4_COMPOSITE_ERROR"],
    "confidence": "high"
  },
  "verification": {
    "method": "GPT-5 3회 독립 실행",
    "result": "3/3 E_COMPOSITE_ERROR",
    "verified_date": "2026-04-25"
  },
  "rationale": "선지가 (1) 사슴과 풀의 인과 관계 뒤집기 + (2) 늑대 사라짐과 사슴 개체수 증가의 정면 충돌, 두 독립된 오류를 병렬로 포함. analysis가 두 오류를 모두 명시했으나 pat이 단일 R2로 처리됨.",
  "test_intent": "두 개의 독립된 사실/관계 왜곡이 명시적으로 병렬 지적되었으나 단일 pat으로 처리된 E_COMPOSITE_ERROR 케이스 (R2_006과 다른 패턴 — 인과 전도 + 사실 충돌)"
}
```

### 데이터 엔지니어 작업 시 반영 사항

1. `config/d_engine_gold_samples_phase1.json` — gold_R2_010 추가
2. `config/d_engine_dryrun_inputs.json` — R2_010 input 추가
3. `config/dryrun_results_test.json` — R2_010 3회 결과 기록
4. `meta.current_count`: 14 → 18
5. `meta.error_type_distribution.E_COMPOSITE_ERROR`: 2 (R2_002, R2_006이 1개로 잘못 기록되어 있다면 R2_010 포함하여 2개로 수정)

⚠️ Phase 1 잔여 미작성 슬롯 2개 (gold_R1_007 NONE, gold_R2_007 NONE) 처리 방침은 다음 중 1택 — 데이터 엔지니어 채팅에서 결정:
- (a) 18개로 Phase 1 종결, 잔여 2개 폐기
- (b) NONE 분포 보강을 위해 2개 추가 작성 (대표가 원작성자였음, 본 채팅 또는 다른 세션에서 처리)

권고: (a) 채택. NONE은 이미 6개 확보, 추가 보강 가치 낮음. 90% 완료율로 Phase 1 종결 후 Stage 2 진입.