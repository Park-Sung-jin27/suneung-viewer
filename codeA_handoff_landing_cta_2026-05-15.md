# Code A 작업 지시 — Landing CTA 분리 (긴급)

> 작성: 품질 심사관 (2026-05-15) · **긴급** — 모두의창업 심사 시점 정합
> 목표: 비로그인 사용자(심사위원) viewer 진입 path 활성
> 핸드오프 우선순위: **즉시** (Phase 1 / privacy 사후)

---

## 사전 점검 (Code A 의무)

```bash
cd C:\Users\downf\suneung-viewer
git status
git pull origin main
```

깨끗 사실 확인. 최신 commit `57ece9a` (privacy route) 사후.

---

## 결함 사실

**현 path** (Landing.jsx L835~845):

```jsx
<Btn
  label="무료로 진단 시작"
  onClick={() =>
    window.open("https://tally.so/r/81jOpo", "_blank", "noopener,noreferrer")
  }
  size="lg"
/>
```

→ 단일 CTA = Tally only. 비로그인 사용자 viewer 진입 path 0.

**ViewerPage 의무 사실** (App.jsx L1054~1058):

```js
useEffect(() => {
  if (!yearKey) {
    navigate("/");
    return;
  }
  ...
});
```

→ `/viewer` 직접 진입 시 yearKey 없으면 홈 redirect.

**해결**: Landing CTA 2개 분리 — viewer 진입 path 활성.

---

## Step 1. 편집 — `src/Landing.jsx`

**Action**: Edit (1 위치 — hero CTA 영역)

### 1-1. anchor 사실 점검

```bash
grep -n "label=\"무료로 진단 시작\"" src/Landing.jsx
# 예상 결과: 836
```

L835~857 부근 — `<Btn label="무료로 진단 시작" ...>` + 그 다음 보조 텍스트.

### 1-2. 기존 (L829~857 부근)

```jsx
          <div
            style={{
              animation: "fadeUp 0.8s ease 0.4s both",
              marginBottom: "10px",
            }}
          >
            <Btn
              label="무료로 진단 시작"
              onClick={() =>
                window.open(
                  "https://tally.so/r/81jOpo",
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              size="lg"
            />
          </div>
          <p
            style={{
              fontSize: "0.73rem",
              color: C.subtle,
              animation: "fadeUp 0.8s ease 0.45s both",
              marginBottom: "52px",
            }}
          >
            1:1 전문가 진단 포함 — 토탈 5석 한정 / 89,000원/월부터
          </p>
```

### 1-3. 변경

```jsx
          <div
            style={{
              animation: "fadeUp 0.8s ease 0.4s both",
              marginBottom: "14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Btn
              label="지금 체험하기 — 무료 5개년"
              onClick={() => {
                window.location.href = "/viewer?year=2026수능";
              }}
              size="lg"
            />
            <a
              href="https://tally.so/r/81jOpo"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "0.85rem",
                color: C.muted,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              1:1 진단 신청 →
            </a>
          </div>
          <p
            style={{
              fontSize: "0.73rem",
              color: C.subtle,
              animation: "fadeUp 0.8s ease 0.45s both",
              marginBottom: "52px",
            }}
          >
            가입 없이 즉시 체험 가능 · 2026·2025·2024·2023·2022 수능 무료
          </p>
```

**변경 사항**:

1. 메인 CTA label: "무료로 진단 시작" → **"지금 체험하기 — 무료 5개년"**
2. 메인 CTA onClick: Tally → `/viewer?year=2026수능`
3. **보조 CTA 추가**: "1:1 진단 신청 →" (Tally maintain, text link 형식)
4. 보조 텍스트 변경: "1:1 전문가 진단 포함 ..." → "**가입 없이 즉시 체험 가능 · 2026·2025·2024·2023·2022 수능 무료**"

---

## Step 2. (선택) onStart prop 정합 점검

Landing 다른 위치 안 `onStart` 호출 영역 점검:

```bash
grep -n "onStart" src/Landing.jsx
```

`onStart` 호출 영역이 다수면 일관성 — 기존 Tally maintain. 변경 X.

`onStart` = HighlightDemo (L890) + 일부 buttons. 본 patch 영역 = hero CTA only.

---

## 검증 (Code A 의무)

### 검증 1. 빌드

```bash
npm run build
```

error 0 의무.

### 검증 2. 로컬 라이브

```bash
npm run dev
```

브라우저 → `http://localhost:5173`:

- ✓ **로그아웃 상태 또는 incognito tab** 으로 진입 의무 (Landing 노출 사실 의무)
- ✓ hero 영역 메인 CTA "지금 체험하기 — 무료 5개년" 노출
- ✓ 그 아래 "1:1 진단 신청 →" text link 노출
- ✓ 보조 텍스트 "가입 없이 즉시 체험 가능 · 2026·2025·2024·2023·2022 수능 무료" 노출

### 검증 3. CTA 클릭 사실

- ✓ 메인 CTA 클릭 → `/viewer?year=2026수능` 진입 사실
- ✓ ViewerPage 로드 + 2026수능 set list 노출 사실
- ✓ 비로그인 상태 set 클릭 → 풀이 / 보기 / 해설 / 형광펜 사실 확인 사실
- ✓ 보조 CTA "1:1 진단 신청 →" 클릭 → Tally `81jOpo` 새 탭 진입 사실

### 검증 4. 배포 라이브 (push 후)

Vercel auto-deploy (1~3분 대기) 사후:

- ✓ `https://suneung-viewer.vercel.app` (incognito) → Landing 노출
- ✓ 메인 CTA 클릭 → viewer 진입 사실
- ✓ 형광펜 / 해설 / 선지 사실 확인 사실

---

## 완료 보고 format

```
[완료 보고]
작업: Landing CTA 분리 (긴급)
완료 기준 충족: Y/N
결과:
  - npm run build: error 0
  - 라이브 incognito Landing CTA 2개 노출 ✓
  - 메인 CTA → /viewer 진입 사실 ✓
  - 보조 CTA → Tally 진입 사실 ✓
문제:
다음 액션 1개:
```

---

## 비고

- **모집 path maintain** — Tally `81jOpo` 보조 CTA 로 lock. 모집 기능 down X
- **비로그인 viewer 진입 시 일부 기능 제한 가능** — 풀이 기록 저장 / 오답 노트 / 등급 추정 등. 단 핵심 차별점 (형광펜 / 해설) 사실 확인은 가능
- **2026·2025수능 무료** 만 노출 (constants.js FREE_YEARS = 5개년) — 심사위원 충분히 차별점 사실 확인 path
- **다른 Landing 영역 (HighlightDemo, FAQ, footer 등) 변경 X** — surgical changes lock 정합
