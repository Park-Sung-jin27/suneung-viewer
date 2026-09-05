// d206_apply.mjs — A′ 승인분 2건 + C 중복등재 정리 (발주 D-206)
//
// ── A′ 2건 (심사관 승인분만. r20246a ㉡㉢ 은 반려되어 손대지 않는다)
//   ① 2021수능 r2021b — marker:"㉠" 제거. 그 마커를 부르는 문항이 0건이고 본문에도
//      원문자가 없다. 밑줄 자체는 어구가 실재하므로 살리고 marker 필드만 뗀다.
//   ② 2020수능 r2020e ⓑ — 앵커 s12 → s16. 「따르면」이 s9·s12·s16 세 곳에 있는데
//      마커 ⓑ 는 s16 의 「ⓑ따르면」에 직접 붙어 있다. 지금은 화면에서 엉뚱한
//      「따르면」에 밑줄이 켜진다.
//
// ── C 중복등재
//   같은 (type, sentId, text) 가 두 번 등재된 쌍이다. 실제로는 완전 중복이 아니라
//   한쪽에 marker 또는 target:"bogi"+qId 가 빠진 짝이다. **정보가 많은 쪽을 남긴다.**
//   ★ 지우기 전에 두 항목의 text 와 sentId 가 정말 같은지 다시 본다(심사관 전제).
//     하나라도 다르면 그 쌍은 건드리지 않고 보류로 올린다.
//   ★ 남는 쪽이 지워지는 쪽의 필드를 전부 갖고 있어야 한다 — 정보가 줄면 안 된다.
//
// 사용: node pipeline/d206_apply.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANN = path.join(ROOT, "public/data/annotations.json");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

const A_PRIME = [
  { yk: "2021수능", sid: "r2021b", kind: "marker제거", marker: "㉠", sentId: "r2021bs10",
    why: "㉠ 를 부르는 문항 0건 · 본문에 원문자 없음 — 잉여 필드" },
  { yk: "2020수능", sid: "r2020e", kind: "앵커이동", marker: "ⓑ", sentId: "r2020es12", to: "r2020es16",
    why: "마커 ⓑ 가 s16 의 「ⓑ따르면」에 직접 붙어 있다 — 지금은 s12 의 다른 「따르면」에 켜진다" },
];

