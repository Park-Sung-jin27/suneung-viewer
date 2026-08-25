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
  // 🔴 기존 bracket 4개(A·B·D·E)가 **(가) 유치환 「채전」의 시행**(l2023ds9~12)을
  //    가리키고 있었다. 원본 21면 판독 결과 [A]~[F] 는 전부 **(나) 나희덕
  //    「음지의 꽃」** 에 있다. (가) 지면에는 구간 표시가 하나도 없다.
  //    그래서 [C][F] 추가가 아니라 **6개 전부 재정박**한다(REPLACE).
  ["2023수능", "l2023d", "21면", [
    ["A", "l2023ds20", "l2023ds21", "우리는 썩어 가는 참나무 떼,"],
    ["B", "l2023ds24", "l2023ds25", "함께 썩어 갈수록"],
    ["C", "l2023ds26", "l2023ds27", "이윽고 잠자던 홀씨들 일어나"],
    ["D", "l2023ds29", "l2023ds31", "우리는 서서히 썩어 가지만"],
    ["E", "l2023ds33", "l2023ds34", "산비탈에 구르는 낙엽으로도"],
    ["F", "l2023ds35", "l2023ds36", "덮을 길 없는 우리의 몸을"],
  ], "REPLACE"],
  ["2015수능A", "l2015b", "12면", [
    ["A", "l2015bs3", "l2015bs5", "심신이 황홀하여 죽장을 짚고 월령산 조대로…"],
    ["B", "l2015bs21", "l2015bs22", "생이 동자를 따라 들어가니 청산에 불이 명랑하고…"],
  ]],
  ["2015수능A", "l2015d", "14면", [
    ["A", "l2015ds33", "l2015ds35", "그 눈동자는 띠룩띠룩 애원하듯 원망하듯…"],
    ["B", "l2015ds43", "l2015ds43", "물동이를 이고 치마꼬리에 그 빨간 손을 씻으며…"],
  ]],
  ["2018수능", "l2018a", "7면", [
    ["A", "l2018as32", "l2018as35", "시는 인간의 삶을 반영한다."],
  ]],
  ["2018수능", "l2018c", "12면", [
    ["A", "l2018cs60", "l2018cs65", "잎이 빳빳하고도 오히려 영롱(玲瓏)하다 — 시조 2수"],
  ]],
  ["2020수능", "l2020c", "12~13면", [
    ["A", "l2020cs12", "l2020cs12", "'내가 재상가의 귀한 몸으로 유생과 백년가약을…'"],
    ["B", "l2020cs16", "l2020cs16", "\"낭군은 부질없는 말씀 마옵소서…\""],
  ]],
  ["2021수능", "r2021b", "10면", [
    ["A", "r2021bs12", "r2021bs19", "예약은 예약상 권리자가 가지는 권리의 법적 성질에 따라…"],
  ]],
];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
let touched = 0;
console.log(`## bracket 정박 패치 ${APPLY ? "적용" : "DRY-RUN"}\n`);

for (const [yk, sid, page, items, mode] of SPEC) {
  if (ONLY && sid !== ONLY) continue;
  let set = null;
  for (const sec of ["reading", "literature"]) {
    const f = (data[yk]?.[sec] || []).find((x) => x.id === sid);
    if (f) { set = f; break; }
  }
  if (!set) { console.log(`  🔴 ${yk} ${sid} — 세트 없음`); continue; }

  const ids = new Set((set.sents || []).map((x) => x.id));
  const idx = (id) => (set.sents || []).findIndex((x) => x.id === id);
  const existing = (set.annotations || []).filter((a) => a && a.type === "bracket");
  if (mode === "REPLACE" && existing.length) {
    console.log(`  🔁 ${sid} — 기존 bracket ${existing.length}개를 폐기하고 다시 넣는다 (오정박)`);
    for (const a of existing)
      console.log(`       버림: [${a.label}] ${a.sentFrom}~${a.sentTo}`);
  }
  const have = mode === "REPLACE" ? new Set() : new Set(existing.map((a) => a.label));
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
    const keep = mode === "REPLACE"
      ? (set.annotations || []).filter((a) => !(a && a.type === "bracket"))
      : (set.annotations || []);
    set.annotations = [...keep, ...add];
    touched += add.length;
  }
}

if (APPLY && touched) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · bracket ${touched}개 추가`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
