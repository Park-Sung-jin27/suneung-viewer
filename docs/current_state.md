# 현 진행 상황 — 2026-06-04

## 현황

| 범위 | 진척 | 비율 |
|---|---|---|
| **전체** | 350 set | 100% |
| 수능 22~26 | 40/40 release_ready 통과 | 100% ✓ |
| 모의 22~26 | 78/78 marker 정합 + annotation 정합 | 100% ✓ |
| LEGACY 수능 14~21 | 61/76 | 80% |
| LEGACY 모의 14~21 | 0/156 (cs_ids 자동/batch 170건 반영) | 0% (cs_ids 부분) |
| cs_ids 결함 (release_ready 1/4 위반) | 1075 → 887 (188 자동/batch 반영) | -17.5% |
| setId 충돌 33 set 안전화 | 영구 자산화 ✓ | |
| annotation None-None entries | 78건 정정 (60 target=bogi 매핑 + 18 정정) | ✓ |

---

## 오늘(06-03) 완료 sprint

### Sprint 1 — setId 충돌 안전장치 (도구 7개 + AuditPanel v4)

| 영역 | 변경 |
|---|---|
| cs_ids_recovery v3.0 | 전역 sentIndex 폐기 — set 내부 sents 기준 |
| cs_ids_apply v1.2 | findChoice yearKey+area 격리 + ambiguous skip |
| cs_ids_revert v2 | 동일 패턴 적용 |
| bracket_audit v2 | findSet yearKey 우선 검색 |
| visual_mark_extractor v2 | findSet yearKey 인자 |
| quality_gate v2 | --fix 시 annotations 백업 |
| step4_csids v2 | retarget + extract-spans 백업 |
| apply_para.cjs | archive 이동 |
| AuditPanel v4 | ?yearKey= 라우팅 + 충돌 선택 화면 |

### Sprint 2 — cs_ids C sprint (92건 반영)

- Phase 1 (자동 score=1.00): 8건
- Phase 2a (batch tier1 score=1.00): 66건
- Phase 2b (live 검수 score 0.5~0.84): 18건
- LEGACY 모의 영역 영구 반영

### Sprint 3 — viewer UI 정정

- QuizPanel showBadge 정정 — 학생 클릭 선지 + ok:false 만 PatternBadge
- V (어휘) pat 사양 추가 (constants.js) + QuizPanel V badge skip

### Sprint 4 — 메타 발문 audit + CLAUDE.md 룰

- 메타 발문 전수 audit (3 set 정정: r2022c Q10 / r2014aB Q16 / r20149f Q30)
- CLAUDE.md §6 메타 발문 예외 룰 추가
- 모의 22~26 ok:false+pat 누락 17건 정정

### Sprint 5 — 본문 marker 정정 (사용자 PDF 인용 협업)

| yearKey | 정정 |
|---|---|
| 2023_9월 | annotation 5 + cs_ids 1 + 본문 marker 11 (r20239b/c/d) |
| 2022_9월 | 본문 marker 20 + annotation 16 |
| 2024_6월 | 본문 marker 25 + Q34 ⓐ~ⓔ→㉠~㉤ + annotation 15 + bogi image |
| 2024_9월 | 본문 marker 17 + Q7/Q10/Q14 stem 정정 + annotation 15 |
| 2025_9월 | l20259b 본문 marker 8 + l20259c 본문 재구축 (16 sent 추가) |
| 2026_6월 | 본문 marker 16 + Q9/Q13 stem 정정 + annotation 11 |

### Sprint 6 — annotation None-None entries 정정

- l2025c 7 entries 정정 (5 underline → marker type + 본문 sent.t ㉠~㉤ 삽입)
- 60 None-None entries → target='bogi' + qId 매핑 (72건)

### Sprint 7 — CLAUDE.md 룰 정정

- §1.D 명확한 설명 강제 (결론 먼저 / 옵션 나열 X / 검증 sample 의무)
- §6 메타 발문 예외 룰
- §16 v1.3 변경 이력 추가

---

## 다음 액션 (우선순위)

1. **viewer 측 target='bogi' annotation 처리 path** (코드 변경 — bogi underline 시각화)
3. **LEGACY 모의 14~21 본격 진입** — 156 set 의무 영역 (13개년 비전 path)
4. **Phase 2b reject 9건 manual 정정** (PDF cross-check 의무)
5. 토스 페이먼츠 결제 연동 (심사 대기)

---

## 사업

| 항목 | 상태 |
|---|---|
| 토스 페이먼츠 | 심사 예정 |
| 모두의창업 | 심사 기간 진행 중 |
| Tally 베타 테스터 | 베타 출시 진입 완료 |
| FREE 5수능 (22~26수능) 40 set | 100% release_ready 통과 ✓ |
| 모의 22~26 78 set | 100% (마커 + annotation 정합 완료) |
| LEGACY 모의 cs_ids 자동/batch | 188건 영구 반영 |

---

## 미해결 사항 / 리스크

