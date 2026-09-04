// d192_rewrite.mjs — l20279c Q29 #2·#4 🔍 재작성 (발주 D-192 2번 · 심사관 승인 문안)
//
// 두 해설 모두 라벨을 잘못 붙인 채 논지가 완성돼 있었다.
//   #2  [C](s19~20)를 「판옥이 편지 내용을 전하는 대목」이라 했는데 실제로는 아내의 질문이다 — 화자 오인
//   #4  [D](s25~27)의 내용을 「덕근 어무니는 날마당 울고 있다」(s31~32, [D] 밖)로 잡았다 — 구간 오인
// 라벨만 고치면 🔍 이 틀린 채 남으므로 풀이를 다시 썼다. 문안은 심사관 승인본이다.
// #2 ③ 은 심사관이 한 문장을 교체했다 — s18 이 [C] 앞이라 「[C] 뒤에 이어지는」은 순서 오류였다.
//
// ★ 📌 인용은 타이핑하지 않는다 — 꺾쇠 구간 문장을 이어 만든다
//   이음 규칙(공백 하나 · 바깥 겹따옴표 제거)은 d192_apply 에서 기존 해설로 검증한 것과 같다.
//   이 도구도 쓰기 전에 같은 검증을 다시 돌린다.
// ★ 결론줄은 원본에서 떼어 그대로 붙인다. 재작성 대상은 📌 와 🔍 뿐이다.
//
// 사용: node pipeline/d192_rewrite.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2027_9월", SID = "l20279c", QID = 29;

const BR = {
  A: ["l20279cs6", "l20279cs7"], B: ["l20279cs13", "l20279cs14"],
  C: ["l20279cs19", "l20279cs20"], D: ["l20279cs25", "l20279cs27"],
  E: ["l20279cs36", "l20279cs38"],
};

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
const sents = set.sents || [];
const at = new Map(sents.map((x, i) => [String(x.id), i]));
const byId = new Map(sents.map((x) => [String(x.id), String(x.t)]));
const ch = (num) => set.questions.find((q) => q.id === QID)?.choices?.find((x) => x.num === num);

function joinQ(fromId, toId) {
  const i0 = at.get(fromId), i1 = at.get(toId);
  if (i0 == null || i1 == null || i1 < i0) return null;
  return sents.slice(i0, i1 + 1).map((x) => String(x.t)).join(" ").replace(/^[“"]/, "").replace(/[”"]$/, "");
}
// 라벨 구간 전체가 아니라 「그 구간에서 인용할 부분」 — B 는 s13~s14 전체, A 는 s7 만 등
const Q_A = joinQ("l20279cs7", "l20279cs7");
const Q_B = joinQ("l20279cs13", "l20279cs14");
const Q_C = joinQ("l20279cs19", "l20279cs20");
const Q_D = joinQ("l20279cs25", "l20279cs27");

const SPEC = {
  2: {
    pin: `📌 지문 근거: [B] "${Q_B}" / [C] "${Q_C}"`,
    body: [
      "🔍 [풀이]",
      "① [B]는 판옥이 편지를 읽다 말고 내뱉은 자조다. \"우리같이 없는 놈이 어디 가면 별수 있을라고\"는 가난한 처지가 어디를 가도 달라지지 않는다는 체념을 드러낸다.",
      "② [C]는 판옥의 말이 아니라 아내의 말이다. 아내는 이주지의 조건이 좋다고 들었기에 \"어째서 그럴까?\"라고 되물으며 자신이 들은 소문(집·논 스무 마지기·소·농사 기계)을 늘어놓는다. 곧 [C]는 판옥의 자조에 대한 설명이 아니라, 그 자조와 어긋나는 아내의 기대다.",
      "③ 선지는 [B]의 자조가 생긴 '이유'가 [C]에서 확인된다고 했다. 그러나 [C]에는 이유가 없고 오히려 반대 방향의 기대가 있을 뿐이다. 자조의 근거는 판옥이 아내에게 전하는 편지 내용 — \"당초에 모든 형편이 말 아니라네\"라는 요약과, [C]의 물음에 대한 판옥의 대답(집도 농기구도 형편없다는 실상) — 에서 드러난다.",
    ].join("\n"),
    cs_ids: ["l20279cs13", "l20279cs14", "l20279cs18", "l20279cs19", "l20279cs20"],
    labels: { B: Q_B, C: Q_C },
  },
  4: {
    pin: `📌 지문 근거: [D] "${Q_D}" / [A] "${Q_A}"`,
    body: [
      "🔍 [풀이]",
      "① [D]는 판옥이 편지에서 읽은 내용을 아내에게 옮기는 대목이다. \"…깎어 버리드라네그랴\"라는 전언 형식이 간접 인용에 해당하고, 전달된 상황은 농기구를 장난감처럼 작은 것으로 주고도 본값보다 비싸게 값을 매겼다는 것이다.",
      "② [A]는 편지를 읽기 전 아내가 던진 물음이다. \"덕근 어메도 잘 있고 덕근이 남매도 잘 있다고 했소?\"는 삼룡네 가족의 안부를 묻는 말일 뿐, 농기구 거래에 관한 내용은 어디에도 없다.",
      "③ 선지는 [D]의 상황이 [A]에서도 '확인'된다고 했다. 그러나 [A]는 [D]보다 앞선 물음이고 다루는 대상도 다르다. 같은 상황이 두 곳에서 확인되는 구조가 아니다.",
    ].join("\n"),
    cs_ids: ["l20279cs7", "l20279cs25", "l20279cs26", "l20279cs27"],
    labels: { D: Q_D, A: Q_A },
  },
};

