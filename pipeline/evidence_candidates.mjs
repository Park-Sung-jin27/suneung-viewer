// evidence_candidates.mjs — 근거·pat 누락 선지의 **후보** 상신 (발주 D-146 ④)
//
// ★ 후보까지만이다. 판정하지 않는다. 아무것도 쓰지 않는다.
//   선지 어절과 본문 문장의 겹침으로 순위를 매길 뿐이다. 어느 것이 진짜 근거인지는
//   사람이 원본을 보고 정한다(S-01). 점수가 높다고 맞는 근거라는 뜻이 아니다.
//
// 무엇을 내나
//   · 근거 누락 선지  → 본문 문장 후보 상위 3 (sentId · 점수 · 앞머리)
//   · pat 누락 선지   → ok:false 인지 · 해설 결론줄 · pat 후보군 안내
//
// 점수 = (선지 어절 ∩ 문장 어절) / 선지 어절 수. 2글자 이상 어절만, 조사 꼬리는 잘라 맞춘다.
//
// 사용:
//   node pipeline/evidence_candidates.mjs "2019_9월::l20199a"
//   node pipeline/evidence_candidates.mjs "2019_9월::l20199a" "2019_9월::r20199c" …
//   node pipeline/evidence_candidates.mjs --top 5 "…"

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const NL = String.fromCharCode(10);
const flat = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));

const argv = process.argv.slice(2);
const ti = argv.indexOf("--top");
const TOP = ti >= 0 ? Number(argv[ti + 1]) || 3 : 3;
const picks = argv.filter((x) => x.includes("::"));
if (!picks.length) { console.log("`yearKey::setId` 를 하나 이상 주십시오."); process.exit(1); }

// 조사·어미 꼬리를 떼어 어간에 가깝게 만든다 — 완전한 형태소 분석은 아니다
const TAIL = /(으로써|으로서|이라고|라고는|에서는|에게서|으로는|에서도|까지도|이라는|라는|에게|에서|으로|보다|처럼|만큼|부터|까지|조차|마저|이나|나마|이며|하고|와의|과의|로써|로서|이란|란|은|는|이|가|을|를|의|에|와|과|도|만|로|랑|께|께서)$/;
const stem = (w) => { const s = w.replace(/[^가-힣A-Za-z0-9]/g, ""); return s.length > 2 ? s.replace(TAIL, "") : s; };
const words = (t) => [...new Set(String(t).split(/\s+/).map(stem).filter((w) => w.length >= 2))];

const PATS = "R1 사실 왜곡 · R2 인과·관계 전도 · R3 과잉 추론 · R4 개념 혼합 · V 어휘 / "
  + "L1 표현·형식 오독 · L2 정서·태도 오독 · L3 주제·의미 과잉 · L4 구조·맥락 오류 · L5 보기 대입 오류";

console.log("# 근거·pat 후보 상신");
console.log("");
console.log(`> 생성: \`node pipeline/evidence_candidates.mjs ${argv.join(" ")}\``);
console.log("> **후보까지만이다. 판정하지 않았고 아무것도 쓰지 않았다.**");
console.log("> 점수는 어절 겹침일 뿐이다 — 높다고 맞는 근거라는 뜻이 아니다. 원본 대조로 정한다(S-01).");
console.log("");

for (const key of picks) {
  const [yk, setId] = key.split("::");
  let s = null;
  for (const sec of ["reading", "literature"]) {
    const f = (data[yk]?.[sec] || []).find((x) => (x.setId || x.id) === setId);
    if (f) s = f;
  }
  if (!s) { console.log(`## ${key} — 🔴 세트를 못 찾았다`); console.log(""); continue; }

  const sents = s.sents || [];
  // 형광펜이 안 되는 문장(각주·작가·표지·중략)은 후보에서 뺀다 — l20209d Q42#1 선례
  const NONHL = new Set(["footnote", "author", "workTag"]);
  const pool = sents.filter((x) => !NONHL.has(x.sentType) && !/^\s*\(중략\)\s*$/.test(flat(x.t)));
  const idx = pool.map((x) => ({ id: x.id, t: flat(x.t), w: new Set(words(flat(x.t))) }));

  const missCs = [], missPat = [];
  for (const q of s.questions || [])
    for (const c of q.choices || []) {
      const isV = flat(c.pat).trim() === "V";
      if (!(c.cs_ids || []).length && !isV) missCs.push({ q, c });
      if (!flat(c.pat).trim() && c.ok === false) missPat.push({ q, c });
    }

  console.log(`## ${key}`);
  console.log("");
  console.log(`- 문장 ${sents.length} (후보 대상 ${pool.length} — 각주·작가·표지 제외) · 선지 ${(s.questions || []).reduce((a, q) => a + (q.choices || []).length, 0)}`);
  console.log(`- 근거 누락 **${missCs.length}건** · pat 누락 **${missPat.length}건**`);
  console.log("");

  if (missCs.length) {
    console.log("### 근거 후보");
    console.log("");
    console.log("| 위치 | ok | 선지 | 후보 (sentId · 점수) |");
    console.log("|---|---|---|---|");
    for (const { q, c } of missCs) {
      const cw = words(flat(c.t));
      const scored = idx.map((x) => ({ id: x.id, t: x.t, sc: cw.length ? cw.filter((w) => x.w.has(w)).length / cw.length : 0 }))
        .sort((a, b) => b.sc - a.sc).slice(0, TOP).filter((x) => x.sc > 0);
      const cand = scored.length
        ? scored.map((x) => `\`${x.id}\` ${(x.sc * 100).toFixed(0)}% — ${x.t.replace(/\s+/g, " ").slice(0, 28)}…`).join("<br>")
        : "**겹치는 어절 없음 — 사람이 직접 찾아야 한다**";
      console.log(`| Q${q.id}#${c.num} | ${c.ok === false ? "false" : "true"} | ${flat(c.t).replace(/\s+/g, " ").slice(0, 40)}… | ${cand} |`);
    }
    console.log("");
  }

  if (missPat.length) {
    console.log("### pat 후보");
    console.log("");
    console.log(`후보군: ${PATS}`);
    console.log("");
    for (const { q, c } of missPat) {
      const a = flat(c.analysis).replace(/\s+$/, "").split(NL);
      let concl = null;
      for (let i = a.length - 1; i >= 0; i--) if (/[✅❌]/.test(a[i])) { concl = a[i].trim(); break; }
      console.log(`- **Q${q.id}#${c.num}** (ok:false) — 선지 \`${flat(c.t).replace(/\s+/g, " ").slice(0, 60)}…\``);
      console.log(`  - 결론줄: ${concl ? `\`${concl.slice(0, 80)}\`` : "**없음**"}`);
      console.log(`  - 근거 ${(c.cs_ids || []).length ? `\`${(c.cs_ids || []).join(" ")}\`` : "**없음**"}`);
    }
    console.log("");
  }
}

console.log("> ⚠ 이 목록은 **작업 지시가 아니다.** 심사관이 원본과 대조해 확정한 뒤에 `evidence_assign` 으로 넣는다(S-05).");
