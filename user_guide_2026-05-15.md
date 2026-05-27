# 사용자(성진) 클릭 단위 작업 가이드

> 목표: 베타 KPI 1차 패치를 적용하기 위한 사용자 본인 작업
> 예상 소요: **총 15~20분**
> 4 Part 구성. 각 Part 가 끝나야 다음 Part 진행.

---

## Part 1. Supabase SQL 실행 (5분)

### Step 1-1. 브라우저 열기

- Chrome 열기

### Step 1-2. Supabase Dashboard 접속

- 주소창에 paste 후 엔터:
  ```
  https://supabase.com/dashboard
  ```
- 이미 로그인되어 있으면 → 프로젝트 list 가 보임
- 로그인 안 되어 있으면 → "Sign in" 클릭 → Google 로그인

### Step 1-3. suneung-viewer 프로젝트 클릭

- 프로젝트 list 에서 **suneung-viewer** 카드 클릭
- (프로젝트 이름이 다르면 본인이 만든 프로젝트 카드 클릭)

### Step 1-4. SQL Editor 진입

- 왼쪽 sidebar 에서 **"SQL Editor"** 아이콘 클릭
  - 아이콘 모양: 종이에 `<>` 표시 (또는 "SQL" 글자)
- 사이드바가 좁으면 "DATABASE" 섹션 아래에 있음

### Step 1-5. 신규 query 생성

- 화면 상단 "+ New query" 또는 "+" 버튼 클릭
- 빈 SQL 작성 영역이 열림

### Step 1-6. SQL paste

- 아래 박스 전체 복사 (Ctrl+A 후 Ctrl+C 가 아니라, 박스 안 텍스트 전체 마우스 드래그로 선택 후 Ctrl+C):

```sql
create table if not exists public.evidence_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  year_key text not null,
  set_id text not null,
  question_id int not null,
  choice_num int not null,
  vote boolean not null,
  created_at timestamptz default now()
);

alter table public.evidence_feedback enable row level security;

create policy "anyone can insert evidence_feedback"
  on public.evidence_feedback for insert
  to anon, authenticated with check (true);

create policy "users read own evidence_feedback"
  on public.evidence_feedback for select
  to authenticated using (user_id = auth.uid());

create index if not exists evidence_feedback_set_idx
  on public.evidence_feedback (set_id, question_id);
```

- SQL Editor 의 빈 영역 안 클릭 → Ctrl+V 로 paste

### Step 1-7. 실행

- 오른쪽 아래 또는 상단 **"Run"** 초록색 버튼 클릭
  - 단축키: Ctrl+Enter 도 가능
- 결과 창에 **"Success. No rows returned"** 또는 비슷한 초록색 메시지 표시 확인
  - 빨간 error 표시되면 → Claude 에게 error 메시지 paste 해서 보고

### Step 1-8. 테이블 생성 사실 확인

- 왼쪽 sidebar **"Table Editor"** 클릭
- 테이블 list 에서 **evidence_feedback** 이 표시되는지 확인
- 표시되면 ✓ Part 1 완료

---

## Part 2. Tally 피드백 form 생성 (5분)

### Step 2-1. Tally 접속

- 새 탭 열기 (Ctrl+T)
- 주소창에 paste 후 엔터:
  ```
  https://tally.so
  ```
- 우측 상단 "Sign in" 클릭 → Google 로그인 (이미 사용 중인 form 있을 듯)

### Step 2-2. 신규 form 생성

- Dashboard 진입 후 좌측 또는 상단 **"+ Create new form"** 버튼 클릭
- "Start from scratch" 선택 (또는 비슷한 빈 form 옵션)

### Step 2-3. form 제목 변경

- 화면 상단 "Untitled form" 영역 클릭
- 다음 입력:
  ```
  베타 피드백 — 짚이
  ```

### Step 2-4. 질문 1 추가

- 화면 안 "Add question" 또는 "+" 버튼 클릭
- 질문 타입 list 에서 **"Short answer"** (또는 한 줄 답변) 선택
- 질문 텍스트 영역 클릭 → 다음 입력:
  ```
  이 set 에서 가장 도움 된 것 1개?
  ```
- 옵션 영역에서 "Required" 토글 → 해제 (모든 질문 optional)

### Step 2-5. 질문 2 추가

- 다시 "+" 버튼 클릭 → "Short answer" 선택
- 질문 텍스트:
  ```
  가장 답답한 것 1개?
  ```
- "Required" 해제

### Step 2-6. 질문 3 추가

- 다시 "+" 버튼 클릭 → **"Rating"** (별점 또는 1~5 점수) 선택
- 질문 텍스트:
  ```
  다시 풀러 올 의향은? (1=절대 안옴, 5=꼭 옴)
  ```
- 평가 척도: 1~5 lock (Tally 기본값)

### Step 2-7. Publish

- 화면 우측 상단 **"Publish"** 또는 **"Share"** 버튼 클릭
- "Share link" tab 클릭
- URL 표시됨 (예: `https://tally.so/r/abc123`)

### Step 2-8. URL 복사

- URL 우측 **"Copy"** 또는 복사 아이콘 클릭
- 또는 URL 전체 드래그 선택 후 Ctrl+C

### Step 2-9. URL 메모장에 임시 보관

- 메모장 열기 (Windows 시작 → "메모장" 검색)
- Ctrl+V 로 paste
- **임시 보관 — Part 3 에서 사용**

✓ Part 2 완료

---

## Part 3. handoff doc 에 Tally URL paste (2분)

### Step 3-1. handoff doc 열기

