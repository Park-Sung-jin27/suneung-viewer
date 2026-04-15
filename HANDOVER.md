# HANDOVER.md — 오늘 상태

> 갱신: 2026-04-15

---

## 🎯 이번 주 목표

해설 퀄리티 확정 + 최종 프로세스 완성

---

## 🔥 오늘 할 것 (3개만)

1. **[오르비] 게시** — Code A 시험 범위 버그 수정 완료 후
2. **[B] F_content_reversed 47건 정밀 분류**
3. **[O-1] needs_human 패턴 정의**

---

## 오늘 완료

- 2022~2026 수능 5개 release_ready 달성
- isReversed false positive 버그 수정
- step4 잘못된 마커 규칙 제거 후 재검증 완료
- 형광펜 choice.cs_ids 기준 / sent.cs 런타임 역매핑 구조 확인
- 회원가입 플로우 정상 확인 (이메일)

---

## ⚠️ 남은 것

- Google OAuth: 배포 환경 최종 확인 필요
- 무료 사용자 시험 범위 버그 수정 중 (2022~2026 5개 전부 보여야 함)
- "무료로 시작" 버튼 Pro 잠금 해제 버그 수정 중

---

## ➡️ 내일 첫 작업

F_content_reversed 47건 정밀 분류 → 진짜 반전만 reanalyze
sent.cs 런타임 역매핑 구조 문서화

---

## 📊 현재 quality_gate (--scope=suneung5)

| 등급 | 건수 |
|---|---|
| 🔴 CRITICAL | 0건 ✅ |
| 🟡 WARNING | 119건 (F_content_reversed 47 + G_ann_dead 72) |
| ⚪ IGNORE | 8건 |
| **상태** | 🟢 **release_ready** |

> 공개 범위: 2022~2026 수능 5개만.
> 형광펜 단일 진실값: choice.cs_ids (sent.cs는 런타임 역참조, 품질 기준 아님)

---

## 핵심 구조 메모

```
형광펜: choice.cs_ids → dataLoader._buildSentCs() → sent.cs → PassagePanel getHL()
정적 sent.cs 개수 = 품질 기준 아님 (오해 금지)
```
