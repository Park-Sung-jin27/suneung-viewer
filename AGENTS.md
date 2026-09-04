# AGENTS.md — suneung-viewer 프로젝트 가이드

> 본 문서는 모든 AI 직원이 자동 로드하는 **단일 정본**.
> 회기 specific 내용 (날짜·자가 결함 누계·특정 commit 진행 상황 등) 일체 본 문서 외 — `docs/current_state.md` 참조.
> 갱신 정책: 운영 원칙 변경 시만. 일일 진행 상황은 `docs/current_state.md`에 기록.

---

## 0. 회사 컨텍스트

| 항목            | 내용                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------- |
| 제품            | **지니쌤과 공부하자** (suneung-viewer.vercel.app)                                            |
| 카테고리        | 수능 국어 기출 논리맵핑 인터랙티브 웹 뷰어                                                   |
| **핵심 차별점** | **모든 선지에 지문 근거 문장을 형광펜(cs_ids)으로 1:1 시각 연결**                            |
| 타깃            | 3~4등급 수능 국어 학습자                                                                     |
| 대표            | 성진 — 솔로 창업자, **비전공자 (코딩 지식 없음)**, 김과외 상위 0.1% 강사                     |
| 비전            | 국내 최고 에듀테크 (AI 담임교사: 진단 → 플래너 → 학부모 리포트 → 입시 컨설팅 → 전 과목 확장) |

**AI 직원 임무**: 본 프로젝트로 회사 비전 달성 보조. 세계 최고의 기획자·개발자 수준의 판단 제공.

---

## 1. 응답 필수 형식 (절대 준수)

### A. 사실/추론 라벨 (모든 주장에 명시)

- `[Confirmed]` — 교차 검증된 사실
- `[Inference]` — 합리적 추론 (근거 필수)
- `[Unverified]` — 단일 출처 또는 근거 부족
- `[확인 필요]` — 사용자 확인 필요

### B. 응답 말미 3블록 (절대 누락 금지)

```
**지금 당장 할 것** (1~3개, 실행형, 비전공자 복사-붙여넣기 수준)
**하지 말 것** (1~2개)
**가장 큰 리스크** (1개)
```

### C. 비전공자 복사-붙여넣기 수준 강제

- ❌ 금지: "~하면 됩니다", "~를 고려해보세요", "~가 좋을 수 있습니다"
- ✅ 강제: "이 명령어를 PowerShell 에 붙여넣고 엔터: `npm run build`"
- 코드 변경 시: 어느 파일 몇 번째 줄을 어떻게 바꾸는지 지정

### D. 비전공자 친화 설명 원칙 (대표 = 비전공자 정합 — 절대 의무)

**대표는 코딩 비전공자입니다.** 모든 설명은 다음 원칙을 따릅니다:

1. **추상 단어 무의미 반복 금지**:
   - ❌ 금지: "path", "사양", "정합 path", "잠재 path", "사양 path", "정합 사양"
   - ✅ 사용: "방법", "방식", "내용", "방안", "조건", "확인됨", "확인 필요"
   - 매 답변 작성 후 자가 grep 의무 (path/사양 단어 5회 초과 시 재작성)

2. **한국어 자연 문장 사용**:
   - ❌ 금지: "사용자 명시 승인 사양 path 정합 의무"
   - ✅ 사용: "사용자 명시 승인이 필요합니다"

3. **표 + 짧은 문장 + 명확한 결론 우선**:
   - 한 답변에 표 1~2개 + 표 외 텍스트는 짧게
   - 결론 → 근거 → 다음 의무 순서

4. **기술 용어 사용 시 한 줄 설명 동반**:
   - ❌ 금지: "Vercel auto-deploy ~2분 path"
   - ✅ 사용: "Vercel(웹사이트 자동 배포 서비스) ~2분 후 라이브 반영됩니다"

5. **답변 길이**:
   - 핵심 사실 + 다음 의무만 (장황한 설명 금지)
   - 토큰 효율 + 사용자 시간 절약 우선

**자가 점검 의무**: 매 답변 발행 사전 위 5 원칙 grep. 위반 시 재작성 의무.

**재발 lock**: 본 원칙은 자가 결함 #9·#20·#21 (path/사양 단어 무의미 반복) 영구 정정 lock입니다. 위반 누적 시 사용자에게 새 채팅 권고 의무.

---

## 2. AI 직원 자율 권한 명시

### 자율 권한 (사용자 confirm 의무 X)

| 영역                                                                          | 자율 가능 |
| ----------------------------------------------------------------------------- | --------- |
| 진단 명령 실행 (`Get-ChildItem`, `Get-Content`, `Select-String` 등 read-only) | ✓         |
| pipeline 코드 점검 (read)                                                     | ✓         |
| 결과 해석 + 정정 path 제안                                                    | ✓         |
| atomic patch JSON 발행 (사용자 검토 의무, 적용은 사용자 승인 후)              | ✓         |
| step3 prompt patch 발행 (검증·적용은 사용자 승인 후)                          | ✓         |
| watch.js 진행 모니터링 + 정체 진단                                            | ✓         |
| Gate 1 v3 자동 검증 실행                                                      | ✓         |
| 일일 상황 (`docs/current_state.md`) 갱신 제안                                 | ✓         |

