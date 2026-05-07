# 프론트엔드 — CLAUDE.md

> base: `../../CLAUDE.md` (루트 CLAUDE.md 의 모든 원칙 적용)
> 본 문서: 프론트엔드 영역 specific 규칙만 추가

---

## 역할

React/Vite + Supabase + UX 담당.

- 환경: **Claude Code** (로컬 실행)
- 권한: git push 가능 (Chat 2 영역만)
- 채팅 영역: 프론트엔드·제품 (Chat 2)

---

## 자율 권한

- React 컴포넌트 작성·수정
- CSS / 스타일 변경
- 클라이언트 API 호출 (Anthropic / Supabase)
- 새 페이지 / 라우트 추가
- 사용자 입력 받는 UI 변경

## 사용자 confirm 의무

- Supabase schema 변경 (신규 테이블, RLS 정책)
- API key 노출 가능 영역
- `public/data/all_data_204.json` 직접 수정 (이건 데이터 엔지니어 영역)
- pipeline/* 수정 (이건 데이터 엔지니어 영역)
- production 배포 (Vercel deployment)

## 절대 금지

- `public/data/all_data_204.json` 직접 수정 (정본 — 데이터 엔지니어 영역)
- `pipeline/*` 수정 (데이터 엔지니어 영역)
- JSX 부분 패치 (Python string replacement) — 완전 파일 재작성만
- 가산적 조건 분기 (예: `hasBogiImage`, `hasBogiTable` 같은 flag 누적) → 단일 통합 컴포넌트 (예: BogiRenderer)
- 결제 정보 client side 처리

---

## 핵심 컴포넌트

| 컴포넌트 | 역할 |
|---|---|
| `App.jsx` | 라우터 + 전역 상태 |
| `PassagePanel.jsx` | 지문 + 형광펜 (cs_ids 1:1 매핑 시각화 — 핵심 차별점) |
| `QuizPanel.jsx` | 선지 + 클릭 + 해설 표시 |
| `BogiRenderer.jsx` | 보기 통합 렌더 (image / table / text 모두) |
| `Landing.jsx` | 랜딩 페이지 |
| `Payment.jsx` | Toss 결제 (가맹점 승인 대기) |
| `WrongNote.jsx` | 오답노트 |
| `PatternReport.jsx` | 패턴 리포트 |

---

## Supabase 사용 영역

| 테이블 | 역할 |
|---|---|
| `user_sessions` | 학습 세션 |
| `user_answers` | 선지 클릭 기록 |
| `user_stats` | 누적 통계 |
| `subscriptions` | 구독 상태 |
| `question_comments` | 문항별 댓글 |

향후 추가 예정 (전략 결정 사후):
- `feedback_logs` (선지별 피드백 — Top 1 기능)
- `error_reports` (오류 신고)

---

## 즉시 구현 후보 (전략가 산출물 정합)

전략가 + 품질 심사관 검수 결과 즉시 구현 후보 4건:

1. **선지별 피드백 버튼** (Choice Feedback v0) — 1순위
   - 학생 피드백: [근거 납득됨] [아직 헷갈림] [근거/해설 이상함]
   - Supabase `feedback_logs` 신규 테이블

2. **문항별 오류 신고** — 2순위
   - QA 결함 발견 직접 도구
   - Supabase `error_reports` 신규 테이블

3. **오답 패턴 미니 카드** — 3순위
   - `pat: "R1"` → "사실 반대로 읽음" 한글 변환
   - frontend 단순 mapping (데이터 구조 변경 0)

4. **세트 종료 1분 리포트** — 4순위
   - client side 집계 (정답률 + 패턴 분포)

세부는 `docs/current_state.md` 참조.

---

## 디자인 원칙

- 모바일 우선 (수능 학습자 다수 모바일 사용)
- 형광펜 (cs_ids 매핑) 시각 충실 — 핵심 차별점
- 3~4등급 학습자 친화 (한글 라벨 우선, 용어는 평이하게)
- 빠른 인터랙션 (선지 클릭 → 즉시 형광펜)

---

## 회기 종결 의무

1. Vercel 빌드 통과 확인 (`npm run build`)
2. `git status` clean
3. push 완료
4. `docs/current_state.md` 진행 상황 1줄 갱신
