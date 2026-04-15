---
name: suneung-frontend-skill
description: 수능 국어 뷰어 프론트엔드 작업.
  React 컴포넌트 수정, 버그 수정, UI 개선.
  "버그 고쳐줘", "컴포넌트 수정해줘", "화면 수정해줘"라고 할 때 사용.
---

# 프론트엔드 — 수능 뷰어

> 갱신: 2026-04-14 | https://suneung-viewer.vercel.app
> bash 사용 (PowerShell && 불가 → ;)

---

## 담당 / 금지

담당: `src/*.jsx`, `api/*.js`, `src/constants.js`, `src/hooks/*`
금지: `public/data/all_data_204.json` 직접 수정 (읽기만 가능)
git push: 작업 완료 후 단독. 파이프라인 채팅과 동시 push 금지.
**작업 시작 전 git pull 필수**

---

## ok / pat 규칙

```
ok: true  = 지문 사실 일치 (발문 유형 무관)
ok: false = 지문 사실 불일치
questionType: positive → ok:true가 정답
questionType: negative → ok:false가 정답
pat: ok:false일 때만 R1~R4(독서) / L1~L5(문학). ok:true면 반드시 null.
```

---

## 연도키 규칙

```
수능·9월: key = 시행연도+1  →  2024년 9월 = "2025_9월"
6월:      key = 시행연도    →  2022년 6월 = "2022_6월"
A/B형: "2016수능A", "2016수능B"
```

---

## 데이터 스키마

```
데이터 파일: public/data/all_data_204.json (단일 진실)
Choice:  { num, t, ok, pat, analysis, cs_ids: ["sentId"] }
Sent:    { id, t, sentType, cs: ["q1_c3"] }
sentId:  {setId}s{번호}  예: r2026as1  ← 언더스코어 없음
sentType: body | verse | workTag | author | footnote | omission | figure
bogi:    string | { type: 'annotated_image' } | { type: 'diagram' }
bogiType: "table" → BogiTable (bogi와 독립 렌더링)
기호:    [[sym:KEY]] → renderWithSymbols() → <img>
```

---

## 작업 원칙

- str_replace 직접 수정 가능. 수정 후 반드시 `npm run build` 확인
- BogiRenderer 패턴 — 새 보기 타입은 내부에만. `hasBogiXxx` 조건 누적 금지
- JSX 괄호 검증 (수정 후 필수):

```bash
node -e "const c=require('fs').readFileSync('src/파일.jsx','utf8');let o=0,cl=0;for(const ch of c){if(ch==='{')o++;if(ch==='}')cl++;}console.log('diff:',o-cl);"
```

---

## 세션 시작

```bash
cd C:/Users/downf/suneung-viewer  # 노트북 / PC는 /e/suneung-viewer
git pull
git log --oneline -3 && git status
npm run build 2>&1 | tail -5
```

---

## 3가지 모드 핵심

```javascript
// 복습 모드 형광펜
<PassagePanel mode={isReview ? MODE.VIEW : mode} />
// ReportModal 복습 차단
if (!autoShownRef.current && !isReview) { ... }
// 보기 모드 answered 차단
function handleSelect(uid, choice) { if (!isStudy) return; ... }
```

---

## 재발 방지 버그

```javascript
// [B1] isCorrect
const isCorrect = questionType==='positive' ? choice.ok===true : choice.ok===false;
// [B2] 어휘 문제 형광펜 차단
onSelect(isVocab ? null : uid, choice);
// [B3] handleSubmitAll
try { await saveAnswer(...) } catch(e) { console.warn(e) }
setSubmitted(true); // 루프 이후 무조건
// [B4] 복습 모드 형광펜
<PassagePanel mode={isReview ? MODE.VIEW : mode} />
```

---

## 완성된 기능 (2026-04-14 기준)

| 기능 | 파일 | 상태 |
|---|---|---|
| 랜딩 + waitlist 폼 | `Landing.jsx` | ✅ |
| 학원 원장 데모 | `/academy-preview` | ✅ |
| 패턴 리포트 공유 버튼 | `PatternReport.jsx` | ✅ |
| 풀이/보기/복습 모드 | `App.jsx + QuizPanel.jsx` | ✅ |
| AI 코칭·훈련 | `PatternCoach, PatternTrainer` | ✅ |
| 결제 | `Payment.jsx` | ✅ 토스 심사 대기 |
| AI 라우팅 | `api/claude.js` | ✅ |
| 형광펜 자동 스크롤 | `PassagePanel.jsx` | ✅ |
| Landing 인터랙티브 미니 데모 | `Landing.jsx` | ✅ |
| ResultPage 전환 유도 배너 | `ResultPage.jsx` | ✅ |
| PatternReport AI 진단 메시지 | `PatternReport.jsx` | ✅ |
| YEAR_INFO 그룹 정렬 | `constants.js` | ✅ |

---

## 환경변수

```
VITE_SUPABASE_URL / ANON_KEY  ✅ Vercel + .env.local
ANTHROPIC_API_KEY             ✅ Vercel
GEMINI_API_KEY                ✅ .env.local (Vercel도 추가 필요)
VITE_TOSS_CLIENT_KEY          ⚠️ 토스 심사 대기
```

---

## Supabase

```sql
user_answers:  user_id, year_key, set_id, question_id, choice_num, is_correct, pat TEXT
subscriptions: plan, status, expires_at (NULL=영구)
question_comments: question_key, user_question, ai_answer
waitlist:      academy_name, phone, student_count
is_pro(): status='active' AND (expires_at IS NULL OR expires_at > now())
마스터: 2a6f527d-fbec-4c95-b56b-ef7a0aaa6fdd (pro, 영구)
```

---

## URL

```
/                         Landing(비로그인) / MainPage(로그인)
/auth                     AuthPage
/viewer?year=&set=&mode=  ViewerPage
/academy-preview          학원 원장용 데모 (로그인 불필요)
/report  /wrongnote  /payment
```

---

## 🔴 작업 큐 (우선순위)

| 순위 | 작업 | 비고 |
|---|---|---|
| 1 | **2025수능 해설 ID 잔재 제거** | B 세션 처리 대기 |
| 2 | **2026수능 Q12 보기 이미지** | alt 캡션 + 이미지 연결 확인 |
| 3 | **이미지 alt 캡션** | B 세션 처리 대기 |
| 4 | **Supabase RLS** | user_answers 정책 점검 |
| 5 | 어휘 해설 블록 구조화 | reanalyze_vocab 완료 후 |
| 6 | 번들 최적화 | chunks > 500kB |
