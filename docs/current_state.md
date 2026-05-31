# 현 진행 상황 — 2026-05-31

## 현황

| 범위 | 진척 | 비율 |
|---|---|---|
| **전체** | 350 set | 100% |
| 수능 22~26 | 40/40 release_ready 통과 | 100% ✓ |
| 모의 22~26 | 78/78 (16 set 깊은 정정 완료) | 100% |
| LEGACY 수능 14~21 | 61/76 | 80% |
| LEGACY 모의 14~21 | 0/156 | 0% |
| cs_ids 결함 (release_ready 1/4 위반) | 1075 → 979 (96 자동 반영) | -9% |
| duplicate_sentid_hold set | 2 → 0 | 해소 ✓ |
| FREE 5수능 marker 결함 | 13 → 0 (9 정정 + 4 false positive) | 해소 ✓ |
| 모의 22~26 marker 결함 | 16 set 정정 | 완료 ✓ |
| annotation 결함 | 15 set → 0 | 해소 ✓ |

---

## 오늘(05-31) 완료

### 영구 자산 (도구 + 인프라)
| 도구 | 역할 |
|---|---|
| `pipeline/cs_ids_recovery.mjs` v2 | 후보 산출 read-only (yearKey/setId hardcode X / bogi.diagram + 환각 marker + duplicate_sent_id flag) |
| `pipeline/cs_ids_apply.mjs` | auto + batch 2 mode / dry-run default / 백업 + audit_log.jsonl |
| `pipeline/cs_ids_revert.mjs` | audit_log 기반 일괄 되돌리기 |
| `pipeline/annotation_delete.mjs` | deletion JSON 일괄 처리 |
| `config/cs_ids_recovery_thresholds.json` | 점수/길이/격차 cutoff 분리 |
| `config/marker_chars.json` | marker 문자 집합 분리 (신규 시험 추가 시 config 수정) |
| `src/AuditPanel.jsx` v3.1+v3.2 | cs_ids 후보 검토 + annotation 삭제 staging |
| `public/audit_data/cs_ids_candidates.json` | 검수 보드 fetch 가능 |

### 데이터 정정 (set 단위)
| 영역 | 결과 |
|---|---|
| cs_ids 96건 자동 반영 (score=1.00 exact match) | release_ready -96 |
| FREE 5수능 marker 결함 13 set 정정 | 9 set 정정 + 4 false positive |
| annotation 결함 15 set | 자동 27건 (\n + sentId) + 수동 8건 (UNFOUND) |
| 모의 22~26 marker batch (시험 단위 5 batch) | l20266c/l20256c/l20226a/b/c/r20226b/c/d/l20256a/b/d/l20239a/c/l20236b/r20269c |
| Live spot check stem/선지 환각 12 set | ⓐ~ⓔ→㉠~㉤ / ⑦①②→㉠㉡ⓑ 등 |
| **B sprint: duplicate_sentid 재매핑** | r2022b (가/나) + l20269d (가/나/다) / cs_ids 6건 + annotation 3건 자동 재매핑 |

### 코드 변경
| 항목 | 영향 |
|---|---|
| `src/AuditPanel.jsx` React Hooks #310 정정 | conditional return 앞 useState 이동 |
| `src/PassagePanel.jsx` box-decoration-break clone | cs_ids 형광펜 line wrap 시 여백 차는 결함 |
| `src/PassagePanel.jsx` verse `<div>` → `<span>` wrap | verse 형광펜 line 끝까지 차는 결함 |

---

## 다음 액션 (우선순위)

1. **C. cs_ids batch_review 103건** — 검수 보드 v3.1 활용 (LEGACY 위주)
2. **D. AuditPanel false positive 정정** — bogi self-definition / marker_position_mismatch 메시지 정밀화
3. **E. LEGACY 본문 marker 추출 결함 154 set** — 교육청/사관/LEET/선택영역 진입 전
4. **F. PDF 직접 확인 워크플로우 영구화** — Claude 가 사용자 PDF 인용 부담 X 자체 점검
5. annotation 33 set 추가 (LEGACY)
6. 토스 페이먼츠 결제 연동 (심사 대기)

---

## 사업

| 항목 | 상태 |
|---|---|
| 토스 페이먼츠 | 심사 예정 |
| 모두의창업 | 심사 기간 진행 중 |
| Tally 베타 테스터 | **베타 출시 진입 완료** |
| FREE 5수능 (22~26수능) 40 set | **100% release_ready 통과** ✓ |
| 모의 22~26 78 set | 100% (마커 정합 완료) |

---

## 변경 이력

- **2026-05-31 (오늘)**: cs_ids 영구 자산화 + 진단 도구 v2 보강 + 검수 보드 v3.1+v3.2 + B sprint duplicate_sentid 재매핑 + 모의 22~26 marker batch 16 set + stem/선지 환각 12 set + annotation 15 set + 96건 cs_ids 자동 반영. 베타 출시 진입.
- 2026-05-28: 181 set RELEASED. UX W2/W3. 모의 78 set + LEGACY 수능 61 set 전환. release_ready 6기준 도입.
- 2026-05-26: W1 완료. FREE 100% release.
