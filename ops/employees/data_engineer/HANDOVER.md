# HANDOVER — 데이터 엔지니어

> 갱신: 2026-04-28 10:xx (§4.1 commit 완료 직후)
> 다음 재개: **2026-04-29 (트랙 1: §4.1.5 사양 / 트랙 2: 2023수능 독서 PDF)**
> 직전 가동: 2026-04-28 §4.1 wrapper commit `eadd1fa`

---

## 🎯 4-29 진입 즉시 첫 메시지 (대표 복붙용)

```
데이터 엔지니어 4-29 가동.
오늘 작업: 트랙 2 (2023수능 독서 PDF Gemini 추출).
별도 채팅 (본 채팅 외): §4.1.5 실제 GPT-5 caller 사양 작성 진행.

세션 시작 점검 보고 (의무):
- git -C C:\Users\downf\suneung-viewer status --short | Measure-Object -Line
- git -C C:\Users\downf\suneung-viewer log --oneline -5

품질 심사관 승인 후 트랙 2 진입.
```

---

## ✅ 어제 4-28 완료 — §4.1 wrapper commit `eadd1fa`

| Step | 산출물 | 상태 |
|---|---|---|
| (a) | `HANDOVER_D_ENGINE_4_1_SPEC.md` (629줄) | ✅ |
| (b) | `pipeline/d_engine_wrapper.mjs` (497줄, 코드 주석 v1.1-1~6 의무) | ✅ |
| (c)+(d) | `pipeline/d_engine_wrapper.test.mjs` (438줄, mockCaller inline) | ✅ |
| (e) | 회귀 50/50 통과 (12 케이스) | ✅ |
| 정정 | Promise.resolve defensive + async 7개 추가 | ✅ |
| (f)+(g) | commit `eadd1fa` + push origin main | ✅ |

**합계**: 1564 insertions across 3 파일. D엔진 완성 7단계 중 §4.1 종결 (3/7 = 43%).

---

## ✅ 어제 4-27 완료 (압축)

- 인프라 정비: `.gitignore` 22항목, ops/ 9건 정리, 121→71줄 (-50)
- §10 v2 commit `fa5562e` (Gold 메타 동기화 α+β)
- validator commit `ce77119` (§10 v2 메타 구조 인지)
- §4.2 v2 회귀 15/15 통과 (별도 commit 미진입, 4-29 그룹 B에 포함 예정)
- 이미지 commit `8622037` (4건)

---

## 📋 4-29 작업 흐름

### 트랙 분리 (병렬)

| 트랙 | 채팅 | 작업 |
|---|---|---|
| 1 | 별도 채팅 (품질 심사관 또는 신규) | §4.1.5 실제 GPT-5 caller 사양 작성 |
| 2 | **본 채팅 (데이터 엔지니어)** | 2023수능 독서 PDF Gemini 추출 시작 |

### 트랙 2 (본 채팅 — 4-29 오전 진입)

**대상**: 2023수능 독서 PDF (현재 진행 중, 85/170 해설)

**참고**: 데이터 엔지니어 CLAUDE.md §6 명령어:
```powershell
node C:\Users\downf\suneung-viewer\pipeline\step2_extract.js [PDF경로]
```

세부 입력 PDF 경로 + Gemini 호출 + step3 해설 생성 흐름은 4-29 진입 시 결정.

### 4-29 오후

- 트랙 1 마무리 (§4.1.5 사양 자가 검토)
- 트랙 2 진행 (Gemini 추출 결과 처리)

---

## 📋 4-30 작업 흐름

| 항목 | 담당 |
|---|---|
| §4.5 로깅 (6개 항목) | 데이터 엔지니어 |
| §4.3 needs_human 큐 | 데이터 엔지니어 |
| §4.1.5 실제 GPT-5 caller 구현 | 데이터 엔지니어 |
| `OPENAI_API_KEY` 등록 (.env + Vercel) | 대표 직접 |
| AI 코칭 결함 2건 처리 | 프론트엔드 채팅 (신규 가동, 오후) |
| 2022수능 독서 Gemini 추출 시작 | 데이터 엔지니어 |
| 2023수능 해설 작성 시작 | 대표 |

---

## 📋 5월 일정 분산 (4-28 정정, 옵션 A + 옵션 C)

| 일자 | 작업 |
|---|---|
| **4/29~5/2** | D엔진 (§4.1.5 + §4.5 + §4.3) + 해설 + AI 코칭 + Gemini 추출 |
| **5/3~5/4** | 파일명 v2.1 일괄 rename + 이미지 뷰어 코드 삽입 (옵션 C 신규 트랙, ~5시간) |
| **5/5** | 베타 유저 요청 + Stage 2 pilot 시작 |
| **5/5~5/9** | Stage 2 pilot 5일 |
| **5/10~5/14** | v1.1 보정 + 5/15 모두의창업 소개서 마무리 |
| **5/15** | 모두의창업 제출 |

