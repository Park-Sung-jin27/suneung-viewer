// build_split.mjs — 배포용 free/pro 분할 (발주 D-73 · 필터 D-75)
//
// ★ public/data/all_data_204.json 은 **단일 소스로 그대로 둔다.**
//   정답지 · 게이트 3개 · live_verify · 복원 절차가 전부 이 파일을 전제한다.
//   소스를 쪼개면 그것들을 다시 써야 한다. 배포 직전 빌드 단계에서만 쪼갠다.
//
// 출력
//   public/data/free/index.json
//   public/data/free/<yearKey>.json      회차별
//   data-pro/<yearKey>.json              회차별 · public/ 밖
//
// 무엇이 어디로
//   free : sents[].t/id/para/pid · questions[].t/bogi · choices[].num/t/ok
//          annotations · 이미지 참조
//   pro  : choices[].analysis/cs_ids/cs_spans/pat · sents[].cs · vocab
//   ★ ok(정답)는 무료다 — 채점이 없으면 user_answers 가 안 쌓이고 리포트가 빈다.
//   ★ sents 의 구세대 cs 잔재는 free 에서 제거한다.
//
// 🔴 발주 D-75 (심사관 판정 ④) — **LIVE 세트만 내보낸다.**
//   src/dataLoader.js 의 RELEASE_KEYS 에 없는 세트는 free · pro · index 어디에도 넣지 않는다.
//   세트 단위로 거른다(연도 단위 아님). 한 연도의 모든 세트가 비노출이면 그 연도는 파일도 index 도 없다.
//   → 재조립 검증의 「누락 0」은 이제 **LIVE 세트 원본**에 대한 것이다. 비노출은 대조 대상이 아니다.
//
// 사용: node pipeline/build_split.mjs [--verify]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public/data/all_data_204.json");
const FREE_DIR = path.join(ROOT, "public/data/free");
const PRO_DIR = path.join(ROOT, "data-pro");

const data = JSON.parse(fs.readFileSync(SRC, "utf8"));

// ── 서버리스 함수용 스테이징 (발주 F-63) ─────────────────────
//   api/_sourceData.js 는 data-source/all_data_204.json 을 읽는다.
//   vercel.json 의 includeFiles 도 그 경로를 가리킨다(data-pro/ 와 같은 방식 —
//   빌드가 만든 디렉터리를 함수 번들에 넣는다).
//   ★ 발주 F-60 ⓓ 로 원본이 data-source/ 로 옮겨지면 SRC 한 줄만 바꾸고
//     이 복사 블록을 지운다. vercel.json 과 _sourceData.js 는 그대로 둔다.
const STAGE_DIR = path.join(ROOT, "data-source");
fs.mkdirSync(STAGE_DIR, { recursive: true });
fs.copyFileSync(SRC, path.join(STAGE_DIR, "all_data_204.json"));

// ── RELEASE_KEYS (발주 D-75) — 다른 감사 도구와 같은 방식으로 읽는다 ──
// src/ 는 읽기만 한다. 여기서 고치지 않는다(공개 여부는 대표 승인 사항).
const RELEASE = (() => {
  const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
  const at = src.indexOf("const RELEASE_KEYS = new Set([");
  if (at < 0) { console.error("🔴 RELEASE_KEYS 블록을 찾지 못했다 — 분할 중단"); process.exit(1); }
  const end = src.indexOf("]);", at);
  const keys = [...src.slice(at, end).matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.includes("::"));
  if (keys.length === 0) { console.error("🔴 RELEASE_KEYS 가 비었다 — 분할 중단"); process.exit(1); }
  return new Set(keys);
})();
const isLive = (yk, id) => RELEASE.has(`${yk}::${id}`);

// ── 필드 배분표 ───────────────────────────────────────────────
const YEAR_META = ["label", "tag", "badge", "color"];
const SET_FREE = ["id", "title", "range", "tag", "hasFig", "annotations"];
const SET_PRO = ["vocab"];
const SET_META = ["__q5_marker_cache", "_extractor", "release_status"];   // 내부 메타 → pro 에 보존
const SENT_FREE = ["id", "t", "sentType", "para", "pid", "type", "url", "alt", "ul"];
const SENT_PRO = ["cs"];                                                  // 구세대 잔재. free 에서 뺀다
const Q_FREE = ["id", "t", "bogi", "questionType", "bogiImage", "bogiImages", "bogiType", "bogiTable", "stem"];
const Q_META = ["needsReview"];
const C_FREE = ["num", "t", "ok"];
const C_PRO = ["analysis", "cs_ids", "cs_spans", "pat", "cs", "_discriminative_validation", "_pat_error", "text"];
//   _pat_error 는 D-178 (A안)로 넣었다. 이 키를 가진 세트가 9개 있는데 전부 비노출이라
//   지금껏 --verify 가 통과했다. r20199c 를 노출하려는 순간 「누락 1건」으로 막혔고,
//   그게 F-45 가 그 세트만 뺀 이유였다. _discriminative_validation 과 같은 성격의
//   진단용 밑줄 키라 같은 자리(pro)에 둔다. free 로는 나가지 않는다 — 유료 필드다.

