// d207_bogi_restore.mjs — r20256d Q14 「학습 활동지」 소실 항목 1건 복원 (발주 D-207 ㄱ)
//
// 지면(2025_6월_시험지.pdf p5 우단)의 학습 활동지는 진술 3 + 학자 견해 6항목이다.
// 견해 6항목 중 ①~⑤ 는 선지로 이관돼 있고, **번호 없는 1건만 어디에도 없다.**
// [진술 2] 에 대한 행크스의 견해로, 학생이 지면에서 보는 정보가 화면에 없다.
//
// ★ 문장은 지면 좌표 조립 결과 그대로다 — 윤문·구두점 통일을 하지 않았다.
//   조판 줄바꿈은 「…속성에 │ 비추어…」 한 곳뿐이고, 그 줄 끝에 공백 글자가
//   실재하므로(rawdict 낱글자 x742.6~746.8) 어절 경계가 확정된다. 보류 없음.
//
// ★ 불릿만 정본 스키마를 따른다 — 지면은 「∙」(U+2219)이고 붙여 쓰지만,
//   같은 유형의 정본 `2026수능::r2026d` Q16 은 「• 」(U+2022+공백)를 쓴다.
//   불릿은 이 필드의 표기 규약이지 문장 내용이 아니다. 문장은 한 글자도 바꾸지 않았다.
//
// ★ 삽입 위치도 그 정본을 따른다 — 학자 견해는 해당 [진술 n] **바로 아래**에 온다.
//
// 사용: node pipeline/d207_bogi_restore.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { foldIfAnnSafe } from "file:///C:/Users/downf/jippi-bo/src/layoutBreaks.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const YK = "2025_6월", SID = "r20256d", QID = 14;
const ANCHOR = "[진술 2] 도덕 문장은 참 또는 거짓이라는 속성을 갖는다.";
const ADD = "• 행크스: 옳다. 도덕 문장은 도덕 용어가 나타내는 속성에 비추어 참 또는 거짓이 정해지기 때문이다.";
// 지면 조립 원문(불릿 U+2219, 붙여 씀) — 문장부가 글자 단위로 같은지 대조하는 데 쓴다
const PAGE = "\u2219행크스: 옳다. 도덕 문장은 도덕 용어가 나타내는 속성에 비추어 참 또는 거짓이 정해지기 때문이다.";

const FILES = [
  { label: "정본", rel: "public/data/all_data_204.json", indent: null },
  { label: "무료 split", rel: "public/data/free/2025_6월.json", indent: null },
];

console.log("# r20256d Q14 학습 활동지 — 소실 항목 1건 복원 (D-207 ㄱ)");
console.log("");

// ── 문장부 대조 — 불릿을 뗀 나머지가 지면과 완전히 같은가 ────────────────
const fail = [];
if (ADD.replace(/^• /, "") !== PAGE.replace(/^\u2219/, ""))
  fail.push("🔴 추가 문장이 지면 조립 결과와 다르다 — 윤문이 섞였다");

// ── 파일별 사전 대조 (all-or-nothing) ────────────────────────────────────
const plans = [];
for (const f of FILES) {
  const abs = path.join(ROOT, f.rel);
  if (!fs.existsSync(abs)) { fail.push(`${f.rel} 없음`); continue; }
  const raw = fs.readFileSync(abs, "utf8");
  const j = JSON.parse(raw);
  // 정본은 { 회차: {reading,…} } 이고 split 은 회차 하나의 { yearKey, reading,… } 다.
  // split 세트는 setId 가 아니라 id 를 쓴다 — 둘 다 받는다.
  const sec = j[YK] || (j.yearKey === YK ? j : null);
  if (!sec) { fail.push(`${f.rel} 에 회차 ${YK} 없음`); continue; }
  const set = (sec.reading || []).find((x) => (x.setId || x.id) === SID);
  if (!set) { fail.push(`${f.rel} 에 ${SID} 없음`); continue; }
  const q = (set.questions || []).find((x) => x.id === QID);
  if (!q) { fail.push(`${f.rel} 에 Q${QID} 없음`); continue; }
  if (typeof q.bogi !== "string") { fail.push(`${f.rel} bogi 가 문자열이 아니다`); continue; }
  const lines = q.bogi.split("\n");
  const at = lines.indexOf(ANCHOR);
  if (at < 0) { fail.push(`${f.rel} 에 [진술 2] 줄이 없다`); continue; }
  if (q.bogi.includes("행크스")) { fail.push(`${f.rel} 에 이미 행크스 항목이 있다 — 중복 삽입 위험`); continue; }
  plans.push({ ...f, abs, raw, j, sec, q, at, lines, md5: md5(raw) });
}

console.log("| 파일 | 적용 전 MD5 | [진술 2] 줄 | 삽입 위치 |");
console.log("|---|---|--:|---|");
for (const p of plans) console.log(`| \`${p.rel}\` | \`${p.md5}\` | ${p.at} | ${p.at + 1} 번째 줄 |`);
console.log("");
console.log("추가할 줄:");
console.log("```");
console.log(ADD);
console.log("```");
console.log("");

