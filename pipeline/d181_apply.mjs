// d181_apply.mjs — D-180 보류 2건 해소 (발주 D-181 · 심사관 실측 완료)
//
// D-180 에서 「그 건만」 멈춘 2건이다. 심사관이 실측으로 둘 다 풀었다.
//   ① r20166b Q24#1 — 회차가 **2016_6월B** 로 특정됐다.
//      2016_6월A 의 r20166b 는 19~21번 구성이라 Q24 자체가 없다(본 도구가 재확인한다).
//      `pat` 0 → V.
//   ② l20246d Q34#5 — `pat` R3 → L1 + 근거 `l20246ds39` + 부분 형광펜.
//      근거 어구가 함께 와서 「L1 은 근거 필수」 충돌이 풀렸다.
//
// ★ ①에는 발주에 없는 동반 조치가 하나 필요하다 — `cs_ids` 비움
//   `quality_gate.mjs:1524` C_vpat_dirty 는 **CRITICAL** 이고 판정식은
//       pat === "V" && cs_ids.length + cs_spans.length > 0
//   지금 이 선지는 cs_ids `["r20166bs11"]` 를 갖고 있다. `pat` 만 V 로 바꾸면
//   **CRITICAL 이 새로 1건 생긴다** — 발주 ③(CRITICAL 0)과 정면 충돌한다.
//   D-180 의 가드는 「근거 필수 pat 인데 cs_ids 가 빔」 방향만 봤고
//   그 역방향(V 인데 cs_ids 가 있음)은 안 봤다. 그래서 이 충돌이 안 드러났다.
//
//   추정이 아니라 실측으로 정한다 (S-14):
//     · LIVE `pat=V` 선지 **185개 전부** cs_ids·cs_spans 가 비어 있다 (예외 0)
//     · LIVE 에서 V 선지를 가진 문항 **62개 전부** 형제 선지는 cs_ids 를 갖는다
//       → 「V 선지만 근거를 비운다」가 확립된 관례다. 형광펜 비대칭은 규약이지 결함이 아니다
//     · quality_gate 자신의 `--fix` 도 같은 동작을 한다 (cs_ids=[] · cs_spans 삭제)
//   그래도 이건 **화면에서 형광펜 1개가 꺼지는 변경**이다. 보고에 올려 심사관 확인을 받는다.
//   되돌리려면 백업에서 이 선지의 cs_ids 한 줄만 되돌리면 된다.
//
// ★ 결론줄 라벨 (D-170 형식)
//   두 건 다 지금 결론줄에 라벨이 없다 → **추가** 모드다.
//   ★ 「추가」를 「교체」용 대조로 검산하면 반드시 거짓 실패한다 — 앞 공백 한 칸이 원문에 없다.
//     D-168 ⑨ 에서 이 함정에 빠져 재실행 → 중복 적용까지 갔다. D-180 에서 또 12건 찍혔다.
//     아래 검산은 「붙인 공백+라벨을 도로 떼면 원문이 되는가」로 건다.
//
// 해설은 라벨 자리 말고 한 글자도 손대지 않는다. 본문(sents)은 읽기만 한다.
//
// 사용: node pipeline/d181_apply.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

const NAME = { R1: "사실 왜곡", R2: "인과·관계 전도", R3: "과잉 추론", R4: "개념 혼합", V: "어휘",
  L1: "표현·형식 오독", L2: "정서·태도 오독", L3: "주제·의미 과잉", L4: "구조·맥락 오류", L5: "보기 대입 오류" };
const LAB2PAT = Object.fromEntries(Object.entries(NAME).map(([k, v]) => [v, k]));
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);
const loose = (t) => String(t).replace(/[ⓐ-ⓩ㉠-㉿]/g, "").replace(/\s+/g, "");

