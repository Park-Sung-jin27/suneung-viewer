// bogi_label_fix.mjs — <보기 N> 라벨 앞 줄바꿈 보정 (심사관 화면 검수 지적 ①)
//
// D-102 에서 <보기 2> 뒤에만 개행을 넣고 **앞에는 넣지 않았다.** 그래서 화면에서
// <보기 1> 산문 마지막 문장 꼬리에 라벨이 붙어 렌더됐다.
//   "…형식을 계승하여 표현한 작품이다.<보기 2>"
//
// 원인은 데이터다(렌더러 아님). 기존 353세트 관례를 확인했다 — `<보기 N>` 라벨은
// **문자열 맨 앞이거나 개행 바로 뒤**에 온다(5개 중 4개, 나머지 1개가 이 건).
//
// 사용: node pipeline/bogi_label_fix.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const LABEL = /<보기\s*\d>/g;

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
let fixed = 0;
const rows = [];

for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || [])
      for (const q of s.questions || []) {
        if (typeof q.bogi !== "string" || !q.bogi) continue;
        const before = q.bogi;
        // 라벨 앞이 맨앞도 개행도 아니면 개행을 넣는다. 글자는 건드리지 않는다.
        const out = before.replace(LABEL, (m, off, str) => {
          if (off === 0 || str[off - 1] === "\n") return m;
          return "\n" + m;
        });
        if (out === before) continue;
        const at = before.search(LABEL);
        rows.push({ yk, sid: s.id, qid: q.id,
          ctx: before.slice(Math.max(0, before.indexOf(">", at) - 30), at + 40) });
        // 라벨 뒤에도 개행이 없으면 함께 넣는다(라벨과 본문이 한 줄로 붙지 않도록)
        const out2 = out.replace(LABEL, (m, off, str) => {
          const after = str.slice(off + m.length, off + m.length + 1);
          return after && after !== "\n" ? m + "\n" : m;
        });
        if (APPLY) q.bogi = out2;
        fixed++;
      }

console.log(`## <보기 N> 라벨 줄바꿈 보정 ${APPLY ? "적용" : "DRY-RUN"} — ${fixed}건\n`);
for (const r of rows) console.log(`  [${r.yk}] ${r.sid} Q${r.qid}\n     …${r.ctx.replace(/\n/g, "⏎")}…`);
if (APPLY && fixed) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
