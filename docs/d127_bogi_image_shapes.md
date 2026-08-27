# `bogi` 이미지 구조 전수 — F-36 방어 범위 참고 (D-127)

> **데이터는 손대지 않는다.** 심사관 판정(D-127): 구조 자체는 다른 LIVE 세트와 같은
> `{url, alt}` 관례이고, 프론트가 방어하는 쪽으로 간다.
> 이 문서는 F-36 이 막아야 할 변형이 몇 가지인지 세어 둔 것이다.

## 분포

`bogi` 가 객체인 문항 13건 중 `image` 를 가진 것이 12건이다.

| `type` | `image` | 건수 | 상태 |
|---|---|--:|---|
| `annotated_image` | 문자열 | 9 | LIVE 정상 |
| (`type` 없음) | 객체 `{url, alt}` | 2 | LIVE 정상 |
| **`annotated_image`** | **객체 `{url, alt}`** | **1** | 🔴 **`r20246c` — 렌더 크래시** |
| `diagram` | 없음 | 1 | — |

**`r20246c` 는 두 관례의 교차점에 홀로 있다.** `annotated_image` 분기가 `image` 를
문자열로 기대하는데 객체가 들어온다. 심사관 진단과 일치한다 `[Confirmed]`.

## 전체 목록

| 회차 | 세트 | 문항 | 노출 | `type` | `image` | `items` | `bogi` 키 |
|---|---|---|---|---|---|---|---|
| 2014_6월A | `r20146b` | Q21 | 🔴 | `annotated_image` | 문자열 | — | `image,text,type` |
| 2021수능 | `r2021c` | Q37 | 🔴 | `annotated_image` | 문자열 | — | `image,type` |
| 2022_6월 | `r20226b` | Q4 | 🔴 | `annotated_image` | 문자열 | — | `image,text,type` |
| 2022수능 | `r2022d` | Q16 | 🔴 | `annotated_image` | 문자열 | — | `image,text,type` |
| 2023_6월 | `r20236a` | Q2 | 🔴 | (없음) | 객체 | — | `image,text` |
| 2023_9월 | `r20239d` | Q16 | 🔴 | `annotated_image` | 문자열 | — | `image,text,type` |
| 2023수능 | `r2023d` | Q17 | 🔴 | `annotated_image` | 문자열 | — | **`alt,image,text,type,url`** |
| 2024_6월 | `r20246a` | Q3 | 🔴 | (없음) | 객체 | — | `image,text` |
| 2025수능 | `r2025a` | Q3 | 🔴 | `annotated_image` | 문자열 | — | `image,type` |
| 2026수능 | `r2026c` | Q12 | 🔴 | `annotated_image` | 문자열 | — | **`image,imagePosition,text,type`** |
| 2014수능B | `r2014cB` | Q27 | — | `annotated_image` | 문자열 | — | `image,text,type` |
| **2024_6월** | **`r20246c`** | **Q11** | — | `annotated_image` | **객체** | **4** | **`image,items,text,type`** |

## F-36 이 함께 보면 좋을 변형 셋

크래시는 `r20246c` 하나지만, 같은 분기에 들어오는 키 모양이 넷이다.

1. **`image` 가 객체 `{url, alt}`** — `r20246c`. 지금 터지는 자리다.
2. **`url`·`alt` 가 `bogi` 최상위에 평평하게** — `r2023d` Q17.
   `image` 는 따로 있고 `url`/`alt` 가 형제로 붙어 있다. 지금은 렌더되지만 어느 쪽을 읽는지 모호하다.
3. **`imagePosition` 키** — `r2026c` Q12. 이 세트만 쓴다.
4. **`items` 배열** — `r20246c` 뿐이다(4개). 그래프의 ⓐ~ⓓ 를 설명하는 항목인데
   `desc` 가 「그래프 점」 수준이라 화면에 내보낼 내용은 아니다.

`image` 를 읽을 때 **문자열이면 그대로, 객체면 `.url`** 로 받고, `alt` 는
`image.alt ?? bogi.alt ?? ""` 로 떨어뜨리면 네 변형이 한 번에 덮인다 `[Inference]`.

## 데이터 쪽 판정

**손대지 않는다.** `{url, alt}` 는 `r20236a`·`r20246a` 가 LIVE 로 쓰고 있는 관례이고,
`r20246c` 만 정규화하면 오히려 세 갈래가 되어 관례가 더 흩어진다.

`r20246c` 는 데이터·해설 게이트를 통과했고(D-126 ②) gate3 만 남았다 —
F-36 이 끝나면 화면 실측을 재개한다.
