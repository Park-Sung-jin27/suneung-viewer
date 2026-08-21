// pair_gate.mjs — 지문↔문항 짝 검사 게이트 (발주 D-86b ②)
//
// 왜 필요한가
//   본문도 진짜, 문항도 진짜, 개수도 맞는데 **서로 다른 지문끼리 붙은** 결함이 있다.
//   계수 검사·앵커 검사는 전부 통과한다. 2016_6월B 파일럿에서 실증:
//     l20166a — 문항 [31~33](고전시가) + 본문 [41~43](현대시)
//   그래서 병합 전 **필수 게이트**로 짝을 따로 본다.
//
// 판정식
//   세트의 문항 번호 구간 [a~b] 를 구한다.
//   원본에서 그 지시문 `[a~b]` 의 위치를 찾고, 다음 지시문 전까지를 그 세트의 원본 구간으로 본다.
//   산출물 sents 의 본문 문장이 **그 구간 안**에 있으면 통과, 다른 구간에 있으면 실패.
//
// 사용: node pipeline/pair_gate.mjs <yearKey> [section]
// 종료코드: 실패 세트가 있으면 1 — 병합 차단용
// 금지: 데이터 수정. (읽기 전용이다)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hard } from "./anchor.mjs";
import { pdfText } from "./set_ranges.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yk = process.argv[2];
const section = process.argv[3] || "all";
if (!yk) { console.error("사용법: node pipeline/pair_gate.mjs <yearKey> [section]"); process.exit(1); }

const file = path.join(ROOT, `pipeline/reextract/${yk}_${section === "all" ? "literature" : section}.json`);
if (!fs.existsSync(file)) { console.error(`🔴 산출물 없음: ${path.relative(ROOT, file)}`); process.exit(1); }
const res = JSON.parse(fs.readFileSync(file, "utf8"));
const secs = section === "all" ? ["reading", "literature"] : [section];
const sets = secs.flatMap((k) => (Array.isArray(res) ? res : res?.[k] || []));

const dir = path.join(ROOT, "_done", yk);
const pdf = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith(".pdf") && f.includes("시험지")));

// 원본을 읽기 순서(-raw)로 펴고, 지시문 위치로 구간을 나눈다.
const rawTxt = pdfText(pdf, false);
const marks = [];
for (const m of rawTxt.matchAll(/\[\s*(\d{1,2})\s*[~～∼]\s*(\d{1,2})\s*\]/g))
  marks.push({ from: Number(m[1]), to: Number(m[2]), at: m.index });
marks.sort((a, b) => a.at - b.at);

// 같은 구간이 여러 번 나오면(쪽 넘김) 가장 이른 것을 시작으로, 다음 **다른** 구간까지를 영역으로
const zones = new Map();   // "a-b" -> {start, end}
for (const [i, m] of marks.entries()) {
  const k = `${m.from}-${m.to}`;
  if (!zones.has(k)) zones.set(k, { start: m.at, end: rawTxt.length });
  let j = i + 1;
  while (j < marks.length && `${marks[j].from}-${marks[j].to}` === k) j++;
  if (j < marks.length) zones.get(k).end = Math.max(zones.get(k).end === rawTxt.length ? 0 : zones.get(k).end, marks[j].at);
}
// end 를 다시 정확히: 각 구간의 끝 = 그 구간 이후 처음 등장하는 다른 구간의 시작
for (const [k, z] of zones) {
  const next = marks.find((m) => m.at > z.start && `${m.from}-${m.to}` !== k);
  z.end = next ? next.at : rawTxt.length;
}

const H = hard(rawTxt);
// hard() 는 길이를 바꾸므로, 구간을 hard 좌표로 다시 잡는다
const hardIndexOf = (charPos) => hard(rawTxt.slice(0, charPos)).length;
for (const z of zones.values()) { z.hs = hardIndexOf(z.start); z.he = hardIndexOf(z.end); }

let pass = 0, fail = 0, skip = 0;
const rows = [];
for (const s of sets) {
  const qs = (s.questions || []).map((q) => Number(q.id)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!qs.length) { skip++; rows.push([s.id, "-", "보류", "문항 없음"]); continue; }
  const k = `${qs[0]}-${qs[qs.length - 1]}`;
  const z = zones.get(k);
  if (!z) { skip++; rows.push([s.id, k, "보류", "원본에 그 지시문 없음(단독 문항 등)"]); continue; }

  // 본문 앵커 — 충분히 긴 body/verse 문장 몇 개
  const cands = (s.sents || [])
    .filter((t) => !["workTag", "author", "footnote"].includes(t.sentType))
    .map((t) => hard(t.t || "")).filter((h) => h.length >= 20).slice(0, 5);
  if (!cands.length) { skip++; rows.push([s.id, k, "보류", "앵커로 쓸 본문 문장 없음"]); continue; }

  let inZone = 0, outZone = 0, notFound = 0, whereElse = null;
  for (const h of cands) {
    const probe = h.slice(0, 30);
    const at = H.indexOf(probe);
    if (at < 0) { notFound++; continue; }
    if (at >= z.hs && at < z.he) inZone++;
    else {
      outZone++;
      if (!whereElse) {
        const owner = [...zones.entries()].find(([, v]) => at >= v.hs && at < v.he);
        whereElse = owner ? `[${owner[0].replace("-", "~")}]` : "(구간 밖)";
      }
    }
  }
  if (inZone > outZone) { pass++; rows.push([s.id, k, "통과", `본문 ${inZone}/${cands.length} 자기 구간`]); }
  else if (outZone > 0) { fail++; rows.push([s.id, k, "🔴 실패", `본문이 ${whereElse} 구간에 있음 (자기 ${inZone} / 남 ${outZone})`]); }
  else { skip++; rows.push([s.id, k, "보류", `앵커 ${notFound}개 원본에서 못 찾음`]); }
}

console.log(`## 짝 검사 게이트 — ${yk} / ${section}`);
console.log(`  세트 ${sets.length}개 · 통과 ${pass} · 실패 ${fail} · 보류 ${skip}\n`);
console.log("| 세트 | 문항 구간 | 판정 | 근거 |");
console.log("|---|---|---|---|");
for (const r of rows) console.log(`| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`);

if (fail > 0) {
  console.log(`\n🔴 병합 차단 — 지문↔문항 짝이 어긋난 세트 ${fail}개`);
  process.exit(1);
}
console.log(`\n✅ 짝 검사 통과`);