### 사용자 confirm 의무 영역 (절대 자율 금지)

| 영역                                                     | 의무                |
| -------------------------------------------------------- | ------------------- |
| **production merge** (TEST_MODE 해제 + step6 호출)       | 사용자 승인         |
| **commit + push** (특히 `data-source/all_data_204.json`) | 사용자 검토 후 승인 |
| **schema 변경** (`feedback_logs` 등 신규 테이블)         | 사용자 결정         |
| **release 출시 시점**                                    | 사용자 결정         |
| **가격·요금제·B2B 단가**                                 | 사용자 결정         |
| **5 수능 외 시험 정정 우선순위**                         | 사용자 결정         |
| **자동 해설 재생성·일회성 스크립트 생성**                | **금지 (절대)**     |

---

## 3. Codex 작업 4 원칙

### 1. Think Before Coding — 추측 X. 혼란 숨김 X. 트레이드오프 명시.

- 가정은 명시적으로 표현. 불확실 시 ask
- 해석이 여러 개 가능하면 모두 제시 — 임의 선택 X
- 더 단순한 path 가 있으면 명시. 정합 시 push back
- 불명확하면 멈추기. 무엇이 혼란인지 명명. ask

### 2. Simplicity First — 문제 해결 최소 코드. speculative X.

- 요청 외 기능 추가 X
- 단일 사용 코드에 추상화 X
- 요청 안 한 "유연성" / "configurability" X
- 불가능한 시나리오에 error handling X
- 200 줄 작성했는데 50 줄 가능하면 재작성
- self-check: "시니어 엔지니어가 overcomplicated 라고 할까?" → yes 면 단순화

**본 프로젝트 정합**: "일회성 패치 스크립트 금지", "가산적 조건 분기 금지" 와 직접 정합.

### 3. Surgical Changes — 의무 영역만 변경. 본인이 만든 영역만 정리.

**기존 코드 편집 시**:

- 인접 코드 / 주석 / 형식 "개선" X
- 깨지지 않은 영역 refactor X
- 기존 스타일 일치 (본인이 다르게 했을 영역도)
- 무관한 dead code 발견 시 — 명시만, 삭제 X

**변경이 orphan 생성 시**:

- 본인 변경으로 unused 된 import / variable / function 삭제
- 사전 존재 dead code — 요청 없으면 삭제 X

**테스트**: 변경된 모든 line 은 사용자 요청 영역에 직접 trace 가능 의무.

**본 프로젝트 정합**: "JSX 완전 파일 재작성" + "본체 파이프라인 직접 수정" + Codex 자율 광역 변경 회피.

### 4. Goal-Driven Execution — success criteria 정의. verify 까지 loop.

작업을 검증 가능한 목표로 변환:

| 약한 표현         | 강한 표현                              |
| ----------------- | -------------------------------------- |
| "validation 추가" | "invalid inputs test 작성 → pass 확인" |
| "버그 fix"        | "버그 재현 test 작성 → pass 확인"      |
| "X refactor"      | "전후 모든 test pass 확인"             |

**multi-step 작업 시**: brief plan 사전 명시.

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

강한 success criteria → 자율 loop 가능. 약한 criteria ("make it work") → 사용자에 매번 clarification 의무.

**본 프로젝트 정합**: `quality_gate.mjs` + `release_ready` 4기준 + Gate 5a/5b 분리 = success criteria. atomic patch 발행 시 "어느 검증 통과 시 종결" 명시 의무.

### 본 프로젝트 specific 예외

- "No error handling for impossible scenarios" — 본 프로젝트 D엔진 wrapper retry 정책 (`D_ENGINE_AUTH_401` / `D_ENGINE_RATE_429` / `D_ENGINE_5XX_*` throw) 영역 정합 X. **API 에러 처리는 의무**.
- "No abstractions for single-use code" — 본 프로젝트는 통합 컴포넌트 (BogiRenderer 등) 영역 권고 — single-use X 다중 사용 영역.

---

## 4. 채팅·직원 구조

### 직원 구성 (4 상시 + 2 온디맨드 + 지휘부)

| 채팅                   | 역할                             | 도구       |
| ---------------------- | -------------------------------- | ---------- |
| **품질 심사관**        | 통합 지휘 (직원 아닌 지휘부)     | 일반 Codex |
| **데이터 엔지니어**    | 파이프라인·D엔진·데이터 (Chat 1) | **Codex**  |
| **프론트엔드**         | React·UX·Supabase (Chat 2)       | **Codex**  |
| 전략가                 | 사업 결정 sparring               | 일반 Codex |
| 카피라이터             | 텍스트·랜딩                      | 일반 Codex |
| 디자이너 (온디맨드)    | UI 디자인                        | -          |
| 기능 기획자 (온디맨드) | 신기능 사양                      | -          |

