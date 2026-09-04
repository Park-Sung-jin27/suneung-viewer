// d205_underline_apply.mjs — 판독한 마커 밑줄을 annotations 에 넣는다 (발주 D-205 ⑦)
//
// 입력은 d205_underline_probe.py 의 산출 JSON 이다. 그 판독기는 지면 PDF 의 그리기
// 연산에서 가로선을 뽑아 좌표로만 판정했고(글리프 육안 판독 금지 §13⑬),
// 재측정 3종을 통과했다 — 표본 6/6 · 음성 10/10 · 폭 오차 104/104 ≤1글자.
//
// ★ 타입은 marker 다(underline 아님). 정본 90건이 예외 없이 이 형태이고,
//   PassagePanel.jsx:275~284 가 <sup>라벨</sup> + 밑줄 span 으로 그린다.
// ★ text 에 원문자를 넣지 않는다. 렌더가 원문자를 **본문 sents 에서** 가져오므로,
//   text 에 또 넣으면 원문자가 두 번 그려질 위험이 있다(심사관 화면 실측 — 정본
//   9건에서 원문자 출현이 각 1회였다).
//
// 이 도구는 넣기 전에 다시 확인한다 — 판독기를 믿지 않는다:
//   · text 가 그 sentId 문장에 **연속 부분문자열**로 실재하는가
//   · 그 문장 안에 두 곳 이상 있지 않은가(위치가 특정되어야 한다)
//   · text 에 원문자가 남아 있지 않은가
//   · 같은 항목이 이미 등재돼 있지 않은가
//   하나라도 어긋나면 아무것도 쓰지 않는다.
//
// 사용: node pipeline/d205_underline_apply.mjs --in <판독JSON> [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const ANN = path.join(ROOT, "public/data/annotations.json");
const argv = process.argv.slice(2);
const IN = (() => { const i = argv.indexOf("--in"); return i >= 0 ? argv[i + 1] : null; })();
const APPLY = argv.includes("--apply");
const MARKS = "㉠㉡㉢㉣㉤ⓐⓑⓒⓓⓔ";
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
if (!IN) { console.error("--in <판독JSON> 필수"); process.exit(1); }

const before = fs.readFileSync(ANN);
const ann = JSON.parse(before.toString("utf8"));
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const probe = JSON.parse(fs.readFileSync(IN, "utf8"));
const rows = probe.rows || probe;
const holds = probe.holds || [];

