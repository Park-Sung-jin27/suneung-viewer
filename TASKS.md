# TASKS.md — 실행 엔진

> 갱신: 2026-04-15
> 항상 3개만 유지. 완료되면 아래 DONE으로 이동.

---

## 🔥 ACTIVE TASKS

**[B-5] step4 ok:true 매핑 추가 + 5개 수능 CRITICAL 0건**
- 담당: Code B
- 완료 기준: 2022~2026 수능 5개 CRITICAL 0건 (quality_gate 기준)
- 상태: 진행
- 작업:
  1. step4_csids.js --retarget에 ok:true && cs_ids=[] 처리 추가
  2. 2022수능, 2023수능, 2024수능, 2025수능, 2026수능 순차 실행
  3. reanalyze_positive.mjs 5개 시험 개별 실행 (F_empty 25건)
  4. quality_gate --fix
- 검증: quality_gate만 사용 (node -e 금지)

**[O-1] 오류 패턴 정의**
- 담당: 성진님
- 완료 기준:
  - needs_human 목록에서 공통 패턴 1개 이상 발견
  - step3 프롬프트에 반영 완료
- 상태: B-5 완료 후
- 방법: needs_human 목록 확인 → 공통 패턴 정의 → step3 즉시 반영

> 사람이 결과를 확인하면 자동화가 아니다. 사람이 규칙을 만들면 자동화다.

**[A-2] git pull + 후속 빌드 확인**
- 담당: Code A
- 완료 기준: git pull 후 정상 빌드
- 상태: B-5 완료 후 진행

---

## 📊 현재 quality_gate 상태 (최신)

| 등급 | 건수 | 내용 |
|---|---|---|
| 🔴 CRITICAL | 1641건 | MISSING_csid_true 903 + MISSING_csid_false 713 + F_empty 25 |
| 🟡 WARNING | 291건 | F_content_reversed 219 + G_ann_dead 72 |
| ⚪ IGNORE | 194건 | E_pat_unclassifiable 190 + 기타 |

**공개 가능 기준 (4개 모두 0이어야 release_ready):**
```
1. ok:true cs_ids=[] → 0건
2. DEAD_csid → 0건
3. F_empty_analysis → 0건
4. ok:false + R1/R2/R4/L1/L2/L4/L5 + cs_ids=[] → 0건
```

---

## 📌 2단계 진입 조건

- 5개 수능 CRITICAL = 0
- WARNING 자동 처리 안정
- needs_human 20건 이하

---

## 📋 백로그 (지금 하지 않음)

**[A-3] 랜딩 오답 패턴 9종 표기**
- B-5 완료 + 오르비 게시 결정 후 진행
- 메인 카피: 숫자 전면 금지, "반복되는 오답 패턴" 중심
- 상세 섹션에서만: 독서 4종 / 문학 5종
- 어휘(V)는 패턴 수 제외

- set_ 플레이스홀더 근본 원인: 구형(2014~2018) 재탑재 시 step3 점검 필요
- pat_unclassifiable 190건 (다음 주)
- Day별 UX 구조 (베타 유저 데이터 확보 후)

---

## ❌ DO NOT TOUCH (이번 주)

- 전체 시험 확장 (2014~2021)
- UI 리디자인
- 신규 기능 추가
- 전체 검수 / 무작위 샘플 확인
- 복잡한 자동화 추가
- node -e 인라인 품질 검증

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
- [x] 랜딩 히어로/CTA/공부법 섹션 — 14일 기준 통일 (0854358)
- [x] B-1 해설 재생성 255건 (a2f07c2)
- [x] B-2 quality_gate 3단계 필터 + reanalyze improved/retryable/needs_human (4a179d6)
- [x] B-3 DEAD_csid 699건 → 0건 (78a93fe)
- [x] B-4 quality_gate CRITICAL 강화 + 경로 통일 + MAX_RETRY 추가

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