### 채팅 운영 규칙

- **Chat 1 / Chat 2 동시 git push 금지**
- git push 권한: 데이터 엔지니어 / 프론트엔드 채팅만
- 다른 직원: 초안만 제시, 품질 심사관 승인 후 push
- 동시 활성 직원 최대 2개 (대표 집중력 보호)

### 영역 lock 예외 사양 (2026-05-24 사용자 결정 path)

- **데이터 엔지니어 (Chat 1) 안 `src/dataLoader.js` 안 `RELEASE_SET_IDS` 단독 수정 path 허용**:
  - 사유: approval record 생성 사후 RELEASE_SET_IDS 추가 사양 = 자연 흐름 path (data 작업 일관성 사양)
  - 의무: 사용자 명시 승인 사양 path 안 진행 단독
  - 단 — `src/*.jsx` + `api/*.js` + `constants.js` 안 다른 file = Code A 영역 단독 유지 path
  - 사례: commit `2d3644b` (2026-05-24 Code B Auto Mode — RELEASE_SET_IDS 57→90 추가)

### 직원별 sub-AGENTS.md

각 직원은 `ops/employees/{role}/AGENTS.md` 에서 역할 specific 규칙 추가. 본 AGENTS.md 가 base.

---

## 5. 절대 원칙 (변경 금지)

### 파이프라인 4대 원칙

1. **detect 결과를 pat 로 직접 사용 금지**
2. **한글 라벨 단독으로 pat 확정 금지**
3. **복합 라벨("및"/"+"/"/")에서 임의 선택 금지**
4. **override 를 영구 해결로 간주 금지**

### 보조 원칙

- **일회성 파일 생성 금지** (패치 스크립트·점검 스크립트·진단 도구 일체) — 파이프라인 본체 (step2/step3/step6) 직접 수정 의무
- **`scripts/` 폴더 과도한 증가 지양**
- **JSX 수정은 완전 파일 재작성** (Python string replacement 금지)
- **가산적 조건 분기 금지** → 단일 통합 컴포넌트 (예: BogiRenderer)
- **`data-source/all_data_204.json` 단일 파일 구조 유지**
- **자동 해설 재생성 금지 (절대)** — 단 — **시범 예외 사양 (2026-05-24 사용자 결정)**:
  - **시범 1 yearKey 단독** (2019수능 권고) Step3 재실행 허용 — D엔진 검증 통과 사양 단독
  - 시범 종결 사후 결정 의무: 전수 진입 (c 전수 path) 또는 보류
  - 전수 진입 PASS 사양 사후 본 원칙 영구 정정 사양 (D엔진 검증 통과 단독 허용)

### 핵심 차별점 보호 (절대 의무)

- **사용자 목표 = 2014~2026학년도 13개년 전체 완성** (2026-05-21 명시)
  - **FREE_YEARS (무료 공개 5개년) = 2022~2026수능** — 베타 출시 사전 100% 탑재 의무 (정정 미완 수용 불가)
  - **LEGACY 8개년 (2014~2021수능) = 13개년 path 일부** — 즉시 병행 진입 (2026-05-21 사용자 결정)
  - 모의평가 (6월/9월) 2022~2026 = 16 yearKey 탑재, release 미진입 (잠재 path)
- **해설 품질 최우선**
- 출시 시점 보호는 정합성 보호의 하위 목표

### 컨텍스트 (2026-05-21)

- 모두의창업 심사 기간 진행 중
- Tally 베타 테스터 모집 중 (B2C form: 81jOpo)
- FREE 5수능 진척: **39/40 = 97.5%** (l2025b 단독 미승인 — data-ready)
- LEGACY 2021수능: Phase 3.4 완전 완료 (approval 미제출)

### DO NOT TOUCH (절대 금지 4건)

1. 검증 안 된 파이프라인 결과를 release 데이터에 바로 반영
2. node -e 인라인 수동 패치 (특히 PowerShell 환경)
3. "전체 N개 동일 품질" 표현 (실제 편차 존재. 과장 금지)
4. 출시 직전 대규모 UI 변경

---

## 6. 데이터 구조

### 정본 파일

`data-source/all_data_204.json` — **단일 파일 구조 유지** (~10.7MB)

⚠️ `src/data/all_data_204.json`는 **존재하지 않음** (과거 기록 무효).

### 보조 파일

- `public/data/annotations.json` — bracket / box / underline / marker
- `public/images/` — 이미지 에셋

### 연도 키 컨벤션

- 수능/9월 = 학년도 (시행연도 + 1). 예: 2025년 11월 → `2026수능`
- 6월 = 학년도 = 시행연도. 예: 2022년 6월 → `2022_6월`

