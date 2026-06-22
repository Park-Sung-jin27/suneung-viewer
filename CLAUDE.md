# CLAUDE.md — suneung-viewer 프로젝트 가이드

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

### D. 명확한 설명 강제 (사용자 토큰 절약)

- ❌ 금지: 다중 옵션 (A/B/C/D), 추측 가설 나열, 의미 모호한 추론
- ❌ 금지: "본인 추정", "잠재", "가능성" 같은 모호 표현 반복
- ✅ 강제: **결론 먼저 1줄로**, 그 다음 사실 + 사용자 결정 의무
- ✅ 강제: 사용자가 검증해야 할 영역은 **즉시 검증 가능한 sample** 제공 (3건 이하)
- ✅ 강제: 본인이 가설일 때 = 가설 명시 + **사용자가 yes/no 답할 수 있는 form**
- ✅ 강제: 다중 가설 = 가장 가능성 큰 1개만 제시, 나머지는 보류

**Precedent**: 2026-06-03 사용자 명시 — "내용을 이해가 안 되게 어렵게 설명을 하니까, 내가 다시 확인하는 과정을 거치면서 토큰을 쓰게 되잖아". 옵션 나열 X, 결론 + sample 제공.

### E. 외부 서비스 정보 검증 강제 (추측 금지)

- **외부 서비스(카카오·구글·토스·Supabase·Vercel 등)의 콘솔 UI·설정 위치·메뉴명·정책을 안내할 때, 기억/추측으로 단정 금지.**
- ✅ 강제: 반드시 `WebSearch` 또는 공식 문서 `web_fetch`로 **최신 확인 후** 안내. 외부 콘솔 UI는 수시 개편됨.
- ❌ 금지: "아마 ~탭에 있을 것", "보통 ~메뉴" 식 위치 추측. 1회 빗나가면 사용자 왕복·토큰 낭비.
- 검색·문서로도 불확실하면 → 즉시 스크린샷 요청 (추측 왕복 < 화면 1장).

**Precedent**: 2026-06-10 카카오 Client Secret 위치 — 기억 기반으로 "보안→고급→일반 하단" 4회 빗나감(카카오 UI 개편으로 전부 무효). 공식 문서 web_fetch로 실제 위치('앱>앱 키>REST API 키 편집 페이지') 즉시 확정. 외부 서비스 안내는 처음부터 공식 문서 우선.

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
| **commit + push** (특히 `public/data/all_data_204.json`) | 사용자 검토 후 승인 |
| **schema 변경** (`feedback_logs` 등 신규 테이블)         | 사용자 결정         |
| **release 출시 시점**                                    | 사용자 결정         |
| **가격·요금제·B2B 단가**                                 | 사용자 결정         |
| **5 수능 외 시험 정정 우선순위**                         | 사용자 결정         |
| **자동 해설 재생성·일회성 스크립트 생성**                | **금지 (절대)**     |

---

## 3. Claude Code 작업 4 원칙

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

**본 프로젝트 정합**: "JSX 완전 파일 재작성" + "본체 파이프라인 직접 수정" + Claude Code 자율 광역 변경 회피.

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

| 채팅                   | 역할                             | 도구            |
| ---------------------- | -------------------------------- | --------------- |
| **품질 심사관**        | 통합 지휘 (직원 아닌 지휘부)     | 일반 Claude     |
| **데이터 엔지니어**    | 파이프라인·D엔진·데이터 (Chat 1) | **Claude Code** |
| **프론트엔드**         | React·UX·Supabase (Chat 2)       | **Claude Code** |
| 전략가                 | 사업 결정 sparring               | 일반 Claude     |
| 카피라이터             | 텍스트·랜딩                      | 일반 Claude     |
| 디자이너 (온디맨드)    | UI 디자인                        | -               |
| 기능 기획자 (온디맨드) | 신기능 사양                      | -               |

### 채팅 운영 규칙

- **Chat 1 / Chat 2 동시 git push 금지**
- git push 권한: 데이터 엔지니어 / 프론트엔드 채팅만
- 다른 직원: 초안만 제시, 품질 심사관 승인 후 push
- 동시 활성 직원 최대 2개 (대표 집중력 보호)

### 직원별 sub-CLAUDE.md

각 직원은 `ops/employees/{role}/CLAUDE.md` 에서 역할 specific 규칙 추가. 본 CLAUDE.md 가 base.

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
- **`public/data/all_data_204.json` 단일 파일 구조 유지**

