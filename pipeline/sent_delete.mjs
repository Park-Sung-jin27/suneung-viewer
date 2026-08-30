// sent_delete.mjs — 오염된 본문 문장을 지운다 (발주 D-158 ①)
//
// ★ 원본에 없는 문장만 지운다. 원본 대조가 끝난 건만 SPEC 에 넣는다.
//   「이상해 보인다」로 지우지 않는다 — 지운 문장은 되돌리기 전까지 화면에서 사라진다.
//
// ★ id 를 재번호하지 않는다 (절대)
//   문장을 배열에서 빼면 뒤 문장의 **배열 위치**는 밀리지만 **id 는 그대로**다.
//   id 를 다시 매기면 cs_ids·annotations·visual_marks 가 통째로 어긋난다.
//   빠진 번호는 **빈자리로 둔다** — s36·s37 을 지우면 s35 다음이 s38 이 된다.
//
// 안전장치 (하나라도 어긋나면 아무것도 쓰지 않는다):
//   · 지울 문장이 실재하고, 본문이 SPEC 의 앞부분과 같아야 한다
//   · 그 문장을 가리키는 cs_ids·annotations 가 **하나도 없어야** 한다
//   · 지운 뒤 나머지 문장이 바이트 단위로 같아야 한다
//
// 사용: node pipeline/sent_delete.mjs [--only <setId>] [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const ANN = path.join(ROOT, "public/data/annotations.json");
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

// [yearKey, setId, sentId, 문장 앞부분(확인용), 근거]
const SPEC = [
  ["2021수능", "r2021a", "r2021as36", "*유중영의 옛일 : 당나라 때 문신 유중영이",
    "심사관 원본 대조 완료 — 2021수능 PDF 889~908행의 문학 지문(사미인곡 / 옛집 정승초당을 둘러보고 쓰다) 각주다. "
    + "r2021a(북학파의 18세기 중국 인식)는 315~325행으로 **다른 페이지의 다른 지문**이다. "
    + "43문장 중 s36 이라 지문 끝도 아니고 한가운데 박혀 있었다. cs_ids 참조 0건"],
  ["2021수능", "r2021a", "r2021as37", "*임원 : 산림.",
    "위와 같은 오염의 나머지 반쪽. l2021c s61 과 같은 각주다. "
    + "공백 제외 7자라 오염 축 최소 길이 10자에 걸리지 않아 s36 을 따라가 눈으로 찾았다(D-158 ② 로 5자 하향)"],
];

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const ann = JSON.parse(fs.readFileSync(ANN, "utf8"));
const todo = SPEC.filter(([, sid]) => !ONLY || sid === ONLY);
if (!todo.length) { console.log("대상이 없다."); process.exit(1); }

console.log(`## 본문 문장 삭제 ${APPLY ? "적용" : "DRY-RUN"} — ${todo.length}건`);
console.log("");
console.log(`  적용 전 all_data MD5 ${md5(before)}`);
console.log("");

