// reextract_verify.mjs — 재추출 산출물 검수 (발주 D-86)
//
// all_data 에 병합하기 전에, 별도 파일 상태에서 품질을 잰다.
//   ① 커버리지 — 원본 PDF 문항 번호 대비 몇 개를 뽑았나
//   ② 정답 대조 — ok + 발문 극성으로 정답을 도출해 공식 정답지와 맞춰 본다
//        🔴 ok 는 「정답」이 아니라 「선지 진술의 참/거짓」이다(D-54 확립).
//           positive 발문이면 ok=true 인 선지가 정답, negative 면 ok=false 인 선지가 정답.
//   ③ 본문 대조 — sents 가 원본 PDF 텍스트에 실재하는가 (앵커)
//   ④ 선지 대조 — choices[].t 가 원본에 실재하는가
//
// 사용: node pipeline/reextract_verify.mjs <yearKey> [section]
// 금지: 데이터 병합·수정. (읽기 전용이다)

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hard } from "./anchor.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yk = process.argv[2];
const section = process.argv[3] || "literature";
if (!yk) { console.error("사용법: node pipeline/reextract_verify.mjs <yearKey> [section]"); process.exit(1); }

const file = path.join(ROOT, `pipeline/reextract/${yk}_${section}.json`);
if (!fs.existsSync(file)) { console.error(`🔴 산출물 없음: ${path.relative(ROOT, file)}`); process.exit(1); }
const res = JSON.parse(fs.readFileSync(file, "utf8"));
const sets = Array.isArray(res) ? res : (res?.sets || res?.[section] || []);

// 원본 PDF 텍스트
const dir = path.join(ROOT, "_done", yk);
const pdf = fs.readdirSync(dir).find((f) => f.endsWith(".pdf") && f.includes("시험지"));
// 🔴 2단 조판 대응 — -layout 은 좌우 단을 한 줄에 섞어 문장을 끊는다.
//    -raw(읽기 순서)와 -layout 두 벌을 모두 만들어, 둘 중 하나에라도 있으면 확인으로 친다.
//    이걸 안 하면 멀쩡한 본문·선지가 대량으로 "못 찾음" 이 된다(1차 실행에서 실증).
const pdfOf = (args) => execFileSync("pdftotext", [...args, "-enc", "UTF-8", path.join(dir, pdf), "-"],
  { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
const H1 = hard(pdfOf(["-layout"]));
const H2 = hard(pdfOf(["-raw"]));

const key = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/answer_key.json"), "utf8"))[yk];
const ANS = key?.ans || {};

// ① 커버리지
const got = sets.flatMap((s) => (s.questions || []).map((q) => Number(q.id))).sort((a, b) => a - b);
console.log(`## ① 커버리지`);
console.log(`  세트 ${sets.length}개 · 문항 ${got.length}개 · 번호 ${got.join(",")}`);

// ② 정답 대조
console.log(`\n## ② 정답 대조 (ok + 발문 극성 → 정답)`);
let ansOk = 0, ansNg = 0, ansSkip = 0;
const ngList = [];
for (const s of sets)
  for (const q of s.questions || []) {
    const official = ANS[String(q.id)];
    const neg = /않은|아닌|없는|적절하지/.test(String(q.t || ""));
    const want = neg ? false : true;                       // 정답 선지의 ok 값
    const hits = (q.choices || []).filter((c) => c.ok === want).map((c) => c.num);
    if (official == null || hits.length !== 1) { ansSkip++; ngList.push({ q: q.id, official, hits, neg, why: official == null ? "공식정답 없음" : `정답 후보 ${hits.length}개` }); continue; }
    if (hits[0] === official) ansOk++;
    else { ansNg++; ngList.push({ q: q.id, official, hits, neg, why: "불일치" }); }
  }
console.log(`  일치 ${ansOk} · 불일치 ${ansNg} · 판정불가 ${ansSkip}`);
for (const x of ngList) console.log(`    Q${x.q}: 공식=${x.official} 도출=${x.hits.join("/") || "-"} (${x.neg ? "부정" : "긍정"}발문) — ${x.why}`);

// ③④ 본문·선지 대조
const inSrc = (t, min = 12) => {
  const h = hard(t);
  if (h.length < min) return null;                          // 너무 짧으면 판정 보류
  const probe = h.slice(0, Math.min(h.length, 30));
  return H1.includes(probe) || H2.includes(probe);
};
const tally = (items, label) => {
  let ok = 0, ng = 0, skip = 0; const bad = [];
  for (const [id, t] of items) {
    const r = inSrc(t);
    if (r === null) skip++; else if (r) ok++; else { ng++; if (bad.length < 6) bad.push([id, String(t).slice(0, 46)]); }
  }
  console.log(`\n## ${label}`);
  console.log(`  원본에서 확인 ${ok} · 못 찾음 ${ng} · 짧아서 보류 ${skip}`);
  for (const [id, t] of bad) console.log(`    🔴 ${id}: ${t}…`);
  return { ok, ng, skip };
};
tally(sets.flatMap((s) => (s.sents || []).map((t) => [`${s.id}/${t.id}`, t.t || ""])), "③ 본문(sents) 대조");
tally(sets.flatMap((s) => (s.questions || []).flatMap((q) => (q.choices || []).map((c) => [`${s.id}/Q${q.id}#${c.num}`, c.t || ""]))), "④ 선지 대조");

console.log(`\n산출물: ${path.relative(ROOT, file)}`);
