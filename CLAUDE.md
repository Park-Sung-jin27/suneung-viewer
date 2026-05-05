# CLAUDE.md — 수능 뷰어 프로젝트 가이드

## 프로젝트 개요

**suneung-viewer.vercel.app** — 수능 국어 기출문제 논리맵핑 인터랙티브 웹 뷰어 ("지니쌤과 공부하자")

- 솔로 창업자: 성진 (김과외 상위 0.1% 과외 강사)
- 목표: 모두의창업(한양대 창업지원단 기술 트랙) 심사 (5/15)
- 차별점: 모든 선지에 지문 근거 문장을 형광펜(cs_ids)으로 1:1 시각 연결
- 현재 목표: "탄탄대로" (구조적 결함 제거 + 검증 층 완결) → 5/5 베타 출시 + 5/15 심사 제출

## 스택
- **프론트엔드**: React/Vite, react-router-dom, Vercel(SPA rewrites)
- **백엔드**: Supabase(Auth, RLS, `user_sessions`/`user_answers`/`user_stats`/`subscriptions`/`question_comments`)
- **AI**: Anthropic Claude API (`/api/claude.js` Vercel Serverless), Gemini 2.5 Flash (PDF 추출), OpenAI GPT-5 (D엔진 검증)
- **결제**: Toss Payments (가맹점 승인 대기)

## 채팅 분리 원칙

- **Chat 1**: 데이터·파이프라인 (step2, step3, annotations, D엔진)
- **Chat 2**: 프론트엔드·제품 (React, UX, Supabase)
- **품질 심사관 채팅**: 통합 지휘 (직원 아닌 지휘부)
- **두 채팅 동시 git push 금지**

## 개발 환경

- Windows PowerShell (`&&` 체이닝 불가, 명령어 개별 실행)
- Claude Code (로컬 실행)
- VS Code (검토용)

## 핵심 파일 경로

```
C:\Users\downf\suneung-viewer\
├── src\data\all_data_204.json       # 정본 데이터 (~1.5MB)
├── src\data\annotations.json
├── public\images\
├── api\claude.js                    # Vercel Serverless (Anthropic SDK 미사용 / fetch only)
├── pipeline\
│   ├── d_engine_wrapper.mjs         # §4.1 wrapper (commit eadd1fa)
│   ├── d_engine_wrapper.test.mjs
│   ├── d_engine_caller_openai.mjs   # §4.1.5 caller (commit cb640cb, 4/30)
│   ├── d_engine_caller_openai.test.mjs
│   └── d_engine\                    # D엔진 관련 (권장 위치)
│       ├── d_engine_input_schema.md
│       ├── d_engine_gold_samples_phase1.json
│       ├── d_engine_prompt.txt
│       ├── d_engine_dryrun_inputs.json
│       ├── dryrun_results_template.json
│       ├── gold_authoring_rules.md
│       ├── validate_gold_phase1.mjs
│       ├── compare_dryrun_results.mjs
│       └── d_engine_dryrun_guide.md
```

---

## 절대 원칙 (변경 금지)

### 파이프라인 원칙
1. **detect 결과를 pat로 직접 사용 금지**
2. **한글 라벨 단독으로 pat 확정 금지**
3. **복합 라벨("및"/"+"/"/") 에서 임의 선택 금지**
4. **override를 영구 해결로 간주 금지**

### Gold 샘플 원칙
1. **Input 오염 금지**: 정답 힌트, error_type 암시, rule_hits 암시, Step3 한글 라벨
2. **Expected reason은 현상 설명만**: if-then 공식 금지, input 해석 금지
3. **rationale/test_intent에 D엔진 행동 유도 금지**
4. **precheck_signals 전부 false**: D엔진 독립성 확보
5. **📌 근거는 passage 내 연속 원문 문자열 (contiguous substring exact match)**

### R2 판정 엄격 기준
- "~때문에" / "~해서" / "~로 인해" 등 **명시적 인과 접속어** 확인
- A→B를 B→A로 뒤집은 경우만 R2
- 함수 관계 / 대응 관계 / 정의 왜곡은 R2 아님 (R1 또는 R3)

### Layer 0 역할 (엄격 제한)
- 허용: domain mismatch / pat missing / composite label / bracket recovery A-1
- 금지: semantic diff_type 확정, value_conflict→pat 자동 부여, entity_match