### release 전환 2중 목록 (갱신 의무)

- set release 전환 시 **양쪽 모두** 갱신: ① `src/dataLoader.js` RELEASE_SET_IDS (노출 필터) ② `src/constants.js` RELEASED_SETS (검수 배너 해제). 한쪽만 갱신 시 비노출 또는 배너 잔존 (2026-06-08 실증). 단일 소스 통합은 정리 회기 후보.

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

`public/data/all_data_204.json` — **단일 파일 구조 유지** (~10.7MB)

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

### 글자 표준 (2026-06-07 확립)

- **한양PUA 등 비표준 글자 금지**: 겹낫표는 『』, 옛한글은 첫가끝 유니코드(ᄒᆞ 등). PDF 추출 시 PUA 잔존하면 변환 의무 (hypua2jamo path)
- **어휘 문제 판별 = 키워드 + set 마지막 문항 한정** (마커 범위 ㉠~㉤ 단독 판별 금지 — QuizPanel isVocabQuestion, 2026-06-07 대표 결정)
- **bogi 표는 bogiTable** (선지 ○×표 / 데이터표 양형 자동 판별), **bogi 내 인라인 이미지는 `[그림src:/images/…]`** placeholder

### ok 필드 (절대 규칙)

- `ok: true` = 지문과 사실 일치
- `ok: false` = 지문과 사실 불일치
- **발문 유형과 무관**하게 사실 일치만으로 판정
- `questionType: positive` → ok:true가 정답
- `questionType: negative` → ok:false가 정답

### 메타 발문 예외 (특수 발문 유형)

다음 메타 발문은 일반 룰 (positive → ok:true 정답) 미적용:

| 발문 유형                              | 정답 의미                   | ok 판정                                     | pat 부여                              |
| -------------------------------------- | --------------------------- | ------------------------------------------- | ------------------------------------- |
| "답을 찾을 수 없는 질문은?"            | 지문 안 답 없음 = 지문 무관 | 정답 = **ok:false** + pat=R3 (지문 밖 내용) | 오답 (지문 정합) = ok:true + pat=null |
| "지문에서 알 수 없는 것은?"            | 동일                        | 동일                                        | 동일                                  |
| "윗글의 내용으로 추론할 수 없는 것은?" | 추론 불가 = 지문 외         | 동일                                        | 동일                                  |

**원칙**: 발문 자체가 "지문 무관" 을 요구할 때 ok 판정 = 지문 일치성 기준 그대로. 단 정답 = 지문 무관 = ok:false 의무.

**pat = R3 확정 ([Adopted 2026-06-21])**: 메타발문 정답은 지문 무관이라 왜곡출처 sentId가 부재 → R1(사실 왜곡)+cs_ids=[]는 release_ready 4번째(ok:false+R1+cs_ids=[] = 0건) gate CRITICAL과 충돌. R3(지문 밖 내용)는 정의상 cs_ids=[]가 허용(release_ready 4번째 REQUIRES_CS 제외)이라 의미·gate 양립. §13⑨ 정합. (기존 R1 표기 set은 R3로 정렬 의무.)

**Precedent**: r2022c Q10 (2026-06-01 사용자 결정). 동 유형 발문 만나면 본 path 동일 적용.

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

### release_ready 6기준

다음 6개 모두 **0건** 시 release_ready:

```
1. ok:true cs_ids=[]                                  → 0건  (근거 누락)
2. DEAD_csid                                          → 0건  (존재하지 않는 sentId 참조)
3. F_empty_analysis                                   → 0건  (해설 누락)
4. ok:false + R1/R2/R4/L1/L2/L4/L5 + cs_ids=[]      → 0건  (왜곡 출처 누락)
5. 본문 sent 수 최소 기준                    → 위반 시 release 불가
   - 독서 set: sent_count ≥ 10 AND sent_count/question_count ≥ 3.0
   - 문학 set: sent_count ≥ 5 AND sent_count/question_count ≥ 1.5
   - sent_count == 0 → 완전 재구축 필요 (D등급)
6. 모든 question 의 choices 수 == 5            → 위반 시 release 불가
```

**5번 배경**: 2026-05-27 LEGACY 수능 일괄 RELEASED 시, release_ready 4기준(cs_ids/해설/정답)만 검사하고 본문 sent 수를 안 봐서 PDF 추출 실패 set 8개가 RELEASED에 포함됨. sent 3~5개인 독서 set은 정상 지문(20~40 sent)의 10~25% 수준으로 학생에게 빈 화면 노출.