### setId 명명 규칙

- 수능 (11월): `r{학년도YY}{문자}` / `l{학년도YY}{문자}` (예: r2023a, l2026b)
- 9월 모의: `r{학년도YY}9{문자}` / `l{학년도YY}9{문자}` (예: r20239d)
- 6월 모의: `r{학년도YY}6{문자}` / `l{학년도YY}6{문자}` (예: r20226a)

### sentId 포맷

```
{setId}s{번호}      예: r2026as1, l2026bs5
```

**언더스코어 없음** (중요).

### ok 필드 (절대 규칙)

- `ok: true` = 지문과 사실 일치
- `ok: false` = 지문과 사실 불일치
- **발문 유형과 무관**하게 사실 일치만으로 판정
- `questionType: positive` → ok:true가 정답
- `questionType: negative` → ok:false가 정답

### 오답 패턴 (총 9종 + V)

**독서 (R1~R4)**

- R1: 팩트 왜곡 (수치·상태·방향 불일치)
- R2: 인과·관계 전도 (원인-결과 / 주체-객체 반전)
- R3: 과도한 추론 (지문에 없는 내용 / 1단계 이상 비약)
- R4: 개념 짜깁기 (다른 문단 개념 혼합)

**문학 (L1~L5)**

- L1: 표현·형식 오독
- L2: 정서·태도 오독
- L3: 주제·의미 과잉
- L4: 구조·맥락 오류
- L5: 보기 대입 오류

**공통**: V — 어휘 (기본값, ok:false 인 경우)

**도메인 엄수**: 독서에 L* 금지, 문학에 R* 금지

### R2 판정 엄격 기준

R2 = 인과·관계 전도. 다음 조건 충족 시에만 R2:

✅ **명시적 인과 접속어** ("~때문에", "~해서", "~로 인해")
✅ A→B를 B→A로 뒤집은 경우만

R2 **아님**:
❌ 함수 관계의 단일 결과값 방향 반전 (R1)
❌ 대응 관계의 역할 교환 (R1)
❌ 정의 왜곡 (R1 또는 R3)

### release_ready 4기준

다음 4개 모두 **0건** 시 release_ready:

```
1. ok:true cs_ids=[]                                  → 0건  (근거 누락)
2. DEAD_csid                                          → 0건  (존재하지 않는 sentId 참조)
3. F_empty_analysis                                   → 0건  (해설 누락)
4. ok:false + R1/R2/R4/L1/L2/L4/L5 + cs_ids=[]      → 0건  (왜곡 출처 누락)
```

자동 검증:

```powershell
node pipeline/quality_gate.mjs --scope=release
```

개발 중 빠른 확인용 보조: `--scope=suneung5` (LIVE 241 중 40세트만)

**공개 승격 4관문** — 비노출 세트를 `src/dataLoader.js` 의 `RELEASE_KEYS` 에 추가하기 전에 통과해야 하는
공개 절차다 (발주 eg · 2026-08-13). 위 `release_ready` 4기준은 **데이터 무결** 기준이고, 아래 4관문은
**공개 절차** 기준이다 — 둘은 별개이며 이름이 겹치지 않도록 구분한다.
① `node pipeline/quality_gate.mjs --scope=release` → CRITICAL 0.
② `node pipeline/answer_fidelity.mjs` → 정답 불일치 0 (PDF 정답표 대조).
③ 해설 반전 축 2종 0건 — `F_distractor_reads_as_answer`(오답 선지가 자기를 정답이라고 설명) ·
`F_answer_reads_as_distractor`(정답 선지가 자기를 오답인 듯 설명).
미처리 건수는 목록으로 적지 말고 실행해서 확인한다 — `node pipeline/quality_gate.mjs`
(인자 없이 실행하면 전수 353세트를 돈다. 전수 전용 스코프 프리셋은 없다).
그 산출에서 두 축이 모두 0건이어야 공개할 수 있다.
④ 세트당 최소 1문항 사람 통독. ③의 두 축은 등록된 어구 16개만 잡으므로,
같은 결함을 다른 말로 쓴 해설은 통과한다 — 기계 0건이 곧 무결이 아니다.
`src/dataLoader.js` 의 `RELEASE_KEYS` 선언 직상단 주석은 이 **공개 승격 4관문**을 가리키는 요약이며,
정본은 이 문단이다.

### 검증 단계 정의

세트 단위 완결로 검수한다. 진행률 지표는 결함 수가 아니라 **VERIFIED 세트 수 / 전체 세트 수** 다.
대장은 `config/verification_ledger.json` 이며 기록 전용이다 — 게이트는 이 파일을 읽지 않는다.

```
UNTOUCHED → SOURCE_OK → CONTENT_OK → EVIDENCE_OK → RENDER_OK → VERIFIED
```

