# HANDOVER — D엔진 Phase 1 (새 채팅 이관)

## 이 문서의 용도

이전 채팅에서 진행한 **D엔진 Phase 1 설계**의 최종 상태와 즉시 착수해야 할 다음 단계를 기록합니다. 새 채팅 첫 메시지로 이 문서 전체를 붙여넣으세요.

---

## 핵심 상태 요약

- Gold 14/20 정제 완료 (의도 검증 필드 포함)
- 자동 검증기 2개 구축 (구조 + 의도 + quote boundary)
- dry-run 실행 준비 완료 (GPT-5 프롬프트 + 입력 + 결과 비교기)
- **즉시 할 일**: 사용자가 GPT-5로 14개 dry-run 실행 후 결과 공유

---

## 산출물 9개 (`/pipeline/d_engine/` 권장 위치)

| 파일 | 역할 |
|---|---|
| `d_engine_input_schema.md` | 스키마 정본 (514줄) |
| `d_engine_gold_samples_phase1.json` | Gold 14개 (intent_validation 포함) |
| `d_engine_prompt.txt` | GPT-5 프롬프트 |
| `d_engine_dryrun_inputs.json` | 14개 sample input (D엔진 전달용) |
| `dryrun_results_template.json` | 결과 기록 템플릿 |
| `compare_dryrun_results.mjs` | 결과 자동 분석 스크립트 |
| `validate_gold_phase1.mjs` | Gold 자동 검증 (구조 + 의도 + quote boundary) |
| `gold_authoring_rules.md` | Gold 작성 규칙 정본 (Rule 1~7) |
| `d_engine_dryrun_guide.md` | 실행 가이드 |

---

## Gold 14개 분포 및 인덱스

```
NONE: 4/6 (pending: user_to_author 2)
P_MISMATCH: 3/4 (pending: user 1)
E_EVIDENCE_WEAK: 1/2 (pending: user 1 — 타입 B 설계 권장)
E_CONDITION_MISSING: 1/2 (pending: user 1)
E_LOGIC_UNCLEAR: 1/2 (pending: user 1 — R1_006과 다른 유형)
E_COMPOSITE_ERROR: 2/2 ✅
E_DOMAIN_INVALID: 2/2 ✅
```

| sample_id | pat | error_type | 작성자 | PDF |
|---|---|---|---|---|
| gold_R1_001 | R1 | NONE | user | - |
| gold_R1_002 | R1 | P_MISMATCH | user | - |
| gold_R1_003 | R1 | E_EVIDENCE_WEAK | user | - (타입 A: 배경 설명) |
| gold_R2_001 | R2 | NONE | user | - |
| gold_R2_002 | R2 | E_COMPOSITE_ERROR | user | - |
| gold_R1_004 | R1 | NONE | claude | 3.pdf Q25 |
| gold_R1_005 | R1 | P_MISMATCH | claude | 2.pdf Q38 |
| gold_R1_006 | R1 | E_LOGIC_UNCLEAR | claude | 1.pdf Q18 (근거 연결 누락형) |
| gold_R2_003 | R2 | NONE | claude | 3.pdf Q26 |
| gold_R2_004 | R2 | P_MISMATCH | claude | 9.pdf Q15 (경계 케이스) |
| gold_R2_005 | R2 | E_CONDITION_MISSING | claude | 5.pdf Q24 |
| gold_R2_006 | R2 | E_COMPOSITE_ERROR | claude | 7.pdf Q14 |
| gold_DOMAIN_001 | L3 | E_DOMAIN_INVALID | claude | 1.pdf Q17 (함정: "주제적" 표현) |
| gold_DOMAIN_002 | R1 | E_DOMAIN_INVALID | claude | 6.pdf Q10 (함정: ok:true + pat) |

---

## 즉시 할 일 (PENDING)

### Step 1. dry-run 실행 (사용자 액션)

```
1. d_engine_prompt.txt를 GPT-5 새 대화창에 붙여넣기
2. d_engine_dryrun_inputs.json의 각 sample input을 하나씩 투입
3. 샘플마다 새 GPT-5 창 사용 (context 오염 방지)
4. 총 14회 실행 → 결과를 dryrun_results_template.json 복사본에 기록
5. 14개 전부 완료 후 일괄 공유 (부분 검증 금지)
```

**절대 금지**:
- 결과 수정 / 해석 / 재작성
- 결과 이상하다고 재실행 (**형식 오류만 재실행**)
- 프롬프트 수정
- 다른 모델 사용 (GPT-5 고정)

**재실행 기준표**:
| 상황 | 재실행 |
|---|---|
| JSON 깨짐 | ⭕ |
| 필드 누락 | ⭕ |
| error_type 오타 (enum 외) | ⭕ |
| JSON 외 설명 텍스트 혼입 | ⭕ |
| 결과가 expected와 다름 | ❌ |
| rule_hits 1개만 나옴 | ❌ |
| "이건 틀린 것 같은데" | ❌ |

### Step 2. 결과 자동 분석

```bash
node compare_dryrun_results.mjs \
  d_engine_gold_samples_phase1.json \
  dryrun_results_filled.json
```

