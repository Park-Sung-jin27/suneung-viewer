// d182_asset_rename.mjs — Q41 도식 자산 파일명을 관례로 교체 (발주 D-182 ①)
//
// 심사관 판정: 발주 D-179 의 파일명 `20209_` 는 오기였다.
// 기존 자산 39개가 전부 4자리 학년도 접두사(`<학년도>_<setId>_q<번호>_<용도>.png`)다.
//
//   20209_r20209d_q41_bogi.png  →  2020_r20209d_q41_bogi.png
//
// ★ 파일과 데이터 참조를 **한 번에** 바꾼다
//   따로 하면 그 사이에 「데이터가 없는 파일을 가리키는」 상태가 생긴다.
//   이 세트는 LIVE 라 그 상태로 배포되면 화면에서 그림이 사라진다.
//   그래서 커밋도 파일 rename 과 데이터 참조를 한 커밋에 넣는다.
//
// ★ 참조는 두 군데다 — `bogi.image` 와 `bogiImage.url`
//   `bogiImage` 는 src/ 에서 안 읽히지만(소비처 0) 데이터 정합은 맞춘다.
//   한쪽만 바꾸면 나중에 어느 쪽이 정본인지 모르게 된다.
//
// 사용: node pipeline/d182_asset_rename.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

const YK = "2020_9월", SID = "r20209d", QID = 41;
const OLD_FILE = "20209_r20209d_q41_bogi.png";
const NEW_FILE = "2020_r20209d_q41_bogi.png";
const OLD_URL = `/images/${OLD_FILE}`;
const NEW_URL = `/images/${NEW_FILE}`;
const OLD_PATH = path.join(ROOT, "public/images", OLD_FILE);
const NEW_PATH = path.join(ROOT, "public/images", NEW_FILE);

