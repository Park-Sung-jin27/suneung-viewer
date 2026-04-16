# TASKS.md — 실행 엔진

> 갱신: 2026-04-16 | 목표: 4월 22일 오르비 게시
> 항상 3개만 ACTIVE. 완료되면 DONE으로 이동.

---

## 🎯 4월 22일까지 목표

```
1순위: 5개 수능 WARNING 0건 (완성도 극대화)
2순위: 9월 시험 추가 공개 범위 확장
3순위: step4 선택-검증-재선택 구조 개선
```

---

## 📅 일별 계획

| 날짜 | Code B | Code A |
|---|---|---|
| 4/16 | O-1 완료 + B-7 step4 개선 | 이미지 2개 push + 빌드 |
| 4/17 | 9월 시험 step4 retarget + WARNING 정리 | 랜딩 A-3 (패턴 9종) |
| 4/18 | G_ann_dead 72건 정리 | UI 최종 점검 |
| 4/19 | 전체 quality_gate 최종 확인 | 모바일 렌더링 점검 |
| 4/20 | 버퍼 (잔여 이슈 처리) | 버퍼 |
| 4/21 | 최종 release_ready 확인 | 오르비 글 최종 다듬기 |
| 4/22 | — | 오르비 게시 |

---

## 🔥 ACTIVE TASKS

**[B-7] step4 선택-검증-재선택 구조 개선**
- 담당: Code B
- 완료 기준: H_cs_concentration WARNING 45건 → 0건
- 상태: 진행
- 작업:
  1. validateDistribution() 추가 (몰빵 감지)
  2. 몰빵 감지 시 재선택 루프 (overused → 재API 호출)
  3. AUTO_EMPTY_PATS 분기 명확화
  4. 프롬프트: 핵심 용어 추출 → 탐색 → 차별화 강제
  5. 2022~2026 수능 5개 + 9월 시험 retarget

**[A-img] 누락 이미지 2개 push + 빌드 확인**
- 담당: Code A
- 완료 기준: 이미지 렌더링 6개 전부 정상 + npm run build 통과
- 상태: 긴급 (오르비 게시 전 필수)
- 작업:
  ```bash
  git add public/images/2023_r20239d_q16_bogi.png
  git add public/images/2022_r20226b_q4_bogi.png
  git commit -m "feat: 누락 이미지 2개 추가"
  git push
  ```

**[O-1] ok:true 해설 규칙 정착 확인**
- 담당: 성진님
- 완료 기준: needs_human 4건 재생성 후 ok:true 해설에 부정 표현 0건
- 상태: Code B 재생성 완료 후 샘플 5건 직접 확인
- 기준:
  - ok:true 해설: 지문 근거 + 직접 일치 + 왜 맞는지만
  - 금지: 어긋나, 왜곡, 잘못, 부적절, 맞지 않다

---

## 📋 대기 작업 (순서대로)

**[B-8] 9월 시험 공개 범위 확장**
- 2025_9월, 2024_9월, 2023_9월 step4 retarget
- quality_gate --scope 확장 후 CRITICAL 0 확인
- 예상: 4/17

**[B-9] G_ann_dead 72건 정리**
- 어노테이션 참조 정리
- 예상: 4/18

**[A-3] 랜딩 오답 패턴 9종 표기**
- 오르비 게시 직전
- 메인 카피: 숫자 전면 금지, "반복되는 오답 패턴" 중심
- 상세 섹션: 독서 4종 / 문학 5종
- 예상: 4/17

**[B-10] F_content_reversed 46건 정리**
- O-1 완료 후 진짜 반전만 reanalyze
- 예상: 4/17~18

---

## 📌 공개 가능 기준 (변경 없음)

```
1. ok:true cs_ids=[] → 0건
2. DEAD_csid → 0건
3. F_empty_analysis → 0건
4. ok:false + R1/R2/R4/L1/L2/L4/L5 + cs_ids=[] → 0건
→ 4개 모두 0 = release_ready
```

---

## ❌ DO NOT TOUCH

- 전체 시험 확장 (2014~2021) — 4/22 이후
- UI 리디자인
- node -e 인라인 품질 검증
- "전체 48개 동일 품질" 표현

---

## ✅ DONE

- [x] DEAD cs_ids 138건 → 0건 (2022·2023수능)
- [x] AI노출/ID잔재 58건 → 0건
- [x] step3 프롬프트 4단계 원칙 반영
- [x] step4 AUTO_EMPTY_PATS 설계
- [x] quality_gate 3단계 필터 (CRITICAL/WARNING/IGNORE)
- [x] isReversed false positive 버그 수정
- [x] reanalyze_positive MAX_RETRY + improved/retryable/needs_human
- [x] B-3 DEAD_csid 699건 → 0건
- [x] 5개 수능 release_ready 달성
- [x] 이미지 bogi 6건 annotated_image 변환
- [x] isPro 런타임 에러 수정
- [x] 무료 사용자 시험 범위 5개 수능
- [x] 랜딩 히어로/CTA 14일 기준 통일
- [x] B-6 F_content_reversed 47건 → 46건
- [x] O-1 ok:true 해설 부정 표현 금지 규칙 step3 반영
- [x] CLAUDE.md 통합 재작성 + 공개 가능 기준 명세

---

## 완료 보고 형식

```
[완료 보고]
작업:
완료 기준 충족: Y/N
결과:
5개년 CRITICAL:
문제:
다음 액션 1개:
```
