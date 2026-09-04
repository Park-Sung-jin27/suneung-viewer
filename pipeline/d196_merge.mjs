// d196_merge.mjs — l20279b 한 세트를 all_data 에 편입한다 (발주 D-196 ②)
//
// ★ step6_merge.js 를 쓰지 않는 이유 두 가지 — 둘 다 이 발주에서 사고가 된다
//   ① `JSON.stringify(allData, null, 2)` 로 쓴다. 정본은 minified 1줄(§13⑪)이라
//      회차 하나 넣으려다 10.9MB 파일 전체가 재포맷된다. binary·diff:unset 속성상
//      줄 diff 가 안 나오니 그 사고를 눈으로 잡을 방법도 없다.
//   ② 입력에 없는 기존 세트를 **배열 뒤에 다시 붙인다**(step6_merge.js:89~95).
//      단건 입력이면 l20279b 가 0번으로 올라가고 a·c·d 가 뒤로 밀려 순서가 뒤집힌다.
//   그래서 이 세트만 제 자리에 꽂는 전용 도구를 쓴다. 다른 세트는 건드리지 않는다.
//
// ★ 삽입 위치는 range 로 정한다 — 배열 순서가 화면 순서다.
//   l20279a[18~21] · l20279c[28~31] · l20279d[32~34] 사이에서 22~27 은 index 1 이다.
//   위치를 상수로 박지 않고 range 시작 번호로 계산해 검산한다.
//
// 사용: node pipeline/d196_merge.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const SRC = path.join(ROOT, "pipeline/test_data/d196_l20279b/step4_result.json");
const SRC_FALLBACK = path.join(ROOT, "pipeline/test_data/d196_l20279b/step3_result.json");
const YK = "2027_9월", SEC = "literature", SID = "l20279b";
const ANS = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/test_data/answer_2027_9월.json"), "utf8"));
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const LIT_PATS = new Set(["L1", "L2", "L3", "L4", "L5"]);
const REQUIRES_CS = new Set(["R1", "R2", "R4", "L1", "L2", "L4", "L5"]); // quality_gate.mjs:2506

const srcPath = fs.existsSync(SRC) ? SRC : SRC_FALLBACK;
if (!fs.existsSync(srcPath)) {
  console.error(`🔴 원천이 없다 — step3/step4 를 먼저 돌리십시오\n   ${path.relative(ROOT, SRC).replace(/\\/g, "/")}\n   ${path.relative(ROOT, SRC_FALLBACK).replace(/\\/g, "/")}`);
  process.exit(1);
}
const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const src = JSON.parse(fs.readFileSync(srcPath, "utf8"));
const newSet = (src[SEC] || []).find((x) => (x.setId || x.id) === SID);

console.log(`# ${SID} 편입 (D-196 ②)`);
console.log("");
console.log(`- 원천 \`${path.relative(ROOT, srcPath).replace(/\\/g, "/")}\``);
console.log(`- all_data MD5 \`${md5(before)}\` · ${before.length}B`);
console.log("");

const fail = [];
if (!newSet) fail.push(`원천에 ${SID} 없음`);
const arr = data[YK]?.[SEC];
if (!Array.isArray(arr)) fail.push(`${YK}.${SEC} 배열 없음`);
if (arr?.some((x) => (x.setId || x.id) === SID)) fail.push(`🔴 ${SID} 가 이미 all_data 에 있다 — 중복 삽입 위험`);

