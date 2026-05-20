/**
 * pipeline/step2_postprocess_vNext.mjs — Pipeline v2 dry-run 진단 도구
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  [역할 분리]                                                        │
 * │  step2_postprocess.mjs  : 기존 파이프라인 (source extraction + QC)  │
 * │                           → 데이터 write 포함. 직접 실행 side-effect│
 * │  step2_postprocess_vNext: Pipeline v2 전용 dry-run 진단 도구        │
 * │                           → 데이터 write 절대 금지 (--dry-run 전용) │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * [commit 3 — SENT_SEGMENTATION_DEFECT 검출]
 *   SOURCE_VERSE_LINE_OVERFLOW : sentType=verse 안 \n 기준 line > 5 검출
 *                                → migration plan (oldSentId/newSentIds/mapping/affected/safeToApply) 출력
 *   DEAD_CSSPAN_SENTID         : choice.cs_spans[].sent_id → 현재 set.sents 안 부재
 *                                → CRITICAL severity
 *
 * [후속 commit 예정]
 *   commit 3.1: SOURCE_TEXT_DEFECT
 *   commit 3.2: VISUAL_MARK_DEFECT
 *   commit 3.3: ANNOTATION_REFERENCE_DEFECT
 *
 * 사용법:
 *   node pipeline/step2_postprocess_vNext.mjs --dry-run
 *   node pipeline/step2_postprocess_vNext.mjs --dry-run --target=l2024d
 *   node pipeline/step2_postprocess_vNext.mjs --dry-run --target=2024수능
 *   node pipeline/step2_postprocess_vNext.mjs --dry-run --target=l2024d --sent=l2024_32_34s4
 *
 * [Phase 1.24 fixture 재현]
 *   node pipeline/step2_postprocess_vNext.mjs --dry-run --target=l2024d --sent=l2024_32_34s4
 *   → SENT_NOT_FOUND (s4 already split → sub-sents s4_1..s4_17 존재 확인)
 *   → DEAD_CSSPAN_SENTID 8건 (split 이후 cs_spans 미갱신)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../public/data/all_data_204.json");
const ANN_PATH = path.join(__dirname, "../public/data/annotations.json");

const OVERFLOW_THRESHOLD = 5; // verse line count > this → SOURCE_VERSE_LINE_OVERFLOW

// ─── arg parse ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (!args.includes("--dry-run")) {
  process.stderr.write(
    "[ERROR] --dry-run flag 필수. 본 도구는 dry-run 전용.\n",
  );
  process.exit(1);
}
const targetArg =
  args.find((a) => a.startsWith("--target="))?.slice("--target=".length) ??
  null;
const sentArg =
  args.find((a) => a.startsWith("--sent="))?.slice("--sent=".length) ?? null;

// ─── load ─────────────────────────────────────────────────────────────────────

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const ann = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));

// ─── helpers ──────────────────────────────────────────────────────────────────

/** 모든 set 열거. filterFn(yearKey, set) → boolean */
function iterateSets(filterFn) {
  const results = [];
  for (const [yearKey, yearObj] of Object.entries(data)) {
    if (typeof yearObj !== "object" || Array.isArray(yearObj)) continue;
    for (const domain of ["reading", "literature"]) {
      const sets = yearObj[domain];
      if (!Array.isArray(sets)) continue;
      for (const set of sets) {
        if (!filterFn || filterFn(yearKey, set)) results.push({ yearKey, set });
      }
    }
  }
  return results;
}

/** annotations.json[yearKey][setId] bracket 목록 */
function getBracketAnnotations(yearKey, setId) {
  const setAnns = ann[yearKey]?.[setId];
  if (!Array.isArray(setAnns)) return [];
  return setAnns.filter((a) => a.type === "bracket");
}

/** 분리 후 sentId 목록 */
function buildNewSentIds(oldSentId, lines) {
  return lines.map((_, i) => `${oldSentId}_${i + 1}`);
}

