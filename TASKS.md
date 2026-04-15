# TASKS.md — 실행 엔진

> 갱신: 2026-04-15
> 항상 3개만 유지. 완료되면 아래 DONE으로 이동.

---

## 🔥 ACTIVE TASKS

**[B-4] F_empty_analysis 25건 재생성**
- 담당: Code B
- 완료 기준: CRITICAL 0건
- 상태: 진행
- 명령어: `node pipeline/reanalyze_positive.mjs all`

**[O-1] 오류 패턴 정의**
- 담당: 성진님
- 완료 기준:
  - still_bad / needs_human 목록에서 공통 패턴 1개 이상 발견
  - step3 프롬프트에 반영 완료
- 상태: B-4 완료 후
- 방법: needs_human 목록 확인 → 공통 패턴 정의 → step3 즉시 반영

> 사람이 결과를 확인하면 자동화가 아니다. 사람이 규칙을 만들면 자동화다.

**[A-2] git pull + 후속 빌드 확인**
- 담당: Code A
- 완료 기준: git pull 후 정상 빌드
- 상태: B-4 완료 후 진행

---

## 📊 현재 quality_gate 상태 (78a93fe 기준)

| 등급 | 건수 | 내용 |
|---|---|---|
| 🔴 CRITICAL | 25건 | F_empty_analysis만 잔존 |
| 🟡 WARNING | 482건 | F_reversed 220 + E_pat 190 + D_true 72 |
| ⚪ IGNORE | 4건 | |

---

## 📌 2단계 진입 조건

- CRITICAL = 0 ← 거의 도달
- WARNING 자동 처리 안정
- needs_human 20건 이하

---

## 📋 백로그

- set_ 플레이스홀더 근본 원인: 구형(2014~2018) 재탑재 시 step3 프롬프트 점검 필요
- pat_unclassifiable 190건 (다음 주)
- Day별 UX 구조 (베타 유저 데이터 확보 후)

---

## ❌ DO NOT TOUCH (이번 주)

- 전체 시험 확장 (2014~2021)
- UI 리디자인
- 신규 기능 추가
- 전체 검수 / 무작위 샘플 확인
- 복잡한 자동화 추가

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
- [x] CLAUDE.md 통합 재작성
- [x] 2025수능 해설 ID 잔재 13건 → 0건
- [x] 루트/src 레거시 파일 삭제
- [x] 랜딩 히어로/CTA/공부법 섹션 — 14일 기준 통일 (0854358)
- [x] B-1 해설 재생성 255건 (a2f07c2)
- [x] B-2 quality_gate 3단계 필터 + reanalyze 분류 (4a179d6)
- [x] B-3 DEAD_csid 699건 → 0건 (78a93fe) — Type A 193건 치환 + Type B 506건 제거

---

## 완료 보고 형식 (Code A/B 필수)

```
[완료 보고]
작업:
완료 기준 충족: Y/N
결과:
문제:
```
