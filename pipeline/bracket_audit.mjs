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
 * 3단계 분류 (audit chain):
 *   SOURCE_*     — all_data 안 sents 원문 marker 정합 검증
 *   ANNOTATION_* — annotations.json span 정합 검증
 *   (RENDER_*    — visual_audit.mjs 안 DOM 시각 정합 — 별도 도구)
 *
 * 검사 항목:
 *   (1) ANNOTATION_DEAD_SENTFROM / DEAD_SENTTO  — CRITICAL
 *   (2) ANNOTATION_INVERTED_RANGE                — CRITICAL
 *   (3) ANNOTATION_NON_BODY_IN_RANGE             — WARNING
 *   (4) ANNOTATION_RANGE_SIZE_OUTLIER            — WARNING
 *   (5) SOURCE_WORKTAG_POSITION_MISMATCH         — CRITICAL
 *   (6) SOURCE_INLINE_OUT_OF_RANGE               — WARNING
 *   (7) SOURCE_BODY_MARKER_MISSING               — CRITICAL
 *
 * Report 안 commit hash 추가:
 *   - audit_commit (현 HEAD)
 *   - data_commit  (public/data/all_data_204.json 최근 commit)
 *   - mixed_commit (audit_commit ≠ data_commit 시 true)
 *
 * 사용 (다른 도구 안 import):
 *   import { auditBrackets } from './bracket_audit.mjs';
 *   const findings = auditBrackets(data, ann, { years: [...] });
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function safeGitCmd(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch (e) {
    return null;
  }
}

export function getCommitHashes() {
  const audit_commit = safeGitCmd("git rev-parse HEAD") || "unknown";
  const data_commit =
    safeGitCmd("git log -1 --format=%H -- public/data/all_data_204.json") ||
    "unknown";
  const ann_commit =
    safeGitCmd("git log -1 --format=%H -- public/data/annotations.json") ||
    "unknown";
  const mixed_commit =
    audit_commit !== "unknown" &&
    data_commit !== "unknown" &&
    audit_commit !== data_commit;
  return { audit_commit, data_commit, ann_commit, mixed_commit };
}

