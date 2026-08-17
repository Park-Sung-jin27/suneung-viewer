# 시험 회차별 완성도 현황표 (발주 fs · 2026-08-17)

> **판정문이 아니다.** 항목별 수치만 담았다.
> 「완성/미완성」 기준은 대표 판정 사항이므로 이 문서에서 정하지 않는다.
> 순위도 매기지 않는다.
>
> 생성: `node pipeline/quality_gate.mjs --report` → `node pipeline/exam_completeness_report.mjs`
> 데이터 수정 0 · 게이트 축 추가 0(§13⑱).

## 1. LIVE (공개 241세트)

| 회차 | 세트 | 문항 | 선지 | CRIT | WARN | WARN 상위3 | ann 보유(빈) | ann 결손 | pat 누락 | cs_ids 보유율 | cs 결손 | sentType 누락 | needsReview | 결함0 항목 |
|---|--:|--:|--:|--:|--:|---|--:|--:|--:|--:|--:|--:|--:|--:|
| 2027_6월 | 8 | 34 | 170 | 0 | 35 | E_empty_pat_cs_present 19<br>W_bogi_anchor 16 | 8 (0) | 0 | 0 | 97.1% | 0 | 0 | 0 | 6/7 |
| 2026_6월 | 5 | 21 | 105 | 0 | 22 | E_empty_pat_cs_present 5<br>W_csspan_stale 5<br>W_verbose 4 | 4 (1) | 1 | 0 | 96.2% | 0 | 0 | 0 | 5/7 |
| 2026_9월 | 6 | 26 | 130 | 0 | 40 | E_empty_pat_cs_present 17<br>H_cs_concentration 10<br>W_analysis_marker_mismatch 5 | 6 (0) | 0 | 0 | 99.2% | 0 | 0 | 0 | 6/7 |
| 2026수능 | 8 | 34 | 170 | 0 | 111 | W_struct_missing 78<br>E_empty_pat_cs_present 14<br>H_cs_concentration 13 | 8 (0) | 0 | 0 | 97.1% | 0 | 35 | 0 | 5/7 |
| 2025_6월 | 6 | 26 | 130 | 0 | 23 | H_cs_concentration 6<br>W_choice_anno_stale 5<br>W_verbose 5 | 5 (1) | 1 | 0 | 92.3% | 0 | 0 | 2 | 4/7 |
| 2025_9월 | 8 | 34 | 170 | 0 | 65 | W_bogi_anchor 18<br>W_annotation_stale 13<br>W_verbose 11 | 7 (1) | 0 | 0 | 86.5% | 0 | 0 | 0 | 6/7 |
| 2025수능 | 8 | 34 | 170 | 0 | 72 | W_struct_missing 45<br>H_cs_concentration 8<br>FOOTNOTE_MARKER_INTEGRITY 7 | 8 (0) | 0 | 0 | 95.3% | 0 | 73 | 0 | 5/7 |
| 2024_6월 | 7 | 30 | 150 | 0 | 29 | H_cs_concentration 9<br>E_empty_pat_cs_present 5<br>W_verbose 4 | 7 (0) | 0 | 0 | 94.7% | 0 | 0 | 0 | 6/7 |
| 2024_9월 | 3 | 13 | 65 | 0 | 25 | FOOTNOTE_MARKER_INTEGRITY 7<br>H_cs_concentration 5<br>E_empty_pat_cs_present 4 | 2 (1) | 1 | 0 | 96.9% | 0 | 0 | 0 | 5/7 |
| 2024수능 | 8 | 34 | 170 | 0 | 63 | H_cs_concentration 29<br>E_empty_pat_cs_present 10<br>W_struct_missing 7 | 8 (0) | 0 | 0 | 94.7% | 0 | 0 | 5 | 5/7 |
| 2023_6월 | 5 | 20 | 100 | 0 | 29 | E_empty_pat_cs_present 14<br>H_cs_concentration 9<br>W_verbose 2 | 5 (0) | 0 | 0 | 98.0% | 0 | 0 | 1 | 5/7 |
| 2023_9월 | 6 | 26 | 130 | 0 | 25 | E_empty_pat_cs_present 7<br>H_cs_concentration 5<br>FOOTNOTE_MARKER_INTEGRITY 4 | 6 (0) | 0 | 0 | 99.2% | 0 | 0 | 1 | 5/7 |
| 2023수능 | 8 | 34 | 170 | 0 | 19 | E_empty_pat_cs_present 9<br>W_struct_missing 4<br>H_cs_concentration 2 | 8 (0) | 0 | 0 | 96.5% | 0 | 0 | 3 | 5/7 |
| 2022_6월 | 6 | 24 | 120 | 0 | 22 | H_cs_concentration 8<br>E_empty_pat_cs_present 7<br>W_orphan_marker 2 | 5 (1) | 0 | 0 | 92.5% | 0 | 0 | 0 | 6/7 |
| 2022_9월 | 6 | 27 | 135 | 0 | 29 | E_empty_pat_cs_present 10<br>W_bogi_anchor 8<br>H_cs_concentration 5 | 5 (1) | 1 | 0 | 90.4% | 0 | 0 | 0 | 5/7 |
| 2022수능 | 8 | 34 | 170 | 0 | 35 | H_cs_concentration 12<br>W_cs_anchor_mismatch 7<br>E_empty_pat_cs_present 5 | 8 (0) | 0 | 0 | 94.7% | 0 | 0 | 1 | 5/7 |
| 2021_6월 | 4 | 15 | 75 | 0 | 6 | E_empty_pat_cs_present 2<br>FOOTNOTE_MARKER_INTEGRITY 1<br>W_bogi_anchor 1 | 3 (1) | 0 | 0 | 100.0% | 0 | 0 | 0 | 6/7 |
| 2021_9월 | 6 | 27 | 135 | 0 | 22 | H_cs_concentration 9<br>W_bogi_anchor 8<br>E_empty_pat_cs_present 4 | 1 (5) | 5 | 0 | 91.9% | 0 | 0 | 1 | 4/7 |
| 2021수능 | 7 | 30 | 150 | 0 | 21 | W_csless_with_anchor 5<br>H_cs_concentration 5<br>C_anchor_marker_space 2 | 5 (2) | 0 | 0 | 89.3% | 0 | 0 | 0 | 6/7 |
| 2020_6월 | 3 | 15 | 75 | 0 | 17 | E_empty_pat_cs_present 7<br>W_csless_with_anchor 5<br>H_cs_concentration 3 | 0 (3) | 3 | 0 | 81.3% | 0 | 0 | 1 | 4/7 |
| 2020_9월 | 3 | 15 | 75 | 0 | 17 | E_empty_pat_cs_present 10<br>H_cs_concentration 3<br>W_bogi_anchor 2 | 2 (1) | 0 | 0 | 89.3% | 0 | 0 | 1 | 5/7 |
| 2020수능 | 7 | 30 | 150 | 0 | 47 | W_struct_missing 13<br>H_cs_concentration 10<br>E_empty_pat_cs_present 7 | 7 (0) | 0 | 0 | 92.0% | 0 | 0 | 0 | 6/7 |
| 2019_6월 | 7 | 30 | 150 | 0 | 15 | W_csless_with_anchor 6<br>H_cs_concentration 5<br>FOOTNOTE_MARKER_INTEGRITY 4 | 4 (3) | 2 | 0 | 90.0% | 0 | 0 | 0 | 5/7 |
| 2019_9월 | 4 | 15 | 75 | 0 | 40 | H_cs_concentration 28<br>W_l3_cs_missing 4<br>W_csless_with_anchor 3 | 2 (2) | 2 | 0 | 85.3% | 0 | 0 | 0 | 5/7 |
| 2019수능 | 5 | 21 | 105 | 0 | 20 | FOOTNOTE_MARKER_INTEGRITY 8<br>E_empty_pat_cs_present 7<br>H_cs_concentration 2 | 4 (1) | 1 | 0 | 95.2% | 0 | 0 | 0 | 5/7 |
| 2018_6월 | 1 | 3 | 15 | 0 | 3 | W_l3_cs_missing 2<br>W_csless_with_anchor 1 | 0 (1) | 0 | 0 | 86.7% | 0 | 0 | 0 | 6/7 |
| 2018수능 | 7 | 30 | 150 | 0 | 14 | H_cs_concentration 13<br>W_cs_anchor_mismatch 1 | 3 (4) | 3 | 0 | 96.7% | 0 | 0 | 0 | 5/7 |
| 2017_6월 | 3 | 10 | 50 | 0 | 20 | W_l3_cs_missing 8<br>FOOTNOTE_MARKER_INTEGRITY 4<br>H_cs_concentration 3 | 1 (2) | 1 | 0 | 84.0% | 0 | 0 | 0 | 5/7 |
| 2016_6월A | 5 | 17 | 85 | 0 | 6 | E_empty_pat_cs_present 2<br>H_cs_concentration 2<br>W_bogi_anchor 1 | 1 (4) | 4 | 0 | 91.8% | 0 | 0 | 0 | 5/7 |
| 2016_6월B | 5 | 17 | 85 | 0 | 11 | W_csless_with_anchor 6<br>W_l3_cs_missing 3<br>E_pat_unclassifiable 2 | 1 (4) | 4 | 0 | 83.5% | 0 | 0 | 1 | 4/7 |
| 2016_9월A | 4 | 13 | 65 | 0 | 18 | W_csless_with_anchor 6<br>W_struct_missing 5<br>W_l3_cs_missing 3 | 1 (3) | 2 | 0 | 81.5% | 0 | 0 | 0 | 5/7 |
| 2016_9월B | 4 | 14 | 70 | 0 | 13 | W_csless_with_anchor 8<br>W_l3_cs_missing 2<br>H_cs_concentration 2 | 0 (4) | 4 | 0 | 81.4% | 0 | 0 | 0 | 5/7 |
| 2016수능A | 6 | 19 | 95 | 0 | 27 | W_bogi_anchor 15<br>H_cs_concentration 9<br>E_empty_pat_cs_present 2 | 2 (4) | 2 | 0 | 94.7% | 0 | 0 | 0 | 5/7 |
| 2016수능B | 7 | 22 | 110 | 0 | 20 | FOOTNOTE_MARKER_INTEGRITY 5<br>W_csless_with_anchor 4<br>W_bogi_anchor 4 | 1 (6) | 4 | 0 | 90.9% | 0 | 0 | 0 | 5/7 |
| 2015_6월A | 9 | 30 | 150 | 0 | 38 | W_bogi_anchor 13<br>FOOTNOTE_MARKER_INTEGRITY 10<br>W_csless_with_anchor 6 | 4 (5) | 4 | 0 | 92.7% | 0 | 0 | 0 | 5/7 |
| 2015_6월B | 6 | 22 | 110 | 0 | 22 | W_bogi_anchor 6<br>W_csless_with_anchor 5<br>H_cs_concentration 5 | 1 (5) | 4 | 0 | 88.2% | 0 | 0 | 0 | 5/7 |
| 2015_9월A | 5 | 18 | 90 | 0 | 15 | W_bogi_anchor 6<br>W_csless_with_anchor 4<br>E_empty_pat_cs_present 3 | 0 (5) | 5 | 0 | 84.4% | 0 | 0 | 1 | 4/7 |
| 2015_9월B | 2 | 9 | 45 | 0 | 0 | — | 0 (2) | 2 | 0 | 77.8% | 0 | 0 | 1 | 5/7 |
| 2015수능A | 2 | 9 | 45 | 0 | 10 | H_cs_concentration 5<br>W_struct_missing 3<br>FOOTNOTE_MARKER_INTEGRITY 2 | 2 (0) | 0 | 0 | 100.0% | 0 | 0 | 0 | 6/7 |
| 2014_6월A | 5 | 14 | 70 | 0 | 7 | E_empty_pat_cs_present 3<br>W_bogi_anchor 2<br>E_pat_unclassifiable 1 | 0 (5) | 2 | 1 | 84.3% | 0 | 0 | 0 | 4/7 |
| 2014_6월B | 7 | 19 | 95 | 0 | 39 | W_bogi_anchor 10<br>W_csless_with_anchor 7<br>W_l3_cs_missing 6 | 0 (7) | 3 | 1 | 87.4% | 0 | 0 | 0 | 4/7 |
| 2014_9월A | 7 | 22 | 110 | 0 | 28 | W_bogi_anchor 11<br>E_empty_pat_cs_present 5<br>W_csless_with_anchor 4 | 1 (6) | 4 | 0 | 88.2% | 0 | 0 | 1 | 4/7 |
| 2014_9월B | 4 | 11 | 55 | 0 | 7 | W_bogi_anchor 7 | 0 (4) | 2 | 0 | 92.7% | 0 | 0 | 0 | 5/7 |
| **합계** | **241** | **948** | **4740** | **0** | **1147** | H_cs_concentration 255<br>E_empty_pat_cs_present 194<br>W_bogi_anchor 167 | **146 (95)** | **67** | **2** | **92.2%** | **0** | **108** | **20** | — |

