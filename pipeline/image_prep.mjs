// image_prep.mjs — 원본 PDF 이미지를 서비스 규격 PNG 로 정리 (발주 D-88 ②)
//
// 하는 일
//   ① 원본 PDF 에서 지정한 이미지를 꺼낸다 (xref 또는 w×h 로 지목)
//   ② 흰 여백을 잘라낸다 (trim)
//   ③ 폭을 서비스 규격으로 줄인다 (기존 public/images 는 bogi 류가 폭 1000~1950)
//   ④ public/images/<연도>_<setId>_q<문항>_<용도>.png 로 저장
//
// 🔴 데이터(all_data_204.json)는 건드리지 않는다. 파일만 만든다.
//    참조를 넣는 것은 심사관 확인 뒤 별도 발주다. 그때까지 이 파일들은 아무 데서도 안 쓰인다.
//
// 사용: node pipeline/image_prep.mjs        (대상은 아래 JOBS 에 박아 둔다)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/images");
const PY = path.join(ROOT, "pipeline/_image_prep.py");

// 대상 — 발주 D-88 ② 파일럿
//   p6(Q15)은 뺐다. 확인해 보니 「국어사전을 만드는 활동」= 문법 영역이라 서비스 대상이 아니다.
const JOBS = [
  { yk: "2019수능", page: 10, w: 2551, h: 1770, out: "2019_r2019d_q27_bogi.png",
    width: 1200, alt: "학생의 독서 기록 — 읽기 계획, 예측 및 질문 내용, 점검 결과 표" },
  { yk: "2019수능", page: 11, w: 1006, h: 864, out: "2019_r2019d_q31_bogi.png",
    width: 900, alt: "구 껍질을 이루는 부피 요소와 점 P·O 를 나타낸 동심원 그림" },
];

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(PY, `# -*- coding: utf-8 -*-
# image_prep.mjs 가 호출하는 실제 이미지 처리기 (PyMuPDF)
#
# 🔴 이미지 객체를 꺼내는 대신 **페이지의 그 영역을 렌더링**한다.
#    수능 PDF 는 그림 위에 글자를 벡터로 따로 얹는 경우가 많다.
#    이미지 객체만 꺼내면 테두리만 남고 글자가 빠진다(D-80 에서 실증).
#    영역 렌더링은 보이는 그대로를 담는다. 여백 컷도 rect 가 대신한다.
import sys, os, fitz

pdf, page_no, w, h, out, target_w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5], int(sys.argv[6])
doc = fitz.open(pdf)
page = doc[page_no - 1]
im = next((i for i in page.get_images(full=True) if i[2] == w and i[3] == h), None)
if im is None:
    print("NOTFOUND"); sys.exit(1)
rects = page.get_image_rects(im[0])
if not rects:
    print("NOTFOUND"); sys.exit(1)
r = rects[0]
pad = 2.0
clip = fitz.Rect(max(0, r.x0 - pad), max(0, r.y0 - pad),
                 min(page.rect.width, r.x1 + pad), min(page.rect.height, r.y1 + pad))
dpi = int(round(target_w / (clip.width / 72.0)))
dpi = max(96, min(dpi, 600))
pix = page.get_pixmap(clip=clip, dpi=dpi)
pix.save(out)
print("OK %d %d %.0f %.0f %d %d %d" % (w, h, clip.width, clip.height, pix.width, pix.height, dpi))
`, "utf8");

console.log("## 이미지 정리 — 발주 D-88 ②\n");
const report = [];
for (const j of JOBS) {
  const dir = path.join(ROOT, "_done", j.yk);
  const pdf = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith(".pdf") && f.includes("시험지")));
  const dst = path.join(OUT, j.out);
  const r = execFileSync("python", [PY, pdf, String(j.page), String(j.w), String(j.h), dst, String(j.width)],
    { env: { ...process.env, PYTHONIOENCODING: "utf-8" } }).toString().trim();
  if (r.startsWith("NOTFOUND")) { console.log(`  🔴 ${j.out} — 원본에서 못 찾음`); continue; }
  const [, W, H, cw, ch, fw, fh, dpi] = r.split(/\s+/);
  const kb = (fs.statSync(dst).size / 1024).toFixed(0);
  console.log(`  ✅ ${j.out}`);
  console.log(`     원본 이미지 ${W}×${H} · 지면 영역 ${cw}×${ch}pt → 렌더 ${fw}×${fh}px @${dpi}dpi (${kb}KB)`);
  report.push({ ...j, W, H, cw, ch, fw, fh, dpi, kb });
}
fs.unlinkSync(PY);
fs.writeFileSync(path.join(ROOT, "pipeline/reextract/image_prep_report.json"),
  JSON.stringify(report, null, 2), "utf8");
console.log(`\n저장: public/images/  ·  데이터는 건드리지 않았다(참조 없음 = 화면 영향 없음)`);
