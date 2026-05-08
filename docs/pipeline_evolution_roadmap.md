# 파이프라인 진화 roadmap (회기 1~10)

## 메타

| 영역                       | 값                                                        |
| -------------------------- | --------------------------------------------------------- |
| 작성                       | 2026-05-08 (Chat 1, 품질 심사관)                          |
| 결정자                     | 성진 (대표)                                               |
| 결정일                     | 2026-05-08                                                |
| 영역                       | docs/pipeline_evolution_roadmap.md (CLAUDE.md docs/ 정합) |
| 사용자 의향 정합           | "최대한 빠르게" — 병행 path 영입                          |
| 레드팀 검수 사전 의무 lock | 모든 회기 spec 발행 사전                                  |

---

## 핵심 lock (사용자 의향 정합)

### lock A — 자동화 우선

사용자 검수 의무 ≤ 10% (Khanmigo 표준 정합). 나머지 90% 자동 path:

- step5 retry 3회 자동 정정
- normalizeAnalysisPatLabel deterministic
- D엔진 majority 채택 자동 release
- 학생 신고 < 3건 자동 모니터링

### lock B — 학생 혼선 / 퀄리티 저하 무조건 차단

다음 조건 발생 시 release_blocked (학생 도착 X):

1. cs_ids 직접성 부정합 (핵심 차별점 위협)
2. 본체 누출 (cross-set leak)
3. ok ↔ analysis 정합성 부정합
4. pat ↔ analysis bracket 불일치
5. needs_human 큐 영역
6. 학생 신고 ≥ 3건

### lock C — 불필요한 고도화 회피

"학생 학습 실질 관여 X 영역" = 1번 결정 + 정착 (반복 검증 X):

- 시각 디자인 (색상 / 폰트 / 애니메이션)
- 부수 기능 (북마크 / 공유)
- 단순 한글 / 띄어쓰기 / 부호
- 변별 판단 영역 "비교 줄 수" 영역

### lock D — 레드팀 검수 사전 의무

모든 회기 spec 발행 사전 레드팀 검수 의무. 본 chat 자율 결정 X.

---

## 회기 1~10 단축 path (병행 영입, ~6~8주 ETA)

```
[Week 1]
  현재 (2025수능 monitoring 종결)
  → 회기 1 (Phase 1 측정) — 데이터 엔지니어 1~2일

[Week 2]
  회기 2 (정정 분기 결정) — 본 chat 0.5일
  회기 3 (deterministic rendering) — 데이터 엔지니어 1~2일
  병행: 회기 8 (Pre-LLM Guardrail) — 1일

[Week 3]
  회기 4 (본체 누출 진단 + set isolation) — 데이터 엔지니어 1~2일
  병행: 회기 5 (Gold 보강 6건) — 사용자 + 본 chat 1~2일

[Week 4]
  회기 6 (Gold 20 dry-run 재실행) — 사용자 + 본 chat 1~2일
  fake door 1주일 metric 회신 (5/14)
  → 4/5 또는 5/5 release 결정

[Week 5~6]
  회기 7 (D엔진 통합) — 데이터 엔지니어 3~5일
  병행: 회기 9 (Post-LLM Guardrail) 부분 — 1~2일

[Week 7~8]
  회기 9 (Post-LLM Guardrail 종결)
  회기 10 (Continuous Loop 부분) — 학생 피드백 path
  → 5/5 release path + Continuous Loop 활성
```

---

## 회기 0.5: set-level checkpoint 영입 (긴급 영역)

### 진입 시점

본 회기 (5 수능 sequential) 종결 사후 즉시 / 회기 1 사전

### ETA

~1~2시간

### spec file

`docs/specs/session0_5_set_level_checkpoint_spec.md`

### 의존성

회기 1~10 영역 ↔ 의존성 X (independent)

### 영향

사용자 작업 환경 영역 단절 영역 시간 손실 ~50% ↓

---

## 회기 1: Phase 1 측정

### 진입 조건

- 본 회기 (2025수능 sequential) 종결

### 작업 (데이터 엔지니어)

직전 turn spec 그대로 — 4 산출물:

1. **needsReview issue code histogram**
   - source: `pipeline/test_data/step5_result_*수능*.json`
   - 필드: `questions[].choices[]._discriminative_validation`
   - 산출: issue_code 분포 (count + ratio) + stage 분포 + 대표 raw 3건

2. **step5 FAIL-FAST 분포** (직전 2024수능 58건 + 2025수능)
   - pat_missing / pat_out_of_domain / ok_analysis_mismatch / 기타
   - setId / questionId 분포