## 2. 비노출 (112세트)

| 회차 | 세트 | 문항 | 선지 | CRIT | WARN | WARN 상위3 | ann 보유(빈) | ann 결손 | pat 누락 | cs_ids 보유율 | cs 결손 | sentType 누락 | needsReview | 결함0 항목 |
|---|--:|--:|--:|--:|--:|---|--:|--:|--:|--:|--:|--:|--:|--:|
| 2026_6월 | 3 | 13 | 65 | 9 | 10 | E_empty_pat_cs_present 6<br>W_cs_anchor_mismatch 2<br>W_orphan_marker 1 | 3 (0) | 0 | 0 | 92.3% | 0 | 0 | 1 | 4/7 |
| 2026_9월 | 2 | 8 | 40 | 1 | 16 | H_cs_concentration 6<br>FOOTNOTE_MARKER_INTEGRITY 3<br>W_verbose 3 | 2 (0) | 0 | 0 | 100.0% | 0 | 0 | 0 | 5/7 |
| 2025_6월 | 2 | 8 | 40 | 1 | 3 | H_cs_concentration 3 | 2 (0) | 0 | 0 | 90.0% | 0 | 0 | 0 | 5/7 |
| 2024_6월 | 1 | 4 | 20 | 1 | 1 | E_empty_pat_cs_present 1 | 1 (0) | 0 | 0 | 100.0% | 0 | 0 | 0 | 5/7 |
| 2024_9월 | 5 | 21 | 105 | 6 | 34 | W_bogi_anchor 13<br>E_empty_pat_cs_present 5<br>H_cs_concentration 4 | 4 (1) | 1 | 0 | 91.4% | 0 | 0 | 2 | 3/7 |
| 2023_6월 | 3 | 14 | 70 | 5 | 19 | H_cs_concentration 8<br>W_verbose 4<br>SOURCE_VERSE_LINE_OVERFLOW 2 | 3 (0) | 0 | 0 | 92.9% | 0 | 0 | 0 | 5/7 |
| 2023_9월 | 2 | 8 | 40 | 2 | 11 | E_empty_pat_cs_present 6<br>H_cs_concentration 4<br>W_analysis_marker_mismatch 1 | 2 (0) | 0 | 0 | 90.0% | 0 | 0 | 0 | 5/7 |
| 2022_6월 | 2 | 10 | 50 | 1 | 14 | W_verbose 6<br>FOOTNOTE_MARKER_INTEGRITY 3<br>SOURCE_INLINE_OUT_OF_RANGE 2 | 2 (0) | 0 | 0 | 100.0% | 0 | 0 | 1 | 4/7 |
| 2021_6월 | 3 | 15 | 75 | 2 | 12 | C_anchor_marker_space 3<br>H_cs_concentration 3<br>E_empty_pat_cs_present 2 | 1 (2) | 2 | 0 | 88.0% | 0 | 0 | 0 | 4/7 |
| 2020_6월 | 3 | 12 | 60 | 14 | 25 | D_true_has_pat 12<br>H_cs_concentration 3<br>D_false_no_pat 3 | 0 (3) | 1 | 3 | 91.7% | 3 | 0 | 0 | 2/7 |
| 2019_9월 | 2 | 9 | 45 | 36 | 7 | W_l3_cs_missing 4<br>W_csless_with_anchor 3 | 0 (2) | 1 | 0 | 51.1% | 18 | 0 | 0 | 3/7 |
| 2019수능 | 2 | 9 | 45 | 4 | 4 | H_cs_concentration 4 | 1 (1) | 0 | 0 | 100.0% | 0 | 0 | 0 | 5/7 |
| 2018_6월 | 6 | 27 | 135 | 46 | 44 | D_true_has_pat 10<br>W_csless_with_anchor 8<br>W_l3_cs_missing 6 | 0 (6) | 4 | 2 | 73.3% | 18 | 0 | 0 | 2/7 |
| 2018_9월 | 2 | 10 | 50 | 8 | 28 | E_empty_pat_cs_present 11<br>H_cs_concentration 11<br>W_csless_with_anchor 2 | 0 (2) | 2 | 0 | 80.0% | 4 | 0 | 0 | 3/7 |
| 2017_6월 | 3 | 15 | 75 | 18 | 44 | H_cs_concentration 27<br>W_bogi_anchor 5<br>W_csless_with_anchor 3 | 1 (2) | 2 | 0 | 80.0% | 8 | 0 | 0 | 3/7 |
| 2017_9월 | 7 | 20 | 100 | 39 | 41 | W_bogi_anchor 10<br>W_l3_cs_missing 7<br>W_csless_with_anchor 6 | 0 (7) | 2 | 2 | 73.0% | 17 | 0 | 5 | 1/7 |
| 2017수능 | 6 | 30 | 150 | 12 | 23 | W_struct_missing 5<br>W_csless_with_anchor 4<br>D_true_has_pat 4 | 3 (3) | 0 | 1 | 92.7% | 0 | 0 | 3 | 3/7 |
| 2016_6월A | 3 | 10 | 50 | 34 | 25 | W_csless_with_anchor 5<br>W_struct_missing 5<br>W_l3_cs_missing 4 | 0 (3) | 3 | 2 | 58.0% | 15 | 0 | 0 | 2/7 |
| 2016_9월A | 3 | 13 | 65 | 31 | 43 | W_struct_missing 16<br>D_true_has_pat 8<br>W_l3_cs_missing 7 | 0 (3) | 3 | 2 | 56.9% | 15 | 0 | 0 | 2/7 |
| 2016_9월B | 2 | 7 | 35 | 43 | 27 | E_pat_unclassifiable 10<br>D_false_no_pat 10<br>FOOTNOTE_MARKER_INTEGRITY 5 | 0 (2) | 2 | 10 | 34.3% | 11 | 0 | 0 | 2/7 |
| 2016수능A | 3 | 11 | 55 | 8 | 4 | H_cs_concentration 2<br>FOOTNOTE_MARKER_INTEGRITY 1<br>W_bogi_anchor 1 | 0 (3) | 1 | 0 | 85.5% | 0 | 0 | 0 | 4/7 |
| 2016수능B | 2 | 7 | 35 | 8 | 9 | W_bogi_anchor 7<br>W_csless_with_anchor 1<br>H_cs_concentration 1 | 0 (2) | 0 | 0 | 97.1% | 0 | 0 | 0 | 5/7 |
| 2015_9월A | 2 | 7 | 35 | 20 | 18 | D_true_has_pat 8<br>W_bogi_anchor 2<br>W_l3_cs_missing 2 | 0 (2) | 1 | 2 | 71.4% | 6 | 0 | 0 | 2/7 |
| 2015수능A | 6 | 21 | 105 | 22 | 25 | H_cs_concentration 7<br>W_bogi_anchor 6<br>W_struct_missing 5 | 0 (6) | 1 | 0 | 88.6% | 0 | 0 | 1 | 3/7 |
| 2015수능B | 8 | 29 | 145 | 36 | 14 | W_bogi_anchor 4<br>H_cs_concentration 4<br>W_csless_with_anchor 2 | 1 (7) | 1 | 0 | 95.9% | 0 | 0 | 0 | 4/7 |
| 2014_6월A | 3 | 8 | 40 | 21 | 20 | W_bogi_anchor 6<br>W_l3_cs_missing 4<br>W_csless_with_anchor 3 | 1 (2) | 1 | 3 | 60.0% | 10 | 0 | 0 | 2/7 |
| 2014_6월B | 1 | 3 | 15 | 5 | 6 | W_l3_cs_missing 3<br>W_csless_with_anchor 1<br>E_pat_unclassifiable 1 | 0 (1) | 1 | 1 | 60.0% | 2 | 0 | 0 | 2/7 |
| 2014_9월B | 5 | 12 | 60 | 44 | 18 | D_true_has_pat 8<br>E_pat_unclassifiable 3<br>W_csless_with_anchor 2 | 0 (5) | 3 | 2 | 50.0% | 18 | 0 | 0 | 2/7 |
| 2014수능A | 10 | 30 | 150 | 0 | 20 | W_struct_missing 6<br>W_l3_cs_missing 5<br>H_cs_concentration 4 | 6 (4) | 0 | 0 | 92.0% | 0 | 0 | 2 | 5/7 |
| 2014수능B | 10 | 29 | 145 | 0 | 21 | W_struct_missing 5<br>E_empty_pat_cs_present 4<br>W_bogi_anchor 4 | 4 (6) | 2 | 0 | 95.9% | 0 | 0 | 5 | 4/7 |
| **합계** | **112** | **420** | **2100** | **477** | **586** | H_cs_concentration 105<br>W_bogi_anchor 74<br>D_true_has_pat 57 | **37 (75)** | **34** | **30** | **83.8%** | **145** | **0** | **20** | — |

