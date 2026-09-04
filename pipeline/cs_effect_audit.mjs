// cs_effect_audit.mjs — 「형광펜 실효성」 축 (발주 D-147 ①)
//
// ★ 왜 만드나
//   D-146 에서 l20209d Q42#1 이 quality_gate 의 CS_ALL_NONHIGHLIGHTABLE 에 걸렸다.
//   cs_ids 는 채워져 있는데 그게 전부 각주 문장이라 **화면에서 형광펜이 한 개도 안 켜진다.**
//   release_diag 13축은 이걸 못 본다 — cs_ids 개수만 세기 때문이다.
//   핵심 차별점(선지↔근거 1:1 형광펜)이 조용히 죽는 자리라 LIVE 전수를 한 번에 본다.
//
//   quality_gate 도 같은 것을 보지만 **회차 단위**로만 돈다.
//   이 도구는 LIVE 267세트를 한 번에 훑는 것이 목적이다.
//
// 무엇을 보나 — cs_ids 가 가리키는 문장이 실제로 하이라이트되는가
//   ⓐ 전부 비-하이라이트  cs_ids 가 각주·작가·중략·구획표지만 가리킨다 → 형광펜 0개 🔴
//   ⓑ 없는 문장 참조      cs_ids 가 그 세트에 없는 문장 id 를 가리킨다 → 형광펜 0개 🔴
//   ⓒ 일부 비-하이라이트  섞여 있다 → 형광펜은 켜지지만 개수가 준다 ⚠
//
// ★ 비-하이라이트 sentType 은 추측하지 않고 렌더 코드에서 확인했다 (S-15)
//   src/PassagePanel.jsx — workTag 는 굵은 제목 div 로만 그려지고 하이라이트 style 을 안 탄다.
//   quality_gate 주석도 같다: 「body/verse/stage/speech 등만 하이라이트.
//   footnote/author/omission/workTag 면 형광펜 0개」
//   image·figure 는 텍스트가 아니라 따로 센다(실제로 걸리는지 수치로 낸다).
//
// 진단만 한다. 아무것도 쓰지 않는다.
//
// 사용:
//   node pipeline/cs_effect_audit.mjs --live      LIVE 전수 (기본 용도)
//   node pipeline/cs_effect_audit.mjs             전 396세트
//   node pipeline/cs_effect_audit.mjs "2020_9월::l20209d" …
//   node pipeline/cs_effect_audit.mjs --year 2027_9월      회차 단위 (스프린트 게이트)
//   node pipeline/cs_effect_audit.mjs --list      세트 목록만 (건수가 많을 때)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data-source/all_data_204.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

// 화면에서 하이라이트가 안 붙는 sentType (src/PassagePanel.jsx 확인)
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);

const argv = process.argv.slice(2);
const LIVE_ONLY = argv.includes("--live");
const LIST_ONLY = argv.includes("--list");
const yi = argv.indexOf("--year");
const YEAR = yi >= 0 ? argv[yi + 1] : null;
if (yi >= 0 && !YEAR) { console.error("🔴 --year 뒤에 회차 키가 없다."); process.exit(1); }
if (YEAR && !data[YEAR]) { console.error(`🔴 회차 \`${YEAR}\` 가 데이터에 없다. 오타이거나 아직 안 만든 회차다.`); process.exit(1); }
//   가드가 없으면 오타·미생성 회차에 「0건」이 떠 통과한 것처럼 보인다(§13⑳ 조용한 실패)
const picks = argv.filter((x) => x.includes("::"));

