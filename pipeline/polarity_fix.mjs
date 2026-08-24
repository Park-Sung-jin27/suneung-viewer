// polarity_fix.mjs — 해설 결론 표지 극성 교정 (발주 2026-08-24 ②-A)
//
// answer_key + 발문 극성으로 참 ok 를 도출해 보니, 8건 모두 ok=false 가 맞고
// 결론 표지 ✅ 가 틀렸다. 그중 **본문 서술이 이미 선지를 부정한 4건**만 고친다.
//   본문이 선지를 긍정한 나머지 4건은 표지만 뒤집으면 본문과 모순되므로
//   step3 재생성 대상이다(--list-b 로 목록만 출력).
//
// 결론 표지 형식은 기존 6,840개와 같은 틀을 유지한다 — 표지 글자만 바꾸고
// 문장은 손대지 않는다.
//
// 사용: node pipeline/polarity_fix.mjs [--apply] [--list-b]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const APPLY = process.argv.includes("--apply");
const LIST_B = process.argv.includes("--list-b");

// (A) 본문이 이미 선지를 부정했다 — 표지만 ✅ → ❌
const A = [
  ["2016_6월A", "l20166e", 43, 1], ["2016_6월B", "l20166d", 43, 1],
  ["2018_9월", "r20189c", 42, 2], ["2021_9월", "l20219d", 32, 5],
];
// (B) 본문 서술도 선지를 긍정 — 해설 자체가 오답. 표지만 바꾸면 모순된다.
const B = [
  ["2014_9월A", "l20149d", 43, 5], ["2015_9월B", "l20159d", 45, 3],
  ["2016_6월B", "l20166b", 35, 5], ["2016_9월B", "l20169b", 34, 2],
];

const load = (yk) => JSON.parse(fs.readFileSync(path.join(STEP3, yk, "step4_result.json"), "utf8"));
const pick = (j, sid, qid, cn) => {
  const s = [...(j.reading || []), ...(j.literature || [])].find((x) => x.id === sid);
  const q = (s?.questions || []).find((x) => String(x.id) === String(qid));
  return (q?.choices || []).find((x) => String(x.num) === String(cn));
};

if (LIST_B) {
  console.log("## (B) step3 재생성 대상 — 본문 서술이 선지를 긍정한다\n");
  for (const [yk, sid, qid, cn] of B) {
    const c = pick(load(yk), sid, qid, cn);
    const a = String(c.analysis || "");
    const at = Math.max(a.lastIndexOf("✅"), a.lastIndexOf("❌"));
    console.log(`  ${yk} ${sid} Q${qid}#${cn}  ok=${c.ok}`);
    console.log(`    결론: ${a.slice(at, at + 80).replace(/\n/g, " ")}\n`);
  }
  process.exit(0);
}

console.log(`## 결론 표지 교정 ${APPLY ? "적용" : "DRY-RUN"} — (A) ${A.length}건\n`);
const byYk = {};
for (const [yk, ...rest] of A) (byYk[yk] ??= []).push(rest);

let n = 0;
for (const [yk, list] of Object.entries(byYk)) {
  const j = load(yk);
  for (const [sid, qid, cn] of list) {
    const c = pick(j, sid, qid, cn);
    if (!c) { console.log(`  🔴 ${yk} ${sid} Q${qid}#${cn} — 못 찾음`); continue; }
    const a = String(c.analysis || "");
    const at = a.lastIndexOf("✅");
    if (at < 0) { console.log(`  🔴 ${yk} ${sid} Q${qid}#${cn} — ✅ 표지 없음(이미 교정?)`); continue; }
    if (c.ok !== false) { console.log(`  🔴 ${yk} ${sid} Q${qid}#${cn} — ok 가 false 가 아니다. 중단`); continue; }
    const out = a.slice(0, at) + "❌" + a.slice(at + 1);
    console.log(`  ${yk} ${sid} Q${qid}#${cn}`);
    console.log(`     전: ${a.slice(at, at + 62).replace(/\n/g, " ")}`);
    console.log(`     후: ${out.slice(at, at + 62).replace(/\n/g, " ")}`);
    if (APPLY) c.analysis = out;
    n++;
  }
  if (APPLY) fs.writeFileSync(path.join(STEP3, yk, "step4_result.json"), JSON.stringify(j, null, 2), "utf8");
}
console.log(`\n## 교정 ${n}건 / 대상 ${A.length}건`);
console.log(`   (B) ${B.length}건은 step3 재생성 대상 — node pipeline/polarity_fix.mjs --list-b`);
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
