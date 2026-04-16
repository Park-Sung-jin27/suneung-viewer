/**
 * pipeline/annotate.js
 *
 * annotation 수동 입력 보조 스크립트.
 * 파이프라인 완료 후 별도 실행.
 *
 * 사용법:
 *   node pipeline/annotate.js [연도키]
 *   node pipeline/annotate.js 2025_9월
 *
 * 동작:
 *   1. 해당 연도 전체 sentId + 문장 텍스트 출력 (참고용)
 *   2. annotations.json 현재 상태 출력
 *   3. "편집 후 Enter" 대기
 *   4. sentId 유효성 검증
 *   5. npm run build 실행
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, "../public/data/all_data_204.json");
const ANN_PATH = path.resolve(__dirname, "../public/data/annotations.json");
const ROOT = path.resolve(__dirname, "..");

const yearKey = process.argv[2];
if (!yearKey) {
  console.error("사용법: node pipeline/annotate.js [연도키]");
  console.error("예시:  node pipeline/annotate.js 2025_9월");
  process.exit(1);
}

const allData = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const yd = allData[yearKey];
if (!yd) {
  console.error(
    `❌ 연도키 "${yearKey}" 없음. 존재하는 키: ${Object.keys(allData).join(", ")}`,
  );
  process.exit(1);
}

const ann = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));

// [B-12] draft 파서 — _annotation_drafts/<yearKey>.txt의 marker 섹션을 annotations.json에 반영
const DRAFT_PATH = path.resolve(
  __dirname,
  `../_annotation_drafts/${yearKey}.txt`,
);
if (process.argv.includes("--apply-draft") && fs.existsSync(DRAFT_PATH)) {
  const draftText = fs.readFileSync(DRAFT_PATH, "utf8");
  // 세트 단위로 파싱: 세트 헤더(set.id 줄) 뒤 marker: 섹션을 찾아 항목 수집
  const setIds = new Set();
  for (const sec of ["reading", "literature"])
    for (const s of yd[sec] || []) setIds.add(s.id);

  const lines = draftText.split(/\r?\n/);
  let currentSet = null;
  let inMarker = false;
  const markerByset = {}; // setId → [{type, marker, sentId, text}]

  // "  <마커> <sentId> "<어구>"" 포맷, 주석(#) 라인은 무시
  const MARKER_LINE =
    /^\s{2,}([ⓐ-ⓘ㉠-㉦①-⑨]|\[[A-E]\])\s+([a-zA-Z_0-9]+)\s+"([^"]+)"\s*$/;

  for (const raw of lines) {
    const setHeaderMatch = raw.match(/^([a-zA-Z_0-9]+)\s/);
    if (setHeaderMatch && setIds.has(setHeaderMatch[1])) {
      currentSet = setHeaderMatch[1];
      inMarker = false;
      continue;
    }
    if (/^marker:\s*$/.test(raw)) {
      inMarker = true;
      continue;
    }
    if (/^(bracket|box|underline)/.test(raw)) {
      inMarker = false;
      continue;
    }
    if (!inMarker || !currentSet) continue;
    if (/^\s*#/.test(raw)) continue; // 주석 라인 스킵
    const m = raw.match(MARKER_LINE);
    if (!m) continue;
    const [, marker, sentId, text] = m;
    if (!markerByset[currentSet]) markerByset[currentSet] = [];
    markerByset[currentSet].push({ type: "marker", marker, sentId, text });
  }

  // annotations.json에 병합 — 기존 항목 중 type:"marker" 만 교체
  if (!ann[yearKey]) ann[yearKey] = {};
  for (const [setId, markers] of Object.entries(markerByset)) {
    const existing = (ann[yearKey][setId] || []).filter(
      (a) => a.type !== "marker",
    );
    ann[yearKey][setId] = [...existing, ...markers];
  }
  fs.writeFileSync(ANN_PATH, JSON.stringify(ann, null, 2), "utf8");
  const total = Object.values(markerByset).flat().length;
  console.log(
    `\n✅ draft에서 marker ${total}개 파싱 → ${Object.keys(markerByset).length}개 세트 반영\n`,
  );
}

// ── 출력 헬퍼 ─────────────────────────────────────────────────────────────────
const W = process.stdout.columns || 80;
const line = (c = "─") => c.repeat(W);

function banner(msg) {
  console.log("\n" + "═".repeat(W));
  console.log("  " + msg);
  console.log("═".repeat(W));
}

// ── 1. sentId 참고표 출력 ─────────────────────────────────────────────────────
banner(`📄 ${yearKey} — sentId 참고표`);

for (const sec of ["reading", "literature"]) {
  for (const set of yd[sec] || []) {
    console.log(`\n  ┌─ [${set.id}] ${set.title || ""}`);
    for (const sent of set.sents || []) {
      const preview = (sent.text || sent.t || "")
        .slice(0, 60)
        .replace(/\n/g, " ");
      console.log(`  │  ${sent.id.padEnd(22)} ${preview}`);
    }
    console.log(`  └${"─".repeat(W - 4)}`);
  }
}

// ── 2. 현재 annotations.json 상태 출력 ────────────────────────────────────────
banner(`📌 annotations.json — "${yearKey}" 현재 상태`);

if (ann[yearKey]) {
  const entry = ann[yearKey];
  for (const [setId, items] of Object.entries(entry)) {
    console.log(`\n  [${setId}]`);
    for (const item of items) {
      if (item.type === "bracket") {
        console.log(
          `    bracket  [${item.label}]  ${item.sentFrom} ~ ${item.sentTo}`,
        );
      } else {
        console.log(
          `    ${item.type.padEnd(10)}  ${item.sentId.padEnd(22)}  "${item.text}"`,
        );
      }
    }
  }
} else {
  console.log(`\n  (아직 없음)\n`);
}

// ── 3. 안내 메시지 ─────────────────────────────────────────────────────────────
console.log("\n" + line());
console.log(`\n  📝 annotations.json 편집 방법:`);
console.log(`\n     파일 경로: ${ANN_PATH}`);
console.log(`\n     형식 예시:`);
console.log(`     {`);
console.log(`       "${yearKey}": {`);
console.log(`         "s1": [`);
console.log(
  `           { "type": "box",       "sentId": "r2026a_s3",   "text": "핵심 개념" },`,
);
console.log(
  `           { "type": "underline",  "sentId": "r2026a_s7",   "text": "어휘" }`,
);
console.log(`         ],`);
console.log(`         "l2026a": [`);
console.log(
  `           { "type": "bracket", "label": "A", "sentFrom": "l2026as4", "sentTo": "l2026as8" }`,
);
console.log(`         ]`);
console.log(`       }`);
console.log(`     }`);
console.log(`\n  type 종류: "box" | "underline" | "bracket"`);
console.log(`  bracket에는 sentId 대신 sentFrom + sentTo + label 사용\n`);
console.log(line());
console.log("\n  annotations.json 편집을 완료한 후 Enter를 누르세요.");
console.log("  (스킵하려면 Ctrl+C)\n");

// ── 4. 대기 ───────────────────────────────────────────────────────────────────
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.question("  → ", () => {
  rl.close();

  // ── 5. sentId 유효성 검증 ──────────────────────────────────────────────────
  const annNow = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));
  const entry = annNow[yearKey];

  if (!entry) {
    console.log("\n  ℹ️  annotation 없음 — 빌드만 진행합니다.\n");
  } else {
    // 유효한 sentId 집합 수집
    const validIds = new Set();
    for (const sec of ["reading", "literature"])
      for (const set of yd[sec] || [])
        for (const sent of set.sents || []) validIds.add(sent.id);

    let errors = 0;
    for (const [setId, items] of Object.entries(entry)) {
      for (const item of items) {
        if (item.type === "bracket") {
          if (!validIds.has(item.sentFrom)) {
            console.error(`  ❌ sentFrom 없음: ${item.sentFrom}  (${setId})`);
            errors++;
          }
          if (!validIds.has(item.sentTo)) {
            console.error(`  ❌ sentTo 없음: ${item.sentTo}  (${setId})`);
            errors++;
          }
        } else {
          if (!validIds.has(item.sentId)) {
            console.error(`  ❌ sentId 없음: ${item.sentId}  (${setId})`);
            errors++;
          }
        }
      }
    }

    if (errors > 0) {
      console.error(
        `\n  ⚠️  sentId 오류 ${errors}건. 위 참고표를 보고 수정 후 다시 실행하세요.`,
      );
      process.exit(1);
    }

    // annotation 개수 요약
    let total = 0;
    for (const items of Object.values(entry)) total += items.length;
    console.log(
      `\n  ✅ 검증 통과 — ${Object.keys(entry).length}개 세트, ${total}개 annotation`,
    );
  }

  // ── 6. src/data 동기화 ─────────────────────────────────────────────────────
  // (annotations.json은 src/data에만 있으므로 별도 동기화 불필요)

  // ── 7. 빌드 ───────────────────────────────────────────────────────────────
  console.log("\n  빌드 중...\n");
  try {
    execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
    console.log("\n" + "═".repeat(W));
    console.log(`  ✅ 완료: ${yearKey} annotation + 빌드`);
    console.log("═".repeat(W) + "\n");
  } catch {
    console.error("  ❌ 빌드 실패");
    process.exit(1);
  }
});
