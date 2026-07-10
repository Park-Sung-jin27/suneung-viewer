import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const SOURCE = path.join(ROOT, "컨설팅_데모");
const TARGET = path.join(ROOT, "public", "consulting-demo");

const FILES = [
  "index.html",
  "css/main.css",
  "js/data.js",
  "js/trend_data.js",
  "js/jeonhyeong_files.js",
  "js/gyogwa_banyeong.js",
  "js/scenario_engine.js",
  "js/susi_minreq.js",
];

function copyFile(relativePath) {
  const sourcePath = path.join(SOURCE, relativePath);
  const targetPath = path.join(TARGET, relativePath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing consulting demo file: ${relativePath}`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

export function copyConsultingDemo() {
  fs.rmSync(TARGET, { recursive: true, force: true });
  for (const file of FILES) copyFile(file);
  console.log(`Copied consulting demo to ${path.relative(ROOT, TARGET)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  copyConsultingDemo();
}
