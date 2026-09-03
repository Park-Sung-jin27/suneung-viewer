// d193_apply.mjs — 2025_9월 annotations 정박 수리 + workTag 위치 정리 (발주 D-193)
//
// ★ 밑줄 정박 어긋남 — 건별로 확정한다. 산술 일괄 보정 금지 (심사관 원칙 · D-104 계열)
//   전수 스캔에서 13건이 나왔고 전부 LIVE 2025_9월 두 세트다. drift 가 +6~+28 로
//   흩어져 있어 애초에 규칙이 아니다. 어구가 그 문장에 **유일하게** 있는 것만 옮긴다.
//
//   l20259c 3건 — ⓐ·ⓑ 원문자가 함께 붙어 있어 대응이 이중으로 확인된다
//   l20259b 4건 — 단일 후보. s9→s37 은 중복 문제라 이번에서 뺐다(아래).
//
// ★ workTag [X] 는 「구간 시작 직전 표지」다 (심사관 확정 · 실측 40/51)
//   주석의 「영역 종료 marker」는 오기이며 프론트 백로그로 넘겼다.
//   화면에는 안 그려지지만(skip) 데이터 의미를 관례에 맞춘다.
//
// ★ 이 도구가 하지 않는 것
//   - l20259b s9 「살얼음의 창」 이동 — s37 에 marker ⓐ 로 이미 정상 등재돼 있고
//     지면 출현이 1회라 이동하면 중복 밑줄이 된다. 삭제안을 별도 상신한다.
//   - l20259b 나머지 4건(다중 후보 1 · 부재 4) — D-195
//   - l2023b workTag — 구간과 11칸 떨어져 있어 지면 판독 대상. D-195
//   - l20259c bracket [A] s41~s51 — 지면 판독 결과 무변이 맞다
//
// 사용: node pipeline/d193_apply.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const ANN = path.join(ROOT, "public/data/annotations.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

// ── 밑줄 재정박 SPEC — text 로 찾아 유일성을 확인한 뒤 옮긴다 ────────────
const MOVES = [
  { yk: "2025_9월", sid: "l20259c", from: "l20259cs6", to: "l20259cs13", text: "나머지 절반" },
  { yk: "2025_9월", sid: "l20259c", from: "l20259cs9", to: "l20259cs18", text: "야릇한 웃음" },
  { yk: "2025_9월", sid: "l20259c", from: "l20259cs10", to: "l20259cs21", text: "눈이 휘둥그레진" },
  { yk: "2025_9월", sid: "l20259b", from: "l20259bs5", to: "l20259bs25", text: "태반", type: "box" },
  { yk: "2025_9월", sid: "l20259b", from: "l20259bs3", to: "l20259bs9", text: "자작나무와 이깔나무의 슬퍼하던 것을 기억한다" },
  { yk: "2025_9월", sid: "l20259b", from: "l20259bs3", to: "l20259bs10", text: "갈대와 장풍의 붙드던 말도 잊지 않았다" },
  { yk: "2025_9월", sid: "l20259b", from: "l20259bs4", to: "l20259bs14", text: "아무 이기지 못할 슬픔도 시름도 없이" },
];

// ── workTag 위치 정리 — 「구간 시작 직전」으로 ──────────────────────────
const WT = [
  { yk: "2025_9월", sid: "l20259c", id: "l20259cs980", label: "A" },
  { yk: "2022수능", sid: "l2022a", id: "l2022as8", label: "B" },
  { yk: "2022_9월", sid: "l20229d", id: "l20229ds14", label: "B" },
];

const beforeD = fs.readFileSync(DATA), beforeA = fs.readFileSync(ANN);
const data = JSON.parse(beforeD.toString("utf8"));
const ann = JSON.parse(beforeA.toString("utf8"));
const findSet = (yk, sid) => {
  for (const sec of ["reading", "literature"]) {
    const x = (data[yk]?.[sec] || []).find((y) => (y.setId || y.id) === sid);
    if (x) return x;
  }
  return null;
};

console.log("# 2025_9월 annotations 정박 수리 + workTag 위치 정리 (D-193)");
console.log("");
console.log(`- all_data MD5 \`${md5(beforeD)}\` · annotations MD5 \`${md5(beforeA)}\``);
console.log("");

const miss = [], movePlans = [], wtPlans = [];

