# PLAN-bracket-annotations — 구간 형광펜([A][B]…) bracket annotation 복구

> **우선순위: 4 / 5**
> 근거: 게이트 CRITICAL 의 나머지 절반 = `MARKER_INTEGRITY_FAIL` 51건 = **bracket([A]~[F]) 백로그**. 문항/선지가 "[A]에 대한 설명으로…" 처럼 지문 구간을 가리키는데, 그 구간을 표시할 bracket annotation 이 `annotations.json` 에 없어 형광펜이 안 뜬다. PLAN-zerowidth-strip 과 이 계획을 합치면 **CRITICAL → 0 = release_ready**(§13⑩ 단일 신호).
> 라벨: [Confirmed] 실측(2026-07-07). 명세 = `pipeline/output/marker_integrity_78_triage.md`. 대표 기결정으로 일부 defer 상태였으나, CRITICAL 0 달성을 위해 승격.
> **주의: 이 작업은 시험지 PDF 페이지 육안 대조가 필요해 노력이 가장 큼.** 앞 3개(zerowidth·csspan·csless)를 먼저 끝낸 뒤 착수.

---

## 1. 목표 (완료 시 참인 상태)

문항/선지가 참조하는 각 `[A]`~`[F]` 라벨에 대해, 지문의 해당 구간을 덮는 bracket annotation 이 `annotations.json` 에 존재해 형광펜이 표시된다.

- `node pipeline/quality_gate.mjs --scope=release` 의 `MARKER_INTEGRITY_FAIL` 이 **0건**.
- (zerowidth 완료 전제 시) 게이트 **CRITICAL 0 = release_blocked 해제**.

## 2. 대상 세트 (실측, release scope 51건 = 라벨 전개)

세트 단위 약 12개:

- `l20156a` [A][B][C][D][E] (2015_6월A)
- `l20156b` [A][B] (2015_6월A·B 양쪽)
- `l20156c` [A][B][C]
- `l20156d` [A][B][C][D]
- `l20149a` [A][B] (2014_9월A)
- `l20166d` [A] (2016_6월A)
- `l20166a` [A] (2016_6월B)
- 그 외 triage 문서의 [A][B] 8세트 + [A]~E 문학 5세트(`l20156a`·`l20166a`·`l2016e`·`l2016bB`·`l2019a`)

> 정확한 현재 목록은 Step 0 에서 게이트로 재추출한다(작업 진행에 따라 감소).

## 3. 수정해야 할 정확한 파일

| 파일                                                                               | 변경 내용                                                         |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `public/data/annotations.json`                                                     | 각 세트에 `type:"bracket"` annotation 추가(라벨·구간 sentId 범위) |
| (읽기 전용) `_done/{yearKey}/{yearKey}_시험지.pdf`                                 | [A] 괄호가 지문의 어느 문장부터 어느 문장까지인지 **육안 확정**   |
| (참고) `docs/annotation_paste_format.md` · `docs/annotation_reference_contract.md` | bracket annotation 스키마 정본                                    |
| (참고) `pipeline/output/marker_integrity_78_triage.md`                             | 유형 분류(진짜 body / 보기·학습활동 FP)                           |

> **step2/step3 본체·게이트 코드는 수정하지 않는다.** annotations.json 데이터만 추가.

## 4. 단계별 작업 순서

**Step 0 — 현재 목록 + 스키마 확인**

```bash
cd <repo>; export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
git pull origin main
node pipeline/quality_gate.mjs --scope=release 2>&1 | grep -E "\[[A-F]\]:" | sed -E 's/ 문항.*//' | sort -u
# annotations.json 에서 기존 bracket 예시 1개를 읽어 스키마 복제
python3 -c "
import json
a=json.load(open('public/data/annotations.json',encoding='utf-8'))
# 기존 bracket 항목 한 개 출력(스키마 참고)
import itertools
def find(o):
    if isinstance(o,dict):
        if o.get('type')=='bracket': return o
        for v in o.values():
            r=find(v)
            if r: return r
    elif isinstance(o,list):
        for v in o:
            r=find(v)
            if r: return r
print(json.dumps(find(a),ensure_ascii=False,indent=2))
"
```

**Step 1 — 유형 분류로 진짜/FP 가려내기(triage 문서 §2 기준)**

- **진짜 body bracket**: 지문 안에 [A] 구간이 실재 → annotation 추가 대상.
- **FP(보기/학습활동 누락)**: [A]가 `<보기>`·학습활동 표 안에 있으면 body annotation 금지 → 별도 "보기 구조 복원" 큐(이 계획 범위 밖, 표시만).