**발견된 결함 set (8건)**:

- r2014a(B) 0sent, r2014b(B) 5sent, r2014c(B) 3sent, r2014d(B) 3sent
- r2014e(A) 3sent, r2016d(B) 5sent, r2018a 5sent, r2018b 5sent

자동 검증:

```powershell
node pipeline/quality_gate.mjs --scope=suneung5
```

---

## 7. step3 prompt 절대 룰

### 보기·지문 인용 verbatim

- bogi 필드의 수치(숫자), 고유명사, 인용문은 **반드시 원문 그대로 사용**
- 변형·추정·반올림·일반 예시 대체 금지
- 비슷한 비율의 다른 숫자도 금지 (예: 440/550 → 400/500 변형 금지)
- 보기·지문 인용 따옴표 안 텍스트는 글자/숫자 그대로 복사
- 지문 근거 인용 시 sents 의 t 필드 텍스트 그대로 (의역·요약·글자 변형 금지)

### 해설 서술 사양 (2026-06-05 대표 결정 — 2027_6월 개편 precedent)

- **ok:true(적절) 선지 해설 = 3단 서술 의무**: ① 지문 근거 인용 → ② 그 근거가 뜻하는 바 풀이 → ③ 그래서 선지가 옳은 이유 연결. 타깃(3~4등급) 눈높이의 쉬운 문장.
- **선지별 해설 안 타 선지 배제 근거 금지** (🔎 배제 근거/정답 비교 블록 금지) — 각 선지 해설은 자립. 배제 논리는 해당 선지 자신의 해설에 녹임.
- 신규 시험 step3 prompt 작성·개정 시 본 사양 반영 의무.

### 보기 문제 오류 유형

bogi 필드 비어있지 않은 문항 → analysis 에 다음 중 하나 명시:

1. **보기 오독**: 보기 조건 자체를 잘못 이해
2. **보기 대입 오류**: 보기 조건을 지문/작품에 잘못 적용
3. **지문 오독**: 보기와 무관하게 지문 사실 자체 왜곡

---

## 8. D엔진 (현 최우선 작업)

### 역할

Step3 Claude 출력의 pat/analysis 가 실제 오류 구조와 맞는지 **반증 판정**.
**"apply 는 바보처럼, D엔진은 집요하게"**

### 구조

```
Step3 Claude (생성)
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
- **PDF 원천 = repo `_done/{yearKey}/{yearKey}_시험지.pdf` + `_정답.pdf`** (2014~2026 전체 보유). AI 직원이 pdftotext로 직접 대조 가능 → 사용자 인용 의뢰 불요, 대조 완료 시 `[Confirmed]` 충족 (2026-06-04 실증: marker 35건 + 정답표 3개 yearKey + cs_spans 1,245건 정정 전부 본 path)

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

- `.gitattributes` 에 `public/data/all_data_204.json merge=ours` 추가
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
├── CLAUDE.md                       # 본 문서 (단일 정본)
├── README.md                       # Vite 기본 (수정 안 함)
├── public/
│   ├── data/all_data_204.json     # 정본 데이터
│   ├── data/annotations.json
│   ├── audit_data/                # master audit 보드 fetch 용 (검수 보드 v3.1)
│   │   └── cs_ids_candidates.json
│   └── images/
├── src/                            # 프론트엔드 영역
│   ├── AuditPanel.jsx              # 검수 보드 v3.2 (cs_ids review + annotation 삭제 staging)
│   └── PassagePanel.jsx            # cs_ids 형광펜 (box-decoration-break clone)
├── api/claude.js                   # Vercel Serverless (Anthropic SDK 미사용 / fetch only)
├── pipeline/                       # 데이터 엔지니어 영역 — 영구 자산
│   ├── INTEGRATION_GUIDE.md       # 파이프라인 통합 가이드
│   ├── cs_ids_recovery.mjs        # v2: 후보 산출 read-only + duplicate_sent_id flag
│   ├── cs_ids_apply.mjs           # auto + batch 2 mode (--dry-run default)
│   ├── cs_ids_revert.mjs          # audit_log 기반 일괄 되돌리기
│   ├── annotation_delete.mjs      # JSON spec deletions[] 일괄 처리
│   ├── quality_gate.mjs           # release_ready 6기준 자동 검증
│   ├── output/                     # 도구 출력 (cs_ids_candidates.json / audit_log.jsonl / day1_report.md)
│   ├── backups/                    # 도구 적용 전 백업 (자동)
│   ├── archive/                    # 일회성 스크립트 격리 (.gitignore)
│   └── specs/                      # 함수·wrapper spec 보관
├── config/                         # D엔진 + cs_ids 도구 영구 설정
│   ├── cs_ids_recovery_thresholds.json   # 점수/길이/격차 cutoff
│   ├── marker_chars.json                 # marker 문자 집합 (신규 시험 추가 시 수정)
│   ├── d_engine_gold_samples_phase1.json
│   ├── d_engine_prompt.txt
│   ├── pat_overrides.json
│   ├── ok_overrides.json
│   ├── pat_decision_rules.json
│   └── pat_signal_map.json
├── docs/                           # 정비된 문서
│   ├── current_state.md           # 현 진행 (주 1회 갱신)
│   ├── d_engine_decisions.md      # D엔진 의제 결정 (영구)
│   ├── lock_baseline.md           # lock 1~22 raw
│   └── archive/                    # 옛 핸드오버 격리
└── ops/                            # 운영 메타
    ├── employees/
    │   ├── data_engineer/CLAUDE.md
    │   ├── frontend/CLAUDE.md
    │   ├── strategist/CLAUDE.md
    │   ├── copywriter/CLAUDE.md
    │   └── quality_reviewer/CLAUDE.md
    └── daily/                      # 일일 통합 상황판 (선택)
        └── YYYY-MM-DD.md
```

