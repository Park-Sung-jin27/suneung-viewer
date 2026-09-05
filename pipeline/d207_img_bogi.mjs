// d207_img_bogi.mjs — 이미지형 <보기> 2건 복원 (발주 D-207 ②)
//
// 두 문항 다 발문이 별도 자료를 부르는데 bogi 가 "" 였다. 지면에는 자료가 있고,
// **PDF 임베디드 이미지 객체**로 들어 있다(페이지 렌더 크롭이 아니다).
//
//   · 2020_6월 l20206c Q44 — <학습 활동> 상자 전체가 이미지 한 덩어리(2598×1765).
//     텍스트 레이어 0줄이라 글로 담을 것이 없다 → 이미지만.
//   · 2014_9월A l20149a Q33 — 머리글 4줄은 텍스트 레이어에 실재하고 ⓐ~ⓔ 표만
//     이미지(1163×611)다 → {text, image} 병용.
//
// ★ alt 에 표 내용을 옮겨 적지 않는다(전사 금지, §13⑬ 취지). 일반 서술만 둔다.
// ★ text 는 지면 좌표 조립 결과 그대로다. 두 줄 경계(「찾아│표에」·「의미를│해석해」)
//   모두 줄 끝 공백 글자가 rawdict 에 실재해 어절 경계가 확정된다 — 보류 0건.
// ★ 형식은 정본 선례를 그대로 따른다.
//     Q44 → `2021수능::r2021c` Q37   {type:"annotated_image", image}
//     Q33 → `2023_6월::r20236a` Q2   {text, image:{url, alt}}
//   image 를 {url,alt} 객체로 주는 것은 src/QuizPanel.jsx:408 resolveBogiImage 가
//   문자열과 {url,alt} 를 모두 받기 때문이다(alt 없으면 "보기 그림"으로 떨어진다).
//
// 사용: node pipeline/d207_img_bogi.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const Q33_TEXT = [
  "<학습 활동>",
  "활동 목표: 시에 쓰인 어구의 다양한 의미를 파악해 보자.",
  "활동1 : 시상을 고려하여 ㉠과 관련된 어구를 시에서 찾아 표에 넣어 보자.",
  "활동2 : 위의 어구들이 함축하고 있는 의미를 적어 보자.",
  "활동3 : 위 활동 결과를 바탕으로 ㉠의 다양한 시적 의미를 해석해 보자.",
].join("\n");

const SPEC = [
  { yk: "2020_6월", sec: "literature", sid: "l20206c", qId: 44,
    img: "2020_l20206c_q44_bogi.png",
    bogi: { type: "annotated_image", image: { url: "/images/2020_l20206c_q44_bogi.png", alt: "학습 활동 자료" } } },
  { yk: "2014_9월A", sec: "literature", sid: "l20149a", qId: 33,
    img: "2014_l20149a_q33_bogi.png",
    bogi: { text: Q33_TEXT, image: { url: "/images/2014_l20149a_q33_bogi.png", alt: "학습 활동 표" } } },
];

// ★ 정본 하나만 쓴다. free/pro 조각은 build_split 이 정본에서 재생성하는 산출물이고
//   (.gitignore 대상), 배포 때 `npm run build:split` 이 vite build 앞에서 다시 만든다.
//   조각을 직접 고치면 정본-산출물 관계가 뒤집힌다.
//
// ※ l20206c 는 현재 **비노출 세트**다 — free/2020_6월.json 도 data-pro/2020_6월.json 도
//   literature 가 비어 있다. 이번 복원은 정본에만 들어가고, 그 세트가 노출될 때
//   비로소 화면에 나온다. l20149a 는 free 조각에 있어 배포 즉시 반영된다.
const FILES = [
  { rel: "public/data/all_data_204.json", byYear: true },
];

console.log("# 이미지형 <보기> 2건 복원 (D-207 ②)");
console.log("");

const fail = [], plans = [];

// ── 이미지 파일이 실재하는가 ─────────────────────────────────────────────
for (const s of SPEC) {
  const p = path.join(ROOT, "public/images", s.img);
  if (!fs.existsSync(p)) { fail.push(`이미지 ${s.img} 가 없다`); continue; }
  console.log(`- \`public/images/${s.img}\` ${Math.round(fs.statSync(p).size / 1024)}KB ✅`);
}
console.log("");