### 파이프라인 운영 원칙
- 일회성 패치 스크립트 생성 금지 → 파이프라인 본체(step2, step3, step6) 직접 수정
- `scripts/` 폴더 과도한 증가 지양
- JSX 패치에 Python string replacement 금지 → 완전 파일 재작성
- 가산적 조건 분기 금지 → 단일 통합 컴포넌트 사용
- `all_data_204.json` 단일 파일 구조 유지

### 핵심 차별점 보호 (절대 의무, 4/30 대표 명시)
- **수능 5개년 100% 탑재** (2023수능 reading 미완 수용 불가)
- **해설 품질 최우선**
- 5/15 마감 보호는 정합성 보호의 하위 목표

---

## D엔진 설계 최종 결론

### 아키텍처

```
Step3 Claude (analysis + pat 생성)
  ↓
Layer 0 deterministic precheck (semantic 금지)
  ↓
GPT-5 D엔진 (독립 반증 엔진, fail만 판정)  ← §4.1.5 caller (cb640cb)
  ↓
D fail 시 Step3 재호출 1회
  ↓
실패 시 temporary_override 또는 needs_human
```

**핵심 원칙**: "apply는 바보처럼, D엔진은 집요하게"

### Phase 단계
- Phase A: 아키텍처 Layer 1~7 구축 (현재)
- Phase B: 현재 fatal 처리
- Phase C: 연도 확장
- Phase D: 장기 리팩토링

### D엔진 완성 7단계 (4/30 기준)
1. ✅ Phase 1 Gold (17개 종결, 4/27)
2. ✅ §4.1 wrapper (commit eadd1fa, 4/28)
3. ✅ §4.2 majority (commit 2003416, 4/27)
4. ✅ §4.1.5 caller (commit cb640cb, 4/30)
5. ⏳ §4.3 needs_human 큐
6. ⏳ §4.5 로깅
7. ⏳ Stage 2 pilot (5/2~5/6 또는 5/3~5/7)
8. ⏳ v1.1 보정 (5/8~5/9)

진행률: 4/8 (50%)

### §4.1.5 caller 결정 1~6 lock (4/30)
- 결정 1: 401 → `throw "D_ENGINE_AUTH_401: " + msg`
- 결정 2: 429 → `throw "D_ENGINE_RATE_429: " + msg` (Retry-After 무시)
- 결정 3: 5xx → `throw "D_ENGINE_5XX_${status}: " + msg`
- 결정 4: SDK `maxRetries: 0` 강제 + 코드 주석 lock
- 결정 5: markdown fence strip + JSON.parse + `D_ENGINE_PARSE_ERROR` throw
- 결정 6: empty/null → `D_ENGINE_EMPTY_RESPONSE` throw
- GPT-5/o-series 호환: max_completion_tokens 자동 분기 (regex `gpt-5|o1|o3|o4`)

---

## 데이터 구조

```json
{
  "2026수능": {
    "reading": [
      {
        "id": "r2026a",
        "title": "지문 주제어",
        "range": "1~3번",
        "sents": [
          { "id": "r2026as1", "t": "문장", "sentType": "body", "cs": [] }
        ],
        "questions": [
          {
            "id": 1, "t": "발문", "bogi": "", "questionType": "negative",
            "choices": [
              { "num": 1, "t": "선지", "ok": true, "pat": null, "analysis": "", "cs_ids": [] }
            ]
          }
        ],
        "vocab": [{ "word": "단어", "mean": "뜻", "sentId": "r2026as1" }]
      }
    ],
    "literature": [ ... ]
  }
}
```

### 연도 키 컨벤션
- 수능/9월 = 학년도(시행연도 + 1): 2025년 11월 → `2026수능`
- 6월 = 학년도 = 시행연도: 2022년 6월 → `2022_6월`

### set_id 명명 규칙 v2.1 보완
- 수능 (11월): `r{학년도YY}{문자}` / `l{학년도YY}{문자}` (예: r2023a, l2026b)
- 9월 모의: `r{학년도YY}9{문자}` / `l{학년도YY}9{문자}` (예: r20239d)
- 6월 모의: `r{학년도YY}6{문자}` / `l{학년도YY}6{문자}` (예: r20226a)
- 특수 케이스 (kor25c, s3 등): 코드 매칭만 보장, v1.2 보강 정리

