# 수능 뷰어 — CLAUDE.md

> 갱신: 2026-04-15 | https://suneung-viewer.vercel.app
> 루트 기준. pipeline/CLAUDE.md와 src/CLAUDE.md는 이 파일을 상속.

---

## 이 프로젝트가 존재하는 이유

수능 국어를 못하는 학생들은 "문해력이 부족해서", "책을 안 읽어서"라고 생각한다.
하지만 평가원 기출문제의 모든 답 근거는 지문 안에 있다.
지문에서 근거를 찾는 훈련을 반복하면 문해력과 논리적 추론이 자연스럽게 좋아진다.

**이 제품은 그것을 시각적으로 증명한다.**
형광펜으로 지문-선지를 1:1 연결해서, 학생 스스로 "답이 지문에 있다"는 것을 눈으로 확인하게 만든다.
그 경험이 쌓이면 자신감이 생기고, 성적이 오른다.

---

## 핵심 차별점

```
모든 선지에 지문 근거 문장을 형광펜(cs_ids)으로 1:1 시각 연결
→ "왜 맞는지", "어디서 틀렸는지"를 지문에서 직접 확인
→ 단순 정답 안내가 아니라 사고 과정을 훈련하는 도구
```

---

## AI 운영 원칙

### 역할 분담
```
AI:    90% 처리 — 추출, 해설 생성, cs_ids 매핑, 품질 검증, 분류
성진님: 10% 판단 — AI가 이슈를 감지해서 올린 건만 수동 확인
성진님의 판단 → 프롬프트에 즉시 반영 → 전체 퀄리티 상승
```

### 가장 중요한 원칙
**당면한 문제만 해결하지 말 것.**
문제가 발생하면 반드시 근본 원인을 찾아 파이프라인(step 파일)을 수정하라.
일회성 패치 스크립트 생성은 레거시를 쌓는 행위다. 절대 금지.

### 해설 품질 철학
```
150자 미만 = 부실해설이 아니다.

진짜 부실 해설 =
  선지 조건을 분해하지 않은 것
  가/나/다를 개별 검증하지 않은 것
  "없다"만 쓰고 왜 없는지 설명 안 한 것
  성진님이 수업할 때 설명하는 방식과 다른 것
```

해설 퀄리티는 무한히 좋아질 수 있다.
성진님이 "이건 이렇게 설명해야 해"라고 판단하면 → step3 프롬프트에 즉시 반영.
이 사이클이 반복될수록 AI가 생성하는 해설이 성진님의 수업 방식에 가까워진다.

### 품질 검증 구조
```
백그라운드에서 AI가 자동 감지 → 이슈 있는 것만 성진님에게 올림
성진님은 전체를 보지 않아도 된다. 문제 있는 것만 판단하면 된다.

quality_gate.mjs       → 전체 품질 검사 (단일 진입점)
reanalyze_positive.mjs → 부실/반전/빈 해설 자동 재생성

needsRewrite() 감지 기준:
  - 빈 해설
  - ok:true인데 부정 표현 포함 (반전)
  - ok:false인데 긍정 표현 포함 (반전)
  - AI 잔재 (영어 10자 이상, "지문이 제공되지 않았으나" 등)
```

---

## 해설 4단계 원칙 (step3 프롬프트 핵심)

```
1단계: 선지 조건 분해
  복합 조건(A하며 B를 C)은 ①②③으로 분리해서 각각 지문에서 검증

2단계: 작품별 개별 검증 (복수 작품 문항 필수)
  가/나/다 각각 "이 작품에서 조건이 성립하는가" 개별 확인
  공통점 문항 = 모든 작품에서 동시에 성립해야 정답
  일부만 해당하면 어느 작품에 있고 어느 작품에 없는지 명시

3단계: 혼동 포인트 명시
  "없다"가 아니라 "~처럼 보이지만 실제로는 ~이다"
  예) "관용처럼 보이지만 실제로는 만족감이다"
      "소통처럼 보이지만 일방적 서술이다"

4단계: 결론 한 줄
  어떤 조건이 왜 불충족인지 3~4등급 학생이 이해할 수 있는 말로
```

---

## ok / pat / cs_ids 규칙

```
ok: true  = 지문 사실 일치 (발문 유형 무관)
ok: false = 지문 사실 불일치
questionType: positive → ok:true가 정답
questionType: negative → ok:false가 정답
pat: ok:false일 때만 R1~R4(독서) / L1~L5(문학). ok:true면 반드시 null.

cs_ids:
  ok:true              → 사실 일치의 근거 문장 ID
  ok:false + R1/R2/R4  → 왜곡의 출처가 된 원문 문장 ID
  ok:false + R3        → [] (지문에 없는 내용이므로)
  ok:false + V         → [] (어휘 치환 문항)
  ok:false + L3        → 부분 일치 작품의 sentId (단, "작품 전체" 불가)
```

