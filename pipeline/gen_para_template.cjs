/**
 * pipeline/gen_para_template.cjs
 *
 * 독서 지문의 문단 경계 표시 양식을 자동 생성.
 * para 필드를 all_data_204.json에 추가하기 위한 사전 작업.
 *
 * 사용법:
 *   node pipeline/gen_para_template.cjs <yearKey>
 *
 * 출력:
 *   콘솔 + _para_drafts/<yearKey>.txt
 *
 * 형식 예시:
 *   r20246a  독서 동기  (16 sents)
 *   --- sents ---
 *   s1: 선생님의 권유나 친구의...
 *   s2: 독서 동기는 '독서를...
 *   ...
 *   --- para 경계 입력 ---
 *   para: s1 s4 s8 s12     ← 각 문단이 시작하는 sentId (숫자만 or 전체 ID)
 *
 * 완성 후 apply_para.cjs로 데이터에 반영.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const yearKey = process.argv[2];
if (!yearKey) {
  console.error("사용법: node pipeline/gen_para_template.cjs <yearKey>");
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public", "data", "all_data_204.json");
const DRAFT_DIR = path.join(ROOT, "_para_drafts");

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

const lines = [];
lines.push(`=== ${yearKey} 독서 지문 문단 경계 입력 양식 ===`);
lines.push("");
lines.push("★ 작성 규칙:");
lines.push(
  "  · para 줄에 각 문단이 시작하는 sentId 숫자를 공백으로 구분하여 입력",
);
lines.push(
  "  · 예) para: 1 4 8 12   → s1=1문단, s4=2문단, s8=3문단, s12=4문단",
);
lines.push("  · 반드시 s1(첫 sent)은 항상 1문단 시작으로 포함");
lines.push("");

for (const set of yd.reading || []) {
  const bodySents = (set.sents || []).filter(
    (s) =>
      ![
        "workTag",
        "omission",
        "author",
        "footnote",
        "figure",
        "image",
      ].includes(s.sentType),
  );
  if (!bodySents.length) continue;

  const qIds = (set.questions || []).map((q) => q.id).filter(Boolean);
  const qRange = qIds.length
    ? `${Math.min(...qIds)}~${Math.max(...qIds)}번`
    : set.range || "";

  lines.push(`${"─".repeat(60)}`);
  lines.push(
    `${set.id}  ${set.title || ""}  ${qRange}  (body sents: ${bodySents.length}개)`,
  );
  lines.push("");

  // sent 목록 출력 (번호 + 텍스트 앞 60자)
  for (const s of bodySents) {
    // sentId 숫자 추출: r20246a_s3 → 3, l20246as5 → 5
    const numMatch = s.id.match(/s(\d+)$/);
    const num = numMatch ? numMatch[1] : s.id;
    const preview = (s.t || "").replace(/\s+/g, " ").trim().slice(0, 65);
    lines.push(`  s${num}: ${preview}`);
  }

  lines.push("");
  lines.push(`para: `);
  lines.push("");
}

lines.push("=".repeat(60));

const output = lines.join("\n");
console.log("\n" + output);

if (!fs.existsSync(DRAFT_DIR)) fs.mkdirSync(DRAFT_DIR, { recursive: true });
const outPath = path.join(DRAFT_DIR, `${yearKey}.txt`);
fs.writeFileSync(outPath, output, "utf8");
console.log(`\n파일 저장: _para_drafts/${yearKey}.txt\n`);