console.log("## ④ 밑줄 재정박 — 어구 유일성으로 건별 확정");
console.log("");
console.log("| 세트 | 종류 | 어구 | from → to | 유일성 |");
console.log("|---|---|---|---|---|");
for (const m of MOVES) {
  const at = `${m.sid} ${JSON.stringify(m.text.slice(0, 20))}`;
  const set = findSet(m.yk, m.sid);
  if (!set) { miss.push(`${m.sid} 세트 없음`); continue; }
  const byId = new Map((set.sents || []).map((x) => [String(x.id), String(x.t)]));
  const hits = [...byId].filter(([, t]) => t.includes(m.text)).map(([k]) => k);
  if (hits.length !== 1) { miss.push(`🔴 ${at} — 본문에 ${hits.length}곳 (${hits.join(",")}) · 유일하지 않다`); continue; }
  if (hits[0] !== m.to) { miss.push(`🔴 ${at} — 유일 후보가 ${hits[0]} 인데 SPEC 은 ${m.to} 다`); continue; }
  const cur = byId.get(m.from);
  if (cur == null) { miss.push(`${at} — from 문장 ${m.from} 없다`); continue; }
  if (cur.includes(m.text)) { miss.push(`${at} — from 문장에 이미 어구가 있다. 옮길 이유가 없다`); continue; }
  const list = (ann[m.yk] || {})[m.sid] || [];
  const ty = m.type || "underline";
  const idx = list.findIndex((a) => a.type === ty && String(a.sentId) === m.from && a.text === m.text);
  if (idx < 0) { miss.push(`${at} — annotations 에 해당 항목이 없다`); continue; }
  const dupTo = list.filter((a, i) => i !== idx && a.type === ty && String(a.sentId) === m.to && a.text === m.text);
  if (dupTo.length) { miss.push(`🔴 ${at} — ${m.to} 에 같은 어구 항목이 이미 있다 (중복 밑줄)`); continue; }
  movePlans.push({ ...m, idx, list });
  console.log(`| \`${m.sid}\` | ${ty} | ${JSON.stringify(m.text.slice(0, 24) + (m.text.length > 24 ? "…" : ""))} | \`${m.from}\` → **\`${m.to}\`** | ✅ 본문에 1곳 |`);
}
console.log("");

console.log("## ③ workTag [X] → 구간 시작 직전");
console.log("");
console.log("| 세트 | id | 라벨 | 현재 idx | 구간 idx | 목표 idx |");
console.log("|---|---|---|--:|---|--:|");
for (const w of WT) {
  const set = findSet(w.yk, w.sid);
  if (!set) { miss.push(`${w.sid} 세트 없음`); continue; }
  const ids = (set.sents || []).map((x) => String(x.id));
  const i = ids.indexOf(w.id);
  if (i < 0) { miss.push(`${w.sid} ${w.id} 없음`); continue; }
  const s = set.sents[i];
  if ((s.sentType || "") !== "workTag" || String(s.t).trim() !== `[${w.label}]`) { miss.push(`${w.sid} ${w.id} 가 workTag [${w.label}] 단독이 아니다`); continue; }
  const br = ((ann[w.yk] || {})[w.sid] || []).find((a) => a.type === "bracket" && a.label === w.label);
  if (!br) { miss.push(`${w.sid} [${w.label}] bracket 없음`); continue; }
  const f = ids.indexOf(br.sentFrom);
  if (f < 0) { miss.push(`${w.sid} bracket sentFrom ${br.sentFrom} 없음`); continue; }
  if (i === f - 1) { miss.push(`${w.sid} ${w.id} 는 이미 구간 바로 앞이다`); continue; }
  // 참조 확인
  let ref = 0;
  for (const q of set.questions || []) for (const c of q.choices || []) {
    ref += (c.cs_ids || []).filter((x) => String(x) === w.id).length;
    ref += (c.cs_spans || []).filter((x) => String(x.sent_id) === w.id).length;
  }
  if (ref) { miss.push(`🔴 ${w.sid} ${w.id} 참조 ${ref}건 — 이동 전 확인 필요`); continue; }
  wtPlans.push({ ...w, set, i, f, from: br.sentFrom, to: br.sentTo });
  console.log(`| \`${w.sid}\` | \`${w.id}\` | [${w.label}] | ${i} | \`${br.sentFrom}\`~\`${br.sentTo}\` (${f}~${ids.indexOf(br.sentTo)}) | ${f - 1} |`);
}
console.log("");

