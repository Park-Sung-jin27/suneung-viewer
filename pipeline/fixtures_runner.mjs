/**
 * pipeline/fixtures_runner.mjs — Pipeline v2 fixture 검증 도구
 *
 * 실행:
 *   node pipeline/fixtures_runner.mjs
 *
 * 역할:
 *   visual_pipeline_v1.json 안 10건 fixture 를 bracket_audit / step2_vNext 로 실행.
 *   expected 기준과 비교 → PASS / FAIL / PENDING_TOOL 분류 출력.
 *
 * Phase 3 진입 기준:
 *   FAIL 0건 (PENDING_TOOL 은 미구현 rule — Phase 3 진입 이전 구현 의무)
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { auditBrackets } from "./bracket_audit.mjs";
import { runDetection } from "./step2_postprocess_vNext.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── helpers ──────────────────────────────────────────────────────────────────

/** step2_vNext 가 export 하지 않는 iterateSets 의 로컬 복사본 */
function iterateSetsLocal(data) {
  const results = [];
  for (const [yearKey, yearObj] of Object.entries(data)) {
    if (typeof yearObj !== "object" || Array.isArray(yearObj)) continue;
    for (const domain of ["reading", "literature"]) {
      const sets = yearObj[domain];
      if (!Array.isArray(sets)) continue;
      for (const set of sets) {
        results.push({ yearKey, set });
      }
    }
  }
  return results;
}

// ─── load fixtures ────────────────────────────────────────────────────────────

const fixtures = JSON.parse(
  readFileSync(
    path.join(__dirname, "fixtures/visual_pipeline_v1.json"),
    "utf8",
  ),
);

// ─── run ──────────────────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;
let pendingCount = 0;
const results = [];

for (const fx of fixtures) {
  // PENDING_TOOL: rule 미구현 → skip 실행
  if (fx.pending_tool) {
    results.push({
      id: fx.id,
      status: "PENDING_TOOL",
      description: fx.description,
      detail: `미구현 rule: ${fx.expected.finding_code}`,
    });
    pendingCount++;
    continue;
  }

  // ── 도구 실행 ──────────────────────────────────────────────────────────────
  let findings = [];
  let migrationPlans = [];

  if (fx.tool === "bracket_audit") {
    const years = Object.keys(fx.data);
    findings = auditBrackets(fx.data, fx.annotations, { years });
  } else if (fx.tool === "step2_vNext") {
    const targetSets = iterateSetsLocal(fx.data);
    const det = runDetection(fx.data, fx.annotations, targetSets, null);
    findings = det.findings;
    migrationPlans = det.migrationPlans;
  }

  // ── expected 검증 ──────────────────────────────────────────────────────────
  const exp = fx.expected;
  let ok = true;
  let detail = "";

  if (exp.expect_no_findings) {
    // 부정 테스트: finding_code 가 결과에 없어야 함
    const hit = findings.find((f) => f.code === exp.no_finding_code);
    if (hit) {
      ok = false;
      detail = `예상치 않은 ${exp.no_finding_code} 발생 (setId=${hit.setId})`;
    } else {
      detail = `${exp.no_finding_code} 미발생 ✓`;
    }
  } else {
    // 긍정 테스트: finding_code 가 결과에 있어야 함
    const hit = findings.find((f) => f.code === exp.finding_code);
    if (!hit) {
      ok = false;
      detail = `${exp.finding_code} 미발생 (전체 findings: ${findings.map((f) => f.code).join(", ") || "없음"})`;
    } else {
      // severity 검증
      if (exp.severity && hit.severity !== exp.severity) {
        ok = false;
        detail = `severity 불일치: expected=${exp.severity}, actual=${hit.severity}`;
      }
      // family 검증
      if (ok && exp.family && hit.family !== exp.family) {
        ok = false;
        detail = `family 불일치: expected=${exp.family}, actual=${hit.family}`;
      }
      // safeToApply 검증 (migrationPlan)
      if (ok && exp.safeToApply !== undefined) {
        const plan = migrationPlans.find((p) => p.oldSentId === hit.sentId);
        if (!plan) {
          ok = false;
          detail = `migrationPlan(oldSentId=${hit.sentId}) 없음`;
        } else if (plan.safeToApply !== exp.safeToApply) {
          ok = false;
          detail = `safeToApply 불일치: expected=${exp.safeToApply}, actual=${plan.safeToApply}`;
        } else if (
          exp.safeToApply_reason_contains &&
          !plan.safeToApply_reason.includes(exp.safeToApply_reason_contains)
        ) {
          ok = false;
          detail = `safeToApply_reason 에 "${exp.safeToApply_reason_contains}" 없음: "${plan.safeToApply_reason}"`;
        } else {
          detail = `${exp.finding_code} ✓  safeToApply=${exp.safeToApply} ✓`;
        }
      }
      // suggested 검증
      if (ok && exp.suggested_sentFrom) {
        if (
          !hit.suggested ||
          hit.suggested.sentFrom !== exp.suggested_sentFrom
        ) {
          ok = false;
          detail = `suggested.sentFrom 불일치: expected=${exp.suggested_sentFrom}, actual=${hit.suggested?.sentFrom ?? "없음"}`;
        }
      }
      if (ok && exp.suggested_sentTo) {
        if (!hit.suggested || hit.suggested.sentTo !== exp.suggested_sentTo) {
          ok = false;
          detail = `suggested.sentTo 불일치: expected=${exp.suggested_sentTo}, actual=${hit.suggested?.sentTo ?? "없음"}`;
        }
      }
      if (ok && !detail) {
        detail = `${exp.finding_code} ✓${exp.severity ? `  severity=${exp.severity} ✓` : ""}${exp.family ? `  family=${exp.family} ✓` : ""}`;
      }
    }
  }

  const status = ok ? "PASS" : "FAIL";
  results.push({ id: fx.id, status, description: fx.description, detail });
  if (ok) passCount++;
  else failCount++;
}

// ─── 출력 ─────────────────────────────────────────────────────────────────────

const sep = "═".repeat(65);
const dash = "─".repeat(65);

console.log("");
console.log(sep);
console.log(" Pipeline v2 — fixture 검증 (visual_pipeline_v1)");
console.log(sep);
console.log("");

for (const r of results) {
  const icon =
    r.status === "PASS" ? "✅" : r.status === "PENDING_TOOL" ? "⏳" : "❌";
  console.log(`${icon} [${r.id}] ${r.description}`);
  if (r.detail) console.log(`      ${r.detail}`);
}

console.log("");
console.log(dash);
console.log(
  `결과: PASS ${passCount} / FAIL ${failCount} / PENDING_TOOL ${pendingCount}  (total ${fixtures.length})`,
);
console.log(dash);

if (failCount === 0 && pendingCount === 0) {
  console.log("✅ Phase 3 진입 기준 충족 — FAIL 0건, PENDING_TOOL 0건");
} else if (failCount === 0) {
  console.log(
    `⏳ Phase 3 진입 대기 — PENDING_TOOL ${pendingCount}건 rule 구현 의무`,
  );
} else {
  console.log(`❌ Phase 3 진입 불가 — FAIL ${failCount}건 해소 의무`);
}
console.log(sep);
console.log("");
