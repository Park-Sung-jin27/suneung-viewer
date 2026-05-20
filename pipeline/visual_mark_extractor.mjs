/**
 * pipeline/visual_mark_extractor.mjs
 *
 * bracket / underline / box / inline_label 사양 자동 추출 + visual_marks.json 생성.
 *
 * 단일 source of truth: public/data/visual_marks.json
 * 검수 raw:          pipeline/visual_marks_report.json
 *
 * 실행:
 *   node pipeline/visual_mark_extractor.mjs                       → 전체 set
 *   node pipeline/visual_mark_extractor.mjs --year=2024수능         → 특정 연도
 *   node pipeline/visual_mark_extractor.mjs --release-only         → release 39 set 단독
 *   node pipeline/visual_mark_extractor.mjs --dry-run              → 출력 X (검수만)
 *
 * extractor logic (4 step):
 *   1. all_data 본문 안 [A]~[F] 자동 추출 (auto_text_parser)
 *      - workTag t="[X]" → type=bracket, sent_range (직전 verse 연속)
 *      - body/verse 안 인라인 [X] → type=inline_label, text_span
 *   2. annotations.json bracket/underline/box → migrated_from_annotations
 *   3. 문항/선지/해설 안 [X] 참조 cross-check → release_block 결정
 *   4. bracket_audit cross-check → status 결정 (broken / needs_human)
 *
 * 정합 contract: docs/visual_marks_contract.md
 * schema:        pipeline/visual_marks_schema.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { auditBrackets } from "./bracket_audit.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_PATH = "public/data/all_data_204.json";
const ANN_PATH = "public/data/annotations.json";
const OUT_PATH = "public/data/visual_marks.json";
const REPORT_PATH = "pipeline/visual_marks_report.json";

// ─── 인자 처리 ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const yearArg = args
  .find((a) => a.startsWith("--year="))
  ?.slice("--year=".length);
const releaseOnly = args.includes("--release-only");
const dryRun = args.includes("--dry-run");

// ─── commit chain ─────────────────────────────────────────────────────────
function safeGit(cmd) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}
function isAncestor(maybeAncestor, descendant) {
  // 정합 사양: maybeAncestor commit 안 descendant commit 안 ancestor 사양
  // → descendant 안 maybeAncestor 변경 사양 모두 포함 path 정합
  if (!maybeAncestor || maybeAncestor === "unknown") return false;
  if (!descendant || descendant === "unknown") return false;
  if (maybeAncestor === descendant) return true;
  try {
    execSync(`git merge-base --is-ancestor ${maybeAncestor} ${descendant}`, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true; // exit code 0 = ancestor
  } catch {
    return false; // exit code != 0 = not ancestor
  }
}
function getCommitChain() {
  const audit_commit = safeGit("git rev-parse HEAD") || "unknown";
  const data_commit =
    safeGit("git log -1 --format=%H -- " + DATA_PATH) || "unknown";
  const ann_commit =
    safeGit("git log -1 --format=%H -- " + ANN_PATH) || "unknown";
  const viewer_commit = safeGit("git log -1 --format=%H -- src/") || "unknown";
  // ancestry check path 정합 — audit 안 data/ann/viewer 모두 포함 path
  const audit_includes_data = isAncestor(data_commit, audit_commit);
  const audit_includes_ann = isAncestor(ann_commit, audit_commit);
  const audit_includes_viewer = isAncestor(viewer_commit, audit_commit);
  const mixed_commit =
    audit_commit === "unknown" ||
    !audit_includes_data ||
    !audit_includes_ann ||
    !audit_includes_viewer;
  return {
    audit_commit,
    data_commit,
    ann_commit,
    viewer_commit,
    mixed_commit,
    audit_includes_data,
    audit_includes_ann,
    audit_includes_viewer,
  };
}

// ─── 데이터 로드 ──────────────────────────────────────────────────────────
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const ann = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));

// release 39 set 자동 검출
function loadReleaseSetIds() {
  const dir = path.resolve(__dirname, "release_approval_records");
  if (!fs.existsSync(dir)) return new Set();
  const ids = new Set();
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^QG-(.+?)-(.+?)-release-approval\.json$/);
    if (!m) continue;
    ids.add(`${m[1]}/${m[2]}`);
  }
  return ids;
}
const releaseSet = loadReleaseSetIds();

// ─── helper ───────────────────────────────────────────────────────────────
function* iterSets() {
  for (const yk of Object.keys(data)) {
    if (yearArg && yk !== yearArg) continue;
    for (const sec of ["reading", "literature"]) {
      if (!data[yk] || !data[yk][sec]) continue;
      for (const set of data[yk][sec]) {
        if (!set.id) continue;
        if (releaseOnly && !releaseSet.has(`${yk}/${set.id}`)) continue;
        yield { yearKey: yk, section: sec, set };
      }
    }
  }
}

let idCounter = 0;
function newId(yearKey, setId, type, label) {
  idCounter++;
  return `vm_${yearKey}_${setId}_${type}_${label || "x"}_${idCounter}`;
}

// 문항/선지/해설 안 [X] 참조 cross-check
function safeStr(v) {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") return JSON.stringify(v);
  return "";
}
function findReferences(set, label) {
  const labelStr = `[${label}]`;
  const refs = [];
  for (const q of set.questions || []) {
    if (safeStr(q.t).includes(labelStr)) refs.push({ qId: q.id, loc: "stem" });
    if (safeStr(q.bogi).includes(labelStr))
      refs.push({ qId: q.id, loc: "bogi" });
    for (const c of q.choices || []) {
      if (safeStr(c.t).includes(labelStr))
        refs.push({ qId: q.id, loc: "choice", choiceNum: c.num });
      if (safeStr(c.analysis).includes(labelStr))
        refs.push({ qId: q.id, loc: "analysis", choiceNum: c.num });
    }
  }
  return refs;
}

// ─── Step 1: source 자동 추출 ─────────────────────────────────────────────
function extractSourceMarks() {
  const marks = [];
  for (const { yearKey, set } of iterSets()) {
    const sents = set.sents || [];

    // 1-a: workTag bracket — adjacent verse/body 연속 path
    //   - End-marker style (verses 사양 안 sentTo 사후 workTag): walk backward (예: l2022d)
    //   - Start-marker style (workTag 사양 안 sentFrom 사전 verses): walk forward (예: l2022a)
    for (let i = 0; i < sents.length; i++) {
      const s = sents[i];
      if (s.sentType !== "workTag") continue;
      const m = s.t.match(/^\[([A-F])\]$/);
      if (!m) continue;
      const label = m[1];

      const prevIsContent =
        i > 0 &&
        (sents[i - 1].sentType === "verse" || sents[i - 1].sentType === "body");
      const nextIsContent =
        i < sents.length - 1 &&
        (sents[i + 1].sentType === "verse" || sents[i + 1].sentType === "body");

      let sentIds = [];
      let startSentId = null;
      let endSentId = null;
      let endOffset = 0;

      if (prevIsContent) {
        // End-marker style: walk backward
        let startIdx = i - 1;
        while (
          startIdx >= 0 &&
          (sents[startIdx].sentType === "verse" ||
            sents[startIdx].sentType === "body")
        ) {
          startIdx--;
        }
        startIdx = Math.max(startIdx + 1, 0);
        sentIds = sents.slice(startIdx, i).map((x) => x.id);
        startSentId = sentIds[0];
        endSentId = sentIds[sentIds.length - 1];
        endOffset = sents[i - 1].t.length;
      } else if (nextIsContent) {
        // Start-marker style: walk forward
        let endIdx = i + 1;
        while (
          endIdx < sents.length &&
          (sents[endIdx].sentType === "verse" ||
            sents[endIdx].sentType === "body")
        ) {
          endIdx++;
        }
        endIdx = Math.min(endIdx, sents.length);
        sentIds = sents.slice(i + 1, endIdx).map((x) => x.id);
        startSentId = sentIds[0];
        endSentId = sentIds[sentIds.length - 1];
        endOffset = sents[endIdx - 1].t.length;
      }

      if (sentIds.length === 0) continue;
      marks.push({
        id: newId(yearKey, set.id, "bracket", label),
        yearKey,
        setId: set.id,
        type: "bracket",
        label,
        target: "sent_range",
        sentIds,
        start: { sentId: startSentId, offset: 0 },
        end: { sentId: endSentId, offset: endOffset },
        source: "auto_text_parser",
        status: "verified",
        release_block: false, // will be set in Step 3
        audit_source: "SOURCE_WORKTAG_BRACKET",
      });
    }

    // 1-b: inline_label — body/verse sents 안 [X] 인라인 path
    for (const s of sents) {
      if (!s.t) continue;
      if (s.sentType !== "body" && s.sentType !== "verse") continue;
      const labelPattern = /\[([A-F])\]/g;
      const seen = new Set();
      for (const m of s.t.matchAll(labelPattern)) {
        const label = m[1];
        const offset = m.index;
        const key = `${s.id}_${label}_${offset}`;
        if (seen.has(key)) continue;
        seen.add(key);
        marks.push({
          id: newId(yearKey, set.id, "inline_label", label),
          yearKey,
          setId: set.id,
          type: "inline_label",
          label,
          target: "text_span",
          sentIds: [s.id],
          start: { sentId: s.id, offset },
          end: { sentId: s.id, offset: offset + 3 }, // "[X]" = 3 chars
          source: "auto_text_parser",
          status: "verified",
          release_block: false,
          audit_source: "SOURCE_INLINE_LABEL",
        });
      }
    }
  }
  return marks;
}

// ─── Step 2: annotation 마이그레이션 ──────────────────────────────────────
function extractAnnotationMarks() {
  const marks = [];
  for (const { yearKey, set } of iterSets()) {
    const arr = (ann[yearKey] && ann[yearKey][set.id]) || [];
    const sentIds = new Set((set.sents || []).map((s) => s.id));
    const sents = set.sents || [];

    for (const a of arr) {
      if (a.type === "bracket") {
        const fromIdx = sents.findIndex((s) => s.id === a.sentFrom);
        const toIdx = sents.findIndex((s) => s.id === a.sentTo);
        const range =
          fromIdx >= 0 && toIdx >= 0 ? sents.slice(fromIdx, toIdx + 1) : [];
        marks.push({
          id: newId(yearKey, set.id, "bracket", a.label),
          yearKey,
          setId: set.id,
          type: "bracket",
          label: a.label || null,
          target: "sent_range",
          sentIds: range.map((s) => s.id),
          start: { sentId: a.sentFrom, offset: 0 },
          end: {
            sentId: a.sentTo,
            offset: range.length > 0 ? range[range.length - 1].t.length : 0,
          },
          source: "migrated_from_annotations",
          status: "verified",
          release_block: false,
          audit_source: "ANNOTATION_BRACKET",
        });
      } else if (a.type === "underline" || a.type === "box") {
        marks.push({
          id: newId(yearKey, set.id, a.type, null),
          yearKey,
          setId: set.id,
          type: a.type,
          label: null,
          target: "text_span",
          sentIds: [a.sentId],
          start: { sentId: a.sentId, offset: 0 },
          end: { sentId: a.sentId, offset: (a.text || "").length },
          text: a.text || "",
          source: "migrated_from_annotations",
          status: "verified",
          release_block: false,
          audit_source: "ANNOTATION_" + a.type.toUpperCase(),
        });
      }
    }
  }
  return marks;
}

// ─── Step 3: 문항/선지 cross-reference ────────────────────────────────────
function applyReferenceCrossCheck(marks) {
  for (const mark of marks) {
    if (!mark.label) continue;
    if (!["bracket", "inline_label"].includes(mark.type)) continue;
    const loc = findSet(mark.setId);
    if (!loc) continue;
    const refs = findReferences(loc.set, mark.label);
    mark.referenced_in = refs;
    if (refs.length > 0) {
      mark.release_block = true;
    } else {
      mark.release_block = false;
      mark.status = "non_blocking";
    }
  }
}
function findSet(setId) {
  for (const yk of Object.keys(data)) {
    for (const sec of ["reading", "literature"]) {
      if (!data[yk] || !data[yk][sec]) continue;
      const set = data[yk][sec].find((s) => s.id === setId);
      if (set) return { yearKey: yk, section: sec, set };
    }
  }
  return null;
}

// ─── Step 4: bracket_audit cross-check ────────────────────────────────────
function applyBracketAuditCrossCheck(marks) {
  const findings = auditBrackets(data, ann);
  // index: setId/label → finding
  const findingIdx = {};
  for (const f of findings) {
    const key = `${f.setId}/${f.label}`;
    if (!findingIdx[key]) findingIdx[key] = [];
    findingIdx[key].push(f);
  }

  for (const mark of marks) {
    if (mark.type !== "bracket") continue;
    if (!mark.label) continue;
    const key = `${mark.setId}/${mark.label}`;
    const fs_ = findingIdx[key];
    if (!fs_ || fs_.length === 0) continue;

    const codes = fs_.map((f) => f.code).join(",");
    mark.audit_source += " + " + codes;

    // DETECTOR_FALSE_POSITIVE 제외한 실제 CRITICAL 여부 판정
    const hasRealCritical = fs_.some(
      (f) =>
        f.severity === "CRITICAL" && f.family !== "DETECTOR_FALSE_POSITIVE",
    );
    const hasFalsePositive = fs_.some(
      (f) => f.family === "DETECTOR_FALSE_POSITIVE",
    );

    if (hasRealCritical) {
      // 구조 결함(DEAD/INVERTED) → broken; 기타 CRITICAL → needs_human
      const isStructural = fs_.some(
        (f) => f.severity === "CRITICAL" && /DEAD|INVERTED/.test(f.code),
      );
      mark.status = isStructural ? "broken" : "needs_human";
    } else if (hasFalsePositive) {
      // annotation 단독 시각화 정합 — status = "verified"
      mark.status = "verified";
    } else if (mark.status === "verified") {
      mark.status = "needs_human";
    }
  }
}

// ─── 메인 흐름 ────────────────────────────────────────────────────────────
console.log("═".repeat(60));
console.log(" VISUAL MARK EXTRACTOR");
console.log("═".repeat(60));

const chain = getCommitChain();
console.log("[ Commit chain ]");
console.log("  audit:  " + chain.audit_commit.substring(0, 12));
console.log("  data:   " + chain.data_commit.substring(0, 12));
console.log("  ann:    " + chain.ann_commit.substring(0, 12));
console.log("  viewer: " + chain.viewer_commit.substring(0, 12));
console.log("  mixed:  " + chain.mixed_commit);
console.log("");

const sourceMarks = extractSourceMarks();
const annMarks = extractAnnotationMarks();
console.log("[ Step 1 - source ]      " + sourceMarks.length + " marks");
console.log("[ Step 2 - annotations ] " + annMarks.length + " marks");

// ─── Dedup: 동일 setId + type=bracket + label 안 중복 제거 ─────────────────
// 우선순위: migrated_from_annotations (사용자 PDF 검증 완료 path) > auto_text_parser
function dedupBrackets(marks) {
  const seen = {}; // key = setId/label → mark (winner)
  const result = [];
  // First pass: index by setId/label, preferring annotation source
  for (const m of marks) {
    if (m.type !== "bracket" || !m.label) {
      result.push(m);
      continue;
    }
    const key = `${m.setId}/${m.label}`;
    const existing = seen[key];
    if (!existing) {
      seen[key] = m;
    } else {
      // existing 사양 안 annotation source 사양 우선 유지 — 외 path 안 새로 들어온 entry 안 정합 검토
      const existingPrio =
        existing.source === "migrated_from_annotations" ? 1 : 0;
      const incomingPrio = m.source === "migrated_from_annotations" ? 1 : 0;
      if (incomingPrio > existingPrio) seen[key] = m;
    }
  }
  // Second pass: emit non-bracket + dedupped bracket
  const emittedKeys = new Set();
  for (const m of marks) {
    if (m.type !== "bracket" || !m.label) continue;
    const key = `${m.setId}/${m.label}`;
    if (emittedKeys.has(key)) continue;
    emittedKeys.add(key);
    result.push(seen[key]);
  }
  return result;
}
const beforeDedup =
  sourceMarks.filter((m) => m.type === "bracket" && m.label).length +
  annMarks.filter((m) => m.type === "bracket" && m.label).length;
const allMarks = dedupBrackets([...sourceMarks, ...annMarks]);
const afterDedup = allMarks.filter(
  (m) => m.type === "bracket" && m.label,
).length;
console.log(
  "[ Dedup ] bracket entries: " +
    beforeDedup +
    " → " +
    afterDedup +
    " (delta -" +
    (beforeDedup - afterDedup) +
    ")",
);

applyReferenceCrossCheck(allMarks);
console.log("[ Step 3 - reference cross-check ] applied");

applyBracketAuditCrossCheck(allMarks);
console.log("[ Step 4 - bracket_audit cross-check ] applied");

// ─── 통계 ─────────────────────────────────────────────────────────────────
const byType = {};
const byStatus = {};
let releaseBlocking = 0;
for (const m of allMarks) {
  byType[m.type] = (byType[m.type] || 0) + 1;
  byStatus[m.status] = (byStatus[m.status] || 0) + 1;
  if (m.release_block) releaseBlocking++;
}

console.log("");
console.log("[ Summary ]");
console.log("  total: " + allMarks.length);
console.log("  by type:   " + JSON.stringify(byType));
console.log("  by status: " + JSON.stringify(byStatus));
console.log("  release_block: " + releaseBlocking);

// release_block + non-verified 검출
const blockingNonVerified = allMarks.filter(
  (m) => m.release_block && m.status !== "verified",
);
console.log("");
if (blockingNonVerified.length > 0) {
  console.log(
    `🔴 LOCK V2 — release_block=true + status≠verified : ${blockingNonVerified.length}건`,
  );
  for (const m of blockingNonVerified.slice(0, 20)) {
    console.log(
      `   [${m.status}] ${m.yearKey}/${m.setId} [${m.label}] ${m.type} :: ${m.audit_source}`,
    );
  }
  if (blockingNonVerified.length > 20) {
    console.log(`   ... ${blockingNonVerified.length - 20} more`);
  }
} else {
  console.log("✅ LOCK V2 정합 — release_block 사양 안 status=verified");
}

if (chain.mixed_commit) {
  console.log("");
  console.log("⚠ LOCK V3 — mixed_commit=true (audit/data/viewer 사양 불일치)");
  console.log("   release 판단 차단 의무 — commit 동기 사후 재실행 권고");
}

// ─── 출력 ─────────────────────────────────────────────────────────────────
const output = {
  generated_at: new Date().toISOString(),
  ...chain,
  summary: {
    total: allMarks.length,
    by_type: byType,
    by_status: byStatus,
    release_blocking: releaseBlocking,
  },
  marks: allMarks,
};

const report = {
  generated_at: output.generated_at,
  ...chain,
  summary: output.summary,
  release_blocking_non_verified: blockingNonVerified.map((m) => ({
    id: m.id,
    yearKey: m.yearKey,
    setId: m.setId,
    type: m.type,
    label: m.label,
    status: m.status,
    audit_source: m.audit_source,
  })),
};

if (dryRun) {
  console.log("\n[ dry-run ] 출력 X — 사용자 검수 path");
} else {
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log("\n📄 출력:");
  console.log("  " + OUT_PATH);
  console.log("  " + REPORT_PATH);
}

console.log("\n" + "═".repeat(60));
console.log("DONE");
