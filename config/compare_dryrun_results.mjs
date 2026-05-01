#!/usr/bin/env node
/**
 * compare_dryrun_results.mjs
 *
 * D엔진 dry-run 결과와 Gold expected를 비교하여
 * 엔진 문제 / 샘플 문제 / 둘 다 애매로 분류.
 *
 * 사용법:
 *   node compare_dryrun_results.mjs <gold_json> <actual_results_json>
 *
 * actual_results_json 형식:
 *   { "gold_R1_001": { "pass": ..., "error_type": ..., "rule_hits": [...], "confidence": ... }, ... }
 */

import { readFileSync } from 'fs';

function classifyDiff(expected, actual, intent) {
  const diffs = [];

  // 1. pass 일치
  if (expected.pass !== actual.pass) {
    diffs.push({ field: 'pass', expected: expected.pass, actual: actual.pass });
  }

  // 2. error_type 일치
  if (expected.error_type !== actual.error_type) {
    diffs.push({ field: 'error_type', expected: expected.error_type, actual: actual.error_type });
  }

  // 3. rule_hits 부분 일치 허용 (expected ⊆ actual 또는 actual ⊆ expected)
  const expectedSet = new Set(expected.rule_hits || []);
  const actualSet = new Set(actual.rule_hits || []);
  const intersection = [...expectedSet].filter(x => actualSet.has(x));
  const onlyExpected = [...expectedSet].filter(x => !actualSet.has(x));
  const onlyActual = [...actualSet].filter(x => !expectedSet.has(x));

  let ruleHitsStatus = 'match';
  if (expectedSet.size === 0 && actualSet.size === 0) {
    ruleHitsStatus = 'match';
  } else if (intersection.length === 0) {
    ruleHitsStatus = 'total_mismatch';
  } else if (onlyExpected.length > 0 || onlyActual.length > 0) {
    ruleHitsStatus = 'partial';
  }

  // owner 분류
  let owner = 'unknown';
  let diff_type = 'UNKNOWN';

  const passMatch = expected.pass === actual.pass;
  const errorTypeMatch = expected.error_type === actual.error_type;

  // forbidden_alternatives 체크
  const hitForbidden = intent?.forbidden_alternatives?.includes(actual.error_type);

  if (passMatch && errorTypeMatch && ruleHitsStatus === 'match') {
    diff_type = 'FULL_MATCH';
    owner = 'none';
  } else if (!passMatch) {
    // pass 뒤바뀜 - 심각
    if (expected.pass === true && actual.pass === false) {
      diff_type = 'OVERFAIL';  // 정상 샘플을 fail로 판정
      owner = 'engine';  // D엔진 문제 유력
    } else {
      diff_type = 'MISSED_FAIL';  // 문제 샘플을 pass로 판정
      owner = 'engine';  // D엔진 감지 실패
    }
  } else if (!errorTypeMatch && hitForbidden) {
    // forbidden_alternative로 튐
    // 주의: forbidden_alternative는 "이 error_type이 나오면 안 된다"는 지표이지,
    //       "샘플 문제다"의 증거가 아님. 엔진 문제일 수도, 샘플 문제일 수도 있음.
    diff_type = 'FORBIDDEN_ALTERNATIVE';
    owner = 'pending';  // 사람 판단 필요
  } else if (!errorTypeMatch) {
    diff_type = 'ERROR_TYPE_MISMATCH';
    owner = 'sample_or_engine_pending';  // 사람 확인 필요
  } else if (ruleHitsStatus === 'partial' || ruleHitsStatus === 'total_mismatch') {
    diff_type = 'RULE_HITS_DIVERGENCE';
    owner = 'acceptable';  // rule_hits 부분 불일치는 허용 범위
    if (ruleHitsStatus === 'total_mismatch') {
      owner = 'sample_or_engine_pending';
    }
  }

  return {
    diff_type,
    owner,
    diffs,
    rule_hits_status: ruleHitsStatus,
    hit_forbidden: hitForbidden || false,
  };
}

function main() {
  const goldPath = process.argv[2];
  const actualPath = process.argv[3];

  if (!goldPath || !actualPath) {
    console.error('Usage: node compare_dryrun_results.mjs <gold_json> <actual_results_json>');
    process.exit(1);
  }

  const gold = JSON.parse(readFileSync(goldPath, 'utf-8'));
  const actual = JSON.parse(readFileSync(actualPath, 'utf-8'));

  const report = [];
  const summary = {
    total: 0,
    full_match: 0,
    overfail: 0,
    missed_fail: 0,
    forbidden_alternative: 0,
    error_type_mismatch: 0,
    rule_hits_divergence: 0,
    owner_engine: 0,
    owner_sample: 0,
    owner_pending: 0,
    owner_acceptable: 0,
    owner_none: 0,
  };

  for (const sample of gold.samples) {
    const sid = sample.sample_id;
    const expected = sample.expected_output;
    const intent = sample.intent_validation;
    const actualResult = actual[sid];

    summary.total += 1;

    if (!actualResult) {
      report.push({
        sample_id: sid,
        diff_type: 'NO_RESULT',
        owner: 'pending',
      });
      continue;
    }

    const result = classifyDiff(expected, actualResult, intent);

    // 카운트
    summary[result.diff_type.toLowerCase()] = (summary[result.diff_type.toLowerCase()] || 0) + 1;
    summary[`owner_${result.owner}`] = (summary[`owner_${result.owner}`] || 0) + 1;

    report.push({
      sample_id: sid,
      target_failure_mode: intent?.target_failure_mode,
      expected: {
        pass: expected.pass,
        error_type: expected.error_type,
        rule_hits: expected.rule_hits,
      },
      actual: {
        pass: actualResult.pass,
        error_type: actualResult.error_type,
        rule_hits: actualResult.rule_hits,
        confidence: actualResult.confidence,
      },
      diff_type: result.diff_type,
      owner: result.owner,
      hit_forbidden: result.hit_forbidden,
      rule_hits_status: result.rule_hits_status,
    });
  }

  const output = {
    summary,
    report,
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
