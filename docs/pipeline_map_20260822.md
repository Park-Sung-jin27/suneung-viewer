# 파이프라인 지도 — 재추출 43세트에 무엇이 남았나 (발주 D-93 후속 ① · 2026-08-22)

> 추측이 아니라 **필드 diff** 로 확정했다.
> 기준: `2016_6월B::l20166a`(기존 정상 세트) ↔ `2016_6월B::l20166b`(재추출 세트)

## 단계별 실체

| 단계 | 만드는 것 | 호출 | 재추출 43세트 |
|---|---|---|---|
| `step1_answer` | 정답키 | — | ✅ `answer_key.json`(기존 파싱본 47회차) 사용 |
| `step2_extract` | 구조 — `sents` · `questions.t` · `choices.t` · `vocab` | API | ✅ **코덱스가 대체** (API 비용 $0) |
| `step2_postprocess` | 구조 정리 · QA 필드 strip | — | ✅ (step2 안에서 실행) |
| `step3_analysis` | **`ok` · `pat` · `analysis`** | API | ✅ 완료 (19회차 · $26.05) |
| `step4_csids` | **`cs_ids`** (해설↔지문 형광펜 매핑) · `annotations` | API | 🔴 **미실행** |
| `step5_verify` | 정답 재도출 교차검증 (수정 아님, 검증) | API | 🔴 미실행 |
| `step6_merge` | `all_data_204.json` 병합 | — | 🔄 `merge_reextract.mjs` 로 대체 |

`step6_merge` 는 회차·섹션 단위로 받는 구식 인터페이스(`<step5결과> <시험키> <섹션>`)라,
43세트를 한 번에 처리하고 귀속 판정·자동 원복까지 하는 `merge_reextract.mjs` 를 쓴다.

## 필드 diff — 빠진 것이 무엇인가

```
## 세트 레벨      기존만: vocab
## sents[]        기존만: (없음)
## questions[]    기존만: bogi, needsReview
## choices[]      기존만: cs_ids
                  재추출만: _discriminative_validation, _ok_analysis_mismatch, _pat_error
```

### 보유율 비교 — 무엇이 「필수」인가

| 필드 | 기존 353세트 | 재추출 43세트 | 판정 |
|---|--:|--:|---|
| `choices.cs_ids` | **100%** (6822/6840) | **0/780** | 🔴 **필수 — step4 필요** |
| `set.vocab` | 87% (307/353) | 0/43 | ⚠ 준필수 |
| `set.annotations` | 25% (88/353) | 0/43 | 선택 (step4·step6 이 만듦) |
| `sents.para` | 42% | 0/1965 | 선택 |
| `sents.pid` | 3% | 0/1965 | 선택 |

**`cs_ids` 만이 유일하게 100%다.** 기존 데이터가 예외 없이 갖고 있는 필드이고,
게이트의 `E_ok_true_no_cs_ids` · `E_required_cs_missing` 계열이 이것을 본다.
1차 병합에서 신규 위반 1,018건 중 **1,010건(93%)이 이 계열**이었다.

`vocab` 은 step2 가 만들지만 `sanitizeToStructureOnly` 에서 strip 된다(D-86 로그: `set_vocab_stripped=4`).
코덱스 산출물에는 애초에 없다. 기존도 87%라 **없어도 게이트가 막지는 않는다** — 별도 판단 사항.

### 재추출에만 있는 내부 필드

`_discriminative_validation`(420/780) · `_ok_analysis_mismatch` · `_pat_error` 는
step3 가 남긴 **작업용 플래그**다. 기존 데이터에는 없다.
병합 전에 지울지 남길지는 판단이 필요하다 — 남기면 기존과 스키마가 달라진다.

## 결론 — 남은 단계

1. **step4_csids** — 필수. 이것 없이는 몇 번을 병합해도 같은 정지선에 걸린다.
2. **step5_verify** — 정답 재도출 교차검증. `answer_key` 대조를 이미 전건 통과했으므로
   중복이지만, 검증 방식이 다르다(step5 는 AI 로 다시 풀어 본다). 필수 여부는 판단 사항.
3. `vocab` · `annotations` · `para` · `pid` — 기존도 100%가 아니라 게이트가 막지 않는다.
4. 내부 플래그 3종 정리 여부.
