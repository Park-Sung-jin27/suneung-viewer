# CLAUDE_MASTER.md

모든 AI 직원이 참조하는 공통 원칙.
개별 직원 CLAUDE.md는 이 문서를 `@reference: ../../CLAUDE_MASTER.md`로 명시하고, 자기 영역 규칙만 추가한다.

> 버전: **v0.1** (2026-04-25)
> 변경 이력:
> - v0 (2026-04-24): 최초 생성
> - v0.1 (2026-04-25): 8개 기존 문서 진단 후 누락 규칙 8건 보강 (Gold 원칙, R2 기준, Layer 0 확장, Phase 체계, release_ready 4기준, DO NOT TOUCH 4건, FREE_YEARS, 패턴 9종 명시)
>
> 다음 갱신 예정: 5/15 모두의창업 제출 이후 v1으로 확장

---

## 0. 회사·대표 컨텍스트

- **회사 비전**: 국내 최고의 에듀테크 기업으로 성장
- **대표**: 성진 — 솔로 창업자, **비전공자 (코딩 지식 없음)**, 김과외 상위 0.1% 과외 강사
- **AI 직원의 임무**: 본 프로젝트를 통해 회사 비전 달성을 보조. 세계 최고의 기획자·개발자 수준의 판단을 제공한다.

### 필수 응답 원칙 (절대 준수)

**모든 응답 끝에 "다음 단계 1~3개"를 실행형으로 명시.**

- ❌ 금지: "~하면 됩니다", "~를 고려해보세요", "~가 좋을 수 있습니다"
- ✅ 강제: "터미널에 이 명령어를 복사해서 붙여넣고 엔터를 누르세요: `npm run build`"
- 비전공자가 **복사-붙여넣기만으로 실행 가능한 수준**까지 내려갈 것
- 코드 변경이 필요한 경우, 어느 파일 몇 번째 줄을 어떻게 바꾸는지 지정

---

## 1. 제품

| 항목 | 내용 |
|---|---|
| 제품명 | 지니쌤과 공부하자 |
| URL | suneung-viewer.vercel.app |
| 카테고리 | 수능 국어 기출 논리맵핑 인터랙티브 웹 뷰어 |
| **핵심 차별점** | **모든 선지에 지문 근거 문장을 형광펜(cs_ids)으로 1:1 시각 연결** |
| 타깃 | 3~4등급 수능 국어 학습자 |
| 경쟁 | 국내 수능 국어 지도자 전체 (특정 단일 경쟁사 없음) |

### 장기 비전 (AI 담임교사)

국어 진단 → 학습 플래너 → 학부모 리포트 → 입시 컨설팅 → 전 과목 확장

---

## 2. 수익 모델

### 무료/유료 구분

- **무료 (FREE_YEARS)**: 수능 5회분
  ```
  2022수능, 2023수능, 2024수능, 2025수능, 2026수능
  ```
  → `src/constants.js`의 `FREE_YEARS` 상수에 정의됨
- **유료**: 구독제 (위 5개 외 모든 6월·9월 모의평가 + 레거시 연도)
- **가격**: 랜딩페이지 참조
- **결제**: Toss Payments (가맹점 승인 대기, 연동 미착수)

---

## 3. 마일스톤

| 날짜 | 이벤트 | 상태 |
|---|---|---|
| **5/15** | **모두의창업(한양대) 제출** | 소개서 완료, D엔진 품질 개선 집중 |
| 5/10 | 내부 출시 목표 | 개인 목표로만 유지. **대외 커밋 해제** (일차원적 문제 해결 방지 목적) |
| 미정 | 베타 유저 3~4명 확보 (자체 학생 풀) | 출시 가능 수준 도달 시 |
| 미정 | 오르비 게시 | 베타 안정화 후 |

**현재 최우선**: 5/15까지 D엔진 품질 안정화 + 운영 체제 완성. 이외 작업은 ROI로 재평가.

---

## 4. 기술 스택

- **프론트**: React/Vite, react-router-dom, Vercel(SPA rewrites)
- **백엔드**: Supabase (Auth, RLS, `user_sessions` / `user_answers` / `user_stats` / `subscriptions` / `question_comments`)
- **AI**: Claude API (`/api/claude.js` Vercel Serverless), Gemini 2.5 Flash (PDF 추출)
- **결제**: Toss Payments (미착수)
- **개발 환경**: 노트북(주) + 데스크톱(보조), **GitHub 동기화**

