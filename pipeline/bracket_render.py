# bracket_render.py — 구간 표시 [A]~[F] 가 있는 지면을 잘라 낸다 (발주 D-104)
#
# 자동 검출(세로선 좌표)은 단 구분선·표 테두리와 섞여 신뢰할 수 없었다.
# 원본 지면을 직접 잘라 **눈으로** 범위를 확정한다(D-102 속미인곡과 같은 방법).
#
# 사용: python pipeline/bracket_render.py <pdf> <검색어> <out_prefix> [--pad-left 40]
#                                          [--width 340] [--dpi 300] [--slices 2]

import sys, os, fitz

pdf, needle, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
arg = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
pad_left = arg("--pad-left", 40)
width = arg("--width", 340)
dpi = int(arg("--dpi", 300))
slices = int(arg("--slices", 2))
up = arg("--up", 30)
down = arg("--down", 420)

doc = fitz.open(pdf)
for pno, pg in enumerate(doc):
    hits = pg.search_for(needle)
    if not hits:
        continue
    r = hits[0]
    x0 = max(0, r.x0 - pad_left)
    y0 = max(0, r.y0 - up)
    y1 = min(pg.rect.y1, r.y0 + down)
    h = (y1 - y0) / slices
    for i in range(slices):
        clip = fitz.Rect(x0, y0 + i * h - (4 if i else 0), x0 + width, y0 + (i + 1) * h)
        pg.get_pixmap(clip=clip, dpi=dpi).save(f"{prefix}_{i}.png")
    print(f"page={pno} anchor y={r.y0:.0f} -> {prefix}_0..{slices-1}.png")
    break
else:
    print(f"검색 실패: {needle!r}", file=sys.stderr)
    sys.exit(1)
