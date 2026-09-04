// passage_missing_scan.mjs — 지문 누락 탐지 전수 스캔 (발주 fu-A/B · 2026-08-17)
//
// ★ 읽기 전용. 데이터를 쓰지 않는다.
// ★ quality_gate 에 축을 추가하지 않는다(§13⑱). 완전 별도 스크립트다.
// ★ 「누락」을 확정하지 않는다. 신호와 후보만 낸다. 판정은 PDF 대조(C)에서 한다.
//
// 사용: node pipeline/passage_missing_scan.mjs [--json]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (r) => path.join(ROOT, r);
const JSON_OUT = process.argv.includes("--json");

const data = JSON.parse(fs.readFileSync(P("data-source/all_data_204.json"), "utf8"));

// RELEASE_KEYS — 기존 파서 6종과 동일 방식
const src = fs.readFileSync(P("src/dataLoader.js"), "utf8");
const _s = src.indexOf("const RELEASE_KEYS = new Set([");
const _blk = src.slice(_s, src.indexOf("]);", _s));
const RELEASE_KEYS = new Set(
  [..._blk.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.includes("::")),
);

const HANGUL = /[가-힣]/g;
const MARK = /\(([가-라])\)/g;
const hangulCount = (s) => ((s || "").match(HANGUL) || []).length;

// ── 세트별 신호 산출 ────────────────────────────────────────────────
const rows = [];
for (const yk of Object.keys(data)) {
  for (const sec of ["reading", "literature"]) {
    for (const s of data[yk][sec] || []) {
      const sents = s.sents || [];
      const qs = s.questions || [];

      // 지문이 보유한 (가)~(라) 표지 — 본문 텍스트 + workTag 문장 양쪽에서 수집
      const passMarks = new Set();
      let workTagN = 0;
      let verseN = 0;
      let passHangul = 0;
      for (const t of sents) {
        if (t.sentType === "workTag") workTagN++;
        if (t.sentType === "verse") verseN++;
        passHangul += hangulCount(t.t);
        for (const m of String(t.t || "").matchAll(MARK)) passMarks.add(m[1]);
      }

      // 문항이 참조하는 (가)~(라) 표지 — 발문 q.t + <보기> + 선지 전부
      const qMarks = new Set();
      for (const q of qs) {
        const blob =
          String(q.t || "") +
          " " +
          String(q.bogi || "") +
          " " +
          (q.choices || []).map((c) => c.t || "").join(" ");
        for (const m of blob.matchAll(MARK)) qMarks.add(m[1]);
      }

      // ① 문항은 참조하는데 지문에 없는 표지
      const missing = [...qMarks].filter((k) => !passMarks.has(k)).sort();

      const qn = qs.length || 1;
      rows.push({
        yk,
        id: s.id,
        section: sec,
        live: RELEASE_KEYS.has(`${yk}::${s.id}`),
        title: s.title || "",
        range: s.range || "",
        sents: sents.length,
        questions: qs.length,
        hangul: passHangul,
        // ② 문항당 한글 수
        hpq: passHangul / qn,
        // ③ 문항당 문장 수
        spq: sents.length / qn,
        passMarks: [...passMarks].sort().join(""),
        qMarks: [...qMarks].sort().join(""),
        missing: missing.join(""),
        workTagN,
        // 운문 판정: verse 문장이 절반 이상
        verse: sents.length > 0 && verseN / sents.length >= 0.5,
        // ④ 복합 지문(문항이 표지 2개 이상 참조)인데 workTag 문장이 없음
        sig4: qMarks.size >= 2 && workTagN === 0,
      });
    }
  }
}

// ── A-2: 분류군별 정상 분포 ─────────────────────────────────────────
const groupOf = (r) =>
  r.section === "reading" ? "독서" : r.verse ? "문학·운문" : "문학·산문";
