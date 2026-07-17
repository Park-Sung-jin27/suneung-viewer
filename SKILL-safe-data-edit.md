---
name: safe-data-edit
description: >
  suneung-viewer의 대용량 정본 JSON(public/data/all_data_204.json ·
  public/data/annotations.json)을 손상 없이 안전하게 편집한다. 해설·cs_ids·cs_span·
  pat·본문(sent.t)·마커·괄호를 고칠 때 항상 사용. git-object 우회 6단계 + 3계층 동시
  정합 + 인코딩/제로폭 0 검증 + 게이트↔push 분리를 강제한다. 트리거: "데이터 고쳐",
  "해설 수정", "cs 정박", "형광펜 교정", "본문 직독 교정", "all_data 편집", "annotation 추가".
---

# safe-data-edit — 정본 JSON 안전 편집 스킬

## 언제 쓰나

`public/data/all_data_204.json`(~10.7MB) 또는 `public/data/annotations.json` 의
어떤 필드든 고칠 때. 이 파일들은 mount 동기화 중 **truncate** 되거나, `git show|node`
stdin 파이프에서 **멀티바이트 문자가 쪼개져** 손상된 전례가 있다(U+FFFD 184건 인시던트).
이 스킬은 그 재발을 막는 고정 절차다.

## 절대 규칙 (건너뛰면 손상)

1. **mount 파일을 직접 read+write 하지 않는다.** 원본은 항상 `git show HEAD:<path>` 로 `/tmp` 에 추출한다.
2. **`git show ... | node -e` / `| python` 스트림 파이프 금지.** 반드시 `> /tmp/파일` 저장 후 `readFileSync`/`open().read()`.
3. **3계층 동시 정합**: 같은 어구가 `sent.t` · `cs_spans[].text` · `analysis`(📌 근거)에 복사본으로 있다. 하나만 고치면 형광펜이 깨진다. 세트 전역 grep 후 셋을 동시에 치환.
4. **repo 루트에 임시 스크립트 파일 생성 금지.** 샌드박스는 mount 파일을 unlink 못 해 사용자가 수동 삭제해야 한다. 코드는 `/tmp` 또는 heredoc(비저장)으로만.
5. **게이트 확인과 push 를 같은 bash 체인에 넣지 않는다.** 게이트 CRITICAL 0 확인 → 별도 단계로 대표 승인 → push.
6. **`public/data/*` push 는 대표 승인 의무.** 스킬은 커밋 직전까지만 수행하고 멈춘다.

## 절차 (6단계)

### Step 1 — 원본 추출

```bash
cd <repo>; export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
git pull origin main
git show HEAD:public/data/all_data_204.json > /tmp/all_data.json
head -c 120 /tmp/all_data.json          # 들여쓰기 포맷 확인(indent=2 vs 압축)
```

### Step 2 — 파싱·시작값 검증

```bash
python3 -c "import json;json.load(open('/tmp/all_data.json',encoding='utf-8'));print('parse OK')"
```

파싱 실패 = 손상본을 잡은 것 → 중단하고 재추출.

### Step 3 — 교정 (세트 범위 한정 + 3계층 동시 치환)

```bash
python3 - <<'PY'
import json
d=json.load(open('/tmp/all_data.json',encoding='utf-8'))
sets=d if isinstance(d,list) else (d.get('sets') or list(d.values()))
SETID='<setId>'; OLD='<옛 문자열>'; NEW='<새 문자열>'
hit=0
for s in sets:
    if s.get('id')!=SETID: continue
    def walk(o):
        global hit
        if isinstance(o,dict):
            for k,v in list(o.items()):
                if isinstance(v,str) and OLD in v: o[k]=v.replace(OLD,NEW); hit+=1
                else: walk(v)
        elif isinstance(o,list):
            for v in o: walk(v)
    walk(s)
print('치환',hit,'회 (sent.t+cs_span+analysis 동시)')
txt=json.dumps(d,ensure_ascii=False,indent=2)   # 원본이 압축이면 separators=(',',':')
json.loads(txt)
open('/tmp/all_data.clean.json','w',encoding='utf-8').write(txt)
PY
```

### Step 4 — 무결성 재검증 (옛형태 잔존 0 · 제로폭 0 · U+FFFD 0)

```bash
python3 - <<'PY'
raw=open('/tmp/all_data.clean.json',encoding='utf-8').read()
assert raw.count('<옛 문자열>')==0, '옛 형태 잔존'
assert sum(raw.count(c) for c in '​‌‍﻿­⁠')==0, '제로폭 잔존'
assert raw.count('�')==0, 'U+FFFD 손상'
print('무결성 OK')
PY
```

cs_span 교정이면 추가로: 교정한 `cs_span.text` 가 교정 후 `sent.t` 안에 exact substring 인지 python `in` 으로 확인.

### Step 5 — in-place 덮기 + readback

```bash
cat /tmp/all_data.clean.json > public/data/all_data_204.json
python3 -c "import json;json.load(open('public/data/all_data_204.json',encoding='utf-8'));print('readback OK')"
```

### Step 6 — 게이트 (push 전, 별도 단계)

```bash
node pipeline/quality_gate.mjs --scope=release 2>&1 | grep -E "CRITICAL|<관련 게이트>"
git add public/data/all_data_204.json
git cat-file -s :public/data/all_data_204.json     # staged blob 크기 정상 확인
```

→ CRITICAL 확인 후 **여기서 멈추고 대표에게 보고**. push 는 대표 승인 후.

## 엣지 케이스 체크리스트

- [ ] 짧은 문자열 전역 치환이 엉뚱한 세트/문장을 바꾸지 않았나(hit 수를 기대값과 대조)?
- [ ] 古語(뎐·긔·좇)를 현대어로 normalization 하지 않았나(§6, PDF 원문 그대로)?
- [ ] 부여한 sentId 가 실재하나(DEAD_csid 방지)?
- [ ] 독서에 L*, 문학에 R* pat 을 넣지 않았나(도메인)?
- [ ] 들여쓰기 포맷을 원본과 일치시켜 diff 폭발을 막았나?
- [ ] "크기 동일 = 미변경" 으로 착각하지 않고 내용 grep 으로 적용 판정했나?

## 완료 신호

`quality_gate.mjs --scope=release` CRITICAL 이 목표대로 감소 + 무결성 3종(옛형태·제로폭·U+FFFD) 0 + readback JSON 유효 → 대표 승인 대기.
