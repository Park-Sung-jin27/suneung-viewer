# HANDOVER — D엔진 Phase 1 (품질 심사관)

> 갱신: 2026-04-24 세션 종료
> 다음 재개: R2_010 최종 1회 검증만 (5분 작업)

---

## 🎯 다음 재개 포인트 (2026-04-25 이후)

Phase 1 Stage A 종료됨. 다음 작업은 ROI 기준 택일:

### 옵션 1: Phase 1 Complete 마무리
- R1_008 원본 복구 시도
- R1_007, R2_007 신규 작성

### 옵션 2: Stage 2 선결 조건 처리
- GPT-5 비결정성 전략 결정
- RULE_7 재정의

### 옵션 3: 5/15 모두의창업 제출 자료 집중
- D엔진은 Stage A 종료 상태로 고정
- 제출 후 Phase 1 Complete 재개

### 검증용 input JSON

```json
{
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
}
```

### 판정 기준 (고정, 변경 금지)

| 결과 | 판정 | 액션 |
|---|---|---|
| 3/3 E_COMPOSITE_ERROR | ✅ 확정 | Gold 추가 → 18개로 종료 |
| 2/3 + NONE 없음 | 🟡 조건부 수용 | Gold 추가 + acceptable 태그 |
| 1/3 이하 또는 NONE 1회 이상 | 🔴 실패 | 영구 포기, 17개로 종료 |

**절대 금지**: 재수정. 5번째 수정 시도 금지. 결과 수용 후 즉시 Phase 1 마감.

---

## 오늘(4/24) 세션 성과

### 확정 Gold 3건
- **R1_009** (E_CONDITION_MISSING, 계약법 합의 성립)
- **R2_008** (E_EVIDENCE_WEAK, 블록체인 위변조)
- **R1_008** (P_MISMATCH, 광합성/세포호흡 기능 교차)

### 폐기 / 실패 3건
- **R1_010** (E_LOGIC_UNCLEAR): 3/3 NONE → 엔진 RULE_7 미감지 확정
- **R2_009 초안** (E_EVIDENCE_WEAK, 백신): 3/3 E_CONDITION_MISSING → 복합 조건 선지 문제
- **R2_009 수정본** (태양 흑점): 2/3 E_CONDITION_MISSING, 1/3 E_EVIDENCE_WEAK → Subtype 조건 미충족

### 진화 중 1건
- **R2_010** (E_COMPOSITE_ERROR, 늑대/사슴/풀): 설계 수정 4회 후 내일 검증 대기

---

## 현재 Phase 1 상태 (17개)

| error_type | 현재 | 목표 | 상태 |
|---|---|---|---|
| NONE | 6/6 | ✅ | 완료 |
| P_MISMATCH | 5/5 | ✅ | 완료 |
| E_CONDITION_MISSING | 2/2 | ✅ | 완료 |
| E_DOMAIN_INVALID | 1/1 | ✅ | 완료 |
| E_EVIDENCE_WEAK | 1/2 | ⚠️ | R2_009 실패, 1/2로 마감 |
| E_LOGIC_UNCLEAR | 1/2 | ⚠️ | R1_010 실패, 1/2로 마감 |
| E_COMPOSITE_ERROR | 1/2 | ⏳ | R2_010 내일 검증 후 결정 |

**완료율**: 17/20 = 85%

---

## 🔴 Stage 2 입력값 (반드시 기록)

### 발견된 엔진 특성 3가지

#### 1. E_LOGIC_UNCLEAR 사실상 미인식
- **증거**: R1_006 미발동 + R1_010 3/3 NONE
- **원리**: 엔진은 analysis의 "결론 정확성"만 평가. 논리 전개 품질 평가 안 함
- **Stage 2 대응**: RULE_7 재정의 또는 제거 검토

#### 2. E_EVIDENCE_WEAK 협소 작동 조건
- **증거**: R2_008 성공, R2_009 초안/수정본 모두 실패
- **성공 조건** (공식):
  1. 선지가 단일 주장 (복합 조건 아님)
  2. analysis가 선지 핵심 판단 축을 명시
  3. 근거가 그 판단을 직접 검증하지 않음
  4. 회피 표현 없음 ("단정하기 어렵다" 등)
  5. "A라고 했지만 근거는 B" 구조
