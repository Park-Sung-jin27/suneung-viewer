# Day 1 리포트 — cs_ids_recovery dry-run

- tool_version: 1.0
- generated_at: 2026-05-31T08:47:35.224Z
- scope: yearKey=all setId=all

## 결과 요약

| 항목 | 값 |
|---|---|
| 총 choice 수 | 6645 |
| cs_ids 비어있고 의무 있는 choice | 979 |
| set_safety: safe | 167 |
| set_safety: suspect | 142 |
| set_safety: rebuild_needed | 39 |

## 자동/배치/수동 분류

| decision | count | 처리 path |
|---|---|---|
| auto_apply | 8 | hard 6조건 만족 — Day 2 자동 반영 후보 |
| batch_review | 95 | 검수 보드 v3.1 배치 승인 |
| manual_needed | 827 | 수동 정정 |
| no_quote_extractable | 49 | 해설 안 따옴표 인용 없음 — 별도 path |

## 처리 비율

- 자동 가능: 0.8%
- manual needed: 84.5%
- no quote: 5.0%
