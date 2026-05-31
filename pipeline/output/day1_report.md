# Day 1 리포트 — cs_ids_recovery dry-run

- tool_version: 1.0
- generated_at: 2026-05-31T03:42:51.287Z
- scope: yearKey=all setId=all

## 결과 요약

| 항목 | 값 |
|---|---|
| 총 choice 수 | 6645 |
| cs_ids 비어있고 의무 있는 choice | 979 |
| set_safety: safe | 180 |
| set_safety: suspect | 130 |
| set_safety: rebuild_needed | 40 |

## 자동/배치/수동 분류

| decision | count | 처리 path |
|---|---|---|
| auto_apply | 0 | hard 6조건 만족 — Day 2 자동 반영 후보 |
| batch_review | 103 | 검수 보드 v3.1 배치 승인 |
| manual_needed | 827 | 수동 정정 |
| no_quote_extractable | 49 | 해설 안 따옴표 인용 없음 — 별도 path |

## 처리 비율

- 자동 가능: 0.0%
- 배치 검수: 10.5%
- 수동 필요: 84.5%
- 인용 추출 불가: 5.0%

## 다음 단계

- Day 2 자동 반영 cutoff 조정 가능 (현재 min_score=0.85, gap=0.15)
- 본 도구는 read-only — all_data_204.json 미수정
- 출력: pipeline/output/cs_ids_candidates.json (후보 전체) + 본 리포트