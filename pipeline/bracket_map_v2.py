# bracket_map_v2.py — 구간 표시를 지면 벡터로 판독하고 sentId 를 **역방향**으로 매핑한다.
#
# ★ 왜 다시 짰나 (D-110)
#   bracket_autoscan.py 는 「PDF 행 본문 → 문장」 순방향으로 맞췄다. 조판 줄은 문장 경계와
#   다르고 짧은 줄·반복 어구에서 엉뚱한 문장을 집었다. 실측 반례:
#     r20209a [A] 브래킷 419.5/587.0 은 맞는데 매핑이 s10~s14 로 나왔다.
#                 화면값 시작 s38 은 그 브래킷 안(y0 452.8)에 있다.
#     l2021a  [B] 손 확정 s55~s67, 도구 s55~s65.
#
#   여기서는 반대로 간다: **문장마다 지면에서 제 위치(y)를 찾아 두고**, 브래킷 y 범위에
#   드는 문장을 고른다. 조판 줄을 아예 안 본다.
#
# 포함 규칙(l20276d·l2023d·l20226b·l2021a 로 역산·검증):
#   상단 꺾쇠 y ≈ 첫 포함 문장의 시작 y + 1~6   → 여유 9pt
#   하단 꺾쇠 y ≈ 마지막 포함 문장의 **마지막 줄** y + 4~8 → 시작 y 는 항상 꺾쇠보다 위
#   ⇒ 포함 문장 = 시작 y 가 [상단꺾쇠 - 9, 하단꺾쇠 + 1] 안에 드는 문장
#
# 문장 위치 찾기: 앞 20자로 search_for, 안 되면 16·12·9자로 줄여 가며 시도한다.
#   같은 조각이 여러 번 나오면 **문장 순서대로 단조 증가**하는 위치를 고른다.
#
# 판정은 사람이 한다. 이 도구는 후보를 좌표째로 내놓을 뿐이다.
#
# 사용: python pipeline/bracket_map_v2.py <setId> [<setId> ...]

import sys, io, os, re, json
import fitz

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public", "data")

with io.open(os.path.join(DATA, "all_data_204.json"), encoding="utf-8") as f:
    ALL = json.load(f)
with io.open(os.path.join(DATA, "annotations.json"), encoding="utf-8") as f:
    ANN = json.load(f)
with io.open(os.path.join(DATA, "visual_marks.json"), encoding="utf-8") as f:
    VM = json.load(f)

LABEL = re.compile(r"^\[([A-F])\]$")
SKIP_TYPES = ("workTag", "author", "footnote", "omission")


def find_set(set_id):
    for yk, v in ALL.items():
        for sec in ("reading", "literature"):
            for s in v.get(sec) or []:
                if (s.get("setId") or s.get("id")) == set_id:
                    return yk, s
    return None, None


def screen_brackets(yk, set_id, s):
    ids = [str(x["id"]) for x in s.get("sents") or []]
    lst = (ANN.get(yk) or {}).get(set_id)
    eff = lst if isinstance(lst, list) and lst else (s.get("annotations") or [])
    cands = []
    for m in VM.get("marks") or []:
        if m.get("yearKey") == yk and m.get("setId") == set_id and m.get("type") == "bracket" \
           and m.get("target") == "sent_range" and m.get("status") != "broken" and m.get("sentIds"):
            cands.append((m["label"], m["sentIds"][0], m["sentIds"][-1], "vm"))
    for a in eff:
        if a.get("type") == "bracket" and a.get("sentFrom") and a.get("sentTo") \
           and a.get("target", "passage") == "passage":
            cands.append((a["label"], a["sentFrom"], a["sentTo"], "ann"))
    out = {}
    for lb, fr, to, srcn in cands:
        if lb in out:
            continue
        if fr in ids and to in ids and ids.index(fr) <= ids.index(to):
            out[lb] = (fr, to, srcn)
    return out


def locate_sents(doc, sents):
    """문장마다 (지면, 시작 y, 시작 x) 를 찾는다. 문장 순서대로 단조 증가하는 위치를 고른다."""
    pos, cur = {}, (-1, -1.0)
    for x in sents:
        t = re.sub(r"\s+", " ", str(x.get("t") or "")).strip()
        if not t:
            continue
        got = None
        for n in (20, 16, 12, 9):
            if len(t) < n:
                continue
            frag = t[:n]
            hits = []
            for pno, pg in enumerate(doc):
                for r in pg.search_for(frag):
                    hits.append((pno, round(r.y0, 1), round(r.x0, 1)))
            if not hits:
                continue
            hits.sort()
            fwd = [h for h in hits if (h[0], h[1]) > cur]
            got = (fwd or hits)[0]
            break
        if got:
            pos[str(x["id"])] = got
            cur = (got[0], got[1])
    return pos


