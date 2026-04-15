# TASKS.md — 실행 엔진

> 갱신: 2026-04-15
> 항상 3개만 유지. 완료되면 아래 DONE으로 이동.

---

## 🔥 ACTIVE TASKS

**[B-1] 해설 재생성**
- 담당: Code B
- 완료 기준: `reanalyze_positive.mjs all` 실행 후 반전/빈 해설 0건
- 상태: 대기
- 명령어: `node pipeline/reanalyze_positive.mjs all`

**[B-2] DEAD_csid 전체 시험 확장**
- 담당: Code B
- 완료 기준: quality_gate DEAD_csid 0건
- 상태: 대기
- 방법: `pipeline/archive/fix_dead_csids.cjs` → 전체 시험 대상으로 수정 후 실행

**[O-1] 해설 퀄리티 샘플 검수**
- 담당: 성진님
- 완료 기준: 5~10건 직접 확인 → 잘못된 해설 패턴 발견 → step3 프롬프트 보완
- 상태: B-1 완료 후 진행
- 방법: 재생성된 해설 중 의심스러운 것 성진님이 판단 → Claude와 프롬프트 수정

---

## ❌ DO NOT TOUCH (이번 주)

- 전체 시험 확장 (2014~2021)
- UI 리디자인
- 신규 기능 추가
- pat_unclassifiable 190건 (다음 주)

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

---

## 완료 보고 형식 (Code A/B 필수)

```
[완료 보고]
작업: 
완료 기준 충족: Y/N
결과: 
문제: 
```
