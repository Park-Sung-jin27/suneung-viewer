# d205_underline_probe.py — 지면의 마커 밑줄을 읽어 annotations 항목을 만든다 (발주 D-205)
#
# 왜 필요한가: 마커를 가진 LIVE 세트 230개 중 33개가 「구간·박스 주석은 있는데 마커
#   밑줄만 없는」 상태다. 지면 표본 6건 전건에서 밑줄이 실재했으므로 조판 관례가
#   아니라 누락이다. 어느 어구에 긋는지는 추정하지 않고 지면에서 읽는다.
#
# ★ 글리프를 눈으로 보지 않는다(§13⑬). PDF 의 그리기 연산에서 가로선을 뽑아
#   좌표로만 판정한다.
#
# ★ 산출 타입은 marker 다 (underline 아님) — 심사관 전수 실측으로 확정.
#     type:"marker"                 90건 — text 에 원문자 포함 0건(0%). 예외 없는 정본
#     type:"underline"+marker      469건 — 199건(42%) 포함. 규칙이 아니라 누적된 편차
#   PassagePanel.jsx:275~284 가 marker 형을 <sup>㉠</sup> + <span 밑줄>어구</span> 로
#   그린다. **원문자는 밑줄 밖 위첨자**이고 지면도 그렇다. 그래서 text 에서 원문자를 뺀다.
#
# 판정식 (심사관 승인)
#   선 검출 : 마커 뒤 어구의 x0 부근(-4~+14pt)에서 시작하고 그 줄 baseline 아래
#             0~7pt 에 놓인 가로선. 음성 대조 10/10(마커 없는 줄머리)로 확인했다.
#   다중 줄 : 선의 오른쪽 끝이 그 줄 글자의 최대 x 에서 12pt 이내면 다음 줄로 잇는다.
#   글자 포집: **글자 중심 x 가 밑줄 구간 안이면 포함** — 낱글자 기준(rawdict).
#             어절(words) 기준으로 하면 한국어 조사가 통째로 딸려와 과포집이 난다
#             (「㉠생산학파의」 — 밑줄은 「생산학파」만 덮는데 조사까지 들어왔다).
#   어구 확정: 포집 문자열을 정규화해 sents 에서 찾고, **원문 그대로 잘라낸다.**
#             정규화는 대조에만 쓴다 — annotations 에 넣는 text 가 PDF 표기면
#             프론트가 sents 에서 못 찾아 밑줄이 안 그어진다.
#             같은 문장에 두 곳 이상 일치하면 보류(엉뚱한 자리에 그을 수 있다).
#   정확도  : 문자열 폭과 밑줄 폭의 차이를 **양방향**으로 잰다. 과포집만 보면
#             글자 단위로 좁힌 뒤 첫·끝 글자가 빠지는 과소포집을 놓친다(규정 ⑫).
#
# 사용: python pipeline/d205_underline_probe.py [--limit N] [--json 출력경로]
import fitz, json, re, io, sys, os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace("\\", "/") + "/"
MARKS = "㉠㉡㉢㉣㉤ⓐⓑⓒⓓⓔ"
CHAR_W = 12.0          # 본문 한 글자 폭(pt) — 허용 오차의 단위
LIMIT = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 10**9
JSON_OUT = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None

QMAP = {"‘": "'", "’": "'", "“": '"', "”": '"'}
def norm(s):
    return "".join(QMAP.get(c, c) for c in s if not c.isspace())

def norm_map(s):
    flat, idx = [], []
    for i, c in enumerate(s):
        if c.isspace():
            continue
        flat.append(QMAP.get(c, c)); idx.append(i)
    return "".join(flat), idx

def hlines(pg):
    out = []
    for d in pg.get_drawings():
        for it in d["items"]:
            if it[0] == "l":
                p0, p1 = it[1], it[2]
                if abs(p0.y - p1.y) <= 1.5 and abs(p1.x - p0.x) >= 5:
                    out.append((min(p0.x, p1.x), max(p0.x, p1.x), (p0.y + p1.y) / 2))
            elif it[0] == "re":
                r = it[1]
                if r.height <= 2.5 and r.width >= 5:
                    out.append((r.x0, r.x1, (r.y0 + r.y1) / 2))
    return out