- **Cowork 환경 file 절단 결함**: Edit/Write 도구 사용 시 file 일부 잘림 결함 반복. cat heredoc 또는 cp 명령 path 우선 권고.
- **viewer 측 target='bogi' 처리 path**: schema 확장 완료, 코드 변경 의무 잔존.
- **LEGACY 모의 14~21**: 156 set 완전 미진입. 13개년 비전 달성 path 최대 영역.

---

## 변경 이력

- **2026-06-04 (오늘) 3차**: cs_spans 무결성 sprint (베타 영역 15 yearKey) — dead sentId 참조(구 포맷 r20236d_s* / l2024_18_21s* / l202311as* 등) + 인용 text 불일치 전수 정정. 정규화 매칭(marker/인용부호/공백 무시 → 원문 substring 복원) 기반 자동 정정 1,107건 (remap 811 + text 재계산 233 + 전체탐색 41 + fragment 22). 베타 잔존 1,245→138 (-89%) — 잔존분은 본문에 해당 구절 부재(고전 표기 차이·본문 축약) = PDF cross-check 의무 needs_human. LEGACY 420건 미착수 (별도 sprint). suneung5 quality_gate CRITICAL 21건 동일 (신규 0). 백업: pipeline/backups/all_data_204.before_span_fix_20260604.json
- **2026-06-04 (오늘) 2차**: 잔여 yearKey 16건 sprint — PDF 직접 대조 path (사용자 인용 불필요 확인). 2023_6월: r20236d ⓐ~ⓔ 5건 + l20236c ㉠ + l20236d ㉠㉡ⓑⓒⓓⓔ 6건 + Q29/Q30 stem·선지 글자 오염 정정 + Q29 c2~c5 해설 재작성 (referent 오류). 2026_9월: l20269a ㉠㉡㉢ + **Q19 발문 유형 정정 (부정→긍정, 정답표 ① [Confirmed]) + ok 5건 재배정 + 해설 5건 재작성** + l20269b ㉠~㉤ (㉮ scheme 폐기) + Q25 정정 + l20269c ㉡㉢㉣㉤ (ⓕⓗⓘ 오염 글자 정정) + r20269c Q13 ⓐ~ⓔ. 2022_6월: r20226a ㉠ + r20226d Q17 빈칸 ㉮㉯㉰ 재구축 (선지 ①④ 방향 오염 정정, 정답표 ② 정합) + r20226c Q10 questionType 정정 (발문 부정형). 3 yearKey quality_gate CRITICAL 0건 (잔존 bracket 의심 11건 = 사전 존재). 신규 발견 결함 class: cs_spans dead sentId 참조 (r20236d_s* / l20236es* / l202311as* 포맷 위반 + 인용부호 오염) — 2023_6월 집중, 별도 sprint 의무.
- **2026-06-04 (오늘)**: 2025_6월 4 set 정합 sprint — 본문 marker 10건 삽입/정정 (r20256a ㉠㉡ / r20256c ⓐ㉠ / r20256d ⓑⓒⓓⓔ㉠) + stem/선지 marker 오염 정정 (Q2/Q3/Q10/Q15/Q17/Q33) + r20256c Q10 ④⑤ 선지 방향 반전 정정 + r20256d Q14 6지선다 결함 정정 (phantom 선지 삭제 + 정답 ④ ok 재배정 — 정답표 PDF [Confirmed]) + 해설 anchor 오류 재작성 (Q17 c3/c4/c5, Q2 c1/c5) + pat 2건 정정 (Q2 c1 R3→R4 / c5 R3→R1) + annotation 12건 추가 (box 에이어 + bracket A 포함) + 2건 정정. quality_gate 2025_6월 CRITICAL 0건. 사용자 미명시 영역 (r20256c ⓐ / r20256d ⓕ / l20256d ⓒⓓⓔ) = 시험지 PDF 대조로 전부 해소 (ⓕ·ⓒⓓⓔ는 실존하지 않음 확인).
- **2026-06-03**: setId 충돌 안전장치 sprint (도구 7개 + AuditPanel v4) + cs_ids C sprint 92건 + QuizPanel showBadge + V 사양 + 메타 발문 audit 3건 + 모의 22~26 pat 17건 + 본문 marker 6 yearKey 정정 + annotation None-None 78건 + l2025c marker type 정정 + 60 entries target=bogi 매핑 + CLAUDE.md §1.D §6 §16 룰 추가.
- 2026-05-31: cs_ids 영구 자산화 + 진단 도구 v2 보강 + 검수 보드 v3.1+v3.2 + B sprint duplicate_sentid 재매핑 + 모의 22~26 marker batch 16 set + stem/선지 환각 12 set + annotation 15 set + 96건 cs_ids 자동 반영. 베타 출시 진입.
- 2026-05-28: 181 set RELEASED. UX W2/W3. 모의 78 set + LEGACY 수능 61 set 전환. release_ready 6기준 도입.
- 2026-05-26: W1 완료. FREE 100% release.