### 정규 도구 vs 폐기 도구

**정규** (영구 가치):

- `CLAUDE.md` (본 문서)
- `docs/d_engine_decisions.md`
- `pipeline/INTEGRATION_GUIDE.md`
- `pipeline/quality_gate.mjs`
- `pipeline/answer_fidelity.mjs` (정답↔정답표 PDF 대조; **python3 호출 PYTHONUTF8=1 필수** — cp949 mojibake로 ①②③④⑤ 손실 방지; image_only 정답표는 `config/manual_answer_keys.json` 폴백)
- `pipeline/structure_fidelity.mjs` (시험지↔데이터 발문·선지 구조 대조 — 오번호/중복/오삽입/환각 색출; answer_fidelity가 못 잡는 구조결함·환각)
- `pipeline/passage_fidelity.mjs` (데이터 지문↔시험지 본문 대조 — 교체/환각; 옛한글·verse는 acceptable 다수)
- `config/manual_answer_keys.json`, `config/structure_fidelity_thresholds.json`, `config/passage_fidelity_thresholds.json`
- `config/d_engine_*.json`

> **release 안전 룰**: ① FREE/release 후보 set은 위 3게이트(정답·본문·구조) 통과 의무. ② 마스터 모드는 release_status 필터 우회 → 출시 검증은 **비마스터 계정**으로만. ③ setId 충돌(2014~2016 A/B형이 setId 공유, 예 r20146a) — dataLoader `RELEASE_SET_IDS.has(setId)` 전역 판정이라 충돌-혼합(한쪽 form 미준비) 등록 시 미준비 form 동반노출 → yearKey-aware 메커니즘 전까지 충돌-혼합 RELEASE_SET_IDS 금지. ④ **gate↔push 분리 (절대)**: quality_gate 결과 확인과 commit/push를 **같은 bash 체인에 넣지 말 것** — 같은 체인 시 게이트 결과 확인 전 push되어 "CRITICAL 0" 오기재 위험(2026-06-21 ea40cc2 실증). 별도 단계로 gate=0 확인 **후** push. ⑤ **결론줄=ok 검사 의무**: 출시 set은 전 선지의 결론줄(마지막 ✅/❌)이 ok와 일치하는지 검사 — REV(오결론)=정답 반대 노출=오학습(치명). 단 §7 본문이 ✅·❌ 양 이모지를 언급하면 오탐 → **결론줄 라인 기준**으로 정밀 판정(본문 이모지 포함 ≠ 오결론). ⑥ **📌 근거 exact-substring 검증**: 해설 📌 지문 근거 verbatim 검증은 **공백·특수문자(～ U+FF5E·따옴표·줄바꿈→공백 artifact) 정규화 금지** = exact match. sent 자체 artifact(추출 시 줄바꿈→공백 등)면 sent.t 교정 + passage_fidelity 재확인(2026-06-21 l2022b s7 선례). ⑦ **동일 어구 다출현 시 마커 정박 = 인라인 마커 기호 위치로 확정**(text 검색 단독 금지 — l2016c ㉡ 선례). ⑧ **극문학(희곡/시나리오) 표준**: (나)/극 본문 sents 전수를 `stage`(지시문)·`speech`(화자 대사) sentType으로 분류 → PassagePanel 렌더가 sent별 개행(stage=이탤릭/들여쓰기) + 마커/밑줄 합성. (가) 고전소설 산문은 body 유지. setId 충돌 set은 yk 지정으로 form 격리. 시극(verse+희곡 혼재, 예 l2017b)은 별도 설계. ⑨ **메타발문 정답 pat = R3 (cs[] 허용)**: "답을 찾을 수 없는 질문은?" 류 정답은 지문 무관이라 왜곡출처 sentId 부재 → R1+cs[]는 gate CRITICAL 충돌. R3(지문 밖 내용)가 의미·gate 양립([Adopted 2026-06-21]; §6 메타 예외표 R1 표기는 R3로 보정 대상). ⑩ **출시 전 게이트 의무 ([Adopted 2026-06-22])**: 출시(RELEASE_KEYS 추가)·정정 push 전 `node pipeline/quality_gate.mjs --scope=release` CRITICAL **0** 확인 = release_ready 단일 신호. 자동 판정 = ⑤ 결론줄=ok(REV 차단)·⑥ 📌 지문근거 단어내공백 artifact(`C_anchor_exact_fail`; 다문장·말줄임표·verse \n·화자표지 콜론·paraphrase 제외)·구간 bracket FP 제거(`bracket_audit` `isMultiSentRange`). WARNING(`C_anchor_marker_space`·paraphrase·placeholder_suspect 등)은 비차단 = 별도 품질 회기. 도구↔데이터 push 분리(④) 준수.

