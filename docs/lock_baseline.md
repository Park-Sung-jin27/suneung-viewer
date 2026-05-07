# Lock Baseline — lock 1~22 raw + 운영 규칙

> 본 문서는 lock 1~22 의 **영구 raw 보존**.
> 정비된 CLAUDE.md §8 (lock 명칭) 보강 — 정확한 lock 정의 참조 시 본 문서 사용.
> 출처: HANDOVER_CHAT1.md §2 (2026-05-05 회기) raw 흡수.

---

## lock #1 — push 분리

**Integration Push** (Gate 1·2 PASS) + **Release Approval** (Gate 1~5a·5b + QA PASS).

같은 commit 도 두 단계 push. integration push 후 release approval push 사전 의무.

---

## lock #2 — issue_id 정밀화

```
QG-{exam}-{setId}-{Qn}-{patch_type}
```

단일 문항 단위. 예:
- `QG-2025수능-kor25_d-Q14-answer-patch`
- `QG-2026_9월-r20269a-Q3-explanation-patch`

---

## lock #3 — pilot_ranking_v0_5

all_data 단독 점수 기반 우선순위 ranking. Phase 1 진입 사전 후보 식별.

---

## lock #4 — pilot_ranking_v2

all_data + quality_report issue count 합산 ranking. Phase 1 산출물.

---

## lock #5 — Gate 5 분리

- **Gate 5a Technical**: DOM / 클릭 / screenshot / console
- **Gate 5b Learning**: 해설 ↔ 형광펜 학습 정합 (사용자 직접 검수)

분리 의무. 5a PASS ≠ 5b PASS.

---

## lock #6 — defect_dict_runtime

sentry v0.1 entry 는 `quality_gate.mjs` / `normalize_quality.mjs` 정규 도구 직접 참조. 별도 .json 또는 일회성 도구 폐기.

---

## lock #7 — schedule_basis

**Phase 기준만**. 일정 표현 (5/8, D-7, 매주 X요일) **폐기**.

근거: 일정 사후 보정 시 lock 변경 의무 → outdated 빈번. Phase 기준만 일관성 유지.

---

## lock #8 — active_issue_log_validation

active_issue_log.json 변경 시 4건 raw 회신 의무:
1. backup
2. count
3. duplicate
4. diff

---

## lock #9 — naming

