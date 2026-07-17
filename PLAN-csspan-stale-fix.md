# PLAN-csspan-stale-fix — 깨진 형광펜(cs_span stale/broken) 복구

> **우선순위: 2 / 5**
> 근거: 핵심 차별점(선지↔지문 형광펜 1:1)이 **LIVE에서 눈에 보이게 깨진** 결함. `W_csspan_stale` 47건 + `W_csspan_broken` 5건 = 52건, 대부분 `live:true`. 학생이 지금 부분 하이라이트 소실을 보고 있음.
> 라벨: [Confirmed] 실측(2026-07-07, `quality_gate.mjs --scope=release`). 워크리스트 = `pipeline/output/csspan_stale.json`.
> **선행 조건: PLAN-zerowidth-strip 먼저 실행.** 제로폭 제거로 일부 stale(cs_span.text ↔ sent.t 불일치 원인이 제로폭인 경우)가 자동 해소되므로, 그 후 게이트를 재실행해 남은 목록으로 작업한다.

---

## 1. 목표 (완료 시 참인 상태)

각 stale/broken cs_span 의 `text` 가 참조 sent 의 현재 `sent.t` 안에 **exact substring 으로 존재**하게 되어, 뷰어 렌더의 `indexOf` 가 성공하고 형광펜이 온전히 표시된다.

- `node pipeline/quality_gate.mjs --scope=release` 의 `W_csspan_stale` + `W_csspan_broken` 이 **0건**(또는 acceptable 사유 명시분만 잔존).
- LIVE 세트에서 해당 선지 클릭 시 지문 형광펜이 잘리지 않고 표시된다.

## 2. 수정해야 할 정확한 파일

| 파일                                               | 변경 내용                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `public/data/all_data_204.json`                    | 문제의 `cs_spans[].text`(및 필요 시 `analysis` 내 📌 근거 인용)를 현재 `sent.t` 와 일치하도록 교정 |
| (읽기 전용) `pipeline/output/csspan_stale.json`    | 대상 목록. yearKey·setId·qId·choice·sent_id·text·kind·live                                         |
| (읽기 전용) `_done/{yearKey}/{yearKey}_시험지.pdf` | 어느 쪽(sent.t 또는 cs_span.text)이 원문 정본인지 판정 근거                                        |

> **원칙(§13⑭ 3계층 동시 정합)**: 같은 어구가 `sent.t` · `cs_spans[].text` · `analysis`(📌 근거)에 **복사본**으로 저장돼 있다. stale = 셋 중 일부만 과거에 교정돼 불일치. **셋을 동시에 맞춘다.**

## 3. 단계별 작업 순서

**Step 0 — 최신 목록 확보 (zerowidth 작업 후)**

```bash
cd <repo>; export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
git pull origin main
node pipeline/quality_gate.mjs --scope=release > /tmp/gate.txt 2>&1
grep -E "csspan_stale|csspan_broken" /tmp/gate.txt      # 현재 건수 기록
cat pipeline/output/csspan_stale.json | python3 -m json.tool | head -80
```

**Step 1 — 세트 단위로 묶어 처리(세트당 커밋 1개 권장)**

`csspan_stale.json` 을 `setId` 로 그룹핑. 한 번에 **한 세트**만. 예: `l20259d` 의 Q32~33 항목들을 먼저.

**Step 2 — 각 항목마다 정본 판정**

문제의 항목 하나(yearKey·setId·sent_id·text)에 대해:

```bash
# 현재 데이터의 sent.t 와 cs_span.text 를 나란히 확인
git show HEAD:public/data/all_data_204.json > /tmp/all_data.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/all_data.json',encoding='utf-8'))
sets=d if isinstance(d,list) else (d.get('sets') or list(d.values()))
SET='l20259d'; SENT='l20259ds16'          # ← 대상으로 교체
for s in sets:
    if s.get('id')!=SET: continue
    for st in s.get('sents',[]):
        if st.get('id')==SENT: print('SENT.t =', repr(st['t']))
    for q in s.get('questions',[]):
        for i,c in enumerate(q.get('choices',[]),1):
            for sp in c.get('cs_spans',[]) if isinstance(c.get('cs_spans'),list) else []:
                if sp.get('sentId')==SENT or sp.get('sent_id')==SENT:
                    print(f'Q{q["id"]}c{i} cs_span.text =', repr(sp.get('text')))
PY
```

정본 판정 규칙:

- **시험지 PDF 원문과 일치하는 쪽이 정본.** `sent.t` 가 이미 시험지대로면 → `cs_span.text` 를 sent.t 안에 실제 존재하는 연속 부분문자열로 교정.
- 古語/마커/공백만 다른 경우가 대부분(현→헌, 곰 예→곰예, `한폭`→`한 폭` 등, current_state.md 워크리스트 참조).
- **cs_span.text 는 sent.t 의 연속 substring 이어야 한다**(말줄임표·요약·의역 금지, Gold 5원칙 5).

