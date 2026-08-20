# pdf_image_extract.py — 표본 회차의 유의미 이미지를 PNG 로 추출 (발주 D-78)
#
# 목적: 심사관 육안 판정 지원. "실제 지문·문항 그림 vs 스캔노이즈/장식" 을 가려
#       41회차의 실제 결함 비율을 추정하기 위한 표본이다.
#
# 필터는 pdf_image_audit.py 와 동일하다 (발주 D-77 2)
#   (a) 2쪽 이상 반복 xref 제외 (로고·머리말)
#   (b) 최소변 200px 미만 제외 (아이콘류)
#
# 출력: docs/pdf_image_samples_20260820/<회차>/<회차>_p<쪽>_<w>x<h>_x<xref>.png
#       docs/pdf_image_samples_20260820/README.md  (목록 1장)
#
# 사용: python pipeline/pdf_image_extract.py
# 금지: 데이터·이미지 삽입. 원본 PDF 이동·삭제. 표본 4회차 밖 추출. (읽기 전용이다)

import os
import sys
from collections import defaultdict

import fitz  # PyMuPDF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DONE = os.path.join(ROOT, "_done")
OUT = os.path.join(ROOT, "docs/pdf_image_samples_20260820")

# 발주 D-78 지정 표본 — 여기서 늘리지 않는다.
TARGETS = [
    ("2024_6월", "스캔형"),
    ("2026_6월", "스캔형"),
    ("2019수능", "일반"),
    ("2020수능", "일반"),
]
MIN_SIDE = 200


def find_pdf(yk):
    d = os.path.join(DONE, yk)
    if not os.path.isdir(d):
        return None
    for f in os.listdir(d):
        if f.endswith(".pdf") and "시험지" in f:
            return os.path.join(d, f)
    return None


def significant(doc):
    """유의미 이미지 목록 → [(page, xref, w, h)] 페이지 순"""
    pages = defaultdict(set)
    size = {}
    for pno in range(doc.page_count):
        for im in doc[pno].get_images(full=True):
            pages[im[0]].add(pno + 1)
            size[im[0]] = (im[2], im[3])
    out = []
    for x, ps in pages.items():
        if len(ps) >= 2:            # (a)
            continue
        w, h = size[x]
        if min(w, h) < MIN_SIDE:    # (b)
            continue
        out.append((sorted(ps)[0], x, w, h))
    out.sort(key=lambda v: (v[0], -(v[2] * v[3])))
    return out


def save_png(doc, xref, path):
    """CMYK·알파를 RGB 로 접어 저장. 실패하면 사유를 남긴다."""
    try:
        pix = fitz.Pixmap(doc, xref)
        if pix.n - pix.alpha >= 4:            # CMYK 등
            pix = fitz.Pixmap(fitz.csRGB, pix)
        elif pix.alpha:
            pix = fitz.Pixmap(pix, 0)
        pix.save(path)
        return os.path.getsize(path), None
    except Exception as e:                    # noqa: BLE001 — 사유를 그대로 보고한다
        return 0, str(e)


def main():
    os.makedirs(OUT, exist_ok=True)
    md = ["# 표본 회차 유의미 이미지 PNG (발주 D-78 · 2026-08-20)", ""]
    md.append("> 목적: 육안으로 **실제 지문·문항 그림 vs 스캔노이즈/장식** 을 판정한다.")
    md.append("> 이 비율이 나온 뒤에야 2차 정밀매핑·복구를 발주한다.")
    md.append("")
    md.append("- 필터는 D-77 과 동일: 2쪽 이상 반복 xref 제외 · 최소변 200px 미만 제외")
    md.append("- 파일명: `<회차>_p<쪽>_<w>x<h>_x<xref>.png` — 쪽 순서")
    md.append("- 벡터 그림은 여기 없다(래스터 이미지 객체만 추출된다)")
    md.append("")

    grand = 0
    for yk, kind in TARGETS:
        pdf = find_pdf(yk)
        if pdf is None:
            print(f"🔴 {yk} — 시험지 PDF 없음"); continue
        doc = fitz.open(pdf)
        items = significant(doc)
        d = os.path.join(OUT, yk)
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            if f.endswith(".png"):
                os.unlink(os.path.join(d, f))   # 이전 실행 잔재 제거

        rows, total, fail = [], 0, 0
        for pno, xref, w, h in items:
            name = f"{yk}_p{pno:02d}_{w}x{h}_x{xref}.png"
            size, err = save_png(doc, xref, os.path.join(d, name))
            if err:
                fail += 1
                rows.append((name, pno, w, h, 0, err))
            else:
                total += size
                rows.append((name, pno, w, h, size, None))
        doc.close()
        grand += total

        print(f"{yk} ({kind}) — 유의미 {len(items)}개 · 저장 {len(items)-fail}개 · "
              f"실패 {fail}개 · {total/1048576:.1f}MB")
        md.append(f"## {yk} — {kind} · {len(items)}개 · {total/1048576:.1f}MB")
        md.append("")
        md.append("| 파일 | 쪽 | 크기(px) | 용량 |")
        md.append("|---|--:|---|--:|")
        for name, pno, w, h, size, err in rows:
            v = err if err else f"{size/1024:.0f}KB"
            md.append(f"| `{name}` | {pno} | {w}×{h} | {v} |")
        md.append("")

    with open(os.path.join(OUT, "README.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md))
    print(f"\n합계 {grand/1048576:.1f}MB · 목록: docs/pdf_image_samples_20260820/README.md")


main()
