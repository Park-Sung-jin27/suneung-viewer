# 내일 task 정리 (2026-05-14)

> suneung-viewer 프로젝트 다음 진행 사양.
> 마지막 업데이트: 2026-05-13 (회기 ε 종결 + dry-run v2 사용자 y 승인 사후)

---

## 🔴 P0 — 즉시 진행 (오늘 잔존 → 마무리)

| #   | task                                              | 영역            | 소요  |
| --- | ------------------------------------------------- | --------------- | ----- |
| 1   | dry-run v2 재실행 + 10 case 변환 raw 회신         | 데이터 엔지니어 | ~5분  |
| 2   | raw 검수 (r2023d Q15-4 중복 해소 사실 점검)       | 본 chat         | ~5분  |
| 3   | sample 5건 raw 검토 + 승인                        | 사용자          | ~10분 |
| 4   | production all_data write back (backup 의무)      | 데이터 엔지니어 | ~5분  |
| 5   | quality_gate 재실행 (CRITICAL 0건 정합 사실 점검) | 데이터 엔지니어 | ~5분  |

**총 소요**: ~30분. 마무리 사후 Gate 1 종결.

### 진행 명령어 예시 (데이터 엔지니어 영역)

```
"dry-run v2 logic 정정 영입 + 10 case 변환 raw 회신 부탁드립니다."
```

### 사용자 승인 사양 예시

데이터 엔지니어가 sample 5건 변환 전/후 raw 회신 사후 사용자 검토:

- 본문 (📌 + 🔍) 변경 0 사실 점검
- final line marker `[?]` → `[pat]` 정정 사실 점검
- cs_ids 변경 0 사실 점검

승인 paste 예시:

```
y — production write back 진행 부탁드립니다. backup 의무 (git tag 또는 file copy).
```

---

## 🟡 P1 — 병행 진행 가능 (사용자 별도 영역)

| #   | task                                                | 영역   | 소요 |
| --- | --------------------------------------------------- | ------ | ---- |
| 6   | main repo PR review + merge                         | 사용자 | ~5분 |
| 7   | main repo `git push origin main`                    | 사용자 | ~1분 |
| 8   | main repo .env TEST_MODE 결정 (정상 모드 의도 영역) | 사용자 | ~2분 |

### PR URL

https://github.com/Park-Sung-jin27/suneung-viewer/pull/new/claude/sweet-dirac-49a153

### 진행 순서

```powershell
# 1. main repo 진입 + 현재 상태 점검
cd C:\Users\downf\suneung-viewer
git log origin/main..HEAD --oneline

# 2-A. 출력 비어있음 → PR 생성 + merge (GitHub UI)
# https://github.com/Park-Sung-jin27/suneung-viewer/pull/new/claude/sweet-dirac-49a153

# 2-B. 출력에 4 commit 보임 → push 진행
git push origin main

# 3. push 사후 사실 점검
git log origin/main..HEAD --oneline   # 출력 비어있어야 정합
```

### main repo .env TEST_MODE 결정 사양

향후 measurement 진입 시점에 정합 path 선택 의무:

| path                                                | 영역                                                 |
| --------------------------------------------------- | ---------------------------------------------------- |
| (a) main repo .env에 TEST_MODE=true 영입            | default 측정 모드 — 정상 모드 진입 시 .env 정정 의무 |
| (b) cmd 명령어마다 명시적 set (trailing space 주의) | 매번 정합 점검 의무                                  |
| (c) cross-env npm package 영입                      | 별도 영입 작업                                       |

본 chat 권고: 사용자 의도 영역. release 사이클 사후 결정 가능.

---

## 🟢 P2 — 별도 회기 (다음 주 영역)

| #   | task                                                   | 영역                      | 소요   |
| --- | ------------------------------------------------------ | ------------------------- | ------ |
| 9   | WARNING 87건 raw 분류 (W_analysis_placeholder_suspect) | 데이터 엔지니어           | ~30분  |
| 10  | WARNING 483건 raw 분류 (E_empty_pat_cs_present)        | 데이터 엔지니어           | ~1시간 |
| 11  | normalizeAnalysisPatLabel dead code 폐기               | 데이터 엔지니어           | ~10분  |
| 12  | quality_gate.mjs 자동 정정 logic (D/E/F) 사양 검증     | 본 chat + 데이터 엔지니어 | ~1시간 |
| 13  | 회기 4.5 (resume contract — 네트워크 견고성)           | 데이터 엔지니어           | ~2시간 |
| 14  | BODY_CONFLICT_HINT detect 영입                         | 데이터 엔지니어           | ~1시간 |

