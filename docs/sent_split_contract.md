# Sent Split Contract — Pipeline v2

> 갱신: 2026-05-20
> 도구: `pipeline/step2_postprocess_vNext.mjs` (sent_split_migration)
> 데이터: `data-source/all_data_204.json`

---

## 1. 목적

본 contract = **sent split (단일 sent 안 다중 sent 분리)** 사양 안 정합 path + migration plan 자동 생성 사양 정의.

배경: verse sent 안 multi-line 통합 path 안 bracket annotation 안 sub-sent 사양 granularity 의무 시 split path 필수 (Phase 1.24 안 l2024_32_34s4 split 사례 정합).

---

## 2. split 사양 path

### 트리거 조건

1. `SOURCE_VERSE_LINE_OVERFLOW` 검출 (verse sent.t 안 line > 5)
2. 사용자 PDF cross-check 안 sub-sent 단위 bracket 의무 path
3. 사용자 명시 결정 (manual trigger)

### split 단위

verse sent.t 안 `\n` 기준 line-by-line split path:

```
old: l2024_32_34s4 (17 lines)
new: l2024_32_34s4_1 ~ l2024_32_34s4_17 (17 sents)
```

### sentId 네이밍 path

```
{originalId}_{lineNumber}
```

예: `l2024_32_34s4` → `l2024_32_34s4_1`, `l2024_32_34s4_2`, ...

---

## 3. migration plan 자동 생성

```json
{
  "oldSentId": "l2024_32_34s4",
  "newSentIds": ["l2024_32_34s4_1", ..., "l2024_32_34s4_17"],
  "mapping": [
    { "oldOffset": 0, "newSentId": "l2024_32_34s4_1", "newOffset": 0 },
    ...
  ],
  "affected": {
    "annotations": ["bracket [B]", "bracket [C]"],
    "cs_ids": [
      { "qId": 32, "choiceNum": 1, "old": "l2024_32_34s4" }
    ],
    "cs_spans": [],
    "visual_marks": []
  },
  "safeToApply": true | false
}
```

### safeToApply 판정 path

| 조건                                                          | safeToApply |
| ------------------------------------------------------------- | ----------- |
| 모든 affected reference 안 explicit mapping 정합 path         | **true**    |
| cs_ids 안 ambiguous mapping (어떤 sub-sent 안 매핑 path 불명) | **false**   |
| annotations bracket 안 sub-sent range 사용자 명시 path        | **true**    |
| annotations bracket 안 range 사양 사용자 미명시 path          | **false**   |

### safeToApply=false 사양 안 자동 적용 금지 lock

dry-run 안 unsafe_cases 안 출력 단독 path. 사용자 명시 PDF cross-check 사후 직접 매핑 사양 의무 path.

---

## 4. affected reference 정합 path

### annotations bracket

- 기존 bracket [X] sentFrom/sentTo 안 oldSentId 사양 path → 사용자 사양 안 새 sub-sent ID path 매핑
- 매핑 사양 미수신 시 safeToApply=false

### cs_ids

- 기존 `oldSentId` 사양 path → 사양 옵션:
  - 옵션 A: 모든 17 sub-sent ID 안 일괄 확장 (verbose, 정합 path 단독 자동 적용 가능)
  - 옵션 B: 사용자 명시 안 특정 sub-sent path (정밀, 의무 path manual)
  - 본 contract 정합 path = 옵션 A 단독 자동 적용 가능 / 옵션 B 사양 시 safeToApply=false

### cs_spans

- 기존 `{sent_id, text}` 사양 path → text substring 검출 사양 안 sub-sent 자동 매핑
  - text 안 단일 sub-sent 안 정합 path → safeToApply=true
  - text 안 다중 sub-sent 안 cross path → safeToApply=false

### visual_marks

- 자동 재생성 path (extractor 사양 안)
- 별도 의무 path 부재

---

## 5. 영구 lock 사양

### Lock SP1 — sent split 사후 oldSentId 복원 금지

split 사양 사후 oldSentId 안 sent 부재 path 정합. 외 외 path 안 reference path = DEAD_csid 검출 path.

### Lock SP2 — safeToApply=false 자동 적용 금지

dry-run 안 unsafe_cases 출력 단독. 사용자 명시 path 사후 manual apply 의무.

### Lock SP3 — migration plan 사양 안 commit 안 통합 path

sent split commit 안 migration plan 사양 안 commit message 안 명시 path. 향후 audit 안 추적 path 정합.

---

## 6. dry-run 검증 path

```bash
node pipeline/step2_postprocess_vNext.mjs --dry-run --target=l2024d --sent=l2024_32_34s4
```

출력:

- proposed_sent_split: { oldSentId, newSentIds, mapping, affected, safeToApply }
- unsafe_cases (safeToApply=false 시)

---

## 7. 사례 (Phase 1.24 정합)

l2024d s4 split 적용 path:

- 17 sub-sents (s4_1 ~ s4_17)
- cs_ids 7 refs 안 옵션 A path (17 sub-sent 일괄 확장)
- annotations [B]: s4_1 ~ s4_6 / [C]: s4_11 ~ s4_15 (사용자 explicit mapping)
- safeToApply: true ✓

---

## 신규 추출 세트의 문장 분할 규약 (D-139 ① · 2026-08-28 확정)

