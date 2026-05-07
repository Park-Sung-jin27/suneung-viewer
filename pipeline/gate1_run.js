#!/usr/bin/env node
/**
 * Gate 1 v3 CLI — Release Validator runner.
 *
 * Usage:
 *   node pipeline/gate1_run.js --year 2026수능
 *   node pipeline/gate1_run.js --year 2026수능 --section reading
 *   node pipeline/gate1_run.js --year 2026수능 --report pipeline/gate1_reports/2026수능.json
 *   node pipeline/gate1_run.js --year 2026수능 --answer-key answer_keys/2026수능.json
 *
 * Default data path: public/data/all_data_204.json (정본 [Confirmed]).
 *   override: --data <path>  또는  $SUNEUNG_DATA_PATH
 *
 * Exit codes:
 *   0 = all sets passed (errors === 0)
 *   1 = at least one set has errors
 *   2 = invocation error (bad args / missing files / no sets matched)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { validateSet } = require('./gate1_validate');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);

  const dataPath =
    args.data ||
    process.env.SUNEUNG_DATA_PATH ||
    path.resolve(__dirname, '../public/data/all_data_204.json');

  const year = args.year;
  if (!year) {
    console.error('ERROR: --year required (e.g., --year 2026수능)');
    process.exit(2);
  }

  // section validation — silent pass 차단
  const sectionFilter = args.section;
  if (sectionFilter && sectionFilter !== 'reading' && sectionFilter !== 'literature') {
    console.error(`ERROR: --section must be 'reading' or 'literature' (got: ${sectionFilter})`);
    process.exit(2);
  }

  const answerKeyPath = args['answer-key'];
  const reportPath = args.report;

  if (!fs.existsSync(dataPath)) {
    console.error(`ERROR: data file not found: ${dataPath}`);
    process.exit(2);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const yearData = data[year];
  if (!yearData) {
    console.error(`ERROR: year not found in data: ${year}`);
    console.error(`Available years: ${Object.keys(data).join(', ')}`);
    process.exit(2);
  }

  let answerKey = null;
  if (answerKeyPath) {
    if (!fs.existsSync(answerKeyPath)) {
      console.error(`ERROR: answer key not found: ${answerKeyPath}`);
      process.exit(2);
    }
    answerKey = JSON.parse(fs.readFileSync(answerKeyPath, 'utf8'));
  }

  const sections = sectionFilter ? [sectionFilter] : ['reading', 'literature'];

  const report = {
    year,
    dataPath,
    answerKeyPath: answerKeyPath || null,
    runAt: new Date().toISOString(),
    sets: [],
    summary: {
      totalSets: 0,
      passedSets: 0,
      failedSets: 0,
      totalErrors: 0,
      totalWarnings: 0,
      totalNeedsHuman: 0,
      patZeroSets: 0,
      patZeroChoices: 0,
      errorCodeCounts: {},
      warningCodeCounts: {},
    },
  };

  for (const section of sections) {
    const arr = yearData[section];
    if (!Array.isArray(arr)) continue;

    for (const set of arr) {
      const setAnswerKey = answerKey
        ? answerKey[set.id] || answerKey[`${year}/${set.id}`]
        : null;
      const result = validateSet(set, { section, answerKey: setAnswerKey });

      report.sets.push({
        section,
        setId: set.id,
        title: set.title,
        range: set.range,
        passed: result.passed,
        inferredBase: result.inferredBase,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        needsHumanCount: result.needsHuman.length,
        stats: result.stats,
        errors: result.errors,
        warnings: result.warnings,
        needsHuman: result.needsHuman,
      });

      report.summary.totalSets++;
      if (result.passed) report.summary.passedSets++;
      else report.summary.failedSets++;
      report.summary.totalErrors += result.errors.length;
      report.summary.totalWarnings += result.warnings.length;
      report.summary.totalNeedsHuman += result.needsHuman.length;
      if (result.stats.pat_zero_count > 0) {
        report.summary.patZeroSets++;
        report.summary.patZeroChoices += result.stats.pat_zero_count;
      }

      for (const e of result.errors) {
        report.summary.errorCodeCounts[e.code] =
          (report.summary.errorCodeCounts[e.code] || 0) + 1;
      }
      for (const w of result.warnings) {
        report.summary.warningCodeCounts[w.code] =
          (report.summary.warningCodeCounts[w.code] || 0) + 1;
      }
    }
  }

  if (report.summary.totalSets === 0) {
    console.error(`ERROR: no sets matched (year=${year}, section=${sectionFilter || 'all'})`);
    process.exit(2);
  }

  // ── stdout 요약 ──
  console.log(`\n=== Gate 1 v3 — ${year} ===`);
  console.log(`source: ${dataPath}\n`);

  for (const s of report.sets) {
    const tag = s.passed ? 'PASS' : 'FAIL';
    const baseTag = s.inferredBase && s.inferredBase !== s.setId
      ? ` [base=${s.inferredBase}]` : '';
    console.log(
      `[${tag}] ${s.section}/${s.setId}${baseTag} ${s.range || ''}  ` +
        `e=${s.errorCount} w=${s.warningCount} nh=${s.needsHumanCount}  ` +
        `(sents=${s.stats.sents}, q=${s.stats.questions}, ` +
        `cs_filled=${s.stats.cs_ids_filled}/${s.stats.choices}, pat0=${s.stats.pat_zero_count})`
    );
    if (!s.passed) {
      for (const e of s.errors.slice(0, 5)) {
        const ctx = Object.entries(e)
          .filter(([k]) => !['severity', 'code'].includes(k))
          .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join(' ');
        console.log(`       └─ ${e.code}  ${ctx}`);
      }
      if (s.errors.length > 5) {
        console.log(`       └─ ... +${s.errors.length - 5} more`);
      }
    }
  }

  console.log(
    `\nSummary: ${report.summary.passedSets}/${report.summary.totalSets} sets passed | ` +
      `errors=${report.summary.totalErrors} warnings=${report.summary.totalWarnings} ` +
      `needs_human=${report.summary.totalNeedsHuman} | ` +
      `pat0=${report.summary.patZeroChoices} (in ${report.summary.patZeroSets} sets)`
  );

  const topE = Object.entries(report.summary.errorCodeCounts).sort((a, b) => b[1] - a[1]);
  if (topE.length) {
    console.log('\nTop error codes:');
    for (const [c, n] of topE.slice(0, 10)) console.log(`  ${String(n).padStart(4)} × ${c}`);
  }
  const topW = Object.entries(report.summary.warningCodeCounts).sort((a, b) => b[1] - a[1]);
  if (topW.length) {
    console.log('\nTop warning codes:');
    for (const [c, n] of topW.slice(0, 10)) console.log(`  ${String(n).padStart(4)} × ${c}`);
  }

  if (reportPath) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nReport written: ${reportPath}`);
  }

  process.exit(report.summary.failedSets === 0 ? 0 : 1);
}

main();
