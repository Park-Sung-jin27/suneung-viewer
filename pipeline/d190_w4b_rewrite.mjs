// d190_w4b_rewrite.mjs — r20279b F_content_reversed 3선지 재작성 + title (D-190 트랙2)
//
// 세 선지 모두 ok=false 인데 해설 결론이 「✅ 적절」이었다. 판정이 뒤집혀 있어
// 학생이 오답을 정답으로 배우는 자리다. pat 도 셋 다 0(10종에 없는 값)이라
// 해설·pat·cs_ids 를 함께 고쳐야 게이트가 열린다.
//
// ★ pat 구분 기준 (심사관 확정 2026-09-02 · 향후 일관성 위해 기록)
//   R4 개념 혼합 — 서로 다른 두 개념을 뒤섞은 경우.
//                  Q7#2 는 표준적 입장의 「범주 일치」를 「관계에 따른 범주 변동」과 섞었다.
//   R1 사실 왜곡 — 지문이 명시적으로 부정하는 것을 그대로 진술한 경우.
//                  Q7#5 는 표준적 입장이 부정하는 '피행위자' 지위를 동물에게 부여했다.
//   R3 과잉 추론 — 지문·보기가 배제한 범위로 넓혀 추론한 경우.
//                  Q8#3 은 <보기>가 못박은 「대표 구성원 ≠ 종 전체」를 건너뛰었다.
//   ※ Q8#3 은 L5(보기 대입 오류)로도 읽히나 독서 세트에 L 계열을 넣으면
//     W_domain_mismatch 가 뜬다. 도메인 관례(독서→R/V)를 지켜 R3 로 확정했다.
//
// ★ 📌 줄은 한 글자도 건드리지 않는다 — 재작성 대상은 🔍 와 결론줄뿐이다.
//   검산에서 📌 줄이 원본과 같은지 확인한다.
//
// 사용: node pipeline/d190_w4b_rewrite.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2027_9월", SID = "r20279b";
const TITLE_WAS = "다음 글을 읽고 물음에 답하시오.";
const TITLE_NOW = "동물과 인공지능의 도덕적 지위";

const SPEC = [
  {
    qid: 7, num: 2, pat: "R4", csAdd: ["r20279bs18"],
    body: [
      "🔍 [풀이]",
      "① 표준적 입장은 '행위자'의 범주와 '피행위자'의 범주가 일치해야 한다고 본다. 두 범주가 같은 테두리 안에 있어야 한다는 것이지, 한쪽이 다른 쪽과의 관계에 따라 넓어지거나 좁아진다는 것이 아니다.",
      "② 선지는 ㉠을 근거로 '피행위자'의 범주가 '행위자'와의 관계에 의해 달라진다고 했다. 그러나 ㉠은 표준적 입장이 무엇인지를 말하는 대목이 아니라, 그 입장이 낳는 결과로서 인간 이외의 종이 어떻게 취급되는지를 서술한 대목이다.",
      "③ 표준적 입장의 관점에서 보면 인간 이외의 종은 애초에 두 범주 밖에 있는 것이지, 관계에 따라 피행위자 범주에 드나드는 것이 아니다. ㉡이 이를 보여 준다 — 소유 동물에게 해를 입히는 것이 그른 이유는 그 사람의 소유권을 침해하기 때문이지 동물이 '피행위자'가 되어서가 아니다. 범주 일치를 관계 의존으로 바꿔 읽은 진술이다.",
    ].join("\n"),
    tail: "❌ 표준적 입장의 '범주 일치'를 '관계에 따른 범주 변동'으로 바꿔 읽은 부적절한 진술 [R4]",
  },
  {
    qid: 7, num: 5, pat: "R1", csAdd: ["r20279bs18"],
    body: [
      "🔍 [풀이]",
      "① 표준적 입장은 '행위자'의 범주와 '피행위자'의 범주가 일치해야 한다고 본다. 그러므로 이 입장에서 인간 이외의 종은 피행위자 범주에 들어오지 않는다.",
      "② ㉡의 두 번째 예시는 동물에게 잔인한 행동을 하는 것이 그 행위자의 심성을 포악하게 만들기 때문에 옳지 않다는 것이다. 도덕적 문제가 성립하는 자리는 인간 쪽이지 동물 쪽이 아니다. 이 예시는 동물이 피행위자가 아님을 보여 주는 사례다.",
      "③ 그런데 선지는 다른 종을 '피행위자'라고 부르며 그 위에 논의를 세웠다. 표준적 입장이 부정하는 지위를 동물에게 부여한 것이므로, ㉡을 표준적 입장의 관점에 따라 이해한 것으로 볼 수 없다.",
    ].join("\n"),
    tail: "❌ 표준적 입장이 부정하는 '피행위자' 지위를 동물에게 부여한 부적절한 진술 [R1]",
  },
  {
    qid: 8, num: 3, pat: "R3", csAdd: [],
    body: [
      "🔍 [풀이]",
      "① <보기>의 '전형적'은 \"대부분의 구성원이 인격체라는 것이 아니라 그 종의 대표적인 구성원이 인격체라는 것\"이다. 대표 구성원에게 있는 특징을 종 전체가 갖는다는 뜻이 아니라고 <보기>가 못박아 두었다.",
      "② (가)에서 '도덕적 행위자로서의 능력'은 고차원적 정신 능력 가운데 대표적인 것으로 제시된다. <보기>의 규정을 그대로 적용하면 이 능력은 인간 종의 대표적 구성원에게서 나타나는 특징이지, 인간 종 전체가 지닌 특징이 아니다.",
      "③ 선지는 '대표적 구성원의 특징'에서 '인간 종 전체의 특징'으로 건너뛰었다. <보기>가 명시적으로 배제한 추론이므로, <보기>를 바탕으로 (가)를 이해한 것으로 적절하지 않다.",
    ].join("\n"),
    tail: "❌ <보기>가 배제한 '대표 구성원 → 종 전체' 추론을 그대로 한 부적절한 진술 [R3]",
  },
];

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트 없음"); process.exit(1); }
const byId = new Map((set.sents || []).map((x) => [String(x.id), String(x.t)]));
const ch = (qid, num) => set.questions.find((q) => q.id === qid)?.choices?.find((x) => x.num === num);

