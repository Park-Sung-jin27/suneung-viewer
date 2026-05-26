# 현 진행 상황 — 2026-05-26

## 오늘 W1 완료 종합

| 영역 | commit | 상태 |
|---|---|---|
| FREE broken 5 + suspect 14 정정 | 9dac8a7 ~ b4858fa | ✓ |
| RELEASED 5 → 15 → 40 등록 | ef5ed99 ~ b34e2f3 | ✓ FREE 100% |
| marker render 결함 (suppressSup v2) | 5253849 | ✓ |
| Pro 잠금 우회 차단 | 394ba2c | ✓ |
| audit batch 3종 + lane report | 128e6e3 | ✓ |
| v2 톤 25 선지 재작성 | fe93b42 | ✓ |
| W1-B 검수 경고 allowlist | ef5ed99 | ✓ |
| placeholder 179 정정 | afb576a | ✓ |
| grading 22 + 79 자동 정정 (101) | afb576a | ✓ |
| LEGACY 13 yearKey hidden | b34e2f3 | ✓ |
| r2023d 본문 + Q16 + Q17 bogi | 7b25373 + 78deb5c | ✓ |

**FREE 5개년 40/40 = 100% release 도달**. 모두의창업 심사 + 베타 모집 준비 완료.

---

## 미해결 결함 (내일 진행)

### P0 — 즉시 검증
- **r2023d Q17 bogi underline 미적용** — annotations.json 의 qid → qId 정정 commit 의무. push 후 라이브 검증.

### P1 — 사용자 짧은 paste
- **LEGACY data 결함 3건** (choices 누락) — r20196e Q37 / r2014f Q35 / r20206d Q39. PDF paste 의무.

### P2 — UX (모멘텀 직접)
- **지문별 제출 버튼** (Employee 2 #1) — 학습 지속 직격타. 5~7일 작업.
- **해설 한 줄 결론 prefix** — 1~2주 batch.

### P3 — 장기 정리
- LEGACY 본문 재추출 pilot (2017수능 l2017b 등)
- LEGACY placeholder 73 (c.pat=None) 흡수
- LEGACY broken 56 set 정정
- annotation marker 추출 결함 다른 RELEASED 39 set sweep

---

## 내일 아침 첫 작업

```powershell
cd C:\Users\downf\suneung-viewer
git add public/data/annotations.json
git commit -m "fix(r2023d): QG-r2023d-bogi-qId — qid 필드명 → qId (QuizPanel filter 정합)"
git push origin main
```

→ push 후 라이브에서 r2023d Q17 의 "게딱지 폭"/"큰 집게발의 길이" underline 표시 확인.

---

## 진척 지표

| 지표 | 어제 | 오늘 | 변화 |
|---|---|---|---|
| FREE 5개년 release | 39/40 | **40/40** | +1 (100%) |
| RELEASED_SETS | 0 | 40 | +40 |
| audit batch | 0 | 3 (structure/annotation/image) | +3 |
| grading 결함 | 100 | **3** (data 결함만) | -97 |
| placeholder [?] | 252 | 73 (LEGACY 흡수) | -179 |
| LEGACY year-N hidden | 0 | 13 yearKey | +13 |
| marker render 결함 | 9 set | 0 | 정정 완료 |

---

## R4 인스타 sample (사용자 자료)

**2025학년도 수능 국어 14번** (가장 명확):
- 지문: "표면 연기는 형식에 집중 / 심층 연기는 내면의 솔직한 정서"
- 선지 ①: "심층 연기는 ... 형식에 집중하는 자기표현이다."
- R4 사유: '심층 연기' + '표면 연기' 두 개념을 짜깁기

---

## 변경 이력

- 2026-05-26 (오늘): W1 완료. FREE 100% release. 16건 commit 종결.
