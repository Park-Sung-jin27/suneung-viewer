// evidence_gap_survey.mjs — LIVE 근거 공백 전수 조사 (발주 D-174)
//
// ★ 왜 만드나
//   D-172 에서 l20199e 가 release_ready 인데 20선지 중 3개(pat L3)가 근거 없이 남았다.
//   나는 이것을 quality_gate 의 구멍으로 보고 전수 조사를 제안했다.
//
//   **조사해 보니 구멍이 아니었다.** quality_gate.mjs:2506 이 근거를 요구하는 pat 을
//   R1·R2·R4·L1·L2·L4·L5 로 못박고 R3·L3·V·null 을 **의도적으로 면제**한다.
//   「과잉 추론」·「주제·의미 과잉」은 지문의 특정 문장 하나로 근거를 못 대는 유형이라
//   근거를 강제하면 억지 매핑이 늘어난다. 설계가 맞다.
//
//   그래도 수치는 남길 값이 있다 — 면제된 자리에서 화면 형광펜이 안 켜지는 것은 사실이고,
//   그게 몇 개인지는 아무도 몰랐다. 이 도구가 그 수를 센다. **판정은 하지 않는다.**
//
// ★ quality_gate 는 건드리지 않는다 (§13⑱ — 축 추가 금지)
//   이 도구는 **일회성 조사**다. 읽기만 하고 아무것도 쓰지 않는다.
//   수치를 내는 것이 전부다. 수리는 판정 후에 별건으로 한다.
//
// 무엇을 세나 — ok:false 인데 cs_ids 가 빈 선지
//   · pat 별로 가른다 (L1~L5 · R1~R4 · V · null)
//   · V(어휘)는 **면제 대상**이라 따로 뺀다 — 어휘 문항은 근거 문장을 걸지 않는 것이 정상이다
//   · null 도 따로 본다 — pat 이 없으면 quality_gate 가 애초에 볼 수 없는 자리다
//
// ★ 「📌 인용 보유」 컬럼 (D-175 ③)
//   근거가 빈 선지 중에도 **해설이 이미 지문을 인용하고 있는 것**이 있다.
//   D-173 의 l20199e 3선지가 그랬다 — 📌 가 어구를 그대로 물고 있어서
//   cs_ids 만 걸면 끝났다. 인용이 없는 자리는 어구부터 새로 찾아야 한다.
//   **수리 난이도가 다르다.** 이 컬럼이 그 갈래를 미리 보여 준다.
//   판정·수리는 하지 않는다 — 9/3 판정 후 별건이다.
//
// 사용:
//   node pipeline/evidence_gap_survey.mjs              LIVE 전수 (기본)
//   node pipeline/evidence_gap_survey.mjs --all        전 396세트
//   node pipeline/evidence_gap_survey.mjs --top 30     세트 목록 길이

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

const argv = process.argv.slice(2);
const ALL = argv.includes("--all");
const ti = argv.indexOf("--top");
const TOP = ti >= 0 ? Number(argv[ti + 1]) || 20 : 20;

