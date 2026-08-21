// reextract_pilot.mjs — 미추출 재추출 파일럿 (발주 D-86)
//
// 목적: 1회차(2016_6월B)만 돌려 **추출 파이프라인이 옛 회차에 되는지** 본다.
//       all_data 에 병합하지 않는다. 별도 파일로만 낸다.
//
// 산출: pipeline/reextract/<yearKey>_<section>.json      (추출 원본)
//       pipeline/reextract/<yearKey>_<section>.log.txt   (경고·검증 로그)
//
// 🔴 stdout 리다이렉션을 쓰지 않는다(§13⑪ BOM 오염). fs.writeFileSync 로만 쓴다.
// 금지: all_data 병합. RELEASE_KEYS 변경. 18회차 일괄.
//
// 사용: node pipeline/reextract_pilot.mjs <yearKey> [section] [lastQuestion]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractStructure } from "./step2_extract.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yk = process.argv[2];
const section = process.argv[3] || "literature";
const last = parseInt(process.argv[4]) || 45;
if (!yk) { console.error("사용법: node pipeline/reextract_pilot.mjs <yearKey> [section] [lastQuestion]"); process.exit(1); }

const dir = path.join(ROOT, "_done", yk);
const pdf = fs.readdirSync(dir).find((f) => f.endsWith(".pdf") && f.includes("시험지"));
if (!pdf) { console.error(`🔴 시험지 PDF 없음: ${dir}`); process.exit(1); }

const OUT_DIR = path.join(ROOT, "pipeline/reextract");
fs.mkdirSync(OUT_DIR, { recursive: true });

// 콘솔 경고를 함께 남긴다 — 프로파일 GUARD 가 여기 찍힌다
const logs = [];
for (const k of ["log", "warn", "error"]) {
  const orig = console[k].bind(console);
  console[k] = (...a) => { logs.push(`[${k}] ${a.map(String).join(" ")}`); orig(...a); };
}

console.log(`[pilot] ${yk} / section=${section} / last=${last}`);
console.log(`[pilot] PDF: ${pdf}`);

const t0 = Date.now();
extractStructure(path.join(dir, pdf), yk, last, section)
  .then((res) => {
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const out = path.join(OUT_DIR, `${yk}_${section}.json`);
    fs.writeFileSync(out, JSON.stringify(res, null, 2), "utf8");
    fs.writeFileSync(path.join(OUT_DIR, `${yk}_${section}.log.txt`), logs.join("\n"), "utf8");

    const sets = Array.isArray(res) ? res : (res?.sets || res?.[section] || []);
    console.log(`\n## 결과 — ${secs}초`);
    console.log(`  세트 ${sets.length}개`);
    for (const s of sets)
      console.log(`   ${String(s.id).padEnd(10)} Q${(s.questions || []).map((q) => q.id).join(",")}` +
        `  sents=${(s.sents || []).length}  "${String(s.title || "").slice(0, 26)}"`);
    console.log(`  파일: ${path.relative(ROOT, out)}`);
  })
  .catch((e) => {
    fs.writeFileSync(path.join(OUT_DIR, `${yk}_${section}.log.txt`),
      logs.concat(["", `[FAIL] ${e.stack || e.message}`]).join("\n"), "utf8");
    console.error("🔴 실패:", e.message);
    process.exit(1);
  });