---

## 데이터 스키마

```
데이터 파일: public/data/all_data_204.json (단일 진실)
어노테이션:  public/data/annotations.json

Choice:   { num, t, ok, pat, analysis, cs_ids: ["sentId"] }
Sent:     { id, t, sentType, cs: ["q1_c3"] }
sentId:   {setId}s{번호}  예: r2026as1  ← 언더스코어 없음
sentType: body | verse | workTag | author | footnote | omission | figure
bogi:     string | { type: 'annotated_image' } | { type: 'diagram' }
기호:     [[sym:KEY]] → renderWithSymbols() → <img>
```

---

## 연도키 규칙

```
수능·9월: key = 시행연도+1  →  2024년 9월 = "2025_9월"
6월:      key = 시행연도    →  2022년 6월 = "2022_6월"
A/B형:    "2016수능A", "2016수능B"
구형(2021이하): 16~45번 통합
신형(2022이상): reading 1~17 / literature 18~34
```

---

## 담당 영역

| | Claude Code A (프론트엔드) | Claude Code B (파이프라인) |
|---|---|---|
| 담당 | `src/*.jsx` `api/*.js` `src/constants.js` | `pipeline/*` `public/data/all_data_204.json` |
| 금지 | `all_data_204.json` 직접 수정 | `src/*.jsx` 수정 |
| git push | UI 작업 완료 후 단독 | 데이터 작업 완료 후 단독 |

**동시 push 절대 금지 / 작업 시작 전 git pull 필수**

---

## 파이프라인 구조

```
step1_answer.js      → 정답 추출
step2_extract.js     → 지문/문항 추출 (Gemini)
step3_analysis.js    → 해설 생성 (Claude Opus) ← 4단계 원칙 반영됨
step4_csids.js       → cs_ids 매핑 + --retarget 모드
step5_verify.js      → 검증
step6_merge.js       → 병합
step7_deploy.js      → 배포
─────────────────────────────────────────────
quality_gate.mjs          → 품질 검사/자동수정 (단일 진입점)
reanalyze_positive.mjs    → 해설 재생성 (부실/반전/빈) ← needsRewrite() 기준
reanalyze_bogi.js         → 보기 문항 재분석
reanalyze_vocab.mjs       → 어휘 문항 재분석
─────────────────────────────────────────────
pipeline/archive/         → 재사용 가능성 있는 이전 스크립트
  fix_dead_csids.cjs      ← 전체 시험 확장 예정 (DEAD_csid 699건)
  fix_ai_leak.cjs         ← AI 잔재 제거
```

---

## 데이터 품질 현황 (2026-04-15)

### 2022~2026수능 5개 시험
| 항목 | 상태 |
|---|---|
| DEAD cs_ids | ✅ 0건 |
| AI노출/ID잔재 | ✅ 0건 |
| pat:null (ok:false) | ✅ 0건 |
| 부실해설 재생성 | ✅ 87건 완료 |
| quality_gate --fix | ✅ 546건 완료 |

### 전체 시험 (48개) 잔여 이슈
| 유형 | 건수 | 다음 조치 |
|---|---|---|
| DEAD_csid | 699건 | fix_dead_csids.cjs 전체 시험 확장 |
| F_content_reversed | 209건 | reanalyze_positive.mjs all |
| E_pat_unclassifiable | 190건 | 수동 검토 |
| F_empty_analysis | 25건 | reanalyze_positive.mjs |

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
/academy-preview          학원 원장용 데모
/report  /wrongnote  /payment
```

---

## 절대 원칙

```
[1] 일회성 패치 스크립트 생성 금지
    문제 발생 → 근본 원인 파악 → 파이프라인 step 파일 수정
    node -e 인라인 또는 기존 파이프라인 활용만 허용

[2] 성진님의 수동 판단은 반드시 프롬프트에 반영
    판단을 일회성으로 적용하지 말 것. step3 원칙으로 만들 것.
    이 사이클이 해설 퀄리티를 계속 높인다.

[3] 당면 문제만 해결하지 말 것
    부분 수정보다 전체 설계를 개선하는 방향으로 판단하라.

[4] 데이터 무결성
    세트 교체 시 대상 세트만 교체. 정상 세트 미접촉.
    수정 전 항상 영향 범위 먼저 확인.

[5] Git 동시 push 금지
    Code A / Code B 동시 push 절대 금지.

[6] PowerShell 제약
    && 체이닝 미지원 → ; 사용

[7] JSX 수정 후 필수 검증
    npm run build 확인
    괄호 검증: node -e "..." diff:0 확인
```
