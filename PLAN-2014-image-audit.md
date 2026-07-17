# PLAN-2014-image-audit — 2014 이미지(스캔)본 LIVE 세트 전수 육안 감사

> **우선순위: 5 / 5**
> 근거: 대표가 2026-06-30 직접 승격 지정한 트랙. 2014 6월/9월 스캔본 세트는 `pdftotext` 추출이 0에 가까워 program-diff(exact-substring)·editdist 자동 검출이 **원천 불가**한 맹점. 다른 연도는 자동 typo 검출로 좁혔지만 이 세트들은 **페이지 전수 육안 렌더만이 유일한 검증법**. release 판정 버그로 "라이브 0 클린"이 거짓이었던 것과 같은 미검증 영역.
> 라벨: [Confirmed] 대표 지시(current_state.md 잔여발주 5번). [Inference] LIVE 여부는 Step 0에서 RELEASE_KEYS 로 확정 필요.
> **주의: 노력이 크고 완전 자동화 불가.** 자동으로 좁힐 수 없어 마지막 순위. 단, LIVE 오노출 리스크가 있어 방치 불가.

---

## 1. 목표 (완료 시 참인 상태)

LIVE(RELEASE_KEYS 포함) 2014 이미지본 세트의 **본문(sent.t)·선지(choices)·발문(q.t)** 이 시험지 PDF 원문과 1:1 일치함을 **페이지 렌더 육안 대조로 인증**한다. 발견된 오타·환각·누락은 교정.

- 대상 세트별로 "전수 육안 직독 완료(심사관 인증)" 기록이 남는다.
- 발견 결함 교정 후 answer_fidelity·passage_fidelity·structure_fidelity 3게이트 통과.

## 2. 대상 세트 (Step 0에서 확정)

release scope 게이트에 나타난 2014 세트: `2014_6월A`·`2014_6월B`·`2014_9월A`(·`2014수능A`는 별도 재구축 트랙 `docs/rebuild_2014_progress.md` 소관 — **중복 착수 금지**, Step 0에서 분리 확인).

> `2014수능A/B` 6세트는 이미 격리 후 재구축 완료·재출시 대기 상태다. 이 계획은 **여전히 LIVE인 2014 6월/9월 이미지본**만 대상.

## 3. 수정해야 할 정확한 파일

| 파일                                          | 변경 내용                                                 |
| --------------------------------------------- | --------------------------------------------------------- |
| `public/data/all_data_204.json`               | 육안 대조로 발견한 sent.t·choices·q.t 오타/누락/환각 교정 |
| (읽기 전용) `_done/2014_6월A/…_시험지.pdf` 등 | 스캔본 — fitz 고해상 렌더 후 육안                         |
| (읽기 전용) `_done/2014_*/…_정답.pdf`         | 텍스트본 — `pdftotext -layout` 로 정답 확정               |
| (참고) `docs/rebuild_2014_progress.md`        | 2014수능 재구축 트랙과 중복 방지                          |

## 4. 단계별 작업 순서

**Step 0 — LIVE 여부 + 재구축 트랙 분리 확정**

```bash
cd <repo>; export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
git pull origin main
# RELEASE_KEYS 에 실제 포함된 2014 세트만 대상(비노출/재구축은 제외)
grep -rn "2014" src/dataLoader.js | grep -iE "RELEASE_KEYS|RELEASE_SET_IDS" | head
node pipeline/quality_gate.mjs --scope=release 2>&1 | grep -E "^  🔴 2014"
```

**Step 1 — 세트 하나씩: 시험지 페이지 고해상 렌더**

```bash
python3 - <<'PY'
import fitz
doc=fitz.open('_done/2014_6월A/2014_6월A_시험지.pdf')
print('pages', doc.page_count)
for i in range(doc.page_count):
    pix=doc[i].get_pixmap(matrix=fitz.Matrix(3,3))   # 스캔본은 고배율 필요
    pix.save(f'/sessions/determined-amazing-goodall/mnt/outputs/2014_6A_p{i}.png')
print('saved')
PY
```

→ Read 로 각 PNG를 열어 해당 세트 range 의 지문·선지를 **한 글자씩** 데이터와 대조.

**Step 2 — 데이터와 병렬 비교**