### Step 3. 분석 결과별 조치

| diff_type | owner | 조치 |
|---|---|---|
| FULL_MATCH | none | 없음 |
| OVERFAIL | engine | D엔진 프롬프트 강화 |
| MISSED_FAIL | engine | D엔진 규칙 강화 |
| FORBIDDEN_ALTERNATIVE | pending | 사람 판단 |
| ERROR_TYPE_MISMATCH | pending | 사람 판단 |
| RULE_HITS_DIVERGENCE | acceptable/pending | 허용 범위 확인 |

### Step 4. 나머지 6개 Gold 작성 (사용자)

**dry-run 완료 + 엔진 안정 확인 후에만** 착수.

```
gold_R1_007  pass / NONE
gold_R1_008  fail / P_MISMATCH (경계 케이스)
gold_R1_009  fail / E_CONDITION_MISSING
gold_R1_010  fail / E_LOGIC_UNCLEAR (R1_006과 다른 유형 — 근거 비약형 권장)
gold_R2_007  pass / NONE
gold_R2_008  fail / E_EVIDENCE_WEAK (타입 B — 관련 있으나 직접 반박 아님)
```

**사용자 작성 시 체크리스트**:
1. 📌 근거는 passage 내 연속 원문 문자열인가
2. expected error_type 외 다른 해석 가능성이 강하지 않은가
3. ok/pat/domain 조합이 형식 규칙과 충돌하지 않는가
4. analysis가 선지 조건을 전부 다루는가, 일부만 다루는가
5. rationale/test_intent에 D엔진 유도 문구가 없는가
6. precheck_signals 전부 false인가
7. `node validate_gold_phase1.mjs`로 자동 검증 통과하는가

### Step 5. Gold 20개 완성 → 오프라인 테스트 → Stage 2 (파이프라인 통합)

---

## 주요 체크 포인트 (dry-run 관찰 대상)

### 1. gold_R1_006 (E_LOGIC_UNCLEAR)
- 기대: `E_LOGIC_UNCLEAR` / `[RULE_7]`
- 위험: D엔진이 `E_EVIDENCE_WEAK` / `RULE_2`로 판정

### 2. gold_R2_004 (P_MISMATCH)
- 기대: `P_MISMATCH` / `[RULE_1]`
- 위험: D엔진이 pat=R2 수용하고 `pass: true`

### 3. gold_DOMAIN_002 (E_DOMAIN_INVALID)
- 기대: `E_DOMAIN_INVALID` / `[RULE_0, RULE_5]`
- 위험: analysis가 ✅로 긍정해서 D엔진이 형식 위반 놓침

### 4. 정상 pass 케이스 overfail (가장 치명적)
- 해당: gold_R1_001, gold_R1_004, gold_R2_001, gold_R2_003
- 위험: D엔진 과도 엄격 → 정상을 fail로

---

## 이번 세션에서 내재화된 교훈

### 1. Gold 오염 유형 4가지 (반복 발견)
1. **정답 힌트**: "따라서 오답 패턴이 적용될 수 없다" 등
2. **규칙 설명**: "ok:true이므로 pat이 존재할 수 없다" 등 if-then 공식
3. **input 해석**: "analysis도 ~로 인정하고 있음에도" 등
4. **D엔진 행동 유도**: "D엔진이 ~감지하는지 검증" 등

### 2. 근거 인용 규칙 정식화
- "문자 그대로 일치" → "**contiguous substring exact match**"
- paraphrase / 말줄임표 / 단어 축약 / 외부 문장 전부 금지

### 3. 검증기 2층 구조
- **구조 검증**: 문자열, 오염, 스키마, 분포
- **의도 검증**: target_failure_mode / forbidden_alternatives / acceptable_confidence

### 4. FORBIDDEN_ALTERNATIVE owner
- `sample` 아닌 `pending` (엔진 문제일 수도 있음)

### 5. 실행 원칙
- **부분 검증 금지**: 14개 전부 실행해야 패턴 감지 가능
- **D엔진 결과 수정 금지**: 사람 해석이 오히려 오염
- **제가 자기 검증 금지**: Claude가 Gold 작성자이자 심판이 되면 독립성 훼손

---

## 새 채팅에서 첫 메시지로 쓸 프롬프트

```
D엔진 Phase 1 작업 이어갑니다. /mnt/user-data/outputs/의 9개 파일을 기반으로
진행 중이며, 현재 상태는 HANDOVER_D_ENGINE.md에 정리돼 있습니다.

다음 중 하나를 할 예정입니다:
- [ ] GPT-5 dry-run 결과 공유 → 분석
- [ ] 사용자 6개 Gold 작성 (dry-run 완료 후)
- [ ] 기타 이슈

선택한 작업:
```

---

## 사용자 작업 스타일 (유지 원칙)

- "Claude의 간소화 제안은 원칙 이완"을 반복 지적
- 원칙 엄격 디폴트 / 속도·효율보다 품질 우선
- 재설계 제안 시 "치명적 오류" 프레이밍으로 강하게 교정
- 정확한 근거 기반 판단 요구 (추측·낙관 배제)
- 턴수보다 퀄리티 우선
