# TASKS.md — 실행 엔진

> 갱신: 2026-04-15
> 항상 3개만 유지. 완료되면 아래 DONE으로 이동.

---

## 🔥 ACTIVE TASKS

**[B-6] F_content_reversed 47건 정밀 분류**
- 담당: Code B
- 완료 기준: 진짜 반전만 추출 → reanalyze_positive 처리 → WARNING 감소
- 상태: 내일 첫 작업
- 방법:
  1. isReversed 수정된 함수로 47건 재판정
  2. 진짜 반전만 reanalyze_positive 실행
  3. quality_gate --scope=suneung5 재확인

**[O-1] 오류 패턴 정의**
- 담당: 성진님
- 완료 기준:
  - needs_human 목록에서 공통 패턴 1개 이상 발견
  - step3 프롬프트에 반영 완료
- 상태: B-6 완료 후
- 방법: needs_human 목록 → 공통 패턴 정의 → step3 즉시 반영

**[A-2] git pull + 빌드 확인**
- 담당: Code A
- 완료 기준: git pull 후 정상 빌드
- 상태: 진행

---

## 📊 현재 quality_gate (--scope=suneung5)

| 등급 | 건수 |
|---|---|
| 🔴 CRITICAL | 0건 ✅ |
| 🟡 WARNING | 119건 (F_content_reversed 47 + G_ann_dead 72) |
| ⚪ IGNORE | 8건 |
| 상태 | 🟢 release_ready |

---

## 📌 2단계 진입 조건

- CRITICAL = 0 ✅
- WARNING 자동 처리 안정
- needs_human 20건 이하

---

## 📋 백로그

**[A-3] 랜딩 오답 패턴 9종 표기**
- 오르비 게시 후 피드백 보고 진행
- 메인 카피: 숫자 전면 금지, "반복되는 오답 패턴" 중심
- 상세 섹션에서만: 독서 4종 / 문학 5종
- 어휘(V)는 패턴 수 제외

- G_ann_dead 72건 (F_content_reversed 처리 후)
- set_ 플레이스홀더 근본 원인: 구형(2014~2018) 재탑재 시 step3 점검
- pat_unclassifiable 190건 (다음 주)
- step4 "빈 배열 절대 금지" → 향후 근거 있는 fallback 규칙으로 보강

---

## ❌ DO NOT TOUCH

- 전체 시험 확장 (2014~2021)
- UI 리디자인
- 신규 기능 추가
- node -e 인라인 품질 검증
- 전체 48개 동일 품질이라는 표현

---

## ✅ DONE

- [x] DEAD cs_ids 138건 → 0건 (2022·2023수능)
- [x] AI노출/ID잔재 11건 → 0건
- [x] step3 프롬프트 4단계 원칙 반영
- [x] step4 AUTO_EMPTY_PATS 설계
- [x] 부실해설 87건 재생성 (2022~2026수능)
- [x] quality_gate --fix 546건
- [x] l2023b Q22 전체 교체
- [x] 프로젝트 파일 구조 정리
- [x] CLAUDE.md 통합 재작성 + 공개 가능 기준 명세
- [x] 2025수능 해설 ID 잔재 13건 → 0건
- [x] 루트/src 레거시 파일 삭제
- [x] 랜딩 히어로/CTA/공부법 섹션 — 14일 기준 통일
- [x] B-1 해설 재생성 255건
- [x] B-2 quality_gate 3단계 필터 + reanalyze 분류
- [x] B-3 DEAD_csid 699건 → 0건
- [x] B-4 quality_gate CRITICAL 강화 + 경로 통일 + MAX_RETRY
- [x] B-5 5개 수능 release_ready 달성 + isReversed 버그 수정 + step4 마커 규칙 제거
- [x] 오르비 게시 (2022~2026 수능 5개 범위)

---

## 완료 보고 형식 (Code A/B 필수)

```
[완료 보고]
작업:
완료 기준 충족: Y/N
결과:
5개년 CRITICAL:
문제:
다음 액션 1개:
```
