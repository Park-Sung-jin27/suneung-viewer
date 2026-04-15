# 수능 뷰어 — CLAUDE.md

> 갱신: 2026-04-15 | https://suneung-viewer.vercel.app

---

## 🔥 CURRENT FOCUS (이번 주 목표)

**2022~2026 수능 5개 시험 외부 공개 가능 품질 확정**

→ 이 목표와 직접 관련 없는 작업 금지
→ 기능 추가, UI 리디자인, 전체 시험 확장 금지

---

## 이 제품이 존재하는 이유

평가원 기출의 모든 답 근거는 지문 안에 있다.
형광펜으로 지문-선지를 1:1 연결해서, 학생 스스로 확인하게 만든다.
그 경험이 쌓이면 자신감이 생기고 성적이 오른다.

**핵심 차별점: 모든 선지에 지문 근거를 형광펜(cs_ids)으로 1:1 시각 연결**

---

## 공개 가능 기준 (4개 모두 충족해야 release_ready)

```
1. ok:true cs_ids=[] → 0건        ← 핵심 KPI (정답 근거 반드시 있어야 함)
2. DEAD_csid → 0건
3. F_empty_analysis → 0건
4. ok:false + R1/R2/R4/L1/L2/L4/L5 + cs_ids=[] → 0건
```

**작업 완료 ≠ 공개 가능**
DONE 목록에 올라가도 위 4개 충족 전까지는 공개 불가.

---

## AI 운영 원칙

```
AI:     90% 처리 — 추출, 해설, cs_ids, 품질 검증
성진님: 10% 판단 — AI가 올린 이슈만 수동 확인
성진님의 판단 → step3 프롬프트에 즉시 반영 → 퀄리티 계속 상승
```

**당면 문제만 해결하지 말 것.**
근본 원인을 찾아 파이프라인(step 파일)을 수정하라.
일회성 패치 스크립트 생성 절대 금지.

---

## 해설 품질 기준

```
진짜 부실 해설 (150자 기준 아님):
  - 선지 조건을 분해하지 않은 것
  - 가/나/다를 개별 검증하지 않은 것
  - "없다"만 쓰고 왜 없는지 설명 안 한 것
  - 성진님 수업 방식과 다른 것
```

**해설 4단계 원칙:**
```
1. 선지 조건 분해 — 복합 조건은 ①②③으로 분리
2. 작품별 개별 검증 — 가/나/다 각각 확인
3. 혼동 포인트 — "~처럼 보이지만 실제로는 ~이다"
4. 결론 한 줄 — 3~4등급이 이해할 수 있는 말로
```

---

## ok / pat / cs_ids 규칙

```
ok: true  = 지문 사실 일치 (발문 유형 무관, 정답 여부 아님)
ok: false = 지문 사실 불일치
questionType: positive → ok:true가 정답
questionType: negative → ok:false가 정답
pat: ok:false일 때만 R1~R4(독서) / L1~L5(문학). ok:true면 null.
```

**cs_ids 규칙:**
```
ok:true
  → 반드시 근거 문장 ID 있어야 함 (예외 없음)

ok:false + R1/R2/R4/L1/L2/L4/L5
  → 왜곡의 출처가 된 원문 문장 ID (예외 없음)

ok:false + R3
  → [] 필수 (지문에 없는 내용이 오답 근거)

ok:false + V
  → [] 필수 (어휘 치환 문항, 지문 문장 특정 불가)

ok:false + L3
  → 부분 일치 작품의 sentId
  → 단, "작품 전체가 근거"는 불가 — 반드시 특정 문장 지목
```

---

## 형광펜 작동 구조 (중요)

```
단일 진실값: choice.cs_ids
sent.cs: dataLoader._buildSentCs()가 런타임에 cs_ids로부터 생성하는 역참조
정적 sent.cs 개수는 품질 기준이 아님 — 품질 검수 시 cs_ids만 확인할 것

흐름: choice.cs_ids → _buildSentCs() → sent.cs → PassagePanel getHL() → 형광펜 표시
```

---

## 품질 검증 구조

```
quality_gate.mjs       → 단일 진입점 (출시 판단 기준)
reanalyze_positive.mjs → 부실/반전/빈 해설 자동 재생성
                         MAX_RETRY=2, improved/retryable/needs_human 분류

CRITICAL (출시 차단):
  - ok:true cs_ids 없음
  - ok:false + 근거필요 pat + cs_ids 없음
  - DEAD_csid
  - F_empty_analysis

WARNING (출시 후 개선):
  - F_content_reversed
  - G_ann_dead

IGNORE:
  - E_pat_unclassifiable
  - F_conclusion_mismatch
```

**검증은 quality_gate만. node -e 인라인 검증 금지.**

---

## 데이터 스키마

```
단일 진실: public/data/all_data_204.json
sentId: {setId}s{번호}  예: r2026as1  ← 언더스코어 없음
sentType: body | verse | workTag | author | footnote | omission | figure
```

---

## 연도키 규칙

```
수능·9월: 시행연도+1  →  2024년 9월 = "2025_9월"
6월:      시행연도    →  2022년 6월 = "2022_6월"
A/B형: "2016수능A"
```

---

## 담당 영역

| | Code A (프론트엔드) | Code B (파이프라인) |
|---|---|---|
| 담당 | `src/*.jsx` `api/*.js` `constants.js` | `pipeline/*` `public/data/*.json` |
| 금지 | `all_data_204.json` 직접 수정 | `src/*.jsx` 수정 |

**동시 push 절대 금지 / 작업 전 git pull 필수**

---

## 파이프라인

```
step1~7: 추출 → 해설 → cs_ids → 검증 → 배포
quality_gate.mjs          : 품질 검사 단일 진입점
reanalyze_positive.mjs    : 해설 재생성
pipeline/archive/         : fix_dead_csids.cjs 등 재사용 레거시
```

---

## 절대 금지

```
- 일회성 패치 스크립트 생성 (node -e 또는 step 파일 수정만)
- 성진님 판단을 일회성 적용 (반드시 step3 프롬프트에 반영)
- node -e 인라인으로 품질 검증 (quality_gate만 사용)
- Code A / Code B 동시 push
- PowerShell && 체이닝 (→ ; 사용)
- 이번 주 목표와 무관한 작업
```

---

## Code B 추가 원칙

```
데이터 오류 = UX 오류
ok:true cs_ids 없음 = 핵심 약속 위반 = 출시 불가
정확도 > 속도
```

## Code A 추가 원칙

```
모든 UI는 전환을 위해 존재한다.
설명보다 체험 / 클릭 → 즉각 반응 / 3초 안에 이해
```
