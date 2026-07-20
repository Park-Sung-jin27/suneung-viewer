# JIPPI 공개 게이트웨이 인수인계 — 2026-07-20

## 한 줄 원칙

고객이 여는 유일한 주소는 `https://www.jippi.kr`이다. Vercel은 이 공개 도메인의 게이트웨이이며, Netlify는 Fortune 주문·결제·발송을 위한 내부 업스트림이다. 고객에게 Netlify 주소를 안내하거나, 동일한 Fortune HTML을 Vercel과 Netlify 양쪽에 따로 유지하지 않는다.

## 경로 소유권

| 경로 | 공개 게이트웨이 | 실제 처리 정본 |
| --- | --- | --- |
| `/` 및 수능뷰어 앱 | Vercel | `suneung-viewer` Vite 앱 |
| `/suneung/` | Vercel | `suneung-viewer` 정적 수능뷰어 |
| `/fortune`, `/fortune/*` | Vercel URL 유지 | Netlify `jippi-saju` Fortune 정본 |
| `/.netlify/functions/fortune-*` | Vercel URL 유지 | Netlify Functions + Blobs |
| `/assets/jippi-payments.js`, `/assets/jippi-analytics.js` | Vercel URL 유지 | Netlify Fortune 자산 |
| `/payment-success.html`, `/payment-fail.html` | Vercel URL 유지 | Netlify Fortune 완료 페이지 |

`vercel.json`의 external rewrite가 위의 Vercel URL을 Netlify 업스트림으로 연결한다. 앱 코드에서 `jippi-saju.netlify.app`을 직접 링크하지 말고, 항상 공개 경로를 사용한다. 서버 API 호출만 `backendBase()`를 통해 Netlify 업스트림을 선택할 수 있다.

## 중복 정적 파일 금지

Vercel은 정적 파일이 rewrite보다 우선한다. 따라서 `public/fortune/`, `public/assets/jippi-payments.js`, `public/payment-success.html` 같은 오래된 사본이 Vercel 빌드 결과에 있으면 주문 화면과 결제 스크립트가 구버전으로 되돌아간다.

`vite.config.js`의 `remove-jippi-proxy-static-conflicts` 플러그인이 빌드 완료 후 아래 경로를 `dist/`에서 제거한다.

```
fortune/
assets/jippi-payments.js
payment-success.html
payment-fail.html
privacy.html
terms.html
refund.html
```

이 목록에서 파일을 다시 공개 빌드에 포함시키지 않는다. `public/fortune/` 아래의 레거시 파일은 운영 정본이 아니며, 배포되는 페이지를 수정하는 용도로 사용하면 안 된다.

## 배포 순서와 하드 체크

1. Fortune 변경은 `fortune_prompt_builder_v4_12`에서 먼저 Netlify에 배포한다.
   `npm run deploy:netlify:smoke`
2. 게이트웨이 변경은 `suneung-viewer`에서 `npm run build`를 실행한다.
3. 빌드 뒤 아래 파일이 모두 없어야 한다.

   ```powershell
   Test-Path dist/fortune
   Test-Path dist/assets/jippi-payments.js
   Test-Path dist/payment-success.html
   Test-Path dist/payment-fail.html
   ```

   모두 `False`여야 한다.
4. Vercel 게이트웨이 변경은 관련 파일만 선택 커밋·푸시한다. 로컬 수동 Vercel 배포만으로 끝내지 않는다. Git 자동 배포가 이후에 수동 배포를 덮어쓸 수 있다.
5. 공개 도메인에서 아래를 확인한다.

   ```powershell
   Invoke-WebRequest 'https://www.jippi.kr/fortune?proof=<nonce>'
   Invoke-WebRequest 'https://www.jippi.kr/assets/jippi-payments.js?proof=<nonce>'
   ```

   Fortune HTML에는 `301호`가 없어야 하고, 결제 스크립트는 Fortune 서비스 설정을 포함해야 한다. `www.jippi.kr`과 Netlify 원본의 Fortune HTML 해시가 달라지면 배포를 중단하고 정적 충돌부터 확인한다.

## 결제·발송 실테스트 규칙

- 테스트 키 결제는 실제 고객 주문과 분리된 시험 주문으로만 실행한다.
- Toss 완료 후 서버 확인 결과가 `test_confirmed`가 된 주문만 `--allow-toss-test --send-test-email`로 발송한다.
- 테스트 수신 주소는 `JIPPI_TEST_DELIVERY_EMAIL`과 정확히 일치해야 한다.
- 완료 화면의 “지피사주로 이동” 링크는 반드시 `/fortune`이다. `/`는 수능뷰어 루트이므로 사용하지 않는다.

## 장기 과제

현재는 공개 도메인을 하나로 통일한 구조이며, 인프라는 Vercel 게이트웨이와 Netlify Fortune 백엔드로 분리되어 있다. Fortune Functions·Blobs·발송 워커를 Vercel로 이관하기 전에는 Netlify를 제거하거나 도메인 라우팅을 임의로 바꾸지 않는다. 이관은 결제·주문·발송 회귀 테스트를 별도로 통과한 뒤에만 진행한다.