// ── 파일별 사전 대조 (all-or-nothing) ────────────────────────────────────
for (const f of FILES) {
  const abs = path.join(ROOT, f.rel);
  if (!fs.existsSync(abs)) { fail.push(`${f.rel} 없음`); continue; }
  const raw = fs.readFileSync(abs, "utf8");
  const j = JSON.parse(raw);
  const targets = [];
  for (const s of SPEC) {
    if (f.only && f.only !== s.yk) continue;
    const sec = f.byYear ? j[s.yk] : (j.yearKey === s.yk ? j : null);
    if (!sec) { fail.push(`${f.rel} 에 회차 ${s.yk} 없음`); continue; }
    const set = (sec[s.sec] || []).find((x) => (x.setId || x.id) === s.sid);
    if (!set) { fail.push(`${f.rel} 에 ${s.sid} 없음`); continue; }
    const q = (set.questions || []).find((x) => x.id === s.qId);
    if (!q) { fail.push(`${f.rel} 에 Q${s.qId} 없음`); continue; }
    // ★ 지금 비어 있는가 — 내용이 있는 bogi 를 덮어쓰면 안 된다
    if (!(q.bogi === "" || q.bogi == null)) {
      fail.push(`${f.rel} ${s.sid} Q${s.qId} bogi 가 비어 있지 않다: ${JSON.stringify(q.bogi).slice(0, 60)}`); continue;
    }
    targets.push({ s, q });
  }
  const want = SPEC.filter((s) => !f.only || f.only === s.yk).length;
  if (targets.length !== want) { fail.push(`${f.rel} 대상 ${targets.length}/${want}`); continue; }
  plans.push({ ...f, abs, raw, j, targets, md5: md5(raw) });
}

console.log("| 파일 | 적용 전 MD5 | 대상 |");
console.log("|---|---|--:|");
for (const p of plans) console.log(`| \`${p.rel}\` | \`${p.md5}\` | ${p.targets.length} |`);
console.log("");
for (const s of SPEC) {
  console.log(`### ${s.yk}::${s.sid} Q${s.qId}`);
  console.log("```json");
  console.log(JSON.stringify(s.bogi, null, 2));
  console.log("```");
}
console.log("");

if (fail.length || plans.length !== FILES.length) {
  console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다");
  fail.forEach((x) => console.log(`- ${x}`));
  if (!fail.length) console.log(`- 계획 ${plans.length}/${FILES.length}`);
  process.exit(1);
}

// ── 렌더 경로 — 보기 블록이 그려지는가 (QuizPanel:477~ 분기) ────────────
//   문자열 "" 는 falsy 라 보기 블록 자체가 안 나온다. 객체는 나온다.
const shows = (b) => (b == null || b === "" ? 0 : 1);
console.log("## 렌더 경로 — 보기 표시 전후");
console.log("");
console.log("| 문항 | 전 | 후 |");
console.log("|---|--:|--:|");
for (const s of SPEC) console.log(`| \`${s.yk}::${s.sid}\` Q${s.qId} | ${shows("")} | ${shows(s.bogi)} |`);
console.log("");

console.log(`✅ 사전 검사 통과 — ${plans.length}파일 · ${SPEC.length}문항`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ─────────────────────────────────────────────────────────────────
for (const p of plans) {
  fs.writeFileSync(path.join(ROOT, "pipeline/backups", path.basename(p.rel) + ".before_d207b"), p.raw, "utf8");
  for (const t of p.targets) t.q.bogi = JSON.parse(JSON.stringify(t.s.bogi));
  fs.writeFileSync(p.abs, JSON.stringify(p.j), "utf8");   // §13⑪ minified 유지
}

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const bad = [];
console.log("| 파일 | 적용 후 MD5 | 증감 |");
console.log("|---|---|--:|");
for (const p of plans) {
  const raw2 = fs.readFileSync(p.abs, "utf8");
  console.log(`| \`${p.rel}\` | \`${md5(raw2)}\` | ${raw2.length - p.raw.length}B |`);
  const j2 = JSON.parse(raw2);
  for (const t of p.targets) {
    const sec2 = p.byYear ? j2[t.s.yk] : j2;
    const q2 = sec2[t.s.sec].find((x) => (x.setId || x.id) === t.s.sid).questions.find((x) => x.id === t.s.qId);
    if (JSON.stringify(q2.bogi) !== JSON.stringify(t.s.bogi)) bad.push(`${p.rel} ${t.s.sid} Q${t.s.qId} bogi 가 다르다`);
  }
  // ★ 정방향 대조 — 그 bogi 들만 "" 로 되돌리면 파일 전체가 원본과 같아야 한다
  const j3 = JSON.parse(raw2);
  for (const t of p.targets) {
    const sec3 = p.byYear ? j3[t.s.yk] : j3;
    sec3[t.s.sec].find((x) => (x.setId || x.id) === t.s.sid).questions.find((x) => x.id === t.s.qId).bogi = "";
  }
  if (JSON.stringify(j3) !== JSON.stringify(JSON.parse(p.raw)))
    bad.push(`🔴 ${p.rel} — 대상 bogi 외에 달라진 곳이 있다`);
}
console.log("");
console.log("- 백업 `pipeline/backups/<파일명>.before_d207b`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- ${FILES.length}파일 동기 · 대상 ${SPEC.length}건 외 전 구조 무변(정방향 대조)`);
console.log("- annotations 는 열지도 쓰지도 않았다");
