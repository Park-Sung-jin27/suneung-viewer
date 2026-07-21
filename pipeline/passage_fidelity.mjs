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

// RELEASE_KEYS(출시 세트, 복합키 yearKey::setId)를 src/dataLoader.js에서 파싱
//   (단일 진실, hardcode 회피). 구 RELEASE_SET_IDS(setId 단독)는 폐기됨 — 복합키만 정본.
//   setId 단독 판정은 collision(2014~2016 A/B 공유)·rename으로 라이브를 비노출로 오분류함.
function loadReleaseSet() {
  const keys = new Set();
  try {
    const src = fs.readFileSync("src/dataLoader.js", "utf8");
    const m = src.match(/RELEASE_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
    if (m) for (const mm of m[1].matchAll(/"([^"]+::[^"]+)"/g)) keys.add(mm[1]);
  } catch {}
  return keys;
}
const RELEASE = loadReleaseSet();
let scopeSets = 0,
  scopeLive = 0,
  scopeSents = 0; // 검사 스코프 분모(§13⑮)

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
//   반환 {r, broken}: r=비율(기존 임계 판정), broken=미발견 윈도 수(절대 기준 판정).
//   비율만으로는 긴 문장을 못 잡는다 — 1점 변조는 길이와 무관하게 윈도 2개만 깨뜨리므로
//   문장이 길수록 분모만 커져 임계 위로 떠오른다(한글 133자↑ 구조적 미검출, 실증 130자 경계).
//   임계·윈도·stride 수치 조정으로는 닫히지 않아(비율 판정식 자체의 성질) broken을 병행 노출.
function inclusion(sH, examH) {
  if (sH.length < MIN) return null; // 짧은 대사·인용부호 스킵
  if (sH.length < WIN) {
    const hit = examH.includes(sH);
    return { r: hit ? 1 : 0, broken: hit ? 0 : 1 };
  }
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
  return total ? { r: found / total, broken: total - found } : null;
}

const ABS = cfg.absolute_broken_warn ?? 0; // 0 = 절대 기준 비활성
const live = [],
  other = [],
  absLive = [], // 비율은 통과했으나 미발견 윈도 ≥ ABS (길이 사각 — WARNING)
  absOther = [],
  nokey = [];
const skipStatus = {}; // 미검사 yk → 사유(§13⑮ 보완)
for (const yk of Object.keys(d)) {
  if (ykFilter && yk !== ykFilter) continue;
  const { text, status } = examTextFromPdf(yk);
  const examH = H(text || "");
  if (examH.length < MINEXAM) {
    // 미검사 사유 추적(§13⑮ 보완): status=ok인데 한글 부족 = image_only(PDF는 존재)
    skipStatus[yk] = status === "ok" ? "image_only(추출<임계)" : status;
    nokey.push(
      `${yk}: 시험지 한글 ${examH.length}자 — 미대조 (status=${status})`,
    );
    continue;
  }
  for (const cat of ["reading", "literature"])
    for (const s of d[yk][cat] || []) {
      const isLive = RELEASE.has(yk + "::" + s.id);
      // 검사 스코프 분모 집계(§13⑮)
      scopeSets++;
      if (isLive) scopeLive++;
      scopeSents += (s.sents || []).filter((x) => TYPES.has(x.sentType)).length;
      for (const sent of s.sents || []) {
        if (!TYPES.has(sent.sentType)) continue;
        const res = inclusion(H(sent.t), examH);
        if (res === null) continue;
        const row = {
          yk,
          setId: s.id,
          sentId: sent.id,
          inc: +res.r.toFixed(3),
          broken: res.broken,
          len: H(sent.t).length,
        };
        if (res.r < TH) (isLive ? live : other).push(row);
        else if (ABS && res.broken >= ABS)
          (isLive ? absLive : absOther).push(row);
      }
    }
}
live.sort((a, b) => a.inc - b.inc);
other.sort((a, b) => a.inc - b.inc);
// 포함도 0 = 시험지에 한 윈도도 안 잡힘 = 교체/환각이거나 옛한글/고전시가 추출 mismatch.
//   게이트가 자동 판별 불가(맹점) → UNVERIFIABLE_OLDHANGUL: 수동 직독 필요로 플래그.
const liveZero = live.filter((x) => x.inc === 0);
// ── 검사 스코프 분모 + 가드 (§13⑮·§13⑫ 재발 차단) ──
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
  `검사 스코프: 세트 ${scopeSets}(LIVE ${scopeLive}) / 본문sent ${scopeSents} → 위반 ${live.length + other.length}건`,
);
if (scopeSets === 0) {
  console.error("🔴 SCOPE_EMPTY — 검사 대상 0건. clean 판정 무효");
  process.exit(1);
}
if (scopeLive === 0 && RELEASE.size > 0) {
  console.error(
    `🔴 SCOPE_MISMATCH — LIVE 검사 0 ≠ RELEASE_KEYS ${RELEASE.size} (§13⑫ 스코프 붕괴)`,
  );
  process.exit(1);
}
if (!ykFilter && scopeLive !== RELEASE.size)
  console.warn(
    `⚠️  SCOPE_LIVE_GAP — LIVE 검사 ${scopeLive} ≠ RELEASE_KEYS ${RELEASE.size} (미검사 LIVE ${RELEASE.size - scopeLive}세트)`,
  );