/** char offset 기준 mapping */
function buildMapping(oldSentId, lines) {
  let offset = 0;
  return lines.map((line, i) => {
    const entry = {
      oldOffset: offset,
      newSentId: `${oldSentId}_${i + 1}`,
      newOffset: 0,
    };
    offset += line.length + 1; // +1 = '\n'
    return entry;
  });
}

/**
 * oldSentId 안 affected references 수집
 * 반환: { csIdsRefs, csSpansRefs, annotationRefs }
 */
function findAffected(yearKey, set, oldSentId, subSentTexts) {
  // cs_ids
  const csIdsRefs = [];
  for (const q of set.questions ?? []) {
    for (const c of q.choices ?? []) {
      if ((c.cs_ids ?? []).includes(oldSentId)) {
        csIdsRefs.push({ qId: q.id, choiceNum: c.num });
      }
    }
  }

  // cs_spans: 어느 sub-sent 안 text 포함 여부 판단
  const csSpansRefs = [];
  for (const q of set.questions ?? []) {
    for (const c of q.choices ?? []) {
      for (const sp of c.cs_spans ?? []) {
        if (sp.sent_id !== oldSentId) continue;
        const matches = subSentTexts.filter((ss) => ss.t.includes(sp.text));
        csSpansRefs.push({
          qId: q.id,
          choiceNum: c.num,
          text: sp.text,
          matchingSentIds: matches.map((ss) => ss.id),
          safeMapping: matches.length === 1,
        });
      }
    }
  }

  // annotations bracket — sentFrom 또는 sentTo === oldSentId
  const annotationRefs = [];
  for (const b of getBracketAnnotations(yearKey, set.id)) {
    if (b.sentFrom === oldSentId || b.sentTo === oldSentId) {
      annotationRefs.push({
        label: b.label,
        sentFrom: b.sentFrom,
        sentTo: b.sentTo,
      });
    }
  }

  return { csIdsRefs, csSpansRefs, annotationRefs };
}

/**
 * safeToApply 판정
 * - cs_ids: 항상 safe (Option A: 모든 sub-sent 일괄 확장)
 * - cs_spans: 각 span text 안 단일 sub-sent 일치 시 safe
 * - annotations: bracket reference 존재 시 unsafe (사용자 명시 의무)
 */
function computeSafeToApply(affected) {
  for (const sp of affected.csSpansRefs) {
    if (!sp.safeMapping) {
      const hint =
        sp.matchingSentIds.length === 0
          ? "text not found in any sub-sent"
          : `text found in multiple sub-sents: ${sp.matchingSentIds.join(", ")}`;
      return {
        safe: false,
        reason: `cs_spans ambiguous — "${sp.text.slice(0, 30)}": ${hint}`,
      };
    }
  }
  if (affected.annotationRefs.length > 0) {
    const labels = affected.annotationRefs
      .map((a) => `[${a.label}]`)
      .join(", ");
    return {
      safe: false,
      reason: `bracket annotation ${labels} references oldSentId — user must specify sentFrom/sentTo sub-sents`,
    };
  }
  return {
    safe: true,
    reason:
      "all affected refs auto-mappable (cs_ids: Option A; cs_spans: exact match)",
  };
}

// ─── target sets ──────────────────────────────────────────────────────────────

let targetSets;
if (targetArg) {
  // setId 또는 yearKey 양쪽 허용
  targetSets = iterateSets((yk, s) => s.id === targetArg || yk === targetArg);
  if (targetSets.length === 0) {
    process.stderr.write(`[WARN] target="${targetArg}" — 해당 set/year 없음\n`);
  }
} else {
  targetSets = iterateSets(null);
}

// ─── detection ────────────────────────────────────────────────────────────────

const findings = [];
const migrationPlans = [];

