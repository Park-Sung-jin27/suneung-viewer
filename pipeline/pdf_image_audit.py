# pdf_image_audit.py — 원본 PDF ↔ 데이터 이미지 수 대조 (발주 D-77)
#
# 목적: "원본에는 그림이 있는데 데이터에는 이미지 선언이 0" 인 회차를 찾는다.
#       탐지·규모 파악까지. 이미지 실제 삽입은 이번 범위 밖(별도 발주).
#
# 🔴 도구 대체 — 발주는 `pdfimages -list` 를 지정했으나 이 장비에 poppler 의
#    pdfimages 가 없다(pdftotext.exe 단독만 있음). PyMuPDF 로 같은 정보를 뽑는다.
#    pdfimages -list 의 object ID = PyMuPDF 의 xref, 나머지 컬럼(page/width/height)도 동일.
#
# 노이즈 필터 (발주 2)
#   (a) 2쪽 이상에 반복되는 동일 xref → 로고·머리말로 보고 제외
#   (b) 최소변 200px 미만 → 아이콘류로 보고 제외
#   남은 것 = 유의미 이미지 수
#
# 🔴 한계 — 벡터 그림(선그래프·도형)은 PDF 안에서 이미지 객체가 아니라 그리기 명령이다.
#    pdfimages 도 PyMuPDF 의 get_images 도 잡지 못한다. 즉 **위음성이 있다.**
#    이 리포트의 "유의미 이미지 0" 은 "그림이 없다" 가 아니라 "래스터 이미지가 없다" 는 뜻이다.
#
# 🔴 판정 반영 (D-78 이후) — "스캔형 = 노이즈" 는 **철회**됐다.
#    추출 표본 3장이 모두 실제 문항 자료였다(막대그래프 · 보기 자료 전면 · 순환도 조각).
#    total 이 큰 회차는 노이즈가 아니라 **한 그림이 여러 객체로 쪼개진 것**으로 보인다.
#    따라서 개수는 그림 수가 아니다. 조각 병합 전까지 규모·우선순위 근거로 쓰지 않는다.
#
# 사용: python pipeline/pdf_image_audit.py
# 금지: 데이터·이미지 수정. 원본 PDF 이동·삭제. (읽기 전용 스크립트다)

import json
import os
import re
import subprocess
import sys
from collections import defaultdict

import fitz  # PyMuPDF

FF = chr(12)          # 페이지 구분자
NL = chr(10)
B = chr(92)
QRE = "^(" + B + "d{1,2})" + B + "." + B + "s*" + B + "S"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DONE = os.path.join(ROOT, "_done")
SRC = os.path.join(ROOT, "public/data/all_data_204.json")
OUT = os.path.join(ROOT, "docs/pdf_image_audit_20260820.md")

MIN_SIDE = 200  # 필터 (b)


# ── 🔴 영역 필터 (발주 D-88 ①) ────────────────────────────────
# D-80 표본에서 171장 중 152장(89%)이 화작·문법 영역이었다.
# 서비스 대상은 독서·문학뿐이라, 그 영역 쪽의 이미지만 세어야 복구 총량이 맞는다.
#
# 쪽 경계는 문항 번호로 잡는다. 쪽마다 판정하면 오검출에 흔들리므로
# "한 번 넘어가면 끝까지" 규칙을 쓴다(D-80 에서 확립).
#   2022학년도~ : 앞이 공통(독서·문학), 35번이 처음 나온 쪽부터 선택과목
#   ~2021학년도 : 앞이 화작문, 16번이 처음 나온 쪽부터 독서·문학
def page_numbers(pdf):
    """쪽별 문항 번호 집합"""
    try:
        txt = subprocess.run(["pdftotext", "-layout", "-enc", "UTF-8", pdf, "-"],
                             capture_output=True).stdout.decode("utf-8", "replace")
    except Exception:
        return []
    out = []
    for page in txt.split(FF):
        ns = set()
        for line in page.split(NL):
            for seg in re.split(r" {3,}", line):
                m = re.match(QRE, seg.strip())
                if m:
                    n = int(m.group(1))
                    if 1 <= n <= 45:
                        ns.add(n)
        out.append(ns)
    return out


def rl_boundary(yk, pdf):
    """독서·문학 영역의 쪽 범위 (start, end) — 1-based, end 포함"""
    pages = page_numbers(pdf)
    if not pages:
        return None
    new_fmt = int(yk[:4]) >= 2022
    for i, ns in enumerate(pages, 1):
        if not ns:
            continue
        if new_fmt and max(ns) >= 35:
            return (1, i - 1)          # 그 쪽부터 선택과목 → 앞쪽까지가 독서·문학
        if not new_fmt and max(ns) >= 16:
            return (i, len(pages))     # 그 쪽부터 끝까지가 독서·문학
    return (1, len(pages))


