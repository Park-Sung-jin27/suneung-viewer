# JIPPI 리포트 보관함 P0 운영 인계

작성일: 2026-08-04
대상 프로젝트: `suneung-viewer` / `jippi.kr`
상태: P0 프리뷰 검증 전, 고객 경로 비활성

## 1. 목적과 경계

P0는 기존 이메일 납품 링크를 바꾸지 않고, 고객이 열어 본 리포트를 이메일 인증 후 `/my` 보관함에 저장해 다시 찾게 하는 최소 기능이다. 리포트 URL은 기존처럼 bearer URL로 열리며 로그인이 필수가 아니다. 보관함은 별도의 계정 비밀번호를 만들지 않고 20분 유효 매직링크와 30일 세션 쿠키를 사용한다.

이번 단계에는 결제, 주문 생성, 원고 생성, 고객 이메일 재발송, 리포트 URL 변경, 공개 인덱싱이 포함되지 않는다.

## 2. 배포 구조

- 정적 UI: `public/my.html`, `public/my.js`
- 기존 리포트 공통 기능: `public/fortune/delivery/_footer.js`
- API: `api/library.js`, `api/library/[action].js`
- 저장 계층과 보안 계약: `api/_libraryStore.js`
- 저장소: Vercel Blob 비공개 저장소 `suneung-viewer-blob` (서울 리전, 프로젝트 연결)
- 도메인: `https://www.jippi.kr`

발송 리포트에는 `noindex`, `no-store`, `no-referrer`가 유지되어야 한다. 매직 토큰은 query가 아니라 `/my#token=...` fragment에만 들어가며, 브라우저가 fragment를 제거한 뒤 API로 교환한다.

## 3. 필수 환경변수

값은 이 문서나 Git에 기록하지 않는다.

| 이름 | 용도 | 대상 |
|---|---|---|
| `JIPPI_LIBRARY_HMAC_SECRET` | 이메일·토큰·세션·IP 키 파생. 최소 32바이트 난수 | Preview, Production |
| `RESEND_API_KEY` | 매직링크 이메일 발송 | Preview, Production |
| `LIBRARY_FROM_EMAIL` | 검증된 발신자 주소 | Preview, Production |
| `JIPPI_PUBLIC_BASE_URL` | 고정 공개 origin. `https://www.jippi.kr` | Preview, Production |
| `BLOB_STORE_ID` | 프로젝트에 연결된 비공개 Blob 저장소 | Preview, Production |

기존 운영 호환을 위해 `LIBRARY_FROM_EMAIL`이 없을 때 `ORDER_FROM_EMAIL`, 그다음 `JIPPI_FROM_EMAIL`을 읽는다. 신규 배포에서는 명시적인 `LIBRARY_FROM_EMAIL` 사용을 권장한다.

## 4. 보안 계약

- 평문 이메일을 Blob, 로그, analytics에 저장하지 않는다.
- 이메일 소유권은 단일 사용 매직 토큰 교환 뒤에만 성립한다.
- 매직 토큰과 세션 토큰은 서로 다른 HMAC namespace를 사용한다.
- 세션 쿠키는 `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`이다.
- 이메일 요청 응답은 계정 존재 여부와 무관하게 동일하다.
- 이메일별 5분, IP별 1시간 10회 제한을 둔다.
- 리포트 저장은 고정 공개 origin의 `HEAD` 확인을 먼저 수행한다.
- Blob 갱신은 ETag/`ifMatch` 또는 `createOnly`를 사용해 동시 쓰기 유실을 차단한다.
- analytics에는 `/fortune/delivery/[REDACTED]/`만 남긴다.
- 무관한 손상 쿠키는 500을 만들지 않고 미인증으로 처리한다.

## 5. 배포 전 게이트

아래 순서가 모두 성공해야 한다.

```powershell
npm run check:jippi-library-p0
npm run build
git diff --check
```

기대 핵심값:

- 라이브러리 단위·음성·동시성 테스트 전부 PASS
- 평문 이메일 저장 0
- 토큰 replay 차단
- 동시 bookmark 2건 유실 0
- 동시 rate-limit 우회 차단
- 매직 토큰 URL query 0, fragment 사용
- 기존 리포트 2건 footer·`no-referrer`·원본/`dist` 해시 일치

## 6. 프리뷰 스모크 테스트

실제 고객 이메일은 사용하지 않는다.

1. `/my`가 200이고 모바일 390px에서 가로 넘침·잘린 텍스트가 없는지 확인한다.
2. 기존 delivery 토큰 2개가 리포트를 반환하고 홈 HTML과 다르며 footer와 `no-referrer`를 포함하는지 확인한다.
3. `/api/library` 무쿠키 GET이 401을 반환하는지 확인한다. 500이면 HMAC/Blob 설정부터 점검한다.
4. 존재하지 않는 합성 이메일로 `/api/library/link`를 호출해 generic 200 응답과 Blob 읽기 경로만 확인한다. 이메일이 발송되지 않는 값을 사용한다.
5. 임의 delivery 토큰은 정적 홈으로 rewrite되지 않고 404여야 한다.
6. `/tarot`, `/room`, `/fortune` 기존 라우트가 200인지 확인한다.
7. 프리뷰 단계에서는 finalize, publish, 결제, 실주문, 고객 이메일을 실행하지 않는다.

## 7. 프로덕션 전환

프리뷰 게이트와 대표 확인 후에만 Git 기반 배포로 전환한다. 로컬 운세 폴더에서 `vercel --prod`를 실행하지 않는다. 정본 Git 저장소의 `main` 배포만 프로덕션 source로 인정한다.

프로덕션 전환 직후 같은 스모크 테스트를 반복하고, 첫 저장·로그인 실험은 대표 소유 이메일과 기존 테스트 리포트 1건으로만 제한한다. 이때도 새 결제나 새 주문은 만들지 않는다.

## 8. 롤백

API 또는 `/my`만 문제가 있으면 P0 커밋을 되돌려 재배포한다. 기존 delivery HTML은 독립 bearer URL이므로 P0 API 장애가 리포트 열람을 막아서는 안 된다. footer 버튼은 API 실패를 고객에게 설명하고 리포트 본문은 계속 읽을 수 있어야 한다.

기존 정상 배포로 alias를 통째로 되돌리는 방식은 `/tarot`, analytics, 결제 등 이후 변경을 함께 제거할 수 있으므로 최후 수단으로만 사용한다.

## 9. 모니터링과 사고 대응

- 5xx 비율, magic request rate, Blob conflict 재시도 소진, Resend 오류를 본다.
- 로그에서 이메일, 매직 토큰, 세션 토큰, delivery token 원문을 검색해 0건인지 확인한다.
- 이메일 링크가 열리지 않으면 fragment 보존 여부와 `/api/library/verify` 응답부터 본다.
- 저장 목록이 유실되면 ETag 조건부 쓰기와 재시도 횟수를 확인한다.
- URL 토큰 누출이 발견되면 analytics 적재를 중지하고 해당 delivery 링크의 재발급 범위를 별도 판단한다.

## 10. P1 이후에만 다룰 것

확인메일 기반 과거 리포트 자동 귀속, 보관함 오픈 알림, 여러 주문의 자동 병합, 계정 삭제·데이터 내보내기, 마케팅 동의, 크로스셀 실험은 P0 범위가 아니다. P0 운영 안정성과 소유권 증명이 먼저다.
