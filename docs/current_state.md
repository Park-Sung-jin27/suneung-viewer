# 현 진행 상황 (current_state.md)

> 본 문서는 매주 1번 갱신. 회기 specific 내용 (HANDOVER_*.md 패턴) 모두 본 문서로 통합.
> 갱신 책임: 데이터 엔지니어 (Chat 1) + 프론트엔드 (Chat 2) + 품질 심사관

---

## 갱신: 2026-05-07

---

## 1. Phase 위치

| Phase | 상태 |
|---|---|
| **Phase 0** (architecture Layer 1~7 구축) | 종결 [Confirmed via 2026-05-05] |
| **Phase A** (현재 fatal 처리) | **진행 중** |
| Phase B (5 수능 + Pro tier 정정) | 미진입 |
| Phase C (장기 리팩토링) | 미진입 |

---

## 2. 5 수능 재추출 (FREE_YEARS, Phase A 핵심)

### 진행 상태 (sequential 직접 실행)

| 시험 | step1 | step2 | step3 | step4 | step5 |
|---|---|---|---|---|---|
| 2022수능 | cache | ✓ | step5 retry 진행 중 | - | 미완 |
| 2023수능 | 큐 대기 | - | - | - | - |
| 2024수능 | 큐 대기 | - | - | - | - |
| 2025수능 | 큐 대기 | - | - | - | - |
| 2026수능 | 큐 대기 | - | - | - | - |

### 진행 path

watch.js 13시간 hang 발견 → kill → sequential 직접 실행 (β 분기) 진입.

### 종결 trigger

5/5 시험 `step5_result_*수능*.json` 산출 시 → Phase 2 자동 검증 진입 (Gate 1 + 짝수형 silent defect + Hz cross-check).

---

## 3. step3 prompt 강화 (working tree, commit 미)

### 적용 내용 (line 197 사후)

```
[보기·지문 인용 절대 룰]
- bogi 필드 수치·고유명사·인용문은 반드시 원문 그대로
- 변형·추정·반올림·일반 예시 대체 금지
- 보기·지문 인용 따옴표 안 텍스트는 글자/숫자 그대로
- 지문 근거 인용 시 sents 의 t 필드 텍스트 그대로
```

### 효과

silent defect (Hz 임의 값 hallucination 등) 영구 차단. 5 수능 재추출 결과에 즉시 적용.

### Commit 시점

5 수능 재추출 종결 + Phase 2 자동 검증 통과 후 1회 통합 commit.

---

## 4. 진행 commit 누계 (Phase A)

| commit | 영역 |
|---|---|
| 92c0c9d | quality_gate v2 (분류 필드 + 6 신규 검사) |
| b2649e5 | 2026수능 s1 Q2 ok 라벨 5건 반전 |
| f420709 | 2025_9월 sep25_c Q8 questionType 정정 |
| 62cf987 | 2026_9월 r20269a Q3 critical placeholder 정제 |
| 25ea534 | 2023_6월 l20236a 페이지 6 본문 12 sents 보강 |
| cfe14f7 | 2023_6월 l20236a Q20 cs_ids + analysis 정정 |
| ff509a2 | step2 합본 PDF 거부 + 짝수형 footer 정합 |

---

## 5. 잔여 patch 작업 큐

### Phase A 종결 사후 (Phase B 진입 사전)

#### A1. 2017_6월 r20176c Q32 atomic patch

- **결함 유형**: B (step3 generation defect — Hz 임의 값)
- **결함 영역**: Q32 #1, #3, #4 (analysis Hz 불일치)
- **사용자 발견 path**: 수업 중 production 사용 (1건) + 자동 검증 (3건 확장)
- **patch 작업**: cs_ids 매핑 (#1, #3, #4, #5) + analysis Hz 정정
- **사전 의무**: r20176cs4 풀 raw + 사용자 평가원 정답 num 회신

#### A2. 002adfe step3 validator 검증

- 데이터 엔지니어 자가 외삽 commit
- 본 채팅 spec 정합 검증 의무
- 명령: `git show 002adfe -- pipeline/step3_analysis.js`

#### A3. kor25_d 자동 해소 검증

- 5 수능 재추출 종결 사후
- kor25_d sents 손상 7항목 cross-check
- 자동 해소 시 patch 5건 무효화 / 잔존 시 source_integrity_hold 적용

#### A4. 레드팀 4건 적용 (5 수능 종결 사후)

- commit 0: lock #12 라벨 규칙 갱신 (라벨 정의 선행)
- commit 1: Q20 release_approval_record schema 충족
- commit 2: Q20 cs_ids enhancement issue 분리
- commit 3: kor25_d 자동 해소 결과별 적용

---

## 6. Pro tier 미완성 시험 (Phase B 진입)

### 분류 (47 연도 dry run 매트릭스 정합)

| Tier | 시험 수 | errors 범위 | 작업 |
|---|---|---|---|
| Near-Complete | 9 | ≤ 5 | atomic 또는 step3 부분 재호출 |
| Partial | 6 | 6~30 | step2 부분 + step3 재호출 |
| Heavy | 12 | 30+ | step2~6 통째 재추출 |
| read_fail | 4 | (0p PDF) | Gemini Vision OCR (별도 도구) |

진입 시점: 5 수능 종결 + Phase A 잔여 patch 종결 사후.

---

## 7. 즉시 구현 후보 (프론트엔드 영역, Chat 2)

전략가 + 품질 심사관 검수 결과 (2026-05-07):

1. **선지별 피드백 버튼** — 1순위 (학생 production 검증 도구)
2. **문항별 오류 신고** — 2순위 (QA 결함 발견 직접)
3. **오답 패턴 미니 카드** — 3순위 (차별점 직접 시각화)
4. **세트 종료 1분 리포트** — 4순위 (학생 자기 인식)

세부는 직원별 CLAUDE.md (`ops/employees/frontend/CLAUDE.md`) 참조.

진입 시점: Phase A 종결 사후 (Chat 2 영역).

---

## 8. 환경 상태

| 영역 | 상태 |
|---|---|
| `.env` | working tree 적용 [Confirmed via 인증 정합] |
| watch.js | sequential 직접 실행 path 채택 (β 분기) |
| TEST_MODE | watch.js 자동 주입 (production merge 차단 — 정합) |
| Anthropic credit | 정합 [Confirmed via API ping] |
| 절전 차단 | 활성 (`powercfg /change standby-timeout-ac 0`) |

---

## 9. 사용자 결정 대기 영역

| 영역 | 결정 의무 |
|---|---|
| 가격·요금제 | 출시 전 의무 (free tier 범위 + Pro 가격) |
| 출시 시점 | Phase A 직후 vs Phase B Near-Complete 후 |
| 사용자 확보 우선 path | (a) 김과외 학생 풀 (b) 학원 cold outreach (c) 콘텐츠 마케팅 |
| 즉시 구현 4건 진입 시점 | Phase A 종결 직후 vs 1주 후 |

---

## 10. 다음 회기 진입 1번째 액션

1. 본 문서 + `CLAUDE.md` (루트) read
2. 본인 채팅 영역 `ops/employees/{role}/CLAUDE.md` read
3. 5 수능 sequential 진행 상태 검증 (step5_result file 개수)
4. 응답 형식 (CLAUDE.md §1) 적용

---

## 변경 이력

- 2026-05-07: 정비된 단일 정본. 옛 HANDOVER_*.md 모두 archive 격리. 회기 specific 내용 본 문서로 통합.
