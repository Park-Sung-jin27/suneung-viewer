// d215_q13_rewrite.mjs — r20279c Q13 ① 해설 재작성 + pat R3→R1 + cs_ids (발주 D-215 ⓐ)
//
// 기존 해설은 「지문에 없는 극단적 상황을 임의로 추론」(R3)으로 읽었으나, 지문은
// 그 상황을 실제로 다룬다 — 변압기는 입력 전압에 **변화가 있어야** 출력이 생기고,
// 그래서 스위치로 변화가 심한 전압으로 바꾼다. 선지의 「계속 온이면 점점 높아진다」는
// 지문 원리를 **반대로** 서술한 것이므로 R1(사실 왜곡)이다.
//
// ★ pat R3→R1 은 곧 cs_ids 를 채워야 한다는 뜻이다. R3·V 는 「지문에 없다/어휘」라
//   cs=[] 가 규약이지만(§13⑮·E_empty_pat_cs_present), R1 은 지문 문장과 맞대어
//   틀렸음을 보이는 패턴이라 REQUIRES_CS 대상이다.
//
// ★ cs_ids 는 해설이 인용한 지문 근거 두 문장이다 — 실재를 확인하고 넣는다(규율 ⑲).
//     r20279cs18 "이 전압은 변화가 적어 변압기에 입력되어도 …"
//     r20279cs19 "이 때문에 반도체로 만들어진 스위치를 사용하여 …"
//
// ★ 📌 보기 근거는 기존 원문 그대로 유지한다(§13⑦ exact-substring).
// ★ 표지 `[R1]` 은 정본에 13건 쓰인 표기다.
//
// 사용: node pipeline/d215_q13_rewrite.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const YK = "2027_9월", SID = "r20279c", QID = 13, CNUM = 1;
const CS = ["r20279cs18", "r20279cs19"];
const PIN_BOGI = '📌 보기 근거: "어떤 순간에 최종 출력 전압이 4.5 V이고 이때 비교 회로 출력의 온오프비가 10%인 것으로 측정되었다."';
const PIN_BODY = '📌 지문 근거: "이 전압은 변화가 적어 변압기에 입력되어도 변압기의 출력 측에 전압이 거의 발생하지 않는다. 이 때문에 반도체로 만들어진 스위치를 사용하여 이 전압을 변화가 심한 전압으로 바꾼다."';
const NEXT = [
  PIN_BOGI,
  PIN_BODY,
  "🔍 [풀이]",
  "① 판단 기준: 윗글의 원리로 보기의 상황을 해석한다.",
  "② 지문에서 변압기는 입력 전압에 변화가 있어야 출력이 생긴다. 일차 측 평활 회로를 지난 전압은 변화가 적어 그대로 넣으면 변압기 출력이 거의 없으므로, 스위치를 온·오프해 변화가 심한 전압으로 바꾼 뒤 변압기에 넣는다.",
  "③ 스위치가 계속 온이면 스위치 출력은 입력과 같은 변화 없는 전압이 되고, 변압기 출력은 높아지는 것이 아니라 거의 발생하지 않는다. 선지는 지문의 원리를 반대로 서술했다.",
  "④ 또 5 V는 어댑터 최종 출력의 기준 전압이지 변압기를 지난 전압의 목표가 아니다.",
  "",
  "❌ 지문과 어긋나는 부적절한 진술 [R1]",
].join("\n");

const raw = fs.readFileSync(DATA, "utf8");
const j = JSON.parse(raw);

console.log("# r20279c Q13 ① 재작성 + pat R3→R1 + cs_ids (D-215 ⓐ)");
console.log("");
console.log(`- \`data-source/all_data_204.json\` 적용 전 MD5 \`${md5(raw)}\``);
console.log("");