def brackets_on(doc, pages):
    """꺾쇠 달린 브래킷 + 라벨 글리프."""
    out = []
    for pno in pages:
        pg = doc[pno]
        V, H, glyphs = {}, [], []
        for d in pg.get_drawings():
            for it in d["items"]:
                if it[0] != "l":
                    continue
                p, q = it[1], it[2]
                if abs(p.x - q.x) < 0.6 and abs(p.y - q.y) > 2:
                    V.setdefault(round(p.x, 1), []).append((min(p.y, q.y), max(p.y, q.y)))
                elif abs(p.y - q.y) < 0.6 and 4 < abs(p.x - q.x) < 20:
                    H.append((round(p.y, 1), round(min(p.x, q.x), 1), round(max(p.x, q.x), 1)))
        for b in pg.get_text("dict")["blocks"]:
            for ln in b.get("lines", []):
                r = fitz.Rect(ln["bbox"])
                m = LABEL.match("".join(sp["text"] for sp in ln["spans"]).strip())
                if m:
                    glyphs.append((m.group(1), r.x0, r.y0, r.y1))
        H = sorted(set(H))
        for x in sorted(V):
            capY = [h[0] for h in H if (h[1] - 3) <= x <= (h[2] + 3)]
            closed = lambda y: any(abs(y - c) < 2 for c in capY)
            merged = []
            for a, b2 in sorted(set(V[x])):
                if merged and a - merged[-1][1] < 18 and not closed(merged[-1][1]):
                    merged[-1][1] = max(merged[-1][1], b2)
                else:
                    merged.append([a, b2])
            for a, b2 in merged:
                if b2 - a < 8 or not (closed(a) and closed(b2)):
                    continue
                lab = [g for g in glyphs if a - 2 <= g[2] <= b2 + 2 and abs(g[1] - x) < 60]
                # 꺾쇠 가로획이 뻗는 쪽이 **본문 쪽**이다.
                #   l20276d: 브래킷 x=368.5, 꺾쇠 359.8→368.7 (왼쪽) → 본문 x0=106.7 왼쪽 ✅
                #   l20226b: 브래킷 x=453.7, 꺾쇠 453.5→462.4 (오른쪽) → 본문 x0≈470 오른쪽 ✅
                #   좌·우 단이 같은 y 를 공유하므로 이 방향이 유일하게 확실한 판별근거다.
                caps = [h for h in H if (h[1] - 3) <= x <= (h[2] + 3)
                        and (abs(h[0] - a) < 2 or abs(h[0] - b2) < 2)]
                side = 0
                for h in caps:
                    if h[1] < x - 1:
                        side -= 1
                    if h[2] > x + 1:
                        side += 1
                out.append((lab[0][0] if lab else "?", pno, x, a, b2, 1 if side > 0 else -1))
    return out