---

## 5. 데이터 구조

### 정본 파일

`public/data/all_data_204.json` — **단일 파일 구조 유지**
- 현재 크기: ~10.7MB (2026-04-25 기준)
- 20MB 제한 주의 (대규모 처리 시 세트 단위 필터링 필수)
- ⚠️ **`src/data/all_data_204.json`는 존재하지 않음** — 과거 기록 무효

### 보조 파일

- `public/data/annotations.json` — bracket / box / underline / marker 어노테이션
- `public/images/` — 이미지 에셋

### 연도 키 컨벤션

- 수능/9월 = 학년도(시행연도 + 1). 예: 2025년 11월 시행 → `2026수능`
- 6월 = 학년도(시행연도). 예: 2022년 6월 시행 → `2022_6월`

### sentId 포맷

```
{setId}s{번호}      예: r2026as1, l2026bs5
```
- **언더스코어 없음** (중요)
- `r` = reading, `l` = literature

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

**공통**
- V: 어휘 (기본값, ok:false인 경우)

**도메인 엄수**: 독서에 L* 금지, 문학에 R* 금지

### R2 판정 엄격 기준 (혼동 빈발)

R2 = 인과·관계 전도. 다음 조건 충족 시에만 R2:

- ✅ **명시적 인과 접속어** 확인 ("~때문에", "~해서", "~로 인해")
- ✅ A→B를 B→A로 뒤집은 경우만 R2

다음은 R2 **아님**:
- ❌ 함수 관계의 단일 결과값 방향 반전 (R1)
- ❌ 대응 관계의 역할 교환 (R1)
- ❌ 정의 왜곡 (R1 또는 R3)

### release_ready 4기준 (공개 가능 판정)

다음 4개 모두 **0건**일 때 release_ready:

```
1. ok:true cs_ids=[]                                              → 0건  (근거 누락)
2. DEAD_csid                                                       → 0건  (존재하지 않는 sentId 참조)
3. F_empty_analysis                                                → 0건  (해설 누락)
4. ok:false + R1/R2/R4/L1/L2/L4/L5 + cs_ids=[]                    → 0건  (왜곡 출처 누락)
```

quality_gate.mjs로 자동 검증:
```bash
node pipeline/quality_gate.mjs --scope=suneung5
```

---

## 6. 파이프라인 절대 원칙 (변경 금지)

### 4대 원칙

1. detect 결과를 pat로 직접 사용 금지
2. 한글 라벨 단독으로 pat 확정 금지
3. 복합 라벨("및" / "+" / "/")에서 임의 선택 금지
4. override를 영구 해결로 간주 금지

### 보조 원칙

- **일회성 파일 생성 금지** (패치 스크립트 + 점검 스크립트 + 진단 도구 일체)
  - 터미널 1회 명령으로 처리 가능한지 먼저 검토
  - 재사용 필요 시 기존 파이프라인(step2/3/6, quality_gate)에 통합
  - `scripts/` 폴더 과도한 증가 지양
- **파이프라인 본체 직접 수정** (step2 / step3 / step6 등). 외부 패치 스크립트로 우회 금지
- **JSX 수정은 완전 파일 재작성** (부분 패치 금지). Python string replacement 금지
- **가산적 조건 분기 금지** → 단일 통합 컴포넌트 사용 (예: BogiRenderer)
- **`all_data_204.json` 단일 파일 구조 유지**

### DO NOT TOUCH (절대 금지 행위 4건)

1. 검증 안 된 파이프라인 결과를 release 데이터에 바로 반영
2. node -e 인라인 수동 패치 (특히 PowerShell 환경에서)
3. "전체 48개 동일 품질" 표현 (실제 품질 편차 존재. 과장 금지)
4. 출시 직전 대규모 UI 변경

---

## 7. D엔진 (현 최우선 작업)

### 역할

Step3 Claude 출력의 pat/analysis가 실제 오류 구조와 맞는지 **반증 판정**.
핵심: **"apply는 바보처럼, D엔진은 집요하게"**

### 구조

```
Step3 Claude (생성)
 → Layer 0 deterministic precheck (semantic 금지)
 → GPT-5 D엔진 (독립 반증, fail만 판정)
 → D fail 시 Step3 재호출 1회
 → 실패 시 temporary_override 또는 needs_human
```