const q = (arr, p) => {
  const a = [...arr].sort((x, y) => x - y);
  if (!a.length) return 0;
  return a[Math.min(a.length - 1, Math.floor(p * a.length))];
};
const groups = new Map();
for (const r of rows) {
  const g = groupOf(r);
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(r);
}
const stat = new Map();
for (const [g, arr] of groups) {
  const hpq = arr.map((r) => r.hpq),
    spq = arr.map((r) => r.spq);
  stat.set(g, {
    n: arr.length,
    hpqP05: q(hpq, 0.05),
    hpqMed: q(hpq, 0.5),
    spqP05: q(spq, 0.05),
    spqMed: q(spq, 0.5),
  });
}
// 이상치 기준: 분류군 중앙값의 40% 미만 (단일 전역 기준을 쓰지 않는다)
const OUT_RATIO = 0.4;
for (const r of rows) {
  const st = stat.get(groupOf(r));
  r.group = groupOf(r);
  r.sig2 = r.hpq < st.hpqMed * OUT_RATIO;
  r.sig3 = r.spq < st.spqMed * OUT_RATIO;
  r.score = (r.missing ? 1 : 0) + (r.sig2 ? 1 : 0) + (r.sig3 ? 1 : 0) + (r.sig4 ? 1 : 0);
}

if (JSON_OUT) {
  console.log(JSON.stringify(rows, null, 1));
  process.exit(0);
}

// ── 출력 ───────────────────────────────────────────────────────────
console.log("=== A-2 분류군별 정상 분포 (353세트) ===");
console.log("| 분류군 | 세트 | 문항당 한글 중앙값 | 하위5% | 문항당 문장 중앙값 | 하위5% |");
console.log("|---|--:|--:|--:|--:|--:|");
for (const [g, st] of stat)
  console.log(
    `| ${g} | ${st.n} | ${st.hpqMed.toFixed(1)} | ${st.hpqP05.toFixed(1)} | ${st.spqMed.toFixed(1)} | ${st.spqP05.toFixed(1)} |`,
  );

console.log("\n=== A-1 기준점 검증: r2019b ===");
const ref = rows.find((r) => r.id === "r2019b");
console.log(JSON.stringify(ref, null, 1));

const sigN = (k) => rows.filter((r) => r[k]).length;
console.log("\n=== A-1 신호별 적중 (전 353세트 중 발화 수 / r2019b 발화 여부) ===");
console.log(`① 표지 결손        : ${rows.filter((r) => r.missing).length}세트 · r2019b=${ref.missing ? "발화(" + ref.missing + ")" : "미발화"}`);
console.log(`② 문항당 한글 이상 : ${sigN("sig2")}세트 · r2019b=${ref.sig2 ? "발화" : "미발화"}`);
console.log(`③ 문항당 문장 이상 : ${sigN("sig3")}세트 · r2019b=${ref.sig3 ? "발화" : "미발화"}`);
console.log(`④ workTag 결손     : ${sigN("sig4")}세트 · r2019b=${ref.sig4 ? "발화" : "미발화"}`);

const susp = rows.filter((r) => r.score > 0).sort((a, b) => b.score - a.score || a.hpq - b.hpq);
console.log(`\n=== B 누락 의심 (신호 1개 이상) = ${susp.length}세트 ===`);
for (const bucket of [true, false]) {
  const arr = susp.filter((r) => r.live === bucket);
  console.log(`\n--- ${bucket ? "LIVE" : "비노출"} ${arr.length}세트 ---`);
  console.log("| 신호 | yearKey | setId | 분류 | 제목 | 문항 | 문장 | 한글 | 한글/문항 | 문장/문항 | 지문표지 | 문항참조 | 결손 |");
  console.log("|:-:|---|---|---|---|--:|--:|--:|--:|--:|:-:|:-:|:-:|");
  for (const r of arr) {
    const sig = [r.missing ? "①" : "", r.sig2 ? "②" : "", r.sig3 ? "③" : "", r.sig4 ? "④" : ""].join("");
    console.log(
      `| ${sig} | ${r.yk} | ${r.id} | ${r.group} | ${r.title.slice(0, 26)} | ${r.questions} | ${r.sents} | ${r.hangul} | ${r.hpq.toFixed(0)} | ${r.spq.toFixed(1)} | ${r.passMarks || "-"} | ${r.qMarks || "-"} | ${r.missing || "-"} |`,
    );
  }
}
console.log(`\n[요약] 전체 ${rows.length}세트 · 의심 ${susp.length} (LIVE ${susp.filter((r) => r.live).length} / 비노출 ${susp.filter((r) => !r.live).length})`);
