// d214_q8_rewrite.mjs — r20279b Q8 ④ 해설 극성 반전 재작성 (발주 D-214)
//
// ok=true(정답 아님·적절)인데 [풀이] ③ 이 「선지는 보기와 지문을 혼동했다」로 선지를
// 부정하고 있었다(심사관 채증 9/7). 표지는 ✅ 로 옳아 기존 결론표지 축
// (analysis_verdict_audit)에 걸리지 않았다 — 본문만 틀린 유형이다.
//
// ★ 정답표 대조 선행 — gate0 에서 2027_9월 정답 불일치 0건, Q8 정답은 ③ 이다.
//   즉 ok=true 인 ④ 는 옳고 해설 본문이 틀렸다. 별건이 아니다.
//
// ★ 원인(별건 백로그 5번) — step3_analysis.js:161 「발문 유형과 무관하게 사실
//   일치 여부로만 판단」이 <보기> 기반 문항에서 지문 기준 판단을 유도한다.
//   발문의 판단 기준(보기 기준 vs 지문 기준)이 프롬프트에 없다.
//
// ★ 바꾸는 것은 [풀이] 본문과 표지뿐이다. 📌 인용 2건·cs_ids·cs_spans·pat·ok 불가침.
//   ③ 은 심사관 지정 문안 그대로다 — 초안의 「도덕적 지위를 얻을 수 없다」는 보기의
//   인격체 경로까지 닫아 보기를 초과하므로, 선지가 든 조항까지만 말한다.
//
// ★ 표지는 `✅ 보기 조건과 지문이 일치하는 적절한 진술` — 코퍼스 541건의 정본
//   표기이고 <보기> 기반 문항에 맞는다(현행 `✅ 지문과 일치하는…`은 2467건이지만
//   판단 기준이 지문인 문항용이다).
//
// 사용: node pipeline/d214_q8_rewrite.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const YK = "2027_9월", SID = "r20279b", QID = 8, CNUM = 4;

// 📌 인용 2건 — 기존 원문 그대로 옮긴다(§13⑦ exact-substring, 새로 짓지 않는다)
const PIN = [
  '📌 보기 근거: "인격 종이란 자연 종의 하나로서 그 종의 구성원이 전형적으로 인격체인 종을 말하며"',
  '📌 지문 근거: "고도의 지능을 갖춘 인공 지능을 인공 행위자이자 도덕적 행위자로 인정할 수 있다는 방법론들이 제시되었다."',
];
const NEXT = [
  ...PIN,
  "🔍 [풀이]",
  "① 판단 기준: 발문이 「<보기>를 바탕으로 (나)를 이해한」이므로, 보기의 틀을 (나)에 적용했을 때 타당한지를 본다. 지문 자체의 주장과 일치하는지는 기준이 아니다.",
  "② 보기에서 인격 종은 '자연 종'으로 한정된다. 인공 행위자는 인공적으로 만들어진 존재이므로 자연 종에 속하지 않는다.",
  "③ 선지가 든 근거는 보기의 '인격 종은 자연 종의 하나'라는 조항이다. 이 조항을 기준으로 하면 인공 행위자는 그가 지닌 능력이 아무리 뛰어나도 인격 종의 구성원이 될 수 없다. 따라서 인격 종의 구성원이라는 자격으로 도덕적 행위자가 되는 길은 닫혀 있다.",
  "④ 선지는 바로 그 적용 결과를 서술하므로 적절하다.",
  "",
  "✅ 보기 조건과 지문이 일치하는 적절한 진술",
].join("\n");

const raw = fs.readFileSync(DATA, "utf8");
const j = JSON.parse(raw);

console.log("# r20279b Q8 ④ 해설 재작성 (D-214)");
console.log("");
console.log(`- \`data-source/all_data_204.json\` 적용 전 MD5 \`${md5(raw)}\``);
console.log("");

