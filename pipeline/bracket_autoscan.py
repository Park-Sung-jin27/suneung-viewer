# bracket_autoscan.py — 한 세트의 구간 표시를 지면 벡터로 전수 판독하고 sentId 까지 매핑한다.
#
# bracket_probe.py 는 앵커를 사람이 주어야 했다. 여기서는 세트만 주면
#   1) 그 세트의 문장이 실린 지면을 찾고
#   2) 그 지면의 꺾쇠 달린 브래킷을 모두 모은 뒤
#   3) 구간 **중간 높이**에 있는 라벨 글리프로 이름([A]~[F])을 붙이고
#   4) 시작·끝 행 본문을 문장에 되맞춰 sentId 를 낸다.
#
# 조판 규칙(l20276d 3구간·l2023d 6구간·l20226b 2구간으로 역산·검증):
#   상단 가로획 y ≈ 첫 포함 행 y0 + 1~6 · 하단 가로획 y ≈ 마지막 포함 행 y0 + 4~8
#   라벨 자리에서 세로선이 한 번 끊긴다. 단, **조각 끝에 꺾쇠가 있으면 거기서 닫힌 것**이라 잇지 않는다.
#
# 판정은 사람이 한다. 이 도구는 후보를 좌표째로 내놓을 뿐이다.
#
# 사용: python pipeline/bracket_autoscan.py <setId|연도::setId> [...]
#   setId 는 연도 키 안에서만 고유하다 — 중복 id 는 「연도::setId」로 부른다

import sys, io, os, re, json, unicodedata
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


def norm(s):
    """공백·따옴표·괄호주석을 지운 비교용 문자열."""
    s = unicodedata.normalize("NFC", str(s))
    s = re.sub(r"\([^)]*\)", "", s)
    s = re.sub(r"[\s​]", "", s)
    return s.translate(str.maketrans({"“": '"', "”": '"', "‘": "'", "’": "'", "․": ".", "·": ""}))


def find_set(spec):
    """set 을 찾는다. ★ setId 는 **연도 키 안에서만 고유**하다(2014·2015 A/B형 등 47종 중복).
    그래서 인자로 "yearKey::setId" 를 받는 것을 권장하고, setId 만 준 경우
    중복이면 어느 연도인지 물어보며 멈춘다 — 조용히 첫 것을 고르지 않는다."""
    yk_want, _, sid = spec.rpartition("::")
    hits = []
    for yk, v in ALL.items():
        if yk_want and yk != yk_want:
            continue
        for sec in ("reading", "literature"):
            for s in v.get(sec) or []:
                if (s.get("setId") or s.get("id")) == sid:
                    hits.append((yk, s))
    if not hits:
        return None, None
    if len(hits) > 1:
        years = ", ".join(y for y, _ in hits)
        print(f"🔴 {sid} — 연도 {len(hits)}곳에 있다({years}). "
              f"「연도::{sid}」 형식으로 다시 부르십시오")
        return None, None
    return hits[0]


def screen_brackets(yk, set_id, s):
    """화면이 실제로 쓰는 bracket (annotations.json 우선 + visual_marks) — 라벨별 최종값."""
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