def scan(set_id):
    yk, s = find_set(set_id)
    if not s:
        print(f"\n🔴 {set_id} — 세트 없음")
        return
    pdf = os.path.join(ROOT, "_done", yk, f"{yk}_시험지.pdf")
    if not os.path.exists(pdf):
        print(f"\n🔴 {set_id} — PDF 없음: {pdf}")
        return
    sents = [x for x in (s.get("sents") or []) if x.get("sentType") not in SKIP_TYPES]
    order = {str(x["id"]): i for i, x in enumerate(s.get("sents") or [])}
    stype = {str(x["id"]): x.get("sentType") for x in s.get("sents") or []}
    cur = screen_brackets(yk, set_id, s)
    doc = fitz.open(pdf)
    pos = locate_sents(doc, sents)
    pages = sorted({p for p, _, _ in pos.values()})
    print(f"\n{'=' * 78}\n## {yk} {set_id} · 문장 {len(sents)} · 위치확인 {len(pos)} · 지면 {[p + 1 for p in pages]}")
    print(f"   화면값: " + (" · ".join(f"[{k}] {v[0]}~{v[1]} ({v[2]})" for k, v in sorted(cur.items())) or "없음"))
    if len(pos) < len(sents) * 0.6:
        print(f"   ⚠ 문장 위치를 {len(pos)}/{len(sents)} 만 찾았다 — 판정 신뢰도 낮음")

    brs = brackets_on(doc, pages)
    if not brs:
        print("   🔴 꺾쇠 달린 브래킷을 못 찾음")
        return
    for name, pno, x, a, b2, side in brs:
        cand = [(order[sid], sid, p[1], p[2]) for sid, p in pos.items()
                if p[0] == pno and (a - 9) <= p[1] <= (b2 + 1)]
        if not cand:
            continue                      # 이 세트의 구간이 아니다

        # ① 같은 단만. 꺾쇠가 뻗는 쪽(side)이 본문 쪽이다. 반대쪽 단은 버린다.
        #    개수로 고르면 안 된다 — l20226b [A] 는 반대쪽(좌단) 문장이 더 많았다.
        cand = [it for it in cand
                if (it[3] > x - 20 if side > 0 else it[3] < x + 20) and abs(it[3] - x) < 360]
        if not cand:
            continue

        # ② 문장 번호가 연속인 덩어리만. 위치 오탐이 섞이면 동떨어진 문장이 딸려온다
        #    (l20226b [A] 에 s12 와 s40 이 함께 잡혔다 — s12 는 오탐).
        cand.sort()
        runs, run = [], [cand[0]]
        for prev, it in zip(cand, cand[1:]):
            if it[0] - prev[0] <= 2:      # 건너뛴 문장(각주·표지)까지는 이어 준다
                run.append(it)
            else:
                runs.append(run)
                run = [it]
        runs.append(run)
        inside = max(runs, key=len)
        fr, to = inside[0][1], inside[-1][1]

        # ③ 위치를 못 찾은 문장이 구간 끝쪽에 있으면 범위가 짧게 잘린다
        #    (r20226b 는 43문장 중 6개를 못 찾아 s28 이 s24 로 밀렸다).
        #    그래서 **구간 밖임이 확인된 다음 문장 직전까지** 넓힌다.
        idx = sorted(order.items(), key=lambda kv: kv[1])
        def stretch(start_i, step):
            last = start_i
            i = start_i + step
            while 0 <= i < len(idx):
                sid2 = idx[i][0]
                p = pos.get(sid2)
                if p is not None:
                    if p[0] != pno or not ((a - 9) <= p[1] <= (b2 + 1)):
                        break                       # 구간 밖임이 확인됐다 — 여기서 멈춘다
                    if (p[2] > x - 20 if side > 0 else p[2] < x + 20):
                        last = i
                elif stype.get(sid2) not in SKIP_TYPES:
                    # 위치를 못 찾은 **본문** 문장은 구간 안으로 본다.
                    #   r20226b s28 은 데이터가 「과정 3」, 지면이 「과정3」 이라 search_for 가
                    #   실패했다. 건너뛰면 구간이 s27 에서 잘린다.
                    #   각주·작자 표기(SKIP_TYPES)는 넓히지 않는다 — 구간 밖이다.
                    last = i
                i += step
            return idx[last][0]
        to = stretch(order[to], +1)
        # 시작점은 상단 꺾쇠가 첫 문장 시작 y 의 +1~6 에 찍히므로 대개 이미 정확하다.
        # 첫 문장이 꺾쇠에 붙어 있으면 넓히지 않는다 — 넓히면 앞 문장을 잘못 먹는다
        # (l20226b [A] 가 s40 → s39 로 퇴행했다). 붙어 있지 않을 때만 넓힌다.
        pf = pos.get(fr)
        if not (pf and (a - 9) <= pf[1] <= (a + 7)):
            fr = stretch(order[fr], -1)
        c = cur.get(name)
        same = c and fr == c[0] and to == c[1]
        mark = "✅ 같음" if same else ("🔴 다름" if c else "🔴 화면에 없던 구간")
        print(f"\n   [{name}] {pno + 1}면  꺾쇠 {a:.1f}/{b2:.1f}  x={x}")
        print(f"        벡터 → {fr} ~ {to}  ({len(inside)}문장)")
        print(f"        화면 → " + (f"{c[0]} ~ {c[1]} ({c[2]})" if c else "없음") + f"   {mark}")
        print(f"        포함 문장 y: " + " ".join(f"{sid.replace(set_id, '')}@{y:.0f}" for _, sid, y, _x in inside[:14])
              + (" …" if len(inside) > 14 else ""))


for sid in sys.argv[1:]:
    scan(sid)
