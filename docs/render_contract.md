# Render Contract — Pipeline v2

> 갱신: 2026-05-20
> 도구: `pipeline/visual_audit.mjs` (RENDER\_\*)
> 영역: viewer DOM 사양 (Code A 영역)

---

## 1. 목적

본 contract = **viewer DOM** 안 시각화 정합 사양 단일 단독 정의 path. visual_marks.json 안 source of truth 사양 사후 DOM render 정합 path 검증 의무.

---

## 2. 시각화 사양 path

### bracket 렌더 path

| 사양        | 의무 path                                                                     |
| ----------- | ----------------------------------------------------------------------------- |
| 컨테이너    | borderLeft style 존재 + 단일 컨테이너 path (연속 영역 단독)                   |
| 라벨        | `[X]` 우측 상단 또는 좌측 path 단독 노출 (위치 정합 path Code A 결정)         |
| 영역 범위   | bracket sentFrom~sentTo 안 sent 사양 안 단독 path                             |
| 본문 inline | body/verse sent.t 안 `[X]` 텍스트 path 안 hide path 정합 (DOM 안 노출 X path) |

### underline / box 렌더 path

- text_span 안 underline / box 스타일 적용 path
- target sent 안 `text` substring exact match path

### workTag hide path

- sentType=workTag 안 `[X]` / `(가)` 등 content path = render 안 노출 X path 정합
- 단 `[X]` workTag 안 bracket 라벨 path 단독 사용 (영역 시작/종료 마커 path)

---

## 3. 영구 lock 사양

### Lock R1 — DOM 안 bracket 컨테이너 단일 path

bracket annotation 사양 안 viewer DOM 안 단일 컨테이너 (`borderLeft` 사양) 정합 path 의무.

자동 검출: visual_audit `RENDER_NO_BRACKET_DOM` / `RENDER_MISSING_BORDER_LEFT` (WARNING)

### Lock R2 — 라벨 [X] 안 DOM 중복 노출 금지

동일 라벨 [X] 안 viewer DOM 안 1회 단독 노출 path 의무.
2회 이상 노출 시 WARNING 검출 (중복 의심 path).

자동 검출: visual_audit `RENDER_LABEL_DUPLICATE` (WARNING)

### Lock R3 — 본문 inline 마커 안 DOM hide 정합

body/verse sent.t 안 `[X]` inline path = viewer DOM 안 hide path 정합 의무.
DOM 안 본문 영역 안 `[X]` 노출 시 결함 path (Code A render logic 사양 결함 의심).

자동 검출: visual_audit `RENDER_WORKTAG_BODY_EXPOSURE` (WARNING)

### Lock R4 — visual_marks ↔ DOM 동기 path

`public/data/visual_marks.json` 안 entry 사양 안 viewer DOM 안 정합 path 의무.
mixed_commit=true 사양 path 안 동기 보장 X path (LOCK V3 통합).

---

## 4. 자동 검출 path (visual_audit.mjs)

### 사전 준비

```bash
npm install --save-dev playwright
npx playwright install chromium
npm run dev   # 또는 배포 URL 사용
```

### 실행

```bash
node pipeline/visual_audit.mjs                              # 39 release set
node pipeline/visual_audit.mjs --url=http://localhost:5173   # URL 지정
node pipeline/visual_audit.mjs --set=l2022a                  # 특정 set
```

### 출력

- `out/visual_audit/{yearKey}_{setId}.png` — screenshot per set
- `out/visual_audit_report.json` — PASS/WARNING/FAIL/ERROR per set

---

## 5. 통합 path (Pipeline v2)

```
source (sent.t)        → source_text_contract
   ↓
annotations (sentId)   → annotation_reference_contract
   ↓
visual_marks (통합)    → visual_marks_contract (Lock V1)
   ↓
viewer DOM (render)    → render_contract (본 문서)
   ↓
visual_audit (검증)    → RENDER_* family
```

end-to-end audit chain 정합 path.

---

## 6. release 차단 lock 통합

| layer        | 차단 사양                                                        |
| ------------ | ---------------------------------------------------------------- |
| SOURCE       | bracket*audit SOURCE*\* CRITICAL → release 차단                  |
| ANNOTATION   | bracket*audit ANNOTATION*\* CRITICAL → release 차단              |
| VISUAL_MARKS | Lock V2 (release_block=true + status≠verified) → 차단            |
| RENDER       | visual_audit FAIL → release 차단 (CI 통합 잠재 path — 별도 회기) |

---

## 7. CI 통합 path (별도 회기 사양)

- pre-release: visual_audit 안 39 release set 전체 PASS 의무
- mixed_commit=true 시 release 판단 X (LOCK V3 정합)
- 향후 Playwright Test 통합 path 잠재
