# 사용자(성진) 검증 가이드 — Code A 패치 사후

> 라이브 검증 (Claude 측) 완료. 사용자 의무 검증 2건만 남음.
> 예상 소요: **총 7~10분**

---

## Claude 측 라이브 검증 결과 (이미 완료)

| 영역                                     | 결과                                                         |
| ---------------------------------------- | ------------------------------------------------------------ |
| Tally form `jaJZEY`                      | ✓ 노출됨 (제목 + 3 질문 + Submit 정상)                       |
| suneung-viewer.vercel.app FeedbackButton | ✓ 우측 하단 floating button 노출됨 (Vercel auto-deploy 완료) |
| Code A 8 검증 게이트 (빌드·DOM·시각)     | ✓ 모두 통과 (commit `32faaac`)                               |

→ **남은 사용자 의무 검증 = Supabase 실 INSERT 사실 확인 1건**

---

## Part 1. 라이브에서 👍 1회 클릭 (검증 트리거 — 3분)

### Step 1-1. 라이브 진입

- Chrome 새 탭 → 주소창에 paste 후 엔터:
  ```
  https://suneung-viewer.vercel.app
  ```
- (이미 로그인되어 있어야 함 — 본인 Google 계정)

### Step 1-2. 임의 set 진입

- 상단 또는 "내 분석" 영역 → 임의 연도 (예: 2026수능) 선택
- 임의 set 1개 선택 (예: 첫 번째 독서 set)
- 풀이 / 보기 / 복습 중 **"보기"** 모드 진입 (해설이 바로 보이는 모드)

### Step 1-3. 선지 클릭

- 임의 문제 → 임의 선지 1개 클릭
- 선지 아래 **해설 박스** 펼쳐짐 확인 (배경색 분홍/초록)

### Step 1-4. KPI 박스 노출 확인

- 해설 박스 **맨 아래** 다음 영역 표시 확인:
  ```
  ───────────────────────
  근거가 납득되시나요?   [👍 납득]   [👎 안됨]
  ```
- 점선 divider 위에 "근거가 납득되시나요?" 텍스트 + 버튼 2개 ✓

### Step 1-5. 👍 클릭

- **"👍 납득"** 버튼 클릭
- 클릭 후 다음 사실 확인:
  - 버튼 배경 초록색으로 변경 ✓
  - 두 버튼 모두 비활성화 (회색 처리) ✓
  - 우측에 **"고맙습니다"** 초록 텍스트 노출 ✓

### Step 1-6. 같은 path 1회 더

- 다른 문제 또는 다른 선지로 이동
- 해설 박스 → 이번엔 **"👎 안됨"** 클릭
- 빨간 배경 변경 + "고맙습니다" 노출 확인

✓ Part 1 완료 (Supabase 에 row 2개 INSERT 시도됨)

---

## Part 2. Supabase 에서 INSERT 사실 확인 (3분)

### Step 2-1. Supabase Dashboard 진입

- Chrome 새 탭 → 주소창에 paste 후 엔터:
  ```
  https://supabase.com/dashboard
  ```
- (이미 로그인되어 있어야 함)

### Step 2-2. 프로젝트 진입

- 프로젝트 list → **suneung-viewer** 카드 클릭

### Step 2-3. Table Editor 진입

- 왼쪽 sidebar → **"Table Editor"** 아이콘 클릭
  - 아이콘 모양: 표/grid 모양
  - "DATABASE" 섹션 아래에 있음

### Step 2-4. evidence_feedback 테이블 클릭

- 테이블 list 에서 **evidence_feedback** 클릭
- 테이블 내용 표시됨

### Step 2-5. row 확인

- 다음 사실 확인:
  - **row 2개 이상** 노출 ✓
  - `vote` 컬럼: `true` (1행) + `false` (1행) ✓
  - `year_key` 컬럼: 풀이한 연도 ✓
  - `set_id` 컬럼: 풀이한 set ✓
  - `choice_num` 컬럼: 클릭한 선지 번호 ✓
  - `user_id` 컬럼: 본인 UUID (긴 문자열) ✓
  - `created_at` 컬럼: 현재 시각 ✓

✓ Part 2 완료 — KPI 측정 path 정합 lock

### Part 2 실패 시 대응

- **row 0개 노출**:
  - Supabase SQL (사전 조건 A) 미실행 가능
  - `user_guide_2026-05-15.md` Part 1 다시 진행 → SQL RUN
  - 또는 Claude 에게 보고 → console error log 점검

- **row 노출되나 user_id 가 null**:
  - 비로그인 상태로 클릭됨 — 정상 동작 (anon insert 허용)
  - 로그인 후 다시 클릭하면 user_id 채워짐

---

## Part 3 (선택). Tally Q3 Required 해제 (2분)

> Claude 검증 시 Q3 "다시 풀러 올 의향" 에 빨간 별표(\*) 노출됨 — Required 상태.
> 베타에선 응답률 우선 → optional 권고. **선택사항**.

### Step 3-1. Tally Dashboard 진입

- Chrome 새 탭 → `https://tally.so/forms`
- "베타 피드백 — 짚이" form 클릭

### Step 3-2. Q3 편집

- form editor 진입
- Q3 "다시 풀러 올 의향은?" 클릭
- 우측 또는 하단 설정 영역에서 **"Required"** 토글 → **해제**

### Step 3-3. 저장·재publish

- 화면 상단 **"Publish"** 또는 자동저장 확인
- URL 변경 없음 (jaJZEY 유지)

✓ Part 3 완료 (선택)

---

## 최종 검증 완료 후 다음 액션

### A. 베타 모집 path 진입 의무 사전 조건

1. **개인정보처리방침 page deploy** (이전 chat 미완 작업)
   - `/privacy` 경로 진입 시 200 OK 의무
   - 베타 발송 trigger 1번 조건

2. **messaging + 품질 약속 page deploy 사실 확인**
   - 베타 발송 trigger 2번 조건

3. **모집 form Tally URL** (피드백 form 과 별개)
   - 이미 존재: `TALLY_URL` 상수 (constants.js)
   - 발행 상태 사실 확인 의무

### B. 베타 14일 후 KPI 측정 SQL

Supabase Dashboard → SQL Editor → 다음 paste 후 RUN:

```sql
select
  count(*) as total_votes,
  sum(case when vote then 1 else 0 end) as accepted,
  round(100.0 * sum(case when vote then 1 else 0 end) / nullif(count(*), 0), 1) as accept_rate_pct
from evidence_feedback;
```

→ 목표 lock: **accept_rate_pct ≥ 85%**
→ < 70% 시 차별점 messaging 재검토 의무

---

## 본 검증 후 보고 format

Claude 에게 다음 3개 paste:

```
Part 1: 완료 / 실패 (실패 시 어느 step)
Part 2: row 노출됨 / row 0개 / 기타
Part 3: 진행 / 생략
```

→ Claude 가 다음 액션 path 자동 안내
