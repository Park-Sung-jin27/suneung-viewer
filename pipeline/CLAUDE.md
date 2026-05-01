# CLAUDE.md — Code B (파이프라인)

> 갱신: 2026-04-16 | https://suneung-viewer.vercel.app

---

## 담당 영역

|      | Code B                                                                        |
| ---- | ----------------------------------------------------------------------------- |
| 담당 | `pipeline/*`, `public/data/all_data_204.json`, `public/data/annotations.json` |
| 금지 | `src/*.jsx` 수정                                                              |

**동시 push 절대 금지 / 작업 전 git pull 필수**

---

## 데이터 구조

```
단일 진실: public/data/all_data_204.json (9.5MB)
어노테이션: public/data/annotations.json

Choice: { num, t, ok, pat, analysis, cs_ids, cs_spans }
Sent:   { id, t, sentType, cs, csSpans }
sentId: {setId}s{번호}  예: r2026as1  ← 언더스코어 없음 (중요)
sentType: body | verse | workTag | author | footnote | omission | figure

cs_ids:  ["sentId"]           ← sent 단위 형광펜 (기존)
cs_spans: [{ sent_id, text }] ← span 단위 형광펜 (신규, 어구 기반)
```

---

## ok / pat / cs_ids 규칙

```
ok: true  = 지문 사실 일치 (발문 유형 무관)
ok: false = 지문 사실 불일치
pat: ok:false일 때만 R1~R4(독서) / L1~L5(문학) / V(어휘). ok:true면 null.

cs_ids:
  ok:true → 근거 문장 ID (예외 없음)
  ok:false + R1/R2/R4/L1/L2/L4/L5 → 왜곡 출처 문장 ID
  ok:false + R3 → [] (지문에 없는 내용)
  ok:false + V  → [] (어휘 문항)
  ok:false + L3 → 부분 일치 작품의 sentId

cs_spans:
  marker annotation이 있는 원문자 문항에서 자동 생성
  { sent_id: "l2026as8", text: "어설피 물랴다가" }
```

---

## 공개 가능 기준 (4개 모두 0 = release_ready)

```
1. ok:true cs_ids=[] → 0건
2. DEAD_csid → 0건
3. F_empty_analysis → 0건
4. ok:false + R1/R2/R4/L1/L2/L4/L5 + cs_ids=[] → 0건
```

---

## 형광펜 작동 구조

```
단일 진실값: choice.cs_ids + choice.cs_spans
sent.cs:     dataLoader._buildSentCs()가 런타임에 cs_ids로부터 생성하는 역참조
sent.csSpans: dataLoader._buildSentCs()가 런타임에 cs_spans로부터 생성

정적 sent.cs 개수는 품질 기준이 아님 (오해 금지)
```

---

## annotation 구조

```json
annotations.json:
{
  "2026수능": {
    "r2026b": [
      { "type": "underline", "sentId": "r2026bs5", "text": "고려하여" },
      { "type": "marker", "marker": "ⓐ", "sentId": "r2026bs5", "text": "고려하여" }
    ]
  }
}

type: box | underline | bracket | marker
marker 타입: { type, marker, sentId, text }
  → step4가 원문자 선지 처리 시 프롬프트 힌트로 사용
  → cs_spans 생성에 활용
```

---

## 성진님 annotation 입력 형식

```
세트 섹션 안에 원문자 + 어구 나열:
  ⓐ 고려하여 ⓑ 파기하고 ⓒ 성립하려면
  ㉠ 이는 주 채무자와 보증인 간에...

annotate.js가 자동으로:
  1. 원문자 파싱
  2. 해당 세트 sents에서 text.includes()로 sentId 탐색
  3. annotations.json에 marker 타입으로 저장
```

---

## 파이프라인 스크립트

| 스크립트                      | 역할                                     |
| ----------------------------- | ---------------------------------------- |
| `step3_analysis.js`           | 해설 생성 (판정 엔진 구조)               |
| `step4_csids.js`              | cs_ids + cs_spans 매핑                   |
| `annotate.js`                 | annotation draft 파싱 → annotations.json |
| `gen_annotation_template.cjs` | 세트별 annotation 입력 템플릿 생성       |
| `reanalyze_positive.mjs`      | 해설 재생성 (MAX_RETRY=2)                |
| `quality_gate.mjs`            | 품질 검사 단일 진입점                    |
| `fix_dead_csids.cjs`          | DEAD_csid 수정                           |

### 주요 명령어

```bash
# quality_gate
node pipeline/quality_gate.mjs
node pipeline/quality_gate.mjs --scope=suneung5
node pipeline/quality_gate.mjs --fix

# step4 재매핑
node pipeline/step4_csids.js --retarget 2026수능

# 해설 재생성
node pipeline/reanalyze_positive.mjs 2026수능

# annotation 템플릿 생성
node pipeline/gen_annotation_template.cjs 2026수능 s2

# annotation 적용
node pipeline/annotate.js 2026수능 --apply-draft
```

---

## 해설 품질 기준

```
ok:true 해설:
  - 금지 표현: 어긋나다, 왜곡, 잘못, 부적절, 맞지 않다
  - 지문 근거 + 직접 일치 + 왜 맞는지만
  - 결론: ✅ 이모지로 마무리

ok:false 해설:
  - 판정 근거 + 왜 틀렸는지
  - 결론: ❌ [패턴명] 으로 마무리

isReversed 판정: 결론 이모지(✅/❌) vs ok 값 일치 여부
```

---

## 연도키 규칙

```
수능·9월: key = 시행연도+1  →  2024년 9월 = "2025_9월"
6월:      key = 시행연도    →  2022년 6월 = "2022_6월"
```

---

## 절대 금지

```
- 일회성 패치 스크립트 생성
- node -e 인라인으로 품질 검증 (quality_gate만)
- 검증 안 된 수정을 main에 바로 반영
- src/*.jsx 수정
- Code A와 동시 push
- PowerShell && 체이닝 (→ ; 사용)
- all_data_204.json 20MB 제한 주의 (세트 필터링해서 처리)
```

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
