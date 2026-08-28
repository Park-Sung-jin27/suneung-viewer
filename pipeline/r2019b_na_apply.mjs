// r2019b_na_apply.mjs — 2019수능::r2019b (나) 「오발탄」 본문 적용 (발주 D-149 ①)
//
// 무엇을 하나
//   ① dry-run 확정본(B안 = §13⑧ 극문학 분할) 44문장을 s14~ 로 추가한다
//   ② 효과음 원문자를 심사관 확정본 `Ⓔ`(U+24BA)로 넣는다
//   ③ 이미 데이터에 있는 Q25#1·#2 의 선지·해설 안 `철호◯E` 도 같은 글자로 맞춘다
//
//   ③ 을 왜 같이 하나 — §13⑭ 때문이다. 같은 어구가 sent.t · choice.t · analysis 에
//   복사본으로 흩어져 있어 한쪽만 고치면 형광펜·검증이 어긋난다.
//   발주 ① 은 「7곳」(본문)만 적었지만, 본문만 `Ⓔ` 로 바꾸고 선지를 `◯E` 로 두면
//   같은 세트 안에서 두 표기가 공존한다. 규칙이 금지하는 반쪽 수리다.
//
// 무엇을 안 하나
//   · 기존 s1~s13 은 한 글자도 안 건드린다
//   · ㉠㉡㉢ 정박(annotations)은 안 한다 — 별도 발주
//   · Q25·Q26 해설 10건은 「(나) 본문 미제시로 검증 불가」로 적혀 있다.
//     본문이 들어오면 그 전제가 깨지지만 **해설 재작성은 하지 않는다**(발주 밖·판정 사항).
//
// 안전 절차: 백업 → MD5 → node fs.writeFileSync(§13⑪) → 되읽기 검산(S-02) → 손실 검산
//
// 사용:
//   node pipeline/r2019b_na_apply.mjs            미리보기
//   node pipeline/r2019b_na_apply.mjs --apply

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { extractPdfText } from "./pdf_text_extractor.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const PDF = path.join(ROOT, "_done/2019수능/2019수능_시험지.pdf");
const APPLY = process.argv.includes("--apply");
const NL = String.fromCharCode(10);
const EFF = "Ⓔ";                       // Ⓔ — 심사관 확정 (기존 데이터에 Ⓔ5·Ⓐ24·Ⓑ24·Ⓒ9 사용 중)
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2019수능", SID = "r2019b";

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트를 못 찾았다."); process.exit(1); }
const sents = set.sents || [];

console.log("# r2019b (나) 본문 적용");
console.log("");
console.log(`- 대상: \`${YK}::${SID}\` — 비노출`);
console.log(`- 적용 전 all_data: ${(before.length / 1048576).toFixed(2)}MB · MD5 \`${md5(before)}\``);
console.log(`- 기존 문장 ${sents.length} (s1~s${sents.length})`);

if (sents.length > 13) { console.log(`\n⚠ 문장이 이미 ${sents.length}개다. 적용된 것으로 보인다. 아무것도 하지 않는다.`); process.exit(0); }