### 베타 출시 점검 항목 5건 — 진행률 (4-28 2차 정정)

annotation ↔ images 분리 반영 (대표 명시):
- annotation = bracket + box + underline (텍스트 마크업)
- images = 캡처 이미지 + 뷰어 코드 삽입 (별도)

| # | 항목 | 상태 |
|---|---|---|
| 1 | 5개년 데이터 + 해설 (release_ready 4기준) | ✅ |
| 2 | D엔진 §4.1 wrapper | ✅ (4-28 commit) |
| 3 | annotation (bracket/box/underline) 5개년 | ⏳ 4/29 검증 (시나리오 A/B/C) |
| 4 | images 캡처 | ✅ 5개년 캡처 완료 |
| 5 | images 뷰어 코드 삽입 | 🔴 미완 (5/3~5/4 작업) |

**진행률 정정**: 직전 3.0/4 (75%) → 2.5/4 (62.5%) → **2/5 (40%)**

---

## 📋 4-29 트랙 (3차 정정 — 시나리오 분류 폐기, 병렬 입력 채택)

### 정정 사유

본 채팅 가정 검증 실패 15번째: 직전 시나리오 A/B/C 평가 권고는 부차. annotation 입력 자체가 대표 작업 영역 → 데이터 엔지니어 현황 파악 + 대표 병렬 입력이 ROI 우월.

### 트랙

| 트랙 | 채팅 | 작업 | 시간 |
|---|---|---|---|
| 1 | 별도 채팅 | §4.1.5 실제 GPT-5 caller 사양 작성 | 오전~오후 |
| 2-a | **본 채팅 (데이터 엔지니어)** | annotation 5개년 현황 파악 (우선) | 15~30분 |
| 2-b | **본 채팅 (데이터 엔지니어)** | q3_reading_material set_id 검증 | 5분 |
| 2-c | **본 채팅 (데이터 엔지니어)** | 2023수능 독서 Gemini 추출 | 오전~오후 |
| 병렬 | **대표 직접** | annotation 양식 입력 (gen 후 누락분 채우기) | 2~3시간 |

### 트랙 2-a 출력 형식

| 시험 | 지문 | bracket | box | underline | 비고 |
|---|---|---|---|---|---|
| 2026수능 | r2026a | ? | ? | ? | |
| ... | ... | | | | |

베타 출시 5개년 (2022~2026) 우선 + 부차 시험 후순위.

### annotation 작성 도구 (대표 병렬 사용)

```powershell
node C:\Users\downf\suneung-viewer\pipeline\gen_annotation_template.cjs {yearKey}
# 결과: _annotation_drafts/{yearKey}.txt → 대표 누락분 채우기

node C:\Users\downf\suneung-viewer\pipeline\annotate.js {yearKey} --apply-draft
# WARN 0 확인 필수
```

---

## 📋 set_id 명명 규칙 v2.3 (4-28 정정 — 영어 확장 대비)

### 현행 표준 (국어)

```
수능: r/l + 학년도YY + 문자       (예: r2026a, l2026b)
9월:  r/l + 학년도YY + 9 + 문자   (예: r20269a)
6월:  r/l + 학년도YY + 6 + 문자   (예: r20256a, r20266a)
```

### r20256a 의미 [Confirmed]

= 2025학년도 6월 모의 reading 1번 지문 (4-28 사용자 회신).

### 영어 확장 예약

```
국어 (현행): r/l + ... (묵시적 한국어 시험 표시)
영어 (예약): er/el + ... (또는 별도 — 도입 시 결정)
```

`kor` prefix는 영어 추가 시 의미 없음 → 옵션 B 채택 (kor 제거 + 영어 확장 prefix 예약).

### 5/15 후 정리 (비표준 잔존)

- `kor25c` → `r2025c` (의미 검증 후)
- `kor25d` → `r2025d`
- `s3` → 2026수능 set_id 식별 후
- `q3_reading_material` → set_id 검증 후

### q3_reading_material set_id 검증 결과 (4-28 본 채팅)

- 사용자 가정: `r2025a` → 미존재
- 실제 2025수능 reading set_ids: `r20256a/b/c/d` (4개) — v2.3에 따르면 모두 6월 모의 set_id
- → **2025수능 reading 데이터 자체에 의문**: v2.3 명명 규칙 따르면 `r2025a/b/c/d`여야 정합. 실제 모두 "6"이 들어감 = 2025학년도 6월 모의?
- 4/29 트랙 2-b에서 reading + literature 모든 set 확인 후 매칭 식별

---

## 📋 미처리 이슈 8건 (4-28 갱신, 옵션 C + 일정 정정 반영)

### 🔴 High (5/15 전 필수)