console.log("# l20279c Q29 #2·#4 🔍 재작성 (D-192 2번)");
console.log("");
console.log(`- 적용 전 MD5 \`${md5(before)}\``);
console.log("");

const miss = [];
// 이음 규칙 자체 검증 — 기존 해설의 [D](s21~s23) 인용을 재현할 수 있는가
{
  const legacy = joinQ("l20279cs21", "l20279cs23");
  const c3 = ch(3);
  if (!c3 || !String(c3.analysis).includes(legacy)) miss.push("이음 규칙 검증 실패 — s21~s23 재현이 기존 해설과 다르다");
  else console.log("- ✅ 이음 규칙 자체 검증 통과 (기존 [D] 인용 재현)");
}
console.log("");

const plans = [];
for (const num of [2, 4]) {
  const sp = SPEC[num];
  const c = ch(num);
  if (!c) { miss.push(`#${num} 선지 없음`); continue; }
  const A0 = String(c.analysis);
  // 결론줄은 원본 그대로
  const lines = A0.trimEnd().split("\n");
  const tail = lines[lines.length - 1];
  if (!/^❌/.test(tail)) { miss.push(`#${num} 결론줄이 ❌ 로 시작하지 않는다`); continue; }
  if (c.ok !== false) { miss.push(`#${num} ok 가 false 가 아니다`); continue; }
  const A1 = `${sp.pin}\n${sp.body}\n\n${tail}`;
  // 📌 인용이 원문 이음과 같은가 · cs_ids 안 문장인가
  for (const [L, q] of Object.entries(sp.labels)) {
    const [f, t] = BR[L];
    const joined = sents.slice(at.get(f), at.get(t) + 1).map((x) => String(x.t)).join(" ");
    if (!joined.includes(q)) { miss.push(`#${num} [${L}] 인용이 구간 원문과 다르다`); continue; }
    const inCs = sp.cs_ids.some((id) => {
      const i = at.get(id); return i != null && i >= at.get(f) && i <= at.get(t);
    });
    if (!inCs) miss.push(`#${num} [${L}] 인용 구간이 cs_ids 에 없다`);
  }
  for (const id of sp.cs_ids) if (!byId.has(id)) miss.push(`#${num} 없는 cs_id ${id}`);
  plans.push({ num, c, A0, A1, tail, cs0: (c.cs_ids || []).map(String), cs1: sp.cs_ids });

  console.log(`## #${num}`);
  console.log("");
  console.log(`- 선지: ${String(c.t).replace(/\n/g, " ")}`);
  console.log(`- cs_ids ${JSON.stringify((c.cs_ids || []).map(String))} → **${JSON.stringify(sp.cs_ids)}**`);
  console.log(`- 결론줄(원본 유지): ${tail}`);
  console.log("");
  console.log("```");
  console.log(A1);
  console.log("```");
  console.log("");
}

