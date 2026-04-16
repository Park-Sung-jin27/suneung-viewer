/**
 * pipeline/gen_annotation_template.cjs
 *
 * 새로 탑재된 연도의 annotation 입력 양식을 자동 생성.
 * watch.js의 파이프라인 완료 직후 자동 실행됨.
 *
 * 사용법:
 *   node pipeline/gen_annotation_template.cjs <yearKey>
 *
 * 출력:
 *   콘솔 + _annotation_drafts/<yearKey>.txt
 */

"use strict";

const fs = require("fs");
const path = require("path");

const yearKey = process.argv[2];
if (!yearKey) {
  console.error("사용법: node pipeline/gen_annotation_template.cjs <yearKey>");
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public", "data", "all_data_204.json");
const DRAFT_DIR = path.join(ROOT, "_annotation_drafts");

if (!fs.existsSync(DATA_PATH)) {
  console.error("❌ 데이터 파일 없음:", DATA_PATH);
  process.exit(1);
}

const allData = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const yd = allData[yearKey];
if (!yd) {
  console.error(
    `❌ "${yearKey}" 없음. 존재하는 키: ${Object.keys(allData).join(", ")}`,
  );
  process.exit(1);
}

// ── 원문자 감지 ───────────────────────────────────────────────────────────────
// 선지·지문에 등장하는 ⓐⓑⓒⓓⓔ / ㉠㉡㉢㉣㉤ / ①②③④⑤ / [A][B][C][D][E]
const MARKER_RE = /[ⓐ-ⓘ㉠-㉦①-⑨]|\[[A-E]\]/g;

function findMarkerSents(set) {
  // setId → [{marker, sentId, preview}]
  const results = [];
  for (const s of set.sents || []) {
    const t = s.t || "";
    const found = t.match(MARKER_RE);
    if (!found) continue;
    const uniq = [...new Set(found)];
    for (const marker of uniq) {
      results.push({
        marker,
        sentId: s.id,
        preview: t.replace(/\s+/g, " ").trim().substring(0, 80),
      });
    }
  }
  return results;
}

// ── 템플릿 생성 ───────────────────────────────────────────────────────────────
const lines = [];
const W = 52;

lines.push(`=== ${yearKey} annotations 입력 양식 ===`);
lines.push("");

for (const sec of ["reading", "literature"]) {
  for (const set of yd[sec] || []) {
    const qIds = (set.questions || []).map((q) => q.id).filter(Boolean);
    const qRange = qIds.length
      ? `${Math.min(...qIds)}~${Math.max(...qIds)}번`
      : "";
    const title = (set.title || "").replace(/\n/g, " ").trim();

    lines.push(`${set.id}  ${title}  ${qRange}`);
    lines.push('bracket A: "" ~ ""');
    lines.push('bracket B: "" ~ ""');
    lines.push('box: ""');
    lines.push('underline: ""');

    // 원문자 자동 감지 → marker 섹션에 후보 주입
    const markers = findMarkerSents(set);
    if (markers.length > 0) {
      lines.push("marker:");
      lines.push("  # 포맷: <마커> <sentId> \"<어구>\"");
      lines.push("  # 아래 후보에서 \"???\"를 실제 어구로 교체하세요");
      for (const m of markers) {
        lines.push(
          `  # ${m.marker} ${m.sentId} "???"  ← ${m.preview}`,
        );
      }
    }
    lines.push("");
  }
}

lines.push("=".repeat(W));

const output = lines.join("\n");

// ── 콘솔 출력 ─────────────────────────────────────────────────────────────────
console.log("\n" + output);

// ── 파일 저장 ─────────────────────────────────────────────────────────────────
if (!fs.existsSync(DRAFT_DIR)) fs.mkdirSync(DRAFT_DIR, { recursive: true });

const outPath = path.join(DRAFT_DIR, `${yearKey}.txt`);
fs.writeFileSync(outPath, output, "utf8");

console.log(`\n파일 저장: _annotation_drafts/${yearKey}.txt\n`);
