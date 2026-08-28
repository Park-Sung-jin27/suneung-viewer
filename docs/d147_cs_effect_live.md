# 형광펜 실효성 축 — cs_ids 가 화면에서 실제로 켜지는가

> 생성: `node pipeline/cs_effect_audit.mjs --live`
> 진단만 한다. **아무것도 쓰지 않는다.**

| 항목 | 수 |
|---|--:|
| 검사 범위 | LIVE 267세트 |
| 🔴 **형광펜 0개 세트** | **0** (LIVE 0) |
| ⚠ 일부만 켜지는 세트 | 9 (LIVE 9) |
| 🔴 형광펜 0개 선지 | **0** |

## ⚠ 일부 cs_id 만 비-하이라이트 — 형광펜은 켜지되 개수가 준다

- 🔴 LIVE `2014_6월B::l20146c` — Q38#2(1/2)
- 🔴 LIVE `2019수능::l2019a` — Q34#5(2/4)
- 🔴 LIVE `2020수능::l2020c` — Q36#1(1/2)
- 🔴 LIVE `2021수능::l2021b` — Q31#1(1/4)
- 🔴 LIVE `2022_6월::l20226b` — Q24#4(1/2)
- 🔴 LIVE `2022_6월::l20226c` — Q29#1(1/3) · Q29#2(2/4) · Q29#3(1/4) · Q29#4(1/4) · Q29#5(1/5) · Q31#3(2/4) · Q31#5(1/2)
- 🔴 LIVE `2022_6월::l20226d` — Q32#3(1/3)
- 🔴 LIVE `2023_6월::l20236a` — Q19#1(1/3) · Q21#1(1/2) · Q21#4(1/3)
- 🔴 LIVE `2025_9월::l20259b` — Q22#2(1/5)

> ⚠ 이 축은 **cs_ids 가 있는 선지**만 본다. cs_ids 가 아예 빈 선지는
> `release_diag` ①축(근거 누락)·`quality_gate` release_ready 가 본다.
> 비-하이라이트 sentType: footnote · author · omission · workTag · image · figure (src/PassagePanel.jsx 확인)
# 형광펜 실효성 축 — cs_ids 가 화면에서 실제로 켜지는가

> 생성: `node pipeline/cs_effect_audit.mjs --list`
> 진단만 한다. **아무것도 쓰지 않는다.**

| 항목 | 수 |
|---|--:|
| 검사 범위 | 전체 396세트 |
| 🔴 **형광펜 0개 세트** | **2** (LIVE 0) |
| ⚠ 일부만 켜지는 세트 | 14 (LIVE 9) |
| 🔴 형광펜 0개 선지 | **9** |

## 🔴 형광펜이 한 개도 안 켜지는 선지를 가진 세트

| 회차 | 세트 | 노출 | ⓐ 전부 비-하이라이트 | ⓑ 없는 문장 참조 |
|---|---|---|---|---|
| 2015수능B | `l2015bB` | — | 8건 | — |
| 2020_9월 | `l20209d` | — | 1건 | — |

> ⚠ 이 축은 **cs_ids 가 있는 선지**만 본다. cs_ids 가 아예 빈 선지는
> `release_diag` ①축(근거 누락)·`quality_gate` release_ready 가 본다.
> 비-하이라이트 sentType: footnote · author · omission · workTag · image · figure (src/PassagePanel.jsx 확인)
