# 짚이 (Jippi) Brand Launch — 세션 로그 v2

**누적 작업 일자**: 2026-05-08 ~ 2026-05-11
**대표**: 성진
**현재 상태**: brand 확정 + 도메인 결제·연결 + 라이브 자산 배치 완료. ISP DNS 캐시 풀림 + 인스타 카드뉴스 업로드 + W1 lock 대기.

---

## 1. 누적 진행 요약

### Brand
- **짚이 (Jippi)** / 발음 짚-이 (jip-i)
- 펜촉 로고 + 라임 stroke (`#2D6E2D` + `#BEF264`)
- 태그라인: 선지마다 근거를 형광펜으로
- 카테고리: 수능 국어 분석 도구 (현재) / 국어 분석 도구 (장기)

### 도메인 (모두 결제·연결 완료)

| 도메인 | 상태 | Vercel 설정 |
|---|---|---|
| jippi.kr | A 레코드 → 216.198.79.1 | 메인 (primary) |
| www.jippi.kr | A 레코드 → 216.198.79.1 | redirect to root |
| jippi.co.kr | A 레코드 → 216.198.79.1 | redirect to jippi.kr |

- 가비아 결제 완료 (jippi.kr + jippi.co.kr)
- jippi.com 미확보 (1년 후 재시도)
- Vercel SSL 발급 진행 중
- ISP DNS 캐시 풀림 대기 (30분~3시간 자연 해결)

### 인스타 핸들 (검증 대기)
- 1순위: `@jippi.kr` / 2순위: `@jippi` / 3순위: `@jippi.official`
- 인스타 로그인 일시 오류 → 복구 사후 검증 + 3개 동시 가입 의무

---

## 2. Code A commits (전체)

| commit | 영역 | 변경 |
|---|---|---|
| c36f8ae | brand 정정 (1차) | index.html title/meta/OG/favicon + Landing.jsx sticky nav + "논리맵핑" → "짚이" 일괄 |
| 1abcf6f | B2B Tally 통합 | Landing.jsx WaitlistForm 폐기 (-205 line) + 4건 카드 + B2B CTA (+73 line) |
| 7142ae9 | og_image.png 배치 | public/og_image.png (569,321 bytes) |

---

## 3. 자산 (다운로드 가능)

| 파일 | 위치 | 용도 |
|---|---|---|
| jippi_download.html | /mnt/user-data/outputs/ | 카드뉴스 7장 + PFP (1080×1080) |
| jippi_og_image.html | /mnt/user-data/outputs/ | OG image HTML 원본 (1200×630) |
| og_image.png | /mnt/user-data/outputs/ | OG image PNG (569KB, 배치 완료) |
| HANDOVER_jippi_2026-05-08.md | /mnt/user-data/outputs/ | 1차 핸드오버 |
| HANDOVER_jippi_2026-05-11.md | /mnt/user-data/outputs/ | 본 문서 (2차) |

### Tally forms (라이브)
- **B2C (출시 알림)**: `tally.so/r/81jOpo` (Landing Hero CTA, 3건 보존)
- **B2B (학원·강사 문의)**: `tally.so/r/gDYZ74?src=landing-academy` (Landing 학원 도입 섹션, 1건 신규)
- B2B 6필드: 이메일 / 학원·기관명 / 직책 / 학생 수 / 도입 시기 / 문의 내용

---

## 4. 검증 통과 항목 (라이브 작동) [Confirmed]

| 영역 | 검증 path | 상태 |
|---|---|---|
| Vercel og_image.png 노출 | 사용자 직접 확인 | ✅ |
| 카톡 OG 미리보기 (vercel.app 기준) | 사용자 직접 확인 | ✅ |
| 학원 도입 섹션 → B2B Tally 연결 | Claude 크롬 도구 직접 검증 | ✅ |
| 페이지 title "짚이 (Jippi) — 수능 국어 분석 도구" | Claude 검증 | ✅ |
| Sticky nav 펜촉 로고 + "짚이" wordmark | Claude 검증 | ✅ |
| Footer © 2025 짚이 | Claude 검증 | ✅ |
| 모든 도메인 A 레코드 → 216.198.79.1 | Python DNS lookup | ✅ |