console.log(`# ${SID} F_content_reversed 3선지 재작성 + title (D-190 트랙2)`);
console.log("");
console.log(`- 적용 전 MD5 \`${md5(before)}\``);
console.log("");

const miss = [], plans = [];
for (const sp of SPEC) {
  const at = `Q${sp.qid}#${sp.num}`;
  const c = ch(sp.qid, sp.num);
  if (!c) { miss.push(`${at} 선지 없음`); continue; }
  if (c.ok !== false) { miss.push(`${at} ok 가 false 가 아니다`); continue; }
  if (String(c.pat) !== "0") { miss.push(`${at} pat 이 ${JSON.stringify(c.pat)} 다 (전제 0)`); continue; }
  const A0 = String(c.analysis);
  const lines = A0.trimEnd().split("\n");
  const oldTail = lines[lines.length - 1];
  if (!oldTail.startsWith("✅")) { miss.push(`${at} 결론줄이 ✅ 로 시작하지 않는다 (전제와 다르다)`); continue; }
  const pinLines = lines.filter((l) => l.includes("📌"));
  if (!pinLines.length) { miss.push(`${at} 📌 줄이 없다`); continue; }
  if (!sp.tail.endsWith(`[${sp.pat}]`)) { miss.push(`${at} 결론줄 라벨이 pat 과 다르다`); continue; }
  const cur = (c.cs_ids || []).map(String);
  const dup = sp.csAdd.filter((x) => cur.includes(x));
  if (dup.length) { miss.push(`${at} cs_ids 에 이미 있다: ${dup.join(",")}`); continue; }
  const bad = sp.csAdd.filter((x) => !byId.has(x));
  if (bad.length) { miss.push(`${at} 없는 문장: ${bad.join(",")}`); continue; }
  const A1 = `${pinLines.join("\n")}\n${sp.body}\n\n${sp.tail}`;
  plans.push({ ...sp, c, A0, A1, oldTail, pinLines, cs0: cur, cs1: [...cur, ...sp.csAdd] });

  console.log(`## Q${sp.qid}#${sp.num}`);
  console.log("");
  console.log(`- 선지: ${String(c.t).replace(/\n/g, " ")}`);
  console.log(`- pat \`0\` → **\`${sp.pat}\`** · cs_ids ${JSON.stringify(cur)} → **${JSON.stringify([...cur, ...sp.csAdd])}**`);
  console.log(`- 결론줄 \`${oldTail}\``);
  console.log(`         → **\`${sp.tail}\`**`);
  console.log(`- 📌 줄 ${pinLines.length}개는 그대로 둔다`);
  console.log("");
}

console.log("## title");
console.log("");
if (set.title !== TITLE_WAS) miss.push(`title 이 ${JSON.stringify(set.title)} 다`);
else console.log(`- ${JSON.stringify(TITLE_WAS)} → **${JSON.stringify(TITLE_NOW)}**`);
console.log("");

