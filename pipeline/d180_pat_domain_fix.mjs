// d180_pat_domain_fix.mjs — LIVE pat 도메인 정합화 (발주 D-180 · 팩 5호-a)
//
// 심사관 건별 판정 22건 중 **20건**을 적용한다. 2건은 멈춘다(아래).
//
// ★ 두 가지 일을 한다
//   ⓐ pat 교체 — 독서 세트는 R/V, 문학 세트는 L 계열로
//   ⓑ 결론줄 끝 라벨을 새 pat 명칭으로 맞춘다 (D-170 형식)
//      · 라벨이 있으면 **교체**한다 (8건)
//      · 라벨이 없으면 결론줄 끝에 **추가**한다 (12건)
//
// ★ 기존 「라벨」의 대부분은 라벨이 아니었다
//   [방향 오판] · [주객전도] · [부정형 문항이므로 정답] · [주체-행위 불일치] …
//   10종 명칭 어디에도 없는 **자유 문구**다. ⑬축은 이런 것을 만나면
//   「라벨이 없다」로 보고 판정을 건너뛴다(D-163 ② 재설계 기준).
//   그래서 지금까지 이 22건이 조용히 지나갔다.
//
// ★ 멈추는 2건 — 발주대로 「그 건만」 멈춘다
//   ① r20166b Q24#1 — setId `r20166b` 가 **2016_6월A·2016_6월B 두 회차에 모두 LIVE** 로 있다.
//      발주에 회차가 없어 어느 쪽인지 특정할 수 없다. 찍으면 엉뚱한 세트를 고친다.
//   ② l20246d Q34#5 — cs_ids 가 **비어 있는데** 새 pat L1 은 quality_gate 가
//      근거를 요구하는 7종(R1·R2·R4·L1·L2·L4·L5)에 든다. 지금 R3 라 면제돼 있을 뿐이다.
//      바꾸면 **CRITICAL 이 새로 하나 생긴다** — 발주 검증 요구(CRITICAL 0)와 정면 충돌한다.
//      근거 어구를 함께 받아야 적용할 수 있다.
//
// 해설은 라벨 자리 말고는 손대지 않는다. 검산에서 라벨을 지운 본문을 대조한다.
//
// 사용: node pipeline/d180_pat_domain_fix.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

const NAME = { R1: "사실 왜곡", R2: "인과·관계 전도", R3: "과잉 추론", R4: "개념 혼합", V: "어휘",
  L1: "표현·형식 오독", L2: "정서·태도 오독", L3: "주제·의미 과잉", L4: "구조·맥락 오류", L5: "보기 대입 오류" };