**SOURCE_OK** = 아래 3개를 전부 통과한 상태다. 지문이 시험지 원문과 1자 단위로 같음을 사람이 확인한 단계다.

1. **(a) 자동 대조 — 2종을 함께 돌린다**

   ```powershell
   node pipeline/passage_fidelity.mjs --yk=<회차>   # 본문
   node pipeline/structure_fidelity.mjs             # 구조
   ```

   CLAUDE.md L667 「3게이트(정답·본문·구조)」 중 **본문·구조**가 이 둘이다.
   diff 를 한 건도 남기지 않고 사람이 **진짜 오타** 또는 **추출 artifact**(古語·한양PUA·줄바꿈·공백)로
   판정하고 근거를 남긴다. **미판정 diff 가 1건이라도 있으면 통과가 아니다.**

1. **(a-2) 자동 대조의 사각 3종 — 사람이 직접 본다. 통과 조건에 포함된다.**

   자동 대조가 "0건"을 내도 아래 3종은 **애초에 검사되지 않은 것**이다.
   근거는 `config/passage_fidelity_thresholds.json` 의 `_NOTE_sent_types` · `_NOTE_absolute` · `min_exam_hangul`.

   - **① 검사 스코프 밖 sent** — `sentType ∉ {body, verse, speech, stage}` (`none`·`image` 등).
     세트별 건수를 출력하고 **전건 육안 확인**한다.
   - **② 한글 133자 이상 문장** — 포함도가 비율 판정식이라 긴 문장에서 1점 변조가 임계 위로 떠오른다.
     임계·윈도 조정으로 닫히지 않는 **판정식 자체의 성질**이다. 세트별 목록을 뽑아 **전건 육안 대조**한다.
   - **③ 시험지 추출 한글 < 3000자 회차** (`min_exam_hangul`) — 자동 대조가 무효다.
     **렌더 육안으로 전문 대조**한다. 현재 해당: `2014수능A`(579자) · `2014수능B`(562자).

   ★ **①②의 세트별 건수를 `SOURCE_OK` 기록의 `note` 에 반드시 남긴다.**
   "자동 0건"만 적고 사각 건수를 적지 않으면 §13⑮ 위반이다 — 분모 없는 0 은 무효 신호다.
2. **(b) 마커·각주·보기의 위치 대조** — 마커(㉠~㉩ · ⓐ~ⓖ · Ⓐ~Ⓔ — 실사용 최대치, 발주 fb 실측)·각주·`<보기>` 3축이
   PDF 의 어느 자리에 있는지를 대조한다. **자동 대조는 이 축을 보지 않는다**(CLAUDE.md §13⑦·§13⑭).
   ★ **문단 구분은 이 축에서 뺐다**(심사관 판정 172). 문단 결손은 167세트(LIVE 101 = 42%)에 걸린
   **스키마 미탑재**이지 세트 고유 결함이 아니어서, 세트별 검수로 167회 반복할 일이 아니다.
   대신 아래 `VERIFIED` 전제 조건으로 옮겼다.
3. **(c) image-only 회차는 렌더 육안 대조** — 시험지 PDF 에서 텍스트가 추출되지 않는 회차(2014 등)는
   (a)가 원천적으로 무효다(§13⑬). 이 경우 렌더 화면으로 지문 전문을 눈으로 대조한다.

통과 시 대장의 `history` 에 `{state, by, date, minutes, note}` 를 남긴다. `minutes` 는 그 단계에
실제로 걸린 시간(분)이며 **누락하면 통과로 인정하지 않는다** — 나머지 세트의 진행 여부를
판단할 근거가 이 기록뿐이기 때문이다.

**★ `SOURCE_OK` 는 (a)·(a-2)·(b)·(c) 까지다 — 세트마다 값이 달라 사람이 봐야만 판정되는 축만 남겼다**
(심사관 판정 174). 아래 「코퍼스 일괄 축」은 세트별 검수에서 제외한다.

`CONTENT_OK` 이후 단계의 정의는 **아직 쓰지 않는다.** 1묶음에서 `SOURCE_OK` 를 실제로 해 본 뒤
그 경험으로 정의한다. 해 보지 않은 것을 미리 규정하지 않는다.

### 코퍼스 일괄 축

세트별 검수로 반복할 일이 아닌 축이다. **전 코퍼스 스캔으로 한 번에 처리한다**(심사관 판정 172·174).
아래 건수는 발주 fb 실측(2026-08-14 · 전 353세트).

| 축 | 내용 | 건수 (LIVE / 비노출) |
|---|---|---|
| **D** | `para`/`pid` 미보유 세트 — 화면에서 문단이 한 덩어리로 렌더된다 | **167** (101 / 66) |
| **E** | `annotation` 의 `sentId` 가 실제 문장 id 에 없음 — 밑줄이 렌더되지 않는다 | **166** (129 / 37) |
| **F1** | `annotation` 의 `sentId` 는 유효하나 그 문장에 `text` 가 없음 — 밑줄이 엉뚱한 곳에 걸린다 | **61** (61 / 0) |
| **F2** | `annotations` 가 0건인 세트 — PDF 밑줄 대조는 미수행(전수 비용) | **268** (166 / 102) |
| **F3** | 지문 구분자 `(가)`~`(라)` 가 `sentType=workTag` 가 아님 | **7** (7 / 0) |
| **F5** | `sentId` 배열 역행 — 배열 순서와 id 번호가 거꾸로 | **41** (31 / 10) |

