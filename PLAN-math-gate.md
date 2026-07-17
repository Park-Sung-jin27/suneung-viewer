# PLAN-math-gate — 수학 DB 자동 품질 게이트 (math_gate.mjs)

> **우선순위: 3 / 5**
> 근거: 국어의 §13⑩ 원칙("출시 전 게이트 CRITICAL 0 = 단일 신호")을 수학 DB에 이식. 지금은 병합 때마다 임시 파이썬으로 검사 중 — 모평 8시험 확장(PLAN-math-mock-expansion) 전에 게이트를 만들어두면 이후 모든 배치가 자동 검증된다. 확장을 안전하게 만드는 인프라라서 확장보다 먼저.
> 라벨: [Confirmed] 검사 항목은 이번 실행에서 실제 발생한 결함 유형 기반 (스키마 드리프트·$ 홀수·정답 형식).

## 목표

`math_exam_db_v*.json`을 받아 CRITICAL/WARNING을 판정하는 단일 스크립트. CRITICAL 0이 아니면 exit code 1.

## 수정해야 할 정확한 파일

| 파일                                              | 작업                                                         |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `평가원_수학영어_확장/08_math_data/math_gate.mjs` | 신규 생성 (이 폴더에만 — 국어 `pipeline/` 폴더에 넣지 말 것) |
| `평가원_수학영어_확장/08_math_data/README.md`     | 신규 생성 (사용법 3줄)                                       |

## 단계별 작업 순서

1. **스크립트 작성** — 인자: `node math_gate.mjs <db경로>`. 검사 항목:

   **CRITICAL (하나라도 있으면 exit 1)**
   - C1 완전성: examKey별 common=1~~22 전부, cal/geo/sta=23~~30 전부 존재 (누락/중복 id 목록 출력)
   - C2 선지: answerType "choice"인데 choices.length ≠ 5 / "short"인데 choices.length ≠ 0
   - C3 배점: points가 2·3·4 외의 값 (null 포함)
   - C4 본문: problem_latex가 빈 문자열 또는 20자 미만
   - C5 정답 형식: answer 존재 시 — choice면 1~~5 정수 외, short면 "0"~~"999" 정수 문자열 외
   - C6 수식 짝: problem_latex와 choices[].latex의 `$` 개수 홀수 (`\$` 이스케이프 제외)
   - C7 그림 계약: hasFigure=true인데 figureDesc 30자 미만
   - C8 인코딩: 전 텍스트 필드에 U+FFFD(�) 또는 U+200B(제로폭) 존재

   **WARNING (출력만, exit 0)**
   - W1 KaTeX 화이트리스트 외 명령: `\latex명령` 토큰을 추출해 허용 목록(frac dfrac sqrt lim limits displaystyle int sum log sin cos tan ln exp pi theta alpha beta overline overrightarrow vec angle triangle perp parallel cases begin end left right middle text mathrm boxed le ge ne infty to cdot times div pm mp 등 — 작성 시 KaTeX 지원표 기준으로 60개 내외 명시)과 대조, 미등재 명령 목록
   - W2 정답 분포 편향: 시험별 choice 정답의 1~5 분포에서 한 번호가 0회 또는 12회 이상 (수집 오류 신호)
   - W3 confidence "medium"/"low" 문항 목록
   - W4 meta 부재 문항 목록
   - W5 answerCrossCheck "partial" 시험 목록

2. **출력 형식**: 콘솔 요약표 + `평가원_수학영어_확장/08_math_data/gate_report_<날짜>.json` (기계가 읽을 수 있게 {critical:[], warning:[]} 구조).
3. **파일 읽기 안전**: `fs.readFileSync` 사용. JSON.parse 실패 시 2초 대기 후 3회 재시도 (mount truncation 잔상 대응) — 그래도 실패면 "파일 손상 의심"으로 명확히 보고하고 종료.
4. **자가 테스트 (필수)**: v1_2(또는 최신) DB로 실행해 현 상태 기록 → 그 다음 **양성 검증**: DB 사본에 고의 결함 4종(choices 4개 문항, points 5, answer 7, $ 홀수)을 주입한 /tmp/broken.json을 만들어 게이트가 4건 모두 CRITICAL로 잡는지 확인. 못 잡으면 게이트 수정.
5. README.md 작성: 실행 명령, CRITICAL/WARNING 의미, "새 배치 병합 후 반드시 실행" 규칙.

## 성능 낮은 모델이 놓치기 쉬운 엣지 케이스

1. **양성 검증 생략 금지**: "결함 0"을 출력하는 게이트는 결함을 못 잡는 게이트일 수 있다. 4단계의 고의 결함 주입 테스트가 게이트 자체의 검증이다.
2. **`\$` 이스케이프**: `$` 짝 검사에서 `\$`를 세면 오탐. 정규식으로 `\$`를 먼저 제거한 뒤 카운트.
3. **`\\` (줄바꿈 명령)**: cases 환경 안의 `\\`는 정상 — W1 화이트리스트 검사에서 `\\`를 "명령"으로 추출하지 않도록 토크나이저 주의 (`\\[a-zA-Z]+`만 명령으로 간주).
4. **단답형 "0"의 처리**: `"0"`은 유효한 답(0~999). falsy 체크(`if (!answer)`)를 쓰면 "0"이 결함으로 오판된다. `=== undefined`로만 부재 판정.
5. **exit code**: WARNING만 있을 때 exit 1을 내면 자동화 체인이 매번 멈춘다. CRITICAL만 exit 1.
6. **국어 pipeline 오염 금지**: 이 스크립트를 `pipeline/`에 넣거나 국어 quality_gate.mjs를 수정하지 말 것 (CLAUDE.md 절대 원칙 — 별개 트랙).

## 직접 검증할 수 있는 완료 기준 (대표용)

1. PowerShell: `node C:\Users\downf\suneung-viewer\평가원_수학영어_확장\08_math_data\math_gate.mjs C:\Users\downf\suneung-viewer\평가원_수학영어_확장\08_math_data\math_exam_db_v1_2.json` → 요약표가 출력되고 CRITICAL 0.
2. 보고서에 **양성 검증 결과**("고의 결함 4종 주입 → 4종 전부 검출")가 명시되어 있음.
3. `gate_report_*.json` 파일이 생성되어 있고 메모장으로 열면 critical/warning 배열이 보임.

## 2026-07-17 실행 결과

- [Confirmed] `math_exam_db_v1_3.json` 322문항·7시험 검사 결과: CRITICAL 0, WARNING 1, 종료 코드 0.
- [Confirmed] WARNING 1건은 `W5_PARTIAL_CROSSCHECK`이며, 정답 교차 검증 상태가 partial인 7시험 목록이다.
- [Confirmed] 고의 결함 4종을 넣은 임시 사본은 `C2_CHOICE_COUNT`, `C3_POINTS`, `C5_ANSWER`, `C6_ODD_DOLLAR`를 모두 검출하고 종료 코드 1을 반환했다.
- [Confirmed] 시험 1개 문항을 통째로 제거한 임시 사본은 `C1_COMPLETENESS`를 검출하고 종료 코드 1을 반환했다.
- [Confirmed] 임시 사본은 시스템 임시 폴더에서 삭제했으며, 정본 DB는 수정하지 않았다.
- [Confirmed] 최종 산출물은 `08_math_data/math_gate.mjs`, `08_math_data/README.md`, `08_math_data/gate_report_20260717.json`이다.
- [Pending] 다음 데이터 배치 병합 전 `answerCrossCheck` partial 7시험의 원천 대조가 필요하다.