1. **§4.1.5 실제 GPT-5 caller 작성** — 4/29~4/30
2. **§4-9 step3_rules 통합 위치** — 4/29 §4.1.5 사양 작성 시 결정
3. **그룹 A~F commit 분산** — 4/29~5/2 (어제 4-27 미진입분)
4. **2023/2022수능 독서 Gemini 추출 + 해설** — 4/29~5/2
5. **5/3~5/4 신규 트랙 (재정정 — 시나리오 분류 폐기, 병렬 입력 채택)**
   - annotation 입력 자체는 대표 작업 (4/29~5/2 병렬 진행)
   - 5/3~5/4 데이터 엔지니어 작업:
     - 작업 1: annotation 코드 검증 (1시간) — apply-draft + WARN 0 확인
     - 작업 2: 파일명 v2.1 일괄 rename (1.5~2시간)
     - 작업 3: 이미지 코드 삽입 분담 — 프론트엔드 채팅에서 처리 (3~4시간)
     - 작업 4: kor prefix 정정 → 5/15 후 미룸
   - 데이터 엔지니어 5/3~5/4 작업 비용 [Inference]: **5.5~7시간**
   - 베타 출시 5/5 정합성 보호 ✅
   - 작업 분담: 데이터 엔지니어 (검증 + rename + JSON 매핑) / 프론트엔드 (jsx 코드 삽입)
   - 5/3 진입 직전 작업 분담 결정 회기 1회 권고

### 🟡 Mid (Stage 2 pilot 진입 전)

6. **AI 코칭 결함 2건 처리** — 4/30 (프론트엔드 채팅)
7. **q3_reading_material.png set_id 검증** — 4/29 5분
   - 본 채팅 4-28 검증 결과: 사용자 가정 `r2025a` ↔ 실제 `r20256a/b/c/d` 불일치
   - 4 set 중 의도 매칭 set 판별 필요

### 🟢 Low (5/15 후 정리)

8. **v1.2 보강 6건** — D_ENGINE_PROMPT SSoT, markdown fence, options 분리, retry 정책, low_confidence_flag, errors error_level

---

## 📋 백로그 A-3 (2026-04-25 인벤토리, 5/15 후 처리)

### 952개 / 818MB 즉시 삭제 가능

1. `pipeline/backups/*` (97개, 523MB) — .gitignore 추적 제외 완료, 물리 삭제 5/15 후
2. `.claude/worktrees/*` (756개, 254MB) — 9개 dirty worktree 정리 후 `git worktree remove`
3. `public/data/all_data_204.json.bak_*` (4건, 38MB)
4. `pipeline/outputs/`, `reports/` 내부
5. `_annotation_drafts/`, `_para_drafts/`
6. 잔여 `.bak` 파일

### 검토 후 삭제 (493개, 165MB, 5/15 후)

- `_done/*` (130MB) — PDF 시험지 → 외장 폴더 이동
- `pipeline/test_data/*` (35MB) — 5/15 이후 검토
- `pipeline/archive/*` — 옛 일회성 스크립트 (run_step4_all.sh.broken_2026-04-27 포함)

---

## 🚨 절대 금지 (CLAUDE_MASTER §6 + 데이터 엔지니어 CLAUDE.md §1)

- src/*.jsx 수정
- public/data/all_data_204.json 직접 수동 편집 (파이프라인 통과 필수)
- 검증 안 된 수정을 main 직반영
- 프론트엔드 직원과 동시 push
- PowerShell `&&` 체이닝 (→ `;` 사용)
- 일회성 패치 스크립트 신규 생성
- node -e 인라인 진단 (특히 정규식 포함)
- **2026-04-27 신규**: `cd` 의존 PowerShell 명령 (절대경로 인자 단독 실행 가능하게 작성)
- **2026-04-27 신규**: 매 세션 시작 시 `git status` + `git log --oneline -5` 두 출력 의무 보고

---

## 📅 일별 누적

### 2026-04-28 (§4.1 wrapper)
- §4.1 D엔진 wrapper commit `eadd1fa` (HANDOVER_SPEC + wrapper.mjs + test.mjs)
- 회귀 50/50 통과
- 1564 insertions
- D엔진 완성 7단계 중 3/7 종결

### 2026-04-27 (인프라 정비 + §10 v2 + §4.2 v2)
- 백로그 A·B 인프라 부분 완료
- §10 v2 정합성 복구 commit `fa5562e`
- validator commit `ce77119`
- §4.2 v2 회귀 15/15 (commit 미진입, 4-29 그룹 B 예정)
- ops/ 9건 정리 (중복본·공백폴더·prefix)
- .gitignore 22항목 보강

### 2026-04-25 (D엔진 의제 분석 + 인벤토리)
- 의제 1·2 잠정안 도출
- 952개/818MB 삭제 후보 + 493개/165MB 검토 대상 식별

### 2026-04-23 (D엔진 Phase 1 종료)
- Gold 14개 dry-run 86% FULL_MATCH+acceptable
- Stage 2 진입 선결 조건 4건 식별

### 2026-04-15 (release_ready 달성)
- 5개 수능 CRITICAL 0건
- DEAD_csid 0건, 내부 ID 0건
