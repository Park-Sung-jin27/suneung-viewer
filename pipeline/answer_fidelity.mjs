// answer_fidelity.mjs — 데이터의 정답(ok+questionType 도출)이 시험지 정답표 PDF와 일치하는지 검사하는 영구 게이트.
// LEGACY 정답표가 step1에서 1~34만 추출됐던 공백(35~45 미검증) 보강. (2026-06-14 신설)
// 사용: node pipeline/answer_fidelity.mjs [--yk=2018수능]
import fs from "fs";
import { execSync } from "child_process";
const d = JSON.parse(fs.readFileSync("public/data/all_data_204.json", "utf8"));
const args = process.argv.slice(2);
const ykFilter = (args.find((a) => a.startsWith("--yk=")) || "").split("=")[1];
const CIRC = { "①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5 };
function keyFromPdf(yk) {
  const dir = `_done/${yk}`;
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find((x) => x.endsWith("정답.pdf"));
  if (!hit) return null;
  let raw = "";
  try {
    raw = execSync(
      `python3 -c "import fitz;dd=fitz.open('${dir}/${hit}');print(''.join(p.get_text() for p in dd))"`,
      { maxBuffer: 1e8 },
    ).toString();
  } catch {
    return null;
  }
  const toks = raw.match(/\d+|[①②③④⑤]/g) || [];
  const ans = {};
  for (let i = 0; i < toks.length - 1; i++)
    if (/^\d+$/.test(toks[i]) && CIRC[toks[i + 1]]) {
      const q = +toks[i];
      if (q >= 1 && q <= 45 && !(q in ans)) ans[q] = CIRC[toks[i + 1]];
    }
  return ans;
}
const bad = [],
  dist = [],
  nokey = [];
for (const yk of Object.keys(d)) {
  if (ykFilter && yk !== ykFilter) continue;
  const key = keyFromPdf(yk);
  if (!key) continue;
  for (const cat of ["reading", "literature"])
    for (const s of d[yk][cat] || [])
      for (const q of s.questions) {
        const k = key[q.id];
        if (k == null) {
          nokey.push(`${yk} ${s.id} Q${q.id}`);
          continue;
        }
        const qt = q.questionType;
        const cand = q.choices.filter((c) =>
          qt === "negative" ? c.ok === false : c.ok === true,
        );
        if (cand.length !== 1)
          dist.push(
            `${yk} ${s.id} Q${q.id} (qt=${qt}, 정답후보 ${cand.length}개, 정답표=${k})`,
          );
        else if (cand[0].num !== k)
          bad.push(
            `${yk} ${s.id} Q${q.id}: data=${cand[0].num} ↔ 정답표=${k} (qt=${qt})`,
          );
      }
}
console.log(
  `정답 불일치: ${bad.length} | ok분포이상: ${dist.length} | 정답표키 누락: ${nokey.length}`,
);
console.log("=== 정답 불일치 ===");
bad.forEach((x) => console.log("  " + x));
console.log("=== ok분포이상 ===");
dist.slice(0, 60).forEach((x) => console.log("  " + x));