**`VERIFIED` 는 D 축(문단 구분 보유)을 전제로 한다. 미보유 세트는 문단 복원 완료 후에만 `VERIFIED` 로 잠근다.**

**마커 범위** — 원문자 마커 상수는 **실사용 최대치**로 둔다. 전 코퍼스 실측(발주 fb):
`ⓐ~ⓖ`(7종) · `㉠~㉩`(10종) · `Ⓐ~Ⓔ`(5종). **임의 확장 금지** — 실사용을 넘겨 넓히면 오탐이 는다.
새 마커가 나오면 다시 실측해 넓힌다. `①~⑤` 는 선지 번호 체계와 공유하므로 넓히지 않는다.

---

## 7. step3 prompt 절대 룰

### 보기·지문 인용 verbatim

- bogi 필드의 수치(숫자), 고유명사, 인용문은 **반드시 원문 그대로 사용**
- 변형·추정·반올림·일반 예시 대체 금지
- 비슷한 비율의 다른 숫자도 금지 (예: 440/550 → 400/500 변형 금지)
- 보기·지문 인용 따옴표 안 텍스트는 글자/숫자 그대로 복사
- 지문 근거 인용 시 sents 의 t 필드 텍스트 그대로 (의역·요약·글자 변형 금지)

### 보기 문제 오류 유형

bogi 필드 비어있지 않은 문항 → analysis 에 다음 중 하나 명시:

1. **보기 오독**: 보기 조건 자체를 잘못 이해
2. **보기 대입 오류**: 보기 조건을 지문/작품에 잘못 적용
3. **지문 오독**: 보기와 무관하게 지문 사실 자체 왜곡

---

## 8. D엔진 (현 최우선 작업)

### 역할

Step3 Codex 출력의 pat/analysis 가 실제 오류 구조와 맞는지 **반증 판정**.
**"apply 는 바보처럼, D엔진은 집요하게"**

### 구조

```
Step3 Codex (생성)
 → Layer 0 deterministic precheck (semantic 금지)
 → GPT-5 D엔진 (독립 반증, fail 만 판정)
 → D fail 시 Step3 재호출 1회
 → 실패 시 temporary_override 또는 needs_human
```

### Layer 0 역할 (엄격 제한)

**허용**:

- domain mismatch 감지
- pat missing 감지
- composite label 감지 ("및"/"+"/"/")
- bracket recovery A-1 (직접 표기된 bracket 단일 매핑)

**금지**:

- semantic diff_type 확정
- value_conflict → pat 자동 부여
- entity_match 판단
- "같은 대상인가?" semantic 판단
- suggested pat 생성

### Phase 체계 (두 가지 다른 체계 명확화)

**Phase A~D = 아키텍처 구축 단계**

- Phase A: Layer 1~7 아키텍처 구축
- Phase B: 현재 fatal 처리
- Phase C: 연도 확장
- Phase D: 장기 리팩토링

**Phase 1~3 = D엔진 개발 단계**

- Phase 1: Gold 샘플 설계 + dry-run 검증
- Phase 2: 파이프라인 통합 (Stage 2 진입 선결 조건 후)
- Phase 3: R3, R4, 문학 L1~L5 확장

### Gold 샘플 5원칙 (D엔진 신뢰성 핵심)

1. **Input 오염 금지**: 정답 힌트, error_type 암시, rule_hits 암시, Step3 한글 라벨 전부 금지
2. **Expected reason 은 현상 설명만**: if-then 공식 금지, input 해석 금지
3. **rationale/test_intent 에 D엔진 행동 유도 금지**: "D엔진이 ~감지하는지" 표현 금지
4. **precheck_signals 전부 false**: D엔진 독립성 확보
5. **📌 근거는 passage 내 연속 원문 문자열** (contiguous substring exact match): paraphrase / 말줄임표 / 단어 축약 / 외부 문장 전부 금지

### Gold 오염 4유형 (반복 발견)

1. **정답 힌트**: "따라서 오답 패턴이 적용될 수 없다" 등
2. **규칙 설명**: "ok:true 이므로 pat 이 존재할 수 없다" 등 if-then 공식
3. **input 해석**: "analysis 도 ~로 인정하고 있음에도" 등
4. **D엔진 행동 유도**: "D엔진이 ~감지하는지 검증" 등

### 의제 1·2·3 결정 (영구)

상세는 `docs/d_engine_decisions.md` 참조.

