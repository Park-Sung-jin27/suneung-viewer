/**
 * pipeline/rerun_missing.cjs
 *
 * 미탑재 시험 PDF를 _done에서 _inbox로 복사하여 watch.js가 재처리하도록 함.
 * all_data_204.json에 해당 키가 없는 시험만 대상.
 *
 * 사용법:
 *   node pipeline/rerun_missing.cjs          # dry-run (복사 없이 목록만)
 *   node pipeline/rerun_missing.cjs --run    # 실제 복사 실행
 *
 * 이후 watch.js를 실행하면 _inbox의 PDF를 자동 처리합니다.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public", "data", "all_data_204.json");
const DONE_DIR = path.join(ROOT, "_done");
const INBOX_DIR = path.join(ROOT, "_inbox");

const dryRun = !process.argv.includes("--run");

// ── 전체 시험 목록 (2014~2021학년도) ──
const allExams = [];
for (let y = 2014; y <= 2016; y++) {
  for (const t of ["_6월A", "_6월B", "_9월A", "_9월B", "수능A", "수능B"]) {
    allExams.push(y + t);
  }
}
for (let y = 2017; y <= 2021; y++) {
  for (const t of ["_6월", "_9월", "수능"]) {
    allExams.push(y + t);
  }
}

const allData = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

if (!fs.existsSync(INBOX_DIR)) fs.mkdirSync(INBOX_DIR, { recursive: true });

let copied = 0;
let skipped = 0;
let notFound = 0;

console.log(
  dryRun
    ? "\n[DRY-RUN] 복사하지 않고 목록만 출력\n"
    : "\n[RUN] _inbox로 복사 시작\n",
);

for (const key of allExams) {
  if (allData[key]) {
    // 이미 탑재됨 — 스킵
    skipped++;
    continue;
  }

  // PDF 찾기: _done/폴더/ 또는 _inbox/
  const examPdf = `${key}_시험지.pdf`;
  const ansPdf = `${key}_정답.pdf`;
  const doneFolder = path.join(DONE_DIR, key);
  const doneFolderExam = path.join(doneFolder, examPdf);
  const doneFolderAns = path.join(doneFolder, ansPdf);
  const inboxExam = path.join(INBOX_DIR, examPdf);
  const inboxAns = path.join(INBOX_DIR, ansPdf);

  // 이미 _inbox에 있으면 스킵
  if (fs.existsSync(inboxExam) && fs.existsSync(inboxAns)) {
    console.log(`  📥 ${key}: 이미 _inbox에 있음`);
    copied++;
    continue;
  }

  // _done/폴더에서 복사
  if (fs.existsSync(doneFolderExam) && fs.existsSync(doneFolderAns)) {
    console.log(`  📋 ${key}: _done/${key}/ → _inbox/`);
    if (!dryRun) {
      fs.copyFileSync(doneFolderExam, inboxExam);
      fs.copyFileSync(doneFolderAns, inboxAns);
    }
    copied++;
    continue;
  }

  // _done/ 루트에 파일로 있는지
  const doneRootExam = path.join(DONE_DIR, examPdf);
  const doneRootAns = path.join(DONE_DIR, ansPdf);
  if (fs.existsSync(doneRootExam) && fs.existsSync(doneRootAns)) {
    console.log(`  📋 ${key}: _done/ (루트) → _inbox/`);
    if (!dryRun) {
      fs.copyFileSync(doneRootExam, inboxExam);
      fs.copyFileSync(doneRootAns, inboxAns);
    }
    copied++;
    continue;
  }

  console.log(`  ❌ ${key}: PDF 없음`);
  notFound++;
}

console.log(`\n=== 결과 ===`);
console.log(`  이미 탑재: ${skipped}개`);
console.log(`  _inbox 준비: ${copied}개`);
console.log(`  PDF 없음: ${notFound}개`);

if (dryRun && copied > 0) {
  console.log(`\n실제 복사하려면: node pipeline/rerun_missing.cjs --run`);
  console.log(`복사 후: node pipeline/watch.js 로 자동 처리`);
}
