# JIPPI 리포트 보관함 P0 운영 배포 기록

- 배포일: 2026-08-04 KST
- 배포 소스 커밋: `ca0e159dc4d1bcf39d7f81a56c17c2134059307c`
- 배포 프로젝트: `downfall121-1190s-projects/suneung-viewer`
- Vercel deployment: `C6Pwae4iyv8MKxH3rzUDFj4QDotW`
- 배포 URL: `https://suneung-viewer-6b0g5vly2-downfall121-1190s-projects.vercel.app`
- 운영 alias: `https://www.jippi.kr`

## 원격 빌드

- `check:jippi-library-p0`: PASS, 25/25
- `check:business`: PASS
- `check:eng-math-public`: PASS
- Vite production build: PASS
- `check:eng-math-dist`: PASS
- `check:jippi-delivery-dist`: PASS, reports=2
- 비차단 경고: 기존 단일 JS chunk가 500kB를 초과함

## 운영 회귀검사

- `/my`: 200, 제목 `나의 리포트 보관함 | JIPPI`
- 기존 delivery token: 200, 약 2.82MB 리포트 HTML
- 기존 delivery와 홈 본문: 서로 다름
- delivery `no-referrer`: 포함
- delivery footer script: 포함
- 임의 delivery token: 404
- `/tarot`: 200
- `/room`: 200
- `/fortune`: 200
- 무세션 `/api/library`: 401

## 대표 이메일 스모크

- 대상: 대표 검증용 이메일(원문 미기록)
- 기존 리포트 1건에 `/api/library/claim` 요청
- 응답: `ok=true`, `verificationRequired=true`
- 새 주문·결제: 생성하지 않음
- 사용자 확인 메일 클릭 및 모바일 세션 교환: PASS
- 모바일 `/my` 이메일 마스킹 표시: PASS
- 모바일 `/my` 기존 리포트 표시: 1건 PASS
- 표시 제목: 사전 확인한 기존 대표 리포트 제목과 일치
- 저장일 표시: `2026-08-04`
- 동일 매직링크 재사용: 차단 PASS (`확인 링크가 만료되었거나 이미 사용됐어요`)

## 운영 검증 결론

P0 운영 검증을 완료했다. 모바일 브라우저에서 이메일 소유권 확인, 세션 유지, 기존 리포트 귀속과 열람 진입점 표시를 확인했다. 같은 1회용 링크는 다른 브라우저 세션에서 재사용되지 않았다. 이 검증 과정에서 새 주문·결제·리포트·추가 이메일은 생성하지 않았다.

## 리텐션 측정 보강

- 배포일: 2026-08-04 KST
- 배포 소스 커밋: `3e3c7c8ca49637b749589eef262a9532477691a8`
- Vercel deployment: `4vrUgwXEqkTyUYq518hTpQaYP7NZ`
- 배포 URL: `https://suneung-viewer-awwdib2ql-downfall121-1190s-projects.vercel.app`
- 운영 alias: `https://www.jippi.kr`
- 발견 결함: `magic_link_request`, `magic_link_open`, 보관함 카드 `library_open`이 이벤트 화이트리스트에만 있고 실제 UI 경로에서 발생하지 않았음
- 수정: `/my`에서 위 3개 이벤트를 `source=library_page`로 전송하고, 리포트 토큰은 analytics payload에 포함하지 않음
- 로컬·원격 빌드: PASS, `check:jippi-library-p0` 29/29
- 운영 정적 검사: 세 이벤트 배선 PASS, analytics delivery token 전달 0
- 운영 회귀검사: `/my`, `/tarot`, `/room`, `/fortune`, 기존 delivery 모두 200; 기존 delivery footer 유지
- 검증용 이벤트·주문·결제·이메일: 추가 생성하지 않음