_raw = {}
def chars_of(pg, key):
    """페이지의 낱글자 목록 (x0, x1, ycenter, 글자) — 한 번만 뽑아 쓴다"""
    if key not in _raw:
        out = []
        for b in pg.get_text("rawdict")["blocks"]:
            for ln in b.get("lines", []):
                for sp in ln.get("spans", []):
                    for ch in sp.get("chars", []):
                        x0, y0, x1, y1 = ch["bbox"]
                        out.append((x0, x1, (y0 + y1) / 2, ch["c"]))
        _raw[key] = sorted(out)
    return _raw[key]

def words_on_line(pg, ybase, tol=7):
    return sorted([w for w in pg.get_text("words") if abs((w[1] + w[3]) / 2 - (ybase - 6)) <= tol],
                  key=lambda w: w[0])

def collect(pg, key, x0, x1, ybase, tol=7):
    """밑줄 구간에 **낱글자 중심이 든** 것만 모은다 — 비율 임계 없음"""
    got = [c for c in chars_of(pg, key)
           if abs(c[2] - (ybase - 6)) <= tol and x0 <= (c[0] + c[1]) / 2 <= x1]
    if not got:
        return "", None
    return "".join(c[3] for c in got), (min(c[0] for c in got), max(c[1] for c in got))

# ── 데이터 ────────────────────────────────────────────────────────────────
data = json.load(open(R + "data-source/all_data_204.json", encoding="utf-8"))
ann = json.load(open(R + "public/data/annotations.json", encoding="utf-8"))
dl = open(R + "src/dataLoader.js", encoding="utf-8").read()
at = dl.index("const RELEASE_KEYS = new Set([")
REL = set(re.findall(r'"([^"]+)"', dl[at:dl.index("]);", at)]))

targets = []
for yk, v in data.items():
    for sec in ("reading", "literature"):
        for s in v.get(sec, []):
            sid = s.get("setId") or s.get("id"); key = f"{yk}::{sid}"
            if key not in REL:
                continue
            mk = {c for x in s.get("sents", []) for c in str(x.get("t", "")) if c in MARKS}
            if not mk:
                continue
            L = ann.get(yk, {}).get(sid, [])
            ul = [a for a in L if a.get("type") == "underline"]
            if ul or not L or any(a.get("type") == "marker" for a in L):
                continue
            targets.append((yk, sid, sorted(mk), s))

docs = {}
def doc_of(yk):
    if yk not in docs:
        p = f"{R}_done/{yk}/{yk}_시험지.pdf"
        docs[yk] = fitz.open(p) if os.path.exists(p) else None
    return docs[yk]

