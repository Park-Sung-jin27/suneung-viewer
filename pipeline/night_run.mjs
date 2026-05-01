/**
 * night_run.mjs
 *
 * 밤새 tasks.json 읽어서 QA payload 자동 생성 → outputs/ 저장
 *
 * 사용법:
 *   node pipeline/night_run.mjs
 *   node pipeline/night_run.mjs --tasks pipeline/tasks.json
 *
 * 결과: pipeline/outputs/YYYY-MM-DD/
 *   ├── 2026수능_l2026b_Q22.txt
 *   ├── 2026수능_l2026c_Q29.txt
 *   └── run_log.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── 설정 ──────────────────────────────────────────────────────────────────
const TASKS_PATH = process.argv.find(a => a.startsWith("--tasks="))
  ?.split("=")[1] ?? path.join(__dirname, "tasks.json");

const today = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.join(__dirname, "outputs", today);
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const PAYLOAD_SCRIPT = path.join(__dirname, "gen_qa_payload.js");

// ── tasks.json 로드 ───────────────────────────────────────────────────────
if (!fs.existsSync(TASKS_PATH)) {
  console.error(`❌ tasks.json 없음: ${TASKS_PATH}`);
  process.exit(1);
}

const tasks = JSON.parse(fs.readFileSync(TASKS_PATH, "utf8"));
console.log(`\n📋 tasks.json 로드: ${tasks.length}개 작업`);
console.log(`📁 출력 폴더: ${OUT_DIR}\n`);

// ── 실행 ──────────────────────────────────────────────────────────────────
const log = { date: today, tasks: [] };

for (const task of tasks) {
  const { year, set, q } = task;

  if (!year || !set) {
    console.warn(`⚠️ 잘못된 task 건너뜀:`, task);
    continue;
  }

  const args = [year, set, q ? String(q) : "--all"].join(" ");
  const label = q ? `${year}_${set}_Q${q}` : `${year}_${set}_ALL`;
  const outFile = path.join(OUT_DIR, `${label}.txt`);

  process.stdout.write(`⏳ ${label} ... `);

  try {
    const output = execSync(
      `node "${PAYLOAD_SCRIPT}" ${args}`,
      { cwd: ROOT, encoding: "utf8", timeout: 30000 }
    );

    fs.writeFileSync(outFile, output);
    console.log(`✅ 저장됨`);
    log.tasks.push({ label, status: "success", file: outFile });
  } catch (err) {
    console.log(`❌ 실패: ${err.message.slice(0, 80)}`);
    log.tasks.push({ label, status: "failed", error: err.message.slice(0, 200) });
  }
}

// ── 로그 저장 ─────────────────────────────────────────────────────────────
const logPath = path.join(OUT_DIR, "run_log.json");
fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

const success = log.tasks.filter(t => t.status === "success").length;
const failed  = log.tasks.filter(t => t.status === "failed").length;

console.log(`\n${"─".repeat(50)}`);
console.log(`✅ 완료: ${success}건 / ❌ 실패: ${failed}건`);
console.log(`📁 결과 폴더: ${OUT_DIR}`);
console.log(`📋 로그: ${logPath}`);
console.log(`\n아침에 outputs/${today}/ 열어서 GPT QA 채팅에 붙여넣으세요.\n`);
