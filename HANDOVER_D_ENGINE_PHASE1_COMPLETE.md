# HANDOVER — D엔진 Phase 1 (종료 확정)

## Phase 1 종료 선언

**날짜**: 2026-04-23
**상태**: Phase 1 종료. Step 4 (나머지 6개 Gold 작성) 진입 가능.
**중요**: "종료"는 **설계 완료**를 의미하며, **엔진 안정성 완전 확보**를 의미하지 않음. 아래 "엔진 불안정 사례" 및 "Stage 2 선결 조건" 섹션 반드시 확인.

---

## 최종 결과

### Gold 14개 compare 결과 (최신)

| 지표 | 값 |
|---|---|
| FULL_MATCH | 10 |
| acceptable (rule_hits divergence) | 2 |
| 확정 고정 오류 | 0 |
| **엔진 불안정 사례 (비결정성)** | **1 (R1_001)** |
| 경계 케이스 | 1 (R1_006) |

**⚠️ 중요**: "확정 고정 오류 0"은 **엔진이 안정적**이라는 뜻이 아님. R1_001은 동일 입력에 다른 출력을 내는 **비결정성 사례**로, Stage 2에서 독립 처리 필요.

**정상률**: 12/14 = 86% (단, R1_001은 실행마다 결과 변동 가능)

### 확정된 엔진 특성 (Stage 2 진입 전 상태)

| 영역 | 상태 | 근거 |
|---|---|---|
| R2 인식 | ✅ 정상 | R2_001, R2_003, R2_005, R2_006 전부 FULL_MATCH |
| 도메인 규칙 (RULE_0) | ✅ 정상 | DOMAIN_001 FULL_MATCH |
| ok-pat 모순 감지 (RULE_5) | ✅ 정상 | DOMAIN_002 FULL_MATCH |
| error_type 우선순위 | ✅ 정상 | 우선순위 보정 규칙 효과 확인 |
| COMPOSITE 감지 (RULE_4) | ✅ 정상 (rule_hits 1개 생략 경향) | R2_002 acceptable |
| **RULE_7 (analysis vague)** | 🔴 **양방향 실패** | **오발동(R1_001) + 미발동(R1_006)** |
| **엔진 determinism** | 🔴 **불안정** | **R1_001 동일 입력 다른 출력** |

---

## 🔴 핵심 리스크 — Stage 2 진입 전 반드시 해결

### 리스크 1. RULE_7 양방향 실패

**증상**:
- **오발동**: R1_001 analysis는 명확히 "지문 A → 선지 not-A" 지적하는데 엔진이 RULE_7(vague) 트리거
- **미발동**: R1_006 analysis에 "설명하지 않는다" 메타-고백 명시됐는데 엔진이 RULE_7 미발동

**의미**: RULE_7은 정방향/역방향 양쪽 다 실패. 이건 "규칙 정의가 특정 방향으로 편향됐다"가 아니라 **RULE_7 판정 기준 자체가 엔진에 불안정하게 전달됨**.

**Stage 2 영향 가능성**:
- 정상 analysis가 RULE_7으로 잘못 걸려 E_LOGIC_UNCLEAR로 분류 (오탐)
- 진짜 vague analysis가 통과 (미탐)
- 양쪽 다 파이프라인 신뢰도 저하

**Stage 2 대응**: 실전 데이터에서 RULE_7 트리거 빈도와 정확도 모니터링 → 일정 임계 초과 시 RULE_7 재정의 또는 분할(예: RULE_7a 오발동 방어, RULE_7b 메타-고백 감지).

### 리스크 2. 엔진 비결정성 (R1_001)

**증상**: 동일 입력에 다른 출력
- 1차: `pass: false, P_MISMATCH + RULE_1, RULE_7`
- 2차: `pass: true, NONE`

**의미**: GPT-5가 같은 샘플에 대해 재실행마다 다른 판정 낼 수 있음. 이건 샘플/프롬프트 문제가 아니라 **모델 자체의 특성**.

**Stage 2 영향**:
- Step3 출력이 D엔진에서 1차 fail, 재생성 후 2차 pass 받는 형태로 **진짜 오류가 우연히 통과**하는 케이스 발생 가능
- 또는 정상 출력이 **우연히 fail 받아 불필요한 재생성 루프** 발생

**Stage 2 대응 (Stage 2 진입 전 결정 필수)**:
- **majority voting**: 동일 샘플 3회 실행 후 2회 이상 일치한 결과 채택
- **needs_human 분기**: 3회 불일치 시 사람 검수
- **temperature=0 강제**: GPT-5 응답 결정성 강화 (단 모델 특성 왜곡 가능)
- **"pass 우선 채택" 금지**: expected가 fail인 샘플에서 정상 fail 판정을 pass로 오도할 리스크

**결정**: Stage 2 착수 전에 위 4가지 중 하나를 채택 또는 조합 설계 필요.

---

