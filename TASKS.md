# TASKS.md — 수능 뷰어 운영판

> 갱신: 2026-04-16
> 목표 1: 4월 22일 오르비 게시
> 목표 2: 4월 내 전체 48개 시험 완료

---

## 운영 원칙

```
Code A  = 출시 QA 전담 (UX/버그/렌더링)
Code B  = 파이프라인 고도화 전담
성진님  = 반영 승인권자 (지금 반영할지 / 보류할지 결정)

파이프라인 실험 → 표본 검증 → 성진님 승인 → release 반영
검증 안 된 수정은 release 데이터에 바로 넣지 않음
```

---

## 🔥 ACTIVE — 출시 트랙 (4/22 필수)

**[A-img] 누락 이미지 2개 push + vercel 배포**
- 담당: Code A
- 완료 기준: 이미지 6개 정상 + 배포 완료
- 상태: 긴급
- 명령어:
  ```bash
  git add public/images/2023_r20239d_q16_bogi.png
  git add public/images/2022_r20226b_q4_bogi.png
  git commit -m "feat: 누락 이미지 2개 추가"
  git push
  # vercel --prod
  ```

**[O-QA] 해설/형광펜 샘플 검수**
- 담당: 성진님
- 완료 기준: 랜덤 10문제 직접 확인 + 이상 패턴 정의
- 상태: 진행
- 방법: 2022~2026 수능 임의 문제 → 형광펜/해설 직접 확인
  → "이건 이렇게 바꿔야 해" 있으면 Claude에 전달 → step3 즉시 반영

**[O-POST] 오르비 게시 준비**
- 담당: 성진님
- 완료 기준: 글 최종본 + 폼 연결 + 게시 직전 체크리스트
- 상태: 4/21 준비

---

## 🧪 ACTIVE — 고도화 트랙 (4/22 이후 전체 완료)

**[B-7] step4 선택-검증-재선택 구조 개선**
- 담당: Code B
- 완료 기준: 표본 세트 2개에서 몰빵 감소 확인 → 성진님 승인 → release 반영
- 작업:
  1. validateDistribution() 추가
  2. 몰빵 감지 시 재선택 루프 (MAX_ATTEMPT=2)
  3. 핵심 용어 추출 → 탐색 → 차별화 프롬프트
  4. AUTO_EMPTY_PATS 분기 명확화
- 반영 게이트: 표본 검증 → 성진님 승인 → main 반영

**[B-8] 9월 시험 공개 범위 확장**
- 담당: Code B
- 완료 기준: 2025_9월, 2024_9월, 2023_9월 CRITICAL 0건
- 상태: B-7 완료 후

---

## 📅 일별 계획

| 날짜 | Code A | Code B | 성진님 |
|---|---|---|---|
| 4/16 | 이미지 push + 배포 | B-7 표본 실험 | O-QA 샘플 검수 |
| 4/17 | 모바일 점검 | B-7 승인 후 release 반영 + B-8 시작 | 오르비 글 작성 |
| 4/18 | A-3 랜딩 9종 | 9월 시험 retarget | 해설 추가 검수 |
| 4/19 | UI 최종 점검 | G_ann_dead 정리 | 전체 동선 확인 |
| 4/20 | 버퍼 | F_content_reversed 정리 | 버퍼 |
| 4/21 | quality_gate 최종 | 최종 확인 | 오르비 글 다듬기 |
| 4/22 | — | — | 오르비 게시 |
| 4/23~30 | — | 구형 시험 순차 처리 | — |

---

## 📋 대기 작업

- [B-9] G_ann_dead 72건 정리
- [B-10] F_content_reversed 46건 처리
- [B-11] 2026 l2026d 몰빵 선별 재분석
- [A-3] 랜딩 오답 패턴 9종 표기
- [B-구형] 2014~2021 구형 시험 파이프라인 처리

---

## 📌 출시 가능 기준

```
4/22 오르비 게시 기준:
  - 2022~2026 수능 5개 CRITICAL 0
  - release_ready
  - 로그인/제출/형광펜/이미지 정상

4월 내 전체 완료 기준:
  - 전체 48개 quality_gate CRITICAL 0
  - step4 v2 전체 적용
  - 구형 시험 구조 이슈 정리
```

---

## ❌ DO NOT TOUCH

- 검증 안 된 파이프라인 결과를 release 데이터에 바로 반영
- node -e 인라인 수동 패치
- "전체 48개 동일 품질" 표현
- 출시 직전 대규모 UI 변경

---

## ✅ DONE

- [x] 5개 수능 release_ready 달성
- [x] DEAD_csid 699건 → 0건
- [x] 내부 ID 58건 → 0건
- [x] isReversed false positive 수정
- [x] step3 4단계 원칙 + ok:true 부정 표현 금지 반영
- [x] quality_gate CRITICAL/WARNING/IGNORE 3단계
- [x] 이미지 bogi 6건 annotated_image 변환
- [x] isPro 런타임 에러 수정
- [x] 무료 범위 5개 수능 확정
- [x] 랜딩 14일 기준 통일
- [x] B-6 F_content_reversed 47→46건

---

## 완료 보고 형식

```
[완료 보고]
작업:
완료 기준 충족: Y/N
결과:
release 영향:
문제:
다음 액션 1개:
```
