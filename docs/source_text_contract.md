# Source Text Contract — Pipeline v2

> 갱신: 2026-05-20
> 도구: `pipeline/bracket_audit.mjs` (SOURCE\_\*) + `pipeline/step2_postprocess_vNext.mjs`
> 데이터: `public/data/all_data_204.json` 안 sents[].t

---

## 1. 목적

본 contract = **source text (sent.t)** 안 정합 사양 단일 단독 정의 path.
모든 viewer 시각화 + bracket annotation + cs_ids 사양 안 본 source text 안 의존 path.

---

## 2. sent.t 정합 사양

### 필드 정합

```json
{
  "id": "string", // 유니크 sentId
  "t": "string", // 본문 text (단일 line 또는 multi-line)
  "sentType": "string" // body | verse | workTag | author | footnote | omission | figure | undefined
}
```

### sentType 분류

| sentType | 사양                                | 사례                              |
| -------- | ----------------------------------- | --------------------------------- |
| body     | 산문 본문                           | "단순 관점에 따르면..."           |
| verse    | 시 본문 (단일 line 또는 multi-line) | "이런들 어떠하며 저런들 어떠하료" |
| workTag  | 작품 구분 / 영역 시작·종료 마커     | "(가)" / "<제1수>" / "[A]"        |
| author   | 작가 cite                           | "- 정훈, 「탄궁가」-"             |
| footnote | 주석                                | "\*사관: 임금의 ..."              |
| omission | 생략 표시                           | "(중략)"                          |
| figure   | 그림/도식                           | (이미지 reference)                |

---

## 3. 영구 lock 사양

### Lock S1 — sent.t 안 잘못된 문자 사양 금지

- 잘못된 character: 예 trailing `ㄱ` (Phase 1.25 검출 사양 정합)
- 잘못된 quote: ASCII `'` (U+0027) 대신 curly `'` (U+2018) 사용 path 의무
- 잘못된 bracket: `'` 대신 「 (U+300C) 사용 path 의무 (작품 인용)
- 자동 검출: bracket_audit `SOURCE_TEXT_DEFECT` family

### Lock S2 — inline marker 안 본문 prefix 사양 금지

- bracket 영역 시작 마커 (`[A]` 등) = workTag 단독 path
- body/verse sent.t 안 `[A] ` prefix path 금지 (Phase 1.28 검출 사양 정합)
- 자동 검출: bracket_audit `INLINE_PREFIX_DEFECT` 사양 path

### Lock S3 — multi-line verse sent.t 안 line count <= 5

- 단일 verse sent.t 안 `\n` 사양 안 line count > 5 path = sent break 의무 path 잠재
- 검출: SOURCE_VERSE_LINE_OVERFLOW (Phase 1.24 정합)
- 정정: sent split 사양 사후 새 sentId path

### Lock S4 — sentType 정합 의무

- 본문 sent = body/verse 단독 path
- 작품 구분 / 영역 마커 = workTag 단독 path
- undefined sentType path = 결함 path (별도 정정 의무)

---

## 4. 자동 검출 path

## 각주 기호 `*` — 본문 표기다 (D-126 ④ 채택)

각주 기호 `*` 는 **원본 지면의 조판 표기**다. 다음 자리에서만 쓴다.

| 자리 | `*` | 예 |
|---|---|---|
| 본문 `sents[].t` — 낱말 뒤 | **쓴다** | `대인과 진진지연*을 깊이 맺었더니` |
| 각주 문장 `sentType: footnote` — 낱말 앞 | **쓴다** | `*진진지연(秦晉之緣): 혼인의 인연.` |
| 해설 `analysis` 안 인용 | **쓰지 않는다** | `「진진지연을 깊이 맺었더니」` |
| 선지 `choices[].t` | 원본을 따른다 | 원본 선지에 `*` 가 있으면 쓴다 |

해설이 본문을 인용할 때 `*` 를 빼는 이유는, 그것이 낱말의 일부가 아니라 **지면에서 각주로
내려보내는 기호**이기 때문이다. 해설은 뜻을 다루지 조판을 다루지 않는다.

`cs_spans[].text` 는 다르다 — 형광펜이 본문 문자열과 **글자 그대로** 맞아야 하므로,
본문에 `*` 가 있으면 span 에도 있어야 한다. `sent_text_fix.mjs` 가 본문을 고칠 때 함께 맞춘다.

### 짝 검사

본문에 `*` 가 있으면 그 세트에 `footnote` 문장이 있어야 하고, 그 반대도 성립해야 한다.
`release_diag.mjs` ⑥ 축이 이 짝을 센다. 한쪽만 있으면 원본 대조 대상이다 —
`l20256a` s2 「진진지연」이 본문 쪽 `*` 를 잃은 채 각주만 남아 있던 것이 이 검사로 잡혔다
(원본 6면 y 1053.1 대조로 확정, D-125 ②).

---

### bracket*audit.mjs SOURCE*\* family

| code                             | severity | 검출 사양                                      |
| -------------------------------- | -------- | ---------------------------------------------- |
| SOURCE_VERSE_LINE_OVERFLOW       | WARNING  | verse sent.t 안 line > 5                       |
| SOURCE_BODY_MARKER_MISSING       | CRITICAL | bracket annotation 안 body 안 [X] 부재         |
| SOURCE_WORKTAG_POSITION_MISMATCH | CRITICAL | workTag [X] 위치 ↔ bracket range path mismatch |
| SOURCE_INLINE_OUT_OF_RANGE       | WARNING  | body 안 inline [X] 사양 안 bracket range 외    |

---

## 5. dry-run 검증 path

step2_postprocess_vNext 사양 안 detect-only mode:

```bash
node pipeline/step2_postprocess_vNext.mjs --dry-run
```

출력:

- `proposed_source_fixes`: typo / wrong character / inline prefix 결함 정합 path 안 정정안
- `unsafe_cases`: 자동 결정 불가 path (needs_human)

---

## 6. release 차단 lock

CRITICAL severity 안 SOURCE\_\* 검출 시 release 차단 path 의무 (LOCK V2 + 본 contract 통합).