// quality_gate 가 근거를 요구하는 pat — 이름이 아니라 소스에서 읽는다 (S-15)
const qg = fs.readFileSync(path.join(ROOT, "pipeline/quality_gate.mjs"), "utf8");
const REQ = [...(qg.match(/REQUIRES?_CS\s*=\s*\[([^\]]+)\]/) || [])[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

// ── 발주 SPEC ────────────────────────────────────────────────────────────
const SPEC = [
  {
    yk: "2016_6월B", sid: "r20166b", qid: 24, num: 1, np: "V",
    wasCs: ["r20166bs11"],          // 현재 값 — 사전 대조로 일치를 확인한다
    csIds: [],                      // V 규약 (C_vpat_dirty · CRITICAL)
    csSpans: null,
    why: "어휘 — '방치'의 사전적 의미 대조. V 규약상 근거를 비운다",
  },
  {
    yk: "2024_6월", sid: "l20246d", qid: 34, num: 5, np: "L1",
    wasCs: [],
    csIds: ["l20246ds39"],
    csSpans: [{ sent_id: "l20246ds39", text: "자유다 마음대로 뛰어라", occurrence: 1 }],
    why: "표현·형식 오독 — ㉤ 원문이 '제한한 의미에 따라 움직임'을 직접 반증한다",
  },
];
// 발주에 「보조 근거 필요시 s30 추가 가능」이 있으나 s39 하나로 게이트·형광펜이 모두 선다.
// 발주 밖으로 넓히지 않는다 (§9-2). 필요하면 별도 발주로 받는다.

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const findSet = (yk, sid) => {
  for (const sec of ["reading", "literature"]) {
    const s = (data[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (s) return { sec, s };
  }
  return null;
};

console.log("# D-180 보류 2건 해소 (발주 D-181)");
console.log("");
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\``);
console.log("");

// ── ① 회차 특정 근거 재확인 — 심사관 실측을 도구가 독립 검증한다 ──────────
console.log("## ① 회차 특정 재확인 — `r20166b` 가 두 회차에 있다");
console.log("");
console.log("| 회차 | range | 문항 | Q24 |");
console.log("|---|---|---|:-:|");
let dupOk = false;
for (const yk of ["2016_6월A", "2016_6월B"]) {
  const f = findSet(yk, "r20166b");
  if (!f) { console.log(`| ${yk} | — | 세트 없음 | — |`); continue; }
  const nums = (f.s.questions || []).map((q) => q.id);
  const has = nums.includes(24);
  console.log(`| ${yk} | ${f.s.range} | ${nums.join(",")} | ${has ? "✅ 있음" : "— 없음"} |`);
  if (yk === "2016_6월A" && !has) dupOk = true;
}
console.log("");
console.log(dupOk
  ? "✅ **2016_6월A 에는 Q24 가 없다** — 회차는 `2016_6월B` 로 유일하게 특정된다"
  : "🔴 2016_6월A 에도 Q24 가 있다 — 특정 불가");
console.log("");

// ── 사전 대조 (하나라도 실패면 아무것도 안 쓴다) ─────────────────────────
const plans = [], miss = [];
if (!dupOk) miss.push("회차 특정 실패 — 2016_6월A 에도 Q24 가 있다");

for (const sp of SPEC) {
  const at = `${sp.sid} Q${sp.qid}#${sp.num}`;
  const f = findSet(sp.yk, sp.sid);
  if (!f) { miss.push(`${sp.yk}::${sp.sid} 세트 없음`); continue; }
  const q = (f.s.questions || []).find((x) => x.id === sp.qid);
  if (!q) { miss.push(`${at} 문항 없음`); continue; }
  const c = (q.choices || []).find((x) => x.num === sp.num);
  if (!c) { miss.push(`${at} 선지 없음`); continue; }

  if (!(sp.np in NAME)) { miss.push(`${at} — 새 pat ${sp.np} 가 10종에 없다`); continue; }
  if (String(c.pat) === sp.np) { miss.push(`${at} — 이미 ${sp.np} 다 (중복 적용 의심)`); continue; }
  // 도메인 관례 — 독서는 R/V, 문학은 L
  const wantDom = f.sec === "reading" ? /^[RV]/ : /^L/;
  if (!wantDom.test(sp.np)) { miss.push(`${at} — ${f.sec} 세트에 ${sp.np} 는 도메인이 안 맞는다`); continue; }
  // 현재 cs_ids 가 발주 전제와 같은가
  if (JSON.stringify(c.cs_ids || []) !== JSON.stringify(sp.wasCs)) {
    miss.push(`${at} — 현재 cs_ids ${JSON.stringify(c.cs_ids || [])} 가 전제 ${JSON.stringify(sp.wasCs)} 와 다르다`); continue;
  }
  if ((c.cs_spans || []).length) { miss.push(`${at} — 이미 cs_spans 를 갖고 있다 (덮어쓰기 위험)`); continue; }

  // 근거 필수 pat 인데 cs_ids 가 비면 CRITICAL 이 생긴다
  if (REQ.includes(sp.np) && !sp.csIds.length) { miss.push(`🔴 ${at} — ${sp.np} 는 근거 필수인데 cs_ids 가 빈다`); continue; }
  // V 인데 근거가 남으면 C_vpat_dirty CRITICAL
  if (sp.np === "V" && (sp.csIds.length + (sp.csSpans || []).length) > 0) { miss.push(`🔴 ${at} — pat=V 인데 근거가 남는다 (C_vpat_dirty)`); continue; }

  // 근거 문장 — 존재 · 어구 · 형광펜 · 해설 인용
  const byId = new Map((f.s.sents || []).map((x) => [String(x.id), x]));
  const ana = String(c.analysis || "");
  const rows = [];
  let bad = false;
  for (const id of sp.csIds) {
    const x = byId.get(id);
    if (!x) { miss.push(`${at} — 문장 ${id} 없음`); bad = true; continue; }
    const st = x.sentType || "body";
    if (NON_HL.has(st)) { miss.push(`${at} — ${id} 가 ${st} (형광펜 안 켜짐)`); bad = true; continue; }
    rows.push({ id, st, t: x.t });
  }
  for (const sp2 of sp.csSpans || []) {
    const x = byId.get(sp2.sent_id);
    if (!x) { miss.push(`${at} — cs_spans 문장 ${sp2.sent_id} 없음`); bad = true; continue; }
    // 어구 대조 2단계 (§7⑥) — ① 원문 그대로 → ② 실패 시 원문자·공백 무시
    const exact = String(x.t).includes(sp2.text);
    const soft = loose(x.t).includes(loose(sp2.text));
    if (!exact && !soft) { miss.push(`${at} — ${sp2.sent_id} 에 「${sp2.text}」 없음`); bad = true; continue; }
    if (!exact) { miss.push(`🟡 ${at} — 「${sp2.text}」 가 완화 대조로만 맞는다. 부분 형광펜은 원문 일치가 필요하다`); bad = true; continue; }
    const n = String(x.t).split(sp2.text).length - 1;
    if (n !== sp2.occurrence) { miss.push(`${at} — 「${sp2.text}」 출현 ${n}회 ≠ occurrence ${sp2.occurrence}`); bad = true; continue; }
    if (!loose(ana).includes(loose(sp2.text))) { miss.push(`${at} — 해설이 「${sp2.text}」 를 인용하지 않는다`); bad = true; continue; }
    if (!sp.csIds.includes(sp2.sent_id)) { miss.push(`${at} — cs_spans 문장 ${sp2.sent_id} 가 cs_ids 에 없다`); bad = true; continue; }
  }
  if (bad) continue;

  // 결론줄 — 판정 기호 · ok 정합 · 라벨 유무
  const A0 = ana;
  const lines = A0.trimEnd().split("\n");
  const tail = lines[lines.length - 1];
  if (!/[❌✅]/.test(tail)) { miss.push(`${at} — 결론줄에 판정 기호가 없다`); continue; }
  if ((c.ok === false) !== tail.includes("❌")) { miss.push(`${at} — ok 와 결론 기호가 어긋난다`); continue; }
  const m = tail.match(/\[([^\]]+)\]\s*$/);
  const newLab = `[${NAME[sp.np]}]`;
  let A1, mode;
  if (m) {
    const old = `[${m[1]}]`;
    const n = A0.split(old).length - 1;
    if (n !== 1) { miss.push(`${at} — 라벨 \`${old}\` 가 ${n}곳이다 (1곳이어야 한다)`); continue; }
    A1 = A0.split(old).join(newLab);
    mode = { kind: "교체", old };
  } else {
    lines[lines.length - 1] = tail.trimEnd() + " " + newLab;
    A1 = lines.join("\n") + A0.slice(A0.trimEnd().length);
    mode = { kind: "추가", old: null };
  }

  plans.push({ ...sp, sec: f.sec, set: f.s, c, op: String(c.pat), A0, A1, mode, newLab, rows, tail });
}

// ── 미리보기 ────────────────────────────────────────────────────────────
console.log("## 적용 대상");
console.log("");
console.log("| # | 회차 | 세트 | 위치 | 계열 | `pat` | 결론줄 라벨 | `cs_ids` | `cs_spans` |");
console.log("|--:|---|---|---|---|---|---|---|---|");
plans.forEach((p, i) => {
  console.log(`| ${i + 1} | ${p.yk} | \`${p.sid}\` | Q${p.qid}#${p.num} | ${p.sec} | \`${p.op}\` → **\`${p.np}\`** | ${p.mode.kind === "교체" ? `\`${p.mode.old}\` → **\`${p.newLab}\`**` : `**추가** \`${p.newLab}\``} | ${JSON.stringify(p.wasCs)} → **${JSON.stringify(p.csIds)}** | ${p.csSpans ? `**+${p.csSpans.length}**` : "—"} |`);
});
console.log("");
for (const p of plans) {
  console.log(`### \`${p.sid}\` Q${p.qid}#${p.num} — ${p.why}`);
  console.log("");
  console.log(`- 선지: ${p.c.t}`);
  console.log(`- 결론줄(현재): ${p.tail}`);
  console.log(`- 결론줄(적용후): ${p.A1.trimEnd().split("\n").pop()}`);
  for (const r of p.rows) console.log(`- 근거 \`${r.id}\` (${r.st}) — ${r.t}`);
  for (const s of p.csSpans || []) console.log(`- 부분 형광펜 \`${s.sent_id}\` → 「${s.text}」 (원문 그대로 · ${s.occurrence}회)`);
  if (p.np === "V" && p.wasCs.length) console.log(`- ⚠ **형광펜이 꺼진다** — \`${p.wasCs.join(", ")}\` 제거. V 규약(C_vpat_dirty · CRITICAL) 준수. LIVE V선지 185/185 이 같은 상태다`);
  console.log("");
}

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
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d181.json"), before);

const snap = plans.map((p) => ({ ok: p.c.ok, sents: JSON.stringify(p.set.sents) }));
for (const p of plans) {
  p.c.pat = p.np;
  p.c.analysis = p.A1;
  p.c.cs_ids = [...p.csIds];
  if (p.csSpans) p.c.cs_spans = p.csSpans.map((s) => ({ ...s }));
  else if (p.c.cs_spans) delete p.c.cs_spans;
}
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪ minified 한 줄

// ── 되읽기 검산 (S-02) ──────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
if (after[0] === 0xef) { console.log("🔴 BOM 이 붙었다"); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const fail = [];

plans.forEach((p, i) => {
  let s2 = null;
  for (const sec of ["reading", "literature"]) {
    const x = (back[p.yk]?.[sec] || []).find((y) => (y.setId || y.id) === p.sid);
    if (x) s2 = x;
  }
  const at = `${p.sid} Q${p.qid}#${p.num}`;
  if (!s2) { fail.push(`${at} 세트 소실`); return; }
  const c2 = s2.questions.find((q) => q.id === p.qid).choices.find((x) => x.num === p.num);

  if (c2.pat !== p.np) fail.push(`${at} pat 미반영`);
  if (c2.ok !== snap[i].ok) fail.push(`${at} **ok 가 달라졌다**`);
  if (JSON.stringify(s2.sents) !== snap[i].sents) fail.push(`${at} **본문이 달라졌다**`);
  if (JSON.stringify(c2.cs_ids || []) !== JSON.stringify(p.csIds)) fail.push(`${at} cs_ids 미반영 (${JSON.stringify(c2.cs_ids)})`);
  if (p.csSpans) {
    if (JSON.stringify(c2.cs_spans || []) !== JSON.stringify(p.csSpans)) fail.push(`${at} cs_spans 미반영`);
  } else if ((c2.cs_spans || []).length) fail.push(`${at} cs_spans 가 남아 있다`);

  // 근거가 실제로 형광펜이 켜지는가 (끊긴 id · 비-하이라이트)
  const ids2 = new Map(s2.sents.map((x) => [String(x.id), x]));
  for (const id of c2.cs_ids || []) {
    const x = ids2.get(id);
    if (!x) fail.push(`${at} 끊긴 근거 ${id}`);
    else if (NON_HL.has(x.sentType || "body")) fail.push(`${at} 비-하이라이트 근거 ${id}`);
  }
  for (const s of c2.cs_spans || []) {
    const x = ids2.get(s.sent_id);
    if (!x) fail.push(`${at} 끊긴 span ${s.sent_id}`);
    else if (!String(x.t).includes(s.text)) fail.push(`${at} span 어구가 문장에 없다 — 부분 형광펜이 안 켜진다`);
  }
  // 근거 필수 / V 규약 재확인
  if (c2.ok === false && REQ.includes(c2.pat) && !(c2.cs_ids || []).length) fail.push(`${at} 🔴 근거 필수 pat 인데 cs_ids 가 빈다`);
  if (c2.pat === "V" && ((c2.cs_ids || []).length + (c2.cs_spans || []).length) > 0) fail.push(`${at} 🔴 C_vpat_dirty`);

  // ⑬축 — 결론줄 끝 라벨 ↔ pat
  const tail = String(c2.analysis).trimEnd().split("\n").pop();
  const m = tail.match(/\[([^\]]+)\]\s*$/);
  if (!m) fail.push(`${at} 결론줄이 라벨로 끝나지 않는다`);
  else if (LAB2PAT[m[1]] !== p.np) fail.push(`${at} ⑬축 라벨↔pat 어긋남 (${m[1]} vs ${p.np})`);
  if (p.mode.old && String(c2.analysis).includes(p.mode.old)) fail.push(`${at} 옛 라벨 잔존`);

  // 라벨 밖 문면 훼손 — 「교체」와 「추가」는 대조법이 다르다 (D-168 ⑨ · D-180)
  const got = String(c2.analysis);
  if (p.mode.kind === "교체") {
    const strip = (t) => t.split(p.newLab).join("§").split(p.mode.old).join("§");
    if (strip(got) !== strip(p.A0)) fail.push(`${at} **해설이 라벨 밖에서 달라졌다**`);
  } else {
    const parts = got.split(" " + p.newLab);
    if (parts.length !== 2) fail.push(`${at} 붙인 라벨이 1곳이 아니다 (${parts.length - 1}곳)`);
    else if (parts.join("") !== p.A0) fail.push(`${at} **해설이 라벨 밖에서 달라졌다**`);
  }
});

// ── LIVE 전수 재확인 ────────────────────────────────────────────────────
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at0 = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at0, src.indexOf("]);", at0)).matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.includes("::")));
let dom = 0, labBad = 0, labN = 0, newCrit = 0, vDirty = 0, oddPat = 0;
const OK_PAT = new Set(Object.keys(NAME));
for (const [yk, v] of Object.entries(back)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  if (!REL.has(`${yk}::${st.setId || st.id}`)) continue;
  for (const q of st.questions || []) for (const c of q.choices || []) {
    const p = String(c.pat ?? "");
    if (c.pat != null && p !== "" && !OK_PAT.has(p.trim())) { oddPat++; continue; }
    if (p && ((sec === "reading" && /^L/.test(p)) || (sec === "literature" && /^R/.test(p)))) dom++;
    if (c.ok === false && REQ.includes(p) && !(c.cs_ids || []).length) newCrit++;
    if (p === "V" && ((c.cs_ids || []).length + (c.cs_spans || []).length) > 0) vDirty++;
    const m = String(c.analysis || "").trimEnd().split("\n").pop().match(/\[([^\]]+)\]\s*$/);
    if (m && m[1] in LAB2PAT) { labN++; if (LAB2PAT[m[1]] !== p) labBad++; }
  }
}

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log(`- 백업 \`pipeline/backups/all_data_204.before_d181.json\``);
console.log("");
if (fail.length) {
  console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오");
  console.log("");
  fail.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- ${plans.length}건 전부 \`pat\` 반영 · 결론줄 끝 라벨 ↔ \`pat\` **일치**(⑬축)`);
console.log("- 근거 끊긴 id 0 · 비-하이라이트 0 · 부분 형광펜 어구가 문장 안에 있다");
console.log("- `ok`·본문 무변 · **해설은 라벨 밖에서 한 글자도 안 달라졌다**");
console.log("");
console.log("### LIVE 전수 재확인");
console.log("");
console.log(`- 정의에 없는 \`pat\` 값: **${oddPat}건**`);
console.log(`- 도메인 어긋남(독서에 L / 문학에 R): **${dom}건**`);
console.log(`- ⑬축 라벨↔\`pat\` 어긋남: **${labBad}건** (라벨 보유 ${labN}건)`);
console.log(`- 근거 필수 \`pat\` 인데 \`cs_ids\` 가 빈 선지: **${newCrit}건**`);
console.log(`- \`C_vpat_dirty\`(V 인데 근거 보유): **${vDirty}건**`);
