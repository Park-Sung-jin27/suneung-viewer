# JIPPI 공개 게이트웨이 정적 자산 복구 기록 — 2026-07-30

## 결론

고객 공개 주소는 `https://www.jippi.kr`이고 Fortune 정본은 Netlify `jippi-saju`가 소유한다. Vercel `suneung-viewer`는 공개 도메인 게이트웨이로서 Fortune HTML, 함수, 스크립트, 일러스트, 폰트를 Netlify 정본으로 전달한다.

2026-07-30 점검에서 `/fortune/` HTML은 정상 전달됐지만 아래 정적 자산 경로가 Vercel에서 404로 차단됐다.

- `/assets/signatures/*`
- `/assets/mega_chapters/*`
- `/fonts/*`

Netlify 정본 주소에서는 동일 파일이 모두 200이었으므로 원인은 Netlify 배포 누락이 아니라 Vercel 게이트웨이 rewrite 누락이었다.

## 적용 변경

`vercel.json`에 다음 세 external rewrite를 추가했다.

```text
/assets/signatures/(.*)    -> https://jippi-saju.netlify.app/assets/signatures/$1
/assets/mega_chapters/(.*) -> https://jippi-saju.netlify.app/assets/mega_chapters/$1
/fonts/(.*)                -> https://jippi-saju.netlify.app/fonts/$1
```

다른 작업이 섞인 로컬 워킹트리는 배포하지 않았다. Git `9050160`의 격리 worktree에 위 세 rewrite만 적용해 Preview를 만든 뒤, 검증한 동일 배포를 Production으로 승격했다.

## 배포 증적

- Preview deployment: `dpl_41W1qc4xxvbWHQctVLDCFFWTcguP`
- Preview URL: `https://suneung-viewer-nhqcktxrp-downfall121-1190s-projects.vercel.app`
- Production deployment: `dpl_HHfDFZE6ioZgQjoEs78i2HRy8zaT`
- Production aliases: `www.jippi.kr`, `jippi.kr`, `suneung-viewer.vercel.app`

## 검증 결과

운영 공개 주소에서 다음 항목을 캐시 우회 쿼리와 함께 재검증했다.

- Fortune HTML 1개: HTTP 200
- 일러스트 5개: HTTP 200, `image/webp`
- 로컬 폰트 3개: HTTP 200, `font/woff2`
- 미리보기 스크립트 및 결제 스크립트: HTTP 200
- 데스크톱 1440×900: 가로 넘침 0, 일러스트 및 로컬 폰트 적용
- 모바일 390×844: 가로 넘침 0, 제목·본문·CTA 잘림 없음
- 합성 입력 무료 미리보기: 일주·시주·질문 카드 생성 정상
- 브라우저 콘솔 오류: 0

실제 주문, 결제, 이메일은 이 점검에서 실행하지 않았다.

## 재발 방지

Vercel Production 배포 후 저장소 루트에서 다음 검사를 반드시 실행한다.

```powershell
node scripts/check-jippi-public-gateway-assets.mjs
```

Preview 주소를 검사할 때는 다음처럼 실행한다.

```powershell
node scripts/check-jippi-public-gateway-assets.mjs --base=https://<preview-host>
```

검사가 하나라도 실패하면 운영 배포 완료로 판정하지 않는다. 특히 HTML이 200이라는 사실만으로 Fortune 디자인 배포를 승인하면 안 된다. 일러스트와 폰트는 HTML과 별도 경로이므로 반드시 함께 검사한다.

## Git 주의

점검 당시 로컬 `main`은 `origin/main`보다 3개 커밋 앞서고 다수의 다른 미커밋 변경이 있었다. 이 때문에 운영 복구는 격리 배포로 수행했다. 다음 Git 정리 때 `vercel.json`, 이 검사 스크립트, 이 기록 문서를 선택적으로 커밋해야 한다. 그 전까지 원격 Git 기반 자동 배포가 구버전 `vercel.json`을 사용하면 같은 결함이 재발할 수 있다.
