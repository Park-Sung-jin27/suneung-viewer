# Code A 작업 지시 — 베타 KPI 1차 패치

> 작성: 품질 심사관 (2026-05-15) · 사용자(성진) 검토 후 paste
> 목표: 베타 오픈 직전 추가 기능 2개
>
> 1. **선지별 "근거 납득" KPI** (형광펜 차별점 검증용 1-클릭 측정)
> 2. **Tally 피드백 위젯** (우측 하단 floating button)

---

## 사전 조건 (사용자 = 성진 실행)

### A. Supabase SQL 실행

Supabase Dashboard → SQL Editor 에 아래 paste 후 RUN:

```sql
-- evidence_feedback (선지별 형광펜 근거 납득률 KPI)
create table if not exists public.evidence_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  year_key text not null,
  set_id text not null,
  question_id int not null,
  choice_num int not null,
  vote boolean not null,             -- true = 납득됨 / false = 안됨
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

### B. Tally 피드백 form 생성 (5분)

1. Tally → 신규 form 생성 ("베타 피드백 — 짚이")
2. 질문 **3개만** lock:
   - "이 set 에서 가장 도움 된 것 1개?" (단답)
   - "가장 답답한 것 1개?" (단답)
   - "다시 풀러 올 의향 1~5?" (1~5 평점)
3. Publish → URL 복사 (예: `https://tally.so/r/XXXXXX`)
4. 본 URL 을 Step 2 의 `TALLY_FEEDBACK_URL` 자리에 paste

---

## Step 1. 신규 파일 — `src/saveEvidenceFeedback.js`

**Action**: Create new file
**경로**: `src/saveEvidenceFeedback.js`

```js
import { supabase } from "./supabase";

export async function saveEvidenceFeedback({
  user,
  yearKey,
  setId,
  questionId,
  choiceNum,
  vote,
}) {
  try {
    await supabase.from("evidence_feedback").insert({
      user_id: user?.id ?? null,
      year_key: yearKey,
      set_id: setId,
      question_id: questionId,
      choice_num: choiceNum,
      vote,
    });
  } catch (err) {
    console.warn("[saveEvidenceFeedback] 실패:", err.message);
  }
}
```

---

## Step 2. 신규 파일 — `src/FeedbackButton.jsx`

**Action**: Create new file
**경로**: `src/FeedbackButton.jsx`

```jsx
import { useState } from "react";

// 사용자 (성진) Tally URL 로 교체 의무
const TALLY_FEEDBACK_URL = "https://tally.so/r/jaJZEY";

export default function FeedbackButton() {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={() =>
        window.open(TALLY_FEEDBACK_URL, "_blank", "noopener,noreferrer")
      }
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 999,
        background: hover ? "#1f2937" : "#374151",
        color: "#fff",
        border: "none",
        borderRadius: "50px",
        padding: "12px 18px",
        fontFamily: "'Noto Sans KR', sans-serif",
        fontSize: "0.85rem",
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        transition: "background 0.15s",
      }}
      aria-label="피드백 보내기"
    >
      💬 베타 피드백
    </button>
  );
}
```

---

## Step 3. 편집 — `src/QuizPanel.jsx`

**Action**: Edit (7 위치)
**파일 크기**: 1339 lines

### 3-1. import 추가 (line 4 다음)

기존 (line 1~4):

```js
import { useState, useEffect, useRef } from "react";
import { P, CC, MODE, SYMBOLS } from "./constants";
import { BogiTable } from "./BogiTable";
import QuestionQA from "./QuestionQA";
```

추가 (line 5):

```js
import { saveEvidenceFeedback } from "./saveEvidenceFeedback";
```

### 3-2. ChoiceItem props 확장 (line 477~489)

기존:

```js
function ChoiceItem({
  choice,
  qid,
  questionType,
  clicked,
  myAnswer,
  onSelect,
  mode,
  submitted,
  isReview,
  isVocab,
  passageSents,
}) {
```

변경:

```js
function ChoiceItem({
  choice,
  qid,
  questionType,
  clicked,
  myAnswer,
  onSelect,
  mode,
  submitted,
  isReview,
  isVocab,
  passageSents,
  user,
  yearKey,
  setId,
}) {
```

