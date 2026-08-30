// source_contamination_audit.mjs — 「줄거리·각주 오염」 축 (발주 D-157 ②)
//
// ★ 왜 만드나
//   l20206a 는 **제목·선지·줄거리 세 곳**이 같은 회차 l20206d(박경리 「토지」) 것이었다.
//   그런데 우리는 제목과 선지만 봤고, 줄거리(`[앞부분 줄거리]`)는 D-157 에서야 발견됐다.
//   `choice_contamination_audit` 는 선지만 본다. 본문 곁다리(줄거리·각주)는 아무도 안 봤다.
//
// 무엇을 보나 — 같은 문장이 서로 다른 세트에 들어 있는가
//   ⓐ 줄거리   `[앞부분 줄거리]`·`[중략 부분 줄거리]` 류
//   ⓑ 각주     `sentType: footnote`
//
//   A형↔B형(2014~2016)은 같은 시행이라 공유가 정상이다 — 따로 표시한다.
//
// ★ 줄거리는 **앞머리 25자**로 맞춘다 (S-13 · 첫 구현 실패 실증)
//   처음에는 줄거리 조각을 이어 붙여 통째로 비교했는데, 뒤따르는 본문까지 삼켜
//   l20206a(274자) ↔ l20206d(123자) 가 **안 걸렸다** — 잡아야 할 유일한 건을 놓쳤다.
//   줄거리는 세트마다 몇 조각으로 나뉘는지가 달라(l20206a 는 1문장, l20206d 는 3문장)
//   전문 비교가 원리적으로 안 된다. **앞머리만** 보면 조각 수와 무관하게 맞는다.
//
// ★ 각주는 전문 일치로 본다
//   `* 임원 : 산림.` 처럼 짧은 것이 우연히 겹칠 수 있어 공백 제외 10자 미만은 세지 않는다.
//
// 진단만 한다. 아무것도 쓰지 않는다.
//
// 사용:
//   node pipeline/source_contamination_audit.mjs          전 396세트
//   node pipeline/source_contamination_audit.mjs --live    LIVE 세트만
//   node pipeline/source_contamination_audit.mjs --year 2027_9월

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
const LIVE_ONLY = argv.includes("--live");
const yi = argv.indexOf("--year");
const YEAR = yi >= 0 ? argv[yi + 1] : null;
if (yi >= 0 && !YEAR) { console.error("🔴 --year 뒤에 회차 키가 없다."); process.exit(1); }
if (YEAR && !data[YEAR]) { console.error(`🔴 회차 \`${YEAR}\` 가 데이터에 없다. 오타이거나 아직 안 만든 회차다.`); process.exit(1); }

const norm = (t) => String(t).replace(/\s+/g, "");
const formBase = (yk) => yk.replace(/[AB]$/, "");
const SUM = /^\[(앞부분|중략 부분|뒷부분|앞 부분|중간 부분|중략)[^\]]*\]/;
const HEAD = 25;      // 줄거리 앞머리 비교 길이
const NOTE_MIN = 10;  // 각주 최소 길이(공백 제외)

const sums = [], notes = [];
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const setId = s.setId || s.id;
      const key = `${yk}::${setId}`;
      const live = REL.has(key);
      if (YEAR) { if (yk !== YEAR) continue; } else if (LIVE_ONLY && !live) continue;
      for (const x of s.sents || []) {
        const t = String(x.t || ""), n = norm(t);
        if (SUM.test(t) && n.length >= HEAD) sums.push({ key, yk, live, sec, id: x.id, k: n.slice(0, HEAD), t });
        else if ((x.sentType || "") === "footnote" && n.length >= NOTE_MIN) notes.push({ key, yk, live, sec, id: x.id, k: n, t });
      }
    }

const group = (arr) => {
  const m = new Map();
  for (const x of arr) { if (!m.has(x.k)) m.set(x.k, []); m.get(x.k).push(x); }
  const out = [];
  for (const [, v] of m) {
    const keys = [...new Set(v.map((x) => x.key))];
    if (keys.length < 2) continue;
    const yks = keys.map((x) => x.split("::")[0]);
    const sameForm = new Set(yks).size > 1 && yks.every((y) => formBase(y) === formBase(yks[0]));
    out.push({ v, keys, sameForm, live: v.some((x) => x.live) });
  }
  return out;
};
const gSum = group(sums), gNote = group(notes);
const badSum = gSum.filter((x) => !x.sameForm), badNote = gNote.filter((x) => !x.sameForm);
const scope = YEAR ? `${YEAR} 회차` : LIVE_ONLY ? `LIVE ${REL.size}세트` : "전체 396세트";

console.log("# 줄거리·각주 오염 축 — 같은 문장이 다른 세트에 들어 있는가");
console.log("");
console.log(`> 생성: \`node pipeline/source_contamination_audit.mjs ${argv.join(" ")}\``);
console.log("> 진단만 한다. **아무것도 쓰지 않는다.** 판정은 원본 대조로만 한다(S-01).");
console.log("");
console.log("| 항목 | 수 |");
console.log("|---|--:|");
console.log(`| 검사 범위 | ${scope} |`);
console.log(`| 줄거리 문장 / 각주 문장 | ${sums.length} / ${notes.length} |`);
console.log(`| 🔴 **줄거리 오염** | **${badSum.length}쌍** (LIVE ${badSum.filter((x) => x.live).length}) |`);
console.log(`| 🔴 **각주 오염** | **${badNote.length}쌍** (LIVE ${badNote.filter((x) => x.live).length}) |`);
console.log(`| — A/B형 공유 (정상) | 줄거리 ${gSum.length - badSum.length} · 각주 ${gNote.length - badNote.length} |`);
console.log("");

const show = (title, list, note) => {
  if (!list.length) { console.log(`✅ ${title} 없음`); console.log(""); return; }
  console.log(`## 🔴 ${title}`);
  console.log("");
  if (note) { console.log(note); console.log(""); }
  for (const g of list.sort((a, b) => b.live - a.live)) {
    console.log(`**${g.keys.join("  ↔  ")}**${g.live ? " 🔴 **LIVE**" : ""}`);
    for (const x of g.v) console.log(`- \`${x.key}\` ${x.id} (${x.sec}) — ${x.t.replace(/\s+/g, " ").slice(0, 74)}`);
    console.log("");
  }
};
show("줄거리 오염", badSum, "세트마다 줄거리가 몇 조각으로 나뉘는지가 달라 **앞머리 25자**로 맞춘다.");
show("각주 오염", badNote, "**독서 세트에 문학 각주가 있으면 거의 확실한 오염이다** — 영역(`reading`/`literature`)을 같이 본다.");

console.log("> ⚠ 이 축은 **글자가 똑같을 때만** 잡는다. 한 글자라도 다르게 섞였으면 못 본다.");
console.log("> 제목 오염은 이 축이 보지 않는다 — `release_gap`·`quality_gate` `C_work_mismatch` 소관이다.");