### ok 필드 규칙
- `ok: true` = 지문과 사실 일치
- `ok: false` = 지문과 사실 불일치
- `questionType: "positive"` → ok:true인 선지가 정답
- `questionType: "negative"` → ok:false인 선지가 정답

### 오답 패턴 체계

**독서**:
- R1: 팩트 왜곡 (수치/상태/방향 정반대 또는 다른 값)
- R2: 관계·인과 전도 (원인-결과 / 주체-객체 뒤집기)
- R3: 과도한 추론 (지문에 없음 / 1단계 이상 비약)
- R4: 개념 짜깁기 (다른 문단 개념 혼합)

**문학**:
- L1: 표현·형식 오독
- L2: 정서·태도 오독
- L3: 주제·의미 과잉
- L4: 구조·맥락 오류
- L5: 보기 대입 오류

**어휘**: V (기본값, ok:false인 경우)

---

## 탑재 시험 상태 (4/30 기준)

| 연도 | 독서 | 문학 | 해설 | 비고 |
|---|---|---|---|---|
| 2026수능 | ✅ | ✅ | 170/170 | |
| 2025수능 | ✅ | ✅ | 170/170 | |
| 2025_9월 | ✅ | ✅ | 170/170 | |
| 2024수능 | ✅ | ✅ | 170/170 | |
| 2023수능 | ⚠️ 트랙 2-c 진행 | ✅ | 부분 | 5/3 신규 트랙 종결 의무 (대표 명시) |
| 2022수능 | ⚠️ 진행 중 | ✅ | ~100/170 | 4/30 추출 예정 |
| 2022_6월 | ✅ | ✅ | 70/70 | |