const rows = [];
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const setId = s.setId || s.id;
      const key = `${yk}::${setId}`;
      const live = REL.has(key);
      if (picks.length) { if (!picks.includes(key)) continue; }
      else if (YEAR) { if (yk !== YEAR) continue; }
      else if (LIVE_ONLY && !live) continue;

      const byId = new Map();
      for (const x of s.sents || []) if (x.id) byId.set(String(x.id), x);

      const allNon = [], dead = [], partial = [];
      let withCs = 0, csTotal = 0, hlTotal = 0;
      for (const q of s.questions || [])
        for (const c of q.choices || []) {
          const ids = (c.cs_ids || []).map(String);
          if (!ids.length) continue;
          withCs++; csTotal += ids.length;
          const missing = ids.filter((id) => !byId.has(id));
          const present = ids.filter((id) => byId.has(id));
          const hl = present.filter((id) => !NON_HL.has(byId.get(id).sentType || "body"));
          const non = present.filter((id) => NON_HL.has(byId.get(id).sentType || "body"));
          hlTotal += hl.length;
          const where = `Q${q.id}#${c.num}`;
          if (missing.length) dead.push(`${where}(${missing.join(" ")})`);
          if (!hl.length && ids.length) {
            if (!missing.length) allNon.push(`${where}(${non.map((id) => `${id}:${byId.get(id).sentType}`).join(" ")})`);
          } else if (non.length) partial.push(`${where}(${non.length}/${ids.length})`);
        }
      const bad = allNon.length + dead.length;
      if (bad || partial.length) rows.push({ yk, setId, key, live, withCs, csTotal, hlTotal, allNon, dead, partial, bad });
    }

const scope = picks.length ? `지정 ${picks.length}세트` : YEAR ? `${YEAR} 회차` : LIVE_ONLY ? `LIVE ${REL.size}세트` : "전체 396세트";
const bad = rows.filter((r) => r.bad);
const warn = rows.filter((r) => !r.bad && r.partial.length);

console.log("# 형광펜 실효성 축 — cs_ids 가 화면에서 실제로 켜지는가");
console.log("");
console.log(`> 생성: \`node pipeline/cs_effect_audit.mjs ${argv.join(" ")}\``);
console.log("> 진단만 한다. **아무것도 쓰지 않는다.**");
console.log("");
console.log("| 항목 | 수 |");
console.log("|---|--:|");
console.log(`| 검사 범위 | ${scope} |`);
console.log(`| 🔴 **형광펜 0개 세트** | **${bad.length}** (LIVE ${bad.filter((r) => r.live).length}) |`);
console.log(`| ⚠ 일부만 켜지는 세트 | ${warn.length} (LIVE ${warn.filter((r) => r.live).length}) |`);
console.log(`| 🔴 형광펜 0개 선지 | **${bad.reduce((a, r) => a + r.allNon.length + r.dead.length, 0)}** |`);
console.log("");

if (bad.length) {
  console.log("## 🔴 형광펜이 한 개도 안 켜지는 선지를 가진 세트");
  console.log("");
  console.log("| 회차 | 세트 | 노출 | ⓐ 전부 비-하이라이트 | ⓑ 없는 문장 참조 |");
  console.log("|---|---|---|---|---|");
  for (const r of bad.sort((a, b) => (b.live - a.live) || (b.bad - a.bad)))
    console.log(`| ${r.yk} | \`${r.setId}\` | ${r.live ? "🔴 LIVE" : "—"} | `
      + `${r.allNon.length ? (LIST_ONLY ? `${r.allNon.length}건` : r.allNon.join(" · ")) : "—"} | `
      + `${r.dead.length ? (LIST_ONLY ? `${r.dead.length}건` : r.dead.join(" · ")) : "—"} |`);
  console.log("");
}

if (warn.length && !LIST_ONLY) {
  console.log("## ⚠ 일부 cs_id 만 비-하이라이트 — 형광펜은 켜지되 개수가 준다");
  console.log("");
  for (const r of warn.sort((a, b) => (b.live - a.live) || a.yk.localeCompare(b.yk)))
    console.log(`- ${r.live ? "🔴 LIVE " : ""}\`${r.key}\` — ${r.partial.join(" · ")}`);
  console.log("");
}

if (!bad.length && !warn.length) console.log("✅ 형광펜 실효성 결함 없음");

console.log("> ⚠ 이 축은 **cs_ids 가 있는 선지**만 본다. cs_ids 가 아예 빈 선지는");
console.log("> `release_diag` ①축(근거 누락)·`quality_gate` release_ready 가 본다.");
console.log(`> 비-하이라이트 sentType: ${[...NON_HL].join(" · ")} (src/PassagePanel.jsx 확인)`);