**Step 2 — 세트 하나씩: 시험지 PDF 렌더 → [A] 구간 육안 확정**

스캔/텍스트 세트 공통으로, [A] 괄호는 지문 페이지에 있다. current_state.md 인계에 따르면 [A]가 문항 앞 지문 페이지에 위치하고 작품명 anchor가 PUA/옛한글이라 자동 위치 실패 → **수동 페이지 식별**:

```bash
# 예: l20156a 지문 페이지 렌더(출력은 /sessions/.../mnt/outputs/ 에만)
python3 - <<'PY'
import fitz
doc=fitz.open('_done/2015_6월A/2015_6월A_시험지.pdf')
for i in [8,9,10,11]:                       # 문학 지문 페이지 근처, 1~2장씩 확인
    pix=doc[i].get_pixmap(matrix=fitz.Matrix(2,2))
    pix.save(f'/sessions/determined-amazing-goodall/mnt/outputs/l20156a_p{i}.png')
print('saved')
PY
```

→ Read 로 PNG를 열어 [A]…[/A] 또는 [A] 시작 괄호가 지문의 **어느 문장(sentId)부터 어느 문장까지**인지 육안 확정.

**Step 3 — bracket annotation 추가(git-object 우회 6단계)**

`git show HEAD:public/data/annotations.json > /tmp/ann.json` → 파싱 → 해당 세트에 bracket 항목 추가(Step 0에서 뽑은 스키마 그대로: 세트키·label·시작/끝 sentId 등) → 재파싱 검증 → in-place 덮기 → readback.

**Step 4 — 게이트로 해당 세트 라벨 소거 확인**

```bash
node pipeline/quality_gate.mjs --scope=release 2>&1 | grep "l20156a"    # 대상 세트 라벨이 사라졌는지
```

**Step 5 — 세트별 커밋 → 대표 승인 → push(gate↔push 분리)**

## 5. 성능 낮은 모델이 놓칠 엣지 케이스

1. **[A]가 `<보기>`·학습활동 안인데 body에 annotation 추가**: triage 문서 §2 유형 C(FP). 예: `r20199a` ㉮는 보기 CDS 다이어그램, `l20149a` ⓐ~ⓔ는 학습활동 표. **body 구간으로 정박하면 오답**. 시험지에서 [A]가 지문 본문인지 보기인지 먼저 확인.
2. **구간 범위 오판(isMultiSentRange)**: [A]가 여러 문장에 걸치면 시작~끝 sentId를 정확히. 한 문장만 덮으면 형광펜이 잘리고, 넘치면 무관 문장까지 칠해진다.
3. **작품명/괄호 텍스트가 지문에 여러 번 등장**: text 검색으로 위치 잡지 말 것(§13⑦). 시험지 페이지의 실제 [A] 괄호 위치를 육안으로 확정.
4. **PUA·옛한글로 anchor 자동 매칭 실패**: 자동 도구가 못 잡는 게 정상. 수동 페이지 식별이 이 백로그가 남아 있던 이유. 자동 결과를 맹신 말 것.
5. **annotations.json 스키마 오작성**: 반드시 Step 0에서 뽑은 **기존 bracket 항목을 복제**해 필드명을 맞춘다. 임의 필드명 지어내기 금지. `docs/annotation_reference_contract.md` 정본 준수.
6. **출력 PNG를 repo 경로에 저장**: 권한 오류 + repo 오염. 반드시 `/sessions/.../mnt/outputs/` 에만. 작업 후 불필요하면 정리.
7. **CRITICAL 0 를 넘겨짚어 push**: bracket을 다 채웠어도 zerowidth가 안 끝났으면 CRITICAL≠0. 게이트 실측으로만 판정, push는 대표 승인.

## 6. 내가(대표) 직접 검증할 수 있는 완료 기준

```powershell
node pipeline/quality_gate.mjs --scope=release 2>&1 | Select-String "MARKER_INTEGRITY_FAIL"
node pipeline/quality_gate.mjs --scope=release 2>&1 | Select-String "CRITICAL"
```

→ `MARKER_INTEGRITY_FAIL` **0건**, (zerowidth 완료 시) **CRITICAL 0건 → release_blocked 해제**면 통과.

육안: 각 세트에서 "[A]에 대한 설명으로…" 문항을 열어 지문의 [A] 구간에 형광펜/괄호 표시가 뜨는지 확인.

**완료 판정 한 줄**: release scope 게이트에서 MARKER_INTEGRITY_FAIL 이 51 → 0 이면 이 계획 완료(그리고 zerowidth와 합쳐 CRITICAL 0 달성).
