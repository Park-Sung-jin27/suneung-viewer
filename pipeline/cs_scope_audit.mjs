// cs_scope_audit.mjs — 「근거가 구간을 넘어가는가 · 인용 어구가 형광펜이 아닌가」 (발주 D-167 ③④)
//
// ★ 왜 만드나
//   l2024d Q33 은 [A][B][C] 정박이 정확한데도 선지 4개가 17문장을 통째로 물어
//   **세 구간이 한꺼번에 칠해졌다.** 선지가 [B]만 말하는데 [C]까지 켜지면
//   학생은 어디를 봐야 할지 모른다. 형광펜이 「있다」와 「맞다」는 다른 문제다.
//
// 무엇을 보나
//   ⓐ 구간 초과   선지 t 가 [X] 하나만 말하는데 cs_ids 가 그 구간 밖 문장을 문다
//   ⓑ 인용 미반영 해설 📌 줄이 인용부호로 어구를 짚는데 cs_spans 가 비어 있다
//                 → 화면에서 그 문장이 통째로 칠해진다
//
// ★ 오탐 후보 (S-13 — 판정은 원본·선지 논리로만)
//   ⓐ 는 선지가 구간 밖 본문도 정당하게 근거로 쓸 수 있다. 그래서 **구간을 하나만
//      말하는 선지**로 좁힌다. 둘 이상 말하면(예 「[A]와 [B]」) 판정하지 않는다.
//   ⓑ 는 인용 어구가 <보기>에서 온 것일 수 있다. 📌 줄이 「보기 근거」면 세지 않는다.
//
// 진단만 한다. 아무것도 쓰지 않는다.
//
// 사용:
//   node pipeline/cs_scope_audit.mjs --live      LIVE 우선
//   node pipeline/cs_scope_audit.mjs             전 396세트
//   node pipeline/cs_scope_audit.mjs --year 2024수능

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data-source/all_data_204.json"), "utf8"));
const ann = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/annotations.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

const argv = process.argv.slice(2);
const LIVE_ONLY = argv.includes("--live");
const yi = argv.indexOf("--year");
const YEAR = yi >= 0 ? argv[yi + 1] : null;
if (yi >= 0 && !YEAR) { console.error("🔴 --year 뒤에 회차 키가 없다."); process.exit(1); }
if (YEAR && !data[YEAR]) { console.error(`🔴 회차 \`${YEAR}\` 가 데이터에 없다.`); process.exit(1); }
const NL = String.fromCharCode(10);
const flat = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));