3. **json_parse_fail 원인 분기**
   - stop_reason ("max_tokens" / "end_turn" / "stop_sequence" / "tool_use")
   - raw response tail (마지막 100자)
   - 응답 길이 (token)
   - prompt 길이 (token)
   - repair 실패 유형 (jsonrepair 단계별)

4. **cs_ids 직접성 점검** — 핵심 차별점
   - cross-set leak 사례
   - sentId allowlist 위반 사례
   - directness / alignment / coverage 위반 사례

### 추가 lock

- wrong_no_pat_code 비율 = histogram 사전 숫자 영입 X
- bracket repair = `appendPatCode` X. `normalizeAnalysisPatLabel` (3 case) 의무
- choice.pat = step3 산출 + override + validation 사후 구조화 필드 단독 source of truth

### 산출물 회신 path

markdown raw → 본 chat 검수 → 회기 2 진입

### ETA

1~2일

---

## 회기 2: 정정 분기 결정

### 진입 조건

- 회기 1 산출물 raw 도착

### 작업 (본 chat)

histogram 정합 사후 우선순위 결정. 기준:

| issue code                    | 정정 path                                                   | 회기             |
| ----------------------------- | ----------------------------------------------------------- | ---------------- |
| wrong_no_pat_code (가설 다수) | deterministic rendering (postProcess)                       | 회기 3           |
| pat_missing                   | step3 prompt 점검 + pat_overrides.json                      | 회기 3           |
| pat_out_of_domain (본체 누출) | set isolation + sentId allowlist                            | 회기 4           |
| ok_analysis_mismatch          | postProcess 영역 분기                                       | 회기 3           |
| json_parse_fail               | stop_reason 분기 → schema-constrained / per-choice chunking | 회기 3 또는 별도 |
| cs_id_cross_set               | step4 set isolation                                         | 회기 4           |
| analysis_pat_mismatch         | bracket 생성 X + UI rendering                               | 회기 3           |

### ETA

0.5일

---

## 회기 3: Deterministic rendering 영입

### 진입 조건

- 회기 2 우선순위 결정

### 작업 (데이터 엔지니어)

#### 3-1. `normalizeAnalysisPatLabel` 함수 신규 영입

file: `pipeline/step3_analysis.js` (postProcess 영역)

```javascript
function normalizeAnalysisPatLabel(choice) {
  if (choice.ok !== false || !choice.pat) return choice.analysis;

  const a = choice.analysis;
  // case 1: 누락 → choice.pat 기준 영입
  // case 2: 다른 pat code (예: choice.pat="R2" + analysis "[R1]") → 교체
  // case 3: 옛 라벨 ([패턴3], [오류유형②]) → 제거 + choice.pat 기준 영입

  return renderWithPatCode(stripOldLabels(stripOtherPatCodes(a)), choice.pat);
}
```

#### 3-2. retry strengthening 영입

`reanalyzeSingleChoice` signature 영역에 retryContext 영입.

#### 3-3. (조건부) max_tokens 정정

회기 1 #3 (json_parse_fail) 결과 = stop_reason "max_tokens" 시 max_tokens 정정. 다른 영역 시 schema-constrained path.

### ETA

1~2일

---

## 회기 4: 본체 누출 진단 + set isolation

### 진입 조건

- 회기 1 #4 (cs_ids 직접성) cross-set leak 사례 식별

### 작업 (데이터 엔지니어 + 본 chat)

#### 4-1. callAnalyze prompt context 점검

file: `pipeline/step3_analysis.js` (line 570-608 callAnalyze)

- prompt 영역에 다른 set 영역 sentence 영입 path 점검
- set 영역 단독 isolation 의무

#### 4-2. sentId allowlist 영입

file: `pipeline/step4_csids.js`

```javascript
function validateCsIds(setId, csIds, allSentIds) {
  const allowedPrefix = setId; // r2024d 만 허용
  return csIds.filter((id) => id.startsWith(allowedPrefix));
}
```

#### 4-3. step5 verifier 영역 cross-set leak 검출

file: `pipeline/step5_verify.js`

- pat_out_of_domain 영역 + cs_id_cross_set 영역 식별 → release_blocked

### ETA

1~2일

---

## 회기 5: Phase 1 Gold 보강 (6건)

### 진입 조건

- 회기 1~2 사후 (병행 가능)

### 작업 (사용자 + 본 chat)

target: gold 17 (active 14 + pending 3) → **gold 20** (D엔진 Stage 2 선결)

