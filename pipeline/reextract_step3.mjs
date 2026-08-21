// reextract_step3.mjs — 파일럿 산출물에 step3(정답·해설) 연결 (발주 D-86b ④)
//
// step2 는 구조만 낸다. ok·pat·analysis·cs_ids 는 sanitize 로 벗겨진다.
// step3 가 그것들을 채운다. 다만 step3 는 정답키를 **평면 {문항번호: 정답}** 으로 받고,
// pipeline/answer_key.json 은 {회차: {src, ans}} 구조라 변환이 필요하다.
//
// 산출: pipeline/reextract/step3/<yearKey>/step2_result.json  (step3 입력)
//       pipeline/reextract/step3/<yearKey>/answer_key.json     (평면 정답키)
//       pipeline/reextract/step3/<yearKey>/step3_result.json   (step3 출력)
//
// 사용: node pipeline/reextract_step3.mjs <yearKey> [section]
// 금지: all_data 병합. (여기서도 별도 파일로만 낸다)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yk = process.argv[2];
const section = process.argv[3] || "literature";
if (!yk) { console.error("사용법: node pipeline/reextract_step3.mjs <yearKey> [section]"); process.exit(1); }

const src = path.join(ROOT, `pipeline/reextract/${yk}_${section}.json`);
if (!fs.existsSync(src)) { console.error(`🔴 산출물 없음: ${path.relative(ROOT, src)}`); process.exit(1); }

const OUT = path.join(ROOT, "pipeline/reextract/step3", yk);
fs.mkdirSync(OUT, { recursive: true });

// step2 결과를 그대로 옮긴다 (reading/literature 두 축 유지)
const res = JSON.parse(fs.readFileSync(src, "utf8"));
const structure = {
  reading: Array.isArray(res) ? [] : res.reading || [],
  literature: Array.isArray(res) ? res : res.literature || [],
};
fs.writeFileSync(path.join(OUT, "step2_result.json"), JSON.stringify(structure, null, 2), "utf8");

// 정답키를 평면으로
const all = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/answer_key.json"), "utf8"));
const ans = all[yk]?.ans;
if (!ans) { console.error(`🔴 정답키에 ${yk} 없음`); process.exit(1); }
const flat = {};
for (const [k, v] of Object.entries(ans)) flat[String(k)] = Number(v);
fs.writeFileSync(path.join(OUT, "answer_key.json"), JSON.stringify(flat, null, 2), "utf8");

const nq = structure.reading.concat(structure.literature)
  .reduce((a, s) => a + (s.questions || []).length, 0);
console.log(`## step3 입력 준비 완료 — ${yk}`);
console.log(`  세트 ${structure.reading.length + structure.literature.length}개 · 문항 ${nq}개`);
console.log(`  정답키 ${Object.keys(flat).length}문항`);
console.log(`  경로: ${path.relative(ROOT, OUT)}`);
console.log(`\n다음 명령으로 step3 를 돌린다:`);
console.log(`  node pipeline/step3_analysis.js ${path.relative(ROOT, path.join(OUT, "step2_result.json"))} ${path.relative(ROOT, path.join(OUT, "answer_key.json"))}`);
