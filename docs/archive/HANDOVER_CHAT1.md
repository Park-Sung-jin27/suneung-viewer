# HANDOVER_CHAT1.md — Phase 0 종결 사후 새 회기 진입 인수인계

> 갱신: 2026-05-05 | Chat 1 (데이터·파이프라인) 회기 종합

---

## §1 회기 종합

| 항목 | 상태 |
|---|---|
| **Phase 0 종결** | [Confirmed via 2026-05-05 회기] |
| **Q20 evidence-patch (cfe14f7)** | Gate 5a [Confirmed via DOM] |
| **Q17 source-patch raw 충분** | [Confirmed via 사용자 ⓒⓓⓔ sentence raw] |

### Phase 0 회기 push 종결 5건 (origin/main 동기화)

| commit | 영역 |
|---|---|
| 92c0c9d | quality_gate v2 (분류 필드 + 6 신규 검사) |
| b2649e5 | 2026수능 s1 Q2 ok 라벨 5건 반전 + analysis 정정 (정답 #5) |
| f420709 | 2025_9월 sep25_c Q8 questionType + q.t 정정 (negative) |
| 62cf987 | 2026_9월 r20269a Q3 #4·#5 critical placeholder 정제 + 4건 pat R2→R3 |
| 25ea534 | 2023_6월 l20236a 페이지 6 본문 12 sents 보강 (㉠/㉡ 단독 sent) |
| cfe14f7 | 2023_6월 l20236a Q20 cs_ids + analysis 정정 (정답 #4) |

---

## §2 lock 22건 통합 운영 원칙

### lock #1~#10 (회기 v2 누적)

| # | lock |
|---|---|
| 1 | **push 분리**: Integration Push (Gate 1·2 PASS) + Release Approval (Gate 1~5a·5b + QA PASS) |
| 2 | **issue_id 정밀화**: `QG-{exam}-{setId}-{Qn}-{patch_type}` 단일 문항 |
| 3 | pilot_ranking_v0_5: all_data 단독 점수 (Phase 1 진입 사전 후보) |
| 4 | pilot_ranking_v2: all_data + quality_report issue count 합산 (Phase 1 산출물) |
| 5 | **Gate 5 분리**: Gate 5a Technical (DOM/클릭/screenshot/console) + Gate 5b Learning (해설↔형광펜 학습 정합) |
| 6 | defect_dict_runtime: sentry v0.1 entry는 quality_gate.mjs / normalize_quality.mjs 정규 도구 직접 참조 |
| 7 | schedule_basis: **Phase 기준만** (일정 표현 폐기) |
| 8 | active_issue_log_validation: backup + count + duplicate + diff 4건 raw 회신 의무 |
| 9 | naming: issue_id 정본 / Spec A/B/C/D = 대화 보조명 |
| 10 | pat_branch: raw 사후 분기 (사용자 결정 0, 본 채팅이 raw cross-check 사후 spec 발행) |

### lock #11~#16 (v4 누적)

| # | lock |
|---|---|
| 11 | gate5_pass_evidence: Gate 5a = URL/문항/DOM count/screenshot/console / Gate 5b = PDF·sents raw/하이라이트 문장/analysis 인용/cs_ids/근거 직접성 1문장 |
| 12 | **라벨 분리 (9 라벨)**: [Adopted] (정책 채택) / [Confirmed] (사실 확인) / [Pending] (검증 대기) / [Rejected] (폐기) / **[Working-tree raw]** (working tree raw 확인만, PDF cross-check 0) / **[Pending source cross-check]** (PDF cross-check 사전 의무) / **blocked_by_source_integrity** (set 본문 손상 사유 하위 issue 봉쇄) / **release_blocked** (set 단위 release 봉쇄, 라이브 격리) / **source_integrity_hold_checked_candidate** (verified_no_change retro 낮춤) ★ 운영 규칙 3건: A. raw 표기 (`[Confirmed via 데이터 엔지니어]` PDF 대조 0 시 사용 금지, `[Working-tree raw]` 또는 `[Pending source cross-check]` 사용) / B. retro 라벨 정정 (set 손상 식별 시 verified_no_change → source_integrity_hold_checked_candidate 자동 낮춤, retro_via 필드 명시 의무) / C. 라이브 화면 격리 (release_blocked 시 옵션 (i) 검수중 안내 배너 [Adopted via 본 회기], 데이터 영역: all_data_204.json set entry에 set_status + display_banner 신규 필드 / UI 영역: viewer set_status 감지 시 배너 렌더, Chat 2 분기 의무) |
| 13 | active_issue_log_phase1_automation: Phase 1 통과 사후 normalize_quality.mjs가 active_issue_log 자동 생성. 수동 node -e 폐기 |
| 14 | **commit message issue_id 강제** (예: `fix(data): QG-2025수능-kor25_d-Q14-answer-patch ok swap`) |
| 15 | release_approval_qa: 독서 = A·B·D 매핑 / 문학 = A·B·C·D 매핑 (C 필수) |
| 16 | (lock #15 영역 영역 통합 영역 영역) |

### lock #17~#22 (v5 누적)

| # | lock |
|---|---|
| 17 | release_approval_record_schema: `pipeline/release_approval_records/{issue_id}.json` (Gate 5a + 5b + QA + integration + rollback_plan + approved_by + timestamp) |
| 18 | issue_lifecycle: `new → raw_required → raw_received → patch_packet_ready → integration_pushed → gate_5a_pass → gate_5b_pass → qa_pass → release_approved → closed` (예외: deferred / rejected / rolled_back / needs_human) |
| 19 | issue_id 6곳: active_issue_log + quality_report + patch_packet + commit message + post_gate report + release_approval_record |
| 20 | operating_doc_no_tool_dependency: javascript_tool / Claude in Chrome 등 도구 의존 표현 [Rejected]. Technical Viewer Gate 자동 검증 / Playwright 등 표준 용어 [Adopted] |
| 21 | pat_decision_rules: V/R1 분기 기준 = `config/pat_decision_rules.json` 흡수 (Phase 1 산출물). Phase 0 = 본 채팅 raw 사후 분기 |
| 22 | qa_mapping_minimization: analysis 수정 → A 필수 / cs_ids 수정 → B 필수 / 문학 → B+C / pat 변경 → D / ok·questionType 변경 → Data Contract 필수 |

(주: 본 회기 active_issue_log.json 영역 21 lock 적용. spec 영역 22 영역 영역 본 정정 영역 21 lock 정합)

---

## §3 active_issue_log 현재 상태

### issues 9건 분포

| status | 카운트 | issue_id |
|---|---|---|
| **merged** | **5** | s1-Q2 (b2649e5) / sep25_c-Q8 (f420709) / r20269a-Q3 (62cf987) / l20236a-sents (25ea534) / l20236a-Q20 (cfe14f7) |
| raw_required | 1 | kor25_d-Q17-source-patch |
| deferred (source-patch 사후 진입) | 1 | kor25_d-Q17-pattern-patch |
| patch_packet_ready_pending | 2 | kor25_d-Q14-answer-patch / kor25_d-Q15-c3-explanation-patch |

### verified_no_change 2건

| target | 검증 근거 |
|---|---|
| 2023_6월/l20236a/Q19 | questionType ↔ ok 정합 / pat L2 정합 / placeholder 0 / cs_ids dead 0 |
| 2025수능/kor25_d/Q16 | 4.pdf 정답=#2 + ok_distribution 정합 + bogi annotated_image 존재 |

### release_approval_records 5건 pending

```
pipeline/release_approval_records/
├── QG-2026수능-s1-Q2.json
├── QG-2025_9월-sep25_c-Q8.json
├── QG-2026_9월-r20269a-Q3.json
├── QG-2023_6월-l20236a-sents.json
└── QG-2023_6월-l20236a-Q20.json
```

→ 5 records 모두 release_status: "pending" (lock #17 스키마 정합)

---

## §4 다음 spec 분기 (A·B·C·D·E)

### 본 채팅 권고 sequencing

도구 진입 라이브 데이터 fetch + 단계별 spec 발행:

| 분기 | 영역 | 진입 조건 |
|---|---|---|
| **(A)** QG-2025수능-kor25_d-Q14-answer-patch | atomic 1 commit | raw 회신 사후 즉시 |
| **(B)** QG-2025수능-kor25_d-Q15-c3-explanation-patch | atomic 1 commit | raw 회신 사후 즉시 |
| **(C)** QG-2025수능-kor25_d-Q17-source-patch | sents 보강 (ⓒⓓⓔ 신규) | 4.pdf raw 회신 사후 |
| **(D)** QG-2025수능-kor25_d-Q17-pattern-patch | ok 라벨 + cs_ids + pat 분기 | (C) 종결 사후 |
| **(E)** Q20 Gate 5b Learning + QA B/C 검수 | 사용자 manual click + 1문장 직접성 판정 | 본 채팅 검수 의무 |

### Phase 0 산출물

| 파일 | 영역 |
|---|---|
| `pipeline/active_issue_log.json` | 메타데이터 (untracked, Phase 1 사전 자료) |
| `pipeline/active_issue_log.bak.20260505_184328.json` | backup |
| `pipeline/kor25_d_raw_20260505_184328.json` | kor25_d sents + Q14·Q15·Q16·Q17 raw |
| `pipeline/q20_q17_raw_20260505_184328.json` | Q20 #4 + Q17 5 choices analysis |
| `pipeline/rollback_plan_20260505_184328.json` | 5 commit revert 명령 사전 |
| `pipeline/release_approval_records/*.json` | 5건 pending |

---

## §5 self-test 7건 lock (다음 회기 의무)

| # | self-test |
|---|---|
| ① | "5/8" 단어 0건 (schedule_basis lock #7 정합) |
| ② | Spec 명칭 단독 사용 0건 (naming lock #9 정합 — issue_id 정본 사용) |
| ③ | 라벨 분리 ([Adopted]/[Confirmed]/[Pending]/[Rejected]) 사용 (lock #12 정합) |
| ④ | Gate 5a/5b 분리 사용 (lock #5 정합) |
| ⑤ | issue_id 정본 명명 (`QG-{exam}-{setId}-{Qn}-{patch_type}`, lock #2 정합) |
| ⑥ | commit message issue_id 강제 (lock #14 정합) |
| ⑦ | 운영 문서 도구 의존 표현 0건 (javascript_tool / Claude in Chrome 표현 [Rejected], lock #20 정합) |

---

## §6 자가 결함 누계

164+ 누적 (직전 회기 v3 영역 38회 → 본 회기 추가 누적). 새 회기 진입 사후 lock 강화 의무.

### 본 회기 주요 자가 결함 패턴

- spec 산수 영역 검증 누락 (PART 2 issues 8 vs 실제 9, lock 22 vs 실제 21 — 본 회기 자가 식별)
- 마크다운 auto-link 정규화 의무 매 spec (`[X.id](http://X.id)` 패턴 매번 정규화)
- analysis 본문 임의 수정 0 lock 매 spec 의무

---

## §7 사용자 (대표) 의무 잔여

| 영역 | 상태 |
|---|---|
| **Q20 manual click + 1문장 직접성 판정** | **본 채팅 검수 의무** (작업 0, Gate 5b Learning) |
| Q17 pat 결정 의무 | **0** [Rejected via lock #9·#21 — 본 채팅이 raw 사후 분기 spec 발행 의무] |
| 4.pdf raw | [Confirmed via 본 회기] |

---

## §8 정규 도구 영역 (lock #13 정합)

| 도구 | 위치 |
|---|---|
| `CLAUDE.md` | 프로젝트 root (16KB, May 1 갱신 — Phase 0 영역 영역 별도 갱신 의무) |
| `HANDOVER_CHAT1.md` | **본 문서** (정규 핸드오버 도구 신규 생성, lock #13 정합) |
| `pipeline/quality_gate.mjs` | quality 게이트 단일 진입점 (v2 갱신, 51KB) |
| `pipeline/active_issue_log.json` | Phase 0 메타데이터 (untracked, Phase 1 자동 생성 lock #13) |
| `config/pat_decision_rules.json` | V/R1 분기 룰 (Phase 1 흡수 lock #21) |
| `pipeline/release_approval_records/*.json` | Release Approval 영역 (lock #17) |

### 폐기 도구 [Rejected]

- 일회성 .md 신규 생성 (단, HANDOVER_CHAT1.md 영역 정규 도구 영역 정합)
- javascript_tool / Claude in Chrome 영역 운영 문서 의존 표현 (lock #20)

---

## §9 git 영역 동기화 영역

```
HEAD = origin/main HEAD = cfe14f7  (ahead by 0)
main 브랜치 push 종결 5건
working tree clean (untracked Gate-1 산출물 + Phase 0 메타데이터)
```

---

## §10 새 회기 진입 1번째 액션

1. 본 HANDOVER_CHAT1.md 전체 read (lock 22건 + active_issue_log 영역 + 다음 spec 분기 인수)
2. self-test 7건 적용 (§5)
3. 라이브 데이터 fetch 영역 도구 진입 (Q20 Gate 5b 검수 의무)
4. 본 채팅 (대표) 분기 결정 spec 박스 영역 (A)~(E) 영역 영역 진입
