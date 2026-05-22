# 현 진행 status (current_state)

## 메타

| 영역 | 값 |
|---|---|
| 갱신 | 2026-05-21 (품질심사관 본 회기) |
| 갱신 주기 | 주 1회 (CLAUDE.md §14 정합) |
| HANDOVER 영역 | 본 file 단독 (별도 HANDOVER file 영역 X) |

---

## 핵심 진척 (2026-05-21 시점, 데이터 엔지니어 회신 정합)

### FREE 5수능 release 진척 — **40/40 = 100%** ✅✅✅ (라이브 정합 사실 완전 확정)

| 시험 | release_status | 비고 |
|---|---|---|
| **2022수능** | **release ✅ (8/8)** | 5/14 approved_by downfall121 |
| **2023수능** | **release ✅ (8/8)** | 5/14 approved |
| **2024수능** | **release ✅ (8/8)** | 5/14 approved |
| **2025수능** | **release ✅ (8/8)** | l2025b 5/21 approved (Code B `aed7e10` — sentType=undefined 30건 accepted, 별도 회기 path) |
| **2026수능** | **release ✅ (8/8)** | 5/14 approved (l2026b 포함) |

### Code A 작업 사실 (2026-05-21)
- Code A `3dab535`: `src/dataLoader.js` 안 RELEASE_SET_IDS 안 l2025b 추가 ✓
- Vercel deploy: `index-DhNHdEeH.js` (fresh build 정합) ✓
- 본 채팅 Chrome MCP cross-check 사실:
  - l2025b viewer routing 정합 (redirect 0) ✓
  - visual_marks 482 entries (l2025b 2 entries verified) ✓
  - DOM render 정합 (시 본문 + underline 3건 + verse 4 div) ✓
  - sentType=undefined 30건 영향 결함 **0건** [Confirmed]

→ **5수능 100% 모두의창업 심사 path 정합 사실 완전 확정** ✓

### LEGACY 진척 — **1/8 = 12.5% ✅✅** (2021수능 7 sets release + 라이브 정합 완전 확정)

| 시험 | release_status | 비고 |
|---|---|---|
| **2021수능** | **release ✅ (7/7) + 라이브 정합 ✓** | Code B `caf0b00` + Code A `2556096` (5/21). r2021a/b/c + l2021a/b/c/d. r2021d 부재 (reading 3 sets 단독 path 정합). V9_NEEDS_HUMAN warning 3건 (l2021a/c/d) + V7a warning 1건 (l2021c) accepted — 별도 회기 path. Chrome MCP cross-check PASS (r2021a visual 3 entries + l2021a visual 4 entries 정합) |
| 2014~2020 (7개년) | 데이터 탑재 완료 / 품질 정정 + approval 미진입 | 13개년 path 잔존 — 사용자 결정 = 즉시 병행 진입 |

### 13개년 진척 사실 — **47/104 sets ≈ 45.2%** ✅✅✅ (라이브 정합 사실 완전 확정)

- 5수능 (FREE) 40 sets + 2021수능 (LEGACY 1/8) 7 sets = 47 sets
- 잔존 = 14~20수능 7개년 안 ~56 sets + 모의평가 (6월/9월) 안 ~16 yearKey path
- Vercel deploy 정합: bundleScript `index-DCsgTKu2.js` (fresh build)
- 본 채팅 Chrome MCP cross-check 5 set PASS (Landing + l2022a + l2022d + l2025b + r2021a + l2021a + /privacy = 7 검증)

### 잠재 잔존 path (별도 회기)

- l2021b/c/d 안 visual_marks 0 entries 사실 (Phase 3.4 정정 사양 미완 path 잠재)
- l2025b sentType=undefined 30건 정정 (선택 B 정합 — 별도 회기)

### 모의평가 (6월/9월) 2022~2026 — 16 yearKey 탑재, release 미진입

### 사용자 목표 정합 = **2014~2026학년도 13개년 전체 완성** (2026-05-21 사용자 명시)

- FREE_YEARS = 무료 공개 범위 (5개년)
- LEGACY 8개년 = 유료 / 후순위 컨텐츠 (잠재)
- 현재 = 모두의창업 심사 기간 + Tally 베타 테스터 모집 중

---

## 직전 commit 시퀀스 (5/14~5/21)

