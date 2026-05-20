# Visual Marks Contract — Phase 1

> 갱신: 2026-05-20
> 도구: `pipeline/visual_mark_extractor.mjs` + `pipeline/visual_marks_schema.json`
> 데이터: `public/data/visual_marks.json` (자동 생성 — 본 contract 사양 안 단일 진실)

---

## 1. 목적

본 contract = bracket / underline / box / inline_label 사양 안 시각 표지 안 **단일 source of truth** 정의 path.

### 사양 분리 lock 정합

| layer                            | 단독 진실                         | 도구                          |
| -------------------------------- | --------------------------------- | ----------------------------- |
| source (all_data 본문 marker)    | sent.t 안 [X] / workTag           | bracket*audit SOURCE*\*       |
| annotation (sentId 영역 매핑)    | annotations.json bracket entries  | bracket*audit ANNOTATION*\*   |
| **visual_marks (통합 contract)** | **public/data/visual_marks.json** | **visual_mark_extractor.mjs** |
| render (DOM 시각화)              | viewer DOM                        | visual*audit RENDER*\*        |

visual_marks = source + annotation 정합 통합 path 안 release 판단 단일 단독 path.

---

## 2. schema (`visual_marks_schema.json` 정합)

각 entry = 단일 시각 표지 path:

```json
{
  "id": "vm_<unique_id>",
  "yearKey": "2024수능",
  "setId": "l2024a",
  "type": "bracket | underline | box | inline_label",
  "label": "A",
  "target": "sent_range | text_span",
  "sentIds": ["l2024_18_21s7", "l2024_18_21s8"],
  "start": { "sentId": "l2024_18_21s7", "offset": 0 },
  "end": { "sentId": "l2024_18_21s8", "offset": 12 },
  "source": "auto_text_parser | manual | migrated_from_annotations",
  "status": "verified | needs_human | broken | non_blocking",
  "release_block": true,
  "audit_source": "ANNOTATION_BRACKET / SOURCE_INLINE / ..."
}
```

### 필수 필드

- `id`: 유니크 식별자 (vm*{yearKey}*{setId}_{type}_{label}\_{counter} path)
- `yearKey` + `setId`: 위치 단독
- `type`: 사양 분류 (bracket/underline/box/inline_label)
- `source`: 도입 path (auto_text_parser / manual / migrated_from_annotations)
- `status`: 검증 상태
- `release_block`: release 영향 여부 (true 시 release 차단 의무)

### target 사양

| target     | 사용 case                            | start/end 정합 |
| ---------- | ------------------------------------ | -------------- |
| sent_range | bracket (영역 단위)                  | sent 단위 단독 |
| text_span  | inline_label / underline (단어/어구) | offset 사양 안 |

---

## 3. status 안 4 path

| status       | 의미                                    | release_block                 |
| ------------ | --------------------------------------- | ----------------------------- |
| verified     | source + annotation + 참조 모두 정합    | true / false (참조 path 정합) |
| needs_human  | bracket_audit 안 결함 검출              | true (검수 사후 결정)         |
| broken       | sentId DEAD / 위치 불일치               | true (즉시 정정 의무)         |
| non_blocking | 본문 marker 사양 안 문항/선지 참조 부재 | false (release 영향 부재)     |

### release_block=true 사양 lock

release 39 set 안 visual_marks 안 `release_block=true` + `status != verified` 검출 시 release 차단 의무 (lock).

---

## 4. extractor logic 단독 path

### Step 1: source 자동 추출 (auto_text_parser)

```
for each set in all_data:
  for each sent:
    if sentType == "workTag" and sent.t matches /^\[([A-F])\]$/:
      bracket [X] → 직전 verse 연속 안 sent_range 사양
      type=bracket, source=auto_text_parser
    elif sentType in ["body","verse"] and sent.t contains "[X]" (substring):
      inline_label [X] → text_span 사양 (offset 사양 안)
      type=inline_label, source=auto_text_parser
```

### Step 2: annotation 마이그레이션 (migrated_from_annotations)

```
for each bracket in annotations.json:
  bracket [label] sentFrom~sentTo → visual_mark sent_range 사양
  type=bracket, source=migrated_from_annotations
for each underline / box in annotations.json:
  underline {sentId, text} → visual_mark text_span 사양
  box {sentId, text} → visual_mark text_span 사양
```

### Step 3: 문항/선지 cross-reference

```
for each visual_mark with type in ["bracket","inline_label"]:
  scan questions[*].t + choices[*].t + choices[*].analysis for "[X]" 사양
  if found: release_block=true
  else: release_block=false, status=non_blocking
```

### Step 4: bracket_audit cross-check

```
import { auditBrackets } from './bracket_audit.mjs';
findings = auditBrackets(data, annotations);
for each finding mapped to visual_mark:
  if finding.severity == "CRITICAL": visual_mark.status = "broken" or "needs_human"
  if finding.severity == "WARNING": visual_mark.status = "needs_human"
  visual_mark.audit_source = finding.code (e.g., "ANNOTATION_BRACKET_BODY_MARKER_MISSING")
```

---

## 5. 영구 lock 사양

### Lock V1 — visual_marks single source of truth

release 39 set 안 visual_marks.json 단독 release 판단 path. annotations.json + all_data 본문 marker = source 단독, visual_marks 사양 안 통합 판단.

### Lock V2 — release_block=true + status≠verified 차단

release 사양 안 위 조건 검출 시 release 차단 의무 lock.

### Lock V3 — mixed_commit 차단

visual_marks 생성 시점 = 본 audit_commit. data_commit + annotation_commit ≠ audit_commit 시 mixed_commit=true 출력 + release 판단 차단 의무 (visual_audit + bracket_audit 동일 사양 path 정합).

### Lock V4 — manual entry append-only

사용자 manual entry (source=manual) 사양 사후 — auto-regenerate 시 manual entries 정합 path 유지 의무 (overwrite X).

---

## 6. 사양 워크플로 정합

```
1. 자동 추출:
   node pipeline/visual_mark_extractor.mjs
   → public/data/visual_marks.json 생성
   → pipeline/visual_marks_report.json 검수 raw 생성

2. 검수 path:
   - status=broken / needs_human 사양 안 사용자 검토 의무
   - manual fix 사양 안 source=manual 마킹

3. release 판단:
   - release_block=true + status==verified path 단독 release 가능
   - 외 path 안 release 차단 의무 (lock V2)

4. CI 통합 잠재:
   quality_gate 안 visual_marks 사양 import + lock V2/V3 검증 path (별도 회기)
```

---

## 7. 후속 path (별도 회기)

- Phase 2: viewer rendering 안 visual_marks.json 직접 read path (annotations.json 사양 사후)
- Phase 3: quality_gate 안 visual_marks lock 통합
- Phase 4: visual_audit 안 visual_marks 정합 검증 (RENDER vs DATA 동기)