### 2023수능 reading 트랙 2-c 환각 패턴 진단 (4/29 야간)
1. **본체 누출** (Q5 #5 = Q9 #2 동일): 시스템 결함 신호 ⚠️
2. **다른 시험 보기 인용** (Q2): 단순 환각
3. **인접 주제 혼동** (Q11 #5): 모델 한계

### 트랙 2-c 작업 4 진입 절차 (4/30 오후 또는 야간)
- 작업 4-a: 4건 isolation 재호출 (r2023a Q2 + r2023b Q5 + r2023b Q9 + r2023c Q11, $2~5)
- 작업 4-b: 응답 동일성 검증 (Q5 #5 vs Q9 #2)
- 작업 4-c: 옵션 i (프롬프트 강화) — set ID 강조 + "다른 시험 인용 금지"
- 작업 4-d: 마커 정정 + pat_overrides (Q5 #1, Q10 #2 + pat_missing 6건)
- 작업 4-e: step4·5·6·quality_gate

### 즉시 처리 필요 이슈
- @anthropic-ai/sdk breaking 처리 (5분, 분기 α 확정 = api/claude.js fetch only)
- 트랙 2-c 작업 4 진입 (4~6시간)
- l2023b bracket B sentId 미해결 (bs8 vs bs5~bs6)
- r2022a/b/c/d bracket ranges 미입력
- correctRate 실데이터 미삽입

---

## 일일 작업 리듬

매일 밤:
1. Chat 1 (데이터) 진행
2. Chat 2 (프론트) 진행
3. CLAUDE.md + HANDOVER_CHAT1.md + HANDOVER_CHAT2.md 업데이트
4. 다음날 각 채팅에 핸드오버 프롬프트 붙여넣기

### 머신 동기화 프로토콜 (GitHub)
- 작업 시작: `git status` → `git pull origin main`
- 작업 종료: `git add .` → `git commit -m "wip: ..."` → `git push origin main`
- 양쪽 머신 동시 작업 금지

---

## 강화 절차 v8/v9/v10 (4/29~4/30 도입)

### v8 명령어 발행 preflight 6건
(a) 명령어 사용법 확인
(b) 인자 개수 + 형식
(c) 의존 파일 존재 여부
(d) 권한 + 환경 변수
(e) 입력 형식 + 출력 형식 사전 예측
(f) PowerShell 단일 줄 보장

### v9 평가 회기 preflight 5건
(a) 외부 데이터 비교 사전 검증
(b) % 명시 회피 — 정성 표현 사용
(c) 분기 결정 시 샘플 검증 우선
(d) 정합성 vs ROI 트레이드오프 시 정합성 우선
(e) 자가 검토 1회 (옵션 권고 직전 의무)

### v10 외삽 분리 의무
"X 영역 검증 = Y 영역 검증" 분리 명시:
- ok 라벨 정합 ↔ analysis 정합 분리
- 샘플 3건 ↔ 16건 분리
- 형식 정합 ↔ 콘텐츠 정합 분리

### v11 도입 사전 검토 (5/15 후)
- 외부 환경 상태 사전 검증 의무 (git status / ls -la / npm audit / 파일 시스템 등)
- 외부 도구 출력 형식 raw 인용 의무화 + 추정 회피 강제
- 검증 항목 사전 명시 의무화
- 이전 세션 산출물 사전 식별 의무

---

## 본 채팅 가정 검증 실패 누적 (38회, 4/30 종결)

### 핵심 패턴
1. 외삽 분리 부족 (v10 도입 후 반복)
2. 외부 시스템 출력 추정 부정확
3. 검증 항목 사전 명시 누락
4. 이전 세션 산출물 식별 누락
5. git status 사전 검증 우회

### 주요 자가 인지 (4/29~4/30, 14회)
- 25회: step3 analysis 정확성 사전 검증 누락 (레드팀 회기 2)
- 26회: "ok 보정 0건" 메시지 의미 검증 누락
- 27회: step5 FAIL-FAST 정책 사전 인지 누락
- 28회: "analysis 본체 정합" 가정 검증 누락 (레드팀 회기 2)
- 29회: Q2 환각 패턴 사전 평가 누락
- 30회: "16건" 카운트 의미 사전 검증 누락 (데이터 엔지니어 식별)
- 31회: 베타 출시 콘텐츠 우선순위 사전 외삽
- 32회: npm install audit 경고 처리 절차 사전 누락
- 33회: openai 버전 사전 추정 부정확
- 34회: SDK 자체 retry vs wrapper backoff 중복 사전 식별 누락 (데이터 엔지니어 보호)
- 35회: npm audit fix 출력 형식 사전 추정 부정확
- 36회: 이전 세션 산출물 사전 식별 누락
- 37회: git status 사전 검증 우회
- 38회: Step 4 검증 항목 사전 명시 누락 (데이터 엔지니어 보호)

---

## 레드팀 회기 누적 (3회)

- 회기 1 (옵션 a → 옵션 a'): 80% 정합 — 시나리오 분류 누락 식별
- 회기 2 (옵션 C → 옵션 C'): 80% 정합 — 외삽 가정 식별
- 회기 3 (분기 3 + 13건 확장 검증): 100% 정합 — v10 도입 동력

향후 분기점에서 레드팀 의견 우선 검증 의무.

---

## 4/30 회기 핵심 의사결정 (대표 명시)

1. ✅ **2023수능 reading 무조건 탑재** (베타 5/5 미완 수용 불가 + 해설 품질 의무)
2. ✅ **트랙 2-c 5/3 신규 트랙 이동 확정** (분기 3 + 시스템 결함 진단)
3. ✅ **§4.1.5 caller commit (cb640cb)**
4. ✅ **@anthropic-ai/sdk breaking 처리 별도 회기 분리**
5. ✅ **5/3~5/4 신규 트랙 정정 (8.5~12시간)**

### 5/3~5/4 신규 트랙 정정

| 작업 | 시간 | 비고 |
|---|---|---|
| 1. annotation 코드 검증 | 1시간 | 기존 |
| 2. 파일명 v2.1 일괄 rename | 1.5~2시간 | 기존 |
| 3. 이미지 코드 삽입 | 3~4시간 | 기존 |
| 4. 트랙 2-c 종결 작업 (잔여) | 3~5시간 | 신규 (4/30 미완 시) |
| **합계** | **8.5~12시간** | 2일 분산 |

### 5/15 모두의창업 심사 [확인 필요]
- 보안 평가 항목 가능 (@anthropic-ai/sdk breaking 의무)
- 5/3 또는 5/1 자가 결정 회기에서 처리 시점 확정 권고

---

## 영역별 commit 분류 (cb640cb 후, 정리 회기 산출)

### 영역 1: §4.1.5 본 회기 산출물 ✅ commit 완료 (cb640cb)
- pipeline/d_engine_caller_openai.mjs (A)
- pipeline/d_engine_caller_openai.test.mjs (A)
- package.json / package-lock.json / .gitignore (M)

### 영역 2: 데이터 콘텐츠 변경 — 5/3 신규 트랙 또는 트랙 2-c 후
- public/data/all_data_204.json (M, 정본 변경 ⚠️)
- public/images/2023_r2023d_sent17_lgraph.png (D)
- public/images/2023_r2023a_2.png (??)

### 영역 3: 운영 문서 — 5/2 별도 회기
- CLAUDE.md, HANDOVER.md, TASKS.md (M, 본 채팅 미인지 변경 [확인 필요])
- pipeline/CLAUDE.md, src/CLAUDE.md (M)
- CLAUDE_MASTER.md, HANDOVER_D_ENGINE.md, INTEGRATION_GUIDE.md (??)

### 영역 4: pipeline/ 코드 변경 (M 9건) — 트랙 2-c 작업 4 후
- pipeline/step3_analysis.js (M) ⚠️ 트랙 2-c 환각 처리 사전 작업 가능성 [확인 필요]
- pipeline/step5_verify.js, step2_extract.js, watch.js, index.js, quality_gate.mjs, reanalyze_positive.mjs, annotate.js, gen_annotation_template.cjs

### 영역 5: pipeline/ 신규 untracked (20+건) — 5/2 + 5/15 후 v1.2
- pipeline/step3_rules.mjs (??) — CLAUDE.md 미처리 이슈 #2
- pipeline/diagnose_llm_contamination.mjs (??) — 트랙 2-c 진단 도구 가능성
- pipeline/pat_decision_engine.mjs, step2_postprocess.mjs, 외 17건

### 영역 6: 신규 디렉토리 — 5/2 별도 회기
- .claude/, config/ (15+ 파일), ops/, supabase/

---

## 본 채팅 회기 컨텍스트 (4/30 종결)

- 회기 일자: 2026-04-30 (D-15)
- 본 채팅 누적 의사결정: 1~504
- 가정 검증 실패 누적: 38회
- 트리거 충족 시점: §4.1.5 commit (cb640cb) 도착 후

신규 회기 진입 시 본 CLAUDE.md + 산출물 1·2·3 raw 인용 시작.

---

## 다음 회기 진입 권고

### 즉시 진입 (4/30):
1. **push 결정 회기**: Chat 2 동기화 확인 후 push
2. **@anthropic-ai/sdk breaking 처리 회기**: 5분 (정리 회기 후 또는 4/30 야간)

### 4/30 오후~야간:
3. **트랙 2-c 작업 4 진입**: 4~6시간 (별도 회기, v8 적용)

### 5/1 (D-14):
4. D엔진 통합 dry-run + 상표 검색 (1시간) + 그룹 A 운영 문서 commit

### 5/2 (D-13):
5. 5/3 신규 트랙 핸드오버 문서 작성 + 영역 3·5·6 정리

### 5/3~5/4 (D-12~D-11, 신규 트랙):
6. 작업 1·2·3 + 작업 4-잔여

### 5/5 (D-10):
7. ✅ 베타 출시 (5개년 + 2023_9월 + 2023수능 reading 정합) + 상표 출원

### 5/15 (D-0):
8. ✅ 모두의창업(한양대) 제출

---

## Lock System (Phase 0 + Phase A 진입 단계)

### Lock 1~22 baseline

본 영역은 HANDOVER_CHAT1.md §2 lock 1~22 본문 정합 인용.
데이터 엔지니어 적용 시 HANDOVER_CHAT1.md §2 lock 1~22 본문 그대로 복사.

```
Lock #1  : push 분리 (Integration Push + Release Approval)
Lock #2  : issue_id 정밀화 (QG-{exam}-{setId}-{Qn}-{patch_type})
Lock #3  : pilot_ranking_v0_5
Lock #4  : pilot_ranking_v2
Lock #5  : Gate 5 분리 (5a Technical + 5b Learning)
Lock #6  : defect_dict_runtime (sentry v0.1)
Lock #7  : schedule_basis (Phase 기준만)
Lock #8  : active_issue_log_validation
Lock #9  : naming (issue_id 정본 / Spec A/B/C/D 보조명)
Lock #10 : pat_branch (raw 사후 분기)
Lock #11 : gate5_pass_evidence
Lock #12 : 라벨 분리 ★ 본 회기 갱신 (신규 라벨 5건 + 운영 규칙 3건)
Lock #13 : active_issue_log_phase1_automation
Lock #14 : commit message issue_id 강제
Lock #15 : release_approval_qa (독서 A·B·D / 문학 A·B·C·D)
Lock #16 : (영역 통합)
Lock #17 : release_approval_record_schema
Lock #18 : issue_lifecycle (new → ... → closed 외 deferred/rejected/rolled_back/needs_human)
Lock #19 : issue_id 6곳 강제
Lock #20 : operating_doc_no_tool_dependency
Lock #21 : pat_decision_rules
Lock #22 : qa_mapping_minimization ★ patch 3분리 정합 (Data Contract / source / pattern)
```

### Lock #12 운영 규칙 3건 (commit 209c71e 정합)

**A. raw 표기 규칙**
`[Confirmed via 데이터 엔지니어]`는 PDF 원문 대조가 없는 경우 사용 금지.
그 경우 `[Working-tree raw]` 또는 `[Pending source cross-check]`로 표기한다.

**B. retro 라벨 정정 규칙**
set 단위 손상 식별 시 하위 issue 라벨 retro 정정 의무.
verified_no_change → source_integrity_hold_checked_candidate 자동 낮춤.
retro 정정 commit 본문에 retro_via 필드 명시 의무.

**C. 라이브 화면 격리 규칙** [Adopted via 본 회기 사용자 결정]
set 단위 release_blocked 시 라이브 화면 격리 의무.
★ 옵션 (i) 검수중 안내 배너 [Adopted] ★

적용 단위:
- `public/data/all_data_204.json` set entry 신규 필드 2건
  - `set_status`: "release_blocked"
  - `display_banner`: "검수중 — 본 set은 본문 정합화 작업 중입니다."
- viewer (Chat 2 분기) set_status 감지 + 배너 렌더 의무

### 신규 라벨 9건 정합 (commit 209c71e)

**기존 4**: `[Adopted]` / `[Confirmed]` / `[Pending]` / `[Rejected]`

**신규 5**:
- `[Working-tree raw]`
- `[Pending source cross-check]`
- `blocked_by_source_integrity`
- `release_blocked`
- `source_integrity_hold_checked_candidate`

### Self-test 7건 (HANDOVER_CHAT1.md §5 정합)

```
① "5/8" 단어 0건 (lock #7 정합)
② Spec 명칭 단독 사용 0건 (issue_id 정본 사용, lock #9)
③ 라벨 분리 사용 (lock #12 정합 — 신규 9 라벨)
④ Gate 5a/5b 분리 사용 (lock #5)
⑤ issue_id 정본 명명 (lock #2)
⑥ commit message issue_id 강제 (lock #14)
⑦ 운영 문서 도구 의존 표현 0건 (lock #20)
```

### Phase 매핑

```
Phase 0  : 종결 [Confirmed via 직전 회기 cfe14f7]
Phase A  : 진입 단계 (현재 — Q20 release_approved + kor25_d 재추출)
Phase B  : 신규 (Q20 종결 사후 — 8 set 본문 무결성 audit + audit 자동화 도구)
Phase C  : audit 결과 set 별 source-patch sequencing
Phase D  : Q14·Q15·Q17 unblock + atomic patch
Phase 1  : pat_decision_rules.json 흡수 + active_issue_log 자동화
```

### 단일 진입점 정합 규칙

| 도구 | 영역 |
|---|---|
| `CLAUDE.md` | lock 시스템 + Phase 매핑 + 운영 규칙 baseline (정규 도구) |
| `HANDOVER_CHAT1.md` | 회기별 spec 분기 + 다음 액션 (회기 핸드오버 도구) |
| `HANDOVER_CHAT2.md` | Chat 2 (프론트) 분기 핸드오버 도구 |

mismatch 시 `CLAUDE.md` baseline 우선 (lock #20 정합).
