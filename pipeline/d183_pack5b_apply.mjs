// d183_pack5b_apply.mjs — 팩 5호-b 해설 자기모순 3건 재작성 + pat 확정 (발주 D-183)
//
// D-180 에서 심사관이 보류 선언했던 3건이다. 문안이 함께 와서 풀렸다.
// **이 3건이 현재 LIVE 도메인 어긋남의 전부다** — 적용 후 0건이 되어야 한다.
//
// ★ 무엇이 잘못돼 있었나 — 세 건 다 「🔍 가 선지를 지지하는데 ❌ 로 끝난다」
//   ① r20249c Q11#1 — 🔍 "지문의 원리와 정확히 일치한다" → ❌ 어긋난다
//   ② r20249d Q15#1 — 🔍 "ㄱ 일치 · ㄷ 일치" → ❌ 어긋난다
//   ③ r20149a Q18#4 — 🔍 결론이 **선지 문장을 그대로 되풀이**한다 → ❌ 부적절
//   학생이 읽으면 어느 쪽을 믿어야 할지 알 수 없다. analysis 전문을 갈아 끼운다.
//
// ★ pat 은 셋 다 L5 였다 — 독서 세트인데 L 계열이다(도메인 어긋남).
//   심사관 판정으로 R4 / R3 / R1 로 확정한다.
//
// ★ 어구는 발주가 준 것을 쓰되 **원문 그대로만** 통과시킨다
//   완화 대조로만 맞으면 멈춘다 — cs_spans 는 렌더가 문자 그대로 찾지 못하면
//   조용히 안 켜진다(부분 형광펜은 게이트도 cs_effect_audit 도 못 본다).
//   📌 인용 검산은 「…」 로 줄인 인용을 허용하되 조각마다 문장 안에 있어야 한다.
//
// ★ cs_ids 가 줄어드는 건이 둘 있다 (형광펜 개수가 준다 — 보고 대상)
//   ① 4개 → 2개   ② 3개 → 2개   ③ 1개 → 2개(늘어난다)
//   발주가 준 목록이 정본이다. 도구는 증감을 표로 찍어 눈에 보이게 한다.
//
// 사용: node pipeline/d183_pack5b_apply.mjs [--apply]

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
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);
const loose = (t) => String(t).replace(/[ⓐ-ⓩ㉠-㉿]/g, "").replace(/\s+/g, "");
// 따옴표만 통일한 완화형 — 📌 인용 대조 2단계용
const quoteNorm = (t) => loose(t).replace(/[‘’“”`´]/g, "'");

// quality_gate 가 근거를 요구하는 pat — 소스에서 읽는다 (S-15)
const qg = fs.readFileSync(path.join(ROOT, "pipeline/quality_gate.mjs"), "utf8");
const REQ = [...(qg.match(/REQUIRES?_CS\s*=\s*\[([^\]]+)\]/) || [])[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

// ── 발주 SPEC — 문안은 심사관이 준 전문 그대로다 ────────────────────────
const SPEC = [
  {
    yk: "2024_9월", sid: "r20249c", qid: 11, num: 1, np: "R4",
    csIds: ["r20249cs20", "r20249cs21"],
    csSpans: [
      { sent_id: "r20249cs20", text: "대상 기체만 붙더라도 그 기체의 농도를 알 수는 없다", occurrence: 1 },
      { sent_id: "r20249cs21", text: "대상 기체의 농도에 따라 수정 진동자의 주파수 변화를 미리 측정해 놓아야 한다", occurrence: 1 },
    ],
    analysis: `📌 지문 근거: "또한 대상 기체만 붙더라도 그 기체의 농도를 알 수는 없다." / "이 때문에 대상 기체의 농도에 따라 수정 진동자의 주파수 변화를 미리 측정해 놓아야 한다."
🔍 농도를 알기 위해 미리 재 두어야 하는 것은 압전체의 '고유 주파수' 한 값이 아니라, 농도를 달리해 가며 측정한 '주파수 변화'의 대응 관계다. 고유 주파수는 진동자 자체의 성질일 뿐이어서 그것만 알아서는 혼합 기체에서 잰 주파수가 어떤 농도에 해당하는지 알 수 없고, '알코올만 있는 기체'에서 한 번 측정하는 것으로는 농도별 대응 관계가 만들어지지 않는다.
❌ '농도에 따른 주파수 변화'를 '고유 주파수'로 바꿔 쓴 부적절한 진술 [개념 혼합]`,
  },
  {
    yk: "2024_9월", sid: "r20249d", qid: 15, num: 1, np: "R3",
    csIds: ["r20249ds34", "r20249ds36"],
    csSpans: [
      { sent_id: "r20249ds34", text: "사와 다스림을 받는 민의 구분을 분명히 하는 것이 천하의 이치", occurrence: 1 },
      { sent_id: "r20249ds36", text: "지배층과 피지배층 간의 차등을 엄격하게 유지하고자 했다", occurrence: 1 },
    ],
    analysis: `📌 지문 근거: "유형원은 다스리는 자인 사와 다스림을 받는 민의 구분을 분명히 하는 것이 천하의 이치라고 보고" / "두 사람은 … 지배층과 피지배층 간의 차등을 엄격하게 유지하고자 했다."
🔍 ㄱ(사민이 각자의 역할에 힘써 나라의 기풍이 유지됨)에는 유형원이 동의할 수 있다. 그러나 ㄷ은 '나라 안의 모든 이에게 존귀하게 될 기회가 열린다'고 하여 지배와 피지배의 경계가 낮아지는 상황을 긍정하는데, 유형원은 도덕적 능력으로 사를 선발하더라도 사와 민의 구분과 차등은 엄격히 유지하려 했다. 따라서 ㄷ에는 동의하지 않으므로, ㄱ과 ㄷ 모두에 동의한다는 판단은 성립하지 않는다.
❌ 유형원의 '차등 유지' 입장을 놓치고 ㄷ에 대한 동의를 끌어낸 부적절한 진술 [과잉 추론]`,
  },
  {
    yk: "2014_9월A", sid: "r20149a", qid: 18, num: 4, np: "R1",
    csIds: ["r20149as6", "r20149as7"],
    csSpans: [
      { sent_id: "r20149as6", text: "장소의 기하학적 특징을 활용하여 방향을 다시 찾는 방법", occurrence: 1 },
      { sent_id: "r20149as7", text: "긴 벽이 오른쪽에 있었는지와 같은 공간적 정보만을 활용하여", occurrence: 1 },
    ],
    analysis: `📌 지문 근거: "'재정위'는 방향 기억이 헝클어진 상황에서도 장소의 기하학적 특징을 활용하여 방향을 다시 찾는 방법이다." / "긴 벽이 오른쪽에 있었는지와 같은 공간적 정보만을 활용하여 먹이를 찾는다."
🔍 직사각형 상자에서 '긴 벽과 짧은 벽의 상대적 배치'라는 기하학적 정보는 상자를 180° 돌렸을 때 겹치는 대각 모퉁이끼리 서로 같다. 따라서 기하학적 특징만 쓰는 병아리가 먹이 위치 A와 구별하지 못하는 자리는 A의 대각인 C이고, A와 C를 비슷한 높은 빈도로 탐색하게 된다. A와 이웃한 D는 긴 벽·짧은 벽의 좌우 관계가 A와 거울상으로 달라 기하학적으로 구별되므로, A와 D를 혼동한다는 이 선지는 성립하지 않는다.
❌ 대각 대칭(A-C)을 이웃 모퉁이(A-D)의 혼동으로 잘못 분석한 부적절한 진술 [사실 왜곡]`,
  },
];

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const findSet = (d, yk, sid) => {
  for (const sec of ["reading", "literature"]) {
    const s = (d[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (s) return { sec, s };
  }
  return null;
};

console.log("# 팩 5호-b — 해설 자기모순 3건 재작성 + `pat` 확정 (D-183)");
console.log("");
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\``);
console.log("");

// ── 사전 대조 (하나라도 실패면 아무것도 안 쓴다) ─────────────────────────
const plans = [], miss = [], soft = [];
for (const sp of SPEC) {
  const at = `${sp.sid} Q${sp.qid}#${sp.num}`;
  const f = findSet(data, sp.yk, sp.sid);
  if (!f) { miss.push(`${sp.yk}::${sp.sid} 세트 없음`); continue; }
  const q = (f.s.questions || []).find((x) => x.id === sp.qid);
  if (!q) { miss.push(`${at} 문항 없음`); continue; }
  const c = (q.choices || []).find((x) => x.num === sp.num);
  if (!c) { miss.push(`${at} 선지 없음`); continue; }

  if (c.ok !== false) { miss.push(`${at} — ok 가 false 가 아니다 (${c.ok})`); continue; }
  if (String(c.pat) !== "L5") { miss.push(`${at} — 현재 pat 이 ${JSON.stringify(c.pat)} 다 (전제 L5)`); continue; }
  if (!(sp.np in NAME)) { miss.push(`${at} — 새 pat ${sp.np} 가 10종에 없다`); continue; }
  const wantDom = f.sec === "reading" ? /^[RV]/ : /^L/;
  if (!wantDom.test(sp.np)) { miss.push(`${at} — ${f.sec} 세트에 ${sp.np} 는 도메인이 안 맞는다`); continue; }
  if (REQ.includes(sp.np) && !sp.csIds.length) { miss.push(`🔴 ${at} — ${sp.np} 는 근거 필수인데 cs_ids 가 빈다`); continue; }
  if (sp.np === "V" && sp.csIds.length + sp.csSpans.length > 0) { miss.push(`🔴 ${at} — pat=V 인데 근거가 남는다`); continue; }

  // 근거 문장 — 존재 · 형광펜
  const byId = new Map((f.s.sents || []).map((x) => [String(x.id), x]));
  let bad = false;
  const rows = [];
  for (const id of sp.csIds) {
    const x = byId.get(id);
    if (!x) { miss.push(`${at} — 문장 ${id} 없음`); bad = true; continue; }
    const st = x.sentType || "body";
    if (NON_HL.has(st)) { miss.push(`${at} — ${id} 가 ${st} (형광펜 안 켜짐)`); bad = true; continue; }
    rows.push({ id, st, t: x.t });
  }
  // cs_spans — 원문 그대로만 통과 (부분 형광펜은 완화 대조로는 안 켜진다)
  for (const s of sp.csSpans) {
    if (!sp.csIds.includes(s.sent_id)) { miss.push(`${at} — cs_spans 문장 ${s.sent_id} 가 cs_ids 에 없다`); bad = true; continue; }
    const x = byId.get(s.sent_id);
    if (!x) { miss.push(`${at} — cs_spans 문장 ${s.sent_id} 없음`); bad = true; continue; }
    const n = String(x.t).split(s.text).length - 1;
    if (n === 0) {
      const softHit = loose(x.t).includes(loose(s.text));
      miss.push(`${at} — ${s.sent_id} 에 「${s.text.slice(0, 26)}…」 가 ${softHit ? "**완화 대조로만** 맞는다 (부분 형광펜은 원문 일치 필요)" : "없다"}`);
      bad = true; continue;
    }
    if (n !== s.occurrence) { miss.push(`${at} — 「${s.text.slice(0, 26)}…」 출현 ${n}회 ≠ occurrence ${s.occurrence}`); bad = true; continue; }
  }

  // 새 해설 — 결론줄 기호 · ok 정합 · 끝 라벨 ↔ pat
  const A1 = sp.analysis;
  const lines = A1.trimEnd().split("\n");
  const tail = lines[lines.length - 1];
  if (!/[❌✅]/.test(tail)) { miss.push(`${at} — 새 결론줄에 판정 기호가 없다`); bad = true; }
  else if (!tail.includes("❌")) { miss.push(`${at} — ok:false 인데 결론줄이 ❌ 가 아니다`); bad = true; }
  const m = tail.match(/\[([^\]]+)\]\s*$/);
  if (!m) { miss.push(`${at} — 새 결론줄이 라벨로 끝나지 않는다`); bad = true; }
  else if (LAB2PAT[m[1]] !== sp.np) { miss.push(`${at} — ⑬축 라벨↔pat 어긋남 (${m[1]} vs ${sp.np})`); bad = true; }
  if (!A1.includes("📌")) { miss.push(`${at} — 새 해설에 📌 지문 근거가 없다`); bad = true; }

  // 📌 인용 ↔ cs_ids 문장 대조 (「…」 로 줄인 인용은 조각마다 본다)
  const pin = A1.split("\n").find((l) => l.includes("📌")) || "";
  const quotes = [...pin.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  if (!quotes.length) { miss.push(`${at} — 📌 줄에 인용부호가 없다`); bad = true; }
  const qrows = [];
  for (const qt of quotes) {
    const parts = qt.split("…").map((s) => s.trim()).filter(Boolean);
    let stage = 0;
    for (const p of parts) {
      const exact = rows.some((r) => String(r.t).includes(p));
      const norm = rows.some((r) => quoteNorm(r.t).includes(quoteNorm(p)));
      if (exact) stage = Math.max(stage, 1);
      else if (norm) { stage = Math.max(stage, 2); }
      else { miss.push(`${at} — 📌 인용 「${p.slice(0, 30)}…」 가 cs_ids 문장 어디에도 없다`); bad = true; stage = 0; break; }
    }
    if (stage === 2) soft.push(`🟡 ${at} — 📌 인용 「${qt.slice(0, 34)}…」 는 따옴표를 통일해야 맞는다`);
    qrows.push({ qt, stage, parts: parts.length });
  }
  if (bad) continue;

  plans.push({ ...sp, sec: f.sec, c, op: String(c.pat), A0: String(c.analysis || ""), A1, rows, qrows, oldCs: [...(c.cs_ids || [])] });
}

// ── 미리보기 ────────────────────────────────────────────────────────────
console.log("## 적용 대상");
console.log("");
console.log("| # | 회차 | 세트 | 위치 | `pat` | 결론줄 라벨 | `cs_ids` | `cs_spans` | 해설 |");
console.log("|--:|---|---|---|---|---|---|---|---|");
plans.forEach((p, i) => {
  const lab = p.A1.trimEnd().split("\n").pop().match(/\[([^\]]+)\]\s*$/)[1];
  console.log(`| ${i + 1} | ${p.yk} | \`${p.sid}\` | Q${p.qid}#${p.num} | \`${p.op}\` → **\`${p.np}\`** | **추가** \`[${lab}]\` | ${p.oldCs.length} → **${p.csIds.length}**${p.csIds.length < p.oldCs.length ? " 🔽" : p.csIds.length > p.oldCs.length ? " 🔼" : ""} | **+${p.csSpans.length}** | ${p.A0.length}자 → **${p.A1.length}자** |`);
});
console.log("");
for (const p of plans) {
  console.log(`### \`${p.sid}\` Q${p.qid}#${p.num} — ${p.op} → ${p.np}`);
  console.log("");
  console.log(`- 선지: ${p.c.t}`);
  console.log(`- 옛 결론줄: ${p.A0.trimEnd().split("\n").pop()}`);
  console.log(`- 새 결론줄: ${p.A1.trimEnd().split("\n").pop()}`);
  console.log(`- \`cs_ids\` ${JSON.stringify(p.oldCs)} → **${JSON.stringify(p.csIds)}**`);
  const dropped = p.oldCs.filter((x) => !p.csIds.includes(x));
  const added = p.csIds.filter((x) => !p.oldCs.includes(x));
  if (dropped.length) console.log(`  - ⚠ 형광펜에서 **빠지는 문장**: ${dropped.join(", ")}`);
  if (added.length) console.log(`  - 새로 켜지는 문장: ${added.join(", ")}`);
  for (const r of p.rows) console.log(`- 근거 \`${r.id}\` (${r.st}) — ${String(r.t).slice(0, 60)}…`);
  for (const s of p.csSpans) console.log(`- 부분 형광펜 \`${s.sent_id}\` → 「${s.text}」 (원문 그대로 · ${s.occurrence}회)`);
  for (const qr of p.qrows) console.log(`- 📌 인용 ${qr.stage === 1 ? "✅ 원문 그대로" : "🟡 따옴표 통일 후 일치"} (조각 ${qr.parts}) — 「${qr.qt.slice(0, 44)}…」`);
  console.log("");
}
if (soft.length) { console.log("## 🟡 완화 대조로 맞은 건"); console.log(""); soft.forEach((x) => console.log(`- ${x}`)); console.log(""); }
if (miss.length) {
  console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다");
  console.log("");
  miss.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
if (plans.length !== SPEC.length) { console.log(`## 🔴 계획 ${plans.length} ≠ SPEC ${SPEC.length}`); process.exit(1); }
console.log(`✅ 사전 대조 통과 — ${plans.length}건`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ────────────────────────────────────────────────────────────────
fs.mkdirSync(path.join(ROOT, "pipeline/backups"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d183.json"), before);

const snap = plans.map((p) => {
  const f = findSet(data, p.yk, p.sid);
  return { ok: p.c.ok, t: p.c.t, sents: JSON.stringify(f.s.sents) };
});
for (const p of plans) {
  p.c.pat = p.np;
  p.c.analysis = p.A1;
  p.c.cs_ids = [...p.csIds];
  p.c.cs_spans = p.csSpans.map((s) => ({ ...s }));
}
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 (S-02) ──────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
if (after[0] === 0xef) { console.log("🔴 BOM"); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const fail = [];
plans.forEach((p, i) => {
  const at = `${p.sid} Q${p.qid}#${p.num}`;
  const f2 = findSet(back, p.yk, p.sid);
  if (!f2) { fail.push(`${at} 세트 소실`); return; }
  const c2 = f2.s.questions.find((q) => q.id === p.qid).choices.find((x) => x.num === p.num);

  if (c2.pat !== p.np) fail.push(`${at} pat 미반영 (${c2.pat})`);
  if (c2.ok !== snap[i].ok) fail.push(`${at} **ok 가 달라졌다**`);
  if (c2.t !== snap[i].t) fail.push(`${at} **선지 문면이 달라졌다**`);
  if (JSON.stringify(f2.s.sents) !== snap[i].sents) fail.push(`${at} **본문이 달라졌다**`);
  if (String(c2.analysis) !== p.A1) fail.push(`${at} 해설 미반영`);
  if (JSON.stringify(c2.cs_ids || []) !== JSON.stringify(p.csIds)) fail.push(`${at} cs_ids 미반영`);
  if (JSON.stringify(c2.cs_spans || []) !== JSON.stringify(p.csSpans)) fail.push(`${at} cs_spans 미반영`);

  const byId = new Map(f2.s.sents.map((x) => [String(x.id), x]));
  for (const id of c2.cs_ids || []) {
    const x = byId.get(id);
    if (!x) fail.push(`${at} 끊긴 근거 ${id}`);
    else if (NON_HL.has(x.sentType || "body")) fail.push(`${at} 비-하이라이트 근거 ${id}`);
  }
  for (const s of c2.cs_spans || []) {
    const x = byId.get(s.sent_id);
    if (!x) fail.push(`${at} 끊긴 span ${s.sent_id}`);
    else if (!String(x.t).includes(s.text)) fail.push(`${at} 🔴 span 어구가 문장에 없다 — 부분 형광펜이 안 켜진다`);
  }
  if (c2.ok === false && REQ.includes(c2.pat) && !(c2.cs_ids || []).length) fail.push(`${at} 🔴 근거 필수 pat 인데 cs_ids 가 빈다`);
  if (c2.pat === "V" && ((c2.cs_ids || []).length + (c2.cs_spans || []).length) > 0) fail.push(`${at} 🔴 C_vpat_dirty`);

  const tail = String(c2.analysis).trimEnd().split("\n").pop();
  const m = tail.match(/\[([^\]]+)\]\s*$/);
  if (!m) fail.push(`${at} 결론줄이 라벨로 끝나지 않는다`);
  else if (LAB2PAT[m[1]] !== p.np) fail.push(`${at} ⑬축 라벨↔pat 어긋남 (${m[1]} vs ${p.np})`);
  // 자기모순이 실제로 사라졌는가 — 옛 해설이 한 조각도 남지 않았는가
  if (String(c2.analysis).includes("정확히 일치한다")) fail.push(`${at} 옛 해설의 「정확히 일치한다」 가 남아 있다`);
});

// ── LIVE 전수 ───────────────────────────────────────────────────────────
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at0 = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at0, src.indexOf("]);", at0)).matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.includes("::")));
let dom = 0; const domList = [];
let labBad = 0, labN = 0, newCrit = 0, vDirty = 0, oddPat = 0, spanBad = 0;
const OK_PAT = new Set(Object.keys(NAME));
for (const [yk, v] of Object.entries(back)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  if (!REL.has(`${yk}::${st.setId || st.id}`)) continue;
  const byId = new Map((st.sents || []).map((x) => [String(x.id), x]));
  for (const q of st.questions || []) for (const c of q.choices || []) {
    const p = String(c.pat ?? "");
    if (c.pat != null && p !== "" && !OK_PAT.has(p.trim())) { oddPat++; continue; }
    if (p && ((sec === "reading" && /^L/.test(p)) || (sec === "literature" && /^R/.test(p)))) { dom++; domList.push(`${yk}::${st.setId || st.id} Q${q.id}#${c.num} pat=${p}`); }
    if (c.ok === false && REQ.includes(p) && !(c.cs_ids || []).length) newCrit++;
    if (p === "V" && ((c.cs_ids || []).length + (c.cs_spans || []).length) > 0) vDirty++;
    for (const s of c.cs_spans || []) {
      const x = byId.get(s.sent_id);
      if (!x || !String(x.t).includes(s.text)) spanBad++;
    }
    const mm = String(c.analysis || "").trimEnd().split("\n").pop().match(/\[([^\]]+)\]\s*$/);
    if (mm && mm[1] in LAB2PAT) { labN++; if (LAB2PAT[mm[1]] !== p) labBad++; }
  }
}

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.before_d183.json`");
console.log("");
if (fail.length) {
  console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오");
  console.log("");
  fail.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- ${plans.length}건 전부 \`pat\`·해설·\`cs_ids\`·\`cs_spans\` 반영 · 결론줄 라벨 ↔ \`pat\` 일치(⑬축)`);
console.log("- 근거 끊긴 id 0 · 비-하이라이트 0 · 부분 형광펜 어구가 전부 문장 안에 있다");
console.log("- `ok`·선지 문면·본문 **무변**");
console.log("");
console.log("### LIVE 전수 재확인");
console.log("");
console.log(`- **도메인 어긋남(독서에 L / 문학에 R): ${dom}건**${dom ? ` — ${domList.join(" · ")}` : " ← 팩 5호-b 로 종결"}`);
console.log(`- 정의에 없는 \`pat\` 값: **${oddPat}건**`);
console.log(`- ⑬축 라벨↔\`pat\` 어긋남: **${labBad}건** (라벨 보유 ${labN}건)`);
console.log(`- 근거 필수 \`pat\` 인데 \`cs_ids\` 가 빈 선지: **${newCrit}건**`);
console.log(`- \`C_vpat_dirty\`(V 인데 근거 보유): **${vDirty}건**`);
console.log(`- 문장에 없는 \`cs_spans\` 어구(안 켜지는 부분 형광펜): **${spanBad}건**`);
