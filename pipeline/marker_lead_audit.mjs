// marker_lead_audit.mjs — 선지 앞머리 마커 대조 (발주 D-36)
//
// 선지 맨 앞의 본문 마커는 앵커 구간 밖에 있어 기존 축이 못 본다.
//   r2023c Q13⑤  데이터 「⑤:」 / 원문 「ⓔ:」
//   r2021b Q29①  데이터 「⑦가」 / 원문 「㉮가」
// 구간을 넓혀 해결하려면 clipHard() 를 바꿔야 하고, 그러면 6개 축이 전부
// 영향을 받는다. 그래서 앵커를 건드리지 않고 별도 축으로 분리한다.
//
// ★ anchor.mjs 는 읽어 쓰기만 한다. 수정하지 않는다.
// ★ 선지 번호(①~⑤)는 대조 대상이 아니다. 원문에서 그 직후부터 본다.
// 사용: node pipeline/marker_lead_audit.mjs <pdf텍스트디렉터리> [데이터경로]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex, locateSpan, hard, MARK } from "./anchor.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = process.argv[2];
if (!DIR) { console.error("사용: node pipeline/marker_lead_audit.mjs <pdf텍스트디렉터리> [데이터경로]"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(process.argv[3] || path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const _s = src.indexOf("const RELEASE_KEYS = new Set([");
const RK = new Set(
  [...src.slice(_s, src.indexOf("]);", _s)).matchAll(/"([^"]+)"/g)]
    .map((m) => m[1]).filter((k) => k.includes("::")),
);
const CHOICE_NUM = /[\u2460-\u2464]/;

// 데이터 쪽 — 첫 본문 문자 앞에 붙은 마커 전부
const leadOf = (t) => {
  let out = "";
  for (const ch of String(t || "")) {
    if (hard(ch)) break;
    if (MARK.test(ch)) out += ch;
  }
  return out;
};
// 원문 쪽 — 구간 시작에서 뒤로 훑어 선지 번호를 만날 때까지의 마커
const leadInRaw = (raw, from) => {
  let out = "";
  for (let j = from - 1; j >= 0 && from - j < 12; j--) {
    const c = raw[j];
    if (CHOICE_NUM.test(c)) break;      // 선지 번호. 여기서 멈춘다
    if (MARK.test(c)) { out = c + out; continue; }
    if (!hard(c)) continue;             // 공백·구두점은 건너뛴다 (「①㉠: 본문」)
    break;
  }
  return out;
};

const rows = [];
for (const yk of Object.keys(data)) {
  const p = path.join(DIR, `pdf_${yk}.txt`);
  if (!fs.existsSync(p)) continue;
  const idx = buildIndex(fs.readFileSync(p, "utf8"));
  for (const sec of ["reading", "literature"]) {
    for (const set of data[yk][sec] || []) {
      const live = RK.has(`${yk}::${set.id}`);
      for (const q of set.questions || []) {
        for (const c of q.choices || []) {
          if (/src:|\[\[sym:/.test(c.t || "")) continue;
          const r = locateSpan(idx, c.t);
          if (!r.ok) continue;
          const dl = leadOf(c.t), pl = leadInRaw(idx.raw, r.from);
          if (dl === pl) continue;
          rows.push({ yk, setId: set.id, q: q.id, n: c.num, live,
            dl: dl || "(없음)", pl: pl || "(없음)", t: String(c.t).slice(0, 40) });
        }
      }
    }
  }
}
const liveN = rows.filter((r) => r.live).length;
console.log(`## 앞머리 마커 불일치 — ${rows.length}건 (LIVE ${liveN})\n`);
console.log("| 회차 | 세트 | 문항 | 선지 | 데이터 | 원문 |");
console.log("|---|---|--:|--:|---|---|");
const SHOW = process.argv.includes("--all") ? rows : rows.slice(0, 25);
for (const r of SHOW)
  console.log(`| ${r.yk} | ${r.setId} | Q${r.q} | ${r.n} | ${r.dl} | **${r.pl}** |${r.live ? " LIVE" : ""}`);
if (SHOW.length < rows.length) console.log(`\n… 외 ${rows.length - SHOW.length}건 (--all)`);