rows, holds, no_pdf = [], [], []
for yk, sid, mks, st in targets[:LIMIT]:
    doc = doc_of(yk)
    if doc is None:
        no_pdf.append(f"{yk}::{sid}"); continue
    sents = [(str(x.get("id", "")), str(x.get("t", ""))) for x in st.get("sents", [])]
    for mk in mks:
        src = next(((i, t) for i, t in sents if mk in t), None)
        if not src:
            continue
        sid_s, stext = src
        needle = stext[stext.index(mk) + 1:][:8].strip()
        if len(norm(needle)) < 4:
            holds.append(dict(key=f"{yk}::{sid}", marker=mk, why="마커 뒤 어구가 4자 미만")); continue
        # 같은 어구가 지문·선지에 여러 번 나온다. 첫 결과만 보면 엉뚱한 위치를 잡는다
        #   (2026_6월 r20266d 실측). 후보를 전부 훑어 **밑줄이 실제로 걸리는 자리**를 고른다.
        pno = pg = r = seg = L = None
        nhit = 0
        for _p in range(len(doc)):
            _pg = doc[_p]
            cands = _pg.search_for(needle)
            if not cands:
                continue
            nhit += len(cands)
            _L = hlines(_pg)
            for _r in cands:
                _s = next(((a, b, y) for a, b, y in _L
                           if _r.y1 - 1 <= y <= _r.y1 + 7 and _r.x0 - 4 <= a <= _r.x0 + 14), None)
                if _s:
                    pno, pg, r, seg, L = _p, _pg, _r, _s, _L
                    break
            if seg:
                break
        if not nhit:
            holds.append(dict(key=f"{yk}::{sid}", marker=mk, why="지면에서 어구를 못 찾음")); continue
        if not seg:
            holds.append(dict(key=f"{yk}::{sid}", marker=mk, why=f"밑줄 선 없음 (어구 후보 {nhit}곳)")); continue
        pkey = (yk, pno)
        segs, (x0, x1, y) = [seg], seg
        for _ in range(6):
            right = max((w[2] for w in words_on_line(pg, y)), default=x1)
            if x1 < right - 12:
                break
            nxt = next(((a, b, ay) for a, b, ay in sorted(L, key=lambda t: t[2])
                        if y + 8 <= ay <= y + 30
                        and a <= min((w[0] for w in words_on_line(pg, ay)), default=1e9) + 14), None)
            if not nxt:
                break
            segs.append(nxt); x0, x1, y = nxt
        parts, dmax = [], 0.0
        for a, b, yy in segs:
            t, sp = collect(pg, pkey, a, b, yy)
            if not t:
                continue
            parts.append(t)
            dmax = max(dmax, abs((sp[1] - sp[0]) - (b - a)))
        raw = "".join(parts)
        # ★ 원문자는 밑줄 밖 위첨자다 — text 에서 뺀다(marker 형 정본, 90/90).
        body = raw.lstrip(MARKS + " ")
        if not body:
            holds.append(dict(key=f"{yk}::{sid}", marker=mk, why="구간에 글자 없음")); continue
        nq = norm(body)
        # ★ 대조는 **마커가 박힌 그 문장 하나**로 한정한다.
        #   밑줄은 마커 바로 뒤에 그어지므로 그 문장 안에 있어야 한다(문장 넘김 0건이
        #   이를 뒷받침한다). 세트 전체를 훑어 세면 다른 문장의 같은 어구까지 세어
        #   「위치 불특정」 보류가 무더기로 난다 — 실측 23건이 전부 그 오판이었다.
        flat, idx = norm_map(stext)
        k = flat.find(nq)
        if k < 0:
            holds.append(dict(key=f"{yk}::{sid}", marker=mk, why=f"마커 문장에 없음: {body[:30]!r}")); continue
        if flat.count(nq) > 1:
            holds.append(dict(key=f"{yk}::{sid}", marker=mk, why=f"그 문장 안 {flat.count(nq)}곳 일치 — 위치 불특정")); continue
        cut, owner = stext[idx[k]: idx[k + len(nq) - 1] + 1], sid_s
        rows.append(dict(key=f"{yk}::{sid}", yk=yk, sid=sid, type="marker", marker=mk,
                         sentId=owner, text=cut, lines=len(segs), page=pno + 1,
                         delta=round(dmax, 1), cross=(owner != sid_s)))

rows.sort(key=lambda r: (-r["lines"], r["key"], r["marker"]))
ok = [r for r in rows if r["delta"] <= CHAR_W]
print(f"# 마커 밑줄 판독 — 대상 {len(targets)}세트\n")
print(f"- 확정 **{len(rows)}건** · 보류 {len(holds)}건" + (f" · PDF 없음 {len(no_pdf)}" if no_pdf else ""))
print(f"- 다중 줄 {len([r for r in rows if r['lines'] >= 2])}건 · 문장 넘김 {len([r for r in rows if r['cross']])}건")
print(f"- **폭 오차 ≤1글자({CHAR_W}pt): {len(ok)}/{len(rows)}** · 최대 {max([r['delta'] for r in rows], default=0)}pt\n")
print("| 세트 | 마커 | 줄 | p | sentId | text (원문자 제외) | 오차 |")
print("|---|---|--:|--:|---|---|--:|")
for r in rows:
    print(f"| `{r['key']}` | {r['marker']} | {r['lines']} | {r['page']} | `{r['sentId']}` | {r['text'][:36]!r} | {r['delta']} |")
if holds:
    print(f"\n## 보류 {len(holds)}건")
    for h in holds:
        print(f"- `{h['key']}` {h['marker']} — {h['why']}")
if no_pdf:
    print(f"\n## 원본 PDF 없음 — {', '.join(no_pdf)}")
if JSON_OUT:
    json.dump({"rows": rows, "holds": holds, "no_pdf": no_pdf},
              open(JSON_OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\n산출: {JSON_OUT}")