const sentOf = (yk, sid, sentId) => {
  for (const sec of ["reading", "literature"]) {
    const s = (data[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (s) return (s.sents || []).find((x) => String(x.id) === String(sentId));
  }
  return null;
};

console.log("# 마커 밑줄 반영 (D-205 ⑦)");
console.log("");
console.log(`- 입력 \`${path.relative(ROOT, IN).replace(/\\/g, "/")}\` — 확정 ${rows.length}건 · 보류 ${holds.length}건`);
console.log(`- annotations MD5 \`${md5(before)}\``);
console.log("");

const fail = [], plans = [];
for (const r of rows) {
  const at = `${r.key} ${r.marker}`;
  const sn = sentOf(r.yk, r.sid, r.sentId);
  if (!sn) { fail.push(`${at} — 문장 ${r.sentId} 없음`); continue; }
  const t = String(sn.t);
  if (!r.text) { fail.push(`${at} — text 가 비었다`); continue; }
  if ([...r.text].some((c) => MARKS.includes(c))) { fail.push(`🔴 ${at} — text 에 원문자가 남아 있다: ${JSON.stringify(r.text.slice(0, 20))}`); continue; }
  const n = t.split(r.text).length - 1;
  if (n === 0) { fail.push(`${at} — text 가 그 문장에 없다: ${JSON.stringify(r.text.slice(0, 26))}`); continue; }
  if (n > 1) { fail.push(`${at} — text 가 그 문장에 ${n}곳 — 위치 불특정`); continue; }
  if (!t.includes(r.marker)) { fail.push(`${at} — 그 문장에 마커가 없다`); continue; }
  const list = (ann[r.yk] || {})[r.sid] || [];
  if (list.some((a) => a.type === "marker" && a.marker === r.marker && String(a.sentId) === String(r.sentId)))
    { fail.push(`${at} — 같은 marker 항목이 이미 있다`); continue; }
  if (list.some((a) => a.type === "underline" && a.text === r.text && String(a.sentId) === String(r.sentId)))
    { fail.push(`${at} — 같은 어구의 underline 이 이미 있다`); continue; }
  plans.push({ ...r, item: { type: "marker", marker: r.marker, sentId: r.sentId, text: r.text } });
}

const bySet = {};
for (const p of plans) (bySet[p.key] ||= []).push(p);
console.log("## 계획 — 줄 수 2 이상 먼저");
console.log("");
console.log("| 세트 | 마커 | 줄 | sentId | text |");
console.log("|---|---|--:|---|---|");
for (const p of [...plans].sort((a, b) => b.lines - a.lines || a.key.localeCompare(b.key)))
  if (p.lines >= 2) console.log(`| \`${p.key}\` | ${p.marker} | ${p.lines} | \`${p.sentId}\` | ${JSON.stringify(p.text.slice(0, 40))} |`);
console.log("");
console.log(`1줄 ${plans.filter((p) => p.lines === 1).length}건은 생략 — 세트 ${Object.keys(bySet).length}개에 걸쳐 있다`);
console.log("");
if (fail.length) {
  console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다");
  console.log("");
  fail.slice(0, 30).forEach((x) => console.log(`- ${x}`));
  if (fail.length > 30) console.log(`- … 외 ${fail.length - 30}건`);
  process.exit(1);
}
console.log(`✅ 사전 검사 통과 — ${plans.length}건 전건: text 가 그 문장에 1곳 실재 · 원문자 없음 · 중복 없음`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/annotations.before_d205.json"), before);
const pre = JSON.parse(before.toString("utf8"));
for (const p of plans) ((ann[p.yk] ||= {})[p.sid] ||= []).push(p.item);
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const after = fs.readFileSync(ANN);
const back = JSON.parse(after.toString("utf8"));
const bad = [];
if (after[after.length - 1] === 10) bad.push("끝 개행");
if (after[0] === 0xef) bad.push("BOM");
for (const p of plans) {
  const list = (back[p.yk] || {})[p.sid] || [];
  const hit = list.filter((a) => a.type === "marker" && a.marker === p.marker && String(a.sentId) === String(p.sentId) && a.text === p.text);
  if (hit.length !== 1) bad.push(`${p.key} ${p.marker} 추가분이 ${hit.length}건`);
  const sn = sentOf(p.yk, p.sid, p.sentId);
  if (!sn || !String(sn.t).includes(p.text)) bad.push(`${p.key} ${p.marker} text 가 문장에 없다`);
}
// 기존 항목 무변 · 다른 세트 무변
for (const [yk, sets] of Object.entries(pre)) for (const [sid, list] of Object.entries(sets)) {
  const now = (back[yk] || {})[sid] || [];
  const added = plans.filter((p) => p.yk === yk && p.sid === sid).length;
  if (now.length !== list.length + added) bad.push(`${yk}::${sid} 항목 수 ${list.length}+${added} ≠ ${now.length}`);
  if (JSON.stringify(now.slice(0, list.length)) !== JSON.stringify(list)) bad.push(`${yk}::${sid} 기존 항목이 달라졌다`);
}
for (const [yk, sets] of Object.entries(back)) for (const sid of Object.keys(sets))
  if (!(pre[yk] || {})[sid] && !plans.some((p) => p.yk === yk && p.sid === sid)) bad.push(`${yk}::${sid} 가 새로 생겼다`);

console.log(`- 적용 후 MD5 \`${md5(after)}\` (+${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/annotations.before_d205.json`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.slice(0, 20).forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- ${plans.length}건 추가 · 전건 text 가 문장에 실재 · 중복 0`);
console.log("- 기존 항목 무변 · 다른 세트·회차 무변 · all_data 는 열지도 쓰지도 않았다");