const before = fs.readFileSync(ANN);
const ann = JSON.parse(before.toString("utf8"));
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const sentOf = (yk, sid, id) => {
  for (const sec of ["reading", "literature"]) {
    const s = (data[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (s) return (s.sents || []).find((x) => String(x.id) === String(id));
  }
  return null;
};

console.log("# A′ 2건 + C 중복 정리 (D-206)");
console.log("");
console.log(`- annotations MD5 \`${md5(before)}\``);
console.log("");

const fail = [], aPlans = [], cPlans = [], cHold = [];

// ── A′ ────────────────────────────────────────────────────────────────
console.log("## A′ 승인분");
console.log("");
console.log("| 세트 | 마커 | 조치 | 근거 |");
console.log("|---|---|---|---|");
for (const S of A_PRIME) {
  const list = (ann[S.yk] || {})[S.sid] || [];
  const idx = list.findIndex((a) => a.marker === S.marker && String(a.sentId) === String(S.sentId));
  if (idx < 0) { fail.push(`${S.yk}::${S.sid} ${S.marker} 항목을 못 찾았다`); continue; }
  const a = list[idx];
  if (S.kind === "앵커이동") {
    const dst = sentOf(S.yk, S.sid, S.to);
    if (!dst) { fail.push(`${S.to} 문장이 없다`); continue; }
    if (!String(dst.t).includes(a.text)) { fail.push(`${S.to} 에 어구 ${JSON.stringify(a.text)} 가 없다`); continue; }
    if (!String(dst.t).includes(S.marker)) { fail.push(`${S.to} 에 마커 ${S.marker} 가 없다`); continue; }
    if ((String(dst.t).split(a.text).length - 1) !== 1) { fail.push(`${S.to} 에 어구가 여러 곳이다`); continue; }
  } else {
    if (!("marker" in a)) { fail.push(`${S.yk}::${S.sid} 에 marker 필드가 이미 없다`); continue; }
    const sn = sentOf(S.yk, S.sid, S.sentId);
    if (!sn || !String(sn.t).includes(a.text)) { fail.push(`${S.sentId} 에 어구가 없다 — 밑줄 자체가 깨진다`); continue; }
  }
  aPlans.push({ ...S, list, idx, a });
  console.log(`| \`${S.yk}::${S.sid}\` | ${S.marker} | ${S.kind === "앵커이동" ? `앵커 \`${S.sentId}\` → \`${S.to}\`` : "`marker` 필드 제거"} | ${S.why} |`);
}
console.log("");

// ── C ─────────────────────────────────────────────────────────────────
const score = (a) => Object.keys(a).length;                    // 필드가 많은 쪽 = 정보가 많다
for (const [yk, sets] of Object.entries(ann)) for (const [sid, list] of Object.entries(sets)) {
  const seen = new Map();
  list.forEach((a, i) => {
    if (!a.text || !a.sentId) return;
    // ★ target 을 키에 넣는다 — 게이트와 같은 규칙이다. 빼면 본문 주석과 보기 주석이
    //   중복으로 잡혀, 지우는 순간 한쪽 표시가 사라진다.
    const k = `${a.type}|${a.target || "passage"}|${a.sentId}|${a.text}`;
    if (!seen.has(k)) { seen.set(k, i); return; }
    const j = seen.get(k), b = list[j];
    // ★ 심사관 전제 — text·sentId 가 정말 같은지 다시 본다
    if (a.text !== b.text || String(a.sentId) !== String(b.sentId)) {
      cHold.push({ yk, sid, i, j, why: "text 또는 sentId 가 다르다" }); return;
    }
    const keepIdx = score(a) > score(b) ? i : (score(b) > score(a) ? j : j);
    const dropIdx = keepIdx === i ? j : i;
    const keep = list[keepIdx], drop = list[dropIdx];
    // 남는 쪽이 지워지는 쪽의 필드를 전부 갖고 있는가 — 정보가 줄면 안 된다
    const lost = Object.keys(drop).filter((f) => !(f in keep));
    if (lost.length) { cHold.push({ yk, sid, i, j, why: `남길 쪽에 없는 필드가 있다: ${lost.join(",")}` }); return; }
    cPlans.push({ yk, sid, keepIdx, dropIdx, keep, drop });
  });
}
console.log(`## C 중복 정리 — ${cPlans.length}건 삭제 · 보류 ${cHold.length}건`);
console.log("");
console.log("| 세트 | 남길 것 | 지울 것 |");
console.log("|---|---|---|");
for (const p of cPlans) console.log(`| \`${p.yk}::${p.sid}\` | ${JSON.stringify(p.keep).slice(0, 74)} | ${JSON.stringify(p.drop).slice(0, 54)} |`);
console.log("");
if (cHold.length) { console.log("### 보류"); cHold.forEach((h) => console.log(`- \`${h.yk}::${h.sid}\` [${h.j}] vs [${h.i}] — ${h.why}`)); console.log(""); }

if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log(`✅ 사전 검사 통과 — A′ ${aPlans.length}건 · C ${cPlans.length}건`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/annotations.before_d206.json"), before);
const pre = JSON.parse(before.toString("utf8"));
for (const p of aPlans) {
  if (p.kind === "앵커이동") p.list[p.idx].sentId = p.to;
  else delete p.list[p.idx].marker;
}
// 삭제는 인덱스가 밀리므로 세트별로 뒤에서부터
const byList = new Map();
for (const p of cPlans) {
  const k = `${p.yk}::${p.sid}`;
  if (!byList.has(k)) byList.set(k, { yk: p.yk, sid: p.sid, drops: [] });
  byList.get(k).drops.push(p.dropIdx);
}
for (const { yk, sid, drops } of byList.values()) {
  const list = ann[yk][sid];
  for (const i of [...drops].sort((a, b) => b - a)) list.splice(i, 1);
}
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const after = fs.readFileSync(ANN);
const back = JSON.parse(after.toString("utf8"));
const bad = [];
if (after[after.length - 1] === 10) bad.push("끝 개행");
for (const p of aPlans) {
  const list = (back[p.yk] || {})[p.sid] || [];
  if (p.kind === "앵커이동") {
    const hit = list.filter((a) => a.marker === p.marker && String(a.sentId) === String(p.to));
    if (hit.length !== 1) bad.push(`${p.sid} ${p.marker} 앵커 이동 결과 ${hit.length}건`);
    if (list.some((a) => a.marker === p.marker && String(a.sentId) === String(p.sentId))) bad.push(`${p.sid} 옛 앵커 잔존`);
  } else {
    const hit = list.filter((a) => String(a.sentId) === String(p.sentId) && a.text === p.a.text);
    if (hit.length !== 1) bad.push(`${p.sid} 대상이 ${hit.length}건`);
    else if ("marker" in hit[0]) bad.push(`${p.sid} marker 가 남아 있다`);
  }
}
for (const p of cPlans) {
  const list = (back[p.yk] || {})[p.sid] || [];
  // 검산도 같은 키를 쓴다 — target 을 빼면 본문·보기 짝이 「중복 잔존」으로 오판된다
  const same = list.filter((a) => a.type === p.keep.type
    && (a.target || "passage") === (p.keep.target || "passage")
    && String(a.sentId) === String(p.keep.sentId) && a.text === p.keep.text);
  if (same.length !== 1) bad.push(`${p.yk}::${p.sid} 중복이 ${same.length}건 남았다`);
  else if (Object.keys(p.keep).some((f) => !(f in same[0]))) bad.push(`${p.yk}::${p.sid} 남긴 항목의 필드가 줄었다`);
}
// 손대지 않은 세트는 무변
const touched = new Set([...aPlans.map((p) => `${p.yk}::${p.sid}`), ...cPlans.map((p) => `${p.yk}::${p.sid}`)]);
for (const [yk, sets] of Object.entries(pre)) for (const [sid, list] of Object.entries(sets)) {
  if (touched.has(`${yk}::${sid}`)) continue;
  if (JSON.stringify(list) !== JSON.stringify((back[yk] || {})[sid])) bad.push(`${yk}::${sid} 가 달라졌다`);
}
console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/annotations.before_d206.json`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- A′ ${aPlans.length}건 · C ${cPlans.length}건 정리 · 남긴 항목의 필드 손실 0`);
console.log("- 손대지 않은 세트 전건 무변 · all_data 는 열지도 쓰지도 않았다");