## 3. 집계 정의

| 열 | 정의 |
|---|---|
| 회차 | `all_data_204.json` 의 yearKey. LIVE/비노출 구분은 `RELEASE_KEYS` 의 `yearKey::setId` 복합키. 한 회차가 두 표에 모두 나올 수 있다(부분 공개). |
| CRIT / WARN | `quality_gate.mjs --report` 전수 353세트 실행 결과를 세트 단위로 귀속시켜 재집계. |
| WARN 상위3 | 해당 회차 WARNING 을 유형별로 세어 많은 순 3개. |
| ann 보유(빈) | **`annotations.json` 기준.** 항목 1개 이상이면 보유. |
| ann 결손 | 본문 문장에 마커(ⓐ~ⓖ · ㉠~㉩ · Ⓐ~Ⓔ)가 있는데 annotations 가 빈 세트 수. **빈 것이 정상인 세트를 제외한 수치다.** |
| pat 누락 | **오답 선지(`ok !== true`) 중** `pat` 이 없는 선지 수. 정답 선지는 pat 이 없는 것이 정상이다. |
| cs_ids 보유율 | 전체 선지 중 `cs_ids` 가 1개 이상인 비율. **어휘(V)·R3·L3 선지는 비우는 것이 지침이므로 100% 가 목표치가 아니다.** |
| cs 결손 | 게이트 규칙(`quality_gate.mjs:2392`)상 필수인데 빈 선지 수. `ok:true` 전부 + `ok:false` 중 pat ∈ {R1,R2,R4,L1,L2,L4,L5}. |
| sentType 누락 | `sents[].sentType` 이 없거나 빈 문장 수. |
| needsReview | 문항 단위 `needsReview: true` 플래그 수. |
| 결함0 항목 | 위 7개 항목(CRIT · WARN · ann 결손 · pat 누락 · cs 결손 · sentType 누락 · needsReview)이 0인 개수. **완성도 점수가 아니다.** |