---

## 5. 미완 / 대기 (다음 세션)

### A. ISP DNS 캐시 풀림 (30분~3시간 자연 해결)
- 시크릿 모드 `https://jippi.kr` 접속 → Vercel 페이지 노출 검증
- Vercel SSL "Valid Configuration" 확인

### B. Code A 다음 액션 spec (DNS 안정화 사후 투입)

```
[Surgical Changes — index.html OG meta 절대 URL jippi.kr 재정정]

## 사전 조건
- https://jippi.kr 접속 시 Vercel 페이지 정상 노출
- Vercel SSL 발급 완료

## 사전 raw 점검
Select-String -Path index.html -Pattern "suneung-viewer.vercel.app"

## 작업 영역 1건
### A. index.html OG / Twitter meta URL 정정
- og:url    : suneung-viewer.vercel.app → jippi.kr
- og:image  : suneung-viewer.vercel.app/og_image.png → jippi.kr/og_image.png
- twitter:image : 동일

## 절대 금지
- 다른 영역 (title / description / og:type / og:locale) 변경 X
- og_image.png 파일 자체 변경 X

## 완료 기준
- Select-String "suneung-viewer.vercel.app" index.html → 0건
- 카톡 jippi.kr 붙여넣기 → OG 미리보기 노출
```

### C. 인스타 작업 (로그인 복구 사후)
- @jippi.kr / @jippi / @jippi.official 동시 검증 + 가입
- PFP 등록 (사용자 보고 완료 — 재확인 의무)
- BIO 작성 (W1 lock 사후)
- 카드뉴스 7장 carousel 업로드 + 캡션

### D. 사업자 등록 + 세금계산서 path (첫 inbound 즉시)
- 홈택스 개인사업자 등록 (1일)
- 업종: 정보처리 또는 교육 서비스업
- 세무사 1회 자문
- Toss 사업자 결제 등록

---

## 6. 전략가 B2B 가격 답변 — 채택 8건

### W1 즉시 Lock

1. **가격 모델 D**: 학생당 14,900원/월 + 학원 minimum 5명 (월 74,500원~)
   - 콴다 프리미엄 18,500원 anchor 대비 20% 저렴
   - B2C 39,900원 대비 학원 결제 38% 저렴
2. **연간 20% 할인**: 학생당 11,920원/월 (선납 715,200원/년)
3. **시범 14일 / 5~10명 / 수동 결제** (자동 X)
4. **5개 script form** (인스타 DM / 이메일 / 가격 / 시범 / 미팅)
5. **CSV import + 학원 dashboard 우선** (Month 1)
6. **약관 월간 + 연간 2축** (학기간 X)
7. **향응·접대 거절 정책 lock** (콴다 사례 기반)
8. **11번째 학원 거절 + 대기 list** (솔로 capacity 보호)

### 검증 추가 결정 (다음 세션)

1. 시범 minimum 일관성: **5명 권장** (영역 1 정합)
2. 가격 협상: **large volume 단일 lever만 허용** (예: 50명+ 별도 패키지)
3. 학원 mental model: 첫 5곳 inbound 시 학생당 vs 학원당 정액 두 옵션 동시 제시 → 데이터 수집 → Month 3 lock
4. Dashboard v0.1 timeline: W5까지 realistic (첫 시범 14일 buffer 활용)
5. 사업자 등록 시점: 첫 inbound 발견 즉시

---

## 7. W1 의무 (인스타 게시 전 lock 게이트)

1. **가격표 PDF 1장 작성** (모든 학원 동일)
2. **5개 script form template 저장** (이메일 / 카톡 / 메모 어디든)
3. **정책 4건 mental note lock**:
   - 가격 협상 X (large volume 단일 lever만)
   - 자동 결제 X
   - 11번째 학원 거절 + 대기 list
   - 향응·접대 거절 (동일 가격·동일 path)
4. **인스타 자동 응답 message 설정** (48시간 양해 — 비즈니스 계정 의무)
5. **B2B Tally form 이메일 알림 ON** (Tally dashboard 설정)

