import fs from "fs";

const goldPath = "config/d_engine_gold_samples_phase1.json";
const resultPath = process.argv[2];

if (!resultPath) {
  console.error("Usage: node config/gate1_compare_latest.mjs <dryrun_results.json>");
  process.exit(1);
}

const gold = JSON.parse(fs.readFileSync(goldPath, "utf8"));
const results = JSON.parse(fs.readFileSync(resultPath, "utf8"));

const samples = gold.samples || [];
const resultMap = new Map();

const resultArr = results.results || results.samples || (Array.isArray(results) ? results : []);
for (const r of resultArr) {
  if (!r.sample_id) continue;
  resultMap.set(r.sample_id, r);
}

const rows = [];

for (const s of samples) {
  const expected = s.expected_output;
  const actual = resultMap.get(s.sample_id);

  if (!actual) {
    rows.push({
      sample_id: s.sample_id,
      status: "MISSING_RESULT",
      expected_error_type: expected?.error_type ?? null,
      actual_error_type: null,
      expected_pass: expected?.pass ?? null,
      actual_pass: null,
      expected_rule_hits: expected?.rule_hits || [],
      actual_rule_hits: [],
      severity: "critical"
    });
    continue;
  }

  const passMatch = actual.pass === expected.pass;
  const errorMatch = actual.error_type === expected.error_type;

  const expectedRules = new Set(expected.rule_hits || []);
  const actualRules = new Set(actual.rule_hits || []);

  // === 정정 v2: variants 경로 fallback (sibling 우선, expected_output 내부 fallback) ===
  const expectedVariants =
    s.intent_validation?.acceptable_rule_hits_variants ||
    expected.acceptable_rule_hits_variants ||
    [];

  let ruleMatch = true;

  if (expectedVariants.length > 0) {
    ruleMatch = expectedVariants.some(v => {
      const vv = new Set(v);
      return vv.size === actualRules.size && [...vv].every(x => actualRules.has(x));
    });
  } else {
    ruleMatch =
      expectedRules.size === actualRules.size &&
      [...expectedRules].every(x => actualRules.has(x));
  }

  const fullMatch = passMatch && errorMatch && ruleMatch;
  const acceptable = passMatch && errorMatch;

  rows.push({
    sample_id: s.sample_id,
    status: fullMatch ? "FULL_MATCH" : acceptable ? "ACCEPTABLE_RULE_DIVERGENCE" : "MISMATCH",
    expected_pass: expected.pass,
    actual_pass: actual.pass,
    expected_error_type: expected.error_type,
    actual_error_type: actual.error_type,
    expected_rule_hits: expected.rule_hits || [],
    actual_rule_hits: actual.rule_hits || [],
    confidence: actual.confidence || null,
    reason: actual.reason || ""
  });
}

const total = rows.length;
const full = rows.filter(r => r.status === "FULL_MATCH").length;
const acceptable = rows.filter(r =>
  r.status === "FULL_MATCH" || r.status === "ACCEPTABLE_RULE_DIVERGENCE"
).length;
const mismatchRows = rows.filter(r => r.status === "MISMATCH" || r.status === "MISSING_RESULT");

const acceptableRate = total ? Math.round((acceptable / total) * 100) : 0;

let gateStatus;
if (acceptableRate >= 85) gateStatus = "TARGET_PASS";
else if (acceptableRate >= 80) gateStatus = "PROVISIONAL_PASS";
else if (acceptableRate >= 70) gateStatus = "LIMITED_PASS_TOP5_REVIEW";
else gateStatus = "STOP";

const top5 = mismatchRows
  .filter(r =>
    (r.status === "MISMATCH" || r.status === "MISSING_RESULT") &&
    (r.expected_error_type !== r.actual_error_type ||
     r.expected_pass !== r.actual_pass)
  )
  .slice(0, 5);

const report = {
  generated_at: new Date().toISOString(),
  gold_path: goldPath,
  result_path: resultPath,
  total_samples: total,
  full_match_count: full,
  acceptable_count: acceptable,
  mismatch_count: mismatchRows.length,
  acceptable_rate: acceptableRate,
  gate_status: gateStatus,
  rows
};

fs.writeFileSync("config/gate1_compare_report.json", JSON.stringify(report, null, 2));
fs.writeFileSync("config/gate1_mismatch_top5.json", JSON.stringify(top5, null, 2));

console.log(JSON.stringify({
  total_samples: total,
  full_match_count: full,
  acceptable_count: acceptable,
  mismatch_count: mismatchRows.length,
  acceptable_rate: acceptableRate,
  gate_status: gateStatus,
  outputs: [
    "config/gate1_compare_report.json",
    "config/gate1_mismatch_top5.json"
  ]
}, null, 2));
