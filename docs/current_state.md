# 현 진행 상황 — 2026-05-28

## 현황

| 범위 | 진척 | 비율 |
|---|---|---|
| **전체** | 181 set / 727 문항 / 3,636 선지 (350 set 중) | **51%** |
| 수능 22~26 | 40/40 | 100% |
| 모의 22~26 | 78/78 | 100% |
| LEGACY 수능 14~21 | 61/76 (B형 setId 분리 완료) | 80% |
| LEGACY 모의 14~21 | 0/156 | 0% |
| YEAR_INFO | 26 yearKey | — |

---

## 오늘(05-28) 완료

| 영역 | 상태 |
|---|---|
| UX W2: 지문별 제출 버튼 + 채점 toast | ✓ |
| UX W3: set 단위 review mode (초록/빨강) + 되돌리기 버튼 | ✓ |
| annotation marker sweep audit (118 set) — orphan 6건 정정 | ✓ |
| 해설 sentId 코드 노출 140건 제거 | ✓ |
| 2025수능 setId 통일 (kor25→r2025) | ✓ |
| 모의 22~26 78 set RELEASED 전환 | ✓ |
| LEGACY 수능 61 set RELEASED + B형 24 set rename | ✓ |
| release_ready 6기준 체계 (CLAUDE.md + quality_gate.mjs) | ✓ |
| 불량 12 set RELEASED 제거 (본문불완전 + 선지누락) | ✓ |

---

## 다음 액션

1. needsReview 25건 순차 점검 (RELEASED 내)
2. LEGACY 수능 미달 15 set (PDF 재추출)
3. LEGACY 모의 14~21 (156 set) 일괄 처리
4. annotation 85 set 추가
5. 토스 페이먼츠 결제 연동 (심사 대기)
6. 인스타 광고 콘텐츠 기획

---

## 사업

| 항목 | 상태 |
|---|---|
| 토스 페이먼츠 | 심사 예정 |
| 모두의창업 | 심사 기간 진행 중 |
| Tally 베타 테스터 | 모집 중 |
| 핵심 상품 (수능+모의 22~26) 118 set | **100% 완성** |

---

## 변경 이력

- 2026-05-28 (오늘): 181 set RELEASED. UX W2/W3 완료. 모의 78 set + LEGACY 수능 61 set 전환. 불량 12 set 격리. release_ready 6기준 도입.
- 2026-05-26: W1 완료. FREE 100% release. 16건 commit 종결.
