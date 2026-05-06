# HANDOVER_CHAT2.md — Chat 2 (프론트엔드·제품) 회기 진입 인수

> 갱신: 2026-05-06 | 본 채팅 (Chat 1, 데이터·파이프라인) 발행 핸드오버 도구 (lock #20 표준 도구)

---

## §1 즉시 진입 spec — viewer 배너 일괄 적용 일반화

### 사용자 spec (대표 명시)

> "모든 시험 set에 검수중 배너 일괄 적용 필요.
> viewer (App.jsx) 배너 조건을 currentSet?.id === \"kor25_d\" 에서
> 모든 set 적용으로 일반화."

### 배경 (Chat 1 raw scan 산출물)

원문자(ⓐⓑⓒⓓⓔ㉠㉡㉮㉯) 정합 scan 결과:

| 영역       | INTACT         | AFFECTED |
| ---------- | -------------- | -------- |
| literature | 47 (l25b 포함) | **62**   |
| reading    | —              | **113**  |

총 **175 set** 데이터 결함 (sents.t 또는 q.bogi에 원문자 누락 → 학생 진입 시 발문 정합 깨짐).

라이브 학생 보호 우선 → 모든 set 강제 검수중 배너 노출 결정 [Adopted via 사용자 본 회기].

### 변경 영역 (Code A)

**현재 (commit 2ea0177 정합)**

- `src/App.jsx` 또는 `src/Banner.jsx` 호출부 영역
- 조건: `currentSet?.id === "kor25_d"` (kor25_d 단독 노출)

**목표 변경**

- 조건: 모든 set 적용 (조건 always true 또는 currentSet 존재 자체로 노출)
- 배너 문구: 기존 "검수중 — 본 set은 본문 정합화 작업 중입니다." 정합 유지

### 권고 변경 사양

```jsx
// before
{currentSet?.id === "kor25_d" && <Banner ... />}

// after (option A — viewer 강제 배너 모든 set)
{currentSet && <Banner message="검수중 — 본 set은 본문 정합화 작업 중입니다." />}

// after (option B — 데이터 측 set_status 참조 + viewer 일반화 사전)
{currentSet?.set_status === "release_blocked" && <Banner message={currentSet.display_banner} />}
```

**option A 권고** (즉시 학생 보호 + 단순 변경):

- viewer 자체 강제 배너 → 모든 set 노출
- 데이터 측 set_status 추가 의무 없음 (Chat 1 작업 0)
- 사후 unblock: viewer 조건 set_status 참조 변경 (option B 진입)

**option B 사전 작업**:

- Chat 1 (본 채팅) 의무: 모든 set entry에 `set_status: "release_blocked"` + `display_banner` 추가
- viewer 조건 변경: `currentSet?.set_status === "release_blocked"`
- set 별 unblock 가능 (set entry set_status 직접 갱신)

### 진입 권고

option A 즉시 진입 (라이브 학생 보호 우선) → option B는 Phase B step 2 자동화 도구 진입 사전 진입.

---

## §2 정합 검증 의무

### Gate 5a Technical (lock #5 정합)

배너 일반화 사후 라이브 검증:

1. URL 진입 (예: 2025수능/l2025c) → 배너 노출 [Pending]
2. 다른 set 진입 (예: 2026수능/l2026a INTACT) → 배너 노출 [Pending]
3. DOM count 배너 1건 [Pending]
4. screenshot 첨부 [Pending]
5. console error 0 [Pending]

### Gate 5b Learning 영역

본 회기 Phase A 종결 영역 (kor25_d Q17 정정) 사후 분리 검증.

---

## §3 본 채팅 (Chat 1) 산출물 + 처리 의무

### Phase A 영역 (kor25_d Q17 정정)

| 영역                                     | 결과 |
| ---------------------------------------- | ---- |
| Q17 #1 ⓐ "되다고"→"된다고" typo          | ✓    |
| Q17 #3 ⓒ "되다고"→"된다고" typo          | ✓    |
| Q17 #1 #2 #4 #5 pat R1→V                 | ✓    |
| Q17 5 choices analysis V style 재작성    | ✓    |
| annotations.json kor25_d 9 sentId 동기화 | ✓    |
| set.annotations 9 sentId 동기화          | ✓    |

issue_id (lock #2 정합):

- `QG-2025수능-kor25_d-Q17-vocab-reclassify`
- `QG-2025수능-kor25_d-annotation-sentid-resync`

### Chat 2 의무 (Gate 5b Learning)

Q17 5 choices 라이브 형광펜 작동 + 해설 학습 직접성 검증:

- ⓐ→ds1 / ⓑ→ds2 / ⓒ→ds4 (정답) / ⓓ→ds6 / ⓔ→ds7
- 사용자 manual click 5건 → cs_ids 정합 + analysis 1문장 직접성 판정 의무

---

## §4 라이브 환경 진입

```
URL: https://suneung-viewer.vercel.app
2025수능 / kor25_d / Q14·Q15·Q16·Q17 — 4 issue 검증 의무
2025수능 / l2025a · l2025c · l2025d — 배너 일반화 검증 의무 (option A)
2026수능 / l2026a (INTACT) — 배너 노출 의무 (option A 정합)
```

---

## §5 self-test 7건 lock (다음 회기 의무)

| #   | self-test                                             |
| --- | ----------------------------------------------------- |
| ①   | "5/8" 단어 0건 (schedule_basis lock #7)               |
| ②   | Spec 명칭 단독 사용 0건 (issue_id 정본 사용, lock #9) |
| ③   | 라벨 분리 (9 라벨, lock #12)                          |
| ④   | Gate 5a/5b 분리 사용 (lock #5)                        |
| ⑤   | issue_id 정본 명명 (lock #2)                          |
| ⑥   | commit message issue_id 강제 (lock #14)               |
| ⑦   | 운영 문서 도구 의존 표현 0건 (lock #20)               |

---

## §6 Code A 절대 금지 (src/CLAUDE.md 정합)

- public/data/all_data_204.json 직접 수정
- pipeline/\* 수정
- Code B (Chat 1)와 동시 push
- PowerShell && 체이닝

---

## §7 Phase B 자동화 도구 spec (사후 진입 사전 자료)

literature 62 + reading 113 = 175 set 결함 일괄 재추출 자동화 도구 spec 의무 (Chat 1 영역).

진입 조건: 본 spec (배너 일반화) 종결 + Phase A 종결 사후.

---

## §8 다음 액션

1. 본 HANDOVER_CHAT2.md read
2. self-test 7건 적용
3. App.jsx 또는 Banner.jsx 위치 식별 (현재 kor25_d 조건 영역)
4. option A 진입 — 조건 일반화 (모든 set 노출)
5. Gate 5a 라이브 검증 (3건 set 진입 + DOM count + screenshot)
6. commit + push (issue_id `QG-viewer-banner-mass-apply-generalization` 정합 lock #14)
7. Chat 1 (본 채팅) Phase B 자동화 도구 spec 진입 알림