const pick = (o, keys) => {
  const r = {};
  for (const k of keys) if (o[k] !== undefined) r[k] = o[k];
  return r;
};
const has = (o) => Object.keys(o).length > 0;

// 이전 빌드의 잔재(비노출 회차 파일 등)를 남기지 않는다.
for (const d of [FREE_DIR, PRO_DIR]) {
  fs.mkdirSync(d, { recursive: true });
  for (const f of fs.readdirSync(d)) if (f.endsWith(".json")) fs.unlinkSync(path.join(d, f));
}

const index = { years: [] };
const report = [];
let dropSet = 0, dropYear = 0;

for (const yk of Object.keys(data)) {
  const y = data[yk];
  const free = { yearKey: yk, ...pick(y, YEAR_META) };
  const pro = { yearKey: yk, sets: {} };
  const idxSets = [];

  for (const sec of ["reading", "literature"]) {
    if (!y[sec]) continue;
    free[sec] = [];
    for (const set of y[sec]) {
      if (!isLive(yk, set.id)) { dropSet++; continue; }        // 🔴 D-75 비노출 세트 제외
      const fs_ = pick(set, SET_FREE);
      const ps = { ...pick(set, SET_PRO), ...pick(set, SET_META) };
      // 문장
      fs_.sents = (set.sents || []).map((t) => pick(t, SENT_FREE));
      const sentPro = {};
      for (const t of set.sents || []) { const p = pick(t, SENT_PRO); if (has(p)) sentPro[t.id] = p; }
      if (has(sentPro)) ps.sents = sentPro;
      // 문항
      fs_.questions = [];
      const qPro = {};
      for (const q of set.questions || []) {
        const fq = { ...pick(q, Q_FREE), choices: [] };
        const cPro = {};
        for (const c of q.choices || []) {
          fq.choices.push(pick(c, C_FREE));
          const p = pick(c, C_PRO);
          if (has(p)) cPro[String(c.num)] = p;
        }
        fs_.questions.push(fq);
        const qMeta = pick(q, Q_META);
        if (has(cPro) || has(qMeta)) qPro[String(q.id)] = { ...qMeta, ...(has(cPro) ? { choices: cPro } : {}) };
      }
      if (has(qPro)) ps.questions = qPro;
      free[sec].push(fs_);
      if (has(ps)) pro.sets[set.id] = ps;
      idxSets.push({ id: set.id, kind: sec, title: set.title ?? "", range: set.range ?? "",
        qCount: (set.questions || []).length });
    }
  }

  // 전 세트가 비노출인 회차는 파일도 index 항목도 만들지 않는다.
  if (idxSets.length === 0) { dropYear++; continue; }

  const freeTxt = JSON.stringify(free);
  const proTxt = JSON.stringify(pro);
  fs.writeFileSync(path.join(FREE_DIR, `${yk}.json`), freeTxt, "utf8");
  fs.writeFileSync(path.join(PRO_DIR, `${yk}.json`), proTxt, "utf8");
  index.years.push({ yearKey: yk, ...pick(y, YEAR_META), sets: idxSets });
  report.push({ yk, free: Buffer.byteLength(freeTxt), pro: Buffer.byteLength(proTxt), sets: idxSets.length });
}

const idxTxt = JSON.stringify(index);
fs.writeFileSync(path.join(FREE_DIR, "index.json"), idxTxt, "utf8");

// ── 보고 ──
const KB = (n) => (n / 1024).toFixed(1) + "KB";
const sum = (k) => report.reduce((a, r) => a + r[k], 0);
const stat = (k) => { const v = report.map((r) => r[k]).sort((a, b) => a - b);
  return { avg: sum(k) / v.length, min: v[0], max: v[v.length - 1] }; };
