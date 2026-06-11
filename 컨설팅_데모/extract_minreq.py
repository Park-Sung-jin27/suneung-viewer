# -*- coding: utf-8 -*-
"""
B. 수능최저학력기준 자동 추출 (정규식 기반)
검수보고서_수시/*.md → susi_minreq.json

추출 항목:
  - 수능최저 적용 여부 (true/false)
  - 영역 수 (3개·2개·N개)
  - 등급 합 (X 이내)
  - 영어 등급 기준
  - 한국사 등급 기준
  - 탐구 평균 vs 개별 여부
"""
import re
import json
from pathlib import Path

REPORT_DIR = Path(__file__).parent / "검수보고서_수시"
OUT = Path(__file__).parent / "js" / "susi_minreq.js"

TOP30 = [
    "서울대학교", "연세대학교", "고려대학교", "서강대학교", "성균관대학교",
    "한양대학교", "중앙대학교", "경희대학교", "한국외국어대학교", "서울시립대학교",
    "건국대학교", "동국대학교", "홍익대학교", "숙명여자대학교", "이화여자대학교",
    "국민대학교", "세종대학교", "단국대학교", "아주대학교", "인하대학교",
    "가천대학교", "광운대학교", "서울과학기술대학교", "한국항공대학교",
    "부산대학교", "전남대학교", "경북대학교", "충남대학교", "전북대학교", "강원대학교",
]

# 정규식 패턴 — 다양한 표현 흡수
RE_AREA_SUM = re.compile(r"(\d+)개\s*영역\s*등급\s*합(?:이|\s+)?\s*(\d+)(?:등급)?\s*이내")
RE_AREA_SUM_ALT = re.compile(r"(\d+)개\s*등급\s*합(?:이|\s+)?\s*(\d+)\s*이내")
RE_ENG = re.compile(r"영어[\s\S]{0,15}(\d)등급")
RE_HIST = re.compile(r"한국사[\s\S]{0,15}(\d)등급")
RE_TAM_AVG = re.compile(r"탐구.{0,10}(?:2개\s*과목\s*등급\s*평균|평균을?\s*반영|2과목\s*평균)")
RE_TAM_IND = re.compile(r"탐구.{0,15}(?:개별\s*과목\s*등급|개별과목)")
RE_NO_MIN = re.compile(r"(?:수능\s*최저|최저\s*학력)[\s\S]{0,30}(?:적용하지\s*않|미적용|없음)")

def extract_from_report(md_path):
    text = md_path.read_text(encoding="utf-8")
    result = {
        "has_min": True,
        "areas": [],         # [{"areas_count":3, "sum":7}, ...]
        "english_grade": None,
        "korean_history_grade": None,
        "tamgu_avg": None,    # True=평균, False=개별, None=불명
        "raw_excerpts": [],
    }

    # 수능최저 미적용?
    if RE_NO_MIN.search(text):
        # 단, "수능 최저학력기준이 적용되는 전형" 같은 헤더도 있어서 false positive 주의
        # 분명한 부정문 ("적용하지 않음") 만 미적용으로
        if re.search(r"(?:최저|기준).{0,5}(?:적용하지\s*않|미적용)", text):
            result["has_min"] = False

    # 영역 수 + 등급 합
    for m in RE_AREA_SUM.finditer(text):
        result["areas"].append({"areas_count": int(m.group(1)), "sum": int(m.group(2))})
    for m in RE_AREA_SUM_ALT.finditer(text):
        item = {"areas_count": int(m.group(1)), "sum": int(m.group(2))}
        if item not in result["areas"]:
            result["areas"].append(item)

    # 영어 등급 (가장 작은 등급 = 가장 엄격)
    eng_grades = [int(m.group(1)) for m in RE_ENG.finditer(text)]
    if eng_grades:
        result["english_grade"] = min(eng_grades)

    # 한국사
    hist_grades = [int(m.group(1)) for m in RE_HIST.finditer(text)]
    if hist_grades:
        result["korean_history_grade"] = min(hist_grades)

    # 탐구 평균/개별
    if RE_TAM_AVG.search(text):
        result["tamgu_avg"] = True
    elif RE_TAM_IND.search(text):
        result["tamgu_avg"] = False

    # 원문 발췌 (수능최저 섹션만)
    sec_match = re.search(r"## 수능최저학력기준\n([\s\S]+?)\n## ", text)
    if sec_match:
        excerpt = sec_match.group(1)[:1500]
        result["raw_excerpts"].append(excerpt)

    return result


def main():
    out = {}
    for univ in TOP30:
        path = REPORT_DIR / f"{univ}_본교_수시검수.md"
        if not path.exists():
            print(f"❌ {univ}: 보고서 없음")
            continue
        result = extract_from_report(path)
        out[univ] = result
        n_areas = len(result["areas"])
        eng = result["english_grade"]
        hist = result["korean_history_grade"]
        has = "✓" if result["has_min"] else "✗"
        print(f"  [{has}] {univ}: 영역 {n_areas}건, 영어 {eng}등급, 한국사 {hist}등급, 탐구평균={result['tamgu_avg']}")

    js = ("// 자동 생성 — extract_minreq.py\n"
          "window.SUSI_MINREQ = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n")
    OUT.write_text(js, encoding="utf-8")
    print(f"\n저장: {OUT} ({len(js):,} bytes)")
    # 통계
    has_min = sum(1 for v in out.values() if v["has_min"])
    print(f"수능최저 적용 학교: {has_min}/{len(out)}")
    with_eng = sum(1 for v in out.values() if v["english_grade"])
    print(f"영어 등급 기준 추출: {with_eng}/{len(out)}")


if __name__ == "__main__":
    main()