- **의제 1 (비결정성)**: Hybrid majority. 1회 기본 + 트리거 시 2회 추가. 2/3 일치 채택, 3-way 분기 needs_human
- **의제 2 (RULE_7)**: 격하 운영. 메타-고백형만 유효. 발동 시 무조건 재호출 트리거
- **의제 3 (E_EVIDENCE_WEAK)**: Subtype B 5조건 충족만 허용

---

## 9. 운영 lock (Phase 0/A 적용)

> 본 §9 는 lock 명칭만. 정확한 정의 + 운영 규칙 raw 는 **`docs/lock_baseline.md`** 참조.

### Lock 1~22 baseline (명칭)

```
Lock #1  : push 분리 (Integration Push + Release Approval)
Lock #2  : issue_id 정밀화 (QG-{exam}-{setId}-{Qn}-{patch_type})
Lock #5  : Gate 5 분리 (5a Technical + 5b Learning)
Lock #7  : schedule_basis (Phase 기준만 — 일정 표현 폐기)
Lock #9  : naming (issue_id 정본 / Spec A/B/C/D 보조명)
Lock #12 : 라벨 분리 (9 라벨 — 아래 §A)
Lock #14 : commit message issue_id 강제
Lock #15 : release_approval_qa (독서 A·B·D / 문학 A·B·C·D)
Lock #17 : release_approval_record_schema
Lock #18 : issue_lifecycle (new → ... → closed 외 deferred/rejected/rolled_back/needs_human)
Lock #20 : operating_doc_no_tool_dependency
Lock #21 : pat_decision_rules (config/pat_decision_rules.json 흡수)
Lock #22 : qa_mapping_minimization (analysis 수정 → A 필수 / cs_ids → B / 문학 → B+C / pat 변경 → D / ok·questionType → Data Contract)
```

(주: 직접 운영하는 lock 만 명시. 전체 22 lock 은 `docs/d_engine_decisions.md` 또는 archive 참조)

### §A. 라벨 분리 (9 라벨)

**기존 4** (의사 결정 라벨):

- `[Adopted]` (정책 채택)
- `[Confirmed]` (사실 확인 — PDF 등 원천 cross-check 후)
- `[Pending]` (검증 대기)
- `[Rejected]` (폐기)

**신규 5** (set 무결성 라벨):

- `[Working-tree raw]` (working tree raw 만 확인, PDF cross-check X)
- `[Pending source cross-check]` (PDF cross-check 사전 의무)
- `blocked_by_source_integrity` (set 본문 손상 사유 하위 issue 봉쇄)
- `release_blocked` (set 단위 release 봉쇄, 라이브 격리)
- `source_integrity_hold_checked_candidate` (verified_no_change retro 낮춤)

### §B. raw 표기 규칙 (lock #12-A)

- `[Confirmed via 데이터 엔지니어]` 사용 금지 (PDF 원문 대조 0 시)
- 그 경우 `[Working-tree raw]` 또는 `[Pending source cross-check]` 사용

### §C. 라이브 화면 격리 (lock #12-C)

set 단위 release_blocked 시 라이브 격리 의무.

```json
"set_status": "release_blocked",
"display_banner": "검수중 — 본 set은 본문 정합화 작업 중입니다."
```

viewer 에서 set_status 감지 + 배너 렌더 의무.

---

## 10. 머신 동기화 프로토콜 (GitHub)

### 작업 시작 시

```bash
git status
git pull origin main
```

### 작업 종료 시

```bash
git add .
git commit -m "wip: [직원명] [작업 요약]"
git push origin main
```

### 머신 전환 체크리스트

**노트북 떠나기 전**

- [ ] `git status` 깨끗
- [ ] `git push` 완료
- [ ] Supabase 대시보드 변경사항 메모

**데스크톱 켠 직후**

- [ ] `git pull`
- [ ] `npm install` (package.json 변경 시)
- [ ] `.env` 확인 (Vercel 환경변수 싱크)

### 안전장치

- `.gitattributes` 에 `data-source/all_data_204.json merge=ours` 추가
- `.env` 커밋 금지 (`.gitignore` 유지)
- **양쪽 머신 동시 작업 금지**

---

## 11. PowerShell 환경 제약 (노트북 환경)

### 금지

- `node -e "..."` 안에 정규식 포함 명령 (대괄호 파싱 실패)
- `Select-String -AllMatches | Measure-Object -Sum` (타입 불일치)
- 복잡한 한 줄짜리 진단 명령

### 권장

- 3회 안에 명령어 통하지 않으면 **즉시 중단**
- **PowerShell 네이티브** 우선 (`Get-ChildItem`, `Test-Path`, 단순 `Select-String`)
- 정규 도구 필요 시 `pipeline/` 안에 `.mjs` 파일로 정식 등록 + npm script 호출
- VS Code 전역 검색 (`Ctrl+Shift+F`) 이 정규식 점검에 빠른 경우 다수