def scan_pdf(path, rl_range=None):
    """반환: (유의미 이미지 수, 전체 이미지 수, 제외 내역, 표본)
    rl_range 를 주면 그 쪽 범위(독서·문학) 안의 이미지만 센다."""
    doc = fitz.open(path)
    pages = defaultdict(set)   # xref -> {page, ...}
    size = {}                  # xref -> (w, h)
    for pno in range(doc.page_count):
        for im in doc[pno].get_images(full=True):
            xref, _smask, w, h = im[0], im[1], im[2], im[3]
            pages[xref].add(pno + 1)
            size[xref] = (w, h)
    doc.close()

    total = len(pages)
    repeated = [x for x in pages if len(pages[x]) >= 2]          # (a)
    small = [x for x in pages if min(size[x]) < MIN_SIDE and x not in repeated]  # (b)
    keep = [x for x in pages if x not in repeated and x not in small]
    # (c) 영역 필터 — 독서·문학 쪽이 아니면 뺀다 (발주 D-88 ①)
    outside = []
    if rl_range:
        lo, hi = rl_range
        outside = [x for x in keep if not any(lo <= q <= hi for q in pages[x])]
        keep = [x for x in keep if x not in outside]
    sample = sorted(
        ((size[x][0], size[x][1], sorted(pages[x])[0]) for x in keep),
        key=lambda v: -(v[0] * v[1]),
    )[:4]
    return (len(keep), total,
            {"repeated": len(repeated), "small": len(small), "outside": len(outside)},
            sample)


def data_counts():
    """회차별 이미지 선언 수 + 선언이 있는 세트 id"""
    with open(SRC, encoding="utf-8") as f:
        data = json.load(f)
    out = {}
    for yk, y in data.items():
        n = 0
        sets = []
        for sec in ("reading", "literature"):
            for s in y.get(sec) or []:
                c = 0
                if s.get("hasFig"):
                    c += 1
                for t in s.get("sents") or []:
                    if t.get("sentType") == "image" or t.get("type") == "image":
                        c += 1
                for q in s.get("questions") or []:
                    if q.get("bogiImage"):
                        c += 1
                    c += len(q.get("bogiImages") or [])
                if c:
                    sets.append((s["id"], c))
                n += c
        out[yk] = (n, sets)
    return out


