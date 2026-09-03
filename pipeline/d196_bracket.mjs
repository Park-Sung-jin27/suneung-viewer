// d196_bracket.mjs — l20279b 구간 표시 신설 + 선지 오염 제거 (발주 D-196 마무리)
//
// ① annotations bracket 3건 — 심사관 원본 p8 300dpi 픽셀 실측 (2026-09-04)
//    [A] x=389.5pt · y 327.8~401.8 (라벨 y360.2~372.0) 왼쪽 칼럼 — 4행
//    [B] 갈고리형(2행짜리라 세로선이 짧아 프로그램 검출에 안 걸린다) 왼쪽 칼럼 — 2행
//        교차 검증: Q26 ㉮ 「자전거 바퀴살의 움직임에서 … 나락이 빻아지는 듯한 바람 소리」
//    [C] x=451.9pt · y 291.6~586.3 (라벨 y434.5~446.2) 오른쪽 칼럼 — 이명 일화 전체 + 코골이 일화 전체
//
//    ★ 내 추정은 틀렸다 — [A]를 s7~s11(5행)로 보고 「Q23 선지 6개가 전부 들어간다」를
//      근거로 삼았는데, 실측은 4행이고 '그럴 즈음'·'대낮'·'잡티 하나 없는 고요의'는
//      구간 밖이다. 오답 선지가 구간 밖 시어를 가져오는 것은 정상 설계다(심사관 판정).
//      선지 분포로 구간을 역산하지 않는다. 지면이 정본이다.
//
//    같은 회차 l20279a·c·d 는 workTag 문장 없이 bracket 만으로 렌더한다 — 같은 형태로 맞춘다.
//
// ② Q22#5 선지 본문 오염 — step2 가 지문 여백의 꺾쇠 라벨 3개를 선지 끝에 흘려 넣었다.
//    지면 ⑤는 「…의지를 강조하고 있다.」로 끝나고 [A][B][C] 가 없다.
//    해설은 이 라벨을 쓰지 않아 무관하다 — 선지 t 만 자른다.
//
// 사용: node pipeline/d196_bracket.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const ANN = path.join(ROOT, "public/data/annotations.json");
const YK = "2027_9월", SID = "l20279b";
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

// 실측 구간 — 시작·끝 행의 어구로 지정하고 sentId 는 데이터에서 찾는다
const BR = [
  { label: "A", head: "꽃, 새, 바위의 내부가 훤히", tail: "바다로 바뀐 탓일 게다", rows: 4 },
  { label: "B", head: "보랏빛 가을 찬바람이 정미소에", tail: "바퀴살 아래에서 자꾸만 빻아지는 소리", rows: 2 },
  { label: "C", head: "하고 좋아하면서 가만히 옆의 동무에게", tail: "나는 그런 적 없소이다", rows: null },
];
const TRIM = { qId: "22", num: 5, cut: "\n[A]\n[B]\n[C]", keepTail: "의지를 강조하고 있다." };

const beforeD = fs.readFileSync(DATA), beforeA = fs.readFileSync(ANN);
const data = JSON.parse(beforeD.toString("utf8"));
const ann = JSON.parse(beforeA.toString("utf8"));
const set = data[YK].literature.find((x) => (x.setId || x.id) === SID);
const ids = (set.sents || []).map((s) => String(s.id));
const findId = (frag) => {
  const hit = (set.sents || []).filter((s) => String(s.t).includes(frag));
  return hit.length === 1 ? String(hit[0].id) : { err: `${hit.length}곳` };
};

console.log("# l20279b 구간 표시 신설 + 선지 오염 제거 (D-196)");
console.log("");
console.log(`- all_data MD5 \`${md5(beforeD)}\` · annotations MD5 \`${md5(beforeA)}\``);
console.log("");

const fail = [], plans = [];
if ((ann[YK] || {})[SID]) fail.push(`annotations 에 ${SID} 항목이 이미 있다`);

console.log("## ① bracket 3건");
console.log("");
console.log("| 라벨 | sentFrom | sentTo | 행수 | 실측 대조 |");
console.log("|---|---|---|--:|---|");
for (const b of BR) {
  const f = findId(b.head), t = findId(b.tail);
  if (f.err) { fail.push(`[${b.label}] 시작 어구가 ${f.err}`); continue; }
  if (t.err) { fail.push(`[${b.label}] 끝 어구가 ${t.err}`); continue; }
  const i = ids.indexOf(f), k = ids.indexOf(t);
  if (i < 0 || k < 0 || k < i) { fail.push(`[${b.label}] 구간 순서가 어긋난다`); continue; }
  const n = k - i + 1;
  if (b.rows != null && n !== b.rows) { fail.push(`[${b.label}] 행수가 ${n} 인데 실측은 ${b.rows} 다`); continue; }
  plans.push({ label: b.label, sentFrom: f, sentTo: t, n });
  console.log(`| [${b.label}] | \`${f}\` | \`${t}\` | ${n} | ${b.rows != null ? `✅ 실측 ${b.rows}행 일치` : "이명+코골이 일화 전체"} |`);
}
console.log("");

