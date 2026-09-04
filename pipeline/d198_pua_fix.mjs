// d198_pua_fix.mjs — 한양PUA 2자를 표준 겹낫표로 교체 (발주 D-198)
//
// 2027_9월 r20279a Q3 의 「요리사의 식탁」을 감싼 두 글자가 사용자 정의 영역(PUA)
// 문자다. 폰트가 없는 기기에서는 □ 로 나온다.
//   U+F0854 → 『 (U+300E)   ·   U+F0855 → 』 (U+300F)
//
// 매핑은 심사관이 확정했다(원본 p1 600dpi 글리프 픽셀 판독 — 두 글자 모두 행·열
// 대부분에서 획이 2개라 이중 갈고리, 즉 겹낫표다. 홑낫표 「」가 아니다).
// 문맥도 단행본 제목이라 겹낫표가 맞다. 재검증하지 않는다.
//   ★ 옛한글·PUA 는 글리프 육안 판독 금지(§13⑬)다. 그래서 이 도구도 글자를 보고
//     고르지 않고 코드포인트로만 다룬다 — 소스에 PUA 를 직접 타이핑하지 않는다.
//
// ★ 발주 기술과 실제 위치가 다르다 — 발주는 「bogi 의 (각 2회)」라 했으나
//   전역 스캔 결과 bogi 1회 + Q3 2번 선지 analysis 1회씩이다(2종 × 2곳 = 4자).
//   교체 대상은 같으므로 그대로 진행하되 위치를 기록에 남긴다.
//
// 사용: node pipeline/d198_pua_fix.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

const MAP = [
  { from: 0xf0854, to: 0x300e, name: "여는 겹낫표" },
  { from: 0xf0855, to: 0x300f, name: "닫는 겹낫표" },
];
const YK = "2027_9월", SID = "r20279a";
// PUA 전 영역 — BMP(U+E000~F8FF) + 보조면 15·16(U+F0000~U+10FFFD)
const RE_PUA = /[-]|[\uDB80-\uDBFF][\uDC00-\uDFFF]/g;

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));