### 3-3. ChoiceItem 안 vote state 추가 (line 490 직전)

기존 (line 490):

```js
const uid = `q${qid}_c${choice.num}`;
```

직전에 추가:

```js
const [evidenceVote, setEvidenceVote] = useState(null);
```

### 3-4. 해설 블록 안 KPI 버튼 추가 (line 692~694 부근)

기존 (line 691~695):

```jsx
          ) : (
            <AnalysisBlock text={choice.analysis} />
          )}
        </div>
      )}
```

변경:

```jsx
          ) : (
            <AnalysisBlock text={choice.analysis} />
          )}
          {/* 근거 납득 KPI — 베타 측정용 */}
          <div
            style={{
              marginTop: "10px",
              paddingTop: "8px",
              borderTop: "1px dashed #d1d5db",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.72rem",
              color: "#6b7280",
              flexWrap: "wrap",
            }}
          >
            <span>근거가 납득되시나요?</span>
            <button
              disabled={evidenceVote !== null}
              onClick={(e) => {
                e.stopPropagation();
                setEvidenceVote(true);
                saveEvidenceFeedback({
                  user,
                  yearKey,
                  setId,
                  questionId: qid,
                  choiceNum: choice.num,
                  vote: true,
                });
              }}
              style={{
                border: "1px solid #d1d5db",
                background: evidenceVote === true ? "#dcfce7" : "#fff",
                borderRadius: "12px",
                padding: "3px 10px",
                cursor: evidenceVote === null ? "pointer" : "default",
                fontSize: "0.72rem",
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              👍 납득
            </button>
            <button
              disabled={evidenceVote !== null}
              onClick={(e) => {
                e.stopPropagation();
                setEvidenceVote(false);
                saveEvidenceFeedback({
                  user,
                  yearKey,
                  setId,
                  questionId: qid,
                  choiceNum: choice.num,
                  vote: false,
                });
              }}
              style={{
                border: "1px solid #d1d5db",
                background: evidenceVote === false ? "#fee2e2" : "#fff",
                borderRadius: "12px",
                padding: "3px 10px",
                cursor: evidenceVote === null ? "pointer" : "default",
                fontSize: "0.72rem",
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              👎 안됨
            </button>
            {evidenceVote !== null && (
              <span style={{ color: "#10b981", fontWeight: 600 }}>
                고맙습니다
              </span>
            )}
          </div>
        </div>
      )}
```

### 3-5. QuestionBlock props 확장 (line 712~724)

기존:

```js
function QuestionBlock({
  question,
  passageId,
  sel,
  onSelect,
  mode,
  submitted,
  isReview,
  initialClicked,
  yearKey,
  passageSents,
  user,
}) {
```

변경 (`setId` 추가):

```js
function QuestionBlock({
  question,
  passageId,
  sel,
  onSelect,
  mode,
  submitted,
  isReview,
  initialClicked,
  yearKey,
  passageSents,
  user,
  setId,
}) {
```

### 3-6. ChoiceItem 호출 props 전달 (line 843~856)

기존:

```jsx
<ChoiceItem
  key={c.num}
  choice={c}
  qid={question.id}
  questionType={question.questionType ?? "negative"}
  clicked={clicked}
  myAnswer={initialClicked ?? null}
  onSelect={handleClick}
  mode={mode}
  submitted={submitted}
  isReview={isReview}
  isVocab={isVocab}
  passageSents={passageSents}
/>
```

변경 (`user`, `yearKey`, `setId` 추가):

```jsx
<ChoiceItem
  key={c.num}
  choice={c}
  qid={question.id}
  questionType={question.questionType ?? "negative"}
  clicked={clicked}
  myAnswer={initialClicked ?? null}
  onSelect={handleClick}
  mode={mode}
  submitted={submitted}
  isReview={isReview}
  isVocab={isVocab}
  passageSents={passageSents}
  user={user}
  yearKey={yearKey}
  setId={setId}
/>
```

### 3-7. QuestionBlock 호출 setId 전달 (line 1246~1263)

기존:

