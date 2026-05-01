/**
 * pipeline/apply_para.cjs
 *
 * _para_drafts/<yearKey>.txt 에 작성한 문단 경계 정보를
 * all_data_204.json (public + src/data) 양쪽에 반영.
 *
 * 사용법:
 *   node pipeline/apply_para.cjs <yearKey>
 *
 * 입력 파일 형식 (_para_drafts/<yearKey>.txt):
 *   r20246a  독서 동기  ...
 *   ...sents 목록...
 *   para: 1 4 8 12
 *
 *   r20246b  ...
 *   para: 1 5 10
 *
 * 동작:
 *   - 각 setId의 body sents에 para 필드(1, 2, 3...) 부여
 *   - 기존 para 필드가 있으면 덮어씀
 *   - public/data/all_data_204.json, src/data/all_data_204.json 동시 업데이트
 */

"use strict";

const fs = require("fs");
const path = require("path");

const yearKey = process.argv[2];
if (!yearKey) {
  console.error("사용법: node pipeline/apply_para.cjs <yearKey>");
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_PATH = path.join(ROOT, "public", "data", "all_data_204.json");
const SRC_PATH = path.join(ROOT, "src", "data", "all_data_204.json");
const DRAFT_PATH = path.join(ROOT, "_para_drafts", `${yearKey}.txt`);

if (!fs.existsSync(DRAFT_PATH)) {
  console.error(`❌ 양식 파일 없음: ${DRAFT_PATH}`);
  process.exit(1);
}
if (!fs.existsSync(PUBLIC_PATH)) {
  console.error("❌ 데이터 파일 없음:", PUBLIC_PATH);
  process.exit(1);
}

// ── 양식 파싱 ─────────────────────────────────────────────────────────────────
const draftText = fs.readFileSync(DRAFT_PATH, "utf8");
const lines = draftText.split("\n");

/**
 * 반환: { setId: [startNums] } — startNums는 해당 문단이 시작하는 sent 번호 배열
 * e.g. { r20246a: [1, 4, 8, 12], r20246b: [1, 5, 10] }
 */
function parseDraft(lines) {
  const result = {};
  let curSetId = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // setId 헤더 감지: r20246a, l20246b 등으로 시작하는 줄
    const headerMatch = trimmed.match(/^([rl]\d+[a-z]+(?:_[a-z0-9]+)?)\s/);
    if (headerMatch) {
      curSetId = headerMatch[1];
      continue;
    }

    // para: 줄 감지
    if (trimmed.startsWith("para:") && curSetId) {
      const rest = trimmed.slice("para:".length).trim();
      if (!rest) continue; // 비어있으면 건너뜀
      const nums = rest
        .split(/\s+/)
        .map((n) => parseInt(n.replace(/^s/, ""), 10))
        .filter((n) => !isNaN(n));
      if (nums.length > 0) {
        result[curSetId] = nums;
      }
    }
  }
  return result;
}

const paraMap = parseDraft(lines);

if (Object.keys(paraMap).length === 0) {
  console.error(
    '❌ 파싱된 para 정보가 없습니다. 양식에 "para: 1 4 8 ..." 형식으로 입력되어 있는지 확인하세요.',
  );
  process.exit(1);
}

console.log("\n파싱된 문단 경계:");
for (const [sid, nums] of Object.entries(paraMap)) {
  console.log(
    `  ${sid}: ${nums.map((n, i) => `s${n}=▶${i + 1}문단`).join("  ")}`,
  );
}

// ── 데이터 적용 ───────────────────────────────────────────────────────────────
function applyToData(filePath) {
  if (!fs.existsSync(filePath)) return false;

  const allData = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const yd = allData[yearKey];
  if (!yd) {
    console.warn(`  ⚠️  ${filePath}: "${yearKey}" 없음, 건너뜀`);
    return false;
  }

  let totalApplied = 0;

  for (const [setId, startNums] of Object.entries(paraMap)) {
    // reading 에서 set 찾기
    const set = (yd.reading || []).find((s) => s.id === setId);
    if (!set) {
      console.warn(`  ⚠️  "${setId}" 지문을 찾을 수 없음`);
      continue;
    }

    // startNums를 오름차순 정렬
    const sorted = [...startNums].sort((a, b) => a - b);

    // 각 body sent에 para 번호 부여
    let applied = 0;
    for (const sent of set.sents || []) {
      if (
        [
          "workTag",
          "omission",
          "author",
          "footnote",
          "figure",
          "image",
        ].includes(sent.sentType)
      )
        continue;

      const numMatch = sent.id.match(/s(\d+)$/);
      const sentNum = numMatch ? parseInt(numMatch[1], 10) : -1;
      if (sentNum < 0) continue;

      // 이 sent가 속한 문단 번호 결정
      let paraNum = 1;
      for (let i = 0; i < sorted.length; i++) {
        if (sentNum >= sorted[i]) paraNum = i + 1;
      }
      sent.para = paraNum;
      applied++;
    }

    console.log(
      `  ✅ ${setId}: ${applied}개 sent에 para 적용 (${sorted.length}문단)`,
    );
    totalApplied += applied;
  }

  fs.writeFileSync(filePath, JSON.stringify(allData, null, 2), "utf8");
  console.log(
    `  → 저장 완료: ${filePath} (총 ${totalApplied}개 sent 업데이트)`,
  );
  return true;
}

console.log("\n[public] 데이터 업데이트:");
applyToData(PUBLIC_PATH);

console.log("\n[src/data] 데이터 업데이트:");
applyToData(SRC_PATH);

console.log("\n✅ 완료\n");
