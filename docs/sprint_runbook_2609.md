# 9월 모평 스프린트 런북 (2026-09-02 시행)

> 이 문서만 보고 순서대로 따라 하면 됩니다. 명령어는 그대로 복사해 쓰십시오.
> 작업 위치는 항상 `C:\Users\downf\jippi-bo` 입니다.
> 목표: 국어 8세트(독서 4 + 문학 4)를 「검수 중」으로 공개.

---

## step 0 — 파일 두기 (5분)

시험지와 정답표 PDF 를 이 이름 그대로 아래 폴더에 넣습니다.

```
C:\Users\downf\suneung-viewer\_done\2027_9월\2027_9월_시험지.pdf
C:\Users\downf\suneung-viewer\_done\2027_9월\2027_9월_정답.pdf
```

**이름이 다르면 도구가 못 찾습니다.** 폴더 이름과 파일 앞부분이 똑같아야 합니다(`2027_9월`).

> ⚠ **홀수형 단독 PDF** 를 넣으십시오. 여러 형이 합쳐진 합본(28쪽 이상)은 도구가 거부합니다.

---

## step 1 — 원본 검사 (1분 · 비용 0) ★ 가장 먼저

**이 검사를 통과하지 못하면 나머지를 진행할 수 없습니다.**

### 1-1. 세트 구간이 잡히는가

```bash
node pipeline/set_ranges.mjs 2027_9월
```

`세트 [1~3]`, `세트 [4~9]` 같은 줄이 나오면 정상입니다.
아무것도 안 나오면 → **step 1-2 로 가서 원인을 봅니다.**

### 1-2. 원문자가 살아 있는가

```bash
pdftotext -layout -enc UTF-8 "C:/Users/downf/suneung-viewer/_done/2027_9월/2027_9월_시험지.pdf" - | grep -c "㉠\|㉮\|ⓐ"
```

- **숫자가 100 이상** → 정상. step 2 로 갑니다.
- **숫자가 0 이거나 한 자리** → 🔴 **스캔본입니다. 여기서 멈추십시오.**
  이 파이프라인을 쓸 수 없습니다. 2014수능 A/B 가 실제로 그런 PDF 였습니다.
  대표께 보고하고 다른 판본을 구하거나 코덱스 경유로 전환합니다(사람이 하루 붙어야 합니다).

---

## step 2 — 정답표 읽기 (2분)

```bash
node pipeline/step1_answer.js "C:/Users/downf/suneung-viewer/_done/2027_9월/2027_9월_정답.pdf" 34 > pipeline/test_data/answer_2027_9월.json
```

끝나면 파일을 열어 **1번과 34번 정답이 실제 정답표와 같은지 눈으로 두 개만** 확인하십시오.

> ⚠ 34 는 「34번까지만」이라는 뜻입니다. 35번 이후는 선택과목이라 쓰지 않습니다.

---

## step 3 — 구조 뽑기 (3분 · 보통 비용 0)

```bash
node pipeline/step2_extract.js "C:/Users/downf/suneung-viewer/_done/2027_9월/2027_9월_시험지.pdf" 2027_9월 34 all > pipeline/test_data/step2_2027_9월.json
```

**끝에서 두 줄을 반드시 읽으십시오.**

| 나오는 줄 | 뜻 | 할 일 |
|---|---|---|
| `✅ 폴백 문항 0건` | 전 문항이 원본 그대로 나왔습니다 | 그대로 진행 |
| `🔴 폴백 문항 N건 — reading:Q8 …` | 그 문항만 AI 가 다시 읽었습니다 | **그 문항의 원문자(㉠ ⓐ)를 화면에서 확인**하십시오. 깨졌으면 손으로 고칩니다 |
| `🔴 전체 폴백` | 전 문항이 AI 판독입니다 | 🔴 **멈추고 보고.** 원문자가 대량 손실됩니다 |

`pdf-parse accepted` 가 독서·문학 각각 한 번씩 나오면 가장 좋은 상태입니다.

---

## step 4 — 해설 만들기 (45분 · 약 $6) ★ 가장 오래 걸립니다

```bash
node pipeline/step3_analysis.js pipeline/test_data/step2_2027_9월.json pipeline/test_data/answer_2027_9월.json > pipeline/test_data/step3_2027_9월.json
```

세트당 약 6분, 8세트면 45분쯤입니다. 중간에 멈추면 아래로 그 세트만 다시 돌립니다.

```bash
node pipeline/step3_analysis.js pipeline/test_data/step2_2027_9월.json pipeline/test_data/answer_2027_9월.json --retry r20279a
```

---

## step 5 — 형광펜 붙이기 (20분 · 약 $3)

