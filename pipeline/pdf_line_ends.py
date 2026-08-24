# PDF 줄 끝 공백 정보를 뽑아 JSON 으로 저장 — 줄바꿈 판별의 원본 근거
# 사용: python line_end.py <pdf> <out.json>
import sys, json, fitz

pdf, out = sys.argv[1], sys.argv[2]
doc = fitz.open(pdf)
lines = []
for pno, pg in enumerate(doc):
    for blk in pg.get_text("dict").get("blocks", []):
        for ln in blk.get("lines", []):
            t = "".join(s.get("text", "") for s in ln.get("spans", []))
            if not t.strip():
                continue
            lines.append({"p": pno, "t": t, "sp": t.endswith(" ")})
tot = len(lines)
sp = sum(1 for x in lines if x["sp"])
json.dump({"lines": lines, "total": tot, "space_end": sp}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print(f"lines={tot} space_end={sp} ({sp/tot*100:.1f}%)")
# 근거: 수능 국어 PDF 는 어절 경계에서 줄이 바뀔 때 공백 문자를 줄 끝에 남기고,
#       어절 중간에서 강제 절단할 때는 남기지 않는다(2016_6월B 표본 14/14 검증).
#       이 파일은 그 공백 정보만 뽑는다 — 텍스트를 만들지 않는다(§13⑬).
