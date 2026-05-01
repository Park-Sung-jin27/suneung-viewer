/**
 * pipeline/gen_annotation_template.cjs
 *
 * 새로 탑재된 연도의 annotation 입력 양식을 자동 생성.
 * watch.js의 파이프라인 완료 직후 자동 실행됨.
 *
 * 사용법:
 *   node pipeline/gen_annotation_template.cjs <yearKey> [setId]
 *
 *   setId 미지정: 해당 연도 전체 세트 출력
 *   setId 지정:   해당 세트 하나만 출력 (대용량 로드 회피)
 *
 * 출력:
 *   콘솔 + _annotation_drafts/<yearKey>.txt
 *   setId 지정 시 _annotation_drafts/<yearKey>_<setId>.txt
 */

"use strict";

const fs = require("fs");
const path = require("path");

const yearKey = process.argv[2];
const setIdFilter = process.argv[3] || null;

if (!yearKey) {
  console.error(
    "사용법: node pipeline/gen_annotation_template.cjs <yearKey> [setId]",
  );
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public", "data", "all_data_204.json");
const DRAFT_DIR = path.join(ROOT, "_annotation_drafts");

if (!fs.existsSync(DATA_PATH)) {
  console.error("❌ 데이터 파일 없음:", DATA_PATH);
  process.exit(1);
}

// ── 데이터 로드 (해당 연도만 유지) ───────────────────────────────────────────
// 9MB+ JSON 전체를 메모리에 유지하지 않도록, yearKey 하위만 추출한 뒤
// 원본 참조를 놓아 다른 연도 트리는 즉시 GC 대상이 되게 한다.
let allData = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const yd = allData[yearKey];
if (!yd) {
  const keys = Object.keys(allData).join(", ");
  console.error(`❌ "${yearKey}" 없음. 존재하는 키: ${keys}`);
  process.exit(1);
}
// eslint-disable-next-line no-unused-vars
allData = null;

// setId 필터링 — reading/literature 양쪽에서 해당 set만 남김
let filteredSetCount = 0;
function getSets(sec) {
  const arr = yd[sec] || [];
  if (!setIdFilter) return arr;
  const matched = arr.filter((s) => s.id === setIdFilter);
  filteredSetCount += matched.length;
  return matched;
}

// ── 원문자 감지 + 직후 어구 추출 ──────────────────────────────────────────────
// 선지·지문에 등장하는 ⓐⓑⓒⓓⓔ / ㉠㉡㉢㉣㉤ / ①②③④⑤ / [A][B][C][D][E]
const MARKER_RE = /[ⓐ-ⓘ㉠-㉦①-⑨]|\[[A-E]\]/g;

// 어구 종결 기준 문자: 공백 / 주요 구두점 / 다른 마커
// (한국어는 단어 간 공백이 있으므로 공백을 1차 경계로 사용)
const WORD_STOP_RE = /[\s,.!?;:"'()\[\]{}⟨⟩《》「」『』【】‘’“”…·ⓐ-ⓘ㉠-㉦①-⑨]/;

function extractAfterMarker(text, markerIdx, marker) {
  const rest = text.substring(markerIdx + marker.length);
  // 앞쪽 공백 제거 후 종결 문자 전까지
  const trimmed = rest.replace(/^\s+/, "");
  let end = 0;
  while (end < trimmed.length && !WORD_STOP_RE.test(trimmed[end])) end++;
  return trimmed.substring(0, end);
}

function findMarkerSents(set) {
  // setId → [{marker, sentId, text, preview}]
  const results = [];
  for (const s of set.sents || []) {
    const t = s.t || "";
    const matches = [...t.matchAll(MARKER_RE)];
    if (!matches.length) continue;
    const seen = new Set();
    for (const m of matches) {
      const marker = m[0];
      if (seen.has(marker)) continue; // 같은 문장 내 동일 마커는 1회만
      seen.add(marker);
      const word = extractAfterMarker(t, m.index, marker);
      results.push({
        marker,
        sentId: s.id,
        text: word,
        preview: t.replace(/\s+/g, " ").trim().substring(0, 80),
      });
    }
  }
  return results;
}

// ── 템플릿 생성 ───────────────────────────────────────────────────────────────
const lines = [];
const W = 52;

lines.push(
  `=== ${yearKey}${setIdFilter ? " / " + setIdFilter : ""} annotations 입력 양식 ===`,
);
lines.push("");

for (const sec of ["reading", "literature"]) {
  for (const set of getSets(sec)) {
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

    // 원문자 자동 감지 → marker 섹션에 후보 주입 (직후 어구 포함)
    const markers = findMarkerSents(set);
    if (markers.length > 0) {
      lines.push("marker:");
      lines.push('  # 포맷: <마커> <sentId> "<어구>"');
      lines.push("  # 자동 추출된 어구가 정확하지 않으면 직접 수정");
      for (const m of markers) {
        lines.push(`  # ${m.marker} ${m.sentId} "${m.text}"  ← ${m.preview}`);
      }
    }
    lines.push("");
  }
}

lines.push("=".repeat(W));

if (setIdFilter && filteredSetCount === 0) {
  console.error(`❌ setId "${setIdFilter}" 없음 (yearKey: ${yearKey})`);
  process.exit(1);
}

const output = lines.join("\n");

// ── 콘솔 출력 ─────────────────────────────────────────────────────────────────
console.log("\n" + output);

// ── 파일 저장 ─────────────────────────────────────────────────────────────────
if (!fs.existsSync(DRAFT_DIR)) fs.mkdirSync(DRAFT_DIR, { recursive: true });

const fileName = setIdFilter
  ? `${yearKey}_${setIdFilter}.txt`
  : `${yearKey}.txt`;
const outPath = path.join(DRAFT_DIR, fileName);
fs.writeFileSync(outPath, output, "utf8");

console.log(`\n파일 저장: _annotation_drafts/${fileName}\n`);