def main():
    if not os.path.isdir(DONE):
        print("🔴 _done 폴더가 없다"); sys.exit(1)
    decl = data_counts()

    rows = []
    for name in sorted(os.listdir(DONE)):
        d = os.path.join(DONE, name)
        if not os.path.isdir(d):
            continue
        pdf = None
        for f in os.listdir(d):
            if f.endswith(".pdf") and "시험지" in f:
                pdf = os.path.join(d, f)
                break
        if pdf is None:
            rows.append({"yk": name, "pdf": None})
            continue
        rl = rl_boundary(name, pdf)
        keep, total, drop, sample = scan_pdf(pdf, rl)
        n, sets = decl.get(name, (None, []))
        rows.append({"yk": name, "pdf": os.path.basename(pdf), "keep": keep, "total": total,
                     "drop": drop, "sample": sample, "decl": n, "sets": sets, "rl": rl})

    inData = [r for r in rows if r.get("decl") is not None]
    noPdf = [r for r in rows if r.get("pdf") is None]
    notInData = [r for r in rows if r.get("pdf") and r.get("decl") is None]
    suspect = [r for r in inData if r.get("keep", 0) >= 1 and r["decl"] == 0]

    print(f"_done 회차 {len(rows)} · 시험지 PDF 있음 {len(rows)-len(noPdf)} · "
          f"데이터에 있는 회차 {len(inData)} · 데이터에 없는 회차 {len(notInData)}")
    print(f"🔴 누락 의심(원본 유의미>=1 & 데이터=0): {len(suspect)}회차")

    md = ["# 원본 PDF ↔ 데이터 이미지 수 대조 (발주 D-77 · 2026-08-20)", ""]
    md.append("> 1차 = 회차 단위. 세트 단위 정밀 매핑은 2차(후속).")
    md.append("")
    md.append("## 한계 — 반드시 읽을 것")
    md.append("")
    md.append("- **벡터 그림(선그래프·도형)은 잡히지 않는다.** PDF 안에서 이미지 객체가 아니라 그리기 명령이기 때문이다.")
    md.append("  발주가 지정한 `pdfimages -list` 도 같은 한계를 갖는다. 즉 **위음성이 있다** — ")
    md.append("  「유의미 0」은 「그림이 없다」가 아니라 「래스터 이미지가 없다」는 뜻이다.")
    md.append(f"- **영역 필터 (D-88 ①)**: 문항 번호로 독서·문학 쪽 범위를 잡고 **그 안의 이미지만** 센다.")
    md.append("  화작·문법·선택과목 쪽 그림은 서비스 대상이 아니다. 표본에서 89%가 그쪽이었다.")
    md.append("- **정정 (D-78 판정)**: 초판의 「스캔형 = 노이즈」 표기는 철회됐다. 추출 표본 3장이 모두 실제 문항 자료였다.")
    md.append("  total 이 큰 회차는 노이즈가 아니라 **한 그림이 여러 객체로 쪼개진 것**이다.")
    md.append("  개수(71 등)는 그림 수가 아니다 — **조각 병합 전까지 규모·우선순위 근거로 쓰지 않는다.**")
    md.append("- 도구 대체: 이 장비에 poppler `pdfimages` 가 없어 PyMuPDF 로 같은 정보(xref·page·w·h)를 뽑았다.")
    md.append(f"- 노이즈 필터: (a) 2쪽 이상 반복 xref 제외 (b) 최소변 {MIN_SIDE}px 미만 제외")
    md.append("")
    md.append(f"## 누락 의심 — {len(suspect)}회차")
    md.append("")
    md.append("| 회차 | 유의미(독서·문학) | 전체 | 반복제외 | 소형제외 | 영역제외 | 독서·문학 쪽 | 데이터 선언 | 큰 이미지 표본 |")
    md.append("|---|--:|--:|--:|--:|--:|---|--:|---|")
    for r in sorted(suspect, key=lambda v: -v["keep"]):
        s = " · ".join(f"{w}×{h}@{p}" for w, h, p in r["sample"]) or "-"
        rl = r.get("rl")
        md.append(f"| {r['yk']} | **{r['keep']}** | {r['total']} | {r['drop']['repeated']} | "
                  f"{r['drop']['small']} | {r['drop'].get('outside', 0)} | "
                  f"{('p%d~p%d' % rl) if rl else '-'} | {r['decl']} | {s} |")
    md.append("")
    md.append("## 전체 회차")
    md.append("")
    md.append("| 회차 | 유의미 | 전체 | 데이터 선언 | 선언 세트 | 판정 |")
    md.append("|---|--:|--:|--:|---|---|")
    for r in rows:
        if r.get("pdf") is None:
            md.append(f"| {r['yk']} | - | - | - | - | 시험지 PDF 없음 |")
            continue
        if r.get("decl") is None:
            md.append(f"| {r['yk']} | {r['keep']} | {r['total']} | - | - | 데이터에 없는 회차 |")
            continue
        if r["keep"] >= 1 and r["decl"] == 0:
            v = "🔴 누락 의심"
        elif r["decl"] == 0:
            v = "이미지 없음"
        elif r["decl"] < r["keep"]:
            v = "⚠ 부분 선언"          # 선언은 있으나 원본 유의미 수보다 적다
        else:
            v = "✅"
        if r["total"] >= 100:
            v += " · 조각 다수(개수≠그림 수, 규모 근거 금지)"
        sets = " ".join(f"`{i}`×{c}" for i, c in r["sets"]) or "-"
        md.append(f"| {r['yk']} | {r['keep']} | {r['total']} | {r['decl']} | {sets} | {v} |")
    md.append("")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(md))
    print("문서:", os.path.relpath(OUT, ROOT))

    # 검증 표본 — 심사관이 원본 3쪽에서 큰 그림 4개를 실측한 회차
    t = next((r for r in rows if r["yk"] == "2016_6월B"), None)
    if t and t.get("pdf"):
        print(f"\n[검증 표본] 2016_6월B — 유의미 {t['keep']} · 전체 {t['total']} · "
              f"반복제외 {t['drop']['repeated']} · 소형제외 {t['drop']['small']} · 데이터 선언 {t['decl']}")
        print("  표본: " + (" · ".join(f"{w}x{h}@{p}쪽" for w, h, p in t["sample"]) or "-"))
        print("  → " + ("✅ 누락 의심으로 잡힘" if t in suspect else "🔴 안 잡힘 — 필터가 과하다"))


main()
