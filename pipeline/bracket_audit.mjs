/**
 * pipeline/bracket_audit.mjs
 *
 * bracket annotation 정합성 자동 검증 + 정정안 자동 생성.
 *
 * 실행:
 *   node pipeline/bracket_audit.mjs                       → 콘솔 리포트 + JSON 저장
 *   node pipeline/bracket_audit.mjs --year=2024수능        → 특정 연도만
 *   node pipeline/bracket_audit.mjs --report=path         → JSON 출력 경로 지정
 *
 * 검사 항목 (6가지):
 *   (1) sentId existence (sentFrom/sentTo)             → CRITICAL DEAD_SENTFROM/DEAD_SENTTO
 *   (2) 범위 안 비-body/verse sent 포함                  → WARNING NON_BODY_IN_RANGE
 *   (3) 본문 워크태그 [X] vs annotation 위치 정합          → CRITICAL WORKTAG_POSITION_MISMATCH
 *   (4) 본문 인라인 [X] vs annotation 범위 정합           → WARNING INLINE_OUT_OF_RANGE
 *   (5) 본문 [X] 부재 + annotation label 잔존            → CRITICAL BODY_MARKER_MISSING
 *   (6) 범위 sent 개수 outlier (>30)                    → WARNING RANGE_SIZE_OUTLIER
 *
 * 사용 (다른 도구 안 import):
 *   import { auditBrackets } from './bracket_audit.mjs';
 *   const findings = auditBrackets(data, ann, { years: [...] });
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function findSet(data, setId) {
  for (const yk of Object.keys(data)) {
    for (const sec of ["reading", "literature"]) {
      if (!data[yk] || !data[yk][sec]) continue;
      const set = data[yk][sec].find((s) => s.id === setId);
      if (set) return { yearKey: yk, section: sec, set };
    }
  }
  return null;
}

function getAllSetIds(data) {
  const ids = [];
  for (const yk of Object.keys(data)) {
    for (const sec of ["reading", "literature"]) {
      if (!data[yk] || !data[yk][sec]) continue;
      for (const set of data[yk][sec]) {
        if (set.id) ids.push({ yearKey: yk, section: sec, setId: set.id });
      }
    }
  }
  return ids;
}

function auditSet(data, ann, yearKey, setId) {
  const findings = [];
  const loc = findSet(data, setId);
  if (!loc) return findings;
  const set = loc.set;
  const sents = set.sents || [];
  const sentIds = new Set(sents.map((s) => s.id));
  const annotations = (ann[yearKey] && ann[yearKey][setId]) || [];
  const brackets = annotations.filter((x) => x.type === "bracket");

  if (brackets.length === 0) return findings;

  for (const b of brackets) {
    const label = b.label || "?";
    const sentFrom = b.sentFrom;
    const sentTo = b.sentTo;

    // Check 1: sentId existence
    const fromOk = sentIds.has(sentFrom);
    const toOk = sentIds.has(sentTo);
    if (!fromOk) {
      findings.push({
        code: "DEAD_SENTFROM",
        severity: "CRITICAL",
        yearKey,
        setId,
        label,
        msg: `bracket [${label}] sentFrom not in data: ${sentFrom}`,
      });
    }
    if (!toOk) {
      findings.push({
        code: "DEAD_SENTTO",
        severity: "CRITICAL",
        yearKey,
        setId,
        label,
        msg: `bracket [${label}] sentTo not in data: ${sentTo}`,
      });
    }
    if (!fromOk || !toOk) continue;

    const fromIdx = sents.findIndex((s) => s.id === sentFrom);
    const toIdx = sents.findIndex((s) => s.id === sentTo);
    if (fromIdx > toIdx) {
      findings.push({
        code: "INVERTED_RANGE",
        severity: "CRITICAL",
        yearKey,
        setId,
        label,
        msg: `bracket [${label}] sentFrom > sentTo (idx ${fromIdx} > ${toIdx})`,
      });
      continue;
    }

    const range = sents.slice(fromIdx, toIdx + 1);

    // Check 2: range contains non-body/verse sents (WARNING)
    const nonBody = range.filter(
      (s) => s.sentType !== "body" && s.sentType !== "verse",
    );
    if (nonBody.length > 0) {
      findings.push({
        code: "NON_BODY_IN_RANGE",
        severity: "WARNING",
        yearKey,
        setId,
        label,
        count: nonBody.length,
        msg: `bracket [${label}] range contains ${nonBody.length} non-body/verse sents (off-by-one 의심)`,
      });
    }

    const labelStr = `[${label}]`;

    // Check 3: body workTag [X] position
    // workTag with content matching bracket label "[X]" should be either:
    //   (a) immediately BEFORE bracket start  (start marker style, e.g., l2022a)
    //   (b) immediately AFTER bracket end     (end marker style, e.g., l2022d)
    //   (c) INSIDE bracket range              (composite work boundary, e.g., l2023b)
    // Otherwise CRITICAL position mismatch
    const workTagIdx = sents.findIndex(
      (s) => s.sentType === "workTag" && s.t === labelStr,
    );
    if (workTagIdx >= 0) {
      const isStartMarker = workTagIdx === fromIdx - 1;
      const isEndMarker = workTagIdx === toIdx + 1;
      const isInsideRange = workTagIdx >= fromIdx && workTagIdx <= toIdx;
      if (!isStartMarker && !isEndMarker && !isInsideRange) {
        const suggested = {};
        // suggest either before-start (preferred) or after-end position
        const beforeStart = sents[workTagIdx + 1]?.id || null;
        const afterEnd = sents[workTagIdx - 1]?.id || null;
        if (beforeStart) suggested.sentFrom_if_start_marker = beforeStart;
        if (afterEnd) suggested.sentTo_if_end_marker = afterEnd;
        findings.push({
          code: "WORKTAG_POSITION_MISMATCH",
          severity: "CRITICAL",
          yearKey,
          setId,
          label,
          msg: `bracket [${label}] workTag (${sents[workTagIdx].id}, idx ${workTagIdx}) not adjacent to nor inside range ${fromIdx}~${toIdx}`,
          suggested,
        });
      }
    }

    // Check 4: body inline [X] vs annotation range (WARNING)
    // Skip:
    //   - workTag (handled by Check 3)
    //   - verse-type sents starting with `[X]` (verse subsection label, not bracket marker)
    //     e.g., l2023d s23 [verse] "[A] 서로에게 기댄 채..." — 시 stanza label
    const inlineHits = sents
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => {
        if (s.sentType === "workTag") return false;
        if (!s.t.includes(labelStr)) return false;
        if (s.sentType === "verse" && s.t.startsWith(labelStr)) return false;
        return true;
      });
    if (inlineHits.length > 0) {
      const firstInline = inlineHits[0];
      const lastInline = inlineHits[inlineHits.length - 1];
      if (firstInline.idx < fromIdx || lastInline.idx > toIdx) {
        findings.push({
          code: "INLINE_OUT_OF_RANGE",
          severity: "WARNING",
          yearKey,
          setId,
          label,
          msg: `bracket [${label}] inline ${labelStr} at idx ${firstInline.idx}~${lastInline.idx} outside range ${fromIdx}~${toIdx}`,
          inline_first: firstInline.s.id,
          inline_last: lastInline.s.id,
          range_actual: `${sentFrom}~${sentTo}`,
          suggested: {
            sentFrom: firstInline.s.id,
            sentTo: lastInline.s.id,
          },
        });
      }
    }

    // Check 5: body [X] missing (CRITICAL)
    const hasInBody = sents.some((s) => s.t.includes(labelStr));
    if (!hasInBody) {
      findings.push({
        code: "BODY_MARKER_MISSING",
        severity: "CRITICAL",
        yearKey,
        setId,
        label,
        msg: `bracket [${label}] no ${labelStr} marker in body — annotation excess 의심`,
        action: "review_for_removal",
      });
    }

    // Check 6: range sent count outlier
    const rangeSize = toIdx - fromIdx + 1;
    if (rangeSize > 30) {
      findings.push({
        code: "RANGE_SIZE_OUTLIER",
        severity: "WARNING",
        yearKey,
        setId,
        label,
        count: rangeSize,
        msg: `bracket [${label}] range size = ${rangeSize} sents (>30 outlier)`,
      });
    }
  }

  return findings;
}

export function auditBrackets(data, ann, options = {}) {
  const { years = null } = options;
  const all = getAllSetIds(data);
  let findings = [];
  for (const { yearKey, setId } of all) {
    if (years && !years.includes(yearKey)) continue;
    findings = findings.concat(auditSet(data, ann, yearKey, setId));
  }
  return findings;
}

// ─── CLI ──────────────────────────────────────────────────────────────────
const argv1 = (process.argv[1] || "").replace(/\\/g, "/");
const isMain = argv1.endsWith("bracket_audit.mjs");

if (isMain) {
  const args = process.argv.slice(2);
  const yearArg = args
    .find((a) => a.startsWith("--year="))
    ?.slice("--year=".length);
  const reportArg =
    args.find((a) => a.startsWith("--report="))?.slice("--report=".length) ||
    "pipeline/bracket_audit_report.json";

  const data = loadJson("public/data/all_data_204.json");
  const ann = loadJson("public/data/annotations.json");
  const years = yearArg ? [yearArg] : null;

  const findings = auditBrackets(data, ann, { years });

  const bySev = { CRITICAL: 0, WARNING: 0 };
  const byCode = {};
  const bySet = {};
  for (const f of findings) {
    bySev[f.severity] = (bySev[f.severity] || 0) + 1;
    byCode[f.code] = (byCode[f.code] || 0) + 1;
    const key = `${f.yearKey}/${f.setId}`;
    bySet[key] = (bySet[key] || 0) + 1;
  }

  console.log("═".repeat(60));
  console.log(" BRACKET AUDIT REPORT");
  console.log("═".repeat(60));
  console.log("[ Severity ]");
  console.log(`  🔴 CRITICAL: ${bySev.CRITICAL || 0}`);
  console.log(`  🟡 WARNING:  ${bySev.WARNING || 0}`);

  console.log("\n[ By Code ]");
  for (const [code, count] of Object.entries(byCode).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${code}: ${count}`);
  }

  console.log("\n[ Findings (top 50) ]");
  for (const f of findings.slice(0, 50)) {
    const sev = f.severity === "CRITICAL" ? "🔴" : "🟡";
    console.log(
      `  ${sev} ${f.yearKey}/${f.setId} [${f.label}] ${f.code} :: ${f.msg}`,
    );
  }
  if (findings.length > 50) {
    console.log(`  ... ${findings.length - 50} more`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      total_findings: findings.length,
      critical: bySev.CRITICAL || 0,
      warning: bySev.WARNING || 0,
      by_code: byCode,
      by_set: bySet,
    },
    findings,
  };
  fs.writeFileSync(reportArg, JSON.stringify(report, null, 2), "utf8");
  console.log(`\n📄 리포트 저장: ${reportArg}`);

  console.log("\n" + "═".repeat(60));
  if ((bySev.CRITICAL || 0) === 0) {
    console.log("✅ bracket_audit PASS — CRITICAL 0건");
  } else {
    console.log(`🔴 bracket_audit FAIL — CRITICAL ${bySev.CRITICAL}건`);
    process.exit(1);
  }
  console.log("═".repeat(60));
}
