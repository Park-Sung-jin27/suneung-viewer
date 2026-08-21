# 코덱스 위임 — 하는 법 (5줄)

1. 회차 폴더를 연다 (예: `docs/delegation/2016_6월B/`).
2. 코덱스 채팅에 **`INSTRUCTIONS.md` → `SCHEMA.md` → `source_layout.txt` → `source_raw.txt`** 네 파일을 순서대로 붙여넣는다.
3. 코덱스가 준 JSON 을 `pipeline/reextract/<회차>_literature.json` 으로 저장한다 (UTF-8, 코드블록·설명 없이 JSON 만).
4. 검수를 돌린다: `node pipeline/delegation_verify.mjs <회차>`
5. **✅ 병합 후보** 가 뜨면 끝. **🔴 병합 불가** 면 화면에 나온 「코덱스에 보낼 문구」를 그대로 복사해 코덱스에 보내고 3번으로 돌아간다.

---

## 알아 둘 것

- 검수는 4가지를 본다: **스키마 · 지문↔문항 짝 · 원본 대조 · 문항 빠짐**. 넷 다 통과해야 병합 후보다.
- **해설과 정답은 코덱스에 맡기지 않는다.** 지시문에 「`ok`·`pat`·`analysis`·`cs_ids` 를 채우지 말라」고 적혀 있고, 검수기가 그 필드가 있으면 실패로 잡는다. 정답·해설은 다음 단계(step3)가 만든다.
- 병합은 검수 통과 뒤 **별도 발주**로 한다. 이 단계에서 `all_data_204.json` 을 건드리지 않는다.
- 새 세트는 처음에 **비노출**로 들어간다. 화면 공개는 대표 승인 사항이다.

## 회차 목록 (노출 회차 우선)

`docs/delegation/` 아래 19개 폴더. 각 폴더의 `INSTRUCTIONS.md` 첫 표에 그 회차에서
뽑을 세트 구간과 문항 번호가 적혀 있다. 목록과 규모는
[`docs/missing_scope_20260821.md`](../missing_scope_20260821.md) 참조.
