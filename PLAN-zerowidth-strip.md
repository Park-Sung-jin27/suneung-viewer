# PLAN-zerowidth-strip — 제로폭 문자(U+200B) 일괄 제거

> **우선순위: 1 / 5 (가장 먼저)**
> 근거: 게이트 CRITICAL 87건 중 36건이 이 결함. 단일 일괄 작업으로 제거 가능(가장 적은 노력 → 가장 큰 결과). 눈에 안 보이는 문자라 형광펜(indexOf)·검색·verbatim 대조가 조용히 실패 중 = 핵심 차별점 직격.
> 라벨: [Confirmed] 실측(2026-07-07, `quality_gate.mjs --scope=release` = F_zerowidth_corruption 36건 / raw U+200B 161회).

---

## 1. 목표 (완료 시 참인 상태)

`data-source/all_data_204.json` 과 `public/data/annotations.json` 의 **모든 텍스트 필드에서 U+200B(ZWSP) 등 제로폭 문자가 0개**가 된다. 그 결과:

- `node pipeline/quality_gate.mjs --scope=release` 의 `F_zerowidth_corruption` 이 **0건**.
- 이 작업만으로 게이트 CRITICAL 이 **87 → 51**로 감소(나머지 51 = bracket, PLAN-bracket-annotations 소관).
- 형광펜이 조용히 깨져 있던 문학 고전 세트(예: `곰​예 받​고`)의 cs_span 하이라이트가 복구된다.

## 2. 수정해야 할 정확한 파일

| 파일                            | 변경 내용                                                         |
| ------------------------------- | ----------------------------------------------------------------- |
| `data-source/all_data_204.json` | 전 텍스트 필드에서 U+200B·U+200C·U+200D·U+FEFF·U+00AD·U+2060 제거 |
| `public/data/annotations.json`  | 동일                                                              |

> 게이트 코드(`pipeline/quality_gate.mjs` 859~895행)가 검출하는 문자 집합과 **정확히 동일한 6종**만 제거한다. 그 외 문자는 절대 건드리지 않는다.
> **파이프라인 본체(step2/step3)·게이트 코드는 이 작업에서 수정하지 않는다.** (데이터만 교정)

## 3. 단계별 작업 순서

CLAUDE.md §13⑪ "데이터 편집 = git-object 우회 6단계" 를 그대로 따른다. 임시 파일은 `/tmp` 에만 만든다(repo 루트에 스크립트 파일 생성 금지 — §5).

**Step 0 — 시작 전 스냅샷**

```bash
cd <repo>
export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
git status                     # working tree 확인
git pull origin main           # 최신화
node pipeline/quality_gate.mjs --scope=release 2>&1 | grep -E "CRITICAL|zerowidth"
# → 시작값 기록 (예: CRITICAL 87건, F_zerowidth_corruption 36건)
```

**Step 1 — HEAD 원본을 /tmp로 추출 (mount plain read 금지)**

```bash
git show HEAD:data-source/all_data_204.json > /tmp/all_data.json
git show HEAD:public/data/annotations.json > /tmp/annotations.json
```

**Step 2 — JSON 유효성 + 시작 개수 검증**

```bash
python3 - <<'PY'
import json
for p in ['/tmp/all_data.json','/tmp/annotations.json']:
    d=json.load(open(p,encoding='utf-8'))   # 파싱 실패하면 여기서 중단(손상본)
    raw=open(p,encoding='utf-8').read()
    n=sum(raw.count(c) for c in '​‌‍﻿­⁠')
    print(p,'제로폭',n,'개')
PY
```

**Step 3 — 제로폭 제거(문자열 치환) + 재검증 + byte delta 확인**

```bash
python3 - <<'PY'
import json,re
ZW=re.compile('[​‌‍﻿­⁠]')
def clean(o):
    if isinstance(o,str): return ZW.sub('',o)
    if isinstance(o,dict): return {k:clean(v) for k,v in o.items()}
    if isinstance(o,list): return [clean(v) for v in o]
    return o
for src,dst in [('/tmp/all_data.json','/tmp/all_data.clean.json'),
                ('/tmp/annotations.json','/tmp/annotations.clean.json')]:
    d=json.load(open(src,encoding='utf-8'))
    d2=clean(d)
    txt=json.dumps(d2,ensure_ascii=False,indent=2)
    json.loads(txt)                                   # 재파싱 검증
    left=sum(txt.count(c) for c in '​‌‍﻿­⁠')
    assert left==0, f'{dst} 제로폭 잔존 {left}'
    open(dst,'w',encoding='utf-8').write(txt)
    print(dst,'OK 제로폭 0, bytes',len(txt.encode()))
PY
```