const fail = [];
const set = (j[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
const q = set && (set.questions || []).find((x) => x.id === QID);
const c = q && (q.choices || []).find((x) => x.num === CNUM);
if (!c) fail.push(`${YK}::${SID} Q${QID} 선지 ${CNUM} 을 못 찾았다`);

let BEFORE = null;
if (c) {
  BEFORE = c.analysis;
  // ★ 상신 때 읽은 상태 그대로인가
  if (BEFORE.length !== 443) fail.push(`analysis 길이 ${BEFORE.length} — 채증 때는 443 이었다`);
  if (!BEFORE.includes("선지는 보기와 지문을 혼동했다")) fail.push("채증한 반전 문장이 없다 — 이미 고쳐졌나");
  if (c.ok !== true) fail.push(`ok 가 ${c.ok} — true 여야 한다(정답표상 Q8 정답은 ③)`);
  if (c.pat !== null) fail.push(`pat 이 ${JSON.stringify(c.pat)} — null 이어야 한다`);
  // ★ 📌 인용 2건이 원문 그대로인가 — 새로 지으면 §13⑦ 위반이다
  for (const p of PIN) if (!BEFORE.includes(p)) fail.push(`📌 인용이 원문과 다르다: ${p.slice(0, 34)}…`);
  // ★ 인용이 실제로 보기·지문에 있는가(exact-substring)
  const N = (s) => String(s || "").replace(/\s+/g, "");
  const bt = typeof q.bogi === "string" ? q.bogi : (q.bogi?.text || "");
  const q0 = PIN[0].match(/"([^"]+)"/)[1], q1 = PIN[1].match(/"([^"]+)"/)[1];
  if (!N(bt).includes(N(q0))) fail.push("보기 근거 인용이 <보기>에 없다");
  if (!(set.sents || []).some((x) => N(x.t).includes(N(q1)))) fail.push("지문 근거 인용이 지문에 없다");
}

console.log("## 변경 범위");
console.log("");
console.log("| 필드 | 처리 |");
console.log("|---|---|");
console.log(`| \`analysis\` | [풀이] 본문 + 표지 교체 (${BEFORE ? BEFORE.length : "?"}자 → ${NEXT.length}자) |`);
console.log("| `📌` 인용 2건 | 원문 그대로 (§13⑦ exact-substring) |");
console.log(`| \`ok\` / \`pat\` / \`cs_ids\` / \`cs_spans\` | **불가침** |`);
console.log("");
console.log("### 재작성 후 전문");
console.log("```");
console.log(NEXT);
console.log("```");
console.log("");

if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("✅ 사전 검사 통과 — 1건 (📌 인용 2건 exact-substring 확인 포함)");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ─────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.json.before_d214"), raw, "utf8");
c.analysis = NEXT;
fs.writeFileSync(DATA, JSON.stringify(j), "utf8");   // §13⑪ minified 유지

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const raw2 = fs.readFileSync(DATA, "utf8");
const j2 = JSON.parse(raw2);
const bad = [];
const c2 = (j2[YK].reading.find((x) => (x.setId || x.id) === SID).questions || [])
  .find((x) => x.id === QID).choices.find((x) => x.num === CNUM);
if (c2.analysis !== NEXT) bad.push("analysis 가 다르다");
if (/혼동했|부적절|틀렸/.test(c2.analysis)) bad.push("🔴 반전 문구가 남아 있다");
if (!c2.analysis.trim().endsWith("✅ 보기 조건과 지문이 일치하는 적절한 진술")) bad.push("표지가 다르다");
if (c2.ok !== true || c2.pat !== null) bad.push("ok/pat 이 바뀌었다");
if (JSON.stringify(c2.cs_ids) !== JSON.stringify(c.cs_ids)) bad.push("cs_ids 가 바뀌었다");
// ★ 역방향 바이트 일치 — analysis 를 되돌리면 파일 전체가 원본과 같아야 한다
const j3 = JSON.parse(raw2);
j3[YK].reading.find((x) => (x.setId || x.id) === SID).questions.find((x) => x.id === QID)
  .choices.find((x) => x.num === CNUM).analysis = BEFORE;
if (JSON.stringify(j3) !== JSON.stringify(JSON.parse(raw)))
  bad.push("🔴 역방향 바이트 일치 실패 — 이 필드 외에 달라진 곳이 있다");

console.log(`- 적용 후 MD5 \`${md5(raw2)}\` (${raw2.length - raw.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.json.before_d214`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- analysis 1건 교체 · 📌 인용 원문 유지 · ok/pat/cs_ids/cs_spans 무변 · 역방향 바이트 일치");
console.log("- 오탐 2건(l20279b Q27①·l20279c Q30②)은 열지도 쓰지도 않았다");