```jsx
<QuestionBlock
  key={`${passageSet.id}-${q.id}`}
  question={q}
  passageId={passageSet.id}
  sel={sel}
  onSelect={handleSelect}
  mode={mode}
  submitted={submitted}
  isReview={isReview}
  initialClicked={
    studyAnswers[q.id] != null ? `q${q.id}_c${studyAnswers[q.id]}` : undefined
  }
  yearKey={yearKey}
  passageSents={passageSet.sents}
  user={user}
/>
```

변경 (`setId={setId}` 추가):

```jsx
<QuestionBlock
  key={`${passageSet.id}-${q.id}`}
  question={q}
  passageId={passageSet.id}
  sel={sel}
  onSelect={handleSelect}
  mode={mode}
  submitted={submitted}
  isReview={isReview}
  initialClicked={
    studyAnswers[q.id] != null ? `q${q.id}_c${studyAnswers[q.id]}` : undefined
  }
  yearKey={yearKey}
  passageSents={passageSet.sents}
  user={user}
  setId={setId}
/>
```

---

## Step 4. 편집 — `src/App.jsx`

**Action**: Edit (2 위치)

### 4-1. import 추가

기존 (다른 component import 부근):

```js
// 기타 import 들...
```

추가 (한 줄):

```js
import FeedbackButton from "./FeedbackButton";
```

### 4-2. Layout 함수 안 children 다음 추가 (line 238~241 부근)

기존 (line 238~241):

```jsx
      <Header user={user} onLogout={onLogout} />
      {children}
    </>
  );
}
```

변경:

```jsx
      <Header user={user} onLogout={onLogout} />
      {children}
      <FeedbackButton />
    </>
  );
}
```

---

## 검증 (Code A 의무)

```bash
npm run dev
```

1. localhost:5173 진입
2. **우측 하단 "💬 베타 피드백" floating button 표시 확인**
3. Google 로그인 → /viewer 진입 → 임의 set 선택 → 문제 풀이
4. 정답 선지 클릭 → 해설 표시 확인 → 해설 하단 "근거가 납득되시나요? 👍 납득 / 👎 안됨" 표시 확인
5. 👍 클릭 → "고맙습니다" 표시 확인 → 버튼 disabled 확인
6. Supabase Dashboard → Table Editor → evidence_feedback → row 1개 INSERT 확인
7. 오답 선지 클릭 → 동일 path 검증
8. 빌드 검증: `npm run build` → error 0 확인

완료 보고 format:

```
[완료 보고]
작업: 베타 KPI 1차 패치 (evidence_feedback + FeedbackButton)
완료 기준 충족: Y/N
결과:
문제:
다음 액션 1개:
```

---

## 비고 (사용자 검토 영역)

| 영역                          | 결정                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| ChoiceItem evidenceVote state | unmount 시 reset — 같은 user 같은 선지 중복 vote 가능. 베타 14일 한정 무시. 정식 출시 시 RLS unique constraint 추가 |
| FeedbackButton 표시 범위      | Landing 포함 전 페이지 — 의도된 행동 (베타 모집 path 사용자가 즉시 피드백 가능)                                     |
| TALLY_FEEDBACK_URL hardcode   | 환경변수 분리 옵션: `import.meta.env.VITE_TALLY_FEEDBACK_URL`. 현 패치는 단순화 우선                                |
| 어휘 문제 (isVocab)           | 형광펜 연동 없으나 KPI 버튼 동일 표시 — 어휘 해설 납득률 별도 측정 가치 있음                                        |

---

## 절대 금지 (CLAUDE.md 정합)

- ❌ `public/data/all_data_204.json` 수정 (해당 패치 영역 X)
- ❌ Code B 와 동시 push
- ❌ 패치 작업 중 PowerShell `&&` 체이닝 (→ `;` 사용)

## 다음 액션 (사용자 검토 후 사용자 실행)

1. Supabase SQL 실행 (사전 조건 A)
2. Tally form 생성 + URL 복사 (사전 조건 B)
3. 본 doc 전체를 Code A 채팅에 paste
4. Code A 완료 보고 검수 → main push
5. Tally URL → FeedbackButton.jsx line 3 교체 후 재배포 (5분)
