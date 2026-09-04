// d204_bogi_restore.mjs — l20156b Q36 보기 열화본 복원 (발주 D-204 ③)
//
// 같은 지문이 2015_6월A · 2015_6월B 두 회차에 같은 setId 로 실려 있다. A 사본은
// 대본 조판이 개행 8개로 살아 있고, B 사본은 개행이 통째로 사라져 화자 구분이 없다.
// 화면에서 시나리오 8줄이 한 문단으로 붙어 누가 한 말인지 알 수 없는 상태다.
//
// ★ 추정 복원이 아니라 **사내 정본 대조 복원**이다. 문자열을 새로 짓지 않고
//   A 사본의 bogi 를 그대로 가져온다. 도구가 옮기기 전에 두 사본이 같은 글인지
//   스스로 확인한다 — 공백과 조판 구분자를 지운 뒤 본문이 일치해야 한다.
//
// ★ sents 는 건드리지 않는다. A 37문장 / B 17문장으로 분할이 다르고, 분할을 바꾸면
//   sentId 가 바뀌어 주석·cs_ids·pat 앵커가 전부 따라 움직인다. 이번 범위 밖이다.
//
// 사용: node pipeline/d204_bogi_restore.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const ANN = path.join(ROOT, "public/data/annotations.json");
const SRC = { yk: "2015_6월A", sid: "l20156b", qId: "36" };   // 정상 사본
const DST = { yk: "2015_6월B", sid: "l20156b", qId: "36" };   // 열화 사본
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const ann = JSON.parse(fs.readFileSync(ANN, "utf8"));
const pick = (o) => {
  for (const sec of ["reading", "literature"]) {
    const s = (data[o.yk]?.[sec] || []).find((x) => (x.setId || x.id) === o.sid);
    if (s) return { set: s, q: (s.questions || []).find((x) => String(x.id) === o.qId) };
  }
  return {};
};
const bogiOf = (q) => (typeof q.bogi === "string" ? q.bogi : (q.bogi && typeof q.bogi.text === "string" ? q.bogi.text : null));
// 공백과 조판 구분자를 지운다 — 두 사본이 같은 글인지만 본다
const N = (s) => String(s).replace(/\s*\/\s*/g, "").replace(/\s+/g, "");
// ★ 각주 참조 별표까지 지운 판. B 사본은 「E.L.S.*」의 * 가 빠져 있다 — 개행과 함께
//   사라진 것이고, A 를 넣으면 그것도 같이 복원된다. 다만 무조건 무시하면 다른
//   차이를 놓치므로, **차이가 별표뿐인지**를 따로 확인한다.
const NS = (s) => N(s).replace(/[*※]/g, "");

const A = pick(SRC), Bd = pick(DST);
console.log("# l20156b Q36 보기 복원 (D-204 ③)");
console.log("");
console.log(`- all_data MD5 \`${md5(before)}\``);
console.log("");

const fail = [];
if (!A.q) fail.push(`${SRC.yk}::${SRC.sid} Q${SRC.qId} 없음`);
if (!Bd.q) fail.push(`${DST.yk}::${DST.sid} Q${DST.qId} 없음`);
let src = null, dst = null;
if (!fail.length) {
  src = bogiOf(A.q); dst = bogiOf(Bd.q);
  if (typeof A.q.bogi !== "string" || typeof Bd.q.bogi !== "string")
    fail.push("bogi 가 문자열이 아니다 — 객체형은 이 도구가 다루지 않는다");
  if (src == null || dst == null) fail.push("bogi 를 읽지 못했다");
}
if (!fail.length) {
  const rows = [
    ["발문 동일", String(A.q.t) === String(Bd.q.t), "문항 오인 방지 — 다르면 같은 문항이 아니다"],
    ["정규화 본문 동일(별표 제외)", NS(src) === NS(dst), `A ${NS(src).length}자 vs B ${NS(dst).length}자`],
    ["차이는 각주 별표뿐", N(src) === N(dst) || Math.abs(N(src).length - N(dst).length) === Math.abs(NS(src).length - NS(dst).length) + 1 || N(src).replace(/[*※]/g, "") === N(dst).replace(/[*※]/g, ""),
      N(src) === N(dst) ? "별표 차이도 없다" : `A 별표 ${(N(src).match(/[*※]/g) || []).length}개 vs B ${(N(dst).match(/[*※]/g) || []).length}개 — 복원하면 각주 참조도 살아난다`],
    ["A 사본 개행 보유", src.split("\n").length - 1 > 0, `${src.split("\n").length - 1}개`],
    ["B 사본 개행 0", dst.split("\n").length - 1 === 0, `${dst.split("\n").length - 1}개`],
    ["보기를 참조하는 주석 0", ((ann[DST.yk] || {})[DST.sid] || []).filter((a) => a.text && dst.includes(a.text)).length === 0,
      `이 세트 주석 ${((ann[DST.yk] || {})[DST.sid] || []).length}건 — foldIfAnnSafe 가 깨질 여지`],
  ];
  console.log("| 확인 | 결과 |");
  console.log("|---|---|");
  for (const [label, ok, detail] of rows) {
    console.log(`| ${label} | ${ok ? "✅" : "🔴"} ${detail} |`);
    if (!ok) fail.push(`${label} — ${detail}`);
  }
  console.log("");
  if (NS(src) !== NS(dst)) {
    // 어디가 다른지 보여준다 — 승인 판단에 필요하다
    const a = NS(src), b = NS(dst);
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    console.log("첫 불일치 지점:");
    console.log("```");
    console.log("A: " + JSON.stringify(a.slice(Math.max(0, i - 20), i + 40)));
    console.log("B: " + JSON.stringify(b.slice(Math.max(0, i - 20), i + 40)));
    console.log("```");
    console.log("");
  }
}
if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }

