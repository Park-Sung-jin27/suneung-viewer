/**
 * fix_dead_csids.cjs
 * DEAD cs_ids 수정 — sentId 형식 치환 + 변환 불가 시 제거
 * 대상: 모든 시험 (CLI 인자 없으면 전체, 있으면 해당 시험만)
 *
 * 변환 시도:
 *   1. _s → s         (l2022a_s13 → l2022as13)
 *   2. s → _s         (l20236es6 → l20236e_s6)
 *   3. 첫 _ 제거       (l2024_22_27s11 → l202422_27s11)
 *
 * 사용법:
 *   node pipeline/fix_dead_csids.cjs           # 전체 시험
 *   node pipeline/fix_dead_csids.cjs 2022수능   # 특정 시험만
 */
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(
  __dirname,
  "..",
  "..",
  "public",
  "data",
  "all_data_204.json",
);
const d = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

const arg = process.argv[2];
const targets = arg ? [arg] : Object.keys(d);
let totalFixed = 0,
  totalRemoved = 0;

for (const y of targets) {
  const yd = d[y];
  if (!yd) continue;

  // Build sentId set
  const allSentIds = new Set();
  for (const sec of ["reading", "literature"])
    for (const st of yd[sec] || [])
      for (const sv of st.sents || []) allSentIds.add(sv.id);

  let fixed = 0,
    removed = 0;

  for (const sec of ["reading", "literature"])
    for (const st of yd[sec] || [])
      for (const q of st.questions || [])
        for (const c of q.choices || []) {
          if (!Array.isArray(c.cs_ids) || c.cs_ids.length === 0) continue;
          const newIds = [];
          for (const id of c.cs_ids) {
            if (allSentIds.has(id)) {
              newIds.push(id);
              continue;
            }
            // Try multiple conversions
            const candidates = [
              id.replace(/_s(\d+)$/, "s$1"),
              id.replace(/([a-z])s(\d+)$/, "$1_s$2"),
            ];
            let matched = null;
            for (const cand of candidates) {
              if (cand !== id && allSentIds.has(cand)) {
                matched = cand;
                break;
              }
            }
            if (matched) {
              newIds.push(matched);
              fixed++;
            } else {
              removed++;
            }
          }
          c.cs_ids = newIds;
        }

  if (fixed > 0 || removed > 0) {
    console.log(`${y}: ${fixed}건 치환, ${removed}건 제거`);
  }
  totalFixed += fixed;
  totalRemoved += removed;
}

console.log(`\n총: ${totalFixed}건 치환, ${totalRemoved}건 제거`);

// Verify: 전체 시험 잔여 DEAD 합계
let totalDead = 0;
for (const y of targets) {
  const yd = d[y];
  if (!yd) continue;
  const allSentIds = new Set();
  for (const sec of ["reading", "literature"])
    for (const st of yd[sec] || [])
      for (const sv of st.sents || []) allSentIds.add(sv.id);

  let dead = 0;
  for (const sec of ["reading", "literature"])
    for (const st of yd[sec] || [])
      for (const q of st.questions || [])
        for (const c of q.choices || [])
          for (const id of c.cs_ids || []) if (!allSentIds.has(id)) dead++;

  if (dead > 0) console.log(`잔여 DEAD: ${y} = ${dead}건`);
  totalDead += dead;
}

console.log(
  `\n총: ${totalFixed}건 치환, ${totalRemoved}건 제거 | 잔여 DEAD: ${totalDead}건`,
);

fs.writeFileSync(DATA_PATH, JSON.stringify(d), "utf8");
console.log("✅ all_data_204.json 저장 완료");
