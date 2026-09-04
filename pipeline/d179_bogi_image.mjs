// d179_bogi_image.mjs — r20209d Q41 <보기> 도식 삽입 (발주 D-179 · 긴급)
//
// LIVE 결함: 발문이 "3개의 비콘 신호를 받은 상태를 도식화한 것이다" 인데
// 데이터에 그림이 없다. bogi 가 각주 문자열뿐이라 학생이 문항을 못 푼다.
// 대표 승인 — 노출 유지 + 긴급 삽입.
//
// ★ 발주와 다르게 한 것 3가지 (전부 실측 근거가 있다)
//   ⓐ `pdftoppm -r 200` 을 안 쓴다 — 이 환경에 pdftoppm 이 없다(`command not found`).
//      확립된 경로인 `image_prep.mjs` 의 PyMuPDF 영역 렌더를 쓴다.
//      D-80 교훈: 수능 PDF 는 그림 위에 글자를 벡터로 얹는 경우가 많아
//      이미지 객체만 꺼내면 글자가 빠진다. **지면의 그 영역을 렌더**한다.
//      200dpi 는 132pt 폭에서 367px 밖에 안 된다. 기존 bogi 자산은 폭 1000~1950 이라
//      원본 해상도(600dpi · 1067px)에 맞춰 폭 1100 으로 뽑는다.
//   ⓑ 41번은 지면 **좌측** 단이다(발주는 "우측"). x 88~410 · y 159~708 로 실측했다.
//   ⓒ 파일명 — 기존 자산이 전부 `<4자리 학년도>_<setId>_q<번호>_<용도>.png` 다.
//      발주의 `20209_` 는 5자리라 관례에서 벗어났다. 처음엔 발주 문면을 그대로
//      따르고 보고에 올렸고, **D-182 ① 에서 심사관이 오기로 판정**해 관례로
//      되돌렸다. 교체는 `d182_asset_rename.mjs` 가 했다.
//
// ★ 도식 위치 (실측)
//   p15(1-based) · <보 기> 상자 = x 99~406 · y 230~477
//   도식 = 이미지 객체 xref 46 · 1067×1139px · 지면 rect [188,245,316,382]
//   각주("* 각 원의 반지름은…")는 y 394 부터 — 도식만 잘라낸다. 각주는 이미 bogi 에 있다.
//
// ★ bogi 가 지금 **문자열**이다 — 객체로 바꿔야 image 를 달 수 있다
//   관례는 2026_s3(`r2026c` Q12) 을 복제한다: bogi.image + bogiImage.url 병행.
//   다만 `bogiImage` 는 `src/` 어디에서도 읽히지 않는다(소비처 0). 실제로 그려지는 것은
//   `bogi.image` 뿐이다. 발주 명시라 병행해 넣되, 이 사실을 보고에 적는다.
//   S-07 — 객체형 bogi 는 gate3 필수다(`r20246c` 백지 크래시 전례).
//
// 사용:
//   node pipeline/d179_bogi_image.mjs --render    PNG 만 만든다 (데이터 무변)
//   node pipeline/d179_bogi_image.mjs             데이터 미리보기
//   node pipeline/d179_bogi_image.mjs --apply     데이터 적용 + 되읽기 검산

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const RENDER = process.argv.includes("--render");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

// ── 발주 SPEC ────────────────────────────────────────────────────────────
const YK = "2020_9월", SID = "r20209d", QID = 41;
const PAGE = 15;                 // 1-based
const IMG_W = 1067, IMG_H = 1139; // 도식 이미지 객체 크기 (지목용)
const TARGET_W = 1100;            // 원본 해상도(600dpi) 근사
// D-182 ① — 심사관 판정: 발주 D-179 의 `20209_` 는 오기였다.
// 기존 자산 38개가 4자리 학년도 접두사다. 관례로 되돌렸다.
const FILE = "2020_r20209d_q41_bogi.png";
const URL = `/images/${FILE}`;
// alt 는 렌더한 그림을 눈으로 보고 적었다 (§13⑬ — 원문 없이 만들지 않는다)
const ALT = "비콘1·비콘2·비콘3을 각각 중심으로 하는 세 원이 한 점 P에서 만나고, 비콘1과 비콘3 사이에 장애물 Q가 네모 표시된 도식";
const OUT = path.join(ROOT, "public/images", FILE);

