# pua_render.py — PUA 문자가 실제로 어떤 자형인지 원본 PDF 에서 잘라 낸다 (발주 D-100 ②)
#
# hypua2jamo 매핑표에 없는 PUA 는 옛한글이 아니다. 코드값만으로는 정체를 알 수 없으므로
# **원본 PDF 의 그 자리를 이미지로 잘라** 눈으로 확인한다(U+FFFD 3건과 같은 방법).
#
# 사용: python pipeline/pua_render.py <pdf> <검색문자열> <out.png> [--pad 8] [--dpi 400]
#   검색문자열은 PUA 를 포함한 주변 텍스트. 첫 일치 지점을 잘라 낸다.

import sys, fitz

pdf = sys.argv[1]
needle = sys.argv[2]
out = sys.argv[3]
arg = lambda k, d: (sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d)
pad = float(arg("--pad", 8))
dpi = int(arg("--dpi", 400))

doc = fitz.open(pdf)
for pno, pg in enumerate(doc):
    hits = pg.search_for(needle)
    if not hits:
        continue
    r = hits[0]
    clip = fitz.Rect(r.x0 - pad, r.y0 - pad, r.x1 + pad, r.y1 + pad)
    pg.get_pixmap(clip=clip, dpi=dpi).save(out)
    print(f"page={pno} rect={r} -> {out}")
    break
else:
    print("검색 실패 — 그 문자열이 PDF 에 없다", file=sys.stderr)
    sys.exit(1)