const LAB2PAT = Object.fromEntries(Object.entries(NAME).map(([k, v]) => [v, k]));
// quality_gate 가 근거를 요구하는 pat — 소스에서 읽는다 (S-15)
const qg = fs.readFileSync(path.join(ROOT, "pipeline/quality_gate.mjs"), "utf8");
const REQ = [...(qg.match(/REQUIRES?_CS\s*=\s*\[([^\]]+)\]/) || [])[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

// [회차, setId, Q, #, 새 pat]  — 회차는 실측으로 특정했다
const SPEC = [
  ["2016수능A", "r2016a", 17, 4, "R1"],
  ["2019수능", "r2019a", 17, 1, "R2"],
  ["2020_9월", "r20209a", 23, 5, "R2"],
  ["2021_9월", "r20219c", 28, 5, "R1"],
  ["2017_6월", "l20176b", 25, 4, "L4"],
  ["2020수능", "l2020a", 23, 4, "L3"],
  ["2023_6월", "l20236a", 20, 1, "L2"],
  ["2023_6월", "l20236a", 20, 2, "L2"],
  ["2023_6월", "l20236a", 20, 3, "L2"],
  ["2023_6월", "l20236a", 20, 5, "L2"],
  ["2023_9월", "l20239a", 19, 2, "L3"],
  ["2024_6월", "l20246c", 28, 3, "L2"],
  ["2024_6월", "l20246d", 34, 1, "L1"],
  ["2024_6월", "l20246d", 34, 2, "L1"],
  ["2024_6월", "l20246d", 34, 4, "L1"],
  ["2024_9월", "l20249a", 18, 3, "L3"],
  ["2024_9월", "l20249a", 18, 4, "L3"],
  ["2024_9월", "l20249a", 20, 3, "L2"],
  ["2024_9월", "l20249b", 25, 3, "L1"],
  ["2024_9월", "l20249c", 31, 4, "L5"],
];
const HELD = [
  ["r20166b", 24, 1, "V", "setId 가 2016_6월A·2016_6월B 두 회차에 모두 LIVE 로 있다 — 회차 미특정"],
  ["l20246d", 34, 5, "L1", "cs_ids 가 비었는데 L1 은 근거 필수 — 적용하면 QG CRITICAL 신규 1건"],
];

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const findSet = (yk, sid) => {
  for (const sec of ["reading", "literature"]) {
    const s = (data[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (s) return { sec, s };
  }
  return null;
};

console.log("# LIVE pat 도메인 정합화 (D-180 · 팩 5호-a)");
console.log("");
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\``);
console.log("");

const plans = [], miss = [];
for (const [yk, sid, qid, num, np] of SPEC) {
  const f = findSet(yk, sid);
  if (!f) { miss.push(`${yk}::${sid} 세트 없음`); continue; }
  const c = f.s.questions.find((q) => q.id === qid)?.choices?.find((x) => x.num === num);
  if (!c) { miss.push(`${yk}::${sid} Q${qid}#${num} 선지 없음`); continue; }
  if (!(np in NAME)) { miss.push(`${sid} Q${qid}#${num} — 새 pat ${np} 가 10종에 없다`); continue; }
  if (c.pat === np) { miss.push(`${sid} Q${qid}#${num} — 이미 ${np} 다(중복 적용 의심)`); continue; }
  // 도메인 관례 — 독서는 R/V, 문학은 L
  const wantDom = f.sec === "reading" ? /^[RV]/ : /^L/;
  if (!wantDom.test(np)) { miss.push(`${sid} Q${qid}#${num} — ${f.sec} 세트에 ${np} 는 도메인이 안 맞는다`); continue; }
  // 근거 필수 pat 인데 cs_ids 가 비었으면 멈춘다 (CRITICAL 신규 발생 방지)
  if (REQ.includes(np) && !(c.cs_ids || []).length) {
    miss.push(`🔴 ${sid} Q${qid}#${num} — cs_ids 가 비었는데 ${np} 는 근거 필수다. CRITICAL 이 새로 생긴다`); continue;
  }
  const A0 = String(c.analysis || "");
  const lines = A0.trimEnd().split("\n");
  const tail = lines[lines.length - 1];
  if (!/[❌✅]/.test(tail)) { miss.push(`${sid} Q${qid}#${num} — 결론줄에 판정 기호가 없다`); continue; }
  if ((c.ok === false) !== tail.includes("❌")) { miss.push(`${sid} Q${qid}#${num} — ok 와 결론 기호가 어긋난다`); continue; }
  const m = tail.match(/\[([^\]]+)\]\s*$/);
  const newLab = `[${NAME[np]}]`;
  let A1, mode;
  if (m) {
    const old = `[${m[1]}]`;
    const n = A0.split(old).length - 1;
    if (n !== 1) { miss.push(`${sid} Q${qid}#${num} — 라벨 \`${old}\` 가 ${n}곳이다(1곳이어야 한다)`); continue; }
    A1 = A0.split(old).join(newLab);
    mode = { kind: "교체", old, n, wasPat: LAB2PAT[m[1]] || null };
  } else {
    lines[lines.length - 1] = tail.trimEnd() + " " + newLab;
    A1 = lines.join("\n") + A0.slice(A0.trimEnd().length);
    mode = { kind: "추가", old: null };
  }
  plans.push({ yk, sid, qid, num, sec: f.sec, c, np, op: String(c.pat), A0, A1, mode, newLab, nCs: (c.cs_ids || []).length });
}

console.log("## 적용 대상");
console.log("");
console.log("| 세트 | 회차 | 위치 | pat | 결론줄 라벨 | 근거 |");
console.log("|---|---|---|---|---|--:|");
for (const p of plans)
  console.log(`| \`${p.sid}\` | ${p.yk} | Q${p.qid}#${p.num} | \`${p.op}\` → **\`${p.np}\`** | ${p.mode.kind === "교체" ? `\`${p.mode.old}\` → **\`${p.newLab}\`**` : `**추가** \`${p.newLab}\``} | ${p.nCs} |`);
console.log("");
console.log(`✅ 적용 **${plans.length}건** — 교체 ${plans.filter((p) => p.mode.kind === "교체").length} · 추가 ${plans.filter((p) => p.mode.kind === "추가").length}`);
console.log("");
console.log("## 🟠 보류 — 발주대로 그 건만 멈춘다");
console.log("");
for (const [sid, qid, num, np, why] of HELD) console.log(`- \`${sid}\` Q${qid}#${num} → ${np} — ${why}`);
console.log("");
if (miss.length) {
  console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다");
  miss.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}

if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. --apply"); process.exit(0); }