// v2: yearKey 우선 검색 (setId 충돌 — LEGACY A/B형 33 set 대응).
// 호출 측에서 yearKey 를 알면 정확한 set 매칭 가능. 미지정 시 첫 매칭 (백워드 호환).
function findSet(data, setId, yearKey) {
  if (yearKey) {
    const year = data[yearKey];
    if (!year) return null;
    for (const sec of ["reading", "literature"]) {
      if (!year[sec]) continue;
      const set = year[sec].find((s) => s.id === setId);
      if (set) return { yearKey, section: sec, set };
    }
    return null;
  }
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
  const loc = findSet(data, setId, yearKey); // v2: yearKey 격리
  if (!loc) return findings;
  const set = loc.set;
  const sents = set.sents || [];
  const sentIds = new Set(sents.map((s) => s.id));
  const annotations = (ann[yearKey] && ann[yearKey][setId]) || [];
  const brackets = annotations.filter((x) => x.type === "bracket");

  // SOURCE audit: verse line overflow (sent-level, no bracket required)
  // 단일 verse sent.t 안 line count > 5 path 안 통합 sent 결함 의심 (sent break 의무 path 잠재)
  for (const s of sents) {
    if (s.sentType !== "verse") continue;
    const lineCount = (s.t || "").split("\n").length;
    if (lineCount > 5) {
      findings.push({
        code: "SOURCE_VERSE_LINE_OVERFLOW",
        family: "SENT_SEGMENTATION_DEFECT",
        severity: "WARNING",
        yearKey,
        setId,
        label: null,
        sentId: s.id,
        lineCount,
        msg: `verse sent ${s.id} contains ${lineCount} lines (>5 outlier — sent break 의무 path 잠재)`,
      });
    }
  }

  if (brackets.length === 0) return findings;

  // ── DETECTOR_FALSE_POSITIVE 사전 조건 (set-level, 한 번만 계산) ────────────
  // Rule A.1 — SOURCE_BODY_MARKER_MISSING 오탐 조건
  //   (a) sub-sent domain: set 안 이미 분리된 sub-sent 존재 (s{N}_{M} 형식)
  //   (b) overflow sent domain: set 안 미분리 overflow verse sent 존재 (>5 lines)
  //   (c) all-untyped range: annotation 범위 안 모든 sent.sentType 미설정
  const hasSubSentsInSet = sents.some((s) => /s\d+_\d+$/.test(s.id));
  const hasOverflowSentsInSet = sents.some(
    (s) => s.sentType === "verse" && (s.t || "").split("\n").length > 5,
  );
  // Rule A.2 — SOURCE_WORKTAG_POSITION_MISMATCH 오탐 조건
  //   composite 작품 set: (가)/(나)/(다) style workTag 2개 이상
  const compositeWorkTagCount = sents.filter(
    (s) => s.sentType === "workTag" && /^\([가-힣]\)$/.test(s.t || ""),
  ).length;
  const isCompositeWork = compositeWorkTagCount >= 2;

  for (const b of brackets) {
    const label = b.label || "?";
    const sentFrom = b.sentFrom;
    const sentTo = b.sentTo;

    // ANNOTATION audit 1: sentId existence
    const fromOk = sentIds.has(sentFrom);
    const toOk = sentIds.has(sentTo);
    if (!fromOk) {
      findings.push({
        code: "ANNOTATION_DEAD_SENTFROM",
        family: "ANNOTATION_REFERENCE_DEFECT",
        severity: "CRITICAL",
        yearKey,
        setId,
        label,
        msg: `bracket [${label}] sentFrom not in data: ${sentFrom}`,
      });
    }
    if (!toOk) {
      findings.push({
        code: "ANNOTATION_DEAD_SENTTO",
        family: "ANNOTATION_REFERENCE_DEFECT",
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
        code: "ANNOTATION_INVERTED_RANGE",
        family: "ANNOTATION_REFERENCE_DEFECT",
        severity: "CRITICAL",
        yearKey,
        setId,
        label,
        msg: `bracket [${label}] sentFrom > sentTo (idx ${fromIdx} > ${toIdx})`,
      });
      continue;
    }

    const range = sents.slice(fromIdx, toIdx + 1);

    // ANNOTATION audit 2: range contains non-body/verse sents
    const nonBody = range.filter(
      (s) => s.sentType !== "body" && s.sentType !== "verse",
    );
    if (nonBody.length > 0) {
      // Rule B: composite 작품 set + sub-marker workTag(<제N수> 등) 포함 범위 → 오탐
      const hasSubMarkerInRange = nonBody.some(
        (s) => s.sentType === "workTag" && /^<[^>]+>$/.test(s.t || ""),
      );
      if (isCompositeWork && hasSubMarkerInRange) {
        findings.push({
          code: "ANNOTATION_NON_BODY_IN_RANGE",
          family: "DETECTOR_FALSE_POSITIVE",
          severity: "INFO",
          yearKey,
          setId,
          label,
          count: nonBody.length,
          msg: `bracket [${label}] range contains ${nonBody.length} non-body/verse sents — composite 작품 안 sub-marker workTag 포함 (false positive)`,
        });
      } else {
        findings.push({
          code: "ANNOTATION_NON_BODY_IN_RANGE",
          family: "ANNOTATION_REFERENCE_DEFECT",
          severity: "WARNING",
          yearKey,
          setId,
          label,
          count: nonBody.length,
          msg: `bracket [${label}] range contains ${nonBody.length} non-body/verse sents (off-by-one 의심)`,
        });
      }
    }

    const labelStr = `[${label}]`;

    // SOURCE audit 1: body workTag [X] position
    // workTag with content matching bracket label "[X]" should be either:
    //   (a) BEFORE bracket start  (start marker style, e.g., l2022a)
    //         — tolerance 사양 안 1~2 sent gap 허용 path (예: l2022a [B] = workTag idx 7 + fromIdx 9)
    //   (b) AFTER bracket end     (end marker style, e.g., l2022d)
    //         — tolerance 사양 안 1~2 sent gap 허용 path
    //   (c) INSIDE bracket range  (composite work boundary, e.g., l2023b)
    const WORKTAG_GAP_TOLERANCE = 3; // immediately adjacent (1) + 1~2 sent gap (2~3)
    const workTagIdx = sents.findIndex(
      (s) => s.sentType === "workTag" && s.t === labelStr,
    );
    if (workTagIdx >= 0) {
      const isStartMarker =
        workTagIdx < fromIdx && fromIdx - workTagIdx <= WORKTAG_GAP_TOLERANCE;
      const isEndMarker =
        workTagIdx > toIdx && workTagIdx - toIdx <= WORKTAG_GAP_TOLERANCE;
      const isInsideRange = workTagIdx >= fromIdx && workTagIdx <= toIdx;
      if (!isStartMarker && !isEndMarker && !isInsideRange) {
        if (isCompositeWork) {
          // Rule A.2: composite 작품 set — workTag position mismatch 는 오탐
          findings.push({
            code: "SOURCE_WORKTAG_POSITION_MISMATCH",
            family: "DETECTOR_FALSE_POSITIVE",
            severity: "INFO",
            yearKey,
            setId,
            label,
            compositeWorkTagCount,
            msg: `bracket [${label}] workTag position mismatch — composite 작품 구조 (${compositeWorkTagCount}개 work-divider workTag, false positive)`,
          });
        } else {
          const suggested = {};
          const beforeStart = sents[workTagIdx + 1]?.id || null;
          const afterEnd = sents[workTagIdx - 1]?.id || null;
          if (beforeStart) suggested.sentFrom_if_start_marker = beforeStart;
          if (afterEnd) suggested.sentTo_if_end_marker = afterEnd;
          findings.push({
            code: "SOURCE_WORKTAG_POSITION_MISMATCH",
            family: "VISUAL_MARK_DEFECT",
            severity: "CRITICAL",
            yearKey,
            setId,
            label,
            msg: `bracket [${label}] workTag (${sents[workTagIdx].id}, idx ${workTagIdx}) not adjacent to nor inside range ${fromIdx}~${toIdx}`,
            suggested,
          });
        }
      }
    }

    // SOURCE audit 2: body inline [X] vs annotation range
    // Skip:
    //   - workTag (handled separately)
    //   - verse-type sents starting with `[X]` (verse subsection label)
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
          code: "SOURCE_INLINE_OUT_OF_RANGE",
          family: "SOURCE_TEXT_DEFECT",
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

    // SOURCE audit 3: body [X] missing
    const hasInBody = sents.some((s) => s.t.includes(labelStr));
    if (!hasInBody) {
      // Rule A.1: annotation 단독 시각화 — 오탐 여부 판정
      //   (a) sub-sent domain, (b) overflow sent domain, (c) all-untyped range
      const allRangeUntyped =
        range.length > 0 && range.every((s) => !s.sentType);
      const isFalsePositive =
        hasSubSentsInSet || hasOverflowSentsInSet || allRangeUntyped;
      if (isFalsePositive) {
        const reason = hasSubSentsInSet
          ? "sub-sent domain"
          : hasOverflowSentsInSet
            ? "overflow sent domain"
            : "all-untyped sent range";
        findings.push({
          code: "SOURCE_BODY_MARKER_MISSING",
          family: "DETECTOR_FALSE_POSITIVE",
          severity: "INFO",
          yearKey,
          setId,
          label,
          reason,
          msg: `bracket [${label}] no ${labelStr} marker — annotation 단독 시각화 (false positive: ${reason})`,
        });
      } else {
        findings.push({
          code: "SOURCE_BODY_MARKER_MISSING",
          family: "SOURCE_TEXT_DEFECT",
          severity: "CRITICAL",
          yearKey,
          setId,
          label,
          msg: `bracket [${label}] no ${labelStr} marker in body — annotation excess 의심`,
          action: "review_for_removal",
        });
      }
    }

    // ANNOTATION audit 3: range sent count outlier
    const rangeSize = toIdx - fromIdx + 1;
    if (rangeSize > 30) {
      findings.push({
        code: "ANNOTATION_RANGE_SIZE_OUTLIER",
        family: "ANNOTATION_REFERENCE_DEFECT",
        severity: "WARNING",
        yearKey,
        setId,
        label,
        count: rangeSize,
        msg: `bracket [${label}] range size = ${rangeSize} sents (>30 outlier)`,
      });
    }

    // SOURCE audit 4: inline [X] open marker missing close "]"
    // e.g. sent.t = "여기서 [A 내용" → [A 있으나 ] 없음
    const openRe = new RegExp(`\\[${label}(?!\\])`);
    for (const s of sents) {
      if (openRe.test(s.t || "")) {
        findings.push({
          code: "INLINE_MARKER_MISSING_CLOSE",
          family: "SOURCE_TEXT_DEFECT",
          severity: "WARNING",
          yearKey,
          setId,
          label,
          sentId: s.id,
          msg: `sent ${s.id}: "[${label}" open marker missing close "]" in "${(s.t || "").slice(0, 60)}"`,
        });
      }
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
  const commits = getCommitHashes();

  const bySev = { CRITICAL: 0, WARNING: 0 };
  const byFamily = {
    SOURCE_TEXT_DEFECT: 0,
    SENT_SEGMENTATION_DEFECT: 0,
    VISUAL_MARK_DEFECT: 0,
    ANNOTATION_REFERENCE_DEFECT: 0,
    DOWNSTREAM_REFERENCE_DEFECT: 0,
    RENDERER_DEFECT: 0,
    DETECTOR_FALSE_POSITIVE: 0,
    RELEASE_POLICY_DEFECT: 0,
  };
  const byCode = {};
  const bySet = {};
  for (const f of findings) {
    bySev[f.severity] = (bySev[f.severity] || 0) + 1;
    const fam = f.family || "UNCATEGORIZED";
    byFamily[fam] = (byFamily[fam] || 0) + 1;
    byCode[f.code] = (byCode[f.code] || 0) + 1;
    const key = `${f.yearKey}/${f.setId}`;
    bySet[key] = (bySet[key] || 0) + 1;
  }

  console.log("═".repeat(60));
  console.log(" BRACKET AUDIT REPORT (Pipeline v2 — 8 family)");
  console.log("═".repeat(60));
  console.log("[ Commit chain ]");
  console.log(`  audit_commit: ${commits.audit_commit.substring(0, 8)}`);
  console.log(`  data_commit:  ${commits.data_commit.substring(0, 8)}`);
  console.log(`  ann_commit:   ${commits.ann_commit.substring(0, 8)}`);
  console.log(`  mixed_commit: ${commits.mixed_commit}`);
  if (commits.mixed_commit) {
    console.log("  ⚠ mixed_commit=true → release 판단 차단 lock 사양 path");
  }

  console.log("\n[ Severity ]");
  console.log(`  🔴 CRITICAL: ${bySev.CRITICAL || 0}`);
  console.log(`  🟡 WARNING:  ${bySev.WARNING || 0}`);

  console.log("\n[ Family (Pipeline v2 — 8 issue family) ]");
  for (const [fam, count] of Object.entries(byFamily).sort(
    (a, b) => b[1] - a[1],
  )) {
    if (count === 0) continue;
    console.log(`  ${fam}: ${count}`);
  }

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
      `  ${sev} [${f.family || "?"}] ${f.yearKey}/${f.setId} [${f.label}] ${f.code} :: ${f.msg}`,
    );
  }
  if (findings.length > 50) {
    console.log(`  ... ${findings.length - 50} more`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    commits,
    summary: {
      total_findings: findings.length,
      critical: bySev.CRITICAL || 0,
      warning: bySev.WARNING || 0,
      by_family: byFamily,
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
