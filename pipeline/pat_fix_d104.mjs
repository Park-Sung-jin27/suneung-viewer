// pat_fix_d104.mjs — D-103 에서 확정한 pat 오판 3건 정정 (발주 D-104 ④)
//
// 표본 검증에서 「다른 코드가 맞다」로 판정된 3건. 승인된 소규모 수정이다.
// pat 필드만 바꾼다 — analysis 본문·ok·cs_ids 는 손대지 않는다.
//
// 사용: node pipeline/pat_fix_d104.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");

const FIX = [
  ["2017수능", "r2017c", 38, 1, "R1", "R2",
    "「청약을 보험사가, 승낙을 가입자가」 — 주체를 뒤바꾼 것이다. 해설 결론문도 \"주체를 뒤바꾼\"이라 쓴다"],
  ["2021수능", "r2021b", 28, 5, "R1", "R4",
    "해설 꼬리에 [개념 혼합]이라 명시돼 있는데 pat 만 R1이었다 — 자기 모순"],
  ["2023수능", "r2023c", 12, 3, "R1", "R4",
    "위약벌에만 해당하는 성질을 손해배상 예정액에 적용 — 개념을 섞었다"],
];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
let n = 0;
console.log(`## pat 정정 ${APPLY ? "적용" : "DRY-RUN"} — ${FIX.length}건\n`);
for (const [yk, sid, qid, num, from, to, why] of FIX) {
  let c = null;
  for (const sec of ["reading", "literature"]) {
    const s = (data[yk]?.[sec] || []).find((x) => x.id === sid);
    if (!s) continue;
    const q = (s.questions || []).find((x) => String(x.id) === String(qid));
    c = q && (q.choices || []).find((x) => String(x.num) === String(num));
    break;
  }
  if (!c) { console.log(`  🔴 ${yk} ${sid} Q${qid}#${num} — 대상 없음`); continue; }
  if (c.pat !== from) { console.log(`  ⚠ ${yk} ${sid} Q${qid}#${num} — pat 이 ${JSON.stringify(c.pat)} (기대 ${from}) — 건너뜀`); continue; }
  console.log(`  ${yk} ${sid} Q${qid}#${num}: ${from} → ${to}`);
  console.log(`     ${why}`);
  console.log(`     선지: ${String(c.t).replace(/\n/g, " ").slice(0, 72)}`);
  if (APPLY) c.pat = to;
  n++;
}
if (APPLY && n) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · ${n}건`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
