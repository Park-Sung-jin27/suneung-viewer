# D엔진 의제 결정 (영구)

> 본 문서는 D엔진 의제 1·2·3 의 **최종 결정** 영구 보존.
> HANDOVER_D_ENGINE_DECISIONS_v1.md (2026-04-25) 정수 추출.
> 회기 specific 진척 상황은 본 문서 외 — `current_state.md` 참조.

---

## 의제 1 — 비결정성 처리 (확정 v1.0)

### 결정

```
기본: D엔진 1회 실행

재호출 트리거 (다음 중 하나 이상):
  - rule_hits 에 RULE_7 등장
  - error_type 불일치
  - NONE / P_MISMATCH / E_CONDITION_MISSING 혼재

재호출 시: 2회 추가 (총 3회)

판정:
  - 2/3 이상 일치 → majority 채택
  - 3-way 분기 → needs_human
```

### 근거

- 4 samples × 5 runs = 20회 측정
- R1_001 / R2_004 / R1_004 deterministic
- R1_006 random (NONE 2 / P_MISMATCH 2 / E_CONDITION_MISSING 1)
- Hybrid 가 비용 1.4x 로 균형 최적
- confidence 트리거는 R1_006 에서 무효 확인 (전부 high 인데 분기 발생)

### 재검토 트리거

- needs_human > 25% → 재설계
- 재호출 비율 > 30% → 트리거 룰 정정

---

## 의제 2 — RULE_7 (조건부 확정 v0.9)

### 결정

```
RULE_7 카테고리 유지. 단:
  - "메타-고백형" 케이스에서만 유효
  - 그 외 발동은 신뢰하지 않음
  - 격하: "판정 rule" 이 아니라 "불안정 신호"
  - 등장 시 무조건 재호출 트리거 (의제 1 트리거 통합)
```

### 근거

- RULE_7 발동 ~3회 / 미발동 ~24회 (총 27회 표본, 11% 발동률)
- R1_001: 정상 analysis 인데 RULE_7 오발동
- R1_006: "설명하지 않는다" 메타-고백 명시인데 RULE_7 미발동
- → 양방향 실패. 단일 방향 강화로 해결 불가

### 재검토 트리거

- RULE_7 발생률 > 15% → 격하 정책 재검토 (재정의 또는 분할)

---

## 의제 3 — E_EVIDENCE_WEAK (확정 v1.0)

### 결정

```
정의: 일반 카테고리 X. 제한적 카테고리.

정책:
  - Subtype B (5조건 충족) 케이스만 허용
  - Subtype A (배경 설명만 근거) → Gold 작성 금지
  - Subtype C (정의 미수립) → 미정, 사용 안 함

엔진 변경 없음 (Gold 작성 가이드라인 갱신만)
```

### Subtype B 5조건

1. 선지가 단일 주장 (복합 조건 아님)
2. analysis 가 선지 핵심 판단 축을 명시
3. 근거가 그 판단을 직접 검증하지 않음
4. 회피 표현 없음 ("단정하기 어렵다" 등)
5. "A 라고 했지만 근거는 B" 구조

### 재검토 트리거

- E_EVIDENCE_WEAK 거의 미발생 (<2%) → 카테고리 폐기 검토
- Step3 출력의 Subtype A 비율 > 20% → 정책 영향 재평가

---

## 통합 결론 (메타)

```
엔진 문제의 본질:
  카테고리 정의 문제 X
  → 경계 케이스 처리 실패

전략 방향:
  카테고리를 넓히지 말고, 좁히기
  완벽한 분류 만들지 말고, 망가지지 않는 구조 고정
```

**한 줄 요약**: 지금은 완벽한 분류를 만드는 단계가 아니라 "망가지지 않는 구조를 고정하는 단계".

---

## Gold 17 확정 분포 (Phase 1 종결, v2)

### 17개 active samples

| error_type | 개수 | sample_id |
|---|---|---|
| NONE | 6 | R1_001, R2_001, R1_004, R2_003, R2_005, R2_006 |
| P_MISMATCH | 4 | R1_002, R1_005, R2_004, DOMAIN_002 |
| E_CONDITION_MISSING | 2 | R1_003, R1_009 |
| E_COMPOSITE_ERROR | 2 | R2_002, R2_010 |
| E_LOGIC_UNCLEAR | 1 | R1_006 |
| E_EVIDENCE_WEAK | 1 | R2_008 |
| E_DOMAIN_INVALID | 1 | DOMAIN_001 |
| **합계** | **17** | |

### Discarded 2건 (β 전환, 추적 보존)

| sample_id | planned | reason |
|---|---|---|
| gold_R1_010 | E_LOGIC_UNCLEAR | 3/3 NONE 판정. 엔진 RULE_7 미감지 확정 |
| gold_R1_008 | P_MISMATCH (R4→R2 흡수 의도) | P_MISMATCH 분포 4건 충분으로 폐기. 의제 4 분석 시 참조 |

### Pending 2건 (5/15 후 보강 또는 폐기)

| sample_id | planned |
|---|---|
| gold_R1_007 | NONE |
| gold_R2_007 | NONE |

---

## 아키텍처 (영구 정합)

```
Step3 Claude (analysis + pat 생성)
  ↓
Layer 0 deterministic precheck (semantic 금지)
  ↓
GPT-5 D엔진 (독립 반증 엔진, fail 만 판정)
  ↓
D fail 시 Step3 재호출 1회
  ↓
실패 시 temporary_override 또는 needs_human
```

**핵심 원칙**: "apply 는 바보처럼, D엔진은 집요하게"

---

## Stage 2 진입 선결 조건 (lock)

다음 모두 충족 시 Stage 2 진입 가능:

- [x] Gold 14개 이상, FULL_MATCH + acceptable ≥ 85%
- [x] 확정 고정 오류 0
- [x] R2_010 검증 완료 → 17개 확정
- [ ] 전체 Gold 기준 dry-run 재실행 + compare 85% 이상
- [x] **비결정성 처리 전략 결정** → 의제 1 v1.0 (Hybrid majority + needs_human)
- [x] **RULE_7 재정의 또는 제거 결정** → 의제 2 v0.9 (격하 운영)
- [x] **E_EVIDENCE_WEAK Subtype B 제한 정책** → 의제 3 v1.0 (Subtype B 만)

---

## 의제 4 (보류, 별도 세션)

**R4 → R2 흡수 현상**

- R1_008 3/3 R2 해석 (작성 의도 R4)
- 엔진이 같은 문단 내 두 개념의 기능 대응 역전을 R2 로 분류
- 처리 시점: R1_008 추가 측정 후
- Stage 2 영향: R4 카테고리 실전 사용 가능성 재평가

---

## 변경 이력

- v1.0 (2026-04-25): 의제 1·2·3 최종 결정 (대표 직접 재가)
- v2 (2026-04-27): Phase 1 Gold 정합성 복구 (17개 확정)
