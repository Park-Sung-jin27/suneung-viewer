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

- 대상: `do********@gmail.com`
- 기존 리포트 1건에 `/api/library/claim` 요청
- 응답: `ok=true`, `verificationRequired=true`
- 새 주문·결제: 생성하지 않음
- 사용자 확인 메일 클릭 및 세션 교환: 사용자 액션 대기

## 남은 완료 조건

사용자가 수신한 확인 메일의 버튼을 한 번 누른 뒤 `/my`에서 기존 리포트 1건이 보이는지 확인한다. 확인 후 재사용한 같은 매직 링크가 거부되는지도 점검하고 P0 운영 검증을 닫는다.
