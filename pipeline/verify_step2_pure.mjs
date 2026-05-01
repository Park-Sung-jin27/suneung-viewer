/**
 * pipeline/verify_step2_pure.mjs
 *
 * step2 산출물(캐시·스냅샷)에 ok/pat/analysis/cs_ids/cs_spans/vocab 잔존 여부 검증.
 * 읽기 전용 — 파일 수정 금지.
 *
 * 사용법 (PowerShell):
 *   node pipeline/verify_step2_pure.mjs                        # 모든 step2_* 파일 스캔
 *   node pipeline/verify_step2_pure.mjs --file <경로>          # 단일 파일
 *   node pipeline/verify_step2_pure.mjs --yearkey 2026수능_test # 특정 yearKey 전용
 *   node pipeline/verify_step2_pure.mjs --strict               # 잔존 1건이라도 있으면 exit 2
 *
 * 스캔 대상 파일명 패턴 (pipeline/test_data/):
 *   step2_reading_<yearKey>.json
 *   step2_literature_<yearKey>.json
 *   step2_rawparsed_<yearKey>_<section>_<ts>.json
 *   step2_postprocessed_<yearKey>_<section>_<ts>.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TEST_DATA = path.join(__dirname, "test_data");

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : null;
}
const ARG_FILE = getArg("--file");
const ARG_YEAR = getArg("--yearkey");
const STRICT = args.includes("--strict");

const FORBIDDEN_CHOICE = ["ok", "pat", "analysis", "cs_ids", "cs_spans"];
const FORBIDDEN_SET = ["vocab"];

function unwrap(content) {
  // step2_rawparsed 는 { parser_used, parsed: [sets...] } 형태
  if (content && typeof content === "object" && Array.isArray(content.parsed)) {
    return { sets: content.parsed, wrapper: "rawparsed" };
  }
  if (Array.isArray(content)) return { sets: content, wrapper: "array" };
  if (content && typeof content === "object" && (content.reading || content.literature)) {
    return {
      sets: [...(content.reading || []), ...(content.literature || [])],
      wrapper: "sectioned",
    };
  }
  return { sets: [], wrapper: "unknown" };
}

function scanFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  let content;
  try {
    content = JSON.parse(raw);
  } catch (e) {
    return { filePath, error: `JSON parse fail: ${e.message}` };
  }
  const { sets, wrapper } = unwrap(content);
  const stats = {
    sets_total: sets.length,
    choices_total: 0,
    choice_ok: 0,
    choice_pat: 0,
    choice_analysis: 0,
    choice_cs_ids: 0,
    choice_cs_spans: 0,
    set_vocab: 0,
  };
  const examples = []; // 최대 3건 위치 기록

  for (const s of sets) {
    for (const k of FORBIDDEN_SET) {
      if (k in s) {
        stats[`set_${k}`]++;
        if (examples.length < 3)
          examples.push({ where: `${s.id}.${k}`, value: JSON.stringify(s[k]).slice(0, 60) });
      }
    }
    for (const q of s.questions || []) {
      for (const c of q.choices || []) {
        stats.choices_total++;
        for (const k of FORBIDDEN_CHOICE) {
          if (k in c) {
            stats[`choice_${k}`]++;
            if (examples.length < 3)
              examples.push({
                where: `${s.id}/Q${q.id}/#${c.num}.${k}`,
                value: JSON.stringify(c[k]).slice(0, 60),
              });
          }
        }
      }
    }
  }
  const totalLeak =
    stats.choice_ok +
    stats.choice_pat +
    stats.choice_analysis +
    stats.choice_cs_ids +
    stats.choice_cs_spans +
    stats.set_vocab;
  return { filePath, wrapper, stats, totalLeak, examples };
}

function listCandidates() {
  if (ARG_FILE) return [path.resolve(ROOT, ARG_FILE)];
  if (!fs.existsSync(TEST_DATA)) return [];
  const entries = fs.readdirSync(TEST_DATA);
  let picked = entries.filter((f) =>
    /^step2_(reading|literature|rawparsed|postprocessed)_.*\.json$/.test(f),
  );
  if (ARG_YEAR) picked = picked.filter((f) => f.includes(ARG_YEAR));
  return picked.map((f) => path.join(TEST_DATA, f));
}

const files = listCandidates();
if (files.length === 0) {
  console.error("❌ 스캔 대상 파일 없음. pipeline/test_data/step2_* 파일 확인.");
  process.exit(1);
}

console.log("═".repeat(66));
console.log(" verify_step2_pure — forbidden QA fields 잔존 검증");
console.log("═".repeat(66));
console.log(`\n대상 파일 수: ${files.length}`);

let totalLeakAll = 0;
const perFile = [];
for (const fp of files) {
  const result = scanFile(fp);
  if (result.error) {
    console.warn(`⚠️  ${path.relative(ROOT, fp)} — ${result.error}`);
    continue;
  }
  perFile.push(result);
  totalLeakAll += result.totalLeak;
}

// 깨끗한 파일 먼저, 잔존 있는 파일은 자세히
const clean = perFile.filter((r) => r.totalLeak === 0);
const dirty = perFile.filter((r) => r.totalLeak > 0);

console.log(`\n[깨끗 ${clean.length} / 잔존 ${dirty.length}]\n`);

for (const r of clean.slice(0, 20)) {
  console.log(
    `  🟢 ${path.relative(ROOT, r.filePath)}  (sets=${r.stats.sets_total}, choices=${r.stats.choices_total}, leak=0)`,
  );
}
if (clean.length > 20) console.log(`  ... (+${clean.length - 20} clean files)`);

if (dirty.length > 0) {
  console.log(`\n[잔존 상세]`);
  for (const r of dirty) {
    console.log(
      `\n  🔴 ${path.relative(ROOT, r.filePath)}  [wrapper=${r.wrapper}]`,
    );
    console.log(
      `     sets=${r.stats.sets_total} choices=${r.stats.choices_total} leak=${r.totalLeak}`,
    );
    const leakDetail = [
      r.stats.choice_ok && `choice.ok=${r.stats.choice_ok}`,
      r.stats.choice_pat && `choice.pat=${r.stats.choice_pat}`,
      r.stats.choice_analysis && `choice.analysis=${r.stats.choice_analysis}`,
      r.stats.choice_cs_ids && `choice.cs_ids=${r.stats.choice_cs_ids}`,
      r.stats.choice_cs_spans && `choice.cs_spans=${r.stats.choice_cs_spans}`,
      r.stats.set_vocab && `set.vocab=${r.stats.set_vocab}`,
    ]
      .filter(Boolean)
      .join(", ");
    console.log(`     ${leakDetail}`);
    if (r.examples.length > 0) {
      console.log(`     예시:`);
      for (const ex of r.examples)
        console.log(`       - ${ex.where} = ${ex.value}`);
    }
  }
}

console.log(`\n${"─".repeat(66)}`);
console.log(
  ` 집계: 파일 ${files.length}개, 깨끗 ${clean.length}, 잔존 ${dirty.length}, leak 합 ${totalLeakAll}`,
);
if (totalLeakAll === 0) {
  console.log(" ✅ 전체 파일에서 forbidden QA 필드 0건 — step2 순수 구조화 검증 통과");
} else {
  console.log(" 🔴 forbidden 필드 잔존 — step2 sanitize 미적용 또는 재추출 필요");
}

if (STRICT && totalLeakAll > 0) process.exit(2);