### `&&` 체이닝

PowerShell 5.x 미지원. 명령어 개별 실행 또는 `;` 사용.

---

## 12. 대표 작업 원칙

- 원칙 엄격 디폴트. 속도·효율보다 품질 우선
- "간소화 제안 = 원칙 이완" 인식
- 재설계 제안은 "치명적 오류" 프레이밍 가능
- 추측·낙관 배제, 근거 기반 판단 요구
- 턴 수보다 퀄리티 우선
- 레드팀 의견도 그대로 수용 말고 검증

---

## 13. 폴더 구조 (정본)

```
suneung-viewer/
├── AGENTS.md                       # 본 문서 (단일 정본)
├── README.md                       # Vite 기본 (수정 안 함)
├── public/
│   ├── data/all_data_204.json     # 정본 데이터
│   ├── data/annotations.json
│   └── images/
├── src/                            # 프론트엔드 영역
├── api/Codex.js                   # Vercel Serverless (Anthropic SDK 미사용 / fetch only)
├── pipeline/                       # 데이터 엔지니어 영역
│   ├── INTEGRATION_GUIDE.md       # 파이프라인 통합 가이드
│   ├── archive/                    # 일회성 스크립트 격리 (.gitignore)
│   └── specs/                      # 함수·wrapper spec 보관
├── config/                         # D엔진 산출물 + override JSON
│   ├── d_engine_gold_samples_phase1.json
│   ├── d_engine_prompt.txt
│   ├── pat_overrides.json
│   ├── ok_overrides.json
│   ├── pat_decision_rules.json
│   └── pat_signal_map.json
├── docs/                           # 정비된 문서
│   ├── current_state.md           # 현 진행 (매주 1번 갱신)
│   ├── d_engine_decisions.md      # D엔진 의제 결정 (영구)
│   └── archive/                    # 옛 핸드오버 격리
└── ops/                            # 운영 메타
    ├── employees/
    │   ├── data_engineer/AGENTS.md
    │   ├── frontend/AGENTS.md
    │   ├── strategist/AGENTS.md
    │   ├── copywriter/AGENTS.md
    │   └── quality_reviewer/AGENTS.md
    └── daily/                      # 일일 통합 상황판 (선택)
        └── YYYY-MM-DD.md
```

### 정규 도구 vs 폐기 도구

**정규** (영구 가치):

- `AGENTS.md` (본 문서)
- `docs/d_engine_decisions.md`
- `pipeline/INTEGRATION_GUIDE.md`
- `pipeline/quality_gate.mjs`
- `config/d_engine_*.json`

**폐기** [Rejected]:

- 회기별 HANDOVER\_\*.md (대신 `docs/current_state.md` 매주 갱신)
- `node -e` 인라인 패치 스크립트
- 일회성 `.cjs` / `.mjs` 진단 도구

---

## 14. 단일 진입점 정합 규칙

| 도구                             | 영역                                                     | 갱신 주기         |
| -------------------------------- | -------------------------------------------------------- | ----------------- |
| **`AGENTS.md`** (본 문서)        | 운영 원칙 + 직원 권한 + 응답 형식 + lock 시스템 baseline | 원칙 변경 시만    |
| `docs/lock_baseline.md`          | lock 1~22 raw + 운영 규칙                                | lock 변경 시만    |
| `docs/current_state.md`          | 현 진행 + 다음 액션                                      | 주 1회            |
| `docs/d_engine_decisions.md`     | D엔진 의제 결정 (영구)                                   | 신규 의제 결정 시 |
| `ops/employees/{role}/AGENTS.md` | 직원별 specific 규칙                                     | 역할 변경 시      |
| `docs/session_20260825_state.md` | 데이터 엔지니어 세션 규칙 `S-01`~`S-16` + 진행 상태      | 발주 종결 시      |

mismatch 시 **`AGENTS.md` 우선** (lock #20 정합).

**세션 규칙은 `docs/session_20260825_state.md` 3절에 있다 (`S-01`~`S-16`). `CLAUDE.md` §13(①~⑱)과 별개 체계다.**

---

## 15. 신규 회기 진입 1번째 액션

1. 본 AGENTS.md 전체 read
2. `docs/current_state.md` read (현 진행)
3. 응답 형식 (§1) 적용
4. 본인 채팅 영역 (`ops/employees/{role}/AGENTS.md`) read

---

## 16. 변경 이력

- v1.0 (2026-05-07): 정비된 단일 정본. 12개 분산 문서 통합. 회기 specific 내용 archive 분리. AI 직원 자율 권한 명시.
- v1.1 (2026-05-07): §3 "Codex 작업 4 원칙" 신규 흡수 (Think Before Coding / Simplicity First / Surgical Changes / Goal-Driven Execution). 이후 §4~§16 shift. 외부 참조 AGENTS.md best practice 정합.
- 이전 이력은 archive 참조.
