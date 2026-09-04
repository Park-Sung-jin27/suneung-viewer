# PLAN-csless-anchor-recovery — 누락된 형광펜(cs_ids 없음+지문 근거 있음) 복구

> **우선순위: 3 / 5**
> 근거: 핵심 차별점 직격 — 선지가 `ok:false`(오답)인데 `cs_ids=[]`(형광펜 없음)이면서 해설의 📌 지문 근거가 본문에 실재하는 항목 80건(`W_csless_with_anchor`, 전부 LIVE). "왜 이 선지가 틀렸는지"를 지문에서 짚어주는 형광펜이 **있어야 하는데 비어 있음**.
> 라벨: [Confirmed] 실측(2026-07-07). 워크리스트 = `pipeline/output/csless_with_anchor.json`(80건, R3 대다수 · L3 일부).
> **선행 조건: PLAN-zerowidth-strip → PLAN-csspan-stale-fix 후.** (형광펜 텍스트 정합이 먼저 안정돼야 근거 정박이 깨지지 않음)

---

## 1. 목표 (완료 시 참인 상태)

각 항목의 선지에 대해, 해설 📌 근거에 해당하는 지문 문장의 `sentId` 를 `cs_ids` 에 채워 형광펜이 연결된다. **단, 진짜 근거가 없는 R3/L3(지문 밖 내용·전무한 내용)는 `cs_ids=[]` 유지가 정답**이므로 3분류 triage 로 판정한다(발주2 선례, current_state.md).

- 채울 수 있는 항목은 채워지고, cs=[] 가 정당한 항목은 사유가 명시된다.
- `W_csless_with_anchor` 가 **의미상 정리 완료**(채운 건 감소, 남은 건은 "정당한 cs=[]" 로 확인).

## 2. 수정해야 할 정확한 파일

| 파일                                                  | 변경 내용                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `data-source/all_data_204.json`                       | 대상 선지의 `cs_ids` 에 올바른 `sentId` 추가(또는 정당하면 무변경)               |
| (읽기 전용) `pipeline/output/csless_with_anchor.json` | 80건 목록                                                                        |
| (도구) `pipeline/cs_ids_recovery.mjs`                 | 후보 sentId 산출(read-only). `pipeline/cs_ids_apply.mjs` 로 적용(기본 --dry-run) |
| (읽기 전용) `_done/{yearKey}/{yearKey}_시험지.pdf`    | 근거 문장 원문 대조                                                              |

## 3. 단계별 작업 순서

**Step 0 — 목록 + 후보 산출**

```bash
cd <repo>; export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
git pull origin main
cat pipeline/output/csless_with_anchor.json | python3 -m json.tool | head -60
node pipeline/cs_ids_recovery.mjs        # read-only, 후보를 pipeline/output/cs_ids_candidates.json 에 산출
```

**Step 1 — 항목마다 3분류 triage(발주2 선례)**

각 (setId·qId·choice) 에 대해 해설(analysis)의 📌 근거 문장을 읽고:

| 분류                            | 조건                                                        | 조치                              |
| ------------------------------- | ----------------------------------------------------------- | --------------------------------- |
| **(a) 오태깅**                  | pat 자체가 틀림(예: R3인데 실은 R1)                         | pat 교정 + 근거 sentId 부여       |
| **(b) 정당한 근거 존재**        | 📌 근거가 지문 특정 문장을 실제로 가리킴                    | 그 sentId 를 cs_ids 에 부여       |
| **(c) 근거 없음(정당한 cs=[])** | R3(지문 밖)·L3(전무한 내용) 이라 왜곡 출처 문장이 원래 없음 | **cs=[] 유지**(무변경). 사유 기록 |

> 판정 기준: 해설이 "지문의 X 문장을 근거로 선지가 Y라서 틀렸다"고 특정 문장을 짚으면 (b). "지문에 아예 없는 내용을 지어냈다"면 (c). 애매하면 (c)로 보수적 처리 후 대표 확인 요청.

