# Annotation Reference Contract — Pipeline v2

> 갱신: 2026-05-20
> 도구: `pipeline/bracket_audit.mjs` (ANNOTATION\_\*) + `pipeline/visual_mark_extractor.mjs`
> 데이터: `public/data/annotations.json`

---

## 1. 목적

본 contract = **annotations.json** 안 bracket / underline / box / marker 사양 안 sentId reference 정합 사양 단일 단독 정의 path.

---

## 2. annotation entry schema

### 공통 필드

```json
{
  "type": "bracket | underline | box | marker",
  "sentId" 또는 "sentFrom"/"sentTo": "...",
  "text" 또는 "label" 또는 "marker": "...",
}
```

### type별 사양

| type      | 필수 필드                     | 사양 path                                 |
| --------- | ----------------------------- | ----------------------------------------- |
| bracket   | type, label, sentFrom, sentTo | sent_range 단위 영역 표지                 |
| underline | type, sentId, text            | text_span 단위 단어/어구 강조             |
| box       | type, sentId, text            | text_span 단위 박스 강조                  |
| marker    | type, marker, sentId, text    | 원문자 사양 (ⓐ/ⓑ/...) sent + text mapping |

---

## 3. 영구 lock 사양

### Lock A1 — sentId existence 의무

모든 annotation entry 안 `sentFrom` / `sentTo` / `sentId` 필드 = `all_data_204.json` 안 실 sentId path 의무.

자동 검출: bracket_audit `ANNOTATION_DEAD_SENTFROM` / `ANNOTATION_DEAD_SENTTO` (CRITICAL)

### Lock A2 — bracket sentFrom <= sentTo 사양

bracket entry 안 sentFrom 안 sentTo 사전 또는 동일 path 의무.
자동 검출: bracket_audit `ANNOTATION_INVERTED_RANGE` (CRITICAL)

### Lock A3 — bracket label 단독 사양

동일 setId 안 동일 label (`[A]`, `[B]`...) 단독 entry path 의무 (중복 금지).
extractor 안 dedup logic 정합 (Phase 1.25 정합).

### Lock A4 — bracket range 안 body/verse 사양 단독

bracket range 안 sent 사양 = body/verse 단독 path 권고.
workTag/author/footnote 등 사양 안 포함 시 WARNING 검출 (off-by-one 의심 path).
자동 검출: bracket_audit `ANNOTATION_NON_BODY_IN_RANGE` (WARNING)

### Lock A5 — bracket range size 사양

bracket range 안 sent 개수 > 30 path = outlier 검출 path 의무.
자동 검출: bracket_audit `ANNOTATION_RANGE_SIZE_OUTLIER` (WARNING)

---

## 4. 본문 ↔ annotation 정합 path

### bracket annotation ↔ body marker 정합

- bracket [X] annotation 안 body 안 [X] marker (workTag 또는 inline) 사양 정합 path 의무
- 부재 path 안 `SOURCE_BODY_MARKER_MISSING` 검출 (CRITICAL)

### underline / box annotation ↔ sent.t 정합

- underline / box entry 안 `text` field 사양 안 `sent.t.includes(text)` path 의무
- 부재 path 안 ANNOTATION_TEXT_NOT_FOUND 검출 path (별도 회기 사양 추가 path)

---

## 5. cross-reference 사양

### visual_marks 통합 path

- annotations.json bracket → visual_marks 안 `source: migrated_from_annotations`
- annotations.json underline/box → visual_marks 안 text_span 사양
- 통합 path 단일 source of truth: `public/data/visual_marks.json`

### cs_ids cross-check

- bracket annotation 사양 안 cs_ids 사양 안 일치 path 검증 path 의무 (별도 회기 — Phase 2 사양)
- 현재는 cs_ids 단독 정합 path

---

## 6. dry-run 검증 path

```bash
node pipeline/bracket_audit.mjs --year=2024수능
```

출력:

- ANNOTATION_DEAD_SENTFROM / DEAD_SENTTO (CRITICAL)
- ANNOTATION_INVERTED_RANGE (CRITICAL)
- ANNOTATION_NON_BODY_IN_RANGE (WARNING)
- ANNOTATION_RANGE_SIZE_OUTLIER (WARNING)

---

## 7. release 차단 lock

CRITICAL severity 안 ANNOTATION\_\* 검출 시 release 차단 의무 (LOCK V2 통합).
