// year_skeleton.mjs — 신규 회차 자리를 all_data 에 만든다 (발주 D-141 ③)
//
// 왜 필요한가
//   step6_merge 는 `if (!allData[examKey])` 에서 멈춘다 — 이미 있는 회차에만 쓸 수 있다.
//   merge_reextract 도 `data[yk][sec] ??= []` 라 data[yk] 가 있어야 한다.
//   그래서 **신규 회차를 처음 넣는 자리가 파이프라인에 없었다**(D-140 ⑤).
//   이 도구가 그 한 칸을 채운다. 세트는 넣지 않는다 — 빈 자리만 만든다.
//
// 메타 규약 (기존 49회차 실측)
//   label  : 49/49 가 갖고 있다 — 필수
//   tag·badge·color : 7/49 뿐이다 — 최근 회차(2026_9월·2027_6월)는 label 만 쓴다
//   그래서 기본은 label 만 만든다. 필요하면 --tag/--badge/--color 로 준다.
//
// 사용:
//   node pipeline/year_skeleton.mjs 2027_9월              (미리보기)
//   node pipeline/year_skeleton.mjs 2027_9월 --apply
//   node pipeline/year_skeleton.mjs 2027_9월 --apply --label "2027 9월 모의"

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const yk = argv.find((x) => !x.startsWith("--"));
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };

if (!yk) {
  console.error("사용법: node pipeline/year_skeleton.mjs <회차키> [--apply] [--label ...]");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));

if (data[yk]) {
  const r = (data[yk].reading || []).length, l = (data[yk].literature || []).length;
  console.log(`⚠ ${yk} 는 이미 있다 — reading ${r} · literature ${l}. 아무것도 하지 않는다.`);
  process.exit(0);
}

const skel = { label: opt("label") || yk, reading: [], literature: [] };
for (const k of ["tag", "badge", "color"]) if (opt(k)) skel[k] = opt(k);

console.log(`## 회차 스켈레톤 ${APPLY ? "생성" : "미리보기"} — ${yk}`);
console.log("");
console.log(`  ${JSON.stringify(skel)}`);
console.log("");
console.log(`  기존 회차 수 ${Object.keys(data).length} → ${Object.keys(data).length + 1}`);

if (!APPLY) {
  console.log("");
  console.log("### 미리보기 — 아무것도 쓰지 않았다. 만들려면 --apply");
  process.exit(0);
}

data[yk] = skel;
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");

// 되읽기 검산 — S-02
const back = JSON.parse(fs.readFileSync(DATA, "utf8"));
if (!back[yk] || !Array.isArray(back[yk].reading) || !Array.isArray(back[yk].literature)) {
  console.log(`\n🔴 되읽기 실패 — ${yk} 가 제대로 만들어지지 않았다`);
  process.exit(1);
}
console.log("");
console.log(`  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB`);
console.log(`  되읽기 검산 통과 — ${yk} 자리가 생겼다. 이제 step6_merge 를 쓸 수 있다.`);