const over = [], noSpan = [];
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const setId = s.setId || s.id, key = `${yk}::${setId}`, live = REL.has(key);
      if (YEAR) { if (yk !== YEAR) continue; } else if (LIVE_ONLY && !live) continue;
      const order = (s.sents || []).map((x) => String(x.id));
      const idx = new Map(order.map((id, i) => [id, i]));
      // 정박 구간 → 문장 id 집합
      const zone = new Map();
      for (const a of ann[yk]?.[setId] || []) {
        if (a?.type !== "bracket" || !a.label) continue;
        const i0 = idx.get(String(a.sentFrom)), i1 = idx.get(String(a.sentTo));
        if (i0 == null || i1 == null) continue;
        zone.set(a.label, new Set(order.slice(Math.min(i0, i1), Math.max(i0, i1) + 1)));
      }
      for (const q of s.questions || [])
        for (const c of q.choices || []) {
          const t = flat(c.t);
          const ids = (c.cs_ids || []).map(String);
          // ⓐ 구간 초과 — 라벨을 **하나만** 말하는 선지에 한한다
          const labs = [...new Set((t.match(/\[([A-F])\]/g) || []).map((x) => x.slice(1, -1)))];
          // 🔴 선지가 (가)~(마) 구획도 함께 말하면 구간 밖이 정당한 근거다 — 판정하지 않는다
          //   S-13 표본에서 잡았다: l20176b Q27 은 「[A], (나), (다)를 감상」이라
          //   [A] 밖 문장이 (나)·(다) 근거였는데 구간 초과로 걸렸다.
          const alsoWork = /\([가-마]\)/.test(t);
          if (zone.size && labs.length === 1 && !alsoWork && zone.has(labs[0]) && ids.length) {
            const z = zone.get(labs[0]);
            const out = ids.filter((i) => !z.has(i));
            if (out.length) over.push({ key, live, at: `Q${q.id}#${c.num}`, lab: labs[0],
              zoneN: z.size, ids: ids.length, out: out.length, sample: out.slice(0, 4).join(" ") });
          }
          // ⓑ 인용 미반영 — 📌 지문 근거 줄에 인용부호 어구가 있는데 cs_spans 가 없다
          if (!(c.cs_spans || []).length && ids.length) {
            const lines = flat(c.analysis).split(NL).filter((x) => x.trim().startsWith("📌"));
            const body = lines.filter((x) => !/보기\s*근거/.test(x)).join(" ");
            const quotes = [...new Set((body.match(/["“][^"”\n]{6,}["”]/g) || []))];
            if (quotes.length) noSpan.push({ key, live, at: `Q${q.id}#${c.num}`, n: quotes.length,
              sample: quotes[0].replace(/\s+/g, " ").slice(0, 46) });
          }
        }
    }

const scope = YEAR ? `${YEAR} 회차` : LIVE_ONLY ? `LIVE ${REL.size}세트` : "전체 396세트";
const oSets = new Set(over.map((x) => x.key)), nSets = new Set(noSpan.map((x) => x.key));
console.log("# 근거 정밀도 축 — 구간 초과 · 인용 미반영");
console.log("");
console.log(`> 생성: \`node pipeline/cs_scope_audit.mjs ${argv.join(" ")}\``);
console.log("> 진단만 한다. **아무것도 쓰지 않는다.** 판정은 선지 논리·원본으로만 한다(S-01).");
console.log("");
console.log("| 항목 | 수 |");
console.log("|---|--:|");
console.log(`| 검사 범위 | ${scope} |`);
console.log(`| 🔴 **ⓐ 구간 초과 선지** | **${over.length}** / ${oSets.size}세트 (LIVE ${[...oSets].filter((k) => REL.has(k)).length}) |`);
console.log(`| — **ⓑ 인용 미반영 선지(참고)** | ${noSpan.length} / ${nSets.size}세트 (LIVE ${[...nSets].filter((k) => REL.has(k)).length}) |`);
console.log("");
if (over.length) {
  console.log("## 🔴 ⓐ 구간 초과 — 선지가 한 구간만 말하는데 그 밖 문장까지 문다");
  console.log("");
  console.log("| 세트 | 위치 | 라벨 | 구간 문장 | cs_ids | 구간 밖 | 예 |");
  console.log("|---|---|---|--:|--:|--:|---|");
  for (const x of over.sort((a, b) => (b.live - a.live) || (b.out - a.out)).slice(0, 40))
    console.log(`| ${x.live ? "🔴 " : ""}\`${x.key}\` | ${x.at} | [${x.lab}] | ${x.zoneN} | ${x.ids} | **${x.out}** | ${x.sample} |`);
  if (over.length > 40) console.log(`\n… 외 ${over.length - 40}건`);
  console.log("");
}
if (noSpan.length) {
  console.log("## — ⓑ 인용 미반영 (참고 수치 · 결함 아님)");
  console.log("");
  console.log("**cs_spans 는 LIVE 선지의 46.3%(2,454/5,295)만 갖고 있다 — 없는 것이 일상이다.**");
  console.log("결함 목록이 아니라 **정밀도를 올릴 여지가 있는 자리** 목록으로 읽는다(S-25).");
  console.log("");
  const byKey = new Map();
  for (const x of noSpan) { if (!byKey.has(x.key)) byKey.set(x.key, []); byKey.get(x.key).push(x); }
  for (const [k, v2] of [...byKey].sort((a, b) => b[1].length - a[1].length).slice(0, 30))
    console.log(`- ${REL.has(k) ? "🔴 LIVE " : ""}\`${k}\` — ${v2.length}건 (${v2.slice(0, 4).map((x) => x.at).join(" ")}${v2.length > 4 ? " …" : ""})`);
  if (byKey.size > 30) console.log(`- … 외 ${byKey.size - 30}세트`);
  console.log("");
}
console.log("> ⚠ ⓐ 는 **라벨을 하나만 말하는 선지**만 본다 — 「[A]와 [B]」처럼 둘을 말하면 판정하지 않는다.");
console.log("> ⓑ 는 📌 「보기 근거」 줄의 인용은 세지 않는다 — <보기>는 본문이 아니라 형광펜 대상이 아니다.");