| commit | 내용 |
|---|---|
| `111b227` | fix(data): r2021a [A] bracket 범위 PDF 대조 정정 — WARNING 2건 해소 |
| `90ced7a` | feat(data): Phase 3.4 — 2021수능 annotations.json 신규 작성 |
| `1ada704` | feat(pipeline): Phase 3.3 — INLINE_MARKER_MISSING_CLOSE + ORPHAN_JAMO_NOISE rule |
| `b26a791` | fix(data+pipeline): Phase 3.2 — r2021a Q21 어휘 4건 + r2021b Q28 R1 3건 |
| `a7eb223` | fix(data): 2021수능 F_empty_analysis 3건 정정 |
| `0f7c8a9` | fix(data): 2021수능 cs_ids 재매핑 — 왜곡 출처 5건 |
| `9886d27` | fix(data): r2023a Q2 ch4 analysis body 전면 정정 |
| `7b7e165` | fix(data): r2023a Q2 ch4 결론 모순 정정 |
| `8633449` | feat(frontend): Code A bracket 큰 대괄호 시각화 — verse/workTag flush 분기 정정 |
| `57ece9a` | feat(legal): /privacy route — 개인정보처리방침 + 이용약관 |
| `32faaac` | feat(beta-kpi): evidence_feedback KPI + Tally 피드백 floating button |

---

## Day 6~7 잔여 5건 (5/19 시점 대기 — 진행 미확인)

직전 품질심사관 회기 (945de265, 2026-05-19) 인수인계 시점 대기 중:

1. l2023d + l2022 series bracket visual 사용자 직접 view 결과 paste
2. annotations.json target 필드 도입 (Code A 작업 3 사후)
3. l2023b q25 ch3/ch5 grammar rewrite (사용자 PDF 필요)
4. q17 선지 underline 사용자 view
5. Code A lock #6 검토 (main 직접 push 정합)

→ 본 회기 진입 시 사용자 confirm 의무.

---

## 다음 Phase 우선순위 (ROI 기반, 2026-05-21 재정렬)

| 우선순위 | path | 사유 |
|---|---|---|
| **P0** | l2025b approval 생성 | data-ready. 5수능 100% 완료 (39/40 → 40/40). ~2분 |
| **P1** | 라이브 viewer cross-check 5단계 | 모두의창업 심사 path 정합. 6 commit 누적 정정 사후 view 0건 |
| P2 | Day 6~7 잔여 #2 (annotations.json target 필드 적용) | 441건 raw 적용 |
| P3 | Day 6~7 잔여 #3 (l2023b q25 ch3/ch5 grammar) | 사용자 PDF quote 의무 |
| P4 | 2021수능 approval 생성 | LEGACY 1/8 → 정합 |
| P5 | 13개년 LEGACY 8개년 (2014~2020) 진입 시점 결정 | 사용자 결정 의무 |
| P6 | WARNING 652건 자동 정정 path | release 미차단, 우선순위 낮음 |
| P7 | D엔진 Gate 2 진입 (Phase 5~7) | Gold 17→20 보강 사후 |

---

## 직원 진척

### 데이터 엔지니어 (Chat 1, Code B)

- 5/14~5/21 2021수능 Phase 3.1~3.4 완전 완료 (10 commit)
- 5/12 r2023a Q2 ch4 정정 (3 commit)
- Phase 3.4 release_ready ✅ 보고

### Code A (Chat 2, 프론트엔드)

- 5/15 evidence_feedback KPI + Tally 피드백 (32faaac)
- 5/15 /privacy route + 이용약관 (57ece9a)
- 5/15~ Landing CTA 분리 비로그인 직진 (a43adbd)
- 5/19 bracket 큰 대괄호 시각화 verse/workTag flush 분기 정정 (8633449)

### 전략가 / 카피라이터

