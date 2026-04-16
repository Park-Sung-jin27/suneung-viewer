# TASKS.md — 실행 엔진

> 갱신: 2026-04-16 | 목표: 4월 22일 오르비 게시
> 출시 트랙 / 고도화 트랙 분리 운영

---

## 🚀 출시 트랙 (4/22 게시 전 완료 필수)

**[A-img] 누락 이미지 2개 push**
- 담당: Code A
- 완료 기준: 이미지 6개 전부 정상 렌더링
- 상태: 긴급
- 명령어:
  ```bash
  git add public/images/2023_r20239d_q16_bogi.png
  git add public/images/2022_r20226b_q4_bogi.png
  git commit -m "feat: 누락 이미지 2개 추가"
  git push
  ```

**[B-QA] 5개 수능 샘플 품질 검증**
- 담당: Code B
- 완료 기준:
  - 랜덤 10문제 형광펜/해설 이상 없음
  - quality_gate CRITICAL 0 유지
  - release_ready 확인
- 상태: O-1 완료 후

**[O-launch] 오르비 게시 준비**
- 담당: 성진님
- 완료 기준: 글 최종 확인 + 폼 연결
- 상태: 4/21 준비

---

## 🧪 고도화 트랙 (출시와 병렬 — 출시 트랙에 영향 금지)

**[B-7] step4 선택-검증-재선택 구조 개선**
- 완료 기준: H_cs_concentration WARNING 45건 → 0건
- 작업:
  1. validateDistribution() 추가
  2. 몰빵 감지 시 재선택 루프 (MAX_ATTEMPT=2)
  3. 프롬프트: 핵심 용어 추출 → 탐색 → 차별화
  4. AUTO_EMPTY_PATS 분기 명확화
- 주의: 전체 데이터 재생성은 출시 후 진행

**[B-8] 9월 시험 공개 범위 확장**
- 2025_9월, 2024_9월, 2023_9월 step4 retarget
- quality_gate CRITICAL 0 확인 후 공개 범위 추가

**[B-9] G_ann_dead 72건 정리**

**[B-10] F_content_reversed 46건 정리**
- O-1 완료 후 진짜 반전만 reanalyze

**[A-3] 랜딩 오답 패턴 9종 표기**
- 상세 섹션: 독서 4종 / 문학 5종
- 숫자 전면 금지, "반복되는 오답 패턴" 중심

---

## ❌ 출시 전 절대 금지

- step4 구조 변경 후 전체 데이터 재생성
- UI 리디자인
- 신규 기능 추가
- node -e 인라인 품질 검증
- "전체 48개 동일 품질" 표현

---

## 📌 공개 가능 기준

```
1. ok:true cs_ids=[] → 0건
2. DEAD_csid → 0건
3. F_empty_analysis → 0건
4. ok:false + R1/R2/R4/L1/L2/L4/L5 + cs_ids=[] → 0건
→ 4개 모두 0 = release_ready
```

---

## ✅ DONE

- [x] 5개 수능 release_ready 달성
- [x] DEAD_csid 699건 → 0건
- [x] 내부 ID 58건 → 0건
- [x] isReversed false positive 수정
- [x] step3 4단계 원칙 반영
- [x] ok:true 해설 부정 표현 금지 규칙 반영
- [x] quality_gate CRITICAL/WARNING/IGNORE 3단계
- [x] 이미지 bogi 6건 annotated_image 변환
- [x] isPro 런타임 에러 수정
- [x] 무료 범위 5개 수능 확정
- [x] 랜딩 14일 기준 통일

---

## 완료 보고 형식

```
[완료 보고]
작업:
완료 기준 충족: Y/N
결과:
문제:
다음 액션 1개:
```