pending 6건 (`d_engine_gold_samples_phase1.json` user_to_author 영역):

| sample_id   | planned                    |
| ----------- | -------------------------- |
| gold_R1_007 | pass / NONE                |
| gold_R1_008 | fail / P_MISMATCH (경계)   |
| gold_R1_009 | fail / E_CONDITION_MISSING |
| gold_R1_010 | fail / E_LOGIC_UNCLEAR     |
| gold_R2_007 | pass / NONE                |
| gold_R2_008 | fail / E_EVIDENCE_WEAK     |

### 작성 path

1. 사용자 = 6 sample passage + question + choice 작성 (PDF source 단독)
2. 본 chat = analysis + expected_output + rationale + intent_validation 작성
3. 레드팀 검수 (lock D)
4. `d_engine_gold_samples_phase1.json` 영역 영입

### ETA

1~2일

---

## 회기 6: Gold 20 dry-run 재실행

### 진입 조건

- 회기 5 종결 (gold 20 완성)

### 작업 (데이터 엔지니어 + 본 chat)

file: `d_engine_dryrun_inputs.json` + `d_engine_dryrun_guide.md` 정합

1. GPT-5 dry-run 20건 진행
2. compare ≥ 85% 의무
3. 결과 raw → 본 chat 검수
4. compare < 85% 시 → D엔진 prompt 정정 또는 Gold 재 작성

### Stage 2 진입 lock

compare ≥ 85% + 확정 고정 오류 0 + 비결정성 처리 정합 + RULE_7 정합 + E_EVIDENCE_WEAK 제한 정합

### ETA

1~2일

---

## 회기 7: D엔진 통합 (Stage 2)

### 진입 조건

- 회기 6 compare ≥ 85% + Stage 2 lock 정합

### 작업 (데이터 엔지니어)

#### 7-1. wrapper 영입

file: `pipeline/d_engine_wrapper.js` (신규)

- step3 사후 호출 (또는 step5 사전)
- input: choice (ok / pat / analysis / cs_ids)
- output: pass / fail (error_type)

#### 7-2. majority 판정

- 1회 호출 → 결과 영역 RULE_7 트리거 시 2회 추가
- 2/3 일치 → 채택
- 3-way 분기 → needs_human 큐

#### 7-3. needs_human 큐 인터페이스

file: `pipeline/needs_human_queue.js` (신규)

- 사용자 검수 인터페이스 (UI 영역 또는 file 영역)

#### 7-4. 로깅 영입

- RULE_7 발생률
- 재호출 발생률
- needs_human 분기율
- 처리 시간 영역
- 비용 영역 (GPT-5 token)

#### 7-5. pipeline orchestration 영입

file: `pipeline/index.js`

- step3 사후 → D엔진 영역 → step4 진입 path

### ETA

3~5일

---

## 회기 8: Pre-LLM Guardrail

### 진입 조건

- 회기 1~3 병행 가능

### 작업 (데이터 엔지니어)

file: `pipeline/pre_llm_guardrail.js` (신규)

#### 8-1. PDF 무결성 점검

- 페이지 수 영역 (예: 시험지 PDF ≥ 4페이지)
- 텍스트 추출 가능 영역 (pdf-parse v2)
- 합본 PDF 거부 (28p 영역 — 사용자 메모리 정합)

#### 8-2. 입력 file 영역 sanity check

- 파일 크기 영역
- 파일 인코딩 영역
- 시험지 ↔ 정답 PDF 영역 정합

#### 8-3. step1 + step2 사전 진입 점검

file: `pipeline/index.js`

- pre_llm_guardrail 호출 → 통과 시 step1 진입

### ETA

1일

---

## 회기 9: Post-LLM Guardrail (자동 release 분기)

### 진입 조건

- 회기 7 (D엔진 통합) 종결

### 작업 (데이터 엔지니어)

file: `pipeline/post_llm_guardrail.js` (신규)

#### 9-1. 자동 release 분기

- 모든 검증 통과 → release
- needs_human 큐 영역 → release_blocked
- 핵심 차별점 위협 (cs_ids 부정합) → release_blocked
- 본체 누출 식별 → release_blocked

#### 9-2. release_blocked 영역 영입

