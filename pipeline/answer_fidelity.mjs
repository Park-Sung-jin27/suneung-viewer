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
let scopeSets = 0,
  scopeQ = 0,
  scopeC = 0; // 검사 스코프 분모(§13⑮)
const CIRC = { "①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5 };

// image_only 정답 PDF 폴백용 수동 정답 소스 (품질심사관 판독본)
let MANUAL = {};
try {
  MANUAL = JSON.parse(
    fs.readFileSync("config/manual_answer_keys.json", "utf8"),
  );
} catch {}

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

// {ans, status}  status: ok | manual | image_only | no_pdf | no_dir | extract_fail
function keyFromPdf(yk) {
  const dirs = resolveDirs(yk);
  let pdfStatus = dirs.length ? "no_pdf" : "no_dir";
  for (const dir of dirs) {
    const hit = fs.readdirSync(dir).find((x) => x.endsWith("정답.pdf"));
    if (!hit) continue;
    let raw = "";
    try {
      raw = execSync(
        `python3 -X utf8 -c "import fitz;dd=fitz.open('${dir}/${hit}');print(''.join(p.get_text() for p in dd))"`,
        {
          maxBuffer: 1e8,
          env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
        },
      ).toString();
    } catch {
      pdfStatus = "extract_fail";
      continue;
    }
    if (raw.trim().length === 0) {
      pdfStatus = "image_only";
      continue;
    }
    return { ans: parseTable(raw), status: "ok" };
  }
  // 폴백: PDF 미가용(image_only/no_pdf 등) 시 수동 정답 소스 사용
  const mk = MANUAL[yk] && MANUAL[yk].answers;
  if (mk) {
    const m = {};
    for (const k of Object.keys(mk)) m[+k] = mk[k];
    return { ans: m, status: "manual" };
  }
  return { ans: null, status: pdfStatus };
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
    for (const s of d[yk][cat] || []) {
      // 검사 스코프 분모 집계(§13⑮) — 실제 순회분만
      scopeSets++;
      scopeQ += (s.questions || []).length;
      scopeC += (s.questions || []).reduce(
        (a, _q) => a + (_q.choices || []).length,
        0,
      );
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
}
const nokeyTotal = Object.values(nokeyByYk).reduce((a, b) => a + b, 0);
// ── 검사 스코프 분모 + 가드 (§13⑮: 분모 없는 "0건"은 무효 신호) ──
const _dataTotalSets = Object.keys(d).reduce(
  (a, yk) =>
    a +
    ["reading", "literature"].reduce(
      (b, c) => b + ((d[yk] || {})[c] || []).length,
      0,
    ),
  0,
);
console.log(
  `검사 스코프: 세트 ${scopeSets} / 문항 ${scopeQ} / 선지 ${scopeC} → 위반 ${bad.length}건`,
);
if (scopeSets === 0) {
  console.error("🔴 SCOPE_EMPTY — 검사 대상 0건. clean 판정 무효");
  process.exit(1);
}
if (!ykFilter && scopeSets !== _dataTotalSets) {
  // 미검사 사유별 구분(§13⑮ 보완) — status: no_pdf | image_only | extract_fail | no_dir
  //   "no-PDF"로 뭉뚱그리면 원인 오도(예: 2014수능A는 PDF 존재·image-only).
  const skipped = {};
  for (const yk of Object.keys(statusByYk)) {
    const st = statusByYk[yk];
    if (st === "ok" || st === "manual") continue;
    const n = ["reading", "literature"].reduce(
      (a, c) => a + ((d[yk] || {})[c] || []).length,
      0,
    );
    if (n) (skipped[st] = skipped[st] || []).push(`${yk}(${n}세트)`);
  }
  console.warn(
    `⚠️  SCOPE_DIFF — 전수 검사 ${scopeSets} ≠ 데이터 총 ${_dataTotalSets} (미검사 ${_dataTotalSets - scopeSets}세트)`,
  );
  for (const st of Object.keys(skipped))
    console.warn(`     └ ${st}: ${skipped[st].join(", ")}`);
}
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