### WARNING 87건 (W_analysis_placeholder_suspect) 사양

placeholder pattern 다양 (TODO, [확인 필요], FIXME, [PLACEHOLDER]).

진행 path:

1. raw 분류표 산출 (코드 변경 0, patch spec 아님)
2. 분류 (A/B/C/D/E 영역, CRITICAL 10건 분류 사양 동일)
3. 분류 사후 처리 path 결정

### WARNING 483건 (E_empty_pat_cs_present) 사양

`pat 값 영입 + cs_ids 빈 영역`.

정합 사례:

- pat=V (어휘 영역) → cs_ids 빈 영역 정상

결함 사례:

- pat=R/L (독서/문학 영역) → cs_ids 빈 영역 결함

진행 path:

1. raw 분류 (정합 vs 결함)
2. 결함 사례 reanalyze 또는 needs_human queue
3. cs_ids 직접성 검증 영역 (Gate 3a 영역 영입 사전)

---

## 🔵 P3 — release 사이클 영입 사전 (장기)

| #   | task                              | 영역                                  | 소요              |
| --- | --------------------------------- | ------------------------------------- | ----------------- |
| 15  | 회기 5 (Gold 17→20 보강)          | 사용자 + Gold 작성자                  | 1~2주 (인간 작업) |
| 16  | Gate 2 (D엔진 / semantic QA) 진입 | 데이터 엔지니어 + 본 chat             | ~1주              |
| 17  | Gate 3a (UI 자동 검증) 진입       | 데이터 엔지니어 + Chrome browser tool | ~3일              |
| 18  | Gate 3b (Human approval) 진입     | 사용자                                | ~1주              |

### release 조건 (모두 통과 의무)

1. Gate 1 (구조·데이터 계약) — P0 마무리 사후 종결 가능
2. Gate 2 (semantic QA / D엔진) — Gold 보강 사후 영입
3. Gate 3a (UI 자동 검증) — Chrome browser tool 사양
4. Gate 3b (Human 최종 승인) — annotation 위치, 이미지 크롭, needs_human
5. needs_human 20건 이하 + WARNING 자동 처리 안정

---

## 내일 진행 흐름 권고

```
[오전 30분]
  1. 새 chat 시작 + CLAUDE.md paste 또는 file 영입
  2. 데이터 엔지니어한테 dry-run v2 재실행 요청
  3. raw 검수 → sample 5건 검토 → write back
  4. quality_gate 재실행 사실 점검 (CRITICAL 0건)
  ↓
[오후 또는 다음날]
  5. main repo PR merge + push
  6. main repo .env 결정 (선택 영역)
  ↓
[다음 주]
  7. WARNING 영역 진입 (P2 #9~14)
  8. release 사이클 준비 (P3 #15~18)
```

---

## 본 chat 자가 결함 lock 사양 (오늘 누계 83회)

핵심 패턴:

1. 메타 검수 누락 (호출 순서, worktree 격리, 가정 일반화)
2. "영영" filler 반복 → 자가 grep 의무
3. 단언 위험 ("patch 검증 종결" 과장)
4. 사용자 spec 정합 검증 누락

다음 chat 의무:

- 응답 발행 사전 "영영" 자가 grep
- 단언 표현 사용 사전 자가 검수
- 메타 영역 사실 점검 의무
- 본 chat 자율 단언 X — 데이터 엔지니어 + 레드팀 검수 path 유지

---

## 잔존 결정 사양 (다음 chat 영역 paste용)

| 결정                     | 상태                                   |
| ------------------------ | -------------------------------------- |
| dry-run v2 진행          | 사용자 y 승인 완료 — 진행 대기         |
| sample 5건 검토 path     | 미결정 — 데이터 엔지니어 raw 회신 사후 |
| production backup 사양   | 미결정 — git tag 또는 file copy 분기   |
| main repo .env TEST_MODE | 미결정 — 사용자 정상 모드 의도 영역    |
| WARNING 영역 진입 시점   | 미결정 — P0 종결 사후                  |