**Step 2 — (b)/(a) 항목에 cs_ids 부여**

`cs_ids_recovery.mjs` 후보 + 시험지 대조로 sentId 확정 후, git-object 우회 6단계(§13⑪)로 적용. `cs_ids_apply.mjs` 를 쓸 경우 반드시 `--dry-run` 으로 먼저 확인 → 결과 검토 → 실제 적용.

**Step 3 — 부여한 sentId 가 실재하는지 검증(DEAD_csid 방지)**

```bash
python3 - <<'PY'
import json
d=json.load(open('data-source/all_data_204.json',encoding='utf-8'))
sets=d if isinstance(d,list) else (d.get('sets') or list(d.values()))
for s in sets:
    ids={st['id'] for st in s.get('sents',[])}
    for q in s.get('questions',[]):
        for i,c in enumerate(q.get('choices',[]),1):
            for cid in c.get('cs_ids',[]):
                if cid not in ids: print('DEAD', s['id'],'Q',q['id'],'c',i,cid)
print('done')
PY
```

**Step 4 — 게이트 → 대표 승인 → push(분리)**

```bash
node pipeline/quality_gate.mjs --scope=release 2>&1 | grep -E "csless|DEAD_csid|CRITICAL"
```

## 4. 성능 낮은 모델이 놓칠 엣지 케이스

1. **모든 항목을 무작정 채우면 안 됨**: R3(지문 밖 내용)·L3의 상당수는 **cs=[] 가 정답**이다(§6 오답패턴). 근거가 없는데 억지로 sentId를 넣으면 형광펜이 엉뚱한 문장을 가리켜 오학습. (c) 분류를 정확히 골라내는 게 핵심.
2. **메타발문 정답 = R3 + cs=[] 유지**(§6·§13⑨): "답을 찾을 수 없는 질문은?" 류 정답 선지는 지문 무관이라 cs=[] 가 맞다. 채우지 말 것.
3. **존재하지 않는 sentId 부여(DEAD_csid)**: Step 3 검증 필수. sentId 포맷은 언더스코어 없음 `{setId}s{번호}`(§6).
4. **cs_ids 후보의 중복 sent**: `cs_ids_recovery.mjs` 는 `duplicate_sent_id` 를 flag 한다. 같은 텍스트가 여러 sent에 있으면 마커 인라인 위치(§13⑦)로 정박, text 검색 단독 금지.
5. **pat 도메인 위반**: 독서 세트에 L*, 문학 세트에 R* 부여 금지(§6). (a) 재분류 시 도메인 지킬 것.
6. **`cs_ids_apply.mjs` 를 --dry-run 없이 실행**: 기본이 dry-run이지만 플래그를 잘못 주면 바로 적용된다. 항상 dry-run 결과를 먼저 검토.
7. **80건을 한 커밋에**: 세트/연도 단위로 나눠 커밋(이슈 추적·롤백 용이). `git add .` 금지(fortune 등 무관 파일 혼입, §4).

## 5. 내가(대표) 직접 검증할 수 있는 완료 기준

```powershell
node pipeline/quality_gate.mjs --scope=release 2>&1 | Select-String "csless_with_anchor"
node pipeline/quality_gate.mjs --scope=release 2>&1 | Select-String "DEAD_csid"
```

→ `W_csless_with_anchor` 건수가 줄고(채운 만큼), `DEAD_csid` 는 **0건**이면 통과. 남은 csless 는 "정당한 cs=[]" 로 보고서에 사유 명시.

육안: 채운 세트의 오답 선지 클릭 → 지문에서 "왜 틀렸는지"를 짚는 형광펜이 표시되는지 확인.

**완료 판정 한 줄**: DEAD_csid 0 유지 + csless 80건이 (채움) / (정당한 cs=[] 확정) 으로 전량 분류 종결이면 이 계획 완료.