## 4. 한계 — 못 센 것

1. **화면 관측이 필요한 항목은 세지 못했다(§13㉑).** 형광펜이 실제로 칠해지는지,
   해설이 읽히는지, 지문이 끊기지 않는지는 코드·데이터 집계로 확정할 수 없다.
2. **해설 품질은 축이 없다.** 해설 반전(정답인데 오답처럼 서술) 5건처럼 사람이 읽어야
   드러나는 결함은 이 표에 잡히지 않는다. `needsReview` 는 파이프라인 자동 플래그일 뿐
   사람 검수 결과가 아니다.
3. **정답표 대조는 포함하지 않았다.** 공개 승격 4관문의 2)에 해당하며 별도 절차다.
4. **`all_data` 의 `set.annotations` 는 세지 않았다.** 렌더러가 `annotations.json` 으로
   덮어쓰는 dead 필드다(§13⑳). 두 소스의 세트 수가 다르므로 혼동하면 안 된다.
5. **`pat` 값이 `"0"` 인 선지가 전 코퍼스 18건 있다.** 유효 패턴이 아니지만
   `pat 누락` 에는 넣지 않았다(값은 존재하므로). 별건이다.
6. **게이트 findings 중 세트 귀속 실패 0건.** loc 형식이 축마다 달라
   setId 토큰을 찾지 못한 건이다. 표의 CRIT/WARN 합계는 그만큼 전수보다 적다.
7. **B01 검수 대장(`config/verification_ledger.json`)의 사람 검수 상태는 넣지 않았다.**
   자동 집계와 사람 판정을 한 표에 섞으면 §13㉑ 위반이 된다.