console.log("## 교체 내용");
console.log("");
console.log("```");
console.log("전 (개행 0):");
console.log("  " + JSON.stringify(dst.slice(0, 96)) + " …");
console.log("");
console.log("후 (A 사본 그대로 · 개행 " + (src.split("\n").length - 1) + "):");
src.split("\n").forEach((l, i) => console.log(`  [${i}] ${JSON.stringify(l.slice(0, 60))}`));
console.log("```");
console.log("");
console.log("✅ 사전 검사 통과 — 같은 글이고, 주석이 걸릴 여지도 없다");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d204.json"), before);
const pre = JSON.parse(before.toString("utf8"));
Bd.q.bogi = src;
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
const back = JSON.parse(after.toString("utf8"));
const bad = [];
let nl = 0; for (const x of after) if (x === 10) nl++;
if (nl) bad.push(`개행 ${nl} — minified 위반`);
const b2 = (() => { for (const sec of ["reading", "literature"]) { const s = (back[DST.yk]?.[sec] || []).find((x) => (x.setId || x.id) === DST.sid); if (s) return s; } })();
const q2 = b2.questions.find((x) => String(x.id) === DST.qId);
if (String(q2.bogi) !== src) bad.push("교체된 bogi 가 A 사본과 다르다");
if ((String(q2.bogi).split("\n").length - 1) !== src.split("\n").length - 1) bad.push("개행 수가 다르다");
// sents·다른 문항·다른 세트 무변
const b1 = (() => { for (const sec of ["reading", "literature"]) { const s = (pre[DST.yk]?.[sec] || []).find((x) => (x.setId || x.id) === DST.sid); if (s) return s; } })();
if (JSON.stringify(b1.sents) !== JSON.stringify(b2.sents)) bad.push("🔴 sents 가 달라졌다 — 범위 위반");
for (const oq of b1.questions) {
  const cq = b2.questions.find((x) => String(x.id) === String(oq.id));
  const strip = (x) => JSON.stringify({ ...x, bogi: null });
  if (strip(oq) !== strip(cq)) bad.push(`Q${oq.id} 의 bogi 외 필드가 달라졌다`);
  if (String(oq.id) !== DST.qId && JSON.stringify(oq.bogi) !== JSON.stringify(cq.bogi)) bad.push(`Q${oq.id} bogi 가 달라졌다`);
}
for (const [yk, v] of Object.entries(pre)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  const sid = st.setId || st.id;
  if (yk === DST.yk && sid === DST.sid) continue;
  if (JSON.stringify(st) !== JSON.stringify((back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid))) bad.push(`${yk}::${sid} 가 달라졌다`);
}
console.log(`- 적용 후 MD5 \`${md5(after)}\` (+${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.before_d204.json`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- Q36 보기가 A 사본과 바이트 동일 · 개행 복원");
console.log("- **sents 무변** · 같은 세트 다른 문항 무변 · 다른 세트·회차 전건 무변 · minified 유지");
