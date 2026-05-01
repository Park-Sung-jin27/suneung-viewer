/**
 * read_outputs.mjs
 *
 * night_run 결과 파일 목록 + 내용 미리보기
 *
 * 사용법:
 *   node pipeline/read_outputs.mjs              # 오늘 날짜
 *   node pipeline/read_outputs.mjs 2026-04-20   # 특정 날짜
 *   node pipeline/read_outputs.mjs --all        # 전체 날짜
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.join(__dirname, "outputs");

const arg = process.argv[2];
const today = new Date().toISOString().slice(0, 10);

// 대상 날짜 폴더 결정
let targetDirs = [];
if (arg === "--all") {
  targetDirs = fs.readdirSync(OUT_ROOT)
    .filter(d => fs.statSync(path.join(OUT_ROOT, d)).isDirectory())
    .sort();
} else {
  const date = arg || today;
  targetDirs = [date];
}

for (const dir of targetDirs) {
  const dirPath = path.join(OUT_ROOT, dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`\n❌ 결과 없음: ${dir} (night_run이 실행되지 않았거나 날짜 확인 필요)`);
    continue;
  }

  const files = fs.readdirSync(dirPath).filter(f => f !== "run_log.json");
  const logPath = path.join(dirPath, "run_log.json");

  console.log(`\n${"═".repeat(60)}`);
  console.log(`📁 ${dir} — ${files.length}개 파일`);
  console.log(`${"═".repeat(60)}`);

  // 로그 요약
  if (fs.existsSync(logPath)) {
    const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
    const success = log.tasks.filter(t => t.status === "success").length;
    const failed  = log.tasks.filter(t => t.status === "failed").length;
    console.log(`✅ 성공: ${success}건 / ❌ 실패: ${failed}건`);
  }

  // 파일 목록 + 크기
  console.log(`\n파일 목록:`);
  for (const f of files.sort()) {
    const fPath = path.join(dirPath, f);
    const size = fs.statSync(fPath).size;
    const sizeStr = size > 1024 ? `${(size/1024).toFixed(1)}KB` : `${size}B`;
    console.log(`  📄 ${f} (${sizeStr})`);
  }

  // 첫 번째 파일 미리보기 (50줄)
  if (files.length > 0) {
    const firstFile = path.join(dirPath, files[0]);
    const content = fs.readFileSync(firstFile, "utf8");
    const lines = content.split("\n").slice(0, 50);
    console.log(`\n--- ${files[0]} 미리보기 (50줄) ---`);
    console.log(lines.join("\n"));
    if (content.split("\n").length > 50) {
      console.log(`... (${content.split("\n").length - 50}줄 더 있음)`);
    }
  }
}

console.log(`\n💡 특정 파일 전체 보기: type pipeline\\outputs\\${today}\\<파일명>.txt`);