**폐기** [Rejected]:

- 회기별 HANDOVER\_\*.md (대신 `docs/current_state.md` 매주 갱신)
- `node -e` 인라인 패치 스크립트
- 일회성 `.cjs` / `.mjs` 진단 도구

---

## 14. 단일 진입점 정합 규칙

| 도구                             | 영역                                                     | 갱신 주기         |
| -------------------------------- | -------------------------------------------------------- | ----------------- |
| **`CLAUDE.md`** (본 문서)        | 운영 원칙 + 직원 권한 + 응답 형식 + lock 시스템 baseline | 원칙 변경 시만    |
| `docs/lock_baseline.md`          | lock 1~22 raw + 운영 규칙                                | lock 변경 시만    |
| `docs/current_state.md`          | 현 진행 + 다음 액션                                      | 주 1회            |
| `docs/d_engine_decisions.md`     | D엔진 의제 결정 (영구)                                   | 신규 의제 결정 시 |
| `ops/employees/{role}/CLAUDE.md` | 직원별 specific 규칙                                     | 역할 변경 시      |

mismatch 시 **`CLAUDE.md` 우선** (lock #20 정합).

---

## 15. 신규 회기 진입 1번째 액션

1. 본 CLAUDE.md 전체 read
2. `docs/current_state.md` read (현 진행)
3. 응답 형식 (§1) 적용
4. 본인 채팅 영역 (`ops/employees/{role}/CLAUDE.md`) read

---

## 16. 변경 이력

- v1.0 (2026-05-07): 정비된 단일 정본. 12개 분산 문서 통합. 회기 specific 내용 archive 분리. AI 직원 자율 권한 명시.
- v1.1 (2026-05-07): §3 "Claude Code 작업 4 원칙" 신규 흡수 (Think Before Coding / Simplicity First / Surgical Changes / Goal-Driven Execution). 이후 §4~§16 shift. 외부 참조 CLAUDE.md best practice 정합.
- v1.2 (2026-05-31): cs_ids 영구 자산 도구 추가 (`pipeline/cs_ids_recovery.mjs` v2 + `cs_ids_apply.mjs` auto+batch + `cs_ids_revert.mjs` + `annotation_delete.mjs`). 진단 도구 v2 보강 (bogi.diagram + 환각 marker + duplicate_sent_id flag). 검수 보드 v3.1 (cs_ids review) + v3.2 (annotation 삭제 staging). 신규 PDF (교육청/LEET/사관/선택영역) 진입 시 도구 자동 작동 — yearKey/setId/marker 문자 hardcode X / config 분리 (`config/cs_ids_recovery_thresholds.json` + `config/marker_chars.json`). FREE 5수능 release_ready 40/40 통과. duplicate_sentid_hold 2 set 재매핑 완료.
- v1.3 (2026-06-03): §1.D "명확한 설명 강제" 신규 흡수 (결론 먼저 / 옵션 나열 X / 검증 가능 sample 의무). §6 메타 발문 예외 룰 추가 ("답을 찾을 수 없는 질문" 등 특수 발문 = 발문 정답성 ≠ 지문 일치성 / 정답 = ok:false + R1). setId 충돌 안전장치 sprint (cs_ids_recovery v3.0 전역 sentIndex 폐기 + apply/revert ambiguous_choice_ref skip + bracket_audit/visual_mark_extractor yearKey 격리 + quality_gate annotations 백업 + step4 백업 + apply_para archive). AuditPanel v4 (?yearKey= 라우팅 + 충돌 set 선택 화면 + LEGACY A/B형 33 set 검수 가능화). V (어휘) pat 사양 추가 + QuizPanel V badge skip. annotation schema 확장 — `target='bogi'` + `qId` 필드 (None-None entries 72건 매핑). 본문 marker 정정 batch (2022_9월/2023_9월/2024_6월/2024_9월/2025_9월/2026_6월) — 사용자 PDF 인용 협업 path 영구화.
- v1.4 (2026-06-04): §9.B PDF 원천 직접 대조 path 명문화 (`_done/` 시험지·정답표 = [Confirmed] 충족, 사용자 인용 의뢰 불요). 당일 4 sprint: 2025_6월 4 set 정합 + 잔여 yearKey 16건 (Q19 발문 유형·ok 재배정 포함) + cs_spans 무결성 — 베타 영역 (수능+모의 22~26) cs_spans 결함 0건 달성. 베타 영역 marker·annotation·span 정합 path 완결.
- v1.5 (2026-06-05): §7 해설 서술 사양 추가 (3단 서술 + 배제 블록 금지 — 2027_6월 170건 개편 precedent). 당일: 2027_6월 진입·검수·해설 개편 완결 + FREE 영역 CRITICAL 21건 종결 (r2025b Q5 환각 문항 재구축 — release_ready의 원문 일치 미검사 공백 확인) + 문단 기능 62/64 + LEGACY 모의 진입 (marker 1차 198건). 전수 원문 대조 검수법(정규화 substring ↔ 시험지 PDF) 확립.
- v1.6 (2026-06-07): §6 글자 표준 신설 (PUA 금지·어휘 판별 마지막 문항 룰·bogiTable/인라인 이미지 사양). 당일 8 sprint: ① LEGACY 모의 marker 2차 59건 (fitz 좌표+문장경계 anchor) ② 중복 set 22개 dedupe (모의 19 + 수능 3, 문항 보전 이관) ③ 구조 재구축 14 set (분할 8·전면 재구축 3·검증 3 — r20219e (나) 복원·Q23 이미지 보기 재구축, 황만근 본문 교체, 보리 수필 "전문 생략" placeholder 복원) ④ 분포 이상 14건 ok 반전 (정답표 대조) ⑤ bogi 누락 7건 (표 3 판독·그림 4 추출) ⑥ PUA 표준화 225건 (겹낫표 194→『』·네모가→[가]·옛한글 24→첫가끝 — 폰트 교체 불요 확인) ⑦ LEGACY 독서 para 93 set (각주 오인 post-pass 포함) ⑧ cs_spans 415건 재정박 (B형 suffix 282·한자병기·말줄임·라벨 strip) — **전체 350 set cs_spans 결함 0**. 베타 측: 2026_9월 Q17 데이터표·Q25 어휘 오판·set 정렬 12곳·l20269b Q25 해설 marker 재정박 5건. 잔여: LEGACY 해설·cs_ids 생성 결정(LLM 비용), LEGACY 수능 결함 8 set 재구축, para 미검출 28 set.
- v1.7 (2026-06-09): 2027학년도 6월 **정식 출시** (RELEASE_SET_IDS + RELEASED_SETS 양쪽 8 set 추가, R3/V 22건 근거 정박 완결). LEGACY 수능 결함 set 재구축 (r2014aB 문법영역 삭제·r2014bB/cB/dB PDF 전사 재구축·r2014e 분할·선지 절단 3 set[2019_6월·2019수능·2020_6월] 정답표 복원). 2027_6월 Q6 = 선지 마커 주체 역전(②⑤) + 해설 5건 ㉮㉯ 인물 정체 전면 역전 + cs 재정박 (정답표 ① 정합) — 마커 비교 문항(㉮㉯·ⓐⓑ)은 본문 정의↔해설 라벨 일치 자동대조 검사 후보. 중복 <보기> 라벨 전수 제거 32건(2027 8 + 기존 24) + step2 stripBogiLabel 본체 규칙. **운영 결함 발견**: 일부 push에서 sandbox write한 all_data가 git에 누락된 채 commit된 사례 — push 후 `git log -1`+`git status`로 잔여 M 확인 의무. 현 완성도: 베타 126 set 해설 100%/cs 98%(출시), LEGACY 수능 72 set 해설 97%/cs 91%, LEGACY 모의 136 set cs 56%(해설 생성 미결 — 비노출).
- v1.8 (2026-06-17): **충실도 게이트 3종 신설** (§13) — `answer_fidelity`(정답↔정답표; python3 PYTHONUTF8 필수 — cp949 mojibake로 ①~⑤ 손실 방지; image_only는 `manual_answer_keys.json` 폴백) / `structure_fidelity`(시험지↔데이터 발문·선지 구조·환각) / `passage_fidelity`(데이터 지문↔시험지 본문 교체·환각). **release 안전 룰**(3게이트 통과 의무 / 마스터 모드 필터 우회 → 비마스터 검증 / setId 충돌 2014~2016 A/B 공유 → 충돌-혼합 RELEASE_SET_IDS 금지). 당일: answer_fidelity 인코딩버그 수정 → 가려졌던 정답오류 21건 적발·정정(13개년 정답충실도 0) + r2025b Q4 환각(LIVE FREE) 재구축 + FREE 수능 3중 게이트 통과 입증 + 2025수능 manual 정답소스(image_only 폐쇄) + formatExamTitle 라벨 통일 + LEGACY 모의 1차 53 setId 출시(setId 충돌 안전분류; '해설 미생성·cs56%' 가정 stale 판명 — 해설 거의 완비).
- v1.9 (2026-06-21): **LIVE 감사 — 출시 set 198/198 CRITICAL 0 달성** + 극문학 표준 확립 + 운영 원칙 5종 신설(§13 ④~⑨). ① **LIVE 감사**: 현 RELEASE_KEYS 198 출시 set에 quality_gate 전수 → 결함 25건 적발(REV/PH/empty/cs0, 전부 학생 노출 중) → 오탐 필터(결론줄=ok 기준) 후 진짜 24 set 정정 완결(커밋 ~10, 7561f91~0e0d195). 정답-반대 오결론(REV)이 핵심 — FREE l2022b Q26 포함. 각 set gate=0 + answer_fidelity 0 + gate↔push 분리. ② **극문학 stage/speech 표준**(§13⑧): l20216d(전우치 시나리오) 표준화 — s47·s48 merged 분리+cs 재매핑, ㉠~㉤ marker 밑줄(PDF 벡터 경계), (나) 전 구간 stage/speech 전수 분류. Code A 렌더 path 페어(e5606d2). 이어 l20199d·l2016c 복제(출시 극문학 산문-blob 해소). ③ **운영 원칙**: gate↔push 분리·결론줄=ok 검사·📌 근거 exact-substring(공백/특수문자 정규화 금지, l2022b s7 artifact 교정)·마커 인라인 정박(l2016c ㉡)·메타발문 R3([Adopted]). ④ **주의/잔여**: 마커 밑줄 exact-fail 36건(비-FREE, 밑줄 미렌더·정답해설 무영향 — FREE 2024수능 8은 audit setId 추론 버그 오탐)·D 극문학 2(l20166d·l2016cB)·stale "판단불가" 2(r2014e·l20229a)·**해설 더 자세히(2027_6월) 사양 개편 대기**(강사 예시 입력 필요). **차기 1순위 의제: 출시 게이트에 §13 ⑤⑥(결론줄=ok+exact-substring) 자동화 박아 live 결함 재발 차단.** **환경 주의: sandbox all_data_204.json 대용량 JSON이 동기화 중 truncate되어 json.load 간헐 실패 → raw grep/text-search 폴백.**
- 이전 이력은 archive 참조.