if (miss.length) { console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다"); console.log(""); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
if (plans.length !== 3) { console.log(`## 🔴 계획 ${plans.length} ≠ 3`); process.exit(1); }
console.log("✅ 사전 대조 통과 — 해설 3건 · pat 3건 · cs_ids 2건 · title 1건");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d190w4brw.json"), before);
const pre = JSON.parse(before.toString("utf8"));
for (const p of plans) { p.c.analysis = p.A1; p.c.pat = p.pat; p.c.cs_ids = [...p.cs1]; }
set.title = TITLE_NOW;
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
const fail = [];
if (after[0] === 0xef) fail.push("BOM");
let nl = 0; for (const x of after) if (x === 10) nl++;
if (nl !== 0) fail.push(`개행 ${nl}`);
const back = JSON.parse(after.toString("utf8"));
const s2 = (back[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
const s0 = (pre[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
if (JSON.stringify(s2.sents) !== JSON.stringify(s0.sents)) fail.push("**본문이 달라졌다**");
if (s2.title !== TITLE_NOW) fail.push("title 미반영");

const REQ = ["R1", "R2", "R4", "L1", "L2", "L4", "L5"];
for (const p of plans) {
  const at = `Q${p.qid}#${p.num}`;
  const c2 = s2.questions.find((q) => q.id === p.qid).choices.find((x) => x.num === p.num);
  if (String(c2.analysis) !== p.A1) fail.push(`${at} 해설 미반영`);
  if (String(c2.pat) !== p.pat) fail.push(`${at} pat 미반영`);
  if (JSON.stringify(c2.cs_ids) !== JSON.stringify(p.cs1)) fail.push(`${at} cs_ids 미반영`);
  if (c2.ok !== false) fail.push(`${at} ok 가 달라졌다`);
  const t = String(c2.analysis).trimEnd().split("\n").pop();
  if (!t.startsWith("❌")) fail.push(`${at} 결론줄이 ❌ 로 시작하지 않는다`);
  if (t !== p.tail) fail.push(`${at} 결론줄 미반영`);
  // 📌 줄 무변
  const pin2 = String(c2.analysis).split("\n").filter((l) => l.includes("📌"));
  if (pin2.join("\n") !== p.pinLines.join("\n")) fail.push(`${at} **📌 줄이 달라졌다**`);
  // 근거 필수 pat 인데 cs_ids 가 비면 CRITICAL
  if (REQ.includes(p.pat) && !(c2.cs_ids || []).length) fail.push(`${at} 🔴 ${p.pat} 는 근거 필수인데 cs_ids 가 빈다`);
  for (const id of c2.cs_ids) if (!byId.has(String(id))) fail.push(`${at} 끊긴 cs_id ${id}`);
  // 도메인 — 독서 세트에 L 계열이 들어가면 안 된다
  if (/^L/.test(p.pat)) fail.push(`${at} 독서 세트에 L 계열 pat`);
}
// 그 밖 무변
let spanTotal = 0;
for (const q of s2.questions || []) for (const c of q.choices || []) {
  const c0 = s0.questions.find((x) => x.id === q.id).choices.find((x) => x.num === c.num);
  const isT = plans.some((p) => p.qid === q.id && p.num === c.num);
  if (!isT) {
    if (String(c.analysis) !== String(c0.analysis)) fail.push(`Q${q.id}#${c.num} 해설이 달라졌다`);
    if (JSON.stringify(c.cs_ids) !== JSON.stringify(c0.cs_ids)) fail.push(`Q${q.id}#${c.num} cs_ids 가 달라졌다`);
    if (String(c.pat) !== String(c0.pat)) fail.push(`Q${q.id}#${c.num} pat 이 달라졌다`);
  }
  if (JSON.stringify(c.cs_spans) !== JSON.stringify(c0.cs_spans)) fail.push(`Q${q.id}#${c.num} cs_spans 가 달라졌다`);
  if (c.ok !== c0.ok) fail.push(`Q${q.id}#${c.num} ok 가 달라졌다`);
  for (const sp of c.cs_spans || []) { spanTotal++; const t = byId.get(String(sp.sent_id)); if (t == null || !t.includes(sp.text)) fail.push(`Q${q.id}#${c.num} span 이 본문에 없다`); }
}
for (const [yk, v] of Object.entries(pre)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  const sid = st.setId || st.id;
  if (yk === YK && sid === SID) continue;
  if (JSON.stringify(st) !== JSON.stringify((back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid))) fail.push(`${yk}::${sid} 가 달라졌다`);
}

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.before_d190w4brw.json`");
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- 결론줄 3건 전부 ❌ 로 뒤집힘 · 라벨↔pat 일치 · 📌 줄 무변");
console.log("- pat 0 → R4·R1·R3 · 근거 필수 pat 의 cs_ids 채워짐 · 끊긴 id 0 · 독서 세트에 L 계열 0");
console.log(`- cs_spans ${spanTotal}건 전건 본문 부분 문자열 · ok 무변 · 본문 무변`);
console.log("- 다른 선지·다른 세트·다른 회차 무변 · minified 유지");