const fail = [];
const N = (s) => String(s || "").replace(/\s+/g, "").replace(/[․·]/g, "·");
const set = (j[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
const q = set && (set.questions || []).find((x) => x.id === QID);
const c = q && (q.choices || []).find((x) => x.num === CNUM);
if (!c) fail.push(`${YK}::${SID} Q${QID} 선지 ${CNUM} 을 못 찾았다`);

let BEFORE = null, BEFORE_PAT = null, BEFORE_CS = null;
if (c) {
  BEFORE = c.analysis; BEFORE_PAT = c.pat; BEFORE_CS = c.cs_ids;
  // ★ 상신 때 읽은 상태 그대로인가
  if (BEFORE.length !== 552) fail.push(`analysis 길이 ${BEFORE.length} — 채증 때는 552 였다`);
  if (c.ok !== false) fail.push(`ok 가 ${c.ok} — false 여야 한다(정답 선지)`);
  if (c.pat !== "R3") fail.push(`pat 이 ${JSON.stringify(c.pat)} — R3 였어야 한다`);
  if ((c.cs_ids || []).length !== 0) fail.push(`cs_ids 가 ${JSON.stringify(c.cs_ids)} — 비어 있어야 했다`);
  // ★ 📌 보기 근거는 원문 그대로인가
  if (!BEFORE.includes(PIN_BOGI)) fail.push("📌 보기 근거가 원문과 다르다");
  // ★ 인용이 실제로 보기·지문에 있는가(§13⑦)
  const bt = typeof q.bogi === "string" ? q.bogi : (q.bogi?.text || "");
  if (!N(bt).includes(N(PIN_BOGI.match(/"([^"]+)"/)[1]))) fail.push("보기 근거 인용이 <보기>에 없다");
  // ★ cs_ids 두 문장이 실재하고 본문이며, 새 📌 지문 근거가 그 두 문장으로 이루어졌는가
  const joined = CS.map((id) => {
    const sn = (set.sents || []).find((x) => String(x.id) === id);
    if (!sn) { fail.push(`${id} 문장이 없다`); return ""; }
    if (["footnote", "author", "workTag", "omission", "summary", "image"].includes(sn.sentType))
      fail.push(`${id} 가 본문이 아니다(sentType=${sn.sentType})`);
    return N(sn.t);
  }).join("");
  if (joined && N(PIN_BODY.match(/"([^"]+)"/)[1]) !== joined)
    fail.push("📌 지문 근거가 cs_ids 두 문장을 이어붙인 것과 다르다");
}

console.log("## 변경 범위");
console.log("");
console.log("| 필드 | 전 | 후 |");
console.log("|---|---|---|");
console.log(`| \`analysis\` | ${BEFORE ? BEFORE.length : "?"}자 | ${NEXT.length}자 (판단 기준 명시형) |`);
console.log(`| \`pat\` | \`${BEFORE_PAT}\` | **\`R1\`** |`);
console.log(`| \`cs_ids\` | \`[]\` | \`${JSON.stringify(CS)}\` |`);
console.log("| `ok` / `cs_spans` | **불가침** | |");
console.log("");
console.log("### 재작성 후 전문");
console.log("```");
console.log(NEXT);
console.log("```");
console.log("");

if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("✅ 사전 검사 통과 — 1건 (📌 인용 exact-substring · cs_ids 실재·본문 확인 포함)");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ─────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.json.before_d215a"), raw, "utf8");
c.analysis = NEXT; c.pat = "R1"; c.cs_ids = [...CS];
fs.writeFileSync(DATA, JSON.stringify(j), "utf8");   // §13⑪ minified 유지

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const raw2 = fs.readFileSync(DATA, "utf8");
const j2 = JSON.parse(raw2);
const bad = [];
const c2 = (j2[YK].reading.find((x) => (x.setId || x.id) === SID).questions || [])
  .find((x) => x.id === QID).choices.find((x) => x.num === CNUM);
if (c2.analysis !== NEXT) bad.push("analysis 가 다르다");
if (c2.pat !== "R1") bad.push(`pat 이 ${c2.pat}`);
if (JSON.stringify(c2.cs_ids) !== JSON.stringify(CS)) bad.push("cs_ids 가 다르다");
if (c2.ok !== false) bad.push("ok 가 바뀌었다");
if (c2.cs_spans !== undefined) bad.push("cs_spans 가 생겼다 — 범위 밖이다");
if (!c2.analysis.trim().endsWith("❌ 지문과 어긋나는 부적절한 진술 [R1]")) bad.push("표지가 다르다");
// ★ 역방향 바이트 일치
const j3 = JSON.parse(raw2);
const c3 = j3[YK].reading.find((x) => (x.setId || x.id) === SID).questions.find((x) => x.id === QID)
  .choices.find((x) => x.num === CNUM);
c3.analysis = BEFORE; c3.pat = BEFORE_PAT; c3.cs_ids = BEFORE_CS;
if (JSON.stringify(j3) !== JSON.stringify(JSON.parse(raw)))
  bad.push("🔴 역방향 바이트 일치 실패 — 이 선지 외에 달라진 곳이 있다");

console.log(`- 적용 후 MD5 \`${md5(raw2)}\` (${raw2.length - raw.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.json.before_d215a`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- analysis 교체 · pat R3→R1 · cs_ids ${CS.length}건(실재·본문 확인) · ok·cs_spans 무변 · 역방향 바이트 일치`);
console.log("- 표지 통일(ⓑ)은 별도 커밋이라 여기서 손대지 않았다");
