// pipeline/watch.js
// Usage: node pipeline/watch.js
// _inbox/ 폴더에 [연도키]_시험지.pdf + [연도키]_정답.pdf 감지 시 index.js 자동 실행

import chokidar from "chokidar";
import { execSync } from "child_process";
import fs, { existsSync, mkdirSync, renameSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INBOX_DIR = path.resolve(__dirname, "../_inbox");
const DONE_DIR = path.resolve(__dirname, "../_done");
const PROCESSING = new Set(); // 중복 실행 방지
const fileMap = new Map(); // yearKey → { exam, answer }
const queue = [];
let isRunning = false;

async function processQueue() {
  if (isRunning || queue.length === 0) return;
  isRunning = true;
  const { yearKey, examPath, answerPath } = queue.shift();
  await tryRun(yearKey, examPath, answerPath);
  isRunning = false;
  processQueue(); // 다음 항목 처리
}

// 폴더 없으면 생성
[INBOX_DIR, DONE_DIR].forEach((d) => {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
});

// 파일명에서 연도키 추출
function extractYearKey(filename) {
  return path
    .basename(filename)
    .replace(/_시험지\.pdf$/i, "")
    .replace(/_정답\.pdf$/i, "");
}

// 시험지 / 정답 구분
function classifyFile(filename) {
  const base = path.basename(filename);
  if (base.includes("_시험지")) return "exam";
  if (base.includes("_정답")) return "answer";
  return null;
}

async function tryRun(yearKey, examPath, answerPath) {
  // all_data_204.json에서 이미 존재하는 연도키 확인
  const DATA_PATH = path.resolve(__dirname, "../public/data/all_data_204.json");
  if (existsSync(DATA_PATH)) {
    const allData = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
    if (allData[yearKey]) {
      console.log(`\n⏭️  [watch] ${yearKey} — 이미 데이터 존재, 스킵`);
      // _done/으로 이동
      const dest = path.join(DONE_DIR, yearKey);
      if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
      try {
        if (existsSync(examPath))
          renameSync(examPath, path.join(dest, path.basename(examPath)));
        if (existsSync(answerPath))
          renameSync(answerPath, path.join(dest, path.basename(answerPath)));
      } catch (e) {}
      return;
    }
  }

  if (PROCESSING.has(yearKey)) return;

  PROCESSING.add(yearKey);
  console.log(`\n🚀 [watch] ${yearKey} — 시험지+정답 감지, 파이프라인 시작`);
  console.log(`  시험지: ${path.basename(examPath)}`);
  console.log(`  정답표: ${path.basename(answerPath)}`);

  try {
    // [TEST_MODE ENFORCED] watcher 실행은 항상 테스트 모드.
    // 부모 셸 설정과 무관하게 child 환경변수에 TEST_MODE=true 강제 주입 →
    // pipeline/index.js::mergeSection 이 all_data_204.json 을 건드리지 않는다.
    // 실 운영 병합이 필요하면 `node pipeline/index.js ...` 직접 실행할 것.
    const childEnv = { ...process.env, TEST_MODE: "true" };
    console.log("[watch] TEST_MODE=true 강제 주입 → merge 차단");
    execSync(
      `node pipeline/index.js "${examPath}" "${answerPath}" "${yearKey}" 45`,
      {
        stdio: "inherit",
        cwd: path.resolve(__dirname, ".."),
        env: childEnv,
      },
    );

    // 완료 시 _done으로 이동
    if (!existsSync(DONE_DIR)) mkdirSync(DONE_DIR, { recursive: true });
    renameSync(examPath, path.join(DONE_DIR, path.basename(examPath)));
    renameSync(answerPath, path.join(DONE_DIR, path.basename(answerPath)));
    console.log(`\n✅ [watch] ${yearKey} 완료 → _done/`);

    // annotation 입력 양식 자동 생성
    try {
      const templateScript = path.resolve(
        __dirname,
        "gen_annotation_template.cjs",
      );
      execSync(`node "${templateScript}" "${yearKey}"`, {
        stdio: "inherit",
        cwd: path.resolve(__dirname, ".."),
      });
    } catch (err) {
      console.warn(`⚠️  [watch] annotation 양식 생성 실패: ${err.message}`);
    }
  } catch (err) {
    console.error(`\n❌ [watch] ${yearKey} 파이프라인 실패: ${err.message}`);
    console.error(`   _inbox/ 폴더의 파일을 확인하세요.`);
  } finally {
    PROCESSING.delete(yearKey);
    fileMap.delete(yearKey);
  }
}

// 감시 시작
const watcher = chokidar.watch(INBOX_DIR, {
  depth: 0, // _inbox/ 바로 아래 파일만
  ignoreInitial: false, // 시작 시 이미 있는 파일도 처리
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 500,
  },
});

watcher.on("add", (filePath) => {
  if (!filePath.toLowerCase().endsWith(".pdf")) return;

  const type = classifyFile(filePath);
  if (!type) {
    console.warn(
      `⚠️  [watch] 파일명 규칙 불일치 (무시): ${path.basename(filePath)}`,
    );
    console.warn(`   규칙: [연도키]_시험지.pdf 또는 [연도키]_정답.pdf`);
    return;
  }

  const yearKey = extractYearKey(filePath);
  console.log(
    `📄 [watch] 파일 감지: ${path.basename(filePath)} (${yearKey} / ${type})`,
  );

  // Map에 등록
  if (!fileMap.has(yearKey)) fileMap.set(yearKey, {});
  fileMap.get(yearKey)[type] = filePath;

  const entry = fileMap.get(yearKey);
  if (entry.exam && entry.answer) {
    queue.push({ yearKey, examPath: entry.exam, answerPath: entry.answer });
    console.log(`📋 [watch] 큐 추가: ${yearKey} (대기 ${queue.length}개)`);
    processQueue();
  }
});

console.log("👀 [watch] 폴더 감시 시작");
console.log(`   감시 경로: ${INBOX_DIR}`);
console.log(`   파일명 규칙: [연도키]_시험지.pdf + [연도키]_정답.pdf`);
console.log(`   예시: 2023수능_시험지.pdf + 2023수능_정답.pdf`);
console.log("   처리 방식: 순차 실행 (큐)");
console.log("   종료: Ctrl+C\n");