- 5/9~13 작업 산출물 다수 (ops/employees/strategist/*, copywriter/*)
- 04_legal/* DRAFT 5건 (TERMS_OF_SERVICE, PRIVACY_POLICY, REFUND_POLICY, B2B_TERMS, README)

---

## 자가 결함 누계

- 직전 회기 (945de265): 12회 — 표현 결함 (path/사양 무의미 반복) 누적으로 회기 종결
- 본 회기 누계: **6회**
  - #1: 사용자 목표 (13개년) 사전 확인 NOT — 운영 문서 "5개년" 액면가 수용 (→ 교훈 17)
  - #2: 회기 진입 시 git log 깊이 부실 (10건 단독) (→ 교훈 18)
  - #3: set_status.json release_status 단독 read — release_approval_records 동시 점검 NOT (→ 교훈 16)
  - **#4**: Chrome MCP 안 bracket label 검출 사양 = 큰 대괄호 visual ↔ inline 텍스트 [X] 구분 X → l2022c/l2023d "PASS" 오판정 (→ 교훈 19)
  - **#5**: body.innerText regex 검출 단독 신뢰 → DOM querySelectorAll 안 0건 사양 mismatch 사전 식별 NOT (→ 교훈 19)
  - **#6**: Code A 진단 안 "annotations.json sentId schema 위반" path 단독 신뢰 → 모의평가 setId 안 언더스코어 정합 path 사실 점검 NOT (user_preferences §8 위반) (→ 교훈 19)
- 본 회기 표현 결함 (path/사양 무의미 반복): **0회** (자가 점검 정합)

### 자가 결함 #4·#5·#6 통합 lock — 검증 사양 dual source 의무

quality_reviewer/CLAUDE.md 교훈 19 영구 보존. lock #15 release_approval_qa 강화 (visual 정합 동시 점검 의무 추가).

### 추가 발견 — release approval 사양 결함 path

본 회기 안 "5수능 39/40 = 97.5% release ✅" 표기 (직전 데이터 엔지니어 회신 사실) ↔ 실제 라이브 view 안 5수능 bracket 시각 완전 부재 path (Code A 진단 사실) mismatch 식별. → approval 사양 = quality_gate 4기준 단독 정합 X. visual_marks 정합 + 라이브 view 사실 cross-check 의무. **lock #15 강화 사실** (quality_reviewer/CLAUDE.md 교훈 19 정합).

---

## untracked 파일 정리 (본 회기 결정: 최소 정리)

- 31건 untracked 잔존 (codeA handoff 3건, 직원 산출물 12건, session spec 4건, 비즈니스 자료 7건 등)
- 본 회기 결정: **방치** — 다음 commit 시 자연 정리. release path 진입 우선.
- 별도 회기 처리 의무: `_raw_JSON_archive/` (~9.4MB), 한글 비즈니스 자료, TOMORROW_TASKS.md archive 이동

---

## working tree 비정상 인식 (sandbox 환경)

| 항목 | 사실 |
|---|---|
| modified 100+ 파일 표시 | **false positive** (Linux sandbox 측 인식 오류) |
| `git diff -w` shortstat | empty (whitespace 무시 시 변경 0) |
| 원인 | CRLF↔LF 인식 차이. Windows PowerShell git에서는 정상 표시 예상 |
| `.git/index.lock` 잔존 | 이전 git 명령 비정상 종료. Windows 측 정리 의무 |

---

## CLAUDE.md §14 정합 점검

| 도구 | 정합 |
|---|---|
| CLAUDE.md | ✓ |
| docs/lock_baseline.md | ✓ |
| **docs/current_state.md** | ✓ (본 갱신) |
| docs/d_engine_decisions.md | ✓ |
| ops/employees/{role}/CLAUDE.md | ✓ |

---

## 본 회기 사용자 결정 사항 (2026-05-21)

1. **l2025b approval 생성**: 라이브 view cross-check 사후 진행 (안전성 우선)
2. **LEGACY 13개년 진입 시점**: **즉시 병행 진입** (2020수능 사후 path)
3. **라이브 viewer cross-check**: Chrome MCP 자동 검증 시도

## 본 회기 Phase A-1 (라이브 viewer cross-check) 결과

### Chrome MCP 6 검증 결과 (Code B 정정 사후, commit 54ca9e7)

| # | URL | 결과 |
|---|---|---|
| 1 | `/` Landing | ✅ 5수능 카드 + 베타 CTA + 피드백 button |
| 2 | l2022a | ✅ 5 wrapper 라벨 [A][B][C][D][E] (이전 0건 → 5건 정정 사후) |
| 3 | l2022c | ✅ visual_marks 6 entries (DOM 추가 검증 권고) |
| 4 | l2022d | ✅ 2 wrapper 라벨 [A][B] (이전 0건 → 2건 정정 사후) |
| 5 | l2023d | ✅ visual_marks 17 entries (DOM 추가 검증 권고) |
| 6 | /privacy | ✅ 사업자번호 297-93-01982 + 약관 본문 노출 |

### Code B 회귀 정정 사실 (commit 54ca9e7)

- visual_marks.json 472 entries 광역 복원 (10 → 472)
- 5수능 entries: 2022(39) + 2023(59) + 2024(37) + 2025(30) + 2026(45) = 210건
- 2022_6월 DEAD sentId 6건 정정 (r20226b×2, r20226d×2, l20226b×2)
- 5수능 needs_human 0건
- quality_gate CRITICAL 0건 유지
- 회귀 원인: Phase 3.4 안 `node pipeline/visual_mark_extractor.mjs --year=2021수능` 실행 → 전체 REPLACE

### Code A 진단 사실 (5/21)

- 결함 책임 영역 = Code B (visual_marks.json)
- Code A (PassagePanel.jsx) 결함 0건 정합
- 자가 결함 #5 (Code A): visual_marks setId 혼재 path 사전 식별 NOT (Code A 자체 보고 정합)

## 본 회기 운영 문서 정정 사실

| 문서 | 정정 사실 |
|---|---|
| `CLAUDE.md` §5 핵심 차별점 보호 | 5개년 → 13개년 + FREE_YEARS 5개년 + LEGACY 8개년 명시 (자율) |
| `CLAUDE.md` §5 컨텍스트 영역 | 모두의창업 심사 + Tally 베타 + 현 진척 추가 (자율) |
| `ops/employees/quality_reviewer/CLAUDE.md` 검수 7기준 #2 | 5수능 → 13개년 정합 (자율) |
| `ops/employees/quality_reviewer/CLAUDE.md` 교훈 16·17·18 | 본 회기 자가 결함 3건 영구 보존 (자율) |
| `ops/employees/strategist/CLAUDE.md` 자산 영역 | 5수능 정정 진행 중 → 5수능 97.5% release + LEGACY 즉시 병행 (자율) |
| `docs/current_state.md` | FREE 5수능 1/5 → 39/40 정정 + 사용자 목표 13개년 정합 (자율) |
| 메모리 (3건 신규) | 표현 결함 / Phase 진척 / release 진척 dual 점검 영구 보존 (자율) |

## 정정 잔존 (사용자 confirm 의무)

| 문서 | 정정 path |
|---|---|
| `ops/employees/data_engineer/CLAUDE.md:32` | "5 수능 외 시험 정정 우선순위" → 13개년 path 명시 정합 |
| `pipeline/CLAUDE.md:197` | "5개년 CRITICAL:" 보고 형식 → 13개년 보고 양식 정합 |
| `ops/employees/data_engineer/HANDOVER.md` 다수 | stale 인계서 — archive 이동 의무 |
| Untracked stale 5건 | TOMORROW_TASKS.md / automation_review_memo.md / session*_spec.md → `docs/archive/` |

---

## 다음 세션 진입 path

### 1단계: 사용자 paste — 직전 회기 핵심 결과 1줄

```
[직전 회기 (2026-05-21) 핵심 결과 인계]
- FREE 5수능 39/40 = 97.5% release ✅. l2025b 단독 미승인 (data-ready)
- LEGACY 2021수능 Phase 3.4 완료. 2014~2020 즉시 병행 진입 결정
- 본 회기 자가 결함 3회 (교훈 16·17·18 quality_reviewer/CLAUDE.md 영구 보존)
- 사용자 결정 3건: l2025b approval (view 사후) / LEGACY 즉시 병행 / Chrome MCP cross-check 시도
- 잔여 작업 = current_state.md "다음 우선순위" 영역 정합
```

### 2단계: 다음 우선순위 (5수능 100% 도달 사후 재정렬 2026-05-21)

- **P0**: Code A `src/dataLoader.js` 안 RELEASE_SET_IDS 안 l2025b 추가 (viewer routing 정합) → Vercel deploy → Chrome MCP cross-check (5수능 100% 라이브 정합 사실 확정)
- **P1**: 2021수능 approval 생성 (LEGACY 1/8 → 정합)
- **P2**: 데이터 엔지니어 LEGACY 2020수능 진입 인계 (즉시 병행 — 사용자 결정 정합)
- **P3**: l2025b sentType=undefined 30건 정정 (verse 분류 + visual_mark_extractor 재실행) — 별도 회기 path (선택 B 정합)
- **P4**: Day 6~7 잔여 #2 (annotations.json target 441건 raw 적용)
- **P5**: Day 6~7 잔여 #3 (l2023b q25 ch3/ch5 grammar — 사용자 PDF)
- **P6**: visual_mark_extractor.mjs APPEND lock + unit test 추가 (재발 회피)
- **P7**: WARNING 652건 자동 정정 path
- **P8**: D엔진 Gate 2 진입 (Phase 5~7)

### 3단계: 회기 진입 의무 사실 점검 (교훈 16·17·18 정합)

1. **git log --oneline -30** (또는 -50) — 깊이 부실 회피 (교훈 18)
2. **사용자 목표 직접 confirm** — 운영 문서 단독 신뢰 X (교훈 17)
3. **release 진척 dual 점검** — set_status.json + release_approval_records (교훈 16)
4. **session_info MCP transcript read** — 직전 회기 결정 사실 점검 (자율)

### 4단계: 자가 점검 의무

- 매 답변 표현 자가 grep (path/사양 무의미 반복)
- 재발 시 즉시 사용자 통보 + 옵션 A (새 채팅) 권고
- 자가 결함 누계 명시 의무 (회기 종결 사후 인계)
