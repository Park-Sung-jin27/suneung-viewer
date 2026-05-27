"""
PDF 환산공식 반자동 분석 도구

목적: 5개 대학 정시 모집요강 PDF에서
  - 영역별 반영비율 (국·수·영·탐·한)
  - 영어 등급 환산표
  - 한국사 등급 환산표
  - 탐구 가산점·선택과목 조건
  - 만점 값
후보 페이지를 자동 식별하고 표/본문 텍스트 추출.

사용자는 결과 .md 파일만 보고 PDF 직접 열지 않고 환산공식 검수.

실행:
  python pdf_analyze.py
출력:
  컨설팅_데모/검수보고서/{대학명}.md
"""

import pdfplumber
import re
from pathlib import Path
import openpyxl

PDF_DIR = Path(__file__).parent.parent / "모집요강_2027"
XLSX = Path(__file__).parent.parent / "입시데이터_마스터_v2.0.xlsx"
OUT_DIR = Path(__file__).parent / "검수보고서"
OUT_DIR.mkdir(exist_ok=True)

PDFS = {
    "서울대": "서울대학교_본교_시행계획_2027.pdf",
    "연세대": "연세대학교_본교_시행계획_2027.pdf",
    "고려대": "고려대학교_본교_시행계획_2027.pdf",
    "서강대": "서강대학교_본교_시행계획_2027.pdf",
    "성균관대": "성균관대학교_본교_시행계획_2027.pdf",
}

# 페이지 식별 키워드 그룹 — 각 그룹 모든 키워드가 페이지에 있어야 매칭
TARGETS = {
    "영역별 반영비율": {
        "must_all": ["국어", "수학", "탐구"],
        "any_of": ["반영비율", "반영 비율", "수능 영역별", "영역별 반영", "비율"],
    },
    "영어 등급 환산": {
        "must_all": ["영어"],
        "any_of": ["등급별 점수", "등급별 환산", "감점", "영어 등급", "1등급", "2등급"],
    },
    "한국사 등급 환산": {
        "must_all": ["한국사"],
        "any_of": ["등급별 점수", "감점", "등급", "1등급"],
    },
    "탐구 가산·선택": {
        "must_all": ["탐구"],
        "any_of": ["가산", "선택", "과탐", "사탐", "필수", "지정"],
    },
    "수능 만점·총점": {
        "must_all": [],
        "any_of": ["만점", "총점", "1000점", "1200점", "800점"],
    },
}


def find_target_pages(pdf, target_def, max_results=5):
    """target_def: {must_all: [...], any_of: [...]} — must_all 모두 + any_of 1개 이상"""
    must_all = target_def["must_all"]
    any_of = target_def["any_of"]
    hits = []
    for i, page in enumerate(pdf.pages):
        txt = page.extract_text() or ""
        if not all(k in txt for k in must_all):
            continue
        if any_of and not any(k in txt for k in any_of):
            continue
        # 점수: must_all 전부 있고 + any_of 매칭 개수
        score = sum(1 for k in any_of if k in txt) + len(must_all)
        hits.append((i, score))
    hits.sort(key=lambda x: -x[1])
    return [i for i, _ in hits[:max_results]]


def extract_relevant_text(page, keywords, max_lines=20):
    """페이지에서 keyword 포함 라인 + 주변 문맥 추출"""
    txt = page.extract_text() or ""
    lines = txt.split("\n")
    relevant_idx = set()
    for i, l in enumerate(lines):
        if any(k in l for k in keywords):
            for j in range(max(0, i - 1), min(len(lines), i + 3)):
                relevant_idx.add(j)
    return [lines[i] for i in sorted(relevant_idx)[:max_lines]]


def extract_tables_with_keywords(page, keywords):
    """페이지의 표 중 키워드 포함하는 것만"""
    tables = page.extract_tables() or []
    out = []
    for t in tables:
        if not t:
            continue
        flat = "|".join(["|".join([str(c) if c else "" for c in r]) for r in t])
        if any(k in flat for k in keywords):
            out.append(t)
    return out


def load_current_v2_formula(univ_name):
    """현 v2.0 환산공식 시트에서 해당 대학 row 가져오기"""
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb["환산공식_정시"]
    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]
    out = []
    for r in rows[1:]:
        if r and r[0] and (r[0] == univ_name or r[0].replace("대학교", "대") == univ_name):
            out.append(dict(zip(header, r)))
    return out


def md_table(rows):
    """rows: list of list → markdown table"""
    if not rows:
        return "(빈 표)"
    md = []
    md.append("| " + " | ".join(str(c) if c else "—" for c in rows[0]) + " |")
    md.append("|" + "|".join(["---"] * len(rows[0])) + "|")
    for r in rows[1:]:
        md.append("| " + " | ".join(str(c).replace("\n", " ") if c else "—" for c in r) + " |")
    return "\n".join(md)


