/**
 * pipeline/step2_postprocess_vNext.mjs — Pipeline v2 dry-run 진단 + split 적용 도구
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  [역할 분리]                                                        │
 * │  step2_postprocess.mjs  : 기존 파이프라인 (source extraction + QC)  │
 * │                           → 데이터 write 포함. 직접 실행 side-effect│
 * │  step2_postprocess_vNext: Pipeline v2 진단 + split 적용 도구        │
 * │                           --dry-run : 검출만 (write 금지)           │
 * │                           --apply   : 안전 plan 적용 + write        │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * [commit 3 — SENT_SEGMENTATION_DEFECT 검출]
 *   SOURCE_VERSE_LINE_OVERFLOW : sentType=verse 안 \n 기준 line > 5
 *                                → migration plan 출력
 *   DEAD_CSSPAN_SENTID         : choice.cs_spans[].sent_id → set.sents 미존재
 *                                → CRITICAL
 *
 * [commit 4 — sent_split_migration 적용]
 *   --apply 플래그: safeToApply=true plan 단독 자동 적용 (Lock SP2 정합)
 *   safeToApply=false → unsafe_cases 출력만, 자동 적용 금지
 *
 *   적용 내용:
 *     set.sents  : oldSentId → newSentIds (line-by-line 분리)
 *     cs_ids     : oldSentId → 모든 newSentIds 확장 (Option A)
 *     cs_spans   : sent_id === oldSentId → 해당 sub-sent ID 갱신 (exact match)
 *
 *   backup:
 *     적용 전 data 파일 → out/backups/all_data_204_backup_<timestamp>.json
 *     (lock #1 정합 — Integration Push 분리 보조 단계)
 *
 *   verify (사전 검증):
 *     적용 후 in-memory 재검출 → oldSentId 부재 확인
 *     실패 시 write 중단 (rollback 불필요 — in-memory 조작 후 미write)
 *
 * [후속 commit 예정]
 *   commit 3.1: SOURCE_TEXT_DEFECT
 *   commit 3.2: VISUAL_MARK_DEFECT
 *   commit 3.3: ANNOTATION_REFERENCE_DEFECT
 *   commit 4.1: DEAD_CSSPAN retroactive patch logic
 *
 * 사용법:
 *   # 검출만 (write 없음)
 *   node pipeline/step2_postprocess_vNext.mjs --dry-run
 *   node pipeline/step2_postprocess_vNext.mjs --dry-run --target=l2024d
 *   node pipeline/step2_postprocess_vNext.mjs --dry-run --target=l2024d --sent=l2024_32_34s4
 *
 *   # 안전 plan 적용 (--target 필수)
 *   node pipeline/step2_postprocess_vNext.mjs --apply --target=l2024d
 *   node pipeline/step2_postprocess_vNext.mjs --apply --target=l2024d --sent=l2024_32_34s2
 *
 *   # fixture 테스트 (data-path 오버라이드)
 *   node pipeline/step2_postprocess_vNext.mjs --dry-run --target=l2024d \
 *     --data-path=pipeline/fixtures/l2024d_s4_presplit_fixture.json \
 *     --ann-path=pipeline/fixtures/l2024d_s4_presplit_annotations.json
 *
 * [Phase 1.24 fixture 검증]
 *   node pipeline/step2_postprocess_vNext.mjs --apply --target=l2024d \
 *     --data-path=pipeline/fixtures/l2024d_s4_presplit_fixture.json \
 *     --ann-path=pipeline/fixtures/l2024d_s4_presplit_annotations.json
 *   → l2024_32_34s4 (17 lines) split + cs_ids Option A + cs_spans 갱신 검증
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DATA_PATH = path.join(
  __dirname,
  "../public/data/all_data_204.json",
);
const DEFAULT_ANN_PATH = path.join(
  __dirname,
  "../public/data/annotations.json",
);

const OVERFLOW_THRESHOLD = 5; // verse line count > this → SOURCE_VERSE_LINE_OVERFLOW

// ─── arg parse ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

const dryRun = args.includes("--dry-run");
const applyFlag = args.includes("--apply");

if (!dryRun && !applyFlag) {
  process.stderr.write("[ERROR] --dry-run 또는 --apply 플래그 중 하나 필수.\n");
  process.exit(1);
}
if (dryRun && applyFlag) {
  process.stderr.write("[ERROR] --dry-run 과 --apply 동시 사용 불가.\n");
  process.exit(1);
}

const targetArg =
  args.find((a) => a.startsWith("--target="))?.slice("--target=".length) ??
  null;
const sentArg =
  args.find((a) => a.startsWith("--sent="))?.slice("--sent=".length) ?? null;
const dataPathArg =
  args
    .find((a) => a.startsWith("--data-path="))
    ?.slice("--data-path=".length) ?? null;
const annPathArg =
  args.find((a) => a.startsWith("--ann-path="))?.slice("--ann-path=".length) ??
  null;

if (applyFlag && !targetArg) {
  process.stderr.write(
    "[ERROR] --apply 사용 시 --target=<setId|yearKey> 필수 (일괄 전체 적용 금지).\n",
  );
  process.exit(1);
}

const DATA_PATH = dataPathArg
  ? path.resolve(process.cwd(), dataPathArg)
  : DEFAULT_DATA_PATH;
const ANN_PATH = annPathArg
  ? path.resolve(process.cwd(), annPathArg)
  : DEFAULT_ANN_PATH;

const isFixtureMode = !!dataPathArg;

// ─── load ─────────────────────────────────────────────────────────────────────

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const ann = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));

// ─── helpers ──────────────────────────────────────────────────────────────────

/** 모든 set 열거。filterFn(yearKey, set) → boolean */
function iterateSets(dataObj, filterFn) {
  const results = [];
  for (const [yearKey, yearObj] of Object.entries(dataObj)) {
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
function getBracketAnnotations(annObj, yearKey, setId) {
  const setAnns = annObj[yearKey]?.[setId];
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
function findAffected(annObj, yearKey, set, oldSentId, subSentTexts) {
  // cs_ids
  const csIdsRefs = [];
  for (const q of set.questions ?? []) {
    for (const c of q.choices ?? []) {
      if ((c.cs_ids ?? []).includes(oldSentId)) {
        csIdsRefs.push({ qId: q.id, choiceNum: c.num });
      }
    }
  }

  // cs_spans
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
  for (const b of getBracketAnnotations(annObj, yearKey, set.id)) {
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
 * - cs_ids: 항상 safe (Option A)
 * - cs_spans: 각 span text 안 단일 sub-sent 일치 시 safe
 * - annotations: bracket reference → unsafe (사용자 명시 의무)
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

// ─── apply helper ─────────────────────────────────────────────────────────────

/**
 * in-memory 안 plan 적용 (write 없음)
 * 반환: { appliedSentIds: string[] }  — 삽입된 newSentId 목록
 */
function applyPlan(dataObj, plan) {
  const { yearKey, setId, oldSentId, affected } = plan;

  // set 탐색
  let targetSet = null;
  for (const domain of ["reading", "literature"]) {
    const sets = dataObj[yearKey]?.[domain];
    if (!Array.isArray(sets)) continue;
    const s = sets.find((x) => x.id === setId);
    if (s) {
      targetSet = s;
      break;
    }
  }
  if (!targetSet)
    throw new Error(`applyPlan: set not found — ${yearKey}/${setId}`);

  const oldSent = (targetSet.sents ?? []).find((s) => s.id === oldSentId);
  if (!oldSent)
    throw new Error(`applyPlan: oldSentId not found in sents — ${oldSentId}`);

  const lines = oldSent.t.split("\n");
  const newSentIds = buildNewSentIds(oldSentId, lines);

  // 1. set.sents: oldSentId 제거 → newSents 삽입
  const newSents = lines.map((line, i) => ({
    ...oldSent,
    id: `${oldSentId}_${i + 1}`,
    t: line,
  }));
  const sentIdx = targetSet.sents.findIndex((s) => s.id === oldSentId);
  targetSet.sents.splice(sentIdx, 1, ...newSents);

  // 2. cs_ids Option A: oldSentId → 모든 newSentIds 확장
  for (const q of targetSet.questions ?? []) {
    for (const c of q.choices ?? []) {
      const idx = (c.cs_ids ?? []).indexOf(oldSentId);
      if (idx !== -1) {
        c.cs_ids.splice(idx, 1, ...newSentIds);
      }
    }
  }

  // 3. cs_spans: sent_id === oldSentId → 매칭 sub-sent ID 갱신
  const newSentsMap = new Map(newSents.map((s) => [s.id, s.t]));
  for (const q of targetSet.questions ?? []) {
    for (const c of q.choices ?? []) {
      for (const sp of c.cs_spans ?? []) {
        if (sp.sent_id !== oldSentId) continue;
        const matchEntry = newSents.find((ns) => ns.t.includes(sp.text));
        if (matchEntry) sp.sent_id = matchEntry.id;
        // no match → leave as-is (will be DEAD_CSSPAN_SENTID in next audit)
      }
    }
  }

  return { appliedSentIds: newSentIds };
}

/**
 * 적용 후 검증: oldSentId 가 sents 안 부재 + newSentIds 전부 존재 확인
 */
function verifyApply(dataObj, plan) {
  const { yearKey, setId, oldSentId, newSentIds: expectedIds } = plan;
  let targetSet = null;
  for (const domain of ["reading", "literature"]) {
    const sets = dataObj[yearKey]?.[domain];
    if (!Array.isArray(sets)) continue;
    const s = sets.find((x) => x.id === setId);
    if (s) {
      targetSet = s;
      break;
    }
  }
  if (!targetSet) return { ok: false, reason: "set not found after apply" };
  const sentIdSet = new Set((targetSet.sents ?? []).map((s) => s.id));
  if (sentIdSet.has(oldSentId))
    return { ok: false, reason: `oldSentId still present: ${oldSentId}` };
  const missing = expectedIds.filter((id) => !sentIdSet.has(id));
  if (missing.length > 0)
    return { ok: false, reason: `newSentIds missing: ${missing.join(", ")}` };
  return { ok: true };
}

// ─── detection (reusable — called for both dry-run and pre-apply scan) ─────────

function runDetection(dataObj, annObj, targetSets, sentArgFilter) {
  const findings = [];
  const migrationPlans = [];

  for (const { yearKey, set } of targetSets) {
    const sentIdSet = new Set((set.sents ?? []).map((s) => s.id));
    let sentFoundFlag = false;

    // ── SOURCE_VERSE_LINE_OVERFLOW ──────────────────────────────────────────
    for (const sent of set.sents ?? []) {
      if (sentArgFilter && sent.id !== sentArgFilter) continue;
      if (sentArgFilter) sentFoundFlag = true;

      if (sent.sentType !== "verse") continue;
      const lines = (sent.t ?? "").split("\n");
      if (lines.length <= OVERFLOW_THRESHOLD) continue;

      const subSentTexts = lines.map((l, i) => ({
        id: `${sent.id}_${i + 1}`,
        t: l,
      }));
      const newSentIds = buildNewSentIds(sent.id, lines);
      const mapping = buildMapping(sent.id, lines);
      const affected = findAffected(
        annObj,
        yearKey,
        set,
        sent.id,
        subSentTexts,
      );
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
          annotations: affected.annotationRefs.map(
            (a) => `bracket [${a.label}]`,
          ),
          cs_ids: affected.csIdsRefs,
          cs_spans: affected.csSpansRefs,
          visual_marks: "(auto-regenerated — no action)",
        },
        safeToApply: safeResult.safe,
        safeToApply_reason: safeResult.reason,
      });
    }

    // sentArg 지정 + set 안 미발견 → SENT_NOT_FOUND
    if (sentArgFilter && !sentFoundFlag && set.id === targetArg) {
      const subSentPrefix = `${sentArgFilter}_`;
      const subSents = Array.from(sentIdSet).filter((id) =>
        id.startsWith(subSentPrefix),
      );
      findings.push({
        family: "SENT_SEGMENTATION_DEFECT",
        code: "SENT_NOT_FOUND",
        severity: "INFO",
        yearKey,
        setId: set.id,
        sentId: sentArgFilter,
        detail:
          subSents.length > 0
            ? `sentId not found (already split → sub-sents detected: ${subSents.slice(0, 3).join(", ")}${subSents.length > 3 ? ` ... +${subSents.length - 3}` : ""})`
            : "sentId not found in set.sents",
      });
    }

    // ── DEAD_CSSPAN_SENTID (full set scan) ─────────────────────────────────
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

  return { findings, migrationPlans };
}

// ─── target sets ──────────────────────────────────────────────────────────────

let targetSets;
if (targetArg) {
  targetSets = iterateSets(
    data,
    (yk, s) => s.id === targetArg || yk === targetArg,
  );
  if (targetSets.length === 0) {
    process.stderr.write(`[WARN] target="${targetArg}" — 해당 set/year 없음\n`);
  }
} else {
  targetSets = iterateSets(data, null);
}

// ─── detect ───────────────────────────────────────────────────────────────────

const { findings, migrationPlans } = runDetection(
  data,
  ann,
  targetSets,
  sentArg,
);

// ─── console output ───────────────────────────────────────────────────────────

const sep = "═".repeat(67);
const dash = "─".repeat(50);
const mode = dryRun ? "--dry-run" : "--apply";

console.log("");
console.log(sep);
console.log(` step2_postprocess_vNext — SENT_SEGMENTATION_DEFECT [${mode}]`);
console.log(sep);
if (targetArg) console.log(` target : ${targetArg}`);
if (sentArg) console.log(` sent   : ${sentArg}`);
if (isFixtureMode) console.log(` fixture: ${DATA_PATH}`);
console.log("");

// SOURCE_VERSE_LINE_OVERFLOW
const overflowF = findings.filter(
  (f) => f.code === "SOURCE_VERSE_LINE_OVERFLOW",
);
if (overflowF.length > 0) {
  console.log("[ SOURCE_VERSE_LINE_OVERFLOW ] — WARNING");
  console.log(dash);
  for (const plan of migrationPlans) {
    const safe = plan.safeToApply ? "✓ true" : "✗ false";
    console.log(
      `  ${plan.yearKey} / ${plan.setId} / ${plan.oldSentId} (${plan.lineCount} lines)`,
    );
    console.log(`    safeToApply : ${safe}`);
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
for (const f of findings.filter((f) => f.code === "SENT_NOT_FOUND")) {
  console.log("[ SENT_NOT_FOUND ] — INFO");
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
const safePlans = migrationPlans.filter((p) => p.safeToApply);
const unsafePlans = migrationPlans.filter((p) => !p.safeToApply);
console.log(dash);
console.log("Summary:");
console.log(`  findings total    : ${findings.length}`);
console.log(`  overflow (WARNING): ${overflowF.length}`);
console.log(`  dead_csspan (CRIT): ${deadF.length}`);
console.log(`  migration_plans   : ${migrationPlans.length}`);
console.log(`  safe_plans        : ${safePlans.length}`);
console.log(`  unsafe_cases      : ${unsafePlans.length}`);
if (unsafePlans.length > 0) {
  console.log("  unsafe_cases:");
  for (const u of unsafePlans) {
    console.log(`    ${u.oldSentId}: ${u.safeToApply_reason}`);
  }
}
console.log("");

// ─── JSON output ──────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, "../out");
fs.mkdirSync(outDir, { recursive: true });

if (dryRun) {
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
  const outPath = path.join(outDir, "step2_vNext_report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log("JSON report → out/step2_vNext_report.json");
  console.log("");
  process.exit(0);
}

// ─── APPLY SECTION ────────────────────────────────────────────────────────────
// (--apply 시만 실행)

if (safePlans.length === 0) {
  console.log("[ APPLY ] safe_plans=0 — 적용 대상 없음.");
  if (unsafePlans.length > 0) {
    console.log(
      `  unsafe_cases ${unsafePlans.length}건 → 사용자 명시 path 후 manual apply 의무 (Lock SP2).`,
    );
  }
  console.log("");
  process.exit(0);
}

// 1. Backup
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupDir = path.join(outDir, "backups");
fs.mkdirSync(backupDir, { recursive: true });
const backupFile = path.join(backupDir, `all_data_204_backup_${ts}.json`);

const backupSource = DATA_PATH;
fs.copyFileSync(backupSource, backupFile);
console.log(`[ APPLY ] backup → ${path.relative(process.cwd(), backupFile)}`);

// 2. Apply each safe plan (in-memory)
const applyResults = [];
for (const plan of safePlans) {
  try {
    const result = applyPlan(data, plan);
    applyResults.push({ plan, result, error: null });
    console.log(
      `[ APPLY ] ✓ ${plan.oldSentId} → ${result.appliedSentIds.length} sub-sents`,
    );
  } catch (err) {
    applyResults.push({ plan, result: null, error: err.message });
    console.log(`[ APPLY ] ✗ ${plan.oldSentId}: ${err.message}`);
  }
}

// 3. Verify (in-memory, before write)
const verifyFails = [];
for (const { plan, result, error } of applyResults) {
  if (error) {
    verifyFails.push({ oldSentId: plan.oldSentId, reason: error });
    continue;
  }
  const vr = verifyApply(data, plan);
  if (!vr.ok) {
    verifyFails.push({ oldSentId: plan.oldSentId, reason: vr.reason });
    console.log(`[ VERIFY ] ✗ ${plan.oldSentId}: ${vr.reason}`);
  } else {
    console.log(
      `[ VERIFY ] ✓ ${plan.oldSentId}: oldSentId 부재 + ${plan.newSentIds.length} newSentIds 존재 확인`,
    );
  }
}

if (verifyFails.length > 0) {
  console.log("");
  console.log(
    `[ ABORT ] verify 실패 ${verifyFails.length}건 — write 중단 (backup 보존).`,
  );
  for (const f of verifyFails) {
    console.log(`  ${f.oldSentId}: ${f.reason}`);
  }
  console.log("");
  process.exit(1);
}

// 4. Write
console.log("");
console.log("[ APPLY ] 검증 통과 — data 파일 write 중...");
fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
console.log(
  `[ APPLY ] ✓ write 완료: ${path.relative(process.cwd(), DATA_PATH)}`,
);

// 5. Post-apply report
const applyReport = {
  applied_at: new Date().toISOString(),
  target: targetArg,
  sent: sentArg,
  data_path: DATA_PATH,
  backup_path: backupFile,
  applied_plans: applyResults
    .filter((r) => !r.error)
    .map((r) => ({
      oldSentId: r.plan.oldSentId,
      yearKey: r.plan.yearKey,
      setId: r.plan.setId,
      lineCount: r.plan.lineCount,
      newSentCount: r.result.appliedSentIds.length,
      newSentIds: r.result.appliedSentIds,
    })),
  unsafe_cases: unsafePlans.map((p) => ({
    oldSentId: p.oldSentId,
    reason: p.safeToApply_reason,
  })),
};
const reportPath = path.join(outDir, "step2_vNext_apply_report.json");
fs.writeFileSync(reportPath, JSON.stringify(applyReport, null, 2), "utf8");
console.log(`[ APPLY ] JSON report → out/step2_vNext_apply_report.json`);
console.log("");

console.log(dash);
console.log(
  `완료: ${applyResults.filter((r) => !r.error).length}건 적용 / unsafe ${unsafePlans.length}건 보류`,
);
if (unsafePlans.length > 0) {
  console.log("보류 항목 (Lock SP2 — 사용자 명시 path 후 manual apply 의무):");
  for (const u of unsafePlans) {
    console.log(`  ${u.oldSentId}: ${u.safeToApply_reason}`);
  }
}
console.log("");
