// d196_pat_fix.mjs — l20279b pat 확정 2건 적용 (발주 D-196 · 심사관 판정 2026-09-04)
//
// ⑴ Q25#3  R3 → L3 (의미 부풀리기)
//    문학 세트에 독서 계열 R3 을 쓴 도메인 위반 하나가 결함이다(판정 순서 ① 도메인).
//    결론줄 라벨 [R3] → [L3] 도 함께 맞춘다. 해설 본문은 손대지 않는다.
//    L3 는 REQUIRES_CS 면제라 cs_ids 의무가 새로 생기지 않는다.
//
// ⑵ Q27#5  (없음) → L2 (마음 오해)
//    ㉤「아, 자기만이 홀로 아는 경우는 남이 알지 못할까 항상 근심」은 감탄사로 열리지만
//    정서는 찬탄이 아니라 탄식이다. 오류의 핵심이 글쓴이 정서 귀속이므로 L1 이 아닌 L2 다.
//
//    ★ 이 선지는 해설이 통째로 비어 있다. 채택 게이트가 3회 거부했기 때문인데,
//      거부 사유는 3회 모두 「축2 pat≠ok(ok=false, pat=undefined)」 하나였다.
//      haesol_v2_gate.js:142 detectPatNullMismatch 는 ok=false 면 pat 이 비어 있다는
//      사실만으로 거부한다 — 해설 내용도 cs 근거도 보지 않는다. 그래서 pat 을 채우면
//      축2 는 풀린다. §결정B③(근거 없으면 옵션 B)은 발동 조건이 아니다.
//      해설 재생성은 별도 단계(d196_q27_regen)에서 한다 — 이 도구는 pat 만 적는다.
//
// 사용: node pipeline/d196_pat_fix.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "pipeline/test_data/d196_l20279b/step3_result.json");
const SID = "l20279b";
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const SPEC = [
  { qId: "25", num: 3, from: "R3", to: "L3", relabel: { from: "[R3]", to: "[L3]" } },
  { qId: "27", num: 5, from: undefined, to: "L2", relabel: null },
];

const raw = fs.readFileSync(SRC, "utf8");
const j = JSON.parse(raw);
const set = (j.literature || []).find((x) => (x.setId || x.id) === SID);

console.log("# l20279b pat 확정 적용 (D-196)");
console.log("");
console.log(`- 원천 MD5 \`${md5(raw)}\``);
console.log("");

const fail = [], plans = [];
console.log("| 선지 | ok | pat | 결론줄 |");
console.log("|---|---|---|---|");
for (const S of SPEC) {
  const q = (set?.questions || []).find((x) => String(x.id) === S.qId);
  const c = q && (q.choices || []).find((x) => x.num === S.num);
  if (!c) { fail.push(`Q${S.qId}#${S.num} 없음`); continue; }
  if (c.ok !== false) { fail.push(`Q${S.qId}#${S.num} 이 ok=false 가 아니다 (${c.ok}) — pat 을 붙이면 축2 위반이 된다`); continue; }
  if (JSON.stringify(c.pat) !== JSON.stringify(S.from)) { fail.push(`Q${S.qId}#${S.num} 현재 pat 이 ${JSON.stringify(c.pat)} 다 (SPEC 은 ${JSON.stringify(S.from)})`); continue; }
  let concl = null, nextA = c.analysis;
  if (S.relabel) {
    const a = String(c.analysis || "");
    const n = a.split(S.relabel.from).length - 1;
    if (n !== 1) { fail.push(`Q${S.qId}#${S.num} 해설에 ${S.relabel.from} 이 ${n}곳 (1곳이어야 한다)`); continue; }
    nextA = a.replace(S.relabel.from, S.relabel.to);
    concl = String(nextA).trim().split("\n").pop().trim();
  }
  plans.push({ ...S, c, nextA });
  console.log(`| Q${S.qId}#${S.num} | ${c.ok} | ${JSON.stringify(c.pat)} → **${S.to}** | ${concl ? "`" + concl + "`" : "무수정 (해설 부재)"} |`);
}
console.log("");

if (fail.length || plans.length !== SPEC.length) {
  console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다");
  console.log("");
  fail.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("✅ 사전 검사 통과 — 2건");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(SRC + ".before_patfix", raw, "utf8");
for (const p of plans) { p.c.pat = p.to; if (p.relabel) p.c.analysis = p.nextA; }
fs.writeFileSync(SRC, JSON.stringify(j, null, 2), "utf8");

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const back = JSON.parse(fs.readFileSync(SRC, "utf8"));
const pre = JSON.parse(raw);
const bad = [];
const bset = (back.literature || []).find((x) => (x.setId || x.id) === SID);
for (const S of SPEC) {
  const q = (bset.questions || []).find((x) => String(x.id) === S.qId);
  const c = (q.choices || []).find((x) => x.num === S.num);
  if (c.pat !== S.to) bad.push(`Q${S.qId}#${S.num} pat 이 ${JSON.stringify(c.pat)}`);
  if (S.relabel) {
    const a = String(c.analysis || "");
    if (a.includes(S.relabel.from)) bad.push(`Q${S.qId}#${S.num} 옛 라벨 ${S.relabel.from} 잔존`);
    if ((a.split(S.relabel.to).length - 1) !== 1) bad.push(`Q${S.qId}#${S.num} 새 라벨이 1곳이 아니다`);
    // 라벨 외 본문 무변 — 되돌려서 대조한다
    const p = pre.literature.find((x) => (x.setId || x.id) === SID).questions.find((x) => String(x.id) === S.qId).choices.find((x) => x.num === S.num);
    if (a.replace(S.relabel.to, S.relabel.from) !== String(p.analysis)) bad.push(`Q${S.qId}#${S.num} 라벨 외 본문이 달라졌다`);
  }
}
// pat·analysis 외 전건 무변
for (const sec of ["reading", "literature"]) for (const s of pre[sec] || []) {
  const sid = s.setId || s.id;
  const cur = (back[sec] || []).find((x) => (x.setId || x.id) === sid);
  for (const oq of s.questions || []) {
    const cq = (cur?.questions || []).find((x) => String(x.id) === String(oq.id));
    for (const oc of oq.choices || []) {
      const cc = (cq?.choices || []).find((x) => x.num === oc.num);
      const target = SPEC.some((S) => sid === SID && S.qId === String(oq.id) && S.num === oc.num);
      const strip = (x) => JSON.stringify({ ...x, pat: null, analysis: null });
      if (target) { if (strip(oc) !== strip(cc)) bad.push(`${sid} Q${oq.id}#${oc.num} 의 pat·analysis 외 필드가 달라졌다`); continue; }
      if (JSON.stringify(oc) !== JSON.stringify(cc)) bad.push(`${sid} Q${oq.id}#${oc.num} 가 달라졌다`);
    }
  }
}

console.log(`- 적용 후 MD5 \`${md5(fs.readFileSync(SRC, "utf8"))}\``);
console.log(`- 백업 \`${path.basename(SRC)}.before_patfix\``);
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- Q25#3 pat=L3 · 결론줄 [L3] · 라벨 외 본문 무변");
console.log("- Q27#5 pat=L2 (해설은 아직 없다 — 다음 단계에서 생성)");
console.log("- 두 선지의 pat·analysis 외 필드 무변 · 다른 선지·문항·세트 전건 무변");