// quality_gate 가 근거를 **요구하는** pat — 실제 코드에서 읽는다(추측하지 않는다, S-15)
//   quality_gate.mjs:2506 · 2529 에 같은 목록이 두 번 있다.
//   R3·L3·V·null 은 **의도적으로 면제**돼 있다 — 버그가 아니라 정책이다.
//   ("과잉 추론"·"주제·의미 과잉"은 특정 문장 하나로 근거를 못 대는 유형이다)
const qg = fs.readFileSync(path.join(ROOT, "pipeline/quality_gate.mjs"), "utf8");
const mReq = [...qg.matchAll(/REQUIRES?_CS\s*=\s*\[([^\]]+)\]/g)]
  .map((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
if (!mReq.length) { console.error("🔴 quality_gate 에서 REQUIRES_CS 목록을 못 찾았다. 도구가 낡았다."); process.exit(1); }
const CRIT_PATS = mReq[0];
if (mReq.some((l) => l.join() !== CRIT_PATS.join()))
  console.log(`> ⚠ quality_gate 안의 두 목록이 서로 다르다: ${mReq.map((l) => l.join("/")).join("  vs  ")}`);

const NAME = { R1: "사실 왜곡", R2: "인과·관계 전도", R3: "과잉 추론", R4: "개념 혼합", V: "어휘",
  L1: "표현·형식 오독", L2: "정서·태도 오독", L3: "주제·의미 과잉", L4: "구조·맥락 오류", L5: "보기 대입 오류" };

const byPat = new Map(), bySet = new Map(), cited = new Map();
let sets = 0, choices = 0, wrong = 0;
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const key = `${yk}::${s.setId || s.id}`;
      if (!ALL && !REL.has(key)) continue;
      sets++;
      for (const q of s.questions || [])
        for (const c of q.choices || []) {
          choices++;
          if (c.ok !== false) continue;
          wrong++;
          if ((c.cs_ids || []).length) continue;
          const p = c.pat == null || c.pat === "" ? "null" : String(c.pat).trim();
          byPat.set(p, (byPat.get(p) || 0) + 1);
          if (!bySet.has(key)) bySet.set(key, { live: REL.has(key), n: 0, cited: 0, pats: new Map(), where: [] });
          const b = bySet.get(key);
          b.n++; b.pats.set(p, (b.pats.get(p) || 0) + 1);
          if (b.where.length < 6) b.where.push(`Q${q.id}#${c.num}(${p})`);
          // 📌 인용 보유 — 해설이 지문을 큰따옴표로 인용하고 있는가
          const quoted = /["“”「」‘’]/.test(String(c.analysis || ""));
          if (quoted) { cited.set(p, (cited.get(p) || 0) + 1); b.cited++; }
        }
    }

const total = [...byPat.values()].reduce((a, b) => a + b, 0);
const nV = byPat.get("V") || 0;
const nNull = byPat.get("null") || 0;
const scope = ALL ? "전체 396세트" : `LIVE ${REL.size}세트`;

console.log("# 근거 공백 전수 조사 — ok:false 인데 cs_ids 가 빈 선지");
console.log("");
console.log(`> 생성: \`node pipeline/evidence_gap_survey.mjs ${argv.join(" ")}\``);
console.log("> **일회성 조사다. 읽기만 하고 아무것도 쓰지 않는다.** `quality_gate` 는 건드리지 않았다(§13⑱).");
console.log("> 수치만 낸다 — 수리는 판정 후 별건이다.");
console.log("");
console.log("| 항목 | 수 |");
console.log("|---|--:|");
console.log(`| 검사 범위 | ${scope} |`);
console.log(`| 전체 선지 / 오답 선지 | ${choices.toLocaleString()} / ${wrong.toLocaleString()} |`);
console.log(`| **근거 공백 합계** | **${total.toLocaleString()}** |`);
console.log(`| — V(어휘 면제) | ${nV.toLocaleString()} |`);
console.log(`| — pat 없음(null) | ${nNull.toLocaleString()} |`);
console.log(`| **면제·null 뺀 실질 공백** | **${(total - nV - nNull).toLocaleString()}** |`);
console.log(`| 공백을 가진 세트 | ${bySet.size} |`);
console.log("");

console.log("## pat 별 집계");
console.log("");
console.log("| pat | 이름 | 건수 | 비중 | 📌 인용 보유 | quality_gate 가 근거를 요구하나 |");
console.log("|---|---|--:|--:|--:|---|");
const order = ["L1", "L2", "L3", "L4", "L5", "R1", "R2", "R3", "R4"];
for (const p of order) {
  const n = byPat.get(p) || 0;
  if (!n) continue;
  const caught = CRIT_PATS.includes(p);
  const q = cited.get(p) || 0;
  console.log(`| \`${p}\` | ${NAME[p]} | **${n.toLocaleString()}** | ${(n / total * 100).toFixed(1)}% | **${q}** (${(q / n * 100).toFixed(0)}%) | ${caught ? "🔴 **예 — CRITICAL 로 잡힌다**" : "— **아니오, 면제**"} |`);
}
console.log(`| \`V\` | 어휘 | ${nV.toLocaleString()} | ${(nV / total * 100).toFixed(1)}% | ${cited.get("V") || 0} | — **아니오, 면제** |`);
console.log(`| \`null\` | pat 없음 | ${nNull.toLocaleString()} | ${(nNull / total * 100).toFixed(1)}% | ${cited.get("null") || 0} | — **아니오, 면제** |`);
console.log("");
const citedReal = (cited.get("R3") || 0) + (cited.get("L3") || 0);
const realGap = total - nV - nNull;
console.log(`> **📌 인용 보유 부분집합** — 면제·null 뺀 실질 공백 ${realGap}건 중 **${citedReal}건(${(citedReal / realGap * 100).toFixed(0)}%)** 은`);
console.log("> 해설이 이미 지문을 인용하고 있다. D-173 의 l20199e 3선지처럼 **cs_ids 만 걸면 되는 자리**다.");
console.log(`> 나머지 ${realGap - citedReal}건은 어구부터 새로 찾아야 한다 — 수리 난이도가 다르다.`);
console.log("> **수리는 하지 않는다.** 9/3 판정 후 별건이다(D-175 ③ — R3·L3 일괄 수리 안 함 확정).");
console.log("");
console.log(`> \`quality_gate\` 가 근거를 요구하는 pat: ${CRIT_PATS.map((p) => `\`${p}\``).join(" · ")}`);
console.log("> 나머지(`R3`·`L3`·`V`·`null`)는 **의도적 면제**다 — 코드 주석이 그렇게 적고 있다. 버그가 아니다.");
const rest = [...byPat.keys()].filter((p) => !order.includes(p) && p !== "V" && p !== "null");
if (rest.length) {
  console.log("");
  console.log(`> ⚠ 표에 없는 pat 값이 있다: ${rest.map((p) => `\`${p}\` ${byPat.get(p)}건`).join(" · ")}`);
  for (const [key, b] of bySet) for (const [p, n] of b.pats)
    if (rest.includes(p)) console.log(`>   - \`${key}\` ${b.where.filter((w) => w.includes(`(${p})`)).join(" ") || `${n}건`}`);
}
console.log("");