if (!ykFilter && scopeSets !== _dataTotalSets)
  console.warn(
    `⚠️  SCOPE_DIFF — 전수 검사 ${scopeSets} ≠ 데이터 총 ${_dataTotalSets} (미검사 ${_dataTotalSets - scopeSets}세트)`,
  );
// 미검사 사유별 구분(§13⑮ 보완) — "no-PDF"로 뭉뚱그리면 원인 오도
for (const yk of Object.keys(skipStatus)) {
  const n = ["reading", "literature"].reduce(
    (a, c) => a + ((d[yk] || {})[c] || []).length,
    0,
  );
  const liveN = ["reading", "literature"].reduce(
    (a, c) =>
      a +
      (((d[yk] || {})[c] || []).filter((s) => RELEASE.has(yk + "::" + s.id))
        .length || 0),
    0,
  );
  if (n)
    console.warn(
      `     └ ${skipStatus[yk]}: ${yk}(${n}세트${liveN ? `, LIVE ${liveN}` : ""})`,
    );
}
console.log(
  `본문 의심: 라이브 ${live.length}(그중 포함도0=UNVERIFIABLE ${liveZero.length}) + 비노출 ${other.length} | 미대조 yk: ${nokey.length} | 임계 포함도<${TH} | data=${dataPath}`,
);
if (liveZero.length)
  console.log(
    `=== ⚠️ UNVERIFIABLE_OLDHANGUL (라이브·포함도 0 — 수동 PDF 직독 필요, 게이트 자동판별 불가) ${liveZero.length}건 ===`,
  );
liveZero.forEach((x) =>
  console.log(`  ⚠️ ${x.yk} ${x.setId} ${x.sentId}: 포함도=0 → 직독 요`),
);
console.log("=== 🔴 라이브(RELEASE) 세트 본문 의심 (포함도 오름차순) ===");
live.forEach((x) =>
  console.log(
    `  ${x.yk} ${x.setId} ${x.sentId}: 포함도=${x.inc}${x.inc === 0 ? " ⚠️UNVERIFIABLE" : ""}`,
  ),
);
console.log("=== ⚪ 비노출 세트 본문 의심 (포함도 오름차순, 최대 60) ===");
other
  .slice(0, 60)
  .forEach((x) =>
    console.log(`  ${x.yk} ${x.setId} ${x.sentId}: 포함도=${x.inc}`),
  );
if (other.length > 60)
  console.log(`  … 외 ${other.length - 60}건 (표시 절단 — 전량은 아님)`);
// ── 절대 기준(WARNING) — 비율은 통과했으나 미발견 윈도가 있는 sent ──
//   긴 문장 사각 전용. 결함 확정이 아니라 후보(시험지 추출 artifact도 섞임).
if (ABS) {
  console.log(
    `=== 🟡 W_window_broken (미발견 윈도 ≥ ${ABS} · 비율은 통과 — 길이 사각) 라이브 ${absLive.length} + 비노출 ${absOther.length} ===`,
  );
  absLive
    .sort((a, b) => b.broken - a.broken || b.len - a.len)
    .forEach((x) =>
      console.log(
        `  🟡 ${x.yk} ${x.setId} ${x.sentId}: ${x.len}자 · 포함도=${x.inc} · 미발견 윈도 ${x.broken}`,
      ),
    );
  absOther
    .sort((a, b) => b.broken - a.broken || b.len - a.len)
    .slice(0, 30)
    .forEach((x) =>
      console.log(
        `  ⚪ ${x.yk} ${x.setId} ${x.sentId}: ${x.len}자 · 포함도=${x.inc} · 미발견 윈도 ${x.broken}`,
      ),
    );
  if (absOther.length > 30)
    console.log(`  … 외 ${absOther.length - 30}건 (표시 절단)`);
}
console.log("=== 미대조 yk ===");
nokey.forEach((x) => console.log("  " + x));
if (showAll) console.log(`(--all: 의심만 출력, 전체 통과분 생략)`);