// ── 내용 검사 — 하나라도 어긋나면 쓰지 않는다 ────────────────────────────
let pos = null;
if (!fail.length) {
  const qs = newSet.questions || [];
  const cs = qs.flatMap((q) => q.choices || []);
  console.log("## 편입 전 내용 검사");
  console.log("");
  const rows = [];
  const add = (label, ok, detail) => { rows.push([label, ok, detail]); if (!ok) fail.push(`${label} — ${detail}`); };

  add("문항 6개", qs.length === 6, `${qs.length}개 (${qs.map((q) => q.id).join(",")})`);
  add("선지 30개", cs.length === 30, `${cs.length}개`);
  const withA = cs.filter((c) => c.analysis && String(c.analysis).trim()).length;
  add("analysis 30/30", withA === 30, `${withA}/30`);

  // 정답표 대조 — ok 는 정답표와 questionType 에서 나온다
  const bad = [];
  for (const q of qs) {
    const correct = ANS[String(q.id)];
    if (correct == null) { bad.push(`Q${q.id} 정답표 없음`); continue; }
    const pick = (q.choices || []).filter((c) => c.ok === (q.questionType === "positive"));
    if (pick.length !== 1) { bad.push(`Q${q.id} ok 패턴 ${pick.length}개`); continue; }
    if (String(pick[0].num) !== String(correct)) bad.push(`Q${q.id} 정답 ${correct} vs 데이터 ${pick[0].num}`);
  }
  add("정답표 6문항 일치", bad.length === 0, bad.length ? bad.join(" · ") : `Q22~27 = ${qs.map((q) => ANS[String(q.id)]).join(",")}`);

  // pat — 문학 세트이므로 L 계열만 (도메인 관례 · docs/backlog_pat_criteria.md)
  const patBad = cs.filter((c) => (c.ok === true ? c.pat != null : !LIT_PATS.has(c.pat)));
  add("pat 도메인 (정답 null · 오답 L1~L5)", patBad.length === 0,
    patBad.length ? patBad.map((c) => `#${c.num}=${JSON.stringify(c.pat)}`).join(" ") : `오답 ${cs.filter((c) => c.ok === false).length}건 전부 L 계열`);

  // 근거 필수 pat 의 cs_ids 공백 — CRITICAL 예고
  const csMiss = [];
  for (const q of qs) for (const c of q.choices || []) {
    const empty = !c.cs_ids || c.cs_ids.length === 0;
    if (!empty) continue;
    if (c.ok === true || (c.ok === false && REQUIRES_CS.has(c.pat))) csMiss.push(`Q${q.id}#${c.num}(${c.ok ? "정답" : c.pat})`);
  }
  add("근거 필수 선지 cs_ids 공백 0", csMiss.length === 0, csMiss.length ? csMiss.join(" ") : "0건");

  // cs_ids 가 실재 문장을 가리키는가
  const ids = new Set((newSet.sents || []).map((x) => String(x.id)));
  const dangling = [];
  for (const q of qs) for (const c of q.choices || []) for (const id of c.cs_ids || [])
    if (!ids.has(String(id))) dangling.push(`Q${q.id}#${c.num}→${id}`);
  add("cs_ids 정박 유효", dangling.length === 0, dangling.length ? dangling.join(" ") : `참조 ${cs.reduce((a, c) => a + (c.cs_ids || []).length, 0)}건 전부 실재`);

  // 스키마 — 기존 세트와 키 집합이 같아야 한다
  const ref = arr.find((x) => (x.setId || x.id) === "l20279a");
  const kd = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => (k in a) !== (k in b));
  add("세트 키 동일", kd(newSet, ref).length === 0, kd(newSet, ref).join(",") || "일치");
  add("문항 키 동일", kd(qs[0], ref.questions[0]).length === 0, kd(qs[0], ref.questions[0]).join(",") || "일치");

  // 삽입 위치 — range 시작 번호로 계산
  const startOf = (s) => Number(String(s.range || "").match(/(\d+)/)?.[1] ?? NaN);
  const mine = startOf(newSet);
  pos = arr.findIndex((s) => startOf(s) > mine);
  if (pos < 0) pos = arr.length;
  add("삽입 위치 계산", Number.isFinite(mine) && pos === 1,
    `range ${newSet.range} → start ${mine} · index ${pos} (${arr.map((s) => (s.setId || s.id) + "[" + s.range + "]").join(" ")})`);

  console.log("| 검사 | 결과 |");
  console.log("|---|---|");
  for (const [label, ok, detail] of rows) console.log(`| ${label} | ${ok ? "✅" : "🔴"} ${detail} |`);
  console.log("");
}

if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); console.log(""); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("✅ 사전 검사 통과");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d196.json"), before);
const pre = JSON.parse(before.toString("utf8"));
arr.splice(pos, 0, newSet);
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");                 // §13⑪ minified

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
const bad2 = [];
if (after[0] === 0xef) bad2.push("BOM");
let nl = 0; for (const x of after) if (x === 10) nl++;
if (nl !== 0) bad2.push(`개행 ${nl} — minified 규약 위반`);
const back = JSON.parse(after.toString("utf8"));
const now = back[YK][SEC];
if (now.length !== pre[YK][SEC].length + 1) bad2.push(`세트 수 ${pre[YK][SEC].length} → ${now.length}`);
if ((now[pos].setId || now[pos].id) !== SID) bad2.push(`index ${pos} 가 ${SID} 가 아니다`);
if (JSON.stringify(now[pos]) !== JSON.stringify(newSet)) bad2.push("삽입된 세트가 원천과 다르다");
if (now.filter((x) => (x.setId || x.id) === SID).length !== 1) bad2.push("중복 삽입");
// 다른 세트·회차 전건 무변
for (const [yk, v] of Object.entries(pre)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  const sid = st.setId || st.id;
  const cur = (back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
  if (JSON.stringify(st) !== JSON.stringify(cur)) bad2.push(`${yk}::${sid} 가 달라졌다`);
}
// 순서 — 다른 세트끼리의 상대 순서가 유지됐는가
const oldOrder = pre[YK][SEC].map((s) => s.setId || s.id).join(",");
const newOrder = now.map((s) => s.setId || s.id).filter((x) => x !== SID).join(",");
if (oldOrder !== newOrder) bad2.push(`기존 순서 변경: ${oldOrder} → ${newOrder}`);

console.log(`- 적용 후 MD5 \`${md5(after)}\` · ${after.length}B (+${after.length - before.length})`);
console.log(`- 편입 위치 index ${pos} — ${now.map((s) => (s.setId || s.id) + "[" + s.range + "]").join(" ")}`);
console.log("- 백업 `pipeline/backups/all_data_204.before_d196.json`");
console.log("");
if (bad2.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad2.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- ${SID} 1건만 추가 · 중복 0 · 원천과 바이트 동일`);
console.log("- 기존 세트 상대 순서 유지 · 다른 세트·회차 전건 무변 · minified 유지");