> ⚠️ **들여쓰기 주의**: 위 코드는 `indent=2`로 다시 쓴다. 원본이 다른 들여쓰기(예: 압축 1줄)면 diff가 폭발한다. **Step 3 실행 전에 원본 포맷을 확인**한다:
> `head -c 200 /tmp/all_data.json` → 첫 줄이 `[` 후 개행+공백이면 indent=2 유지, 한 줄로 압축돼 있으면 `json.dumps(d2,ensure_ascii=False,separators=(',',':'))` 로 바꾼다. **포맷을 원본과 일치시켜야 순수 제로폭 제거 diff만 남는다.**

**Step 4 — in-place 덮어쓰기(mount는 unlink 불가 → redirect O_TRUNC)**

```bash
cat /tmp/all_data.clean.json > data-source/all_data_204.json
cat /tmp/annotations.clean.json > public/data/annotations.json
```

**Step 5 — readback 검증**

```bash
python3 -c "import json;[json.load(open(p,encoding='utf-8')) for p in ['data-source/all_data_204.json','public/data/annotations.json']];print('readback JSON OK')"
node pipeline/quality_gate.mjs --scope=release 2>&1 | grep -E "CRITICAL|zerowidth"
# → F_zerowidth_corruption 0건, CRITICAL 51건(감소) 확인
```

**Step 6 — 게이트 통과 확인 후에만(gate↔push 분리, §13④) 대표에게 보고**

```bash
git add data-source/all_data_204.json public/data/annotations.json
git cat-file -s :data-source/all_data_204.json    # staged blob 크기 확인(비정상 축소 아님)
git diff --cached --stat
```

> **push 는 대표 승인 후에만.** `data-source/all_data_204.json` commit+push 는 CLAUDE.md §2에서 대표 confirm 의무 영역. 커밋 메시지 예: `fix(zerowidth): U+200B 161회 일괄 제거 — F_zerowidth_corruption 36→0 [PLAN-zerowidth-strip]`

## 4. 성능 낮은 모델이 놓칠 엣지 케이스

1. **`git show|node` 파이프 stdin 청크 분할로 멀티바이트 손상**: 과거 인시던트(d85b6c4, U+FFFD 184건)의 원인. **절대 `git show ... | node -e` 로 스트림 처리하지 말 것.** 반드시 `> /tmp/파일` 로 저장 후 `readFileSync`/`open().read()` 로 읽는다.
2. **들여쓰기/포맷 불일치로 diff 폭발**: Step 3 경고 참조. 원본 포맷을 먼저 확인하지 않으면 10.7MB 전체가 diff로 잡혀 리뷰 불가 + merge 충돌 위험.
3. **U+200B만 있는 게 아님**: 실측은 U+200B뿐이지만, 게이트가 6종을 검출한다. **6종 전부 제거**해야 게이트가 0이 된다. 한 종만 지우면 잔존.
4. **cs_span·analysis의 복사본**: sent.t 안의 제로폭은 cs_span.text·analysis에도 복사돼 있을 수 있다. 위 스크립트는 **전 필드 재귀 제거**라 자동으로 3계층이 동시에 정리된다(§13⑭ 자동 충족). 필드를 골라서 지우면 안 된다 — 반드시 전체 재귀.
5. **정상 문자를 지우지 말 것**: 옛한글 첫가끝(ᄒᆞ 등)·겹낫표(『』)는 제로폭이 **아니다**. 정규식 문자 클래스에 정확히 6종만 넣는다. `\s`(모든 공백) 같은 광범위 매칭 금지.
6. **"크기 동일 = 미변경" 오판 금지**(§4 교훈): 제로폭 제거는 바이트가 줄지만 극소량이라 `diff --stat` 이 미미하게 보일 수 있다. 적용 여부는 **게이트 0 + grep 0** 으로만 판정.
7. **mount 파일 직접 read+write 금지**: 반드시 Step 1의 `git show HEAD` 로 /tmp에 추출한 원본을 기준으로 작업. mount의 대용량 JSON은 sync 중 truncate 위험(§13⑪).

## 5. 내가(대표) 직접 검증할 수 있는 완료 기준

PowerShell 에 아래를 붙여넣고 엔터. **세 줄 모두 "0" 이면 완료.**

```powershell
node pipeline/quality_gate.mjs --scope=release 2>&1 | Select-String "zerowidth"
```

→ 출력에 `F_zerowidth_corruption` 이 **없거나 0건**이면 통과.

추가 육안 확인(형광펜 복구): 뷰어에서 문학 고전 세트(제로폭이 있던 세트)를 열어 선지를 클릭 → 지문에 형광펜이 정상 표시되는지 본다.

**완료 판정 한 줄**: `--scope=release` 결과에서 CRITICAL 이 **87 → 51**로 줄고 zerowidth 항목이 사라졌으면 이 계획 종결.
