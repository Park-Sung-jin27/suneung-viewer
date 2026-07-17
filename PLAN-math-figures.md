# PLAN-math-figures — 수학 그림 문항 실물 이미지 crop 파이프라인

> **트랙: 수학 뷰어 · 우선순위 4/5** (선행: PLAN-math-answers-v13, PLAN-math-gate)
> 근거: 수학 DB의 그림 문항(전체의 약 20~25%, 기하는 절반 이상)은 현재 figureDesc 텍스트 설명만 제공. 기하·도형 문항은 그림 없이는 실전 학습이 성립하지 않음. 원본 PDF가 로컬에 있으므로 crop만 하면 됨.
> 라벨: [Confirmed] 소스 PDF 45개 보유(ProbDex clone). [Inference] 문항 경계 자동 검출 정확도는 파일럿에서 판정.

## 목표

math DB의 hasFigure=true 문항 전부에 대해 시험지에서 그림 영역을 PNG로 잘라 `평가원_수학영어_확장/08_tool/images/math/{문항id}.png` 로 저장하고, 학습기가 figureDesc 대신(또는 함께) 실물 그림을 표시하게 한다.

## 수정해야 할 정확한 파일

| 파일                                                            | 작업                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| `평가원_수학영어_확장/08_math_data/crop_figures.py`             | 신규 (PyMuPDF 기반 crop 도구 — 이 폴더에만, 국어 pipeline 금지) |
| `평가원_수학영어_확장/08_tool/images/math/*.png`                | 신규 (문항별 그림)                                              |
| `평가원_수학영어_확장/08_math_data/math_exam_db_v(최신+1).json` | figureImage 필드 추가한 새 버전                                 |
| `평가원_수학영어_확장/08_tool/data_math.js` + `지니학습기.html` | 이미지 표시 분기 (수정 전 .bak_figures 백업)                    |

## 단계별 작업 순서

1. **소스 준비**: `git clone --depth 1 https://github.com/young-0320/ProbDex /tmp/probdex` (이미 있으면 생략). `pip install pymupdf --break-system-packages`.
2. **파일럿 5문항 (자동화 전에 수동 좌표)**: hasFigure 문항 중 기하 3 + 공통 2를 골라, 200dpi 렌더에서 그림의 페이지·픽셀 좌표를 눈으로 확인 → PyMuPDF `page.get_pixmap(clip=fitz.Rect(...))` 으로 crop → 화질·경계 확인. 이 단계에서 "문항 번호 텍스트 위치로 문항 블록을 찾고, 블록 내 이미지/드로잉 오브젝트 bbox를 합집합" 하는 자동 규칙이 성립하는지 판정.
3. **자동화**: crop_figures.py 작성 — 입력: math DB 경로. 로직: hasFigure 문항마다 ① 해당 책자 PDF 열기 ② `page.search_for(f"{qid}.")` 로 문항 시작 y좌표, 다음 문항 번호로 끝 y좌표 확정 ③ 그 구간의 drawings/images bbox 합집합 + 여백 8px → pixmap 저장(150dpi, 폭 최대 900px). 검출 실패 문항은 `figure_crop_failed.json` 에 기록(은폐 금지).
4. **육안 전수 확인**: 생성된 PNG를 전부 열어 (Read 도구로 배치당 10장씩) "그림이 온전한가/옆 문항 침범 없는가" 확인. 실패분은 수동 좌표로 재crop.
5. **DB 반영**: 새 버전 DB에 `"figureImage": "images/math/2026_csat_geo_27.png"` 필드 추가 (figureDesc는 유지 — 대체 텍스트 겸용). math_gate 실행 CRITICAL 0 확인.
6. **뷰어 반영**: 지니학습기.html의 그림 박스 렌더를 `figureImage 있으면 <img> + 접기식 figureDesc, 없으면 기존 figureDesc 박스` 로 분기. node --check + 파일 안전 절차(/tmp→cat→readback).

## 성능 낮은 모델이 놓치기 쉬운 엣지 케이스

1. **문항 번호 검색의 함정**: `search_for("13.")` 은 본문 속 "13."(수치)에도 걸린다 — 페이지 왼쪽 여백 x좌표 범위(문항 번호는 열 시작 위치)로 필터링할 것.
2. **2단 조판**: 책자는 좌우 2단 — 문항 블록은 "해당 단의 x범위 안"으로 한정해야 옆 단 그림을 침범하지 않는다.
3. **그림 2개 문항**: 그림이 2개면 bbox 합집합이 본문까지 삼킬 수 있음 — 합집합 높이가 문항 블록의 70%를 넘으면 실패로 분류하고 수동 처리.
4. **표는 그림이 아님**: 표준정규분포표 등은 이미 problem_latex 텍스트 표 — hasFigure 판정에 섞여 있으면 crop 대상에서 제외(notes 확인).
5. **파일명 = 문항 id 그대로**: 임의 축약 금지 (뷰어 조인 키).
6. **이미지 총량**: 80~120장 × ~50KB = 수 MB — data_math.js에 base64 임베드 금지, 상대경로 파일 참조 (file:// 에서 같은 폴더 하위라 작동).
7. **저작권**: 그림도 평가원 저작물 — 산출물은 기존 방침대로 내부 검증용, 자문 전 공개 배포 금지.

## 직접 검증할 수 있는 완료 기준 (대표용)

1. `지니학습기.html` → 수학 → 기하 아무 그림 문항: 실물 그림이 보이고, 그림 아래 "[그림 설명 펼치기]"가 작동.
2. 탐색기에서 `평가원_수학영어_확장\08_tool\images\math\` 폴더에 PNG들이 있고, 아무거나 열면 문항 그림이 온전(옆 문항 침범 없음).
3. 보고서에 "hasFigure N건 중 자동 M건 + 수동 K건 + 실패 0건" 집계와 육안 전수 확인 언급이 있음.
