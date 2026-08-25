# bracket_probe.py — 지면에서 구간 표시 브래킷을 찾아 「어느 행부터 어느 행까지」인지 자동으로 짚는다.
#
# 확정된 조판 규칙(l20276d 3구간 + l2023d 6구간으로 역산, 화면 판독과 일치):
#   상단 가로획 y ≈ 첫 포함 행 y0 + 1~6      (가로획이 그 행 글자 높이 안에 든다)
#   하단 가로획 y ≈ 마지막 포함 행 y0 + 4~8   (역시 그 행 안에 든다)
#   [X] 라벨 자리에서 세로선이 한 번 끊기므로, 같은 x 의 조각은 하나로 잇는다.
#   라벨 글리프는 구간의 **중간 높이**에 놓인다.
#
# 판정은 사람이 한다. 이 도구는 후보를 좌표째로 내놓을 뿐이다.
#
# 사용: python pipeline/bracket_probe.py <pdf> <검색어> [--near 400]
#   <검색어> 가 있는 지면의 브래킷을 짚는다. --near 는 앵커에서 이만큼 떨어진 x 까지만 본다.

import sys, io, re, fitz

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

pdf, needle = sys.argv[1], sys.argv[2]
arg = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
near = arg("--near", 400)

LABEL = re.compile(r"^\[[A-F]\]$")

doc = fitz.open(pdf)
for pno, pg in enumerate(doc):
    hits = pg.search_for(needle)
    if not hits:
        continue

    anchor = hits[0]
    print(f"page={pno} (지면 {pno + 1}면)  앵커 x0={anchor.x0:.1f} y0={anchor.y0:.1f}  {needle!r}")

    # 1) 선 수집 — 세로선과, 길이 4~20pt 의 꺾쇠 가로획(양 끝 x 를 모두 기록)
    V, H = {}, []
    for d in pg.get_drawings():
        for it in d["items"]:
            if it[0] != "l":
                continue
            p, q = it[1], it[2]
            if abs(p.x - q.x) < 0.6 and abs(p.y - q.y) > 2:
                V.setdefault(round(p.x, 1), []).append((min(p.y, q.y), max(p.y, q.y)))
            elif abs(p.y - q.y) < 0.6 and 4 < abs(p.x - q.x) < 20:
                H.append((round(p.y, 1), round(min(p.x, q.x), 1), round(max(p.x, q.x), 1)))
    H = sorted(set(H))

    # 2) 텍스트 행
    rows = []
    for b in pg.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            r = fitz.Rect(ln["bbox"])
            t = "".join(s["text"] for s in ln["spans"])
            if t.strip():
                rows.append((r.y0, r.y1, r.x0, t))
    rows.sort()

    # 단(column)은 **앵커가 가리키는 쪽**으로 고정한다.
    #   좌우 두 단은 y 가 거의 같은 행을 각각 갖는다(예: 581.0 좌 / 581.5 우).
    #   브래킷 x 를 기준으로 잡으면 반대쪽 단 행을 집는다 — 실제로 r20226b 에서 그랬다.
    #
    #   ★ anchor.x0 는 **줄 시작이 아니라 검색어가 매치된 위치**다. 검색어가 줄 끝에
    #     걸리면 x0 가 단 오른쪽 끝으로 잡혀 단 판정이 틀어진다(l2021a 실측 734.5).
    #     그래서 앵커를 품은 **행의 x0** 를 단 기준으로 삼는다.
    _host = [r for r in rows
             if r[0] - 1 <= anchor.y0 <= r[1] + 1 and r[2] - 1 <= anchor.x0 <= r[2] + 700]
    COL_X = min(_host, key=lambda r: abs(r[0] - anchor.y0))[2] if _host else anchor.x0

    def col(bx=None):
        """앵커와 같은 단의 본문 행만. 라벨 글리프([A] 등)는 뺀다."""
        return [r for r in rows
                if not LABEL.match(r[3].strip()) and abs(r[2] - COL_X) < 60]

    def row_at(y, bx):
        """가로획 y 가 같은 단 어느 행 글자 높이 안에 드는지 — 없으면 가장 가까운 행."""
        cand = col(bx)
        if not cand:
            return None, "없음"
        inside = [r for r in cand if r[0] - 1 <= y <= r[1] + 1]
        if inside:
            return min(inside, key=lambda r: abs(r[0] - y)), "안"
        return min(cand, key=lambda r: abs(r[0] - y)), "밖"

    # 3) 세로선 조각을 라벨 공백까지 이어 붙이고, 양 끝 꺾쇠를 확인한다
    found = 0
    for x in sorted(V):
        if abs(x - anchor.x0) > near:
            continue
        # 세로선 조각 잇기. 라벨 자리에서 한 번 끊기므로 좁은 공백은 잇되,
        # **조각 끝에 꺾쇠가 있으면 거기서 구간이 닫힌 것이므로 잇지 않는다.**
        #   l20226b 실측: 라벨 공백 14.1pt, 구간 사이 공백 16.4pt — 폭만으로는 못 가른다.
        #   꺾쇠(420.4·532.6·549.0·679.9) 유무가 유일하게 확실한 근거다.
        capY = [h[0] for h in H if (h[1] - 3) <= x <= (h[2] + 3)]
        closed = lambda y: any(abs(y - c) < 2 for c in capY)
        segs = sorted(set(V[x]))
        merged = []
        for a, b2 in segs:
            if merged and a - merged[-1][1] < 18 and not closed(merged[-1][1]):
                merged[-1][1] = max(merged[-1][1], b2)
            else:
                merged.append([a, b2])
        for a, b2 in merged:
            if b2 - a < 8:
                continue
            # 꺾쇠는 세로선에서 좌(우단형) 또는 우(좌단형)로 뻗는다 — 양 끝 모두 본다
            caps = [h for h in H
                    if (h[1] - 3) <= x <= (h[2] + 3)
                    and (abs(h[0] - a) < 2 or abs(h[0] - b2) < 2)]
            if not caps:
                continue                    # 꺾쇠 없는 세로선 = 단 구분선·표 테두리
            top, kt = row_at(a, x)
            bot, kb = row_at(b2, x)
            if top is None or bot is None:
                continue
            found += 1
            # 같은 단 안에서도 반대쪽 단 글이 y 로는 겹친다 — 시작 행의 좌측 정렬 기준으로 더 좁힌다
            span = [r for r in col(x)
                    if top[0] - 1 <= r[0] <= bot[0] + 1 and abs(r[2] - top[2]) < 60]
            print(f"\n  브래킷 후보  x={x}  세로선 {a:.1f} ~ {b2:.1f}  꺾쇠 {[h[0] for h in caps]}")
            print(f"     시작 y={a:.1f} → 행 y0={top[0]:.1f} ({kt})")
            print(f"     끝   y={b2:.1f} → 행 y0={bot[0]:.1f} ({kb})")
            print(f"     감싸는 행 {len(span)}줄")
            for r in span:
                print(f"        y0={r[0]:7.1f}  {r[3][:62]}")
    if not found:
        print("  (꺾쇠 달린 브래킷을 못 찾음 — --near 를 키우거나 다른 검색어로 시도)")
    break
else:
    print(f"검색 실패: {needle!r}", file=sys.stderr)
    sys.exit(1)