const plans = [];
for (const [yk, sid, sentId, headText, why] of todo) {
  let set = null;
  for (const sec of ["reading", "literature"]) {
    const f = (data[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (f) set = f;
  }
  if (!set) { console.log(`  🔴 ${yk}::${sid} 세트 없음`); process.exit(1); }
  const i = (set.sents || []).findIndex((x) => String(x.id) === sentId);
  if (i < 0) { console.log(`  ⚠ ${sentId} 이 이미 없다 — 건너뛴다`); continue; }
  const t = String(set.sents[i].t || "");
  if (!t.replace(/\s+/g, "").startsWith(headText.replace(/\s+/g, "")))
    { console.log(`  🔴 ${sentId} 본문이 SPEC 과 다르다\n     실제: ${JSON.stringify(t.slice(0, 50))}`); process.exit(1); }

  // 참조 검사
  const refs = [];
  for (const q of set.questions || []) for (const c of q.choices || []) {
    if ((c.cs_ids || []).includes(sentId)) refs.push(`Q${q.id}#${c.num}.cs_ids`);
    for (const sp of c.cs_spans || []) if (String(sp?.sent_id ?? sp?.sentId) === sentId) refs.push(`Q${q.id}#${c.num}.cs_spans`);
  }
  for (const a of (ann[yk]?.[sid] || []))
    if (a?.sentId === sentId || a?.sentFrom === sentId || a?.sentTo === sentId) refs.push(`annotations.${a.type}`);
  if (refs.length) { console.log(`  🔴 ${sentId} 을 가리키는 것이 있다 — 지우면 끊긴다: ${refs.join(", ")}`); process.exit(1); }

  console.log(`  ${yk} ${sid} ${sentId} [${set.sents[i].sentType || "body"}]  (문장 ${set.sents.length} → ${set.sents.length - 1})`);
  console.log(`     지울 것: ${JSON.stringify(t.slice(0, 70))}`);
  console.log(`     참조: 없음 (cs_ids · cs_spans · annotations 전부)`);
  console.log(`     앞뒤: ${set.sents[i - 1] ? set.sents[i - 1].id : "—"} → (삭제) → ${set.sents[i + 1] ? set.sents[i + 1].id : "—"}  ★ id 재번호 없음, 빈자리로 둔다`);
  console.log(`     근거: ${why}`);
  plans.push({ set, sentId, i });
}
console.log("");

if (!APPLY) { console.log("### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply"); process.exit(0); }

const bakDir = path.join(ROOT, "pipeline/backups");
fs.mkdirSync(bakDir, { recursive: true });
const bak = path.join(bakDir, `all_data_204.before_sent_delete_${todo[0][1]}.json`);
fs.writeFileSync(bak, before);
console.log(`  백업: pipeline/backups/${path.basename(bak)}`);

const snaps = new Map();
for (const p of plans) {
  if (!snaps.has(p.set)) snaps.set(p.set, null);
}
for (const [set] of snaps) snaps.set(set, JSON.stringify((set.sents || []).filter((x) => !plans.some((p) => p.set === set && p.sentId === String(x.id)))));
for (const p of plans) p.set.sents = p.set.sents.filter((x) => String(x.id) !== p.sentId);

fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 (S-02) ────────────────────────────────────
const after = fs.readFileSync(DATA);
if (after[0] === 0xef && after[1] === 0xbb && after[2] === 0xbf) { console.log("\n🔴 BOM."); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const fail = [];
for (const [yk, sid, sentId] of todo) {
  let s2 = null;
  for (const sec of ["reading", "literature"]) {
    const f = (back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (f) s2 = f;
  }
  if (!s2) { fail.push(`${sid} 세트가 사라졌다`); continue; }
  if (s2.sents.some((x) => String(x.id) === sentId)) fail.push(`${sentId} 이 남아 있다`);
  const ids = new Set(s2.sents.map((x) => String(x.id)));
  for (const q of s2.questions || []) for (const c of q.choices || [])
    for (const id of c.cs_ids || []) if (!ids.has(id)) fail.push(`${sid} 끊긴 cs_id ${id}`);
}
for (const [set, snap] of snaps) {
  const yk = todo[0][0], sid = todo[0][1];
  let s2 = null;
  for (const sec of ["reading", "literature"]) {
    const f = (back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (f) s2 = f;
  }
  if (s2 && JSON.stringify(s2.sents) !== snap) fail.push("**남은 문장이 바뀌었다**");
}

console.log(`  적용 후 all_data MD5 ${md5(after)} (${after.length - before.length}B)`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- ${plans.length}건 삭제 · 남은 문장 **바이트 단위 동일** · id 재번호 없음`);
console.log(`- 끊긴 \`cs_id\` **0**`);
console.log("");
console.log("다음: `build_split.mjs --verify` · `cs_effect_audit` · `source_contamination_audit --live`");