for (const { yearKey, set } of targetSets) {
  const sentIdSet = new Set((set.sents ?? []).map((s) => s.id));

  // ── DETECTION 1: SOURCE_VERSE_LINE_OVERFLOW ───────────────────────────────
  let sentFoundFlag = false;

  for (const sent of set.sents ?? []) {
    if (sentArg && sent.id !== sentArg) continue;
    if (sentArg) sentFoundFlag = true;

    if (sent.sentType !== "verse") continue;
    const lines = (sent.t ?? "").split("\n");
    if (lines.length <= OVERFLOW_THRESHOLD) continue;

    const subSentTexts = lines.map((l, i) => ({
      id: `${sent.id}_${i + 1}`,
      t: l,
    }));
    const newSentIds = buildNewSentIds(sent.id, lines);
    const mapping = buildMapping(sent.id, lines);
    const affected = findAffected(yearKey, set, sent.id, subSentTexts);
    const safeResult = computeSafeToApply(affected);

    findings.push({
      family: "SENT_SEGMENTATION_DEFECT",
      code: "SOURCE_VERSE_LINE_OVERFLOW",
      severity: "WARNING",
      yearKey,
      setId: set.id,
      sentId: sent.id,
      detail: `verse sent has ${lines.length} lines (threshold: ${OVERFLOW_THRESHOLD})`,
    });

    migrationPlans.push({
      oldSentId: sent.id,
      yearKey,
      setId: set.id,
      lineCount: lines.length,
      newSentIds,
      mapping,
      affected: {
        annotations: affected.annotationRefs.map((a) => `bracket [${a.label}]`),
        cs_ids: affected.csIdsRefs,
        cs_spans: affected.csSpansRefs,
        visual_marks: "(auto-regenerated — no action)",
      },
      safeToApply: safeResult.safe,
      safeToApply_reason: safeResult.reason,
    });
  }

  // sentArg 지정 + set 안 미발견 → SENT_NOT_FOUND 판정
  if (sentArg && !sentFoundFlag && set.id === targetArg) {
    // sub-sents 존재 여부 확인 (이미 split 된 경우)
    const subSentPattern = `${sentArg}_`;
    const subSents = Array.from(sentIdSet).filter((id) =>
      id.startsWith(subSentPattern),
    );
    findings.push({
      family: "SENT_SEGMENTATION_DEFECT",
      code: "SENT_NOT_FOUND",
      severity: "INFO",
      yearKey,
      setId: set.id,
      sentId: sentArg,
      detail:
        subSents.length > 0
          ? `sentId not found (already split → sub-sents detected: ${subSents.slice(0, 3).join(", ")}${subSents.length > 3 ? ` ... +${subSents.length - 3}` : ""})`
          : "sentId not found in set.sents",
    });
  }

  // ── DETECTION 2: DEAD_CSSPAN_SENTID ──────────────────────────────────────
  // --sent 필터와 무관하게 full set 스캔 (cs_spans dead ref 는 set-level 검사)
  for (const q of set.questions ?? []) {
    for (const c of q.choices ?? []) {
      for (const sp of c.cs_spans ?? []) {
        if (sentIdSet.has(sp.sent_id)) continue;
        findings.push({
          family: "SENT_SEGMENTATION_DEFECT",
          code: "DEAD_CSSPAN_SENTID",
          severity: "CRITICAL",
          yearKey,
          setId: set.id,
          sentId: sp.sent_id,
          detail: `cs_spans.sent_id="${sp.sent_id}" not in set.sents (qId=${q.id}, choiceNum=${c.num}, text="${sp.text.slice(0, 40)}")`,
        });
      }
    }
  }
}

// ─── console output ───────────────────────────────────────────────────────────

const sep = "═".repeat(67);
const dash = "─".repeat(50);

console.log("");
console.log(sep);
console.log(" step2_postprocess_vNext — SENT_SEGMENTATION_DEFECT [dry-run]");
console.log(sep);
if (targetArg) console.log(` target : ${targetArg}`);
if (sentArg) console.log(` sent   : ${sentArg}`);
console.log("");