const findSet = (data, yk, sid) => {
  for (const sec of ["reading", "literature"]) {
    const s = (data[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (s) return { sec, s };
  }
  return null;
};

console.log("# Q41 도식 자산 파일명 관례 교체 (D-182 ①)");
console.log("");

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\``);
console.log("");

// ── 관례 실측 재확인 — 판정 근거를 도구가 다시 센다 ──────────────────────
const all = fs.readdirSync(path.join(ROOT, "public/images")).filter((f) => f.endsWith(".png"));
const four = all.filter((f) => /^\d{4}_/.test(f));
const five = all.filter((f) => /^\d{5}_/.test(f));
const other = all.filter((f) => !/^\d{4,5}_/.test(f));
console.log("## 파일명 관례 실측");
console.log("");
console.log(`- 4자리 학년도 접두사: **${four.length}개**`);
console.log(`- 5자리 접두사: **${five.length}개** ${five.length ? `(${five.join(", ")})` : ""}`);
console.log(`- 접두사 없음(기호·공용 자산): ${other.length}개 — ${other.join(", ")}`);
console.log("");

const miss = [];
if (!fs.existsSync(OLD_PATH)) miss.push(`🔴 \`${OLD_FILE}\` 이 없다`);
if (fs.existsSync(NEW_PATH)) miss.push(`🔴 \`${NEW_FILE}\` 이 이미 있다 — 덮어쓰기 위험`);

const f = findSet(data, YK, SID);
if (!f) miss.push(`${YK}::${SID} 세트 없음`);
const q = f && (f.s.questions || []).find((x) => x.id === QID);
if (f && !q) miss.push(`${SID} Q${QID} 문항 없음`);
if (q) {
  if (typeof q.bogi !== "object" || Array.isArray(q.bogi)) miss.push(`${SID} Q${QID} — bogi 가 객체가 아니다`);
  else if (q.bogi.image !== OLD_URL) miss.push(`${SID} Q${QID} — bogi.image 가 \`${q.bogi.image}\` 다 (전제 \`${OLD_URL}\`)`);
  if (q.bogiImage?.url !== OLD_URL) miss.push(`${SID} Q${QID} — bogiImage.url 이 \`${q.bogiImage?.url}\` 다`);
}
// 옛 경로를 가리키는 다른 참조가 있는가 (전수)
const oldRefs = [];
for (const [yk, v] of Object.entries(data)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  for (const qq of st.questions || []) {
    const s = JSON.stringify({ b: qq.bogi, bi: qq.bogiImage });
    if (s.includes(OLD_FILE)) oldRefs.push(`${yk}::${st.setId || st.id} Q${qq.id}`);
  }
}
console.log(`- 옛 경로 \`${OLD_FILE}\` 참조 문항: **${oldRefs.length}건** ${oldRefs.length ? `(${oldRefs.join(" · ")})` : ""}`);
console.log("");
if (oldRefs.length !== 1) miss.push(`🔴 옛 경로 참조가 1건이 아니다 (${oldRefs.length}건) — 일괄 교체 범위가 불확실하다`);

console.log("## 교체");
console.log("");
console.log("| 대상 | 적용 전 | 적용 후 |");
console.log("|---|---|---|");
console.log(`| 파일 | \`public/images/${OLD_FILE}\` | \`public/images/${NEW_FILE}\` |`);
console.log(`| \`bogi.image\` | \`${OLD_URL}\` | \`${NEW_URL}\` |`);
console.log(`| \`bogiImage.url\` | \`${OLD_URL}\` | \`${NEW_URL}\` |`);
console.log("");

if (miss.length) {
  console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다");
  console.log("");
  miss.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("✅ 사전 대조 통과");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 — 파일과 데이터를 한 번에 ──────────────────────────────────────
fs.mkdirSync(path.join(ROOT, "pipeline/backups"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d182.json"), before);

const pngBefore = fs.readFileSync(OLD_PATH);
const pngMd5 = md5(pngBefore);
const alt0 = q.bogiImage.alt;
const text0 = q.bogi.text;
const choices0 = JSON.stringify(q.choices);

fs.renameSync(OLD_PATH, NEW_PATH);
q.bogi.image = NEW_URL;
q.bogiImage.url = NEW_URL;
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 (S-02) ──────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
if (after[0] === 0xef) { console.log("🔴 BOM"); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const f2 = findSet(back, YK, SID);
const q2 = f2 && (f2.s.questions || []).find((x) => x.id === QID);
const fail = [];
if (!q2) fail.push("문항 소실");
else {
  if (q2.bogi?.image !== NEW_URL) fail.push(`bogi.image 미반영 (${q2.bogi?.image})`);
  if (q2.bogiImage?.url !== NEW_URL) fail.push(`bogiImage.url 미반영 (${q2.bogiImage?.url})`);
  if (q2.bogiImage?.alt !== alt0) fail.push("**alt 가 달라졌다**");
  if (q2.bogi?.text !== text0) fail.push("**bogi.text 가 달라졌다**");
  if (q2.bogi?.type !== "annotated_image") fail.push("bogi.type 이 달라졌다");
  if (JSON.stringify(q2.choices) !== choices0) fail.push("**선지가 달라졌다**");
}
if (fs.existsSync(OLD_PATH)) fail.push("옛 파일이 남아 있다");
if (!fs.existsSync(NEW_PATH)) fail.push("🔴 새 파일이 없다");
else {
  const pngAfter = fs.readFileSync(NEW_PATH);
  if (md5(pngAfter) !== pngMd5) fail.push("**PNG 내용이 달라졌다** — rename 이 아니라 재작성됐다");
  if (!(pngAfter[0] === 0x89 && pngAfter[1] === 0x50)) fail.push("PNG 서명 깨짐");
}
// 옛 경로 잔존 · LIVE 전수 참조 실재
if (JSON.stringify(back).includes(OLD_FILE)) fail.push(`🔴 데이터에 옛 경로 \`${OLD_FILE}\` 가 남아 있다`);

const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at0 = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at0, src.indexOf("]);", at0)).matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.includes("::")));
let refN = 0; const refBad = [];
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

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.before_d182.json`");
console.log("");
if (fail.length) {
  console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오");
  console.log("");
  fail.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- 파일 \`${NEW_FILE}\` · **PNG MD5 무변** \`${pngMd5}\` (rename 이지 재작성이 아니다)`);
console.log("- `bogi.image`·`bogiImage.url` 둘 다 새 경로 · `alt`·`text`·선지 무변");
console.log(`- 데이터에 옛 경로 \`${OLD_FILE}\` 잔존 **0건**`);
console.log("");
console.log("### LIVE 전수 재확인");
console.log("");
console.log(`- \`bogi.image\` 참조 보유 문항: **${refN}건**`);
console.log(`- 깨진 참조: ${refBad.length ? `🔴 **${refBad.length}건** — ${refBad.join(" · ")}` : "**0건**"}`);
