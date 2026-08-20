// build_split.mjs — 배포용 free/pro 분할 (발주 D-73)
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
// 사용: node pipeline/build_split.mjs [--verify]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public/data/all_data_204.json");
const FREE_DIR = path.join(ROOT, "public/data/free");
const PRO_DIR = path.join(ROOT, "data-pro");

const data = JSON.parse(fs.readFileSync(SRC, "utf8"));

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
const C_PRO = ["analysis", "cs_ids", "cs_spans", "pat", "cs", "_discriminative_validation", "text"];

const pick = (o, keys) => {
  const r = {};
  for (const k of keys) if (o[k] !== undefined) r[k] = o[k];
  return r;
};
const has = (o) => Object.keys(o).length > 0;

fs.mkdirSync(FREE_DIR, { recursive: true });
fs.mkdirSync(PRO_DIR, { recursive: true });

const index = { years: [] };
const report = [];

for (const yk of Object.keys(data)) {
  const y = data[yk];
  const free = { yearKey: yk, ...pick(y, YEAR_META) };
  const pro = { yearKey: yk, sets: {} };
  const idxSets = [];

  for (const sec of ["reading", "literature"]) {
    if (!y[sec]) continue;
    free[sec] = [];
    for (const set of y[sec]) {
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
console.log(`## 분할 결과 — ${report.length}회차\n`);
console.log(`| 구분 | 합계 | 평균 | 최소 | 최대 |\n|---|--:|--:|--:|--:|`);
console.log(`| free | ${(sum("free")/1048576).toFixed(2)}MB | ${KB(F.avg)} | ${KB(F.min)} | ${KB(F.max)} |`);
console.log(`| pro  | ${(sum("pro")/1048576).toFixed(2)}MB | ${KB(P.avg)} | ${KB(P.min)} | ${KB(P.max)} |`);
console.log(`| index.json | ${KB(idxTxt.length)} | | | |`);
console.log(`| 원본 | ${(Buffer.byteLength(fs.readFileSync(SRC,"utf8"))/1048576).toFixed(2)}MB | | | |`);

// ── 재조립 검증 ──
if (process.argv.includes("--verify")) {
  let miss = 0, checked = 0;
  for (const yk of Object.keys(data)) {
    const free = JSON.parse(fs.readFileSync(path.join(FREE_DIR, `${yk}.json`), "utf8"));
    const pro = JSON.parse(fs.readFileSync(path.join(PRO_DIR, `${yk}.json`), "utf8"));
    for (const sec of ["reading", "literature"]) {
      for (const [i, set] of (data[yk][sec] || []).entries()) {
        const f = free[sec][i], p = pro.sets[set.id] || {};
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
  console.log(`\n## 재조립 검증 — 필드 ${checked.toLocaleString()}개 대조 → 누락 ${miss}건`);
  console.log(miss === 0 ? "✅ 누락 0 — free + pro 로 원본이 완전히 복원된다" : "🔴 누락 있음");
  // 빌드 체인에서 조용히 지나가지 않도록 종료 코드를 남긴다(발주 D-74).
  if (miss > 0) process.exit(1);
}
