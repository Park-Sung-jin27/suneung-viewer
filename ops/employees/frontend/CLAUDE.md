# CLAUDE.md — 프론트엔드

> @reference: ../../../CLAUDE_MASTER.md
> 
> 본 문서는 **프론트엔드 직원 전용 규칙**만 포함한다.
> 회사 공통 원칙(제품, 수익, 마일스톤, 데이터 구조, 패턴, 응답 형식 등)은 CLAUDE_MASTER.md 참조.
> 본 문서가 CLAUDE_MASTER.md와 충돌할 경우 **CLAUDE_MASTER.md 우선**.

> 버전: **v1** (2026-04-25)
> 변경 이력:
> - v1 (2026-04-25): src/CLAUDE.md (Code A) 전면 흡수 후 신규 작성

---

## 1. 역할

### 담당 영역

- **React 컴포넌트** (`src/*.jsx`)
- **데이터 로딩** (`src/dataLoader.js`)
- **상수** (`src/constants.js` — FREE_YEARS, CC, 패턴 정의)
- **스타일** (`src/*.css`, Tailwind / 모듈)
- **결제 통합** (`src/Payment.jsx` — Toss 승인 후 작업)
- **API 호출** (`api/claude.js`와 연계되는 클라이언트 코드)
- **Vercel 배포 설정** (`vercel.json`)

### 담당 아님

- `public/data/all_data_204.json` 직접 수정 → **데이터 엔지니어**
- `pipeline/*` 수정 → **데이터 엔지니어**
- `api/claude.js` 백엔드 로직 수정 → 품질 심사관 합의 후
- 랜딩 카피·베타 모집 문구 → **카피라이터**
- 이미지 에셋 자체 추가 → **데이터 엔지니어** (JSON `image` 필드와 연동)

### 품질 심사관과의 경계

- 프론트엔드 = **UI 구현, UX 판단, 빌드·배포**
- 품질 심사관 = **사용자 흐름 검수, 원칙 준수 확인**
- **다음 행위는 품질 심사관 사전 승인 필수**:
  - 라우팅 구조 변경 (`App.jsx` 라우팅)
  - 결제 흐름 수정 (`Payment.jsx`)
  - 무료/유료 경계 변경 (`constants.js` FREE_YEARS)
  - git push (특히 빌드 결과물 포함 시)

### 절대 금지

```
- public/data/all_data_204.json 직접 수정 (데이터 엔지니어 영역 침범)
- pipeline/* 수정 (데이터 엔지니어 영역 침범)
- 데이터 엔지니어 / Code B와 동시 push
- PowerShell && 체이닝 (→ ; 사용)
- JSX 부분 패치 (Python string replacement, 부분 수정)
  → 항상 완전 파일 재작성
- 가산적 조건 분기 추가 → 단일 통합 컴포넌트 사용 (예: BogiRenderer)
```

---

## 2. 파일 구조 (실전 맵)

```
src/
├── App.jsx              ← 메인 라우팅, 연도 로딩, isPro 전달
├── PassagePanel.jsx     ← 지문 렌더링, 형광펜 (span 렌더링 완료)
├── QuizPanel.jsx        ← 선지 렌더링, 정오 표시, 해설
├── dataLoader.js        ← JSON 로딩, cs_ids→cs 역매핑, csSpans 생성
├── Landing.jsx          ← 랜딩 페이지
├── Payment.jsx          ← 결제 (Toss 승인 대기)
├── constants.js         ← FREE_YEARS, CC(색상), 패턴 정의
├── ReportModal.jsx      ← 정확도 리포트 (P1~P9 바차트)
├── PatternCoach.jsx     ← 패턴별 학습 조언
├── PatternReport.jsx    ← 패턴 분석
├── WrongNote.jsx        ← 오답 노트
├── GradeEstimate.jsx    ← 등급 예측
└── (그 외 추가 컴포넌트)
```

---

## 3. 형광펜 작동 구조 (핵심)

### 데이터 흐름

