// split_gap_probe.mjs — 「이 세트를 노출하면 --verify 가 깨지나」 사전 확인 (발주 D-177 ③)
//
// ★ 왜 만드나
//   F-45 가 r20199c 를 뺀 이유가 「--verify 가 누락 1건으로 실패한다」였다.
//   그런데 나는 RELEASE_KEYS 를 못 고치므로(프론트 소관) 276키로 --verify 를
//   돌려 볼 수가 없다. **노출 전에 미리 알 방법이 없었다.**
//
//   이 도구가 그 자리를 메운다. build_split 의 필드 배분표를 그대로 읽어서
//   「이 세트의 어떤 키가 free 에도 pro 에도 안 실리는가」를 센다.
//   노출 여부와 무관하게 **어느 세트든** 미리 볼 수 있다.
//
// ★ 배분표는 build_split 소스에서 읽는다 (S-15 — 손으로 베끼지 않는다)
//   배분표가 바뀌면 이 도구도 같이 바뀌어야 하는데, 손으로 적으면 조용히 어긋난다.
//
// 진단만 한다. 아무것도 쓰지 않는다.
//
// 사용:
//   node pipeline/split_gap_probe.mjs "2019_9월::r20199c"
//   node pipeline/split_gap_probe.mjs --all        전 396세트에서 누락이 날 세트를 전부

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

// build_split 의 배분표를 소스에서 그대로 읽는다
const bs = fs.readFileSync(path.join(ROOT, "pipeline/build_split.mjs"), "utf8");
const listOf = (name) => {
  const m = bs.match(new RegExp(`const ${name}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!m) { console.error(`🔴 build_split 에서 ${name} 을 못 찾았다. 이 도구가 낡았다.`); process.exit(1); }
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
};
const SET_OK = new Set([...listOf("SET_FREE"), ...listOf("SET_PRO"), ...listOf("SET_META"), "sents", "questions"]);
const SENT_OK = new Set([...listOf("SENT_FREE"), ...listOf("SENT_PRO")]);
const Q_OK = new Set([...listOf("Q_FREE"), ...listOf("Q_META"), "choices"]);
const C_OK = new Set([...listOf("C_FREE"), ...listOf("C_PRO")]);

const argv = process.argv.slice(2);
const ALL = argv.includes("--all");
const picks = argv.filter((x) => x.includes("::"));

const rows = [];
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const key = `${yk}::${s.setId || s.id}`;
      if (picks.length ? !picks.includes(key) : !ALL) continue;
      const gaps = [];
      for (const k of Object.keys(s)) if (!SET_OK.has(k) && k !== "setId") gaps.push(`세트.${k}`);
      for (const x of s.sents || []) for (const k of Object.keys(x)) if (!SENT_OK.has(k)) gaps.push(`${x.id}.${k}`);
      for (const q of s.questions || []) {
        for (const k of Object.keys(q)) if (!Q_OK.has(k)) gaps.push(`Q${q.id}.${k}`);
        for (const c of q.choices || []) for (const k of Object.keys(c)) if (!C_OK.has(k)) gaps.push(`Q${q.id}#${c.num}.${k}`);
      }
      if (gaps.length || picks.length) rows.push({ key, live: REL.has(key), gaps });
    }

console.log("# 분리 산출물 누락 사전 확인 — 이 세트를 노출하면 `--verify` 가 깨지나");
console.log("");
console.log(`> 생성: \`node pipeline/split_gap_probe.mjs ${argv.join(" ")}\``);
console.log("> 진단만 한다. **아무것도 쓰지 않는다.** 배분표는 `build_split.mjs` 소스에서 읽었다(S-15).");
console.log("");
console.log(`> 배분표 — 선지 허용 키: ${[...C_OK].map((k) => `\`${k}\``).join(" · ")}`);
console.log("");

const bad = rows.filter((r) => r.gaps.length);
console.log("| 세트 | 노출 | 누락될 키 |");
console.log("|---|---|---|");
for (const r of rows.sort((a, b) => b.gaps.length - a.gaps.length))
  console.log(`| \`${r.key}\` | ${r.live ? "🔴 LIVE" : "—"} | ${r.gaps.length ? `**${r.gaps.length}건** — ${r.gaps.slice(0, 6).join(" · ")}${r.gaps.length > 6 ? " …" : ""}` : "✅ 없음"} |`);
console.log("");

const liveBad = bad.filter((r) => r.live);
if (liveBad.length) {
  console.log(`## 🔴 **이미 노출된 세트 ${liveBad.length}개에 누락이 있다** — \`--verify\` 가 지금 실패하고 있어야 한다`);
  console.log("");
} else if (bad.length) {
  console.log(`## ⚠ 누락이 날 세트 ${bad.length}개 — 전부 **비노출**이라 지금은 \`--verify\` 가 통과한다`);
  console.log("");
  console.log("이 중 하나라도 `RELEASE_KEYS` 에 넣으면 그 순간 `--verify` 가 깨진다.");
  console.log("**노출 전에 이 도구를 돌리면 미리 알 수 있다.**");
  console.log("");
}
if (!bad.length) console.log("✅ 누락될 키 없음 — 이 세트는 노출해도 `--verify` 가 통과한다");
console.log("");
console.log("> ⚠ 이 도구는 **배분표에 없는 키**만 본다. 값이 깨진 것은 보지 않는다 —");
console.log("> 그건 `build_split --verify` 가 실제 산출물로 대조한다.");
