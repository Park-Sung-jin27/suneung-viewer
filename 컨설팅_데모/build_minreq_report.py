# -*- coding: utf-8 -*-
"""
B 후속: 수능최저 검수 한 페이지 요약 markdown 생성
검수보고서_수시/*.md → 검수보고서_수시/수능최저_요약.md

사용자가 한 페이지에서 30개 학교 수능최저만 빠르게 검수.
"""
import re
from pathlib import Path

REPORT_DIR = Path(__file__).parent / "검수보고서_수시"

TOP30 = [
    "서울대학교", "연세대학교", "고려대학교", "서강대학교", "성균관대학교",
    "한양대학교", "중앙대학교", "경희대학교", "한국외국어대학교", "서울시립대학교",
    "건국대학교", "동국대학교", "홍익대학교", "숙명여자대학교", "이화여자대학교",
    "국민대학교", "세종대학교", "단국대학교", "아주대학교", "인하대학교",
    "가천대학교", "광운대학교", "서울과학기술대학교", "한국항공대학교",
    "부산대학교", "전남대학교", "경북대학교", "충남대학교", "전북대학교", "강원대학교",
]

def extract_min_section(md_text):
    """수능최저학력기준 섹션만 발췌"""
    m = re.search(r"## 수능최저학력기준\n([\s\S]+?)\n## ", md_text)
    if not m:
        return ""
    sec = m.group(1)
    # 코드 블록만 추출
    blocks = re.findall(r"```\n([\s\S]+?)\n```", sec)
    if blocks:
        return "\n\n".join(b.strip() for b in blocks[:3])
    return sec[:2000]


out = ["# Top 30 수시 수능최저학력기준 요약 (2027)\n",
       "각 대학별 검수 보고서에서 수능최저 섹션만 추출. 한 페이지에서 빠르게 검수 + 입력.\n",
       "검수 후 사용자가 별도 시트 (예: 수능최저_2027.xlsx) 에 정리 → 데모 엔진에 통합 가능.\n",
       "\n---\n"]

for univ in TOP30:
    path = REPORT_DIR / f"{univ}_본교_수시검수.md"
    if not path.exists():
        out.append(f"\n## {univ}\n(보고서 없음)\n")
        continue
    text = path.read_text(encoding="utf-8")
    sec = extract_min_section(text)
    out.append(f"\n## {univ}\n")
    if sec:
        out.append("```")
        out.append(sec[:1800])
        out.append("```\n")
    else:
        out.append("⚠️ 수능최저 섹션 매칭 없음 — PDF 직접 확인 필요\n")

(REPORT_DIR / "수능최저_요약.md").write_text("\n".join(out), encoding="utf-8")
print(f"생성: {REPORT_DIR / '수능최저_요약.md'}")
print(f"크기: {sum(len(x) for x in out):,}자")