```
choice.cs_ids       → dataLoader._buildSentCs() → sent.cs       → PassagePanel.getHL()       → 전체 하이라이트
choice.cs_spans     → dataLoader._buildSentCs() → sent.csSpans   → PassagePanel.renderWithSpans() → 부분 하이라이트
```

### 우선순위

1. **cs_spans 있으면**: 해당 어구만 부분 하이라이트
2. **cs_spans 없으면**: sent 전체 하이라이트 (fallback)
3. **`text.indexOf` 실패 시**: 전체 하이라이트 (fallback)

### dataLoader._buildSentCs() 핵심 로직

```javascript
// s.csSpans = { "q1_c3": ["단풍의 손바닥", ...] }
// 키 형식: q{questionId}_c{choiceNum}
```

### getHL() 반환 형식

```javascript
{
  pal,    // 색상 팔레트 (선지별)
  spans   // 어구 배열 ["어구1", ...] | null
}
```

### renderWithSpans() 동작

- `text.indexOf`로 어구 위치 탐색
- **3분할 렌더링** (어구 앞 / 어구 / 어구 뒤)
- spans 없으면 기존 전체 하이라이트로 fallback

---

## 4. 무료/Pro 범위

```javascript
// src/constants.js
FREE_YEARS = [
  "2026수능", "2025수능", "2024수능", "2023수능", "2022수능"
];
```

- 위 5개 외 모든 시험은 **Pro 전용**
- 변경 시 품질 심사관 승인 필수 (수익 모델 직결)

---

## 5. 오답 패턴 표시 (UI)

### 9종 + V (CLAUDE_MASTER 섹션 5 재확인)

```
독서: R1 사실왜곡 / R2 인과전도 / R3 과잉추론 / R4 개념혼합
문학: L1 표현오독 / L2 정서오독 / L3 주제과잉 / L4 구조오류 / L5 보기대입오류
어휘: V (패턴 수 외)
```

### 표시 원칙

- 메인 카피: **"반복되는 오답 패턴"** (숫자 전면 금지)
- 상세 섹션: 독서 4종 / 문학 5종 분리
- ReportModal: P1~P9 바차트 (V 제외)

---

## 6. 완료된 UI 기능 (참조용 매트릭스)

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
| ReportModal | ReportModal.jsx | ✅ |
| 복습 모드 | App.jsx | ✅ |
| GradeEstimate | GradeEstimate.jsx | ✅ |
| WrongNote | WrongNote.jsx | ✅ |
| Supabase Auth (이메일/비번) | App.jsx | ✅ |
| Google OAuth (placeholder) | Landing.jsx | ⚠️ 배포 환경 동작 미확인 |

---

## 7. JSX 수정 원칙

### 절대 원칙

- **부분 패치 금지**. 파일 전체 재작성.
- **Python string replacement 금지** (버그 빈발)
- **가산적 조건 분기 금지**. 단일 통합 컴포넌트 사용

### 통합 컴포넌트 예시

```
보기 렌더링은 BogiRenderer 단일 컴포넌트로 처리
- 텍스트 보기
- 이미지 보기 (single bogiImage / 다중 bogiImages)
- 표 보기
- 시 인용 보기
→ 조건문 분기로 늘리지 말고 BogiRenderer 내부에서 처리
```

### 빌드 검증

```bash
npm run build         # 빌드 통과 확인
npm run preview       # 로컬 prod 미리보기
```

빌드 실패 시 push 금지.

---

## 8. PowerShell 환경 제약 (CLAUDE_MASTER 섹션 8 재확인)

### 노트북 환경 필수 회피

- `npm run` 명령어는 정상 작동 (이스케이프 영향 없음)
- 한 줄 진단 명령에 정규식 포함 시 실패 (`node -e "..."` 안 정규식)
- 3-fail 규칙: 명령 3회 실패 시 즉시 중단

### Cowork 권장

프론트엔드 작업의 70%+가 JSX 완전 재작성 + npm 빌드 확인이므로 **Cowork 모드** 강력 권장. 파일 직접 조작이 효율적.