// SOURCE_VERSE_LINE_OVERFLOW
const overflowF = findings.filter(
  (f) => f.code === "SOURCE_VERSE_LINE_OVERFLOW",
);
if (overflowF.length > 0) {
  console.log("[ SOURCE_VERSE_LINE_OVERFLOW ] — WARNING");
  console.log(dash);
  for (const plan of migrationPlans) {
    console.log(
      `  ${plan.yearKey} / ${plan.setId} / ${plan.oldSentId} (${plan.lineCount} lines)`,
    );
    console.log(`    safeToApply : ${plan.safeToApply}`);
    console.log(`    reason      : ${plan.safeToApply_reason}`);
    console.log(
      `    newSentIds  : ${plan.newSentIds.slice(0, 3).join(", ")}${plan.newSentIds.length > 3 ? ` ... +${plan.newSentIds.length - 3}` : ""}`,
    );
    if (plan.affected.annotations.length > 0)
      console.log(
        `    affected.annotations : ${plan.affected.annotations.join(", ")}`,
      );
    if (plan.affected.cs_ids.length > 0)
      console.log(
        `    affected.cs_ids      : ${plan.affected.cs_ids.length} choices`,
      );
    if (plan.affected.cs_spans.length > 0)
      console.log(
        `    affected.cs_spans    : ${plan.affected.cs_spans.length} spans`,
      );
    console.log("");
  }
} else {
  console.log("[ SOURCE_VERSE_LINE_OVERFLOW ] — 0건");
  console.log("");
}

// SENT_NOT_FOUND
const notFoundF = findings.filter((f) => f.code === "SENT_NOT_FOUND");
for (const f of notFoundF) {
  console.log(`[ SENT_NOT_FOUND ] — INFO`);
  console.log(dash);
  console.log(`  ${f.yearKey} / ${f.setId} / ${f.sentId}`);
  console.log(`  ${f.detail}`);
  console.log("");
}

// DEAD_CSSPAN_SENTID
const deadF = findings.filter((f) => f.code === "DEAD_CSSPAN_SENTID");
if (deadF.length > 0) {
  console.log("[ DEAD_CSSPAN_SENTID ] — CRITICAL");
  console.log(dash);
  for (const f of deadF) {
    console.log(`  ${f.yearKey} / ${f.setId} / ${f.sentId}`);
    console.log(`    ${f.detail}`);
  }
  console.log("");
} else {
  console.log("[ DEAD_CSSPAN_SENTID ] — 0건");
  console.log("");
}

// summary
const unsafePlans = migrationPlans.filter((p) => !p.safeToApply);
console.log(dash);
console.log(`Summary:`);
console.log(`  findings total    : ${findings.length}`);
console.log(`  overflow (WARNING): ${overflowF.length}`);
console.log(`  dead_csspan (CRIT): ${deadF.length}`);
console.log(`  migration_plans   : ${migrationPlans.length}`);
console.log(`  unsafe_cases      : ${unsafePlans.length}`);
if (unsafePlans.length > 0) {
  console.log("  unsafe_cases:");
  for (const u of unsafePlans) {
    console.log(`    ${u.oldSentId}: ${u.safeToApply_reason}`);
  }
}
console.log("");

// ─── JSON output ──────────────────────────────────────────────────────────────

const report = {
  dry_run: true,
  generated_at: new Date().toISOString(),
  target: targetArg,
  sent: sentArg,
  findings,
  migration_plans: migrationPlans,
  unsafe_cases: unsafePlans.map((p) => ({
    oldSentId: p.oldSentId,
    reason: p.safeToApply_reason,
  })),
};

const outDir = path.join(__dirname, "../out");
const outPath = path.join(outDir, "step2_vNext_report.json");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
console.log(`JSON report → out/step2_vNext_report.json`);
console.log("");