- **issue_id 정본** (lock #2 정합)
- **Spec A/B/C/D** = 대화 보조명만 (단독 사용 X)

상호 매칭 의무 (Spec A → 어떤 issue_id 인지 명시).

---

## lock #10 — pat_branch

raw **사후** 분기. 사용자 결정 0. 본 채팅이 raw cross-check 사후 spec 발행.

근거: pat 결정 자율은 데이터 엔지니어 영역 X (정합성 책임). 본 채팅이 raw 점검 후 spec 발행 의무.

---

## lock #11 — gate5_pass_evidence

- **Gate 5a 통과 근거** = URL / 문항 / DOM count / screenshot / console
- **Gate 5b 통과 근거** = PDF·sents raw / 하이라이트 문장 / analysis 인용 / cs_ids / 근거 직접성 1문장

---

## lock #12 — 라벨 분리 (9 라벨) ★ 운영 규칙 3건

### 라벨 정의

**기존 4** (의사 결정 라벨):
- `[Adopted]` — 정책 채택
- `[Confirmed]` — 사실 확인 (PDF 등 원천 cross-check 후)
- `[Pending]` — 검증 대기
- `[Rejected]` — 폐기

**신규 5** (set 무결성 라벨):
- `[Working-tree raw]` — working tree raw 만 확인, PDF cross-check 0
- `[Pending source cross-check]` — PDF cross-check 사전 의무
- `blocked_by_source_integrity` — set 본문 손상 사유 하위 issue 봉쇄
- `release_blocked` — set 단위 release 봉쇄, 라이브 격리
- `source_integrity_hold_checked_candidate` — verified_no_change retro 낮춤

### 운영 규칙 A — raw 표기

`[Confirmed via 데이터 엔지니어]` PDF 원문 대조 0 시 사용 **금지**.
그 경우 `[Working-tree raw]` 또는 `[Pending source cross-check]` 사용.

### 운영 규칙 B — retro 라벨 정정

set 단위 손상 식별 시 하위 issue 라벨 retro 정정 의무.
`verified_no_change` → `source_integrity_hold_checked_candidate` 자동 낮춤.
retro 정정 commit 본문에 `retro_via` 필드 명시 의무.

### 운영 규칙 C — 라이브 화면 격리

set 단위 release_blocked 시 라이브 화면 격리 의무.

★ **옵션 (i) 검수중 안내 배너** [Adopted via 사용자 결정]

적용 단위:

```json
"set_status": "release_blocked",
"display_banner": "검수중 — 본 set은 본문 정합화 작업 중입니다."
```

viewer 영역 (Chat 2 분기) set_status 감지 + 배너 렌더 의무.

---

## lock #13 — active_issue_log_phase1_automation

Phase 1 통과 사후 `normalize_quality.mjs` 가 active_issue_log 자동 생성. 수동 `node -e` 폐기.

---

## lock #14 — commit message issue_id 강제

예:
```
fix(data): QG-2025수능-kor25_d-Q14-answer-patch ok swap
```

issue_id 누락 시 commit 거부 의무.

---

## lock #15 — release_approval_qa

- **독서**: A·B·D 매핑
- **문학**: A·B·C·D 매핑 (C 필수)

QA dimension 분류:
- A: analysis 정합
- B: cs_ids 정합
- C: 문학 specific (정서·표현 정합)
- D: pat 정합

---

## lock #16 — (영역 통합)

lock #15 영역 통합. 별도 운영 lock X.

---

## lock #17 — release_approval_record_schema

`pipeline/release_approval_records/{issue_id}.json` 영구 보존.

스키마:
```json
{
  "issue_id": "QG-...",
  "gate_5a": { "url": "...", "dom_count": ..., "screenshot": "...", "console": "..." },
  "gate_5b": { "passage_raw": "...", "highlighted_sentences": [...], "analysis_quote": "...", "cs_ids": [...], "evidence_directness": "..." },
  "qa": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "integration": { "commit": "...", "timestamp": "..." },
  "rollback_plan": { "revert_command": "..." },
  "approved_by": "성진",
  "timestamp": "..."
}
```

---

## lock #18 — issue_lifecycle

```
new
  → raw_required
  → raw_received
  → patch_packet_ready
  → integration_pushed
  → gate_5a_pass
  → gate_5b_pass
  → qa_pass
  → release_approved
  → closed
```

예외 상태:
- `deferred` (보류)
- `rejected` (폐기)
- `rolled_back` (롤백)
- `needs_human` (D엔진 majority 미성립)

---

## lock #19 — issue_id 6곳 강제

issue_id 명시 의무 6곳:
1. `active_issue_log.json`
2. `quality_report.json`
3. `patch_packet`
4. commit message
5. post_gate report
6. release_approval_record

mismatch 시 정합성 검산 fail.

---

## lock #20 — operating_doc_no_tool_dependency

운영 문서 (CLAUDE.md / current_state.md / sub-CLAUDE.md) 영역 도구 의존 표현 [Rejected]:

❌ `javascript_tool` / `Claude in Chrome` / `Cowork` / `Anthropic SDK` 등 직접 명시 금지

✅ 표준 용어 [Adopted]:
- "Technical Viewer Gate 자동 검증"
- "Playwright"
- "PowerShell native"
- "VS Code 직접 편집"

근거: 도구 변경 시 운영 문서 일괄 정정 의무 → outdated 빈번. 표준 용어로 추상화.

---

## lock #21 — pat_decision_rules

V/R1 분기 기준 = `config/pat_decision_rules.json` 흡수 (Phase 1 산출물).

Phase 0 = 본 채팅 raw 사후 분기. Phase 1 진입 사후 자동화.

---

## lock #22 — qa_mapping_minimization ★ patch 3분리 정합

QA dimension 매핑 최소화:

| 변경 영역 | QA mapping |
|---|---|
| analysis 수정 | A 필수 |
| cs_ids 수정 | B 필수 |
| 문학 변경 | B + C |
| pat 변경 | D |
| ok·questionType 변경 | **Data Contract 필수** |

근거: patch 영역과 QA 영역 정합 의무. analysis 만 수정인데 D 까지 의무 X (불필요한 검수 부담).

### patch 3분리 정합

- **Data Contract**: ok / questionType / 데이터 구조 변경
- **source**: sents 본문 / passage 본문 변경 (PDF cross-check 의무)
- **pattern**: pat / cs_ids / analysis 변경

3 dimension 분리 의무. 한 patch 에 다수 dimension 변경 시 분할 commit.

---

## Self-test 7건 (lock 22 정합 의무)

신규 회기 진입 + 모든 응답 사전 self-check:

```
① "5/8" / "D-7" / 매주 X요일 단어 0건 (lock #7 정합)
② Spec 명칭 단독 사용 0건 (issue_id 정본 사용, lock #9)
③ 라벨 분리 사용 (lock #12 정합 — 9 라벨)
④ Gate 5a/5b 분리 사용 (lock #5)
⑤ issue_id 정본 명명 (lock #2)
⑥ commit message issue_id 강제 (lock #14)
⑦ 운영 문서 도구 의존 표현 0건 (lock #20)
```

---

## Phase 매핑

```
Phase 0  : architecture Layer 1~7 구축 — 종결 [Confirmed via cfe14f7]
Phase A  : 진입 단계 (현재) — Q20 release_approved + kor25_d 재추출
Phase B  : 5 수능 + Pro tier 정정 — 8 set 본문 무결성 audit + audit 자동화 도구
Phase C  : audit 결과 set 별 source-patch sequencing
Phase D  : Q14·Q15·Q17 unblock + atomic patch
Phase 1  : pat_decision_rules.json 흡수 + active_issue_log 자동화
```

(주: Phase A~D 는 architecture 영역, Phase 1~3 은 D엔진 개발 영역. 두 체계 다른 영역.)

---

## 변경 이력

- 2026-05-05: lock 22 baseline 확정 (HANDOVER_CHAT1.md §2)
- 2026-05-07: 본 문서로 raw 영구 보존
