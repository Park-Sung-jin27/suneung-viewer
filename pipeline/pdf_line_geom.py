# pdf_line_geom.py — 줄 끝 「남은 여백」으로 줄바꿈 성격을 판별한다 (발주 D-101 ③)
#
# 줄 끝 공백 문자만으로는 부족했다.
#   · 줄 끝에 공백이 **있으면** 어절 경계다(신뢰 가능).
#   · 줄 끝에 공백이 **없으면** 모호하다 — PyMuPDF 블록이 줄마다 쪼개지는 PDF 에서는
#     블록 마지막 줄이 항상 공백 없이 끝나기 때문이다(이 PDF 는 96%가 blockLast).
#     실증: "적절하지 않은" + "것은?" 을 "않은것은" 으로 오판했다(16건).
#
# 그래서 물리적 근거를 더한다: **다음 줄 첫 글자가 이 줄에 들어갈 수 있었는가**
#   · 들어갈 수 있었는데 넘겼다 → 어절 단위로 넘긴 것 = 공백
#   · 못 들어갔다               → 어절 중간에서 잘린 것 = 붙임
#
# 블록을 믿지 않고 **페이지의 모든 줄을 단(column)별·y순으로 재구성**한다.
# 수능 국어는 2단 조판이라 x0 으로 단을 가른다.
#
# 출력 JSON: lines[] = {p, col, t, sp, x0, x1, right, gap, nextW, nextT}
# 사용: python pipeline/pdf_line_geom.py <pdf> <out.json>

import sys, json, fitz

pdf, out = sys.argv[1], sys.argv[2]
doc = fitz.open(pdf)
lines = []

for pno, pg in enumerate(doc):
    raw = []
    for blk in pg.get_text("dict").get("blocks", []):
        for ln in blk.get("lines", []):
            spans = [s for s in ln.get("spans", []) if s.get("text", "").strip()]
            t = "".join(s.get("text", "") for s in ln.get("spans", []))
            if not t.strip() or not spans:
                continue
            b = ln.get("bbox")
            raw.append({"t": t, "x0": b[0], "x1": b[2], "y": b[1], "spans": spans})
    if not raw:
        continue

    # 단 나누기 — 페이지 가로 중앙 기준. 2단이 아니면 한 단으로 본다.
    mid = (min(r["x0"] for r in raw) + max(r["x1"] for r in raw)) / 2
    for r in raw:
        r["col"] = 0 if r["x0"] < mid else 1
    # 단이 한쪽으로 쏠리면(1단 조판) 전부 같은 단
    if min(sum(1 for r in raw if r["col"] == c) for c in (0, 1)) < 3:
        for r in raw:
            r["col"] = 0

    for col in sorted({r["col"] for r in raw}):
        grp = sorted([r for r in raw if r["col"] == col], key=lambda r: r["y"])
        if not grp:
            continue
        xs = sorted(r["x1"] for r in grp)
        right = xs[int(len(xs) * 0.9)]          # 단 우측 경계 ≈ 90 퍼센타일
        for i, r in enumerate(grp):
            nxt_w, nxt_t = None, None
            if i + 1 < len(grp):
                nxt = grp[i + 1]
                nxt_t = nxt["t"][:12]
                s = nxt["spans"][0]
                txt = s.get("text", "")
                nxt_w = (s["bbox"][2] - s["bbox"][0]) / max(1, len(txt))
            lines.append({
                "p": pno, "col": col, "t": r["t"], "sp": r["t"].endswith(" "),
                "x0": r["x0"], "x1": r["x1"], "right": right,
                "gap": right - r["x1"], "nextW": nxt_w, "nextT": nxt_t,
            })

json.dump({"lines": lines}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
have = [l for l in lines if l["nextW"]]
print(f"lines={len(lines)} withNext={len(have)}")