## 이번 세션 유효 수정 (Stage 2 유지)

### 프롬프트 수정 (d_engine_prompt.txt)

error_type 우선순위 섹션에 1블록 추가:
```
error_type 선택 시 우선순위 보정 규칙:
- RULE_0 또는 RULE_5 또는 RULE_6이 hit된 경우,
  error_type은 E_DOMAIN_INVALID 또는 P_MISMATCH 중 하나로 선택한다.
```

**효과**: DOMAIN_001, DOMAIN_002 FULL_MATCH 달성.

**의심**: 이 수정이 R1_001 OVERFAIL과 상관 있을 가능성 있음 (턴 간 다른 재실행에서 발생 패턴 변화). 단 R1_001 단독 재확인에서 NONE 판정 → 비결정성으로 재분류. 프롬프트 수정 광역 영향 가설은 약화됐으나 배제 안 됨.

### Gold 샘플 수정 4건

| 샘플 | 수정 |
|---|---|
| gold_R1_003 | expected → E_CONDITION_MISSING + RULE_2, RULE_3 |
| gold_R2_005 | 전체 교체 (비/도로/제동, NONE 전환) |
| gold_R2_006 | 전체 교체 (포식자/피식자, NONE 전환) |
| gold_DOMAIN_002 | expected → P_MISMATCH + RULE_1, RULE_5 |

---

## Step 4 — 나머지 6개 Gold 작성

### 작성 우선순위

| sample_id | target_failure_mode | 우선순위 | 비고 |
|---|---|---|---|
| **gold_R1_009** | E_CONDITION_MISSING | **🔴 최우선** | 현재 R1_003 1건만 커버 중. 분포 보강 필요 |
| gold_R2_008 | E_EVIDENCE_WEAK | 🟡 중요 | 현재 커버 0. 정식 fail 필요 |
| gold_R1_010 | E_LOGIC_UNCLEAR | 🟡 중요 | R1_006 경계 상태 → 보강 필요 + **RULE_7 리스크 검증 케이스** |
| gold_R1_008 | P_MISMATCH | 🟢 보통 | 현재 3건 커버 중. 경계 케이스 추가 |
| gold_R1_007 | NONE | 🟢 보통 | 분포 유지 |
| gold_R2_007 | NONE | 🟢 보통 | 분포 유지 |

### 특별 권고 — gold_R1_010 설계 시

R1_006은 RULE_7 미발동 경계 상태. **R1_010을 동일 메타-고백 구조로 만들면 두 샘플 모두 실패**할 가능성. **다른 유형의 E_LOGIC_UNCLEAR**로 설계 권장:
- R1_006 유형: "설명하지 않는다" 메타-고백
- R1_010 권장 유형: 근거는 있으나 **논리 전개가 비약** (메타-고백 없음)

이 분리가 RULE_7 양방향 실패 리스크 진단에 도움.

### 작성 체크리스트 (엄수)

1. 📌 근거는 passage 내 연속 원문 문자열 (contiguous substring exact match)
2. expected error_type 외 다른 해석 가능성이 강하지 않은가
3. ok/pat/domain 조합이 형식 규칙과 충돌하지 않는가
4. analysis가 선지 조건을 전부 다루는가, 일부만 다루는가
5. rationale/test_intent에 D엔진 행동 유도 금지 (**"D엔진"/"감지하는지"/"포착하는지" 표현 금지**)
6. precheck_signals 전부 false
7. `node validate_gold_phase1.mjs`로 자동 검증 통과

### 작성 후 절차

1. Gold 20개 완성
2. validate 통과
3. dry-run 재실행 (20개)
4. compare 분석
5. FULL_MATCH 비율 확인 → Phase 1 완전 종료
6. **Stage 2 선결 조건 처리** (아래 참조)

---

## Stage 2 진입 선결 조건

- [x] Gold 14개 중 FULL_MATCH + acceptable ≥ 85% → **86% 달성**
- [x] 확정 고정 오류 0 → **달성** (R1_001 비결정성으로 재분류)
- [ ] Gold 20개 완성 (Step 4 완료)
- [ ] Gold 20개 기준 dry-run FULL_MATCH + acceptable ≥ 85% 재확인
- [ ] **비결정성 처리 전략 결정** (majority voting / needs_human / 기타)
- [ ] **RULE_7 양방향 실패 모니터링 계획 수립** (임계값 + 재정의 조건)

**중요**: Stage 2 진입은 **6개 선결 조건 전부** 충족 시. 86% 달성만으로는 충분하지 않음. 비결정성 처리 전략 없이 Stage 2 진입 시 파이프라인 디버깅 불가능 상태 가능.

---

## 세션 핵심 교훈 (다음 세션에 유지)

### 1. 파일 버전 관리 최우선
- 모든 수정 후 파일 타임스탬프 확인
- compare 실행 시 정확한 파일명 지정
- 옛 결과 파일은 리네임으로 격리 (예: `_v1_original.json`)

