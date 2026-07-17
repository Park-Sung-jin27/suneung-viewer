# PLAN-consult-data-audit — 컨설팅 데이터 정합 감사 + 발췌 정본 생성

> **트랙: 컨설팅 · 우선순위 1/5 (컨설팅 트랙의 기반 — consult-bridge보다 먼저)**
> 근거: 컨설팅 기능 전부(bridge·성적 입력·강사 모드)가 컨설팅_데모 데이터를 원료로 쓰는데, 이 데이터는 감사되지 않은 수집본(중복 리포트 파일이 이미 존재 = 품질 이슈 전력). 오염된 컷/환산표 위에 지은 기능은 상담 오정보 = 신뢰 붕괴. 감사 1회가 이후 모든 컨설팅 PLAN의 안전판.
> 라벨: [Confirmed] 스키마 실측 — jeongsi_cutoffs 4,363행(univ/dept/cut70), score_conversion 413행(raw→std/percentile/grade), conversion_formulas 96행(대학 환산식), universities 220행. [Unverified] 값의 정확도 — 본 감사가 판정.

## 목표

컨설팅_데모 데이터 5종을 감사(중복·결측·범위·교차 정합)하고, 학습기가 쓸 **발췌 정본** `평가원_수학영어_확장/11_consult/consult_master_v1.json` 을 만든다 (원본 무수정).

## 수정해야 할 정확한 파일

| 파일                                                     | 작업                    |
| -------------------------------------------------------- | ----------------------- |
| `컨설팅_데모/data/*.json`                                | **읽기 전용**           |
| `평가원_수학영어_확장/11_consult/consult_master_v1.json` | 신규 (감사 통과 발췌본) |
| `평가원_수학영어_확장/11_consult/audit_report.md`        | 신규 (감사 결과)        |

## 단계별 작업 순서

1. **감사 스크립트 (python, /tmp에서 실행)** — 5파일 각각:
   - 중복: jeongsi_cutoffs에서 (univ,campus,dept,group) 중복 행 수 — 기존 `susi_cutoffs_duplicates_report.json` 도 열어 기지 이슈 대조.
   - 범위: cut70이 백분위라면 0~~100 밖 값, capacity·competition 음수/비정상(경쟁률 500:1 초과 등), score_conversion의 grade 1~~9 밖·percentile 0~100 밖·raw가 과목 만점 초과.
   - 결측: 핵심 필드(univ/dept/cut70, raw/std/percentile) null·빈 문자열 비율.
   - 교차 정합: ① jeongsi_cutoffs.univ ⊆ universities.name 인지 (불일치 대학명 목록 — 표기 흔들림 "서울대/서울대학교" 검출) ② conversion_formulas.univ도 동일 ③ score_conversion이 어느 시험(exam 필드) 기준인지 목록화(리포트 연도 표기 재료).
   - source 필드 분포: 출처별 행 수 (출처 불명 행 비율).
2. **감사 리포트 작성**: 결함 유형별 건수 + 대표 샘플 5건씩 + "발췌 시 제외 규칙" 제안. 결함률 10% 초과 필드는 [사용 보류] 판정.
3. **발췌 정본 생성**: 감사 통과 행만으로 ① `cutLines`: 대학/계열 대표 컷(cut70) — 계열(group)별 상위권부터 정렬 ② `scoreTable`: score_conversion 최신 시험분 ③ `formulas`: conversion_formulas 중 english_grade_table 있는 대학 ④ `meta`: 수집 연도·출처·감사일. 크기 ≤ 300KB (행 수 조절).
4. **재검증**: json.load + 발췌 행수/제외 행수 집계 출력 + 파일 안전 절차(/tmp→cat→readback).

## 성능 낮은 모델이 놓치기 쉬운 엣지 케이스

1. **cut70의 단위 가정 금지**: 백분위 70%컷인지 환산점수인지 필드만 보고 단정하지 말 것 — 값 분포(0~~100에 몰리면 백분위, 수백~~천이면 환산점수)와 source를 보고 판정해 리포트에 근거 명시. 단위를 오인하면 이후 모든 기능이 오염.
2. **대학명 표기 흔들림**: "서울과학기술대"와 "서울과기대" 같은 변형 — exact 불일치 목록을 만들되 **자동 병합 금지**(오병합이 더 위험), 매핑 테이블 초안만 제안.
3. **campus 구분**: 같은 대학명·다른 캠퍼스는 다른 행 — 중복 판정 키에 campus 필수 포함.
4. **score_conversion의 exam 혼재**: 여러 시험(모평·수능)이 섞여 있음 — 시험별로 분리하지 않고 합치면 등급 경계가 엉킴. 발췌는 시험 단위로.
5. **0의 의미**: capacity 0, competition 0이 "결측"인지 "실제 0"인지 — 결측 취급하되 리포트에 구분 불가로 명시.
6. **원본 절대 무수정**: 감사 중 발견한 오류도 원본을 고치지 말고 발췌에서 제외 + 리포트 기록 (원본은 별도 프로젝트 소유).
7. **개인정보**: sample_students.json은 발췌 대상 제외 (실명 여부 불명 — 감사 리포트에 확인 요청만).

## 직접 검증할 수 있는 완료 기준 (대표용)

1. `audit_report.md` 를 열면 5파일 × (중복/범위/결측/교차) 표와 대표 샘플, cut70 단위 판정 근거가 있음.
2. PowerShell: `python -c "import json; d=json.load(open(r'C:\Users\downf\suneung-viewer\평가원_수학영어_확장\11_consult\consult_master_v1.json',encoding='utf-8')); print(list(d.keys()), len(d['cutLines']), len(d['scoreTable']))"` 가 에러 없이 키·행수를 출력.
3. 리포트의 "제외 행수 + 발췌 행수 = 원본 행수" 산수가 맞음 (은폐 없음).
