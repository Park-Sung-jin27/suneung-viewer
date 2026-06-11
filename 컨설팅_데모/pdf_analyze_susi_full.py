# -*- coding: utf-8 -*-
import subprocess
import re
from pathlib import Path

PDF_DIR = Path(__file__).parent.parent / "모집요강_2027_수시"
OUT_DIR = Path(__file__).parent / "검수보고서_수시"
OUT_DIR.mkdir(exist_ok=True)

TARGETS = {
    "수능최저학력기준": ["수능 최저", "수능최저", "최저학력", "등급 합", "등급합"],
    "전형방법·반영비율": ["전형요소", "반영비율", "단계별", "일괄합산"],
    "교과 반영방법": ["교과 반영", "교과성적", "이수단위", "등급별"],
    "서류평가·면접": ["서류평가", "면접평가", "제시문 기반"],
    "모집인원·모집단위": ["모집인원", "모집단위별", "전형별 모집"],
}


def extract_text(pdf_path):
    """외부 timeout 명령 + pdftotext"""
    try:
        r = subprocess.run(
            ["timeout", "8s", "pdftotext", "-layout", str(pdf_path), "-"],
            capture_output=True, text=True, timeout=15
        )
        return r.stdout
    except Exception:
        return ""


def section_extract(text, kws, lps=15, ms=3):
    lines = text.split("\n")
    secs = []
    used = set()
    for i, l in enumerate(lines):
        if any(k in l for k in kws):
            if i in used: continue
            s = max(0, i-1); e = min(len(lines), i+lps)
            for j in range(s, e): used.add(j)
            secs.append("\n".join(lines[s:e]))
            if len(secs) >= ms: break
    return secs


def parse_filename(name):
    base = name.replace("_수시모집요강_2027.pdf", "").replace(".pdf", "")
    if base.startswith("[") or "(1)" in base or "(2)" in base:
        return None, None
    parts = base.split("_")
    if len(parts) >= 2 and "대" in parts[0]:
        return parts[0], parts[1]
    return None, None


def analyze(univ, campus, pdf):
    out = [f"# {univ} ({campus}) 수시 모집요강 검수 (2027)\n",
           f"**PDF**: `{pdf.name}` ({pdf.stat().st_size//1024} KB)\n\n---\n"]
    text = extract_text(pdf)
    if not text:
        out.append("⚠️ 텍스트 추출 실패\n")
        return "\n".join(out)
    out.append(f"전체 텍스트 길이: {len(text):,}자\n\n---\n")
    for n, kws in TARGETS.items():
        out.append(f"\n## {n}\n")
        secs = section_extract(text, kws)
        if not secs:
            out.append("(매칭 없음)\n")
            continue
        for si, s in enumerate(secs):
            out.append(f"\n### 매칭 {si+1}\n```\n{s}\n```\n")
    out.append("\n---\n## ✅ 체크\n- [ ] 수능최저\n- [ ] 전형방법\n- [ ] 교과반영\n- [ ] 모집인원\n")
    return "\n".join(out)


def main():
    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    print(f"PDF {len(pdfs)}개", flush=True)
    succ = skip = fail = 0
    for i, pdf in enumerate(pdfs, 1):
        u, c = parse_filename(pdf.name)
        if not u:
            skip += 1; continue
        safe = (u + "_" + c).replace("/", "_").replace(" ", "")
        op = OUT_DIR / f"{safe}_수시검수.md"
        if op.exists():
            succ += 1; continue
        try:
            md = analyze(u, c, pdf)
            op.write_text(md, encoding="utf-8")
            succ += 1
            if i % 10 == 0:
                print(f"[{i}/{len(pdfs)}] s={succ} sk={skip} f={fail}", flush=True)
        except Exception as e:
            fail += 1
            print(f"fail {pdf.name[:30]}: {str(e)[:30]}", flush=True)
    print(f"\n끝: s={succ} sk={skip} f={fail} / md={len(list(OUT_DIR.glob('*.md')))}")


if __name__ == "__main__":
    main()