- **주의**: 5조건 충족해도 비결정성 존재 (R2_009 수정본 1/3 발현)
- **Stage 2 대응**: Subtype B 전용 카테고리로 제한

#### 3. R4 → R2 흡수 현상
- **증거**: R1_008 3/3 R2 해석 (작성 의도는 R4였음)
- **해석**: 엔진이 같은 문단 내 두 개념의 기능 대응 역전을 "주체-속성 관계 전도 = R2"로 분류
- **Stage 2 대응**: R4 카테고리 실전 사용 가능성 재평가

### 추가 엔진 비결정성 증거
- R1_001: 동일 입력에 OVERFAIL ↔ NONE 분기 (Phase 1 초기 관찰)
- R2_009 수정본: 2/3 E_CONDITION_MISSING, 1/3 E_EVIDENCE_WEAK
- **Stage 2 대응**: majority voting 또는 needs_human 분기 전략 결정 필수

---

## 🔥 내일 할 일 순서

1. **R2_010 3회 검증** (5~10분)
2. **결과 반영** (파일 업데이트 5분)
3. **validate 실행** (1분)
4. **HANDOVER_D_ENGINE_PHASE1_COMPLETE.md 최종 업데이트** (10분)
5. **Phase 1 공식 종료 선언**
6. **(선택) Stage 2 선결 조건 처리 계획 수립**

**총 예상 소요**: 30분 이내.

---

## Stage 2 진입 선결 조건 (참고)

- [x] Gold 14개 이상, FULL_MATCH + acceptable ≥ 85%
- [x] 확정 고정 오류 0
- [ ] R2_010 검증 완료 → 17 또는 18개 확정
- [ ] 전체 Gold 기준 dry-run 재실행 + compare 85% 이상
- [ ] **비결정성 처리 전략 결정** (majority voting / needs_human / 기타)
- [ ] **RULE_7 재정의 또는 제거 결정**
- [ ] **E_EVIDENCE_WEAK Subtype B 제한 정책 결정**

**미완 4개 항목**은 Stage 2 착수 전 별도 세션에서 처리.

---

## 파일 상태

| 파일 | 위치 | 최신 |
|---|---|---|
| d_engine_gold_samples_phase1.json | config/ | ✅ 17개 |
| d_engine_dryrun_inputs.json | config/ | ✅ 17개 |
| d_engine_prompt.txt | config/ | ✅ 우선순위 보정 포함 |
| dryrun_results_test.json | config/ | ⚠️ 14개 (R1_008, R1_009, R2_008 검증 결과 미포함) |

**정리 제안** (내일):
- R2_010 결정 후 dryrun_results 파일에 3개 + R2_010 결과 1개 총 18개로 업데이트
- 전체 재실행 대신 **새로 추가된 샘플만 단독 결과 기록**
- compare 전체 재실행으로 최종 지표 확인

---

## 오늘 세션 추가 교훈 (2개)

### 교훈 12: 레드팀의 "치명적 오류" 표현 남용 경계
- 오늘 R2_010 수정 이력: 레드팀이 4회 "치명적 오류" 지적
- 실제로 "치명적"은 1번째뿐. 나머지는 "정밀화 제안"
- **규칙**: "치명적 오류" 표현 자체를 액면가로 수용하지 말고 **실제 영향 평가 후 수용 여부 판단**

### 교훈 13: 수정 수렴 vs 수정 반복 구분
- 수정이 **원인 해결 방향**으로 진행되면 → 수렴 (계속해도 됨)
- 수정이 **다른 문제로 이동**하면 → 반복 (중단 신호)
- R2_010은 "R1/R2 구조 명확화"로 수렴 방향 — 내일 검증 가치 있음

---

## 📌 내일 재개 시 첫 메시지 (참고)

```
어제 R2_010 설계 수정 4회 진행. 내일 1회 검증 후 결정 합의.

최종 input (위 HANDOVER 참조) 으로 3회 GPT-5 검증 진행.
판정 기준도 고정됨. 재수정 금지.

결과 공유 → 즉시 Phase 1 종료 절차 진입.
```

---

## 결론

오늘 진전: Gold 14 → 17 (+3). 엔진 특성 3가지 발견.
내일 작업: 5~30분 내 Phase 1 공식 종료.

**Phase 1 = 설계 완성**. Stage 2 진입 전 선결 조건 4개 남음.