- 파일 탐색기 (Windows Explorer) 열기
- 경로 이동:
  ```
  C:\Users\downf\suneung-viewer
  ```
- **codeA_handoff_evidence_feedback.md** 파일 우클릭 → "연결 프로그램" → **"메모장"** 선택
  - 또는 VS Code 가 깔려 있으면 VS Code 로 열기

### Step 3-2. 검색·교체

- 파일이 열린 상태에서 Ctrl+F (검색)
- 검색 박스에 paste:
  ```
  REPLACE_WITH_USER_TALLY_URL
  ```
- 엔터 → 해당 텍스트가 hilight 됨

### Step 3-3. URL 교체

- 검색 박스 옆 "바꾸기" 또는 "Replace" 클릭 (메모장: Ctrl+H)
- 바꿀 내용에 Part 2 에서 복사한 Tally URL paste:
  ```
  https://tally.so/r/abc123    ← 본인 URL
  ```
- **"모두 바꾸기"** 또는 **"Replace All"** 클릭
- "1 개 항목이 바뀜" 메시지 확인

### Step 3-4. 저장

- Ctrl+S 로 저장

✓ Part 3 완료

---

## Part 4. Code A 채팅에 paste (3~5분)

### Step 4-1. 사전 점검 — git pull

- Windows + R → `cmd` 입력 → 엔터 (또는 PowerShell)
- 다음 명령어 입력:
  ```
  cd C:\Users\downf\suneung-viewer
  git status
  git pull origin main
  ```
- "Already up to date" 또는 "Fast-forward" 메시지 확인
- error 시 Claude 에게 메시지 paste 해서 보고

### Step 4-2. Code A (Claude Code) 진입

- 본인이 평소 Code A 사용하는 path:
  - Cursor 또는 VS Code Claude Code 확장 → 새 채팅
  - 또는 cmd / PowerShell 에서 `claude` 입력
  - 또는 ChatGPT-스타일 채팅 인터페이스

### Step 4-3. handoff doc 내용 복사

- 파일 탐색기에서 **codeA_handoff_evidence_feedback.md** 열기 (Part 3 와 같은 path)
- Ctrl+A (전체 선택) → Ctrl+C (복사)

### Step 4-4. Code A 채팅에 paste

- Code A 채팅 입력창 클릭
- Ctrl+V 로 paste
- 엔터 또는 send 버튼 클릭

### Step 4-5. Code A 작업 대기

- Code A 가 자동으로:
  1. saveEvidenceFeedback.js 생성
  2. FeedbackButton.jsx 생성 (Tally URL 자동 적용)
  3. QuizPanel.jsx 7 위치 편집
  4. App.jsx 2 위치 편집
- 작업 끝나면 Code A 가 **"[완료 보고]"** 형식으로 보고

### Step 4-6. 검증 — 로컬 빌드

- cmd / PowerShell 에서 다음 명령어:
  ```
  cd C:\Users\downf\suneung-viewer
  npm run dev
  ```
- 출력에 **"Local: http://localhost:5173"** 메시지 표시 확인
- error 표시되면 Code A 에게 error log paste

### Step 4-7. 검증 — 브라우저 확인

- Chrome 새 탭 → 주소창:
  ```
  http://localhost:5173
  ```
- 우측 하단 **"💬 베타 피드백"** 버튼 표시 확인 ✓
- Google 로그인 → /viewer 진입 → 임의 set 풀이 → 해설 표시
- 해설 하단 **"근거가 납득되시나요? 👍 납득 / 👎 안됨"** 표시 확인 ✓
- 👍 클릭 → "고맙습니다" 표시 확인 ✓

### Step 4-8. 검증 — Supabase 데이터 확인

- Part 1 의 Supabase Dashboard 다시 열기
- **Table Editor → evidence_feedback** 클릭
- row 1 개 표시 확인 (vote, year_key, set_id 등) ✓

### Step 4-9. 커밋·푸시

- 검증 모두 통과 시 Code A 에게 다음 paste:
  ```
  검증 통과. 커밋·푸시 진행해줘.
  ```
- Code A 가 자동으로 commit + push 실행
- error 시 Code A 가 보고

✓ Part 4 완료

---

## 전체 완료 후 확인 사항

| 영역                                | 사실 확인                            |
| ----------------------------------- | ------------------------------------ |
| Supabase `evidence_feedback` 테이블 | 존재 ✓                               |
| Tally form "베타 피드백 — 짚이"     | publish 됨 ✓                         |
| FeedbackButton.jsx Tally URL        | 실제 URL 적용 ✓                      |
| 라이브 (suneung-viewer.vercel.app)  | 자동 재배포 (Vercel 자동) — 5분 대기 |

## 문제 발생 시 — Claude 에게 보고할 정보

1. 어느 Part / Step 에서 막혔는지
2. 화면 캡쳐 (Ctrl+Shift+S 또는 Snipping Tool)
3. error 메시지 text

→ Claude 채팅에 위 3개 paste

---

## 본 가이드 이후 다음 액션 (사용자 결정)

1. **Tally 모집 form 따로 만들기** (베타 사용자 모집용 — 기존 TALLY_URL 과 별도)
2. **베타 모집 개시 시점 결정** (개인정보처리방침 deploy 후)
3. **베타 14일 후 KPI 측정** — Supabase 에서:
   ```sql
   select
     count(*) as total_votes,
     sum(case when vote then 1 else 0 end) as accepted,
     round(100.0 * sum(case when vote then 1 else 0 end) / count(*), 1) as accept_rate_pct
   from evidence_feedback;
   ```
   → 목표 lock: ≥ 85%