```bash
python3 - <<'PY'
import json
d=json.load(open('public/data/all_data_204.json',encoding='utf-8'))
sets=d if isinstance(d,list) else (d.get('sets') or list(d.values()))
for s in sets:
    if s.get('id')!='r20146a': continue           # ← 대상 setId
    for st in s.get('sents',[]): print(st['id'], st['t'])
    for q in s.get('questions',[]):
        print('Q',q['id'],q['t'])
        for i,c in enumerate(q.get('choices',[]),1): print('  c',i,c['t'])
PY
```

→ 렌더 PNG(정본) vs 위 출력(데이터) 을 육안 대조. 불일치 기록.

**Step 3 — 정답표로 ok/정답 교차 확인**

```bash
PYTHONUTF8=1 pdftotext -layout _done/2014_6월A/2014_6월A_정답.pdf - | head -60
node pipeline/answer_fidelity.mjs 2>&1 | grep 2014     # 정답 불일치 잔존 확인
```

**Step 4 — 발견 결함 교정(git-object 우회 6단계, §13⑪)**

오타·누락·환각을 §13⑭(3계층 동시)·§6(古語 PDF 원문 그대로) 준수해 교정. 스캔본이라 큰 폭 재구축이 필요하면 `docs/rebuild_2014_progress.md` 절차 준용.

**Step 5 — 3게이트 통과 확인 → 대표 승인 → push(분리)**

```bash
node pipeline/answer_fidelity.mjs 2>&1 | tail -5
node pipeline/passage_fidelity.mjs 2>&1 | tail -5
node pipeline/structure_fidelity.mjs 2>&1 | tail -5
```

## 5. 성능 낮은 모델이 놓칠 엣지 케이스

1. **pdftotext 결과를 정본으로 착각**: 스캔본은 추출이 garbling(삐·뵈·긷 등 artifact) 되거나 0이다. **시각 렌더 PNG만 정본**(§13⑬). 텍스트 추출로 char-diff 자동확정 금지.
2. **`2014수능A/B` 재구축 트랙과 중복 착수**: 그 6세트는 이미 완료·재출시 대기(`docs/rebuild_2014_progress.md`). 건드리면 작업 충돌. Step 0에서 LIVE·재구축 분리 확정 필수.
3. **저배율 렌더로 글자 오독**: 스캔본은 `Matrix(3,3)` 이상 고배율 + 필요 시 좌/우 컬럼 crop. 저해상에서 획을 잘못 읽으면 없는 오타를 "교정"해 새 결함 생성.
4. **古語를 현대어로 normalization**: §6 절대 금지. 시험지 PDF의 古語(뎐·긔·좇 등)를 그대로. 의미변화(좋다↔좇다)만 필수 교정.
5. **image-only 라 자동 게이트가 "통과"로 오판**: passage_fidelity 는 추출 0이면 검사 자체를 못 한다(UNVERIFIABLE_OLDHANGUL 플래그 대상). 게이트 "통과"가 "검증됨"이 아님 — **육안 인증이 유일 신호**.
6. **출력 PNG repo 저장**: `/sessions/.../mnt/outputs/` 에만. 기존 파일 있으면 `rm -f` 먼저.
7. **범위가 커 한 세션에 다 하려다 truncation**: 세트 1개씩(§13⑪ 대용량 JSON 편집은 세트 범위·git-object 우회). 세션당 1~2세트 페이스.

## 6. 내가(대표) 직접 검증할 수 있는 완료 기준

```powershell
node pipeline/answer_fidelity.mjs 2>&1 | Select-String "2014"
node pipeline/passage_fidelity.mjs 2>&1 | Select-String "2014"
```

→ 2014 LIVE 세트에 대해 정답·본문 불일치가 남지 않고, **각 세트에 "전수 육안 직독 완료" 기록**이 커밋 메시지/보고에 남으면 통과.

육안: 뷰어에서 2014 6월/9월 세트를 열어 지문·선지가 시험지와 눈으로 일치하는지(깨진 글자·빈 지문 없음) 확인.

**완료 판정 한 줄**: 대상 2014 LIVE 세트 전수가 "육안 인증 완료 + 3게이트 통과" 상태면 이 계획 종결.
