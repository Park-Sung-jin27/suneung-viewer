# PLAN-math-mock-expansion — 모평 8시험(2022~2025 6월/9월) 368문항 전사 확장

> **우선순위: 4 / 5**
> 근거: "평가원 기출 최대한 수록" 목표의 잔여분. 원본 PDF는 전부 확보 완료 상태라 순수 전사 노동만 남음. 15시험 690문항 완전체가 되면 진단 문항 풀·단원별 학습 풀이 2배 이상. 단, PLAN-math-gate(게이트) 완성 후 착수해야 배치마다 자동 검증됨.
> 라벨: [Confirmed] 방법론 — 동일 절차로 7시험 322문항을 전사했고 적대검증 표본 20/20 무결.
> **선행 조건: PLAN-math-answers-v13, PLAN-math-gate 완료 후.**

## 목표

`kice_{2022|2023|2024|2025}_{06|09}` 8시험 × 46문항 = 368문항을 전사·정답 수집·병합해 math DB를 15시험 690문항으로 확장.

## 수정해야 할 정확한 파일

| 파일                                                       | 작업                    |
| ---------------------------------------------------------- | ----------------------- |
| `/tmp/math_{학년도}_{06\|09}_{A\|B\|C\|D}.json`            | 신규 32개 (배치 산출물) |
| `/tmp/math_answers_mock.json`                              | 신규 (모평 정답)        |
| `평가원_수학영어_확장/08_math_data/math_exam_db_v2_0.json` | 신규 (v1_3 + 368문항)   |
| `평가원_수학영어_확장/08_tool/data_math.js`                | 갱신 (안전 절차로)      |

## 단계별 작업 순서

1. **소스 준비**: `git clone --depth 1 https://github.com/young-0320/ProbDex /tmp/probdex` → `ls /tmp/probdex/assets/raw_problem_pdfs/` 에서 대상 24개 PDF(8시험 × sta/cal/geo) 존재 확인.
2. **시험당 4배치 전사** (서브에이전트 가능 시 병렬 4~8기, 불가 시 본인이 순차):
   - A = sta책자 공통 1~~15 (선다) / B = sta책자 공통 16~~22(단답) + 확통 23~~30 / C = cal책자 미적 23~~30 / D = geo책자 기하 23~30
   - 각 배치 절차: ① `mkdir -p /sessions/<세션명>/mnt/outputs/mrender/<태그>` (태그는 배치마다 고유하게, 예: 25m6_A) ② `pdftoppm -r 200 -png <PDF경로> .../mrender/<태그>/p` ③ Read 도구로 outputs 윈도우 경로의 p-XX.png를 열어 시각 판독 (**pdftotext 금지 — CID 폰트라 깨짐**) ④ JSON 저장 → json.load 재검증.
   - 문항 스키마 (필드명 정확히 이대로 — 다른 이름 쓰면 병합 실패):
     ```json
     {
       "id": "2025_06_common_1",
       "examKey": "math_2025_06",
       "schoolYear": 2025,
       "session": "6월",
       "track": "common",
       "qid": 1,
       "points": 2,
       "answerType": "choice",
       "problem_latex": "...",
       "choices": [{ "num": 1, "mark": "①", "latex": "..." }],
       "hasFigure": false,
       "figureDesc": "",
       "confidence": "high",
       "notes": ""
     }
     ```
   - LaTeX 규칙: 수식 `$...$` 인라인, JSON 내 백슬래시 `\\` 이스케이프, KaTeX 표준 명령만. 단답형(16~~22, 29~~30)은 answerType "short"+choices []. `[n점]` 표기 본문 유지 + points 숫자. 그림 문항은 hasFigure true + figureDesc를 "그림 없이 풀 수 있는 수준"으로 상세히. **전사 후 계산 가능한 문항은 직접 풀어 답이 선지에 존재하는지 자가검산** (이 습관이 오전사 검출의 핵심).
3. **정답 수집**: PLAN-math-answers-v13과 동일 방법으로 8시험 정답 → /tmp/math_answers_mock.json.
4. **병합**: HANDOFF 문서 T3 스크립트 패턴 재사용. 추가로 **정규화 필수** — 과거 배치들이 qid/number, problem_latex/question/stem 등 필드명이 흔들렸음. 병합기는 `q.get('qid') or q.get('number')` 식 폴백 정규화를 포함할 것 (v1_2 병합기가 이미 이 로직을 씀 — HANDOFF 문서 참조). ProbDex 메타 조인 시 month는 6월=6, 9월=9.
5. **게이트**: `node math_gate.mjs math_exam_db_v2_0.json` → CRITICAL 0 확인 후에만 data_math.js 갱신.
6. **fidelity 표본 검증**: 신규 368문항 중 16문항(시험당 2, 그림 포함) 층화 표본을 렌더 원본과 재대조. 결함 발견 시 해당 배치 전체 재검토.

## 성능 낮은 모델이 놓치기 쉬운 엣지 케이스

1. **책자 내 문항 위치는 시험마다 다름**: "23~30은 p-09부터"라고 가정하지 말 것. 각 책자를 첫 페이지부터 훑어 문항 번호를 확인한 후 전사.
2. **공통 문항 중복**: sta/cal/geo 책자 모두에 공통 1~~22가 있다. A/B 배치만 공통을 전사하고 C/D는 23~~30만 — C/D가 실수로 공통을 전사하면 병합 시 id 충돌.
3. **schoolYear는 '학년도'**: kice_2025_06 = 2025**학년도** 6월 모평 (시행은 2024년 6월). actualYear를 넣지 말고 스키마 그대로 schoolYear만.
4. **`\begin{cases}`의 JSON 이스케이프**: JSON 문자열 안에서는 `\\begin{cases}`. 한 겹만 쓰면 json.load는 통과해도 KaTeX가 깨진다 (b는 백스페이스 이스케이프가 아니라 그냥 b라 조용히 틀어짐).
5. **표준정규분포표**: 그림이 아니라 problem_latex 안 텍스트 표로 전사 (기존 배치 관례).
6. **렌더 태그 충돌**: 이전 세션 렌더 폴더(22c_A 등)와 이름이 겹치면 다른 시험 이미지를 읽는 대형 사고 — 반드시 새 고유 태그 사용.
7. **선지 조합형(ㄱㄴㄷ)**: choices의 latex가 수식이 아니라 "ㄱ, ㄴ" 같은 한글 — 그대로 전사, 억지로 수식화 금지.
8. **세션 중단 대비**: 배치 1개 완료 즉시 /tmp에 저장. 전 배치를 메모리에 들고 있다가 한 번에 저장하는 방식 금지.

## 직접 검증할 수 있는 완료 기준 (대표용)

1. PowerShell: `node ...math_gate.mjs ...math_exam_db_v2_0.json` → 요약표에 **시험 15개 / 690문항 / CRITICAL 0**.
2. `지니학습기.html` → 기출 학습 → 수학 → 시험별 목록에 "2025학년도 6월 모평" 등 모평 8개가 새로 보이고, 아무 문항이나 열면 수식이 정상 렌더.
3. 보고서에 fidelity 표본 16문항 대조 결과와 시험별 정답 crossCheck 상태가 표로 명시.
