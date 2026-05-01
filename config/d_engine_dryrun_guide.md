# D엔진 Dry-run 실행 가이드

## 준비물
1. `d_engine_prompt.txt` — GPT-5에 붙여넣을 프롬프트
2. `d_engine_dryrun_inputs.json` — 14개 샘플 입력
3. GPT-5 (ChatGPT Plus 이상)

## 실행 순서

### 각 샘플마다 반복 (14회)

**1. GPT-5 새 대화 창 열기** (샘플마다 새 대화 권장 — context 오염 방지)

**2. 프롬프트 붙여넣기**
- `d_engine_prompt.txt` 전체 복사
- GPT-5에 붙여넣기
- 아직 전송하지 말고 대기

**3. 샘플 input 붙여넣기**
- `d_engine_dryrun_inputs.json`에서 해당 sample의 `input` 객체 복사
- 프롬프트의 `{여기에 sample의 input JSON을 붙여넣기}` 자리에 교체
- 전송

**4. 결과 수집**
- GPT-5 응답 JSON 복사
- sample_id와 함께 기록

### 기록 형식 (결과 공유 시)

```
=== gold_R1_001 ===
{
  "pass": ?,
  "error_type": "?",
  "rule_hits": [?],
  "reason": "?",
  "confidence": "?"
}

=== gold_R1_002 ===
...
```

## 절대 금지 사항

1. **한 대화창에 여러 샘플 넣기** — context 간섭 위험
2. **프롬프트 수정** — 스키마 정본 기준 훼손
3. **결과 보고 Gold 샘플 수정** — 오염
4. **GPT-4o / Claude 등 다른 모델 사용** — D엔진 모델 일관성 파괴

## 체크 포인트 (관찰 대상 4가지)

### 1. gold_R1_006 (E_LOGIC_UNCLEAR)
기대: `error_type: E_LOGIC_UNCLEAR` / `rule_hits: [RULE_7]`
위험: D엔진이 `E_EVIDENCE_WEAK` / `RULE_2`로 판정 가능성

### 2. gold_R2_004 (P_MISMATCH)
기대: `error_type: P_MISMATCH` / `rule_hits: [RULE_1]`
위험: D엔진이 pat=R2를 그대로 수용하고 `pass: true` 낼 가능성

### 3. gold_DOMAIN_002 (E_DOMAIN_INVALID)
기대: `error_type: E_DOMAIN_INVALID` / `rule_hits: [RULE_0, RULE_5]`
위험: analysis가 ✅로 긍정해서 D엔진이 형식 위반 놓치고 `pass: true` 낼 가능성

### 4. 정상 pass 케이스 overfail 감시
기대: `pass: true` / `error_type: NONE`
해당 샘플: gold_R1_001, gold_R1_004, gold_R2_001, gold_R2_003 (4개)
위험: D엔진이 과도하게 엄격하여 정상 케이스를 fail로 판정 가능성 (overfail)

**경계 케이스 오판정보다 overfail이 더 치명적**. 정상 pass가 fail 나면 Step3의 정상 출력이 D엔진에서 과다하게 재생성됨 → 파이프라인 마비.

## 결과 기록 양식

`dryrun_results_template.json`을 복사하여 각 sample_id 아래에 GPT-5 응답 JSON을 붙여넣기.

```json
{
  "gold_R1_001": {
    "pass": true,
    "error_type": "NONE",
    "rule_hits": [],
    "reason": "",
    "confidence": "high"
  },
  "gold_R1_002": {
    ...
  }
}
```

### 수집 완료 후 자동 분석

```bash
node compare_dryrun_results.mjs \
  d_engine_gold_samples_phase1.json \
  dryrun_results_filled.json
```

출력: diff_type별 분류 + owner(engine / sample / pending) 자동 판정.

### diff_type 의미

| diff_type | 해석 | owner |
|---|---|---|
| FULL_MATCH | 완전 일치 | none |
| OVERFAIL | 정상 샘플을 fail로 판정 (pass→fail 뒤바뀜) | engine |
| MISSED_FAIL | 문제 샘플을 pass로 판정 | engine |
| FORBIDDEN_ALTERNATIVE | 샘플이 금지한 대안으로 튐 | pending (사람 판단 필요) |
| ERROR_TYPE_MISMATCH | error_type 다름 (forbidden 외) | sample_or_engine_pending |
| RULE_HITS_DIVERGENCE | rule_hits 부분 불일치 | acceptable 또는 pending |

## 제공 파일 정리

| 파일 | 역할 |
|---|---|
| `d_engine_prompt.txt` | GPT-5에 붙여넣을 프롬프트 |
| `d_engine_dryrun_inputs.json` | 14개 샘플 input |
| `dryrun_results_template.json` | 결과 기록 템플릿 |
| `d_engine_gold_samples_phase1.json` | Gold 정본 (비교 기준) |
| `compare_dryrun_results.mjs` | 결과 자동 분석 스크립트 |
| `validate_gold_phase1.mjs` | 샘플 구조 검증 스크립트 |
| `gold_authoring_rules.md` | Gold 작성 규칙 정본 |

**14개 전체 실행이 유일한 정답.**

### 왜 부분 검증은 안 되는가

D엔진 오류는 경계 케이스에만 나타나지 않는다:
- 쉬운 pass 케이스에서 overfail (과도한 엄격성)
- 명확한 R1에서 P_MISMATCH 오판정
- error_type 간 붕괴 (E_CONDITION_MISSING → E_LOGIC_UNCLEAR 등)

3개만 돌리고 통과하면 나머지 11개 안 돌림 → 6개 추가하면 전체 20개가 오염된 상태로 확정.

### 실행 순서

```
1. gold_R1_001 ~ gold_R1_003 실행 (3개)
2. 중간 확인 — 결과 가볍게 점검 (진행 중단 X)
3. gold_R2_001 ~ gold_R2_002 실행 (2개)
4. 중간 확인
5. gold_R1_004 ~ gold_R1_006 실행 (3개)
6. 중간 확인
7. gold_R2_003 ~ gold_R2_006 실행 (4개)
8. gold_DOMAIN_001, gold_DOMAIN_002 실행 (2개)
9. 14개 결과 일괄 공유
```

**중간 확인 = 이상 샘플 기록만 해두기. 조기 종료 금지.**