if (miss.length) { console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다"); console.log(""); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
if (plans.length !== 2) { console.log("## 🔴 계획 2건이 아니다"); process.exit(1); }
console.log("✅ 사전 대조 통과 — 📌 인용이 구간 원문과 일치 · cs_ids 정합 · 결론줄 원본 유지");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d192rw.json"), before);
const pre = JSON.parse(before.toString("utf8"));
for (const p of plans) { p.c.analysis = p.A1; p.c.cs_ids = [...p.cs1]; }
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
const fail = [];
if (after[0] === 0xef) fail.push("BOM");
let nl = 0; for (const x of after) if (x === 10) nl++;
if (nl !== 0) fail.push(`개행 ${nl}`);
const back = JSON.parse(after.toString("utf8"));
const s2 = (back[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
const s0 = (pre[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
if (JSON.stringify(s2.sents) !== JSON.stringify(s0.sents)) fail.push("**본문이 달라졌다**");

const byId2 = new Map((s2.sents || []).map((x) => [String(x.id), String(x.t)]));
for (const p of plans) {
  const c2 = s2.questions.find((q) => q.id === QID).choices.find((x) => x.num === p.num);
  if (String(c2.analysis) !== p.A1) fail.push(`#${p.num} 해설 미반영`);
  const t2 = String(c2.analysis).trimEnd().split("\n").pop();
  if (t2 !== p.tail) fail.push(`#${p.num} **결론줄이 달라졌다**`);
  if ((String(c2.analysis).match(/ⓐ|ⓑ/g) || []).length) fail.push(`#${p.num} 해설에 ⓐ·ⓑ 잔존`);
  if (JSON.stringify(c2.cs_ids) !== JSON.stringify(p.cs1)) fail.push(`#${p.num} cs_ids 미반영`);
  for (const id of c2.cs_ids) if (!byId2.has(String(id))) fail.push(`#${p.num} 끊긴 cs_id ${id}`);
  // 📌 인용이 cs_ids 문장 안에 있는가 (정규화 없이 원문 그대로)
  const pin = String(c2.analysis).split("\n").find((l) => l.includes("📌")) || "";
  for (const m of pin.matchAll(/"([^"]+)"/g)) {
    const q = m[1];
    const hit = c2.cs_ids.some((id) => {
      const i = at.get(String(id));
      // 인용은 여러 문장에 걸칠 수 있으므로 구간 이음으로 확인
      for (let a = 0; a < sents.length; a++) for (let b = a; b < Math.min(a + 4, sents.length); b++) {
        const j = sents.slice(a, b + 1).map((x) => String(x.t)).join(" ");
        if (j.includes(q) && a <= i && i <= b) return true;
      }
      return false;
    });
    if (!hit) fail.push(`#${p.num} 📌 인용이 cs_ids 구간에 없다: ${q.slice(0, 30)}…`);
  }
}
// 그 밖 무변
for (const q of s2.questions || []) for (const c of q.choices || []) {
  const c0 = s0.questions.find((x) => x.id === q.id).choices.find((x) => x.num === c.num);
  const isT = q.id === QID && plans.some((p) => p.num === c.num);
  if (!isT && String(c.analysis) !== String(c0.analysis)) fail.push(`Q${q.id}#${c.num} 해설이 달라졌다`);
  if (!isT && JSON.stringify(c.cs_ids) !== JSON.stringify(c0.cs_ids)) fail.push(`Q${q.id}#${c.num} cs_ids 가 달라졌다`);
  if (JSON.stringify(c.cs_spans) !== JSON.stringify(c0.cs_spans)) fail.push(`Q${q.id}#${c.num} cs_spans 가 달라졌다`);
  if (c.ok !== c0.ok || String(c.pat) !== String(c0.pat)) fail.push(`Q${q.id}#${c.num} ok/pat 이 달라졌다`);
}
for (const [yk, v] of Object.entries(pre)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  const sid = st.setId || st.id;
  if (yk === YK && sid === SID) continue;
  if (JSON.stringify(st) !== JSON.stringify((back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid))) fail.push(`${yk}::${sid} 가 달라졌다`);
}

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.before_d192rw.json`");
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- 📌 인용이 전부 cs_ids 구간 원문과 일치 · 끊긴 cs_id 0");
console.log("- 결론줄 원본 유지 · ok/pat·cs_spans 무변");
console.log("- 본문 무변 · 다른 선지·다른 세트·다른 회차 무변 · minified 유지");