→ **W1 lock 완료 = 인스타 게시 게이트**

---

## 8. 다음 세션 시작 순서

```
1. ISP DNS 캐시 풀림 검증
   - 시크릿 모드: https://jippi.kr 접속

2. Vercel SSL 발급 status 확인
   - "Valid Configuration" 도달 시 다음 step

3. Code A OG meta URL 재정정 spec 투입 (위 §5-B)

4. 카톡 OG 미리보기 jippi.kr 기준 재검증

5. W1 의무 5건 lock (가격표 PDF + script + 정책 + 자동 응답 + Tally alert)

6. 인스타 로그인 복구 시:
   - @jippi.kr / @jippi / @jippi.official 검증 + 가입
   - BIO 작성 (W1 lock 사후)
   - 카드뉴스 7장 carousel 업로드

7. 첫 B2B inbound 발생 시:
   - 사업자 등록 신청 (홈택스)
   - 세무사 1회 자문
```

---

## 9. 누적 핵심 학습 (operational locks)

1. **사용자 메모리 ≠ 라이브 코드 가정 금지** — spec 작성 시 raw 점검 의무 (Code A redteam 2회 발견 사례)
2. **Code A redteam 의견 검증 후 수용** (userPreferences §8 정합)
3. **Brand 결정 마비 방지** — 첫 통과 후보 즉시 결정 (풀잇 KIPRIS 충돌 → 짚이 1턴 결정)
4. **이중 layer brand** (불변 / 가변) — Brand level vs Marketing level
5. **가격 lock + script lock = 인스타 게시 게이트** (W1 의무)
6. **솔로 capacity 보호** — 11번째 학원 거절
7. **향응·접대 거절 정책 사전 lock** (콴다 사례 기반)
8. **자동 결제 X — 수동만** (trust 보호)
9. **외부 검증 의무** — 전략가 답변 그대로 채택 X, 한국 시장 데이터 + 학원 mental model 검증
10. **fake door 검증 단계 = over-engineering 회피** — supabase RLS, white-label, 학기간 약관 등 모두 미루기

---

## 10. userMemories 갱신 의무 (다음 세션 적용)

```
변경 후 유효 상태:

제품명: 짚이 (Jippi) — 수능 국어 분석 도구
URL: jippi.kr (메인) / jippi.co.kr (redirect) / www.jippi.kr
도메인 결제일: 2026.05.08 (가비아)
Vercel: suneung-viewer 프로젝트 (3개 도메인 연결)
Vercel IP: 216.198.79.1 (A 레코드)
Code A commits: c36f8ae (brand 정정) / 1abcf6f (B2B Tally 통합) / 7142ae9 (og_image.png)
Tally B2C: 81jOpo (출시 알림, Landing Hero CTA)
Tally B2B: gDYZ74 (학원·강사 문의, Landing 학원 도입 섹션 + ?src=landing-academy)
9패턴 분류: R1-R4 (독서 4종) + L1-L5 (문학 5종)
대표 자산: 김과외 상위 0.1% 강사 (11년 현장 경험)
데이터: 204문항 오류 DB
기술 stack: React/Vite + Vercel + Supabase + Anthropic API
단계: fake door 검증 (정식 출시 전)
B2B 가격 lock (전략가 답변 W1):
  - 학생당 14,900원/월 + 학원 minimum 5명 (월 74,500원~)
  - 연간 20% 할인 (11,920원/월)
  - 시범 14일 / 5~10명 / 수동 결제
B2B 정책 lock:
  - 가격 협상 X (large volume 단일 lever만)
  - 자동 결제 X
  - 11번째 학원 거절 + 대기 list
  - 향응·접대 거절
인스타 핸들 후보: @jippi.kr / @jippi / @jippi.official (로그인 복구 사후)
```

---

**End of Session — 2026-05-11**

다음 세션은 본 문서 + HANDOVER_jippi_2026-05-08.md 함께 paste 후 시작 권장.
첫 메시지: "ISP DNS 캐시 풀림 검증부터 가자"
