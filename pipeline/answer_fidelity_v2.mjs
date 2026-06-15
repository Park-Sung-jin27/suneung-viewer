// answer_fidelity.mjs v2 — 정답 충실도 영구 게이트 (계측 보강판)
// v1 대비 추가:
//   (1) A/B형 디렉터리 해소: 데이터 yk("2014수능")가 _done/2014수능A·B 로 갈릴 때 자동 탐색
//   (2) image-only PDF 분류: fitz 텍스트 0 → "미대조"가 아니라 image_only 로 별도 표기
//   (3) 미대조(nokey)를 yearKey별 + 원인(status)으로 분해 출력 → 1319 정체를 측정으로 규명
// 사용: node pipeline/answer_fidelity.mjs [--yk=2018수능]
import fs from "fs";
import { execSync } from "child_process";
const d = JSON.parse(fs.readFileSync("public/data/all_data_204.json", "utf8"));
const args = process.argv.slice(2);
const ykFilter = (args.find((a) => a.startsWith("--yk=")) || "").split("=")[1];
const CIRC = { "①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5 };

// 데이터 yk 하나에 대응되는 _done 디렉터리 후보 (A/B형 포함)
function resolveDirs(yk) {
  const dirs = [];
  for (const cand of [`_done/${yk}`, `_done/${yk}A`, `_done/${yk}B`])
    if (fs.existsSync(cand)) dirs.push(cand);
  return dirs;
}

function parseTable(raw) {
  const toks = raw.match(/\d+|[①②③④⑤]/g) || [];
  const ans = {};
  for (let i = 0; i < toks.length - 1; i++)
    if (/^\d+$/.test(toks[i]) && CIRC[toks[i + 1]]) {
      const q = +toks[i];
      if (q >= 1 && q <= 45 && !(q in ans)) ans[q] = CIRC[toks[i + 1]]; // 홀수형 우선(첫 표)
    }
  return ans;
}

// {ans, status}  status: ok | image_only | no_pdf | no_dir | extract_fail
function keyFromPdf(yk) {
  const dirs = resolveDirs(yk);
  if (!dirs.length) return { ans: null, status: "no_dir" };
  for (const dir of dirs) {
    const hit = fs.readdirSync(dir).find((x) => x.endsWith("정답.pdf"));
    if (!hit) continue;
    let raw = "";
    try {
      raw = execSync(
        `python3 -c "import fitz;dd=fitz.open('${dir}/${hit}');print(''.join(p.get_text() for p in dd))"`,
        { maxBuffer: 1e8 },
      ).toString();
    } catch {
      return { ans: null, status: "extract_fail" };
    }
    if (raw.trim().length === 0) return { ans: null, status: "image_only" };
    return { ans: parseTable(raw), status: "ok" };
  }
  return { ans: null, status: "no_pdf" };
}

const bad = [],
  dist = [],
  nokeyByYk = {},
  statusByYk = {};
for (const yk of Object.keys(d)) {
  if (ykFilter && yk !== ykFilter) continue;
  const { ans, status } = keyFromPdf(yk);
  statusByYk[yk] = status;
  if (!ans) {
    let cnt = 0;
    for (const cat of ["reading", "literature"])
      for (const s of d[yk][cat] || []) cnt += (s.questions || []).length;
    if (cnt) nokeyByYk[yk] = cnt;
    continue;
  }
  for (const cat of ["reading", "literature"])
    for (const s of d[yk][cat] || [])
      for (const q of s.questions || []) {
        const k = ans[q.id];
        if (k == null) {
          nokeyByYk[yk] = (nokeyByYk[yk] || 0) + 1;
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
const nokeyTotal = Object.values(nokeyByYk).reduce((a, b) => a + b, 0);
console.log(
  `정답 불일치: ${bad.length} | ok분포이상: ${dist.length} | 미대조: ${nokeyTotal}`,
);
console.log("=== 정답 불일치 ===");
bad.forEach((x) => console.log("  " + x));
console.log("=== ok분포이상 (최대 60) ===");
dist.slice(0, 60).forEach((x) => console.log("  " + x));
console.log("=== 미대조 yearKey별 (원인=status) ===");
Object.entries(nokeyByYk)
  .sort((a, b) => b[1] - a[1])
  .forEach(([yk, n]) =>
    console.log(`  ${yk}: ${n}건 (status=${statusByYk[yk]})`),
  );