// 전역 스캔 — 어디에 몇 개 있는지 먼저 센다
function scan(obj) {
  const out = [];
  for (const [yk, v] of Object.entries(obj)) for (const sec of ["reading", "literature"]) for (const s of v[sec] || []) {
    const sid = s.setId || s.id;
    (function walk(o, p) {
      if (typeof o === "string") { for (const m of o.match(RE_PUA) || []) out.push({ yk, sid, path: p, cp: m.codePointAt(0) }); }
      else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${p}[${i}]`));
      else if (o && typeof o === "object") for (const [k, x] of Object.entries(o)) walk(x, `${p}.${k}`);
    })(s, "");
  }
  return out;
}
const hits = scan(data);
const hex = (cp) => "U+" + cp.toString(16).toUpperCase();

console.log("# 한양PUA → 겹낫표 교체 (D-198)");
console.log("");
console.log(`- all_data MD5 \`${md5(before)}\``);
console.log("");
console.log("## 전역 PUA 스캔");
console.log("");
console.log("| 회차::세트 | 코드포인트 | 위치 |");
console.log("|---|---|---|");
for (const h of hits) console.log(`| \`${h.yk}::${h.sid}\` | ${hex(h.cp)} | \`${h.path}\` |`);
console.log("");

const fail = [];
if (!hits.length) fail.push("PUA 가 하나도 없다 — 이미 교체됐거나 대상이 다르다");
for (const h of hits) {
  if (h.yk !== YK || h.sid !== SID) fail.push(`🔴 ${h.yk}::${h.sid} ${hex(h.cp)} — 승인 범위(${YK}::${SID}) 밖이다`);
  if (!MAP.some((m) => m.from === h.cp)) fail.push(`🔴 ${hex(h.cp)} — 매핑에 없는 PUA 다. 심사관 판독 없이 고치지 않는다`);
}
for (const m of MAP) {
  const n = hits.filter((h) => h.cp === m.from).length;
  if (n !== 2) fail.push(`${hex(m.from)} 가 ${n}건 (2건이어야 한다)`);
}
// 짝 검사 — 여는 것과 닫는 것이 같은 문자열 안에서 짝을 이루는가
const byPath = new Map();
for (const h of hits) byPath.set(h.path, [...(byPath.get(h.path) || []), h.cp]);
for (const [p, cps] of byPath) {
  if (cps.length !== 2 || cps[0] !== MAP[0].from || cps[1] !== MAP[1].from)
    fail.push(`🔴 \`${p}\` 의 짝이 어긋난다: ${cps.map(hex).join(" ")}`);
}

if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); console.log(""); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("✅ 사전 검사 통과 — 승인 범위 안 · 매핑 있는 문자만 · 여닫이 짝 맞음");
console.log("");

// 교체 대상 미리보기 — 감싸인 내용을 보여준다(PUA 는 《》 로 대체 표기)
const S0 = before.toString("utf8");
for (const [p] of byPath) {
  const seg = p.split(".").filter(Boolean);
  console.log(`\`${p}\``);
}
const A = String.fromCodePoint(MAP[0].from), B = String.fromCodePoint(MAP[1].from);
const shown = [...S0.matchAll(new RegExp(`${A}([^${A}${B}]{0,30})${B}`, "gu"))].map((m) => m[1]);
console.log("");
console.log("감싸인 내용:");
for (const s of [...new Set(shown)]) console.log(`  ${JSON.stringify(s)} → 『${s}』`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d198.json"), before);
// 문자열 단위 치환 — JSON 구조는 건드리지 않는다
let S1 = S0;
for (const m of MAP) S1 = S1.split(String.fromCodePoint(m.from)).join(String.fromCodePoint(m.to));
const after = Buffer.from(S1, "utf8");
fs.writeFileSync(DATA, after);

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const back = JSON.parse(fs.readFileSync(DATA, "utf8"));
const bad = [];
const rest = scan(back);
if (rest.length) bad.push(`PUA 잔존 ${rest.length}건: ${rest.map((h) => `${h.yk}::${h.sid} ${hex(h.cp)}`).join(", ")}`);
let nl = 0; for (const x of after) if (x === 10) nl++;
if (nl) bad.push(`개행 ${nl} — minified 위반`);
// 새 문자가 정확히 2개씩 생겼는가
const pre = JSON.parse(before.toString("utf8"));
const count = (o, ch) => JSON.stringify(o).split(ch).length - 1;
for (const m of MAP) {
  const d = count(back, String.fromCodePoint(m.to)) - count(pre, String.fromCodePoint(m.to));
  if (d !== 2) bad.push(`${m.name} 증가분이 ${d} (2 여야 한다)`);
}
// PUA 외 전건 무변 — **정방향**으로 대조한다.
//   ★ 역치환(목표문자 → PUA)으로 대조하면 안 된다. 이 데이터에는 겹낫표가 원래
//     309쌍 있어서 역치환이 그것들까지 PUA 로 바꿔 버린다(첫 실행에서 실제로 이
//     오탐이 났다 — 데이터는 멀쩡한데 검산만 실패했다). 바꾼 쪽을 되돌리지 말고,
//     원본에 같은 치환을 걸어 결과가 같은지 본다.
let E = JSON.stringify(pre);
for (const m of MAP) E = E.split(String.fromCodePoint(m.from)).join(String.fromCodePoint(m.to));
if (E !== JSON.stringify(back)) bad.push("🔴 PUA 교체 외에 달라진 곳이 있다");

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log(`- 백업 \`pipeline/backups/all_data_204.before_d198.json\``);
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- **전역 PUA 0건**");
console.log("- 겹낫표 여닫이 각 2개 증가 · 그 밖의 문자·구조 전건 무변(정방향 대조)");
console.log("- minified 유지");
