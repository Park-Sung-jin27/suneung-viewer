/**
 * pipeline/pat_rule_audit.mjs — pat 규칙 정합 자동 검출
 *
 * 실행:
 *   node pipeline/pat_rule_audit.mjs                  → 전체 리포트
 *   node pipeline/pat_rule_audit.mjs --scope=suneung5  → 5개년 수능만
 *   node pipeline/pat_rule_audit.mjs --year=2025수능   → 특정 연도
 *
 * 검출 규칙:
 *   PAT_TRUE_HAS_PAT  — ok=true 인데 pat 존재 (null 이어야 함)
 *   PAT_FALSE_MISSING — ok=false 인데 pat=null (오류 패턴 분류 의무)
 *   PAT_INVALID_TYPE  — pat 값이 유효 집합 외 (예: 숫자 0) — CRITICAL
 *
 * 사용 (다른 도구 안 import):
 *   import { auditPatRules } from './pat_rule_audit.mjs';
 *   const findings = auditPatRules(data, { years: ['2025수능'] });
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DATA_PATH = path.join(
  __dirname,
  "../public/data/all_data_204.json",
);

const SUNEUNG5 = ["2022수능", "2023수능", "2024수능", "2025수능", "2026수능"];

const VALID_PAT_SET = new Set([
  "R1", "R2", "R3", "R4",
  "L1", "L2", "L3", "L4", "L5",
  "V",
]);

// ─── isMain guard ─────────────────────────────────────────────────────────────

const argv1 = (process.argv[1] || "").replace(/\\/g, "/");
const isMain = argv1.endsWith("pat_rule_audit.mjs");

// ─── core audit function (pure) ───────────────────────────────────────────────

/**
 * pat 규칙 정합 검사.
 * @param {object} data  all_data_204.json 전체 (또는 일부)
 * @param {object} options
 * @param {string[]|null} options.years  연도 필터 (null = 전체)
 * @returns {{ code, severity, yearKey, setId, domain, qId, choiceNum, ok, pat, msg }[]}
 */
export function auditPatRules(data, options = {}) {
  const { years = null } = options;
  const findings = [];

  for (const [yearKey, yearObj] of Object.entries(data)) {
    if (typeof yearObj !== "object" || Array.isArray(yearObj)) continue;
    if (years && !years.includes(yearKey)) continue;

    for (const domain of ["reading", "literature"]) {
      const sets = yearObj[domain];
      if (!Array.isArray(sets)) continue;

      for (const set of sets) {
        for (const q of set.questions ?? []) {
          for (const c of q.choices ?? []) {
            const loc = `${yearKey}/${set.id}/Q${q.id}/ch${c.num}`;

            // 위반 1: ok=true 인데 pat 있음
            if (c.ok === true && c.pat !== null && c.pat !== undefined) {
              findings.push({
                code: "PAT_TRUE_HAS_PAT",
                severity: "WARNING",
                yearKey,
                setId: set.id,
                domain,
                qId: q.id,
                choiceNum: c.num,
                ok: c.ok,
                pat: c.pat,
                msg: `${loc}: ok=true 인데 pat="${c.pat}" (null 이어야 함)`,
              });
            }

            // 위반 2: ok=false 인데 pat=null
            if (c.ok === false && (c.pat === null || c.pat === undefined)) {
              findings.push({
                code: "PAT_FALSE_MISSING",
                severity: "WARNING",
                yearKey,
                setId: set.id,
                domain,
                qId: q.id,
                choiceNum: c.num,
                ok: c.ok,
                pat: c.pat ?? null,
                msg: `${loc}: ok=false 인데 pat=null (오류 패턴 분류 의무)`,
              });
            }

            // 위반 3: pat 값이 유효 집합 외 (예: 숫자 0)
            if (
              c.pat !== null &&
              c.pat !== undefined &&
              !VALID_PAT_SET.has(c.pat)
            ) {
              findings.push({
                code: "PAT_INVALID_TYPE",
                severity: "CRITICAL",
                yearKey,
                setId: set.id,
                domain,
                qId: q.id,
                choiceNum: c.num,
                ok: c.ok,
                pat: c.pat,
                msg: `${loc}: pat=${JSON.stringify(c.pat)} — 유효 집합(R1~R4/L1~L5/V) 외 값`,
              });
            }
          }
        }
      }
    }
  }

  return findings;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (isMain) {
  const args = process.argv.slice(2);
  const scopeArg = args.find((a) => a.startsWith("--scope="))?.slice(8) ?? null;
  const yearArg = args.find((a) => a.startsWith("--year="))?.slice(7) ?? null;

  let years = null;
  if (scopeArg === "suneung5") {
    years = SUNEUNG5;
  } else if (yearArg) {
    years = [yearArg];
  }

  const data = JSON.parse(fs.readFileSync(DEFAULT_DATA_PATH, "utf8"));
  const findings = auditPatRules(data, { years });

  const byCode = {};
  for (const f of findings) {
    byCode[f.code] = (byCode[f.code] || 0) + 1;
  }

  const sep = "═".repeat(60);
  const dash = "─".repeat(60);
  const scopeLabel = scopeArg
    ? `--scope=${scopeArg}`
    : yearArg
      ? `--year=${yearArg}`
      : "전체";

  console.log("");
  console.log(sep);
  console.log(` pat_rule_audit — PAT 규칙 정합 검사 [${scopeLabel}]`);
  console.log(sep);
  console.log("");
  console.log("[ 위반 종류 ]");
  console.log(
    `  PAT_TRUE_HAS_PAT  : ${byCode.PAT_TRUE_HAS_PAT ?? 0}건  (ok=true + pat 존재)`,
  );
  console.log(
    `  PAT_FALSE_MISSING : ${byCode.PAT_FALSE_MISSING ?? 0}건  (ok=false + pat=null)`,
  );
  console.log(
    `  PAT_INVALID_TYPE  : ${byCode.PAT_INVALID_TYPE ?? 0}건  (유효 집합 외 pat 값) [CRITICAL]`,
  );
  console.log(`  합계              : ${findings.length}건`);

  if (findings.length > 0) {
    console.log("\n[ 위반 목록 (최대 30건) ]");
    for (const f of findings.slice(0, 30)) {
      const icon = f.severity === "WARNING" ? "🟡" : "🔴";
      console.log(`  ${icon} [${f.code}] ${f.msg}`);
    }
    if (findings.length > 30) {
      console.log(`  ... ${findings.length - 30}건 생략`);
    }
  }

  console.log("");
  console.log(dash);

  const v1 = byCode.PAT_TRUE_HAS_PAT ?? 0;
  const v2 = byCode.PAT_FALSE_MISSING ?? 0;
  const v3 = byCode.PAT_INVALID_TYPE ?? 0;

  if (v1 === 0 && v2 === 0 && v3 === 0) {
    console.log("✅ pat_rule_audit PASS — 위반 0건");
  } else {
    if (v1 > 0)
      console.log(
        `🟡 PAT_TRUE_HAS_PAT ${v1}건 — ok:true 인데 pat 존재 (quality_gate --fix 로 자동 정정 가능)`,
      );
    if (v2 > 0)
      console.log(
        `🟡 PAT_FALSE_MISSING ${v2}건 — ok:false 인데 pat=null (수동 분류 의무)`,
      );
    if (v3 > 0)
      console.log(
        `🔴 PAT_INVALID_TYPE ${v3}건 — 유효 집합(R1~R4/L1~L5/V) 외 pat 값 (수동 정정 의무)`,
      );
  }
  console.log(sep);
  console.log("");
}
