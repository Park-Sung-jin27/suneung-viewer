// bracket_patch.mjs — [A]~[F] 구간을 annotations.bracket 으로 정박 (발주 D-104 ①)
//
// **자동 생성 금지.** 범위는 원본 지면을 눈으로 판독해 확정한 것만 넣는다.
// 「마커 다음부터 다음 마커 직전까지」로 추론하면 오정박이 난다 —
// l2019b [D] 가 반례다(마커 다음 s25, 다음 마커 직전 s32, 실제는 s25~s27).
//
// 세트가 확정될 때마다 SPEC 에 한 줄씩 추가하고 세트 단위로 패치·push 한다.
//
// 사용: node pipeline/bracket_patch.mjs [--only <setId>] [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();

// 판독 확정분. [세트, PDF 면수, [라벨, sentFrom, sentTo, 시작 행 요약]...]
const SPEC = [
  ["2019수능", "l2019b", "16면", [
    ["A", "l2019bs18", "l2019bs18", "그중에 전승산이 글 쓰는 양(樣) 바라보고"],
    ["B", "l2019bs19", "l2019bs22", "필담(筆談)으로 써서 뵈되…"],
    ["C", "l2019bs23", "l2019bs24", "내 웃고 써서 뵈되…"],
    ["D", "l2019bs25", "l2019bs27", "승산이 다시 하되…"],
    ["E", "l2019bs33", "l2019bs37", "놀랍고 어이없어 종이에 써서 뵈되…"],
  ]],
];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
let touched = 0;
console.log(`## bracket 정박 패치 ${APPLY ? "적용" : "DRY-RUN"}\n`);

for (const [yk, sid, page, items] of SPEC) {
  if (ONLY && sid !== ONLY) continue;
  let set = null;
  for (const sec of ["reading", "literature"]) {
    const f = (data[yk]?.[sec] || []).find((x) => x.id === sid);
    if (f) { set = f; break; }
  }
  if (!set) { console.log(`  🔴 ${yk} ${sid} — 세트 없음`); continue; }

  const ids = new Set((set.sents || []).map((x) => x.id));
  const idx = (id) => (set.sents || []).findIndex((x) => x.id === id);
  const have = new Set((set.annotations || []).filter((a) => a && a.type === "bracket").map((a) => a.label));
  const add = [];
  let bad = false;
  for (const [label, from, to, head] of items) {
    if (have.has(label)) { console.log(`  ⚠ ${sid} [${label}] — 이미 bracket 있음, 건너뜀`); continue; }
    if (!ids.has(from) || !ids.has(to)) { console.log(`  🔴 ${sid} [${label}] — 문장 id 없음 (${from} / ${to})`); bad = true; continue; }
    if (idx(from) > idx(to)) { console.log(`  🔴 ${sid} [${label}] — from 이 to 보다 뒤다`); bad = true; continue; }
    add.push({ type: "bracket", label, sentFrom: from, sentTo: to });
    const n = idx(to) - idx(from) + 1;
    console.log(`  ${yk} ${sid} [${label}] ${from} ~ ${to}  (${n}행) — ${head}`);
  }
  if (bad) { console.log(`  🔴 ${sid} — 검증 실패, 이 세트는 건너뛴다`); continue; }
  if (!add.length) continue;
  console.log(`     근거: 원본 ${page} 지면 판독`);
  if (APPLY) {
    set.annotations = [...(set.annotations || []), ...add];
    touched += add.length;
  }
}

if (APPLY && touched) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · bracket ${touched}개 추가`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