### 2. compare 스크립트 owner 라벨은 힌트지 진단 아님
- OVERFAIL → owner=engine은 자동 분류. 실제 원인은 별도 판정
- reason 필드 반드시 함께 확인

### 3. 샘플/엔진 수정 시 원인 분리 엄수
- "동시 수정"은 효과 구분 불가
- 재실행 1회당 수정 1종류
- 단 `expected_output`만 수정하는 경우 GPT-5 재실행 불필요 (compare만 재실행)

### 4. Gold 분포 축 보존
- 개별 샘플 완벽 설계 ≠ Gold 전체 품질
- 특정 error_type을 특정 pat에 억지로 할당하지 말 것 (예: R2 + E_CONDITION_MISSING 조합은 설계 영역 좁음)

### 5. 프롬프트 수정은 광역 영향 리스크
- 1줄 추가가 엔진 전체 행동 바꿀 수 있음
- 매핑 강제 표현 ("반드시") 회피
- 기존 용어 체계 외부 개념 도입 금지

### 6. 판정 피로 관리
- "거의 끝났으니 빨리"가 최대 리스크
- 원인 미확정 상태에서 확정 판정 금지
- 필요시 세션 분할 (하루 텀)

### 7. "고정 오류 0 ≠ 엔진 안정"
- 비결정성은 고정 오류가 아니지만 **문제가 없는 것도 아님**
- 문서화 시 두 범주 분리 기록 필수

### 8. RULE 양방향 실패는 단일 방향 강화로 해결 불가
- RULE_7 강화 → R1_006 잡지만 R1_001 오발동 더 증폭
- RULE_7 약화 → R1_001 보호하지만 R1_006 영영 놓침
- 근본 해법: RULE 정의 자체의 재설계 (단 Phase 1 스코프 외)

---

## 파일 상태 (config/)

| 파일 | 버전 | 상태 |
|---|---|---|
| d_engine_prompt.txt | 우선순위 보정 규칙 추가 | ✅ 최신 |
| d_engine_gold_samples_phase1.json | R1_003, R2_005, R2_006, DOMAIN_002 수정 | ✅ 최신 |
| d_engine_dryrun_inputs.json | R2_005, R2_006 input 교체 | ✅ 최신 |
| dryrun_results_test.json | 14개 GPT-5 응답 | ✅ 최신 |
| validate_gold_phase1.mjs | - | ✅ 변경 없음 |
| compare_dryrun_results.mjs | - | ✅ 변경 없음 |

**혼선 방지**: `dryrun_results_filled.json` (13:49, 1차 재실행 옛 결과)은 리네임 또는 삭제 권장.

---

## 결론

**Phase 1 설계 종료.** Gold 14개 중 12개(86%) 안정권. Step 4 진행 후 Stage 2 진입 가능하되, **RULE_7 양방향 실패 + 엔진 비결정성**은 Stage 2 선결 조건으로 별도 처리 필요.

"Phase 1 종료 = 엔진 안정 확보"가 **아니다**. Phase 1은 **Gold 설계와 기본 판정 축의 검증**까지. 엔진 안정성의 나머지 층(determinism, RULE_7 정밀도)은 Stage 2 실전 데이터에서 추가 검증.


---

## Phase 1 Stage A 종료 (2026-04-24 저녁)

### 확정 상태
- Gold samples: 17개
- pending: 3개 (R1_007, R1_008, R2_007)
- discarded: 1개 (R1_010)
- validate: pass (issues 0)

### 4/24 세션 처리 내역
- R1_009, R2_008 반영 (samples 14 → 16)
- R2_010 신규 작성 및 3/3 E_COMPOSITE_ERROR 검증 완료 후 추가 (samples 16 → 17)
- R1_010 3/3 NONE 판정 → discarded 처리
- R1_008 3/3 R2 해석 확인, 원본 엔트리 텍스트 복구 필요 → pending 유지

### Phase 1 Stage A vs Phase 1 Complete
Stage A = 오늘 종료. Phase 1 Complete는 R1_008 원본 복구 + R1_007 / R2_007 신규 작성 후 가능.

### 남은 Phase 1 Complete 조건
- [ ] R1_008 원본 엔트리 텍스트 복원 (4/24 채팅 로그 추적 또는 재작성 + 재검증)
- [ ] R1_007 신규 작성 (pass / NONE)
- [ ] R2_007 신규 작성 (pass / NONE)
- [ ] 전체 20개 기준 dry-run 재실행 + compare 85% 이상

### Stage 2 진입 선결 조건 (별도)
- [ ] GPT-5 비결정성 처리 전략 결정 (majority voting / needs_human)
- [ ] RULE_7 재정의 또는 제거 결정 (R1_006 미발동 + R1_001 오발동 + R1_010 3/3 NONE 근거)
- [ ] E_EVIDENCE_WEAK 협소 작동 조건 제한 정책 결정