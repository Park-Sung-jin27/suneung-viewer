// d193_ann_delete.mjs — annotations 중복 잔재 항목 삭제 (발주 D-193 별건)
//
// ★ annotations 항목 삭제는 이 도구로만 한다 — 손으로 지우면 옆 항목이 딸려 나간다.
//   삭제는 이동보다 위험하다. 되돌릴 근거가 파일에서 사라지기 때문이다.
//   그래서 지우기 전에 **왜 지워도 되는지를 도구가 스스로 확인한다.**
//
// l20259b s9 「살얼음의 창」
//   지면(2025_9월 p8·p12)에 이 어구는 1회뿐이고, 그 1회는 s37 에 marker ⓐ 로
//   이미 정상 등재돼 있다. s9 항목은 marker 없는 중복 잔재다.
//   → s9 로 옮기면 밑줄이 두 줄 생긴다. 이동이 아니라 삭제가 맞다(심사관 확정).
//
// 삭제 전 확인 3가지 — 하나라도 어긋나면 아무것도 쓰지 않는다
//   ① 지울 항목이 정확히 1건 있다 (0건이면 이미 지워짐, 2건이면 손으로 만진 흔적)
//   ② 지울 항목의 sentId 문장에 그 어구가 **없다** (있으면 살아 있는 밑줄이다)
//   ③ 남길 대안 항목이 정확히 1건 있고, 그 문장에 어구가 **있다** (실제로 켜진다)
//
// 사용: node pipeline/d193_ann_delete.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const ANN = path.join(ROOT, "public/data/annotations.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

const SPEC = [
  {
    yk: "2025_9월", sid: "l20259b",
    drop: { type: "underline", sentId: "l20259bs9", text: "살얼음의 창" },
    keep: { type: "underline", sentId: "l20259bs37", text: "살얼음의 창", marker: "ⓐ" },
    why: "지면 출현 1회 · 그 1회는 s37 에 marker ⓐ 로 등재됨 — s9 는 marker 없는 중복 잔재",
  },
];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const beforeA = fs.readFileSync(ANN);
const ann = JSON.parse(beforeA.toString("utf8"));
const findSet = (yk, sid) => {
  for (const sec of ["reading", "literature"]) {
    const x = (data[yk]?.[sec] || []).find((y) => (y.setId || y.id) === sid);
    if (x) return x;
  }
  return null;
};
const same = (a, b) => a.type === b.type && String(a.sentId) === String(b.sentId) && a.text === b.text;

console.log("# annotations 중복 잔재 삭제 (D-193 별건)");
console.log("");
console.log(`- annotations MD5 \`${md5(beforeA)}\``);
console.log("");

const bad = [], plans = [];
for (const S of SPEC) {
  const at = `${S.yk}::${S.sid} ${S.drop.sentId} ${JSON.stringify(S.drop.text)}`;
  const set = findSet(S.yk, S.sid);
  if (!set) { bad.push(`${at} — 세트 없음`); continue; }
  const by = new Map((set.sents || []).map((x) => [String(x.id), String(x.t)]));
  const list = (ann[S.yk] || {})[S.sid];
  if (!Array.isArray(list)) { bad.push(`${at} — annotations 목록 없음`); continue; }

  const hits = list.map((a, i) => (same(a, S.drop) ? i : -1)).filter((i) => i >= 0);
  const keeps = list.filter((a) => same(a, S.keep));
  const dropText = by.get(String(S.drop.sentId));
  const keepText = by.get(String(S.keep.sentId));

  const checks = [
    ["① 지울 항목이 정확히 1건", hits.length === 1, `${hits.length}건 (index ${hits.join(",") || "—"})`],
    ["② 지울 항목이 미점등 상태", dropText != null && !dropText.includes(S.drop.text),
      dropText == null ? "문장 자체가 없다" : `${JSON.stringify(dropText.slice(0, 34))} → 어구 ${dropText.includes(S.drop.text) ? "있음(살아 있는 밑줄!)" : "없음"}`],
    ["③ 남길 항목이 정확히 1건 · 점등", keeps.length === 1 && keepText != null && keepText.includes(S.keep.text),
      `${keeps.length}건 · ${JSON.stringify(String(keepText || "(없음)").slice(0, 34))}`],
  ];
  for (const [label, ok, detail] of checks) {
    console.log(`  ${ok ? "✅" : "🔴"} ${label} — ${detail}`);
    if (!ok) bad.push(`${at} — ${label} 실패`);
  }
  console.log(`  근거: ${S.why}`);
  console.log(`  지울 값: ${JSON.stringify(list[hits[0]])}`);
  console.log(`  남길 값: ${JSON.stringify(keeps[0])}`);
  console.log("");
  if (!bad.length) plans.push({ ...S, list, idx: hits[0], before: list.length });
}

if (bad.length) { console.log("## 🔴 사전 확인 실패 — 아무것도 쓰지 않는다"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
if (plans.length !== SPEC.length) { console.log("## 🔴 계획 수 불일치"); process.exit(1); }
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/annotations.before_d193del.json"), beforeA);
const preA = JSON.parse(beforeA.toString("utf8"));
for (const p of plans) p.list.splice(p.idx, 1);
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");   // 2칸 · 끝 개행 없음

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const afterA = fs.readFileSync(ANN);
const fail = [];
if (afterA[0] === 0xef) fail.push("BOM");
if (afterA[afterA.length - 1] === 10) fail.push("끝 개행");
const backA = JSON.parse(afterA.toString("utf8"));
for (const p of plans) {
  const list = (backA[p.yk] || {})[p.sid] || [];
  if (list.length !== p.before - 1) fail.push(`${p.sid} 항목 수 ${p.before} → ${list.length} (기대 ${p.before - 1})`);
  if (list.some((a) => same(a, p.drop))) fail.push(`${p.sid} 삭제 대상 잔존`);
  if (list.filter((a) => same(a, p.keep)).length !== 1) fail.push(`${p.sid} 남길 항목이 1건이 아니다`);
  // 삭제 1건 외에는 순서·내용이 그대로여야 한다
  const expect = preA[p.yk][p.sid].filter((a, i) => i !== p.idx);
  if (JSON.stringify(list) !== JSON.stringify(expect)) fail.push(`${p.sid} 삭제 외 변경이 있다 (딸려 나간 항목)`);
}
for (const [yk, sets] of Object.entries(preA)) for (const [sid, list] of Object.entries(sets)) {
  if (plans.some((p) => p.yk === yk && p.sid === sid)) continue;
  if (JSON.stringify(list) !== JSON.stringify((backA[yk] || {})[sid])) fail.push(`${yk}::${sid} 가 달라졌다`);
}
if (md5(fs.readFileSync(DATA)) !== md5(fs.readFileSync(DATA))) fail.push("all_data 불안정");

console.log(`- 적용 후 annotations MD5 \`${md5(afterA)}\` (${afterA.length - beforeA.length}B)`);
console.log("- 백업 `pipeline/backups/annotations.before_d193del.json`");
console.log("- all_data 는 열지도 쓰지도 않았다 (읽기 전용 대조용)");
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- 삭제 1건 · 잔존 0 · 남길 항목 1건 유지 · 딸려 나간 항목 0 · 타 세트/회차 무변");