const F = stat("free"), P = stat("pro");
const liveSets = sum("sets");
console.log(`## 분할 결과 — ${report.length}회차 · ${liveSets}세트 (LIVE 만)\n`);
console.log(`| 구분 | 합계 | 평균 | 최소 | 최대 |\n|---|--:|--:|--:|--:|`);
console.log(`| free | ${(sum("free")/1048576).toFixed(2)}MB | ${KB(F.avg)} | ${KB(F.min)} | ${KB(F.max)} |`);
console.log(`| pro  | ${(sum("pro")/1048576).toFixed(2)}MB | ${KB(P.avg)} | ${KB(P.min)} | ${KB(P.max)} |`);
console.log(`| index.json | ${KB(idxTxt.length)} | | | |`);
console.log(`| 원본 | ${(Buffer.byteLength(fs.readFileSync(SRC,"utf8"))/1048576).toFixed(2)}MB | | | |`);
console.log(`\n제외(발주 D-75): 비노출 세트 ${dropSet}개 · 전 세트 비노출 회차 ${dropYear}개 — 산출물에 없다`);

// ── 재조립 검증 ──
// 🔴 대조 대상은 **LIVE 세트**다. 비노출 세트는 산출물에 없으므로 대조하지 않는다(발주 D-75 ④).
if (process.argv.includes("--verify")) {
  let miss = 0, checked = 0, sets = 0;
  for (const yk of Object.keys(data)) {
    const fPath = path.join(FREE_DIR, `${yk}.json`);
    if (!fs.existsSync(fPath)) continue;                       // 전 세트 비노출 회차
    const free = JSON.parse(fs.readFileSync(fPath, "utf8"));
    const pro = JSON.parse(fs.readFileSync(path.join(PRO_DIR, `${yk}.json`), "utf8"));
    for (const sec of ["reading", "literature"]) {
      for (const set of data[yk][sec] || []) {
        if (!isLive(yk, set.id)) continue;
        sets++;
        const f = (free[sec] || []).find((v) => v.id === set.id);   // 위치가 아니라 id 로 찾는다
        if (!f) { miss++; console.log(`  🔴 ${yk} ${set.id} — free 산출물에 없음`); continue; }
        const p = pro.sets[set.id] || {};
        // 세트 필드
        for (const k of Object.keys(set)) {
          if (k === "sents" || k === "questions") continue;
          checked++;
          const got = f[k] !== undefined ? f[k] : p[k];
          if (JSON.stringify(got) !== JSON.stringify(set[k])) { miss++; if (miss <= 5) console.log(`  🔴 ${yk} ${set.id}.${k}`); }
        }
        // 문장
        for (const [j, t] of (set.sents || []).entries()) {
          for (const k of Object.keys(t)) {
            checked++;
            const got = f.sents[j][k] !== undefined ? f.sents[j][k] : p.sents?.[t.id]?.[k];
            if (JSON.stringify(got) !== JSON.stringify(t[k])) { miss++; if (miss <= 5) console.log(`  🔴 ${yk} ${t.id}.${k}`); }
          }
        }
        // 문항·선지
        for (const [j, q] of (set.questions || []).entries()) {
          for (const k of Object.keys(q)) {
            if (k === "choices") continue;
            checked++;
            const got = f.questions[j][k] !== undefined ? f.questions[j][k] : p.questions?.[String(q.id)]?.[k];
            if (JSON.stringify(got) !== JSON.stringify(q[k])) { miss++; if (miss <= 5) console.log(`  🔴 ${yk} ${set.id} Q${q.id}.${k}`); }
          }
          for (const [m, c] of (q.choices || []).entries()) {
            for (const k of Object.keys(c)) {
              checked++;
              const got = f.questions[j].choices[m][k] !== undefined
                ? f.questions[j].choices[m][k]
                : p.questions?.[String(q.id)]?.choices?.[String(c.num)]?.[k];
              if (JSON.stringify(got) !== JSON.stringify(c[k])) { miss++; if (miss <= 5) console.log(`  🔴 ${yk} ${set.id} Q${q.id}#${c.num}.${k}`); }
            }
          }
        }
      }
    }
  }
  console.log(`\n## 재조립 검증 — LIVE ${sets}세트 · 필드 ${checked.toLocaleString()}개 대조 → 누락 ${miss}건`);
  console.log(miss === 0 ? "✅ 누락 0 — free + pro 로 LIVE 세트 원본이 완전히 복원된다" : "🔴 누락 있음");
  // 빌드 체인에서 조용히 지나가지 않도록 종료 코드를 남긴다(발주 D-74).
  if (miss > 0) process.exit(1);
}