**Step 3 — git-object 우회 6단계로 교정(§13⑪)**

PLAN-zerowidth-strip Step 1~6 과 동일한 골격. 교정은 특정 문자열 치환:

```bash
python3 - <<'PY'
import json
d=json.load(open('/tmp/all_data.json',encoding='utf-8'))
sets=d if isinstance(d,list) else (d.get('sets') or list(d.values()))
# (setId, 옛text, 새text) 목록 — 한 세트 분만
FIX=[('l20259d','옛 cs_span text','새 cs_span text')]
for setId,old,new in FIX:
    hit=0
    for s in sets:
        if s.get('id')!=setId: continue
        def walk(o):
            global hit
            if isinstance(o,dict):
                for k,v in list(o.items()):
                    if isinstance(v,str) and old in v: o[k]=v.replace(old,new); hit+=1
                    else: walk(v)
            elif isinstance(o,list):
                for v in o: walk(v)
        walk(s)
    print(setId,'치환',hit,'회')   # cs_span.text + analysis 동시 치환됨
txt=json.dumps(d,ensure_ascii=False,indent=2); json.loads(txt)
open('/tmp/all_data.clean.json','w',encoding='utf-8').write(txt)
PY
```

**Step 4 — 옛 형태 set-전역 잔존 0 확인(§13⑭ 1차 방어)**

```bash
python3 -c "
import json
d=json.load(open('/tmp/all_data.clean.json',encoding='utf-8'))
raw=open('/tmp/all_data.clean.json',encoding='utf-8').read()
print('옛 형태 잔존:', raw.count('옛 cs_span text'))   # 0 이어야 함
"
```

**Step 5 — in-place 덮기 + readback + 게이트**

```bash
cat /tmp/all_data.clean.json > public/data/all_data_204.json
python3 -c "import json;json.load(open('public/data/all_data_204.json',encoding='utf-8'));print('JSON OK')"
node pipeline/quality_gate.mjs --scope=release 2>&1 | grep -E "csspan_stale|csspan_broken|CRITICAL"
```

**Step 6 — 게이트 확인 후 대표 승인 → push(gate↔push 분리)**

## 4. 성능 낮은 모델이 놓칠 엣지 케이스

1. **cs_span.text 를 sent.t 에 없는 문자열로 "고쳐" 새 stale 생성**: 교정한 cs_span.text 는 **반드시 교정 후 sent.t 안에 exact substring** 이어야 한다. 교체 후 `text in sent.t` 를 python으로 재확인하지 않으면 결함을 옮기기만 함.
2. **sent.t 를 건드려야 하는데 cs_span만 고침(또는 반대)**: 정본이 시험지인데 sent.t가 틀린 경우엔 sent.t를 고치고 cs_span·analysis도 같이. 어느 쪽이 원문인지 **시험지 PDF로 확정**하지 않고 추측 금지.
3. **운문(verse)·대사 세트의 짧은 행**: `l20259a`·`l20259d` 처럼 시조/판소리 행은 짧아서 1글자 차이도 substring 실패. 古語(§6, PDF 원문 그대로 — normalization 금지)를 현대어로 바꾸면 안 됨.
4. **마커 위치 오배치(l2023a class)**: annotations 밑줄은 맞는데 sent.t 인라인 마커(㉠~㉤)만 틀린 경우가 있다. 이때 cs_span text 매칭이 마커 때문에 깨진다 — 마커 위치를 시험지 인라인 기호 위치로 교정(§13⑦, text 검색 단독 금지).
5. **한 세트에 여러 항목 → 일괄 치환 시 의도치 않은 다중 매칭**: 짧은 문자열(`조석 어이 지내리`)이 여러 sent에 등장하면 전역 replace가 엉뚱한 곳도 바꾼다. 세트 범위로 한정하고, 치환 횟수(hit)를 기대값과 대조.
6. **broken(kind:'broken') 은 sentId 자체가 없는 경우**: `text` 교정이 아니라 `sentId` 를 올바른 sent로 재지정해야 할 수 있다. kind를 먼저 구분.
7. **push 를 같은 bash 체인에 넣지 말 것**(§13④): 게이트 결과 확인과 commit을 한 체인에 넣으면 CRITICAL 확인 전 push 위험.

## 5. 내가(대표) 직접 검증할 수 있는 완료 기준

```powershell
node pipeline/quality_gate.mjs --scope=release 2>&1 | Select-String "csspan"
```

→ `W_csspan_stale` / `W_csspan_broken` 이 **0건**(또는 남은 건은 acceptable 사유가 커밋 메시지/보고에 명시)이면 통과.

육안: 뷰어에서 교정한 세트(예 `l20259d`)의 해당 선지 클릭 → 지문 형광펜이 문장 끝까지 잘림 없이 칠해지는지 확인.

**완료 판정 한 줄**: release scope 게이트에서 csspan 계열 WARNING 이 52 → 0(또는 명시된 acceptable 잔존)이면 종결.
