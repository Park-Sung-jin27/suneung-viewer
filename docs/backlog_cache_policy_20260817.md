# 백로그 — 배포 반영 · 캐시 정책 (발주 fr 종결, 2026-08-17)

> 발주 fr 조사 결과 이관분. **착수 지시가 있기 전까지 손대지 않는다.**
> 원인은 **후보 A(열어둔 탭)로 확정**됐다. 헤더·Service Worker 는 원인이 아니다.

## 종결된 사실 `[Confirmed]`

- `https://www.jippi.kr/` (index.html) 실측 헤더
  `Cache-Control: public, max-age=0, must-revalidate` · `Etag` 유효 · `If-None-Match` → **304 정상**
  → **index.html 은 이미 표준이다.** 매 요청 재검증된다.
- **Service Worker 없음** — 소스·빌드 산출물 0건, `/sw.js`·`/service-worker.js`·`/manifest.json` 전부 **404**.
- `vercel.json` 의 `headers` 16개 항목은 전부 사주(jippi-saju) 계열 경로 전용.
  `/`·`/assets/*`·`/data/*` 를 지정한 규칙은 **없다**(= Vercel 기본값).
- 증상 원인 = **배포 전에 열어둔 탭**. SPA 클라이언트 라우팅이라 index.html 을 다시 받지 않아
  옛 번들이 유지됐다. `Ctrl+Shift+R` 로 해소된 것과 정합한다.

## 이관 항목

### B-1. 배포 감지 배너 `[Backlog]`
열어둔 탭은 새로고침 전까지 **영원히** 구버전이다. 앱에 배포 감지 로직이 없다.
- 안: 주기적으로 `/index.html` 을 `fetch` 해 `<script src>` 해시가 바뀌면 새로고침 안내 배너를 띄운다.
- 규모: 약 20행.

### B-2. `/assets/*` immutable 장기 캐시 `[Backlog]`
해시 파일인데 `max-age=0, must-revalidate` 라 1.2MB JS 를 매번 재검증한다.
- 안: `vercel.json` 에 `/assets/(.*)` → `Cache-Control: public, max-age=31536000, immutable` (5행).
- **성능 개선일 뿐이며 구버전 증상과는 무관하다.**

> ## 🔴 경고 — B-2 착수 시 반드시 읽을 것
>
> **`/assets/(.*)` immutable 규칙을 함부로 넣지 말 것.**
> `/data/*.json` 은 **해시가 없는 8.9MB 파일**(`/data/all_data_204.json`)이다.
> 경로를 잘못 잡아 이 파일에 immutable 이 걸리면
> **데이터 수정이 최대 1년간 사용자 화면에 반영되지 않는다.**
> 규칙은 해시가 붙은 빌드 산출물에만 적용하고, 적용 후 `/data/all_data_204.json` 의
> `Cache-Control` 을 실측해 `max-age=0, must-revalidate` 가 유지되는지 확인할 것.

## 기각 항목

### R-1. index.html `no-store` 명시 `[기각 — 2026-08-17]`
`304` 가 이미 정상 동작한다. 헤더는 원인이 아니므로 효과가 없다.