const findSet = (data, yk, sid) => {
  for (const sec of ["reading", "literature"]) {
    const s = (data[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (s) return { sec, s };
  }
  return null;
};

console.log("# r20209d Q41 <보기> 도식 삽입 (D-179 · 긴급)");
console.log("");

// ── ① 렌더 ──────────────────────────────────────────────────────────────
if (RENDER) {
  const dir = path.join(ROOT, "_done", YK);
  const pdfName = fs.readdirSync(dir).find((f) => f.endsWith(".pdf") && f.includes("시험지"));
  if (!pdfName) { console.log(`🔴 ${dir} 에 시험지 PDF 가 없다`); process.exit(1); }
  const pdf = path.join(dir, pdfName);

  const PY = path.join(ROOT, "pipeline/_d179_render.py");
  fs.writeFileSync(PY, `# -*- coding: utf-8 -*-
# 지면의 그 영역을 렌더한다 — 이미지 객체 추출 금지 (D-80)
import sys, fitz
pdf, page_no, w, h, out, target_w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5], int(sys.argv[6])
doc = fitz.open(pdf)
page = doc[page_no - 1]
im = next((i for i in page.get_images(full=True) if i[2] == w and i[3] == h), None)
if im is None:
    print("NOTFOUND"); sys.exit(1)
rects = page.get_image_rects(im[0])
if len(rects) != 1:
    print("AMBIGUOUS %d" % len(rects)); sys.exit(1)
r = rects[0]
pad = 2.0
clip = fitz.Rect(max(0, r.x0 - pad), max(0, r.y0 - pad),
                 min(page.rect.width, r.x1 + pad), min(page.rect.height, r.y1 + pad))
dpi = int(round(target_w / (clip.width / 72.0)))
dpi = max(96, min(dpi, 600))
pix = page.get_pixmap(clip=clip, dpi=dpi)
pix.save(out)
print("OK %.1f %.1f %.1f %.1f %d %d %d" % (clip.x0, clip.y0, clip.x1, clip.y1, pix.width, pix.height, dpi))
`, "utf8");

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const existed = fs.existsSync(OUT);
  const r = execFileSync("python", [PY, pdf, String(PAGE), String(IMG_W), String(IMG_H), OUT, String(TARGET_W)],
    { env: { ...process.env, PYTHONIOENCODING: "utf-8" } }).toString().trim();
  fs.unlinkSync(PY);
  if (r.startsWith("NOTFOUND")) { console.log(`🔴 p${PAGE} 에서 ${IMG_W}×${IMG_H} 도식을 못 찾았다`); process.exit(1); }
  if (r.startsWith("AMBIGUOUS")) { console.log(`🔴 같은 크기 도식이 여러 곳이다 — 지목 실패 (${r})`); process.exit(1); }
  const [, x0, y0, x1, y1, fw, fh, dpi] = r.split(/\s+/);

  const buf = fs.readFileSync(OUT);
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  console.log("## ① 렌더");
  console.log("");
  console.log(`- 원본 \`_done/${YK}/${pdfName}\` p${PAGE}`);
  console.log(`- 도식 이미지 객체 ${IMG_W}×${IMG_H} → 지면 영역 [${x0}, ${y0}, ${x1}, ${y1}]pt`);
  console.log(`- 렌더 **${fw}×${fh}px @${dpi}dpi** · ${(buf.length / 1024).toFixed(0)}KB · PNG 서명 ${isPng ? "✅" : "🔴"}`);
  console.log(`- 저장 \`public/images/${FILE}\`${existed ? " (덮어썼다)" : " (신규)"}`);
  console.log("");
  if (!isPng) process.exit(1);
  console.log("- 🔴 **데이터는 안 건드렸다.** 참조가 없으므로 화면 영향 0. 그림을 눈으로 본 뒤 `--apply`.");
  process.exit(0);
}

// ── ② 데이터 ────────────────────────────────────────────────────────────
const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\``);
console.log("");

const miss = [];
if (!fs.existsSync(OUT)) miss.push(`🔴 \`public/images/${FILE}\` 이 없다 — 먼저 \`--render\``);
const f = findSet(data, YK, SID);
if (!f) miss.push(`${YK}::${SID} 세트 없음`);
const q = f && (f.s.questions || []).find((x) => x.id === QID);
if (f && !q) miss.push(`${SID} Q${QID} 문항 없음`);

let plan = null;
if (q) {
  const b = q.bogi;
  if (typeof b !== "string") miss.push(`${SID} Q${QID} — bogi 가 문자열이 아니다 (${typeof b}). 전제와 다르다`);
  else if (!b.trim()) miss.push(`${SID} Q${QID} — bogi 가 비어 있다`);
  else if (q.bogiImage != null) miss.push(`${SID} Q${QID} — 이미 bogiImage 가 있다 (덮어쓰기 위험)`);
  else if (!/도식화/.test(q.t || "")) miss.push(`${SID} Q${QID} — 발문에 "도식화" 가 없다. 대상이 맞는지 의심`);
  else {
    plan = {
      oldBogi: b,
      newBogi: { type: "annotated_image", text: b, image: URL },
      newBogiImage: { url: URL, alt: ALT },
    };
  }
}

console.log("## ② 데이터");
console.log("");
if (plan) {
  console.log(`- 대상 \`${YK}::${SID}\` Q${QID} (${f.sec})`);
  console.log(`- 발문 — ${q.t}`);
  console.log("");
  console.log("| 필드 | 적용 전 | 적용 후 |");
  console.log("|---|---|---|");
  console.log(`| \`bogi\` | 문자열 ${plan.oldBogi.length}자 | 객체 \`{type, text, image}\` — text 는 **같은 문자열 그대로** |`);
  console.log(`| \`bogi.image\` | — | \`${URL}\` |`);
  console.log(`| \`bogiImage\` | \`null\` | \`{url, alt}\` |`);
  console.log("");
  console.log(`- \`alt\` — ${ALT}`);
  console.log("- ⚠ 세로 배치는 **텍스트가 위, 이미지가 아래**다(`QuizPanel.jsx:681`).");
  console.log("  원본 지면은 도식이 위·각주가 아래라 순서가 뒤집힌다. 바꾸려면 프론트 발주가 필요하다.");
  console.log("  (`imagePosition: 'top'` 은 주석에만 있고 코드에 분기가 없다 — 넣어도 안 바뀐다)");
  console.log("");
}
if (miss.length) {
  console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다");
  console.log("");
  miss.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.mkdirSync(path.join(ROOT, "pipeline/backups"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d179.json"), before);

const sents0 = JSON.stringify(f.s.sents);
const choices0 = JSON.stringify(q.choices);
q.bogi = plan.newBogi;
q.bogiImage = plan.newBogiImage;
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 (S-02) ──────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
if (after[0] === 0xef) { console.log("🔴 BOM 이 붙었다"); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const f2 = findSet(back, YK, SID);
const q2 = f2 && (f2.s.questions || []).find((x) => x.id === QID);
const fail = [];
if (!q2) fail.push("문항 소실");
else {
  const b = q2.bogi;
  if (typeof b !== "object" || Array.isArray(b)) fail.push("bogi 가 객체가 아니다");
  else {
    if (b.type !== "annotated_image") fail.push(`bogi.type 미반영 (${b.type})`);
    if (b.image !== URL) fail.push(`bogi.image 미반영 (${b.image})`);
    if (b.text !== plan.oldBogi) fail.push("**bogi.text 가 원래 문자열과 다르다**");
  }
  if (q2.bogiImage?.url !== URL) fail.push("bogiImage.url 미반영");
  if (q2.bogiImage?.alt !== ALT) fail.push("bogiImage.alt 미반영");
  if (JSON.stringify(q2.choices) !== choices0) fail.push("**선지가 달라졌다**");
  if (JSON.stringify(f2.s.sents) !== sents0) fail.push("**본문이 달라졌다**");
  // 참조가 실제 파일을 가리키는가
  const disk = path.join(ROOT, "public", URL);
  if (!fs.existsSync(disk)) fail.push(`🔴 참조 대상 파일이 없다 — ${URL}`);
  else {
    const buf = fs.readFileSync(disk);
    if (!(buf[0] === 0x89 && buf[1] === 0x50)) fail.push("참조 대상이 PNG 가 아니다");
  }
  // 렌더 분기가 실제로 이미지를 잡는가 — resolveBogiImage 규약 재현
  const raw = typeof b.image === "string" ? b.image : (b.image?.url ?? "");
  if (!raw) fail.push("resolveBogiImage 가 빈 값을 받는다 — 화면에 그림이 안 나온다");
}

// LIVE 전수 — 깨진 이미지 참조가 없는가
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at0 = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at0, src.indexOf("]);", at0)).matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.includes("::")));
let refN = 0, refBad = [];
for (const [yk, v] of Object.entries(back)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  if (!REL.has(`${yk}::${st.setId || st.id}`)) continue;
  for (const qq of st.questions || []) {
    const b = qq.bogi;
    if (!b || typeof b !== "object" || Array.isArray(b) || !b.image) continue;
    const raw = typeof b.image === "string" ? b.image : (b.image?.url ?? "");
    if (!raw) continue;
    refN++;
    const rel = raw.startsWith("/") ? raw : `/images/${raw}`;
    if (!fs.existsSync(path.join(ROOT, "public", rel))) refBad.push(`${yk}::${st.setId || st.id} Q${qq.id} → ${rel}`);
  }
}

console.log(`- 적용 후 MD5 \`${md5(after)}\` (+${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.before_d179.json`");
console.log("");
if (fail.length) {
  console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오");
  console.log("");
  fail.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log("- `bogi` 객체 전환 · `type`·`image`·`bogiImage` 반영");
console.log("- **`bogi.text` 는 원래 각주 문자열 그대로** · 선지·본문 무변");
console.log(`- 참조 대상 \`public${URL}\` 실재 · PNG 서명 확인`);
console.log("");
console.log("### LIVE 전수 재확인");
console.log("");
console.log(`- \`bogi.image\` 참조 보유 문항: **${refN}건**`);
console.log(`- 깨진 참조: ${refBad.length ? `🔴 **${refBad.length}건** — ${refBad.join(" · ")}` : "**0건**"}`);