fs.mkdirSync(path.join(ROOT, "pipeline/backups"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d180.json"), before);
const snap = plans.map((p) => ({ cs: JSON.stringify(p.c.cs_ids), ok: p.c.ok }));
for (const p of plans) { p.c.pat = p.np; p.c.analysis = p.A1; }
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

const after = fs.readFileSync(DATA);
if (after[0] === 0xef) { console.log("🔴 BOM"); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const fail = [];
plans.forEach((p, i) => {
  let s2 = null;
  for (const sec of ["reading", "literature"]) { const x = (back[p.yk]?.[sec] || []).find((y) => (y.setId || y.id) === p.sid); if (x) s2 = x; }
  const c2 = s2.questions.find((q) => q.id === p.qid).choices.find((x) => x.num === p.num);
  const at2 = `${p.sid} Q${p.qid}#${p.num}`;
  if (c2.pat !== p.np) fail.push(`${at2} pat 미반영`);
  if (JSON.stringify(c2.cs_ids) !== snap[i].cs) fail.push(`${at2} **cs_ids 가 달라졌다**`);
  if (c2.ok !== snap[i].ok) fail.push(`${at2} **ok 가 달라졌다**`);
  const tail = String(c2.analysis).trimEnd().split("\n").pop();
  const m = tail.match(/\[([^\]]+)\]\s*$/);
  if (!m) fail.push(`${at2} 결론줄이 라벨로 끝나지 않는다`);
  else if (LAB2PAT[m[1]] !== p.np) fail.push(`${at2} ⑬축 라벨↔pat 어긋남 (${m[1]} vs ${p.np})`);
  if (p.mode.old && String(c2.analysis).includes(p.mode.old)) fail.push(`${at2} 옛 라벨 잔존`);
  // 라벨 밖 문면 훼손 검사 — 「교체」와 「추가」는 대조 방법이 다르다
  //   교체: 라벨끼리 같은 기호로 바꾸면 나머지가 같아야 한다
  //   추가: 붙인 공백+라벨을 도로 떼면 원문이 되어야 한다
  //     ★ 교체용 대조를 추가에 쓰면 **반드시 실패한다** — 앞의 공백 한 칸이 원문에 없다.
  //       D-168 ⑨ 에서 같은 함정에 빠져 「안 써졌다」로 읽고 재실행해 중복 적용했다.
  //       이번에도 12건이 거짓 실패로 찍혔다. 데이터는 정확히 쓰여 있었다.
  const got = String(c2.analysis);
  if (p.mode.kind === "교체") {
    const strip = (t) => t.split(p.newLab).join("§").split(p.mode.old).join("§");
    if (strip(got) !== strip(p.A0)) fail.push(`${at2} **해설이 라벨 밖에서 달라졌다**`);
  } else {
    const parts = got.split(" " + p.newLab);
    if (parts.length !== 2) fail.push(`${at2} 붙인 라벨이 1곳이 아니다 (${parts.length - 1}곳)`);
    else if (parts.join("") !== p.A0) fail.push(`${at2} **해설이 라벨 밖에서 달라졌다**`);
  }
});
// LIVE 전수 — 도메인 어긋남·⑬축 재확인
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.includes("::")));
let dom = 0, labBad = 0, labN = 0, newCrit = 0;
for (const [yk, v] of Object.entries(back)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  if (!REL.has(`${yk}::${st.setId || st.id}`)) continue;
  for (const q of st.questions || []) for (const c of q.choices || []) {
    const p = String(c.pat || "");
    if (p && !(p in NAME)) continue;
    if (p && ((sec === "reading" && /^L/.test(p)) || (sec === "literature" && /^R/.test(p)))) dom++;
    if (c.ok === false && REQ.includes(p) && !(c.cs_ids || []).length) newCrit++;
    const m = String(c.analysis || "").trimEnd().split("\n").pop().match(/\[([^\]]+)\]\s*$/);
    if (m && m[1] in LAB2PAT) { labN++; if (LAB2PAT[m[1]] !== p) labBad++; }
  }
}

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- ${plans.length}건 전부 \`pat\` 반영 · 결론줄 끝 라벨 ↔ \`pat\` **일치**`);
console.log("- `cs_ids`·`ok` 무변 · **해설은 라벨 밖에서 한 글자도 안 달라졌다**");
console.log("");
console.log("### LIVE 전수 재확인");
console.log("");
console.log(`- 도메인 어긋남(독서에 L / 문학에 R): **${dom}건**`);
console.log(`- ⑬축 라벨↔pat 어긋남: **${labBad}건** (라벨 보유 ${labN}건)`);
console.log(`- 근거 필수 pat 인데 cs_ids 가 빈 선지: **${newCrit}건**`);