if (fail.length || plans.length !== FILES.length) {
  console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다");
  fail.forEach((x) => console.log(`- ${x}`));
  if (!fail.length) console.log(`- 계획 ${plans.length}/${FILES.length}`);
  process.exit(1);
}

// ── 렌더 경로 — 보기에 그려지는 주석 (프론트 필터를 옮긴 것) ───────────
const ann = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/annotations.json"), "utf8"));
const annList = (ann[YK] || {})[SID] || [];
function drawnBogi(bogiStr, qId) {
  const sib = annList.filter((x) => x.target === "bogi" && x.qId === qId && (x.type === "underline" || x.type === "box"));
  if (bogiStr == null) return [];
  const folded = foldIfAnnSafe(bogiStr, sib);
  const out = [];
  let cur = 0;
  for (const o of sib.map((x) => ({ x, i: folded.indexOf(x.text) })).filter((o) => o.i >= 0).sort((m, n) => m.i - n.i)) {
    if (o.i < cur) continue;
    out.push(o.x.marker || o.x.text.slice(0, 10));
    cur = o.i + String(o.x.text).length;
  }
  return out;
}
const canon = plans[0];
const before6 = drawnBogi(canon.q.bogi, QID);
const after6 = drawnBogi([...canon.lines.slice(0, canon.at + 1), ADD, ...canon.lines.slice(canon.at + 1)].join("\n"), QID);

console.log("## 렌더 경로 — 보기 표시 전후");
console.log("");
console.log(`- 보기에 **그려지는 주석**: ${before6.length}건 → ${after6.length}건 ${before6.join(",") === after6.join(",") ? "(무변)" : "🔴 변화"}`);
console.log(`- 보기 **본문 줄 수**: ${canon.lines.length} → ${canon.lines.length + 1} (학생이 보는 항목 +1)`);
console.log("");
if (before6.length !== after6.length)
  console.log("  ※ 주석 5건은 ①~⑤ 항목을 가리키는데 그 항목들은 선지로 이관돼 있다. 이번 추가분은 번호 없는 항목이라 주석과 매칭되지 않는다.");
console.log("");

console.log(`✅ 사전 검사 통과 — ${plans.length}파일`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ─────────────────────────────────────────────────────────────────
for (const p of plans) {
  fs.writeFileSync(path.join(ROOT, "pipeline/backups", path.basename(p.rel) + ".before_d207"), p.raw, "utf8");
  p.q.bogi = [...p.lines.slice(0, p.at + 1), ADD, ...p.lines.slice(p.at + 1)].join("\n");
  fs.writeFileSync(p.abs, JSON.stringify(p.j), "utf8");   // §13⑪ minified 유지
}

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const bad = [];
console.log("| 파일 | 적용 후 MD5 | 증감 |");
console.log("|---|---|--:|");
for (const p of plans) {
  const raw2 = fs.readFileSync(p.abs, "utf8");
  console.log(`| \`${p.rel}\` | \`${md5(raw2)}\` | ${raw2.length - p.raw.length}B |`);
  const j2 = JSON.parse(raw2);
  const sec2 = j2[YK] || j2;
  const q2 = (sec2.reading.find((x) => (x.setId || x.id) === SID).questions || []).find((x) => x.id === QID);
  const L2 = q2.bogi.split("\n");
  if (L2.length !== p.lines.length + 1) bad.push(`${p.rel} 줄 수 ${p.lines.length}+1 ≠ ${L2.length}`);
  if (L2[p.at + 1] !== ADD) bad.push(`${p.rel} 삽입 줄이 다르다`);
  if ((q2.bogi.split("행크스").length - 1) !== 1) bad.push(`${p.rel} 행크스 항목이 ${q2.bogi.split("행크스").length - 1}건 — 중복 삽입`);
  // ★ 이 문항의 bogi 한 줄 말고는 파일 전체가 무변인가 — 정방향 대조
  const expect = JSON.stringify(JSON.parse(p.raw), (k, v) => v);
  const j3 = JSON.parse(raw2);
  const q3 = (j3[YK] || j3).reading.find((x) => (x.setId || x.id) === SID).questions.find((x) => x.id === QID);
  q3.bogi = L2.filter((_, i) => i !== p.at + 1).join("\n");    // 삽입분만 되돌린다
  if (JSON.stringify(j3) !== JSON.stringify(JSON.parse(p.raw)))
    bad.push(`🔴 ${p.rel} — 삽입 줄 외에 달라진 곳이 있다`);
  void expect;
}
console.log("");
console.log("- 백업 `pipeline/backups/<파일명>.before_d207`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- 2파일 동기 · 삽입 1줄 외 전 구조 무변(정방향 대조) · 중복 삽입 0");
console.log("- annotations 는 열기만 하고 쓰지 않았다");
