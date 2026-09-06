// d209_summary_mark.mjs — 줄거리 블록 sentType 마킹 (발주 D-209)
//
// 지면은 [중략 부분의 줄거리] 같은 줄거리 블록을 본문과 다른 서체·크기로 조판한다
// (본문 명조 11.21 / 라벨 태고딕 10.23 / 서술 중고딕 10.72 — 세 회차 실측 일치).
// 데이터는 그 구분을 네 값으로 흩어 놓았고(omission 31·body 9·summary 4·footnote 1),
// 줄거리가 여러 문장이면 뒷문장이 body 로 남아 블록이 첫 문장에서 끊겼다.
//
// ★ 범위는 지면 좌표 판독으로 확정했다(scratchpad/d209_probe.py). 판정 기준은
//   크기가 아니라 **고딕 서체**다 — 2015수능A l2015d 는 라벨 줄이 본문 크기
//   (11.19)·본문 서체라 「sz < base」로 0줄이 나왔다. 실측 전건에서 일관된 신호는
//   서체였다(블록 줄 133개 중 124개 고딕). 라벨 줄은 지시문 문자열로 특정하고,
//   그 다음 줄부터 「고딕이거나 본문보다 작은」 줄이 이어지는 동안 따라갔다.
//   과포집 점검 — 블록 마지막 줄이 43/43건 마침표 종결, cover 1.0 전건.
//
// ★ 2014수능 A/B 2건은 들어오지 않는다 — PDF 가 스캔 이미지다(16면에 텍스트
//   526자, 글자 단위 이미지 1만여 개). OCR 금지라 판독 불가 → 보류 명단 동결.
//
// ★ 라벨 표기 5종([중략 부분의 줄거리]·[앞부분 줄거리]…)은 문구를 통일하지 않는다.
//   지면 그대로다(심사관 지시). 이 도구는 sentType 만 바꾼다.
//
// 사용: node pipeline/d209_summary_mark.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");   // main 38c4858 F-60 ⓓ
const PLANS = path.join(ROOT, "pipeline/fixtures/d209_plans.json");
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const raw = fs.readFileSync(DATA, "utf8");
const j = JSON.parse(raw);
const plans = JSON.parse(fs.readFileSync(PLANS, "utf8"));

console.log("# 줄거리 블록 sentType 마킹 (D-209)");
console.log("");
console.log(`- \`data-source/all_data_204.json\` 적용 전 MD5 \`${md5(raw)}\``);
console.log("");

const findSent = (yk, sid, id) => {
  for (const sec of ["reading", "literature"]) {
    const s = (j[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (s) return (s.sents || []).find((x) => String(x.id) === String(id));
  }
  return null;
};

// ── 사전 대조 (all-or-nothing) ───────────────────────────────────────────
const fail = [], ready = [];
for (const p of plans) {
  const sn = findSent(p.yk, p.sid, p.id);
  if (!sn) { fail.push(`${p.yk}::${p.sid} ${p.id} 문장이 없다`); continue; }
  const cur = sn.sentType === undefined ? "(없음)" : sn.sentType;
  // ★ 상신 때 읽은 값과 지금 값이 같은가 — 다르면 그 사이에 데이터가 바뀐 것이다
  if (cur !== p.from) { fail.push(`${p.yk}::${p.sid} ${p.id} 현재값이 ${cur} — 상신 때는 ${p.from} 였다`); continue; }
  if (!["summary", "omission"].includes(p.to)) { fail.push(`${p.id} 새 값 ${p.to} 이 허용 밖`); continue; }
  ready.push({ ...p, sn, cur });
}

const roles = {}, trans = {};
for (const r of ready) { roles[r.role] = (roles[r.role] || 0) + 1; trans[`${r.from} → ${r.to}`] = (trans[`${r.from} → ${r.to}`] || 0) + 1; }
console.log("| 역할 | 건수 |"); console.log("|---|--:|");
for (const [k, n] of Object.entries(roles)) console.log(`| ${k} | ${n} |`);
console.log("");
console.log("| 값 전이 | 건수 |"); console.log("|---|--:|");
for (const [k, n] of Object.entries(trans).sort((a, b) => b[1] - a[1])) console.log(`| ${k} | ${n} |`);
console.log("");

if (ready.length !== plans.length) fail.push(`대상 ${ready.length}/${plans.length}`);
if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }

// ── 렌더 경로 — BLOCK_TYPES 를 소스에서 떼어 쓴다(복사 금지) ─────────────
const src = fs.readFileSync(path.join(ROOT, "src/PassagePanel.jsx"), "utf8");
const bi = src.indexOf("const BLOCK_TYPES = new Set([");
const bj = src.indexOf("]);", bi) + 3;
if (bi < 0) { console.log("## 🔴 BLOCK_TYPES 를 소스에서 못 찾았다"); process.exit(1); }
const BLOCK_TYPES = new Function(src.slice(bi, bj) + "; return BLOCK_TYPES;")();
const miss = [...new Set(plans.map((p) => p.to))].filter((t) => !BLOCK_TYPES.has(t));
if (miss.length) { console.log(`## 🔴 렌더가 ${miss.join(",")} 를 블록으로 안 받는다 — 본문처럼 그려진다`); process.exit(1); }
console.log(`✅ 렌더 확인 — BLOCK_TYPES 가 ${[...new Set(plans.map((p) => p.to))].join("·")} 를 모두 받는다`);
console.log(`   (src/PassagePanel.jsx 에서 떼어 실행: ${[...BLOCK_TYPES].join(", ")})`);
console.log("");
console.log(`✅ 사전 검사 통과 — ${ready.length}건`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ─────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.json.before_d209"), raw, "utf8");
for (const r of ready) r.sn.sentType = r.to;
fs.writeFileSync(DATA, JSON.stringify(j), "utf8");   // §13⑪ minified 유지

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const raw2 = fs.readFileSync(DATA, "utf8");
const j2 = JSON.parse(raw2);
const bad = [];
const find2 = (yk, sid, id) => {
  for (const sec of ["reading", "literature"]) {
    const s = (j2[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (s) return (s.sents || []).find((x) => String(x.id) === String(id));
  }
  return null;
};
for (const r of ready) {
  const sn = find2(r.yk, r.sid, r.id);
  if (!sn) { bad.push(`${r.id} 가 사라졌다`); continue; }
  if (sn.sentType !== r.to) bad.push(`${r.id} sentType=${sn.sentType} — ${r.to} 여야 한다`);
  if (sn.t !== r.sn.t) bad.push(`${r.id} 본문이 바뀌었다`);
}
// ★ 역방향 바이트 일치 — 값을 원래대로 되돌리면 파일 전체가 원본과 같아야 한다
const j3 = JSON.parse(raw2);
const find3 = (yk, sid, id) => {
  for (const sec of ["reading", "literature"]) {
    const s = (j3[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (s) return (s.sents || []).find((x) => String(x.id) === String(id));
  }
  return null;
};
for (const r of ready) {
  const sn = find3(r.yk, r.sid, r.id);
  if (r.from === "(없음)") delete sn.sentType; else sn.sentType = r.from;
}
if (JSON.stringify(j3) !== JSON.stringify(JSON.parse(raw)))
  bad.push("🔴 역방향 바이트 일치 실패 — 지정 67건 외에 달라진 곳이 있다");

console.log(`- 적용 후 MD5 \`${md5(raw2)}\` (${raw2.length - raw.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.json.before_d209`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- ${ready.length}건 마킹 · 문장 본문 무변 · 역방향 바이트 일치`);
console.log("- annotations 는 열지도 쓰지도 않았다");