- `set_status: "release_blocked"` (lock #12-C 정합)
- `display_banner: "검수중"` (학생 도착 시 표시)
- all_data_204.json 영역 영입

#### 9-3. step6 사전 진입 점검

- post_llm_guardrail 호출 → release 시 step6 진입 / release_blocked 시 차단

### ETA

1~2일

---

## 회기 10: Continuous Learning Loop

### 진입 조건

- 회기 9 종결 (production release path 활성)

### 작업 (frontend + 데이터 엔지니어)

#### 10-1. 학생 신고 영역 (frontend)

- 선지별 피드백 버튼 (Chat 2 즉시 구현 #1 정합)
- 문항별 오류 신고 (Chat 2 즉시 구현 #2 정합)
- Supabase RLS 정합

#### 10-2. 자동 quality_gate 영역

- 학생 신고 ≥ 3건 → 자동 release_blocked (lock B 정합)
- needs_human 큐 영역 자동 영입
- 사용자 알림 path

#### 10-3. 학생 신뢰 점수 영역

- Tally 영역 + 사용자 통계 종합
- data-first fix path (RAG 정합)

### ETA

1~2일

---

## 종합 ETA

| Week | 작업                             |
| ---- | -------------------------------- |
| 1    | 회기 1                           |
| 2    | 회기 2 + 회기 3 + 회기 8 (병행)  |
| 3    | 회기 4 + 회기 5 (병행)           |
| 4    | 회기 6 + fake door metric (5/14) |
| 5~6  | 회기 7                           |
| 7~8  | 회기 9 + 회기 10                 |

**총 ETA = ~6~8주 [Inference]**

---

## 회기 path 우선순위 분기 (사용자 결정 영역)

| 분기                                      | 영역                                |
| ----------------------------------------- | ----------------------------------- |
| (a) 회기 1~4 사후 4/5 release (4주)       | 핵심 결함 해소 + production release |
| (b) 회기 1~7 사후 release (8~10주)        | D엔진 통합 사후 lock release        |
| (c) 회기 1~10 종결 사후 release (12~16주) | Continuous Loop 활성 사후 release   |

본 chat 권고: **(a) 4주 release + (b)~(c) 병행 진행** (사용자 시간 영역 fake door 검증 + Chat 2 즉시 구현 4건 병행).

---

## 사용자 의무 영역 (회기 영역별)

| 회기 | 사용자 의무                                          |
| ---- | ---------------------------------------------------- |
| 1    | spec paste (데이터 엔지니어) + raw 회신 (본 chat)    |
| 2    | (영역 0 — 본 chat 자율)                              |
| 3    | spec paste (데이터 엔지니어) + raw 회신 (본 chat)    |
| 4    | spec paste (데이터 엔지니어) + raw 회신 (본 chat)    |
| 5    | gold sample 6건 passage / question / choice 작성     |
| 6    | spec paste (데이터 엔지니어) + dry-run 결과 raw 회신 |
| 7    | spec paste (데이터 엔지니어) + 통합 결과 raw 회신    |
| 8    | spec paste (데이터 엔지니어)                         |
| 9    | spec paste (데이터 엔지니어)                         |
| 10   | spec paste (frontend + 데이터 엔지니어)              |

→ **사용자 작업 = paste + 짧은 raw 회신 + 회기 5 gold sample 작성 단독**.

---

## 본 chat 자율 영역

| 영역             | 영역                                            |
| ---------------- | ----------------------------------------------- |
| 회기 spec 발행   | 모든 회기 (사전 발행 — paste 영역 단독)         |
| raw 검수         | 회기 1~10 산출물 raw 영역                       |
| 결함 진단        | 코드 raw 점검 + 결함 식별                       |
| 정정 path 설계   | normalize/render + set isolation + Guardrail 등 |
| 레드팀 spec 발행 | 회기 spec 사전 (lock D 정합)                    |
| roadmap.md 갱신  | 회기 종결 사후                                  |

---

## lock cross-check (사용자 의향 정합)

| lock                      | 회기 영역                                                                |
| ------------------------- | ------------------------------------------------------------------------ |
| A (자동화 우선)           | 회기 7 (D엔진) + 회기 9 (Post-LLM Guardrail) + 회기 10 (Continuous Loop) |
| B (학생 혼선 차단)        | 회기 4 (set isolation) + 회기 7 (D엔진) + 회기 9 (release_blocked)       |
| C (불필요한 고도화 회피)  | 회기 영역 외 — 1번 결정 path                                             |
| D (레드팀 검수 사전 의무) | 모든 회기 spec 발행 사전                                                 |

---

## 영구 보존 path

본 file = `docs/pipeline_evolution_roadmap.md` (CLAUDE.md docs/ 영역 정합).
회기 종결 사후 본 chat 자율 갱신 path.