def pages_of(doc, s):
    """세트의 문장이 실린 지면들."""
    # 앞쪽만 뽑으면 여러 지면에 걸친 세트에서 뒷 지면을 놓친다(l2021a 9면 실측).
    # 문장 배열 전체에 걸쳐 고르게 뽑는다.
    usable = [re.sub(r"\s+", " ", str(x.get("t") or "")).strip()
              for x in s.get("sents") or []
              if x.get("sentType") not in ("workTag", "author", "footnote", "omission")]
    usable = [t for t in usable if len(t) >= 14]
    if not usable:
        return []
    step = max(1, len(usable) // 24)
    probes = [t[:16] for t in usable[::step]][:24]
    hits = {}
    for pno, pg in enumerate(doc):
        n = sum(1 for p in probes if pg.search_for(p))
        if n:
            hits[pno] = n
    return [p for p, n in sorted(hits.items()) if n >= 1]


def sent_of(sents, text, tail=False):
    """PDF 행 본문 조각을 품은 문장을 찾는다. tail=True 면 행의 끝쪽 조각으로 찾는다."""
    key = norm(text)
    if len(key) < 6:
        return None
    frag = key[-14:] if tail else key[:14]
    got = [x for x in sents if frag in norm(x.get("t") or "")]
    if len(got) == 1:
        return got[0]["id"]
    if len(got) > 1:
        return got[-1]["id"] if tail else got[0]["id"]
    return None


def scan(spec):
    yk, s = find_set(spec)
    # 인자에 연도가 붙어 있어도 아래에서는 **순수 setId** 를 써야 한다
    # (annotations.json / visual_marks.json 조회 키가 순수 id 다).
    set_id = spec.rpartition("::")[2]
    if not s:
        print(f"🔴 {spec} — 세트 없음")
        return
    pdf = os.path.join(ROOT, "_done", yk, f"{yk}_시험지.pdf")
    if not os.path.exists(pdf):
        print(f"🔴 {spec} — PDF 없음: {pdf}")
        return
    sents = s.get("sents") or []
    cur = screen_brackets(yk, set_id, s)
    doc = fitz.open(pdf)
    pages = pages_of(doc, s)
    print(f"\n{'=' * 78}\n## {yk} {set_id} · sents {len(sents)} · 지면 {[p + 1 for p in pages]}")
    print(f"   화면값: " + (" · ".join(f"[{k}] {v[0]}~{v[1]} ({v[2]})" for k, v in sorted(cur.items())) or "없음"))

    found = []
    for pno in pages:
        pg = doc[pno]
        V, H, glyphs, rows = {}, [], [], []
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
                t = "".join(sp["text"] for sp in ln["spans"])
                if not t.strip():
                    continue
                m = LABEL.match(t.strip())
                if m:
                    glyphs.append((m.group(1), r.x0, r.y0, r.y1))
                else:
                    rows.append((r.y0, r.y1, r.x0, t))
        rows.sort()
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
                    continue      # 양 끝에 꺾쇠가 있어야 구간 표시다
                # 라벨: 구간 안에 있고 세로선에 가장 가까운 글리프
                lab = [g for g in glyphs if a - 2 <= g[2] <= b2 + 2 and abs(g[1] - x) < 60]
                name = lab[0][0] if lab else "?"
                # 브래킷이 감싸는 「단」 고르기.
                #   같은 y 대역에 좌·우 두 단이 있고, 브래킷과의 거리만으로는 못 가른다
                #   (l20276d 는 좌단 본문이 262pt, 우단 선지가 77pt 떨어져 있다).
                #   그래서 **그 단의 행이 이 세트 문장에 실제로 맞는지**로 고른다.
                #   덤으로 다른 세트의 브래킷도 걸러진다(매칭 0이면 버림).
                # 상단 꺾쇠는 첫 포함 행 y0 보다 1~6pt 아래에 찍힌다 — 여유를 두지 않으면
                # 첫 줄이 통째로 잘린다(l20276d [B]·l20226b [A]·l2021a [A] 실측).
                # 행 간격이 18pt 이상이므로 9pt 여유로는 이전 행이 딸려오지 않는다.
                inside = [r for r in rows if a - 9 <= r[0] <= b2 + 1 and abs(r[2] - x) < 400]
                if not inside:
                    continue
                buckets = {}
                for r in inside:
                    k = min((b for b in buckets if abs(b - r[2]) < 60), default=None)
                    buckets.setdefault(r[2] if k is None else k, []).append(r)
                best, best_hit = None, 0
                for k, grp in buckets.items():
                    hit = sum(1 for r in grp if sent_of(sents, r[3]) or sent_of(sents, r[3], tail=True))
                    if hit > best_hit or (hit == best_hit and best and len(grp) > len(best)):
                        best, best_hit = grp, hit
                if not best or best_hit == 0:
                    continue                      # 이 세트의 구간이 아니다
                span = sorted(best)
                # 경계 줄이 짧으면("보다." 등) 매칭이 안 된다 — 안쪽 줄로 물러나며 찾는다
                fr = to = None
                for r in span:
                    fr = sent_of(sents, r[3])
                    if fr:
                        break
                for r in reversed(span):
                    to = sent_of(sents, r[3], tail=True) or sent_of(sents, r[3])
                    if to:
                        break
                found.append((name, pno, a, b2, fr, to, span, best_hit))

    if not found:
        print("   🔴 꺾쇠 달린 브래킷을 못 찾음")
        return
    for name, pno, a, b2, fr, to, span, hit in found:
        c = cur.get(name)
        same = c and fr == c[0] and to == c[1]
        mark = "✅ 화면값과 같음" if same else ("🔴 다름" if c else "🔴 화면에 없던 구간")
        print(f"\n   [{name}] {pno + 1}면  꺾쇠 {a:.1f}/{b2:.1f}  ({len(span)}줄)")
        print(f"        벡터 → {fr} ~ {to}")
        print(f"        화면 → " + (f"{c[0]} ~ {c[1]} ({c[2]})" if c else "없음") + f"   {mark}")
        print(f"        시작행 {span[0][3][:52]}")
        print(f"        끝행   {span[-1][3][:52]}")


for sid in sys.argv[1:]:
    scan(sid)
