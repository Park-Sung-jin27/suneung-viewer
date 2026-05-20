# Sent Split Contract — Pipeline v2

> 갱신: 2026-05-20
> 도구: `pipeline/step2_postprocess_vNext.mjs` (sent_split_migration)
> 데이터: `public/data/all_data_204.json`

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