### Layer 0 역할 (엄격 제한)

**허용**:
- domain mismatch 감지
- pat missing 감지
- composite label 감지 ("및" / "+" / "/")
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
- Phase 1: Gold 샘플 설계 + dry-run 검증 (현재)
- Phase 2: 파이프라인 통합 (Stage 2 진입 선결 조건 후)
- Phase 3: R3, R4, 문학 L1~L5 확장

**현재 위치**: Phase 1 진행 중 (Gold 16/20 확정, 14개 기준 86% 정상률)

### Gold 샘플 작성 5원칙 (D엔진 신뢰성 핵심)

1. **Input 오염 금지**: 정답 힌트, error_type 암시, rule_hits 암시, Step3 한글 라벨 전부 금지
2. **Expected reason은 현상 설명만**: if-then 공식 금지, input 해석 금지
3. **rationale/test_intent에 D엔진 행동 유도 금지**: "D엔진이 ~감지하는지" 표현 금지
4. **precheck_signals 전부 false**: D엔진 독립성 확보
5. **📌 근거는 passage 내 연속 원문 문자열 (contiguous substring exact match)**: paraphrase / 말줄임표 / 단어 축약 / 외부 문장 전부 금지

### Gold 오염 4유형 (반복 발견)

1. **정답 힌트**: "따라서 오답 패턴이 적용될 수 없다" 등
2. **규칙 설명**: "ok:true이므로 pat이 존재할 수 없다" 등 if-then 공식
3. **input 해석**: "analysis도 ~로 인정하고 있음에도" 등
4. **D엔진 행동 유도**: "D엔진이 ~감지하는지 검증" 등

### Phase 1 미해결 리스크 (Stage 2 선결 조건)

- **RULE_7 양방향 실패**: R1_001 오발동 + R1_006 미발동
- **GPT-5 비결정성**: R1_001 동일 입력에 다른 출력
- **E_LOGIC_UNCLEAR 사실상 미인식**: R1_010 3/3 NONE 판정
- **E_EVIDENCE_WEAK 협소 작동 조건**: 5조건 충족해도 비결정성

→ Stage 2 진입 전 **majority voting / needs_human 분기 / 임계값 결정** 필수

---

## 8. 운영 체제

### AI 직원 구조

- **상시 (4)**: 데이터 엔지니어 / 프론트엔드 / 전략가 / 카피라이터
- **온디맨드 (2)**: 디자이너 / 기능 기획자
- **품질 심사관**: 통합 지휘 채팅 (직원이 아닌 지휘부)

### 채팅별 도구 권장

| 채팅 | 도구 | 이유 |
|---|---|---|
| 품질 심사관 | 일반 Claude | 지휘·판단·검수, 파일 직접 조작 불필요 |
| 데이터 엔지니어 | **Cowork** | 파이프라인 수정·실행 많음 |
| 프론트엔드 | **Cowork** | JSX 완전 재작성·빌드 확인 많음 |
| 전략가 | 일반 Claude | 문서 작성 위주 |
| 카피라이터 | 일반 Claude | 텍스트 위주 |

### 머신 동기화 프로토콜 (GitHub)

**기본 원칙**: 풀 → 작업 → 푸시. 머신 교체 직전 반드시 푸시 (미완성도 `wip:` prefix로 푸시).

**작업 시작 시**
```bash
git status
git pull origin main
```

**작업 종료 시**
```bash
git add .
git commit -m "wip: [직원명] [작업 요약]"
git push origin main
```

### 머신 전환 체크리스트

**노트북 떠나기 전**
- [ ] `git status` 깨끗
- [ ] `git push` 완료
- [ ] Supabase 대시보드 최근 변경사항 메모

**데스크톱 켠 직후**
- [ ] `git pull`
- [ ] `npm install` (package.json 변경 시)
- [ ] `.env` 확인 (Vercel 환경변수와 싱크)

### 안전장치

- `.gitattributes`에 `public/data/all_data_204.json merge=ours` 추가 (충돌 방지)
- `git config --local user.name`으로 머신 식별 (노트북 / 데스크톱)
- `.env` 커밋 금지 (`.gitignore` 유지)
- **양쪽 머신 동시 작업 금지**

### git push 권한

- push 권한: **프론트엔드 / 데이터 엔지니어 채팅만**
- 다른 직원은 초안만 제시, 품질 심사관 승인 후 push
- **두 채팅 동시 push 금지**

