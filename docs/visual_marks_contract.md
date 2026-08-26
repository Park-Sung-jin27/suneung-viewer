# `visual_marks.json` 용도 계약 — 동결

> 확정: 2026-08-25 (발주 D-113 ②)
> **이 파일은 감사·이관 이력 산출물이다. 화면 렌더와 무관하다.**

## 무엇이 바뀌었나

F-25 2단계(`15b95f4`, 2026-08-25)로 `src/PassagePanel.jsx` 가
**bracket 렌더 원천을 `annotations.json` 하나로 단일화**했다.
그 전까지는 `visual_marks.json` 의 bracket 을 함께 합쳐 `label|from|to` 로
dedup 했고, `getBracketInfo` 가 첫 매치에서 반환하는 탓에 **vm 값이 ann 값을 덮는**
사고가 있었다(`l20259a` [A] — ann `s6~s12` 인데 화면은 vm `s2~s4` 를 그렸다).

지금은 vm 이 화면에 닿지 않는다.

## 계약

1. **렌더 무관.** `visual_marks.json` 은 화면에 아무 영향이 없다.
   렌더 관련 판단·집계는 `annotations.json` 만 본다.
2. **동결.** 새 마커를 vm 에 만들지 않는다. 정박·수리는 `annotations.json` 에 쓴다
   (`pipeline/bracket_anchor_write.mjs` 가 이 규칙을 강제한다).
3. **기존 값은 유지한다.** 감사 이력(`status`·`release_block`·`audit_source`·
   `referenced_in`·`source: migrated_from_annotations`)이 담겨 있어, 어떤 판단을
   거쳐 지금 값이 됐는지 되짚는 데 쓰인다. **삭제는 별도 판정 사항이다.**
4. `bracket` 외 타입(`inline_label` 등)도 렌더러가 쓰지 않는다 —
   `src/` 전체에서 `inline_label` 은 주석 한 줄(`dataLoader.js:511`)에만 나온다.

## 이 파일을 쓰는 곳 (D-113 ② 조사)

| 파일 | 무엇을 하나 | 조치 |
|---|---|---|
| `src/dataLoader.js` `_loadVm` · `_attachVisualMarks` | 읽어서 `set.visualMarks` 에 주입 | 주입은 남아 있으나 `PassagePanel` 이 더는 bracket 을 꺼내 쓰지 않는다 — **프론트 판정 사항** |
| `pipeline/bracket_anchor_write.mjs` | 같은 라벨의 bracket 이 vm 에 **있을 때만** 동일 값으로 동기화. 없으면 만들지 않는다 | 유지 — 두 파일이 어긋나 생긴 사고를 막는 안전장치다 |
| `pipeline/sentence_split.mjs` | 문장 분리 시 vm 의 `sentIds` 도 함께 이관 | 유지 — 이력의 정합을 지킨다 |
| `pipeline/bracket_effective_dump.mjs` | ann ↔ vm 차이를 대조해 보고 | 유지 — 감사 목적에 부합 |
| `pipeline/bracket_ledger.mjs` · `bracket_render_table.mjs` · `marker_gap_recount.mjs` | (D-112 까지) 화면 원천으로 vm 을 합산 | 🔧 **`ecc4098` 에서 제거** — ann 단일 원천으로 정합 |
| `pipeline/bracket_map_v2.py` · `bracket_autoscan.py` | 화면값 표시용으로 vm 참조 | 판독 도구의 참고 표시일 뿐 판정에 쓰지 않는다 |

**갱신 단계(쓰기)는 위 두 파이프라인 도구(`bracket_anchor_write` · `sentence_split`)뿐이고,
둘 다 「ann 에 쓸 때 vm 에 같은 라벨이 이미 있으면 맞춰 준다」는 동기화 목적이다.**
새로 만들지는 않는다. 제거 여부는 다음 판정에 따른다.