**2026-08-28 이후 신규 추출 세트는 새 분할 규약을 따른다. 기존 세트는 재분할하지 않는다.
`cs_ids` 는 세트 내부 참조이므로 공존해도 정합성 문제가 없다.**

### 규칙

| 대상 | 처리 |
|---|---|
| 독서(reading)의 `body` | 문장 단위로 재분할 (`step2_postprocess.resplitProse`) |
| 문학(literature) 전체 | **재분할하지 않는다** — 실측상 이미 문장 단위다 |
| `verse` | 어느 영역에서도 건드리지 않는다 — 행이 곧 의미 단위다 |
| `workTag`·`author`·`footnote`·`omission` | 그대로 둔다 |

종결 판정은 기존 독서 `body` 4,507문장 실측에서 나왔다 —
종결부호 직전 글자가 `다:4412 자:46 까:25 가:9 라:9` 로 이 **5종이 99.9%**다.
인용부호 안에서는 자르지 않는다(여닫이 깊이 추적).

### 기존 세트와의 차이 26건 — 수용한다

회귀 검증에서 독서 191세트 중 165세트가 그대로 유지됐고 26세트가 달라졌다.
대부분 **기존 데이터 쪽이 덜 나뉜 자리**다(예: `…들어 보자.이성적 동물은…`).
그것까지 재현하려면 잘못된 분할을 흉내 내야 하므로 수용한다.

- **규칙을 더 넓히지 않는다** — 넓힐수록 문장 중간에서 잘린다(1차 시도 실증).
- **기존 세트 재분할은 영구 금지** — `cs_ids`·`cs_spans` 가 문장 id 를 가리켜 형광펜이 통째로 어긋난다.
- 인용 안 종결 정교화는 백로그(9/3 이후).

### 🔴 `resplitProse` 는 독서 전용 — 운문·극문학에 적용 금지 (D-147 ③ · 2026-08-29 추가)

**`resplitProse` 를 운문(`verse`)·극문학(`stage`/`speech`)에 돌리면 글자가 조용히 사라진다.**

D-146 에서 `2019수능::r2019b` 의 (나) 「오발탄」 시나리오 1,228자를 두 방식으로 나눠 재어 봤다.

| | S-11 산문 분할 | §13⑧ 극문학 분할 |
|---|--:|--:|
| 원본 글자 보존 | **1,166 / 1,228자 — 62자 유실** 🔴 | 1,228 / 1,228자 ✅ |
| 장면 번호 `#68`~`#75` 독립 문장 | 2 / 8 🔴 | 8 / 8 ✅ |

**왜 사라지나** — `resplitProse` 는 줄을 이어 붙인 뒤 **종결어미(`다자까가라`) + 종결부호**로만 자른다.
시나리오·시는 그렇게 안 끝나는 줄이 많다(`#70. 산비탈` · `철호 : 용기?` · 시행).
경계를 못 찾으면 조각이 뭉개지거나 통째로 남는다. **오류를 내지 않고 조용히 틀린다.**

**규칙**

1. `resplitProse` 호출은 `if (sec === "reading")` 안에서만 한다. 구현이 이미 그렇게 막혀 있으니 **풀지 않는다.**
2. 극문학 지문은 §13⑧ 표준(`stage` 지시문 / `speech` 화자 대사)으로 줄 단위 구성한다.
   새 문장이 시작되는 자리는 셋뿐이다 — **장면 번호 · 화자 표지 · `(중략)`**. 나머지 줄은 앞줄에 잇는다.
3. 어떤 분할이든 적용 전에 **공백 제외 글자 수를 원본과 대조**한다. 한 글자라도 다르면 멈춘다.
   (`pipeline/r2019b_na_dryrun.mjs` 의 「손실 검산」 절이 그 형태다)

### 🟡 예외 — 문단이 통째로 한 문장인 세트 (D-163 ③ · 2026-08-30 확정)

**문단이 통째로 한 문장으로 들어온 세트는 재분할할 수 있다.**
단 아래 두 가지를 지킨다.

1. **재분할과 `cs_ids` 재정박을 반드시 한 커밋에 함께 한다.**
2. **`id` 를 첫 조각에 남기는 방식으로 넘어가지 않는다.**
   id 만 보존하면 `cs_ids` 가 끊기지는 않지만, **원래 가리키던 대목이 첫 조각에
   있다는 보장이 없다.** 형광펜이 엉뚱한 문장에 켜져도 되읽기 검산은 통과한다
   (문장이 실재하기만 하면 되므로). **조용히 틀리는 길이라 쓰지 않는다.**

> ⚠ 폐기된 규칙 — 「재분할 대상을 `cs_ids` 비어 있음으로 한정한다」
> `l20199e` 를 그 기준으로 보려 했으나 실측이 **20선지 중 14개(70%) 보유**였다.
> 「어긋날 것이 없는 세트」라는 전제 자체가 성립하지 않았다(D-161 ①).

**왜 필요한가** — `l20199e` 의 `s3` 는 471자 한 문장이고, Q44#1 과 Q44#2 가 **둘 다 그 하나**를
근거로 가리킨다. 화면에서 두 선지가 같은 471자를 통째로 칠한다.
「선지에 근거 문장을 1:1 로 연결」이라는 핵심 차별점이 사실상 죽은 상태다.

