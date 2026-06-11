# -*- coding: utf-8 -*-
"""
수시 모집요강 검수 보고서 v2 — pdftotext 기반 빠른 추출
"""
import subprocess
import re
from pathlib import Path

PDF_DIR = Path(__file__).parent.parent / "모집요강_2027_수시"
OUT_DIR = Path(__file__).parent / "검수보고서_수시"
OUT_DIR.mkdir(exist_ok=True)

TOP30 = [
    ("서울대학교", "본교"), ("연세대학교", "본교"), ("고려대학교", "본교"),
    ("서강대학교", "본교"), ("성균관대학교", "본교"), ("한양대학교", "본교"),
    ("중앙대학교", "본교"), ("경희대학교", "본교"), ("한국외국어대학교", "본교"),
    ("서울시립대학교", "본교"), ("건국대학교", "본교"), ("동국대학교", "본교"),
    ("홍익대학교", "본교"), ("숙명여자대학교", "본교"), ("이화여자대학교", "본교"),
    ("국민대학교", "본교"), ("세종대학교", "본교"), ("단국대학교", "본교"),
    ("아주대학교", "본교"), ("인하대학교", "본교"), ("가천대학교", "본교"),
    ("광운대학교", "본교"), ("서울과학기술대학교", "본교"), ("한국항공대학교", "본교"),
    ("부산대학교", "본교"), ("전남대학교", "본교"), ("경북대학교", "본교"),
    ("충남대학교", "본교"), ("전북대학교", "본교"), ("강원대학교", "본교"),
]

TARGETS = {
    "수능최저학력기준": ["수능 최저", "수능최저", "최저학력", "등급 합", "등급합"],
    "전형방법·반영비율": ["전형요소", "반영비율", "단계별", "일괄합산"],
    "교과 반영방법": ["교과 반영", "교과성적", "이수단위", "등급별"],
    "서류평가·면접": ["서류평가", "면접평가", "제시문 기반"],
    "모집인원·모집단위": ["모집인원", "모집단위별", "전형별 모집"],
}


def find_pdf(univ, campus):
    base = PDF_DIR
    candidates = list(base.glob(f"{univ}_{campus}_수시모집요강*"))
    return candidates[0] if candidates else None


def extract_text(pdf_path):
    try:
        r = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"],
                          capture_output=True, text=True, timeout=30)
        return r.stdout
    except Exception as e:
        return ""


def section_extract(text, keywords, lines_per_section=15, max_sections=3):
    """텍스트에서 keyword 포함 구간 추출"""
    lines = text.split("\n")
    sections = []
    used = set()
    for i, l in enumerate(lines):
        if any(k in l for k in keywords):
            if i in used:
                continue
            start = max(0, i - 1)
            end = min(len(lines), i + lines_per_section)
            for j in range(start, end):
                used.add(j)
            sections.append("\n".join(lines[start:end]))
            if len(sections) >= max_sections:
                break
    return sections


def analyze(univ, campus, pdf_path):
    out = [f"# {univ} ({campus}) 수시 모집요강 검수 보고서 (2027)\n"]
    out.append(f"**PDF**: `{pdf_path.name}` ({pdf_path.stat().st_size // 1024} KB)\n\n---\n")

    text = extract_text(pdf_path)
    if not text:
        out.append("⚠️ 텍스트 추출 실패\n")
        return "\n".join(out)

    out.append(f"전체 텍스트 길이: {len(text):,}자\n\n---\n")

    for tgt_name, kws in TARGETS.items():
        out.append(f"\n## {tgt_name}\n")
        sections = section_extract(text, kws)
        if not sections:
            out.append("(매칭 없음 — 키워드 부재 또는 형식 차이)\n")
            continue
        for si, sec in enumerate(sections):
            out.append(f"\n### 매칭 {si + 1}\n")
            out.append("```")
            out.append(sec)
            out.append("```\n")

    out.append("\n---\n## ✅ 검수 체크리스트\n")
    out.append("- [ ] 수능최저 — 전형별/계열별 등급 합 정확도")
    out.append("- [ ] 영어/한국사 등급 기준")
    out.append("- [ ] 탐구 평균 vs 개별 등급 적용 방식")
    out.append("- [ ] 전형방법 (1단계 배수 / 2단계 비율)")
    out.append("- [ ] 교과 반영비율 (공통·일반·진로선택)")
    out.append("- [ ] 모집인원 (전형별 / 모집단위별)")
    out.append("")
    return "\n".join(out)


def main():
    print("=== A. Top 30 수시 모집요강 검수 v2 (pdftotext) ===\n")
    success = 0
    for i, (univ, campus) in enumerate(TOP30, 1):
        pdf = find_pdf(univ, campus)
        if not pdf:
            print(f"[{i}/30] ❌ {univ}: PDF 없음")
            continue
        try:
            md = analyze(univ, campus, pdf)
            safe = (univ + "_" + campus).replace("/", "_")
            out_path = OUT_DIR / f"{safe}_수시검수.md"
            out_path.write_text(md, encoding="utf-8")
            print(f"[{i}/30] ✅ {univ}: {len(md):,}자")
            success += 1
        except Exception as e:
            print(f"[{i}/30] ❌ {univ}: {e}")

    # 인덱스
    idx = ["# Top 30 수시 모집요강 검수 보고서 인덱스 (v2)\n"]
    idx.append(f"생성: pdf_analyze_susi.py v2 — {success}개 대학\n\n")
    idx.append("## 대학별 보고서\n")
    for univ, campus in TOP30:
        safe = (univ + "_" + campus).replace("/", "_")
        path = OUT_DIR / f"{safe}_수시검수.md"
        if path.exists():
            idx.append(f"- [{univ} ({campus})](./{path.name})")
    (OUT_DIR / "README.md").write_text("\n".join(idx), encoding="utf-8")
    print(f"\n총 성공: {success}/30")


if __name__ == "__main__":
    main()
