# CLAUDE.md — Code A (프론트엔드)

> 갱신: 2026-04-16 | https://suneung-viewer.vercel.app

---

## 담당 영역

| | Code A |
|---|---|
| 담당 | `src/*.jsx`, `api/*.js`, `src/constants.js`, `src/dataLoader.js` |
| 금지 | `public/data/all_data_204.json` 직접 수정 |

**동시 push 절대 금지 / 작업 전 git pull 필수**

---

## 핵심 구조

```
src/
├── App.jsx           ← 메인 라우팅, 연도 로딩, isPro 전달
├── PassagePanel.jsx  ← 지문 렌더링, 형광펜 (span 렌더링 완료)
├── QuizPanel.jsx     ← 선지 렌더링, 정오 표시, 해설
├── dataLoader.js     ← JSON 로딩, cs_ids→cs 역매핑, csSpans 생성
├── Landing.jsx       ← 랜딩 페이지
├── Payment.jsx       ← 결제 (Toss 승인 대기)
└── constants.js      ← FREE_YEARS, CC(색상), 패턴 정의
```

---

## 형광펜 작동 구조

```
단일 진실값: choice.cs_ids + choice.cs_spans
흐름:
  choice.cs_ids → dataLoader._buildSentCs() → sent.cs → PassagePanel getHL() → 전체 하이라이트
  choice.cs_spans → dataLoader._buildSentCs() → sent.csSpans → PassagePanel renderWithSpans() → 부분 하이라이트

cs_spans 있으면: 해당 어구만 부분 하이라이트
cs_spans 없으면: sent 전체 하이라이트 (fallback)
text.indexOf 실패 시: 전체 하이라이트 (fallback)
```

---

## span 렌더링 (완료)

```jsx
// dataLoader._buildSentCs 확장
// s.csSpans = { "q1_c3": ["단풍의 손바닥", ...] }

// getHL 반환
{ pal, spans }  // spans: ["어구1", ...] | null

// renderWithSpans
// text.indexOf로 어구 위치 찾아 3분할 렌더링
// spans 없으면 기존 전체 하이라이트 fallback
```

---

## 무료/Pro 범위

```js
// constants.js
FREE_YEARS = ["2026수능", "2025수능", "2024수능", "2023수능", "2022수능"]
// 위 5개는 무료, 나머지는 Pro 전용
```

---

## 오답 패턴 (9종)

```
독서: R1 사실왜곡 / R2 인과전도 / R3 과잉추론 / R4 개념혼합
문학: L1 표현오독 / L2 정서오독 / L3 주제과잉 / L4 구조오류 / L5 보기대입오류
어휘: V (패턴 수 제외)
```

---

## 완료된 UI 기능

| 기능 | 파일 | 상태 |
|---|---|---|
| 랜딩 + 14일 기준 | Landing.jsx | ✅ |
| 풀이/보기/복습 모드 | App.jsx + QuizPanel.jsx | ✅ |
| 형광펜 span 렌더링 | PassagePanel.jsx + dataLoader.js | ✅ |
| 이미지 bogi (annotated_image) | PassagePanel.jsx | ✅ |
| imagePosition:right | PassagePanel.jsx | ✅ |
| isPro 런타임 에러 수정 | App.jsx | ✅ |
| 무료 범위 5개 수능 | constants.js | ✅ |
| AI Q&A / PatternCoach | 별도 컴포넌트 | ✅ |
| 결제 | Payment.jsx | ✅ (Toss 승인 대기) |

---

## 대기 중인 작업

**[A-3] 랜딩 오답 패턴 9종 표기**
- 메인 카피: "반복되는 오답 패턴" (숫자 전면 금지)
- 상세 섹션: 독서 4종 / 문학 5종

**Google OAuth 최종 확인**
- 배포 환경 동작 확인 필요

---

## 절대 금지

```
- public/data/all_data_204.json 직접 수정
- pipeline/* 수정
- Code B와 동시 push
- PowerShell && 체이닝 (→ ; 사용)
```

---

## 완료 보고 형식

```
[완료 보고]
작업:
완료 기준 충족: Y/N
결과:
문제:
다음 액션 1개:
```