def analyze_pdf(univ_name, pdf_path):
    """PDF 분석 → 마크다운 텍스트 반환"""
    out = [f"# {univ_name} 환산공식 검수 보고서\n"]
    out.append(f"**PDF**: `{pdf_path.name}`\n")
    out.append(f"**용도**: PDF 열지 말고 이 보고서로 환산공식_정시 시트 검수\n\n---\n")

    # 현 v2.0 환산공식 (잠정값) 로드
    current = load_current_v2_formula(univ_name)
    out.append(f"## 📋 현 v2.0 환산공식 (잠정 — 검수 대상)\n")
    if current:
        for f in current:
            out.append(f"### {f.get('대학명')} {f.get('계열')}")
            out.append(f"- 만점: **{f.get('만점')}**")
            out.append(f"- 반영비율: 국 {f.get('국어_반영%')}% / 수 {f.get('수학_반영%')}% / 영 {f.get('영어_반영%')}% / 탐 {f.get('탐구_반영%')}% / 한 {f.get('한국사_반영%')}%")
            out.append(f"- 지표: 국 {f.get('국어_지표')} / 수 {f.get('수학_지표')} / 탐 {f.get('탐구_지표')}")
            eng = [f.get(f'영어_{i}등급') for i in range(1, 10)]
            out.append(f"- 영어 등급: {eng}")
            hist = [f.get(f'한국사_{i}등급') for i in range(1, 10)]
            out.append(f"- 한국사 등급: {hist}")
            out.append(f"- 수학 선택지정: {f.get('수학_선택지정')}")
            out.append(f"- 탐구 영역지정: {f.get('탐구_영역지정')}")
            out.append(f"- 가산점: {f.get('가산점')}")
            out.append(f"- 출처: **{f.get('출처_검증필요')}**\n")
    else:
        out.append("(v2.0에 등록 없음 — 신규 추가 필요)\n")

    out.append("\n---\n## 🔍 PDF 자동 분석 결과\n")

    with pdfplumber.open(pdf_path) as pdf:
        out.append(f"총 페이지: {len(pdf.pages)}\n")

        for target_name, target_def in TARGETS.items():
            out.append(f"\n### {target_name}\n")
            pages = find_target_pages(pdf, target_def)
            if not pages:
                out.append("(매칭 페이지 없음)\n")
                continue
            out.append(f"후보 페이지: **{[p + 1 for p in pages]}** (1-base)\n")

            # 가장 점수 높은 페이지의 표 + 본문
            top_page_idx = pages[0]
            p = pdf.pages[top_page_idx]

            # 키워드: must_all + any_of 일부
            all_kws = target_def["must_all"] + target_def["any_of"][:3]

            # 표 추출
            tables = extract_tables_with_keywords(p, all_kws)
            if tables:
                out.append(f"\n**페이지 {top_page_idx + 1} 표 (자동 추출):**\n")
                for ti, t in enumerate(tables[:2]):
                    out.append(f"\n표 {ti + 1}:\n")
                    out.append(md_table(t[:12]))
                    out.append("")

            # 본문 텍스트
            lines = extract_relevant_text(p, all_kws)
            if lines:
                out.append(f"\n**페이지 {top_page_idx + 1} 관련 문장:**\n")
                out.append("```")
                for l in lines:
                    out.append(l)
                out.append("```\n")

    out.append("\n---\n## ✅ 검수 체크리스트\n")
    out.append("- [ ] 만점 값 (1000? 1200? 다른 값?) 확인")
    out.append("- [ ] 반영비율 (국·수·영·탐·한) 정확도")
    out.append("- [ ] 국어/수학/탐구 활용지표 (표점·백분위·변환표점)")
    out.append("- [ ] 영어 등급별 점수/감점 정확도 (9등급 모두)")
    out.append("- [ ] 한국사 등급별 점수/감점 정확도")
    out.append("- [ ] 수학 선택과목 지정 (자유? 미적·기하 필수?)")
    out.append("- [ ] 탐구 영역 지정 (자유? 과탐 필수? 직탐 제외?)")
    out.append("- [ ] 가산점·감점 방식")
    out.append("- [ ] 차이 발견 시 환산공식_정시 시트 수정 + 출처 라벨 '2027 입학처 PDF' 격상\n")

    return "\n".join(out)


def main():
    print(f"=== B-1 반자동 검수 보고서 생성 ===")
    print(f"출력 폴더: {OUT_DIR}\n")
    for univ_name, pdf_fn in PDFS.items():
        pdf_path = PDF_DIR / pdf_fn
        if not pdf_path.exists():
            print(f"❌ {univ_name}: PDF 없음 ({pdf_fn})")
            continue
        try:
            md = analyze_pdf(univ_name, pdf_path)
            out_path = OUT_DIR / f"{univ_name}_환산공식_검수.md"
            out_path.write_text(md, encoding="utf-8")
            print(f"✅ {univ_name}: {out_path.name} ({len(md):,}자)")
        except Exception as e:
            print(f"❌ {univ_name}: {e}")

    # 인덱스 파일
    index = ["# 환산공식 검수 보고서 인덱스\n"]
    index.append(f"생성: 컨설팅_데모/pdf_analyze.py\n")
    index.append(f"5개 대학 × 5개 항목 자동 분석 결과\n\n")
    index.append("## 대학별 보고서\n")
    for univ in PDFS:
        index.append(f"- [{univ}](./{univ}_환산공식_검수.md)")
    index.append("\n## 검수 워크플로\n")
    index.append("1. 각 대학 .md 파일 열기")
    index.append("2. '현 v2.0 환산공식' 섹션 vs 'PDF 자동 분석 결과' 섹션 비교")
    index.append("3. 차이 발견 시 입시데이터_마스터_v2.0.xlsx → 환산공식_정시 시트 수정")
    index.append("4. 출처_검증필요 컬럼: '잠정' → '2027 입학처 PDF'")
    index.append("5. 대학당 약 15분 예상")
    (OUT_DIR / "README.md").write_text("\n".join(index), encoding="utf-8")
    print(f"\n✅ 인덱스: {OUT_DIR / 'README.md'}")
    print(f"\n총 소요 예상: 대학당 15분 × 5 = 1.25시간\n")


if __name__ == "__main__":
    main()