const rows = [...bySet.entries()].sort((a, b) => b[1].n - a[1].n);
console.log(`## 세트별 상위 ${Math.min(TOP, rows.length)} (전 ${rows.length}세트)`);
console.log("");
console.log("| 세트 | 공백 | 📌 인용 | pat 내역 | 자리 |");
console.log("|---|--:|--:|---|---|");
for (const [key, b] of rows.slice(0, TOP)) {
  const pats = [...b.pats].sort((x, y) => y[1] - x[1]).map(([p, n]) => `${p}:${n}`).join(" ");
  console.log(`| \`${key}\`${b.live && ALL ? " 🔴 LIVE" : ""} | **${b.n}** | ${b.cited} | ${pats} | ${b.where.join(" ")}${b.n > b.where.length ? " …" : ""} |`);
}
console.log("");
console.log(`> 상위 ${Math.min(TOP, rows.length)}세트가 전체 공백의 ${(rows.slice(0, TOP).reduce((a, [, b]) => a + b.n, 0) / total * 100).toFixed(0)}% 를 차지한다.`);
console.log(`> 나머지 ${Math.max(0, rows.length - TOP)}세트는 목록에서 잘렸다 — \`--top ${rows.length}\` 로 전건을 볼 수 있다.`);
console.log("");
console.log("> ⚠ 이 조사는 **cs_ids 가 아예 빈 것**만 센다. cs_ids 는 있는데 각주만 가리켜");
console.log("> 형광펜이 안 켜지는 자리는 `cs_effect_audit` 소관이다.");
