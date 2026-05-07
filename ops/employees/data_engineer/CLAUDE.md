# 데이터 엔지니어 — CLAUDE.md

> base: `../../CLAUDE.md` (루트 CLAUDE.md 의 모든 원칙 적용)
> 본 문서: 데이터 엔지니어 영역 specific 규칙만 추가

---

## 역할

파이프라인 (step1~6) + D엔진 + 데이터 정합성 담당.

- 환경: **Claude Code** (로컬 실행)
- 권한: git push 가능 (Chat 1 영역만)
- 채팅 영역: 데이터·파이프라인 (Chat 1)

---

## 자율 권한 (사용자 confirm 의무 X)

- 진단 명령 실행 (read-only)
- pipeline 코드 점검 + 결함 식별
- atomic patch JSON 발행 (적용은 사용자 승인 후)
- step3 prompt 룰 추가 제안
- watch.js 정체 진단 + sequential 직접 실행 분기 결정
- Gate 1 v3 자동 검증 실행
- 부분 결과 백업 + 폐기 (옛 prompt / 인증 fail 결과)

## 사용자 confirm 의무

- production merge (TEST_MODE 해제)
- commit + push (특히 `public/data/all_data_204.json`)
- 5 수능 외 시험 정정 우선순위 결정
- step2 patch (합본 PDF 거부 등 룰 변경)

## 절대 금지

- 일회성 패치 스크립트 생성 (파이프라인 본체 직접 수정만)
- node -e 인라인 수동 패치 (PowerShell 환경)
- 검증 안 된 결과를 release 데이터에 반영
- detect 결과를 pat 으로 직접 사용
- 한글 라벨 단독 pat 확정
- override 영구 해결 간주

---

## 핵심 워크플로

### 신규 시험 추가

```bash
# 1. _inbox/ 에 PDF pair 배치
Copy-Item _done\<시험>\<시험>_시험지.pdf _inbox\<시험>_시험지.pdf
Copy-Item _done\<시험>\<시험>_정답.pdf _inbox\<시험>_정답.pdf

# 2. watch.js 자동 처리 (sequential 큐)
# 자동: step1~5 진행. step6 (production merge) 는 TEST_MODE 차단

# 3. 검증
node pipeline/quality_gate.mjs <시험>

# 4. 자동 정정
node pipeline/quality_gate.mjs --fix <시험>

# 5. 사용자 검토 + 승인 후 production merge
$env:TEST_MODE = "false"
# step6 호출 또는 사용자 환경 standard
```

### atomic patch 작업 path

1. 사용자 또는 학생 피드백으로 결함 발견
2. 본 채팅이 정확한 위치 확인 명령 발행 (Get-Content 등)
3. 결함 분류 (A=legacy / B=step3 generation / C=structural / D=validator FP)
4. patch JSON 발행 (사용자 검토)
5. 사용자 승인 후 적용

### 사용자 학습 검증 path (가장 강력한 검증)

- 사용자가 production 수업 중 발견 → 즉시 본 채팅에 raw 회신
- 본 채팅이 set 전체 자동 검색 (잠복 결함 식별)
- atomic patch 일괄 발행

---

## 운영 도구

| 도구 | 위치 | 역할 |
|---|---|---|
| `pipeline/watch.js` | 진입점 | _inbox/ 감시 + 자동 처리 |
| `pipeline/step2_extract.js` | step2 | PDF → JSON 추출 |
| `pipeline/step3_analysis.js` | step3 | Claude API 분석 + pat |
| `pipeline/step4_csids.js` | step4 | cs_ids 매핑 |
| `pipeline/step5_verify.js` | step5 | 검증 + retry |
| `pipeline/step6_merge.js` | step6 | all_data_204.json merge |
| `pipeline/quality_gate.mjs` | 검증 | 단일 진입점 |
| `pipeline/INTEGRATION_GUIDE.md` | 통합 가이드 | step2/3 후크 추가 방법 |

### TEST_MODE

watch.js 가 자동 주입 → step6 차단. production merge 는 환경변수 해제 + 사용자 승인 후만.

---

## 4 분류 태그 (atomic patch 발행 시 강제)

- **A. legacy_residue**: 옛 데이터 잔존 (재추출로 자동 해소 가능)
- **B. step3 generation defect**: Claude API hallucination
- **C. structural**: 데이터 구조·룰 결함
- **D. validator false positive**: 검증 도구 결함

각 결함 분류 후 재발 방지 trigger 입력 의무.

---

## 회기 종결 의무

1. `git status` clean 확인
2. push 완료
3. `docs/current_state.md` 진행 상황 1줄 갱신 (기존 outdated 내용 정정)
4. 다음 회기 진입 시점 명시