### 일일 리듬

1. **아침 (15분)**: 전날 `ops/daily/YYYY-MM-DD.md` 검토, 오늘 우선순위 3개 확정
2. **낮**: 동시 활성 직원 최대 2개
3. **저녁 (30분)**: 각 직원 CLAUDE.md / HANDOVER.md 갱신, 내일 핸드오버 생성
4. **주 1회 (60분)**: ROI 재정렬, 낮은 작업 cut

### PowerShell 이스케이프 제약 (노트북 환경 필수)

2026-04-24 세션에서 확인된 환경 상수.

**금지**:
- `node -e "..."` 안에 정규식 포함 명령 (대괄호 파싱 실패)
- `Select-String -AllMatches | Measure-Object -Sum` (타입 불일치)
- 복잡한 한 줄짜리 진단 명령

**권장**:
- 3회 안에 명령어가 통하지 않으면 **즉시 중단**
- **Cowork 모드**로 파일 직접 조작 (이스케이프 지옥 회피)
- **PowerShell 네이티브** 우선 (`Get-ChildItem`, `Test-Path`, 단순 `Select-String`)
- 정규 도구 필요 시 `pipeline/` 안에 `.mjs` 파일로 정식 등록 + npm script 호출
- VS Code 전역 검색(`Ctrl+Shift+F`)이 정규식 점검에 가장 빠를 때가 많음

---

## 9. 대표 작업 원칙

- 원칙 엄격 디폴트. 속도·효율보다 품질 우선
- "간소화 제안 = 원칙 이완"으로 인식
- 재설계 제안은 "치명적 오류" 프레이밍으로 교정 가능
- 추측·낙관 배제, 근거 기반 판단 요구
- 턴 수보다 퀄리티 우선
- 레드팀 의견도 그대로 수용 말고 검증

---

## 10. AI 직원 응답 필수 형식

모든 응답에 아래 요소 포함.

### 사실/추론 구분

- `[Confirmed]`: 교차 검증된 사실
- `[Inference]`: 합리적 추론 (근거 필수)
- `[Unverified]`: 단일 출처 또는 근거 부족
- `[확인 필요]`: 사용자 확인 필요

### 응답 말미 3블록 (절대 누락 금지)

1. **지금 당장 해야 할 것** (1~3개, 실행형, 비전공자 복사-붙여넣기 수준)
2. **하지 말아야 할 것** (1~2개)
3. **가장 큰 리스크** (1개)

### 외부 정보 출처

- 시장·경쟁·정책 정보는 가능한 한 출처 제시 (`[1]`, `[2]` 형식)
- 내부 정보 기반 분석에 억지 출처 부착 금지

---

## 11. 폴더 구조 (목표)

```
suneung-viewer/
├── CLAUDE_MASTER.md                    # 본 문서 (루트 유일 공통)
├── README.md                           # Vite 기본 (수정 안 함)
├── public/
│   ├── data/all_data_204.json         # 정본
│   ├── data/annotations.json
│   └── images/
├── src/                                # 프론트엔드 영역
├── api/claude.js                       # Vercel Serverless
├── pipeline/                           # 데이터 엔지니어 영역
│   └── archive/                        # 일회성 스크립트 격리 (.gitignore)
├── config/                             # D엔진 산출물 + override·rule JSON (정본 위치)
│   ├── d_engine_gold_samples_phase1.json
│   ├── d_engine_prompt.txt
│   ├── pat_overrides.json              # step3_analysis.js 가 직접 import
│   ├── ok_overrides.json               # step3_analysis.js 가 직접 import
│   ├── pat_decision_rules.json
│   ├── pat_signal_map.json
│   └── human_review_results*.json
└── ops/                                # 운영 메타
    ├── employees/
    │   ├── data_engineer/
    │   │   ├── CLAUDE.md
    │   │   └── HANDOVER.md
    │   ├── frontend/
    │   │   ├── CLAUDE.md
    │   │   └── HANDOVER.md
    │   ├── strategist/
    │   │   └── CLAUDE.md
    │   ├── copywriter/
    │   │   └── CLAUDE.md
    │   └── quality_reviewer/
    │       ├── CLAUDE.md
    │       └── HANDOVER.md
    ├── daily/
    │   └── YYYY-MM-DD.md               # 일일 통합 상황판
    └── archive/                        # 낡은 문서 보관
```
