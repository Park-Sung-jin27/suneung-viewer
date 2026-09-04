# 세트 식별 키 규약 — `(yearKey, setId)` 복합 키

> 확정: 2026-08-25 (발주 D-113 ①, 심사관 판정)
> **setId 는 전역 고유가 아니다. 연도 키 안에서만 고유하다.**

## 사실

`data-source/all_data_204.json` 기준 **setId 47종이 두 연도에 걸쳐 중복**된다
(전체 349종). 주로 2014·2015 A/B형처럼 같은 회차가 두 유형으로 갈린 해다.
중복된 id 는 **내용이 완전히 다른 별개의 세트**다.

```
l20146a  2014_6월A (27문장) "형님 온다 형님 온다 분고개로 형님 온다."
         2014_6월B ( 5문장) "(가) 성현의 경전을 읽고 자기를 돌이켜 보아서"
l20149a  2014_9월A (21문장) "상한 갈대라도 하늘 아래선"
         2014_9월B (17문장) "매영(梅影)이 부드친 창(窓)에 옥인금차(玉人金…"
r20146a  2014_6월A (19문장) / 2014_6월B (22문장)
… 47종
```

## 규약

1. **세트를 가리킬 때는 반드시 `(yearKey, setId)` 쌍을 쓴다.**
   문자열로 적을 때는 `yearKey::setId` 형식을 쓴다(`RELEASE_KEYS` 와 같은 형식).
2. **setId 리네임은 금지**한다. 전역 유일화를 위해 id 를 바꾸지 않는다
   (참조가 여러 파일·계층에 흩어져 있어 이관 비용과 사고 위험이 크다).
3. 데이터 파일의 조회 키는 **순수 `setId`** 다 — 연도로 이미 한 겹 갈라져 있기 때문이다.
   - `annotations.json` : `{ [yearKey]: { [setId]: [...] } }`
   - `visual_marks.json`: `marks[].yearKey` + `marks[].setId`
   따라서 코드에서 복합 키를 쓰더라도, **파일을 조회할 때는 순수 id 로 되돌려야 한다.**
4. 새 도구를 만들 때 `setId` 하나만 받아 전 연도를 훑고 **첫 매치를 쓰는 것을 금지**한다.
   중복이면 조용히 엉뚱한 세트를 잡는다. 중복일 때는 **멈추고 연도를 물어본다.**

## 적용 현황

| 도구 | 상태 |
|---|---|
| `bracket_ledger.mjs` · `bracket_render_table.mjs` · `marker_gap_recount.mjs` | ✅ 원래부터 `(yk, setId)` 순회 |
| `bracket_anchor_write.mjs` · `sentence_split.mjs` · `inline_marker_strip.mjs` · `bracket_patch.mjs` | ✅ SPEC 에 yearKey 포함 |
| `bracket_probe.py` | ✅ PDF 경로를 직접 받는다 — 세트 조회 없음 |
| `bracket_map_v2.py` · `bracket_autoscan.py` | 🔧 **D-113 에서 수정** — `연도::setId` 를 받고, 중복 id 를 연도 없이 부르면 멈춘다 |

```
$ python pipeline/bracket_map_v2.py l20146a
🔴 l20146a — 연도 2곳에 있다(2014_6월A, 2014_6월B). 「연도::l20146a」 형식으로 다시 부르십시오

$ python pipeline/bracket_map_v2.py "2014_6월A::l20146a"
## 2014_6월A l20146a · 화면값: [A] l20146as1~l20146as6 (ann)   벡터 → 같음 ✅
```

## 프론트 `bracket_effective_dump.mjs` 에 전달 — 경고 1건은 오탐

`pipeline/bracket_effective_dump.mjs:299` 가 세트의 소재를 `home[setId]` 로
**순수 id 하나**에 모은다. 그래서 같은 id 가 두 연도에 있으면 한쪽만 남고,
다른 쪽이 「연도 키 어긋남」으로 잘못 잡힌다.

```
연도 키가 어긋난 ann 브래킷 엔트리: 1
  ann["2014_6월A"]["l20146a"] — 이 세트는 2014_6월B 에 있다
```

**오탐이다.** `2014_6월A` 에도 `l20146a` 가 실재하며(27문장, 「형님 온다」),
그 `[A] s1~s6` 은 13면 꺾쇠 197.5/292.2 와 일치하고 화면 실측도 통과했다(D-111).

→ `home` 을 `` `${yk}::${setId}` `` 키로 바꾸면 경고가 사라진다.
   `free/` 는 노출분만 담으므로 비노출 세트는 지금처럼 판단 보류로 두면 된다.