```bash
node pipeline/step4_csids.js --retarget 2027_9월
```

---

## step 6 — 정답 교차검증 (15분 · 약 $2)

```bash
node pipeline/step5_verify.js pipeline/test_data/step4_2027_9월.json pipeline/test_data/answer_2027_9월.json > pipeline/test_data/step5_2027_9월.json
```

---

## step 7 — 데이터에 합치기 (2분 · 비용 0)

독서와 문학을 따로 넣습니다.

```bash
node pipeline/step6_merge.js pipeline/test_data/step5_2027_9월.json 2027_9월 reading
```

```bash
node pipeline/step6_merge.js pipeline/test_data/step5_2027_9월.json 2027_9월 literature
```

---

## step 8 — 게이트 6종 (10분 · 비용 0) ★ 공개 전 필수

### 8-1. 정답표 대조 — **틀리면 여기서 멈춥니다**

```bash
node pipeline/release_diag.mjs "2027_9월::r20279a" "2027_9월::r20279b" "2027_9월::r20279c" "2027_9월::r20279d" "2027_9월::l20279a" "2027_9월::l20279b" "2027_9월::l20279c" "2027_9월::l20279d"
```

`⑦ 문항형식` 줄에 **`정답 특정 실패 0`** 이 아니면 → 🔴 **공개 금지.** 그 문항을 고칩니다.

> 세트 id 는 step 3 산출물에서 확인하십시오. 보통 `r20279a`~`d`, `l20279a`~`d` 입니다.

### 8-2. 품질 게이트

```bash
node pipeline/quality_gate.mjs 2027_9월
```

**`CRITICAL … 0건`** 이어야 합니다.

### 8-3. 마커 감사 2종 — 신규 추출 세트 필수 (규칙 ⑪)

```bash
node pipeline/marker_ref_audit.mjs
```

```bash
node pipeline/stem_head_audit.mjs
```

`2027_9월` 이 목록에 나오면 → 그 세트의 마커가 깨진 것입니다. 원본과 대조해 고칩니다.

### 8-4. 사전 필터

```bash
node pipeline/batch_precheck.mjs "2027_9월::r20279a" "2027_9월::l20279a"
```

`표지·위반 보유 0` 이어야 합니다.

### 8-5. 분리 게이트

```bash
node pipeline/build_split.mjs --verify
```

**`누락 0`** 이어야 합니다.

### 8-6. bogi 눈으로 보기

`<보기>` 가 있는 문항 두세 개를 화면에서 열어 봅니다. 그림·표가 깨지지 않았는지만 봅니다.

---

## step 9 — 프론트에 넘기기

아래를 프론트 담당에게 전달합니다.

**`src/dataLoader.js` 의 `RELEASE_KEYS` 에 추가할 8줄:**

```
"2027_9월::r20279a",
"2027_9월::r20279b",
"2027_9월::r20279c",
"2027_9월::r20279d",
"2027_9월::l20279a",
"2027_9월::l20279b",
"2027_9월::l20279c",
"2027_9월::l20279d",
```

- **`RELEASED_KEYS` 에는 넣지 않습니다.** 그래야 「검수 중인 시험입니다」 배너가 뜹니다.
- `FREE_YEARS` 는 **이미 준비돼 있습니다**(F-38 로 `2027_9월` 추가됨). 손대지 않습니다.
- 엔지니어는 이 파일들을 직접 고치지 않습니다 — 프론트 발주 사항입니다.

---

## 전체 소요 요약

| 단계 | 소요 | 비용 |
|---|---|---|
| step 0~3 (파일·검사·정답표·구조) | ~10분 | $0 |
| step 4 해설 | **~45분** | ~$6 |
| step 5 형광펜 | ~20분 | ~$3 |
| step 6 교차검증 | ~15분 | ~$2 |
| step 7~8 병합·게이트 | ~12분 | $0 |
| **합계** | **약 1시간 45분** | **약 $11** |

72시간 안에 충분히 들어갑니다. 시간이 아니라 **중간에 멈추는 지점**을 잘 보는 것이 중요합니다.

---

## 멈춰야 하는 세 지점

1. **step 1-2** — 원문자가 0개면 스캔본. 이 파이프라인으로 못 합니다.
2. **step 3** — `🔴 전체 폴백` 이 뜨면 원문자가 대량 손실됩니다.
3. **step 8-1** — 정답이 하나라도 다르면 공개 금지. **틀린 정답 노출이 최악입니다.**

## 공개 후 남는 일

「검수 중」 배너를 떼려면 정식 4관문(gate0~gate3)과 대표 승인이 필요합니다.
승격 기록은 `pipeline/release_approval_records/QG-2027_9월-<setId>-release-approval.json` 으로 만듭니다.