console.log("## ② Q22#5 선지 오염 제거");
console.log("");
const q = set.questions.find((x) => String(x.id) === TRIM.qId);
const ch = q && q.choices.find((x) => x.num === TRIM.num);
let trimmed = null;
if (!ch) fail.push("Q22#5 없음");
else if (!String(ch.t).endsWith(TRIM.cut)) fail.push(`Q22#5 가 ${JSON.stringify(TRIM.cut)} 로 끝나지 않는다: ${JSON.stringify(String(ch.t).slice(-16))}`);
else {
  trimmed = String(ch.t).slice(0, -TRIM.cut.length);
  if (!trimmed.endsWith(TRIM.keepTail)) fail.push(`자른 뒤 끝이 ${JSON.stringify(TRIM.keepTail)} 가 아니다`);
  else {
    console.log("```");
    console.log("전: " + JSON.stringify(String(ch.t)));
    console.log("후: " + JSON.stringify(trimmed));
    console.log("```");
    console.log("");
  }
}
if ((String(ch?.analysis || "").match(/\[[ABC]\]/g) || []).length) fail.push("Q22#5 해설이 [A][B][C] 를 쓰고 있다 — 함께 손봐야 한다");

if (fail.length || plans.length !== 3 || !trimmed) {
  console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다");
  console.log("");
  fail.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("✅ 사전 검사 통과 — bracket 3건 · 선지 1건");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d196br.json"), beforeD);
fs.writeFileSync(path.join(ROOT, "pipeline/backups/annotations.before_d196br.json"), beforeA);
ch.t = trimmed;
(ann[YK] ||= {})[SID] = plans.map((p) => ({ type: "bracket", label: p.label, sentFrom: p.sentFrom, sentTo: p.sentTo }));
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const afterD = fs.readFileSync(DATA), afterA = fs.readFileSync(ANN);
const bad = [];
let nl = 0; for (const x of afterD) if (x === 10) nl++;
if (nl) bad.push(`all_data 개행 ${nl}`);
if (afterA[afterA.length - 1] === 10) bad.push("annotations 끝 개행");
const backD = JSON.parse(afterD.toString("utf8")), backA = JSON.parse(afterA.toString("utf8"));
const bset = backD[YK].literature.find((x) => (x.setId || x.id) === SID);
const bids = (bset.sents || []).map((s) => String(s.id));
const list = (backA[YK] || {})[SID] || [];
if (list.length !== 3) bad.push(`bracket ${list.length}건`);
for (const p of plans) {
  const a = list.find((x) => x.type === "bracket" && x.label === p.label);
  if (!a) { bad.push(`[${p.label}] 없음`); continue; }
  if (a.sentFrom !== p.sentFrom || a.sentTo !== p.sentTo) bad.push(`[${p.label}] 구간이 계획과 다르다`);
  if (bids.indexOf(a.sentFrom) < 0 || bids.indexOf(a.sentTo) < 0) bad.push(`[${p.label}] 정박이 실재하지 않는다`);
}
const bc = bset.questions.find((x) => String(x.id) === TRIM.qId).choices.find((x) => x.num === TRIM.num);
if (/\[[ABC]\]/.test(String(bc.t))) bad.push("Q22#5 에 라벨이 남아 있다");
if (!String(bc.t).endsWith(TRIM.keepTail)) bad.push("Q22#5 끝이 계획과 다르다");
// 본문·해설·다른 세트 무변
const preD = JSON.parse(beforeD.toString("utf8")), preA = JSON.parse(beforeA.toString("utf8"));
if (JSON.stringify(preD[YK].literature.find((x) => (x.setId || x.id) === SID).sents) !== JSON.stringify(bset.sents)) bad.push("본문이 달라졌다");
for (const [yk, v] of Object.entries(preD)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  const sid = st.setId || st.id;
  if (yk === YK && sid === SID) continue;
  if (JSON.stringify(st) !== JSON.stringify((backD[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid))) bad.push(`${yk}::${sid} 가 달라졌다`);
}
for (const [yk, sets] of Object.entries(preA)) for (const [sid, l] of Object.entries(sets))
  if (JSON.stringify(l) !== JSON.stringify((backA[yk] || {})[sid])) bad.push(`annotations ${yk}::${sid} 가 달라졌다`);

console.log(`- 적용 후 all_data MD5 \`${md5(afterD)}\` (${afterD.length - beforeD.length}B)`);
console.log(`- 적용 후 annotations MD5 \`${md5(afterA)}\` (+${afterA.length - beforeA.length}B)`);
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- bracket 3건 · 정박 전건 실재 · Q22#5 라벨 0 · 본문 무변");
console.log("- 다른 세트·회차·annotations 전건 무변 · minified 유지");