// ── PDF 에서 (나) 재추출 (dry-run 과 같은 경로) ─────────────
const { fullText } = await extractPdfText(PDF);
const i0 = fullText.match(/\[\s*21\s*[~～]\s*26\s*\]/).index;
const seg = fullText.slice(i0, i0 + fullText.slice(i0).match(/\[\s*27\s*[~～]/).index);
const lines = seg.split(NL);
const naStart = lines.findIndex((l) => l.trim() === "(나)");
const naEnd = lines.findIndex((l, i) => i > naStart && /^\s*-\s*이범선/.test(l));
let footEnd = naEnd + 1;
while (footEnd < lines.length && /^\s*\*/.test(lines[footEnd])) footEnd++;
const naLines = lines.slice(naStart, naEnd + 1).map((l) => l.trim()).filter(Boolean);
const footLines = lines.slice(naEnd + 1, footEnd).map((l) => l.trim()).filter(Boolean);

// ── B안 분할 (§13⑧ 극문학) ────────────────────────────────
const SCENE = /^#\d{1,3}\./;
const SPEAKER = /^[가-힣]{1,6}\s*(◯\s*E)?\s*[*]?\s*:/;
const out = [];
let cur = null;
const flush = () => { if (cur) { out.push({ t: cur.parts.join(" ").replace(/\s+/g, " ").trim(), sentType: cur.type }); cur = null; } };
for (const t of naLines) {
  if (t === "(나)") { flush(); out.push({ t, sentType: "workTag" }); continue; }
  if (/^-\s*이범선/.test(t)) { flush(); out.push({ t, sentType: "author" }); continue; }
  if (SCENE.test(t)) { flush(); out.push({ t, sentType: "stage" }); continue; }
  if (t === "(중략)") { flush(); out.push({ t, sentType: "stage" }); continue; }
  if (SPEAKER.test(t)) { flush(); cur = { type: "speech", parts: [t] }; continue; }
  if (!cur) cur = { type: "stage", parts: [] };
  cur.parts.push(t);
}
flush();
for (const t of footLines) out.push({ t, sentType: "footnote" });

// ── 손실 검산 (Ⓔ 치환 전에 원본과 대조) ────────────────────
const norm = (s) => String(s).replace(/\s+/g, "");
const srcAll = norm(naLines.join("") + footLines.join(""));
const gotAll = norm(out.map((x) => x.t).join(""));
console.log(`- 원본 (나)+각주 공백 제외 ${srcAll.length}자 → 분할 결과 ${gotAll.length}자 ${gotAll === srcAll ? "✅ 일치" : "🔴 불일치"}`);
if (gotAll !== srcAll) { console.log("\n🔴 손실 검산 실패. 멈춘다."); process.exit(1); }

// ── Ⓔ 치환 (원문자 + 공백/탭 + E → Ⓔ) ────────────────────
const toEff = (s) => String(s).replace(/◯\s*E/g, EFF);
let effN = 0;
for (const x of out) { const b = x.t; x.t = toEff(b); if (x.t !== b) effN += (b.match(/◯\s*E/g) || []).length; }
// id 부여 — 기존 s1~s13 뒤로만
out.forEach((x, i) => { x.id = `${SID}s${sents.length + i + 1}`; });

// ── 기존 선지·해설의 ◯E (§13⑭ 전 필드 정합) ───────────────
const fieldFix = [];
for (const q of set.questions || [])
  for (const c of q.choices || []) {
    for (const f of ["t", "analysis"]) {
      if (typeof c[f] !== "string" || !/◯\s*E/.test(c[f])) continue;
      fieldFix.push(`Q${q.id}#${c.num}.${f}`);
    }
  }

console.log(`- 새 문장 **${out.length}개** (s${sents.length + 1}~s${sents.length + out.length})`);
console.log(`- \`Ⓔ\`(U+24BA) 치환: 본문 **${effN}회** · 기존 선지·해설 **${fieldFix.length}곳** (${fieldFix.join(" ")})`);
console.log(`- sentType: ${Object.entries(out.reduce((a, x) => (a[x.sentType] = (a[x.sentType] || 0) + 1, a), {})).map(([k, v]) => `${k}:${v}`).join(" · ")}`);
console.log(`- 장면번호 독립 문장: ${out.filter((x) => SCENE.test(x.t)).length}/8`);

if (!APPLY) {
  console.log("");
  console.log("## 넣을 문장 (앞 6 · 뒤 4)");
  console.log("");
  [...out.slice(0, 6), { id: "…", sentType: "…", t: "…" }, ...out.slice(-4)]
    .forEach((x) => console.log(`  ${x.id} [${x.sentType}] ${JSON.stringify(String(x.t).slice(0, 66))}`));
  console.log("");
  console.log("### 미리보기 — 아무것도 쓰지 않았다. 적용하려면 --apply");
  process.exit(0);
}

// ── 적용 ──────────────────────────────────────────────────
const bakDir = path.join(ROOT, "pipeline/backups");
fs.mkdirSync(bakDir, { recursive: true });
const bak = path.join(bakDir, "all_data_204.before_r2019b_na.json");
fs.writeFileSync(bak, before);
console.log(`\n- 백업: \`pipeline/backups/${path.basename(bak)}\` (MD5 \`${md5(before)}\`)`);

const snap13 = JSON.stringify(sents);
set.sents = [...sents, ...out];
for (const q of set.questions || [])
  for (const c of q.choices || [])
    for (const f of ["t", "analysis"]) if (typeof c[f] === "string") c[f] = toEff(c[f]);

fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 (S-02) ────────────────────────────────────
const after = fs.readFileSync(DATA);
if (after[0] === 0xef && after[1] === 0xbb && after[2] === 0xbf) { console.log("\n🔴 BOM."); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const s2 = (back[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
const fail = [];
if (!s2) fail.push("세트가 사라졌다");
else {
  if (s2.sents.length !== 13 + out.length) fail.push(`문장 수 ${s2.sents.length} ≠ ${13 + out.length}`);
  if (JSON.stringify(s2.sents.slice(0, 13)) !== snap13) fail.push("**s1~s13 이 바뀌었다**");
  const body2 = s2.sents.map((x) => x.t).join(NL);
  for (const sc of ["#68", "#69", "#70", "#71", "#72", "#73", "#74", "#75"])
    if (!body2.includes(sc)) fail.push(`장면 ${sc} 부재`);
  for (const mk of ["㉠", "㉡", "㉢"]) {
    const at = s2.sents.findIndex((x) => String(x.t).includes(mk));
    if (at >= 0) fail.push(`${mk} 가 본문에 생겼다(정박은 별도 발주다)`);
  }
  const all2 = JSON.stringify(s2);
  if (all2.includes("◯")) fail.push(`◯(U+25EF) 가 ${(all2.match(/◯/g) || []).length}회 남았다`);
  if (!all2.includes(EFF)) fail.push("Ⓔ 가 없다");
}
if (Object.keys(back).length !== Object.keys(data).length) fail.push("회차 수가 변했다");

console.log(`- 적용 후 all_data: ${(after.length / 1048576).toFixed(2)}MB · MD5 \`${md5(after)}\` · +${after.length - before.length} bytes`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }

const eff2 = (JSON.stringify(s2).match(new RegExp(EFF, "g")) || []).length;
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- 문장 13 → **${s2.sents.length}**`);
console.log(`- s1~s13 **바이트 단위 동일**`);
console.log(`- 장면번호 \`#68\`~\`#75\` 8개 전부 실재`);
console.log(`- \`Ⓔ\`(U+24BA) **${eff2}회** · \`◯\`(U+25EF) **0회**`);
console.log("");
console.log("다음: `passage_gap_audit` · `cs_effect_audit` · `build_split --verify` 확인 후 push.");
