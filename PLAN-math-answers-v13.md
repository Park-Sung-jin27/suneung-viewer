# PLAN-math-answers-v13 — 수학 정답키 완결 + 교차검증 + v1.3 병합

> **우선순위: 1 / 5 (가장 먼저)**
> 근거: 수학 DB 322문항 중 138문항이 무정답 → 학습기의 수학 자동채점·수학 진단이 절반만 작동. 정답만 채우면 코드 수정 없이 진단·컨설팅 기능이 완전 활성화됨 (학습기는 `q.answer` 존재 시 자동 채점하도록 이미 검증 완료). 최소 노력·최대 결과.
> 라벨: [Confirmed] 현황 — math_exam_db_v1_2.json 실측 (정답 184/322).

## 목표

1. `math_2025_csat`, `math_2026_06`, `math_2026_09` 정답 138문항 수집 (독립 2소스 교차).
2. 기존 4시험(2022/2023/2024/2026 수능) 정답을 직접 풀이로 표본 교차검증.
3. v1.3 병합 + 학습기 데이터 갱신.

## 수정해야 할 정확한 파일

| 파일                                                       | 작업                              |
| ---------------------------------------------------------- | --------------------------------- |
| `/tmp/math_answers_wave3.json`                             | 신규 생성 (수집 결과)             |
| `평가원_수학영어_확장/08_math_data/math_exam_db_v1_3.json` | 신규 생성 (v1_2는 수정 금지)      |
| `평가원_수학영어_확장/08_tool/data_math.js`                | 덮어쓰기 (단, 아래 안전 절차로만) |
| `/tmp/verify_math_answers.json`                            | 신규 생성 (검증 기록)             |

## 단계별 작업 순서

1. **환경 확인**: bash `ls /sessions` 로 세션명 확인. `python3 -c "import json; d=json.load(open('/sessions/<세션명>/mnt/suneung-viewer/평가원_수학영어_확장/08_math_data/math_exam_db_v1_2.json')); print(len(d['questions']))"` → 322 출력 확인.
2. **정답 수집** (시험 1개 확보 즉시 /tmp/math_answers_wave3.json 저장 — 세션 중단 대비):
   - a) WebSearch: `2025학년도 수능 수학 정답표`, `2026학년도 6월 모의평가 수학 정답`, `2026 9월 모평 수학 정답` → 결과 중 티스토리/네이버블로그/위키 게시글을 web_fetch로 열어 정답표 텍스트 추출. (kice/ebsi/suneung 도메인은 차단이므로 시도 금지)
   - b) GitHub: bash에서 `curl -s "https://github.com/search?q=2025+수능+정답&type=repositories" | grep -o '"hl_name":"[^"]*"'` 로 repo 탐색 → `git clone --depth 1` 후 내용 확인. (전례: hehee9/2026-CSAT repo에 2026 수능 정답 있었음)
   - c) 보조 교차: `git clone --depth 1 https://github.com/young-0320/ProbDex /tmp/probdex` → `/tmp/probdex/assets/base_problems.json` 의 `ai_analysis` 내 logic_flow 결론값.
3. **저장 형식** (키 이름 정확히):
   ```json
   {"math_2025_csat": {"common": {"1": 1, "2": 3, ..., "16": "12", ..., "22": "500"},
     "cal": {"23": 2, ..., "29": "17", "30": "8"}, "geo": {...}, "sta": {...},
     "sources": ["URL1", "URL2"], "crossCheck": "ok", "unverified": []}, ...}
   ```
4. **교차검증**: 정답 있는 시험마다 8문항(공통 선다 3 + 공통 단답 2 + 선택 3)을 DB의 problem_latex를 읽고 **직접 풀어** answer와 대조. sympy 필요 시 `pip install sympy --break-system-packages`. 결과를 /tmp/verify_math_answers.json에 기록. 못 푸는 문항은 skip하고 다른 문항으로 교체하되 skip 수를 정직하게 기록.
5. **병합**: HANDOFF 문서(`평가원_수학영어_확장/09_handoff/HANDOFF_20260708_작업정리+차기프롬프트.md`)의 [태스크 T3] 파이썬 코드를 그대로 실행 (v1_2 로드 → wave3 정답 병합 → v1_3 저장 → data_math.js 생성).
6. **파일 안전 절차 (절대)**: /tmp에 쓰고 파싱 재검증 → `cat /tmp/파일 > mount경로` → mount에서 재읽기로 바이트 일치+파싱 확인. 실패 시 3회 재시도.

## 성능 낮은 모델이 놓치기 쉬운 엣지 케이스

1. **홀수형만 유효**: 짝수형 정답표를 수집하면 선지 번호가 다르다. 게시글에 "홀수형" 명시 확인. 명시 없으면 다른 소스와 대조해 판별.
2. **선택과목 3벌 구분**: 23~30번 정답이 미적분/기하/확통 별로 다르다. 블로그 표에서 어느 블록이 어느 과목인지 라벨을 반드시 확인. 순서 가정 금지.
3. **단답형은 문자열**: `"16": 12`(정수)가 아니라 `"16": "12"`(문자열). 선택형은 정수 1~5. 병합 스크립트의 형식 assert가 이를 검사한다 — assert 실패를 무시하고 진행 금지.
4. **ProbDex logic_flow는 '값'이지 '선지 번호'가 아님**: 결론이 "최종 값은 1"이면 해당 문항 choices에서 1이 몇 번 선지인지 매핑해야 한다. 값→번호 변환 없이 그대로 쓰면 오답.
5. **정답표 이미지 게시글**: 본문이 이미지라 web_fetch 텍스트가 비면 그 소스는 버리고 다음 소스로 (이미지 OCR 시도로 시간 낭비 금지).
6. **2026 6월 확통 특이**: 전사 노트에 "통계 문항 부재" 기록 있음 — 정답표와 문항 구성 불일치 발견 시 은폐하지 말고 notes로 보고.
7. **기존 answer 덮어쓰기 금지**: 병합 코드의 `if a and 'answer' not in q` 조건 유지 (이미 검증된 184문항 보호).

## 직접 검증할 수 있는 완료 기준 (대표용)

1. PowerShell에서: `node -e "global.window={};require('C:/Users/downf/suneung-viewer/평가원_수학영어_확장/08_tool/data_math.js');const q=window.GENIE_MATH.questions;console.log('문항',q.length,'정답',q.filter(x=>x.answer!==undefined).length)"` → **`문항 322 정답 322`** (또는 확보 실패분 명시 보고와 일치하는 수).
2. `지니학습기.html` 더블클릭 → 실력 진단 탭 → **수학 진단이 활성화**되어 있고, 수학 문항 풀이 후 채점이 정오를 표시.
3. 보고서에 시험별 crossCheck 상태표(ok/partial)와 교차검증 일치율(예: 32문항 중 32 일치)이 있고, 불일치 0이 아니면 해당 시험이 "요재검"으로 명시되어 있음.
