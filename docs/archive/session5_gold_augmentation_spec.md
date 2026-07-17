# 회기 5: Phase 1 Gold 보강 spec — 사용자 + 본 chat 작업

## 회기 lock

- 본 회기 = D엔진 Stage 2 선결 영역 (gold 14 → 20)
- 회기 1~2 사후 즉시 진입 가능 (병행 path)
- 레드팀 검수 사전 의무 (lock D 정합)

## 컨텍스트

### 현재 status

| 영역                      | 값                              |
| ------------------------- | ------------------------------- |
| target_total              | 20                              |
| current_count             | 14 (active)                     |
| pending                   | 6 (user_to_author 영역)         |
| Phase 1 Stage 2 진입 lock | gold 20 + dry-run compare ≥ 85% |

### pending 6건 (`d_engine_gold_samples_phase1.json` user_to_author)

| sample_id   | planned                    | 영역                                |
| ----------- | -------------------------- | ----------------------------------- |
| gold_R1_007 | pass / NONE                | R1 정상 통과 case                   |
| gold_R1_008 | fail / P_MISMATCH (경계)   | R1 ↔ R2 경계 case                   |
| gold_R1_009 | fail / E_CONDITION_MISSING | 조건 누락 case                      |
| gold_R1_010 | fail / E_LOGIC_UNCLEAR     | 논리 불명 case (R1_006과 다른 유형) |
| gold_R2_007 | pass / NONE                | R2 정상 통과 case                   |
| gold_R2_008 | fail / E_EVIDENCE_WEAK     | 근거 약함 case                      |

## 작업 분할 (사용자 ↔ 본 chat)

### 사용자 의무 영역

각 sample 영역 = passage + question + choice 작성 (PDF source 단독):

#### gold_R1_007 — R1 정상 통과

- **목표**: R1 (사실 왜곡) 영역 정상 통과 case
- **path**: 사용자가 옛 수능 PDF 영역에서 R1 사례 1건 단독 발췌
- **기준**: passage 영역 단일 조건 + choice 영역 정반대 (R2 영역 X — 인과 사슬 X)
- **사용자 의무**: PDF 영역 source (file + page + question + choice) 영역 + passage + choice text 단독

#### gold_R1_008 — P_MISMATCH 경계

- **목표**: R1 ↔ R2 경계 case (D엔진이 R1 으로 정답 단 사용자 영역 R2 로 오분류 — P_MISMATCH 식별 의무)
- **path**: 사용자 PDF 발췌 + 본 chat 분석 path
- **사용자 의무**: PDF 영역 source + passage + choice text

#### gold_R1_009 — E_CONDITION_MISSING

- **목표**: 조건 누락 case (analysis 영역 명시적 조건 영역 미명시 — D엔진 식별 의무)
- **사용자 의무**: PDF 영역 source + passage + choice text + 명시적 조건 영역 (예: "전제 조건이 충족된 경우에만")

#### gold_R1_010 — E_LOGIC_UNCLEAR

- **목표**: 논리 연결 불명 case (R1_006 영역 (근거 → 선지 판단 영역 논리 연결 부재) 와 다른 유형)
- **사용자 의무**: PDF 영역 source + passage + choice text + 논리 영역 분석

#### gold_R2_007 — R2 정상 통과

- **목표**: R2 (인과 / 관계 전도) 영역 정상 통과 case
- **path**: 사용자가 옛 수능 PDF 영역에서 R2 사례 1건 단독 발췌
- **기준**: passage 영역 명시적 인과 사슬 ('~때문에', '~로 인해') + choice 영역 인과 역전
- **사용자 의무**: PDF 영역 source + passage + choice text

#### gold_R2_008 — E_EVIDENCE_WEAK

- **목표**: 근거 영역 약함 case (analysis 영역 cs_ids 영역 ↔ 실제 근거 영역 정합 부족 — Subtype B 영역 단독 정합)
- **사용자 의무**: PDF 영역 source + passage + choice text + 근거 영역 분석

### 본 chat 의무 영역

각 sample 영역 = analysis + expected_output + rationale + intent_validation 작성:

```json
{
  "sample_id": "gold_R1_007",
  "source": {
    "file": "(사용자 영역)",
    "page": "(사용자 영역)",
    "question": "(사용자 영역)",
    "choice": "(사용자 영역)",
    "validated": true
  },
  "input": {
    "passage": "(사용자 영역)",
    "question_text": "(사용자 영역)",
    "choice_text": "(사용자 영역)",
    "analysis": "(본 chat 작성)",
    "pat": "R1",
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
    "pass": true,
    "error_type": "NONE",
    "rule_hits": [],
    "reason": "",
    "confidence": "high"
  },
  "rationale": "(본 chat 작성)",
  "test_intent": "(본 chat 작성)",
  "intent_validation": {
    "target_failure_mode": "NONE",
    "forbidden_alternatives": [],
    "acceptable_confidence": ["high"]
  }
}
```

## 진행 path

```
[1] 사용자 — 6 sample passage / question / choice 영역 작성 (PDF source 영역 의무)
    ETA: 1~2시간

[2] 본 chat — 6 sample analysis / expected_output / rationale / intent_validation 작성
    ETA: 본 chat 자율 1~2회기

[3] 레드팀 검수 (lock D)
    검수 영역: gold 영역 정합 (R1 ↔ R2 경계 + E_EVIDENCE_WEAK 영역 정합 등)

[4] 데이터 엔지니어 — `d_engine_gold_samples_phase1.json` 영역 영입
    samples 영역 추가 + meta.current_count 14 → 20

[5] 회기 6 (dry-run 재실행) 진입
```

## 추가 lock

1. **gold 정합 lock**: error_type 1건 단독 (혼합 X — `single_error_type` 정합)
2. **precheck_signals lock**: 모두 false (D엔진 영역 힌트 X — 독립 semantic 판정)
3. **R2 기준 lock**: 명시적 인과 사슬 ('~때문에') 단독. 대응 관계 / 함수 관계 / 정의 왜곡 = R2 영역 X
4. **DOMAIN sample 영역 영입 X**: 본 회기 = R1 + R2 단독 (DOMAIN 영역 영입 X)

## 답변 의무 형식 (CLAUDE.md §1 정합)

각 sample 영역 raw + 정합 사실 점검 + 누락 영역 식별 (있으면).
마무리 3종 (지금 당장 할 것 / 하지 말 것 / 가장 큰 리스크).

## ETA

- 사용자 작성 영역: 1~2시간
- 본 chat 작성 영역: 1~2회기
- 레드팀 검수: 0.5~1회기
- 데이터 엔지니어 영입: 0.5일
- **총 ETA**: 1~2일 (병행)

## 회기 영향 영역

- 회기 1~2 사후 즉시 진입 가능 (병행 path)
- 회기 6 (dry-run 재실행) 의 선결 조건
- 회기 7 (D엔진 통합 Stage 2) 의 선결 조건