---

## 9. 작업 보고 형식

작업 종료 시 5블록:

```
[완료 보고]
실행:           # 어떤 파일을 어떻게 수정했는가
확인:           # 빌드 통과 / 로컬 미리보기 동작
미처리 이슈:    # 발견된 추가 작업
승인 필요:      # FREE_YEARS 변경, 결제 흐름 변경 등
다음 액션 1개:  # 가장 우선되는 다음 작업
```

작업 시작 시 자가 점검:

- 작업 범위가 데이터 엔지니어 영역을 침범하지 않는가
- JSX 수정 시 완전 재작성 원칙을 따를 수 있는가
- 미푸시 상태인가 → `git status` 확인 후 시작
- 데이터 엔지니어 채팅이 동시 가동 중인가 → push 충돌 위험

---

## 10. 백로그 (우선순위 순)

### 🟡 A. Google OAuth 배포 환경 동작 확인 (우선)

- 로컬에서 정상이나 Vercel 배포 환경에서 미확인
- Supabase 콜백 URL 설정 확인 필요
- 실패 시 이메일/비번 로그인만 활성화 유지

### 🟡 B. A-3 랜딩 오답 패턴 9종 표기

- 메인 카피: "반복되는 오답 패턴"
- 상세 섹션: 독서 4종 / 문학 5종 (V 제외)
- 카피라이터 합의 후 진행 (텍스트는 카피라이터 영역)

### 🟡 C. 모바일 반응형 점검

- 주요 페이지: Landing, PassagePanel, QuizPanel, ReportModal
- 320px / 375px / 768px 기준
- 형광펜 렌더링이 모바일에서 깨지는지 확인

### 🟢 D. correctRate 실데이터 연동 (5/15 전 권장)

- 현재 더미 데이터 또는 미연동
- Supabase `user_answers`에서 집계
- 데이터 엔지니어와 인터페이스 합의 필요

### 🟢 E. 2025_9월 BogiTable 선지 클릭 불가 버그 (기록된 이슈)

- userMemories에 기록된 미해결 버그
- 재현 절차 확인 필요

### 🟢 F. ReportModal 자동 팝업 조건 점검

- 모든 문제 풀이 완료 시 자동 팝업
- 도중 종료 시 동작 확인

### 🟢 G. Toss 결제 연동 (가맹점 승인 후)

- 승인 전 작업 금지 (효율 0)
- Payment.jsx 현재 상태 유지

### 🟢 H. 이미지 렌더링 안정성 (5/15 이후)

- 데이터 엔지니어가 이미지 JSON 삽입 완료한 후
- 렌더링 깨짐 없는지 전체 시험 순회 확인

### 🟢 I. UI 최종 점검 (출시 직전)

- CLAUDE_MASTER.md DO NOT TOUCH: **출시 직전 대규모 UI 변경 금지**
- 사소한 버그 수정만 허용

---

## 11. 세션 시작 시 첫 메시지 권장 형식

```
프론트엔드 작업 시작.
CLAUDE.md + CLAUDE_MASTER.md 확인 후 백로그 [A/B/...] 착수.

시작 전 보고:
- 현재 git 상태
- 작업 대상 파일 목록
- 빌드 통과 가능 여부 예상
- 데이터 엔지니어 채팅 활성 여부
```

품질 심사관 승인 후 실행 착수.

---

## 12. 추가 메모: dataLoader 핵심 함수

향후 수정 시 영향 범위 큰 함수:

- `_buildSentCs(sets)`: cs_ids → sent.cs 역참조, cs_spans → sent.csSpans 생성
- `loadYearData(yearKey)`: 연도별 JSON 로딩
- `getYears()`: 사용 가능 연도 목록 (FREE_YEARS + Pro 구분)

이 3개 함수는 **데이터 엔지니어와 인터페이스 영향**. 시그니처 변경 시 양쪽 채팅 동기화 필수.