if (miss.length) { console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다"); console.log(""); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
if (movePlans.length !== 7 || wtPlans.length !== 3) { console.log(`## 🔴 계획 수 불일치 — 밑줄 ${movePlans.length}/7 · workTag ${wtPlans.length}/3`); process.exit(1); }
console.log(`✅ 사전 대조 통과 — 밑줄 ${movePlans.length}건 · workTag ${wtPlans.length}건 (계 10건)`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d193.json"), beforeD);
fs.writeFileSync(path.join(ROOT, "pipeline/backups/annotations.before_d193.json"), beforeA);
const preD = JSON.parse(beforeD.toString("utf8")), preA = JSON.parse(beforeA.toString("utf8"));

for (const p of movePlans) p.list[p.idx].sentId = p.to;
for (const w of wtPlans) {
  const arr = w.set.sents;
  const [node] = arr.splice(w.i, 1);
  const f2 = arr.findIndex((x) => String(x.id) === w.from);
  arr.splice(f2, 0, node);
}
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");                 // §13⑪
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");          // 2칸 · 끝 개행 없음

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const afterD = fs.readFileSync(DATA), afterA = fs.readFileSync(ANN);
const fail = [];
if (afterD[0] === 0xef || afterA[0] === 0xef) fail.push("BOM");
let nl = 0; for (const x of afterD) if (x === 10) nl++;
if (nl !== 0) fail.push(`all_data 개행 ${nl}`);
if (afterA[afterA.length - 1] === 10) fail.push("annotations 끝 개행");
const backD = JSON.parse(afterD.toString("utf8")), backA = JSON.parse(afterA.toString("utf8"));
const findSet2 = (dd, yk, sid) => { for (const sec of ["reading", "literature"]) { const x = (dd[yk]?.[sec] || []).find((y) => (y.setId || y.id) === sid); if (x) return x; } return null; };

for (const p of movePlans) {
  const set = findSet2(backD, p.yk, p.sid);
  const t = (set.sents || []).find((x) => String(x.id) === p.to);
  const list = (backA[p.yk] || {})[p.sid] || [];
  const ty = p.type || "underline";
  const hit = list.filter((a) => a.type === ty && String(a.sentId) === p.to && a.text === p.text);
  if (hit.length !== 1) fail.push(`${p.sid} ${p.text.slice(0, 12)} 재정박 ${hit.length}건`);
  if (!t || !String(t.t).includes(p.text)) fail.push(`${p.sid} ${p.text.slice(0, 12)} 새 문장에 어구가 없다`);
  if (list.some((a) => a.type === ty && String(a.sentId) === p.from && a.text === p.text)) fail.push(`${p.sid} 옛 정박 잔존`);
}
for (const w of wtPlans) {
  const set = findSet2(backD, w.yk, w.sid);
  const ids = (set.sents || []).map((x) => String(x.id));
  const i = ids.indexOf(w.id), f = ids.indexOf(w.from);
  if (i !== f - 1) fail.push(`${w.sid} ${w.id} 가 구간 바로 앞이 아니다 (idx ${i} vs ${f - 1})`);
  const pre = findSet2(preD, w.yk, w.sid);
  if ((set.sents || []).length !== (pre.sents || []).length) fail.push(`${w.sid} 문장 수가 달라졌다`);
  const a = (pre.sents || []).map((x) => `${x.id}|${x.t}`).sort().join("§");
  const b = (set.sents || []).map((x) => `${x.id}|${x.t}`).sort().join("§");
  if (a !== b) fail.push(`${w.sid} **문장 내용이 달라졌다** (순서 변경만 허용)`);
}
// 본문·해설·근거 전건 무변 · 다른 회차 annotations 무변
for (const [yk, v] of Object.entries(preD)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  const sid = st.setId || st.id;
  const now = (backD[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
  const touched = wtPlans.some((w) => w.yk === yk && w.sid === sid);
  if (!touched) { if (JSON.stringify(st) !== JSON.stringify(now)) fail.push(`${yk}::${sid} 가 달라졌다`); continue; }
  if (JSON.stringify(st.questions) !== JSON.stringify(now.questions)) fail.push(`${yk}::${sid} questions 가 달라졌다`);
  if (st.title !== now.title) fail.push(`${yk}::${sid} title 이 달라졌다`);
}
for (const [yk, sets] of Object.entries(preA)) for (const [sid, list] of Object.entries(sets)) {
  const touched = movePlans.some((p) => p.yk === yk && p.sid === sid);
  if (touched) continue;
  if (JSON.stringify(list) !== JSON.stringify((backA[yk] || {})[sid])) fail.push(`annotations ${yk}::${sid} 가 달라졌다`);
}

console.log(`- 적용 후 all_data MD5 \`${md5(afterD)}\` (${afterD.length - beforeD.length >= 0 ? "+" : ""}${afterD.length - beforeD.length}B)`);
console.log(`- 적용 후 annotations MD5 \`${md5(afterA)}\` (${afterA.length - beforeA.length >= 0 ? "+" : ""}${afterA.length - beforeA.length}B)`);
console.log("- 백업 `pipeline/backups/{all_data_204,annotations}.before_d193.json`");
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- 밑줄 7건 재정박 · 새 문장에 어구 실재 · 옛 정박 잔존 0 · 중복 0");
console.log("- workTag 3건이 구간 시작 직전으로 이동 · 문장 수·내용 무변(순서만 변경)");
console.log("- 본문·해설·cs_ids·cs_spans·title 무변 · 다른 세트·회차·annotations 무변");
