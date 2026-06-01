# 현 진행 상황 — 2026-06-01

## 현황

| 범위 | 진척 | 비율 |
|---|---|---|
| **전체** | 350 set | 100% |
| 수능 22~26 | 40/40 release_ready 통과 | 100% ✓ |
| 모의 22~26 | 78/78 marker 정합 | 100% ✓ |
| LEGACY 수능 14~21 | 61/76 | 80% |
| LEGACY 모의 14~21 | 0/156 | 0% |
| cs_ids 결함 (release_ready 1/4 위반) | 1075 → 905 (170 자동/batch 반영) | -16% |
| setId 충돌 33 set 도구/검수 보드 안전화 | 영구 자산화 완료 | ✓ |

---

## 오늘(06-01) 완료

### Sprint 1 — setId 충돌 안전장치 (도구 + 검수 보드)

[Confirmed] 핵심 결함 발견: LEGACY 모의 A/B형 33 set 의 동일 setId 가 두 yearKey 에 중복 존재 (r20159a = 2015_9월A 후각 + 2015_9월B 공자/의 등). 도구 7개 + 검수 보드 일괄 영구 안전화.

| 도구 | v | 변경 |
|---|---|---|
| pipeline/cs_ids_recovery.mjs | v3.0 | 전역 sentIndex 폐기 → set 내부 sents 기준 lookup |
| pipeline/cs_ids_apply.mjs | v1.2 | findChoice yearKey+area 격리 + 정확히 1개 매칭만 apply |
| pipeline/cs_ids_revert.mjs | v2 | 동일 패턴 적용 (yearKey+area 격리) |
| pipeline/bracket_audit.mjs | v2 | findSet 에 yearKey 우선 검색 (백워드 호환) |
| pipeline/visual_mark_extractor.mjs | v2 | findSet 에 yearKey 인자 추가 |
| pipeline/quality_gate.mjs | v2 | --fix 시 annotations.json 도 동일 시점 백업 |
| pipeline/step4_csids.js | v2 | retarget + extract-spans 백업 추가 |
| pipeline/apply_para.cjs | - | archive 이동 (사용 빈도 0) |
| src/AuditPanel.jsx | v4 | ?yearKey= 라우팅 + 충돌 set yearKey 선택 화면 |

### Live spot check (jippi.kr) — 전수 PASS

| URL | 검증 결과 |
|---|---|
| /audit/r2026a | 본문 표시 (백워드 호환) ✓ |
| /audit/r20159a | yearKey 선택 화면 ✓ |
| /audit/r20159a?yearKey=2015_9월A | 후각 본문 ✓ |
| /audit/r20159a?yearKey=2015_9월B | 공자/의 본문 ✓ |

### Sprint 2 — cs_ids C sprint Phase 1+2a (74건 반영)

[Confirmed] LEGACY 모의 영역 cs_ids 자동 반영:
- 자동 8건 (score=1.00 + unique match): r20146c / r20156e / r20169c
- batch tier1 66건 (score=1.00 + unique match): 16 yearKey / 30 set
- audit_log.jsonl +73 entries / 백업 2개 보존

### 데이터 정정 (set 단위)

| 영역 | 결과 |
|---|---|
| working tree all_data_204.json 손상 → HEAD 복구 | 정합 |
| cs_ids 자동 8 + batch 66 = **74건 채움** | release_ready -74 |

---

## 다음 액션 (우선순위)

1. **Phase 2b — cs_ids batch_review 잔여 29건** (score 0.5~0.84, live 검수) — 약 30분
2. **베타 학생 onboarding** (모두의창업 / 토스 페이먼츠 / Tally) — 매출 영향 큼
3. **LEGACY 모의 14~21 본격 진입** — 156 set 의무 영역 (13개년 비전 path)
4. annotation 33 set 추가 (LEGACY)
5. 토스 페이먼츠 결제 연동 (심사 대기)

---

## 사업

| 항목 | 상태 |
|---|---|
| 토스 페이먼츠 | 심사 예정 |
| 모두의창업 | 심사 기간 진행 중 |
| Tally 베타 테스터 | 베타 출시 진입 완료 |
| FREE 5수능 (22~26수능) 40 set | 100% release_ready 통과 ✓ |
| 모의 22~26 78 set | 100% (마커 정합 완료) |
| LEGACY 모의 cs_ids 자동/batch | 170건 영구 반영 |

---

## 미해결 사항 / 리스크

- **Cowork 환경 file 절단 결함**: Edit/Write 도구 사용 시 file 일부 잘림 결함 반복 발생. AuditPanel.jsx + cs_ids_recovery.mjs + all_data_204.json + current_state.md 4건 영향. cat heredoc 또는 cp 명령 path 우선 권고.
- **C sprint Phase 2b**: 29건 잔여. score < 1.00 영역 — false positive 위험. 보수적 승인 권고.
- **LEGACY 모의 14~21**: 156 set 완전 미진입. 13개년 비전 달성 path 의 최대 영역.

---

## 변경 이력

- **2026-06-01 (오늘)**: setId 충돌 안전장치 sprint (도구 7개 + AuditPanel v4) + cs_ids C sprint Phase 1+2a 74건 반영. LEGACY A/B형 33 set 검수 영구 가능화. Live spot check 전수 PASS.
- 2026-05-31: cs_ids 영구 자산화 + 진단 도구 v2 보강 + 검수 보드 v3.1+v3.2 + B sprint duplicate_sentid 재매핑 + 모의 22~26 marker batch 16 set + stem/선지 환각 12 set + annotation 15 set + 96건 cs_ids 자동 반영. 베타 출시 진입.
- 2026-05-28: 181 set RELEASED. UX W2/W3. 모의 78 set + LEGACY 수능 61 set 전환. release_ready 6기준 도입.
- 2026-05-26: W1 완료. FREE 100% release.
