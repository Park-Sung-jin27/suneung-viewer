// passage_fidelity.mjs — 본문 대조 게이트 (read-only 진단)
// 데이터 지문(sents) ↔ 시험지 PDF 대조로 본문 교체·환각·오염 색출(r2025b Q5 환각류).
// 검증된 primitive: 한글 윈도 포함도(PUA·한자병기·『』·문장부호 무영향).
// 데이터 무수정. 임계값 = config/passage_fidelity_thresholds.json.
// 사용: node pipeline/passage_fidelity.mjs [--yk=2025수능] [--data=<경로>] [--all]
//   --data: 정본 대신 다른 all_data 경로(회귀 테스트용)
//   --all : 의심 외 전 sent 포함도도 출력(보정용)
// resolveDirs / fitz+PYTHONUTF8 추출은 answer_fidelity.mjs와 동일 규약.
import fs from "fs";
import { execSync } from "child_process";

const args = process.argv.slice(2);
const ykFilter = (args.find((a) => a.startsWith("--yk=")) || "").split("=")[1];
const dataPath =
  (args.find((a) => a.startsWith("--data=")) || "").split("=")[1] ||
  "public/data/all_data_204.json";
const showAll = args.includes("--all");

const d = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const cfg = JSON.parse(
  fs.readFileSync("config/passage_fidelity_thresholds.json", "utf8"),
);
const TH = cfg.inclusion_threshold ?? 0.85;
const WIN = cfg.window ?? 20;
const STRIDE = cfg.stride ?? 10;
const MIN = cfg.min_hangul ?? 10;
const MINEXAM = cfg.min_exam_hangul ?? 200;
const TYPES = new Set(cfg.sent_types ?? ["body", "verse"]);

// RELEASE_SET_IDS(노출 세트)를 src/dataLoader.js에서 파싱 (단일 진실, hardcode 회피)
function loadReleaseSet() {
  const ids = new Set();
  try {
    const src = fs.readFileSync("src/dataLoader.js", "utf8");
    const m = src.match(/RELEASE_SET_IDS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
    if (m)
      for (const mm of m[1].matchAll(/"([rl]\d{4,6}[a-zA-Z]?)"/g))
        ids.add(mm[1]);
  } catch {}
  return ids;
}
const RELEASE = loadReleaseSet();

// answer_fidelity.mjs 규약
function resolveDirs(yk) {
  const dirs = [];
  for (const c of [`_done/${yk}`, `_done/${yk}A`, `_done/${yk}B`])
    if (fs.existsSync(c)) dirs.push(c);
  return dirs;
}
function examTextFromPdf(yk) {
  const dirs = resolveDirs(yk);
  if (!dirs.length) return { text: null, status: "no_pdf" };
  for (const dir of dirs) {
    const hit = fs.readdirSync(dir).find((x) => x.endsWith("시험지.pdf"));
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
      return { text: null, status: "extract_fail" };
    }
    if (raw.trim().length === 0) return { text: null, status: "image_only" };
    return { text: raw, status: "ok" };
  }
  return { text: null, status: "no_pdf" };
}

const H = (s) => (s || "").replace(/[^가-힣]/g, ""); // 한글만

// 포함도: sent 한글을 WIN자 윈도(STRIDE stride)로 쪼개 시험지 한글 전체에 존재하는 비율
function inclusion(sH, examH) {
  if (sH.length < MIN) return null; // 짧은 대사·인용부호 스킵
  if (sH.length < WIN) return examH.includes(sH) ? 1 : 0;
  let total = 0,
    found = 0;
  for (let i = 0; i + WIN <= sH.length; i += STRIDE) {
    total++;
    if (examH.includes(sH.slice(i, i + WIN))) found++;
  }
  const lastStart = sH.length - WIN;
  if (lastStart % STRIDE !== 0) {
    total++;
    if (examH.includes(sH.slice(lastStart))) found++;
  }
  return total ? found / total : null;
}

const live = [],
  other = [],
  nokey = [];
for (const yk of Object.keys(d)) {
  if (ykFilter && yk !== ykFilter) continue;
  const { text, status } = examTextFromPdf(yk);
  const examH = H(text || "");
  if (examH.length < MINEXAM) {
    nokey.push(
      `${yk}: 시험지 한글 ${examH.length}자 — 미대조 (status=${status})`,
    );
    continue;
  }
  for (const cat of ["reading", "literature"])
    for (const s of d[yk][cat] || []) {
      const isLive = RELEASE.has(s.id);
      for (const sent of s.sents || []) {
        if (!TYPES.has(sent.sentType)) continue;
        const inc = inclusion(H(sent.t), examH);
        if (inc === null) continue;
        const row = { yk, setId: s.id, sentId: sent.id, inc: +inc.toFixed(3) };
        if (inc < TH) (isLive ? live : other).push(row);
      }
    }
}
live.sort((a, b) => a.inc - b.inc);
other.sort((a, b) => a.inc - b.inc);
console.log(
  `본문 의심: 라이브 ${live.length} + 비노출 ${other.length} | 미대조 yk: ${nokey.length} | 임계 포함도<${TH} | data=${dataPath}`,
);
console.log("=== 🔴 라이브(RELEASE) 세트 본문 의심 (포함도 오름차순) ===");
live.forEach((x) =>
  console.log(`  ${x.yk} ${x.setId} ${x.sentId}: 포함도=${x.inc}`),
);
console.log("=== ⚪ 비노출 세트 본문 의심 (포함도 오름차순, 최대 60) ===");
other
  .slice(0, 60)
  .forEach((x) =>
    console.log(`  ${x.yk} ${x.setId} ${x.sentId}: 포함도=${x.inc}`),
  );
console.log("=== 미대조 yk ===");
nokey.forEach((x) => console.log("  " + x));
if (showAll) console.log(`(--all: 의심만 출력, 전체 통과분 생략)`);
