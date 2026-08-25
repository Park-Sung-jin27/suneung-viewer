// bracket_ledger.mjs — 구간 표시 검증 대장 (발주 D-108 ④ · 화면 원천 기준 재작성)
//
// ★ D-107 에서 밝혀진 것: 화면이 쓰는 bracket 원천은 all_data_204.json 이 아니다.
//   src/dataLoader.js:548 이 annotations.json 으로 set.annotations 를 통째로 덮어쓰고,
//   src/PassagePanel.jsx:745 가 visual_marks.json 의 bracket 을 합친다.
//   그래서 대장은 **화면값**을 싣고, all_data 의 값은 「잔재」 열로 격리한다.
//
// ⑥축·⑦축은 회귀 방지용이다. 「어디까지 원본과 대조했는가」는 이 대장이 답한다.
// PDF 대조 여부는 자동 판정하지 않는다 — 아래 VERIFIED 에 손으로 적는다.
//
// 사용: node pipeline/bracket_ledger.mjs > docs/bracket_verification_ledger.md

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (f) => path.join(ROOT, "public/data", f);
const data = JSON.parse(fs.readFileSync(P("all_data_204.json"), "utf8"));
const ann = JSON.parse(fs.readFileSync(P("annotations.json"), "utf8"));
const vmRaw = JSON.parse(fs.readFileSync(P("visual_marks.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

// "setId" 또는 "setId::라벨" → { by, commit, note }
//   ★ 실제로 원본 지면과 대조한 것만 적는다. 자동 판정 금지.
//   ★ D-108 ⑤: LIVE 결함 선언에는 배포 화면 실측 증거가 있어야 한다.
//     화면 실측까지 끝난 건은 note 에 「화면 실측」이라 적는다.
const VERIFIED = {
  l2019b:  { by: "엔지니어+심사관", commit: "e2efb2f", note: "16면. 심사관 LIVE 교차확정" },
  l2023d:  { by: "엔지니어+심사관", commit: "9e7e1f0 / 3cb64e3", note: "21면. D-106 ① 에서 벡터 재확인 — 가로획 6쌍이 전부 화면값과 일치" },
  l2015b:  { by: "엔지니어",        commit: "4bee58a", note: "12면" },
  l2015d:  { by: "엔지니어",        commit: "4bee58a", note: "14면" },
  l2018a:  { by: "엔지니어",        commit: "4bee58a", note: "7면" },
  l2018c:  { by: "엔지니어",        commit: "c82d95e", note: "12면" },
  l2020c:  { by: "엔지니어",        commit: "c82d95e", note: "12~13면" },
  r2021b:  { by: "엔지니어",        commit: "c82d95e", note: "10면" },
  l2023b:  { by: "엔지니어+심사관", commit: "563878f / 9608b96", note: "8면. [B] 는 심사관 확정값. s56 인라인 [C] 제거" },
  r2024a:  { by: "엔지니어(벡터)",  commit: "cc07f26", note: "1면. 가로획 362.1/603.0" },
  r20256d: { by: "엔지니어(벡터)",  commit: "83540dc", note: "5면. 가로획 420.4/734.0" },
  l20276c: { by: "엔지니어(벡터)",  commit: "870c2d2 / 30177f5", note: "10면 좌→우단. 가로획 735.8/182.9. D-108 ② 에서 s48→s50 이관" },
  l20276d: { by: "엔지니어(벡터)+심사관", commit: "3b01333", note: "11면 3구간. 조판 규칙의 기준점" },
  r20249b: { by: "엔지니어(벡터)",  commit: "59eb645 / 30177f5", note: "2면. 가로획 695.6/862.3, 879.4/1009.2. D-108 ② 에서 annotations.json 에 신규 기록" },
  "l20276a::A": { by: "엔지니어(벡터)+심사관(화면 실측)", commit: "56e77ff / 30177f5",
    note: "6~7면 걸침. 가로획 904.9/181.6. 심사관이 배포 화면 끝을 「뒤통수를 갈기고 지나갔다」로 실측 → s51 확정. D-108 ② 이관" },

  // ── D-109 ① 인라인 24건 수리에서 벡터로 확정한 세트 ──────────────────
  //   전부 pipeline/bracket_probe.py 로 지면 벡터(세로선·꺾쇠·라벨 글리프)를 짚었다.
  l2024c:  { by: "엔지니어(벡터)", commit: "f37d2c2", note: "10면 우단 163.0/201.5·273.3/330.5·365.2/403.7. 화면값(문장 단위)과 일치 — 인라인 3건만 제거" },
  l2023c:  { by: "엔지니어(벡터)", commit: "9aca16a", note: "10면. [E] 우단 218.2/256.7. 화면값과 일치 — 인라인 2건 제거" },
  l2022b:  { by: "엔지니어(벡터)", commit: "3067392", note: "8면 우단 199.3/493.7, 라벨 [A] y=341.9 정중앙. 인라인 제거 시 cs_spans text 3건 동반 수정" },
  r20226b: { by: "엔지니어(벡터)", commit: "6973b65", note: "2면 좌단 585.3/881.2 → s17~s28. 기존 s14~s23 은 오정박이었다" },
  r20226d: { by: "엔지니어(벡터)", commit: "7c436ed", note: "5면 163.0/312.1. 화면값 s22~s24 와 일치" },
  l20226c: { by: "엔지니어(벡터)", commit: "1201225", note: "10면 좌단 907.2 (9줄). bracket 이 없던 세트 — 신규 정박" },
  l20266a: { by: "엔지니어(벡터)", commit: "47f75eb", note: "6면 우단 383.6/569.5 (11줄). 신규 정박" },
  l20266b: { by: "엔지니어(벡터)", commit: "3426817", note: "8면 254.1/456.5 (12줄). 신규 정박" },
  l20266d: { by: "엔지니어(벡터)", commit: "179f997", note: "11면 5구간 216.6/273.2·326.9/383.5·510.7/567.4·584.2/622.1·639.4/660.3 — 행수 4·4·4·3·2 가 화면값과 정확히 일치. 코덱스 모순 3건은 벡터로 종결" },
  r2021a:  { by: "엔지니어(벡터)", commit: "63d0a93", note: "6면 우단 362.3/620.2. 화면값 s5~s9 와 일치" },
  l2021a:  { by: "엔지니어(벡터)", commit: "c339785", note: "[A] 8면 우단 842.8/1046.3, 라벨 y=939.9 정중앙 → s32~s45. 기존 s18~s45 는 시작이 14문장 앞섰다. [B] 9면 좌단 409.7/631.9 은 일치" },
  l20226a: { by: "엔지니어(벡터)", commit: "7f89c50", note: "7면 좌단 254.9/440.8 (11줄). 신규 정박(비노출)" },
  l20226b: { by: "엔지니어(벡터)", commit: "7b84a2c", note: "8면 우단 420.4/532.6·549.0/679.9, 라벨 [A] y=471.8 · [B] y=609.8. 기존 s23~s25·s25~s25 는 전혀 다른 자리였다(비노출)" },
  l20249a: { by: "엔지니어(벡터)", commit: "135e3a4", note: "6면 우단 254.5/310.6·622.1/788.8. 신규 정박(비노출)" },
};

const vmBy = new Map();
for (const m of vmRaw.marks || []) {
  if (!m?.setId) continue;
  const k = `${m.yearKey}::${m.setId}`;
  vmBy.set(k, [...(vmBy.get(k) || []), m]);
}

const rows = [];
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const setId = s.setId || s.id;
      const live = REL.has(`${yk}::${setId}`);
      const ids = (s.sents || []).map((x) => String(x.id));
      const annList = ann[yk]?.[setId];
      const effAnn = Array.isArray(annList) && annList.length > 0 ? annList : (s.annotations || []);
      const annBr = effAnn.filter((a) => a?.type === "bracket" && a.sentFrom && a.sentTo && (!a.target || a.target === "passage"))
        .map((a) => ({ label: a.label, from: a.sentFrom, to: a.sentTo, src: "ann" }));
      const vmBr = (vmBy.get(`${yk}::${setId}`) || [])
        .filter((m) => m.type === "bracket" && m.target === "sent_range" && m.status !== "broken" && Array.isArray(m.sentIds) && m.sentIds.length)
        .map((m) => ({ label: m.label, from: m.sentIds[0], to: m.sentIds[m.sentIds.length - 1], src: "vm" }));
      const seen = new Set();
      const cands = [...vmBr, ...annBr].filter((b) => {
        const k = `${b.label}|${b.from}|${b.to}`;
        if (seen.has(k)) return false; seen.add(k); return true;
      });
      const mine = (s.annotations || []).filter((a) => a?.type === "bracket");
      if (!cands.length && !mine.length) continue;

      const labels = new Set([...cands.map((b) => b.label), ...mine.map((a) => a.label)]);
      for (const label of [...labels].sort()) {
        const list = cands.filter((b) => b.label === label);
        const shown = list.find((b) => {
          const f = ids.indexOf(String(b.from)), t = ids.indexOf(String(b.to));
          return f >= 0 && t >= 0 && f <= t;
        }) || null;
        const lines = shown ? ids.indexOf(String(shown.to)) - ids.indexOf(String(shown.from)) + 1 : null;
        const stale = mine.find((a) => a.label === label);
        const staleStr = stale
          ? (shown && stale.sentFrom === shown.from && stale.sentTo === shown.to ? "일치" : `${stale.sentFrom}~${stale.sentTo}`)
          : "—";
        const V = VERIFIED[`${setId}::${label}`] || VERIFIED[setId] || null;
        rows.push({
          yk, sid: setId, live, label,
          shown: shown ? `${shown.from} ~ ${shown.to}` : null,
          srcName: shown ? shown.src : (list.length ? "후보 id 불일치" : "all_data 잔재만"),
          lines, stale: staleStr, V,
        });
      }
    }
rows.sort((a, b) => (a.yk + a.sid + a.label).localeCompare(b.yk + b.sid + b.label));

const L = (a) => a.filter((x) => x.live).length;
const ver = rows.filter((r) => r.V && r.shown);
const unver = rows.filter((r) => !r.V && r.shown);
const noShow = rows.filter((r) => !r.shown);
const staleRows = rows.filter((r) => r.stale !== "—" && r.stale !== "일치");
const setsOf = (a) => new Set(a.map((r) => `${r.yk}::${r.sid}`)).size;

const out = [];
out.push(`# 구간 표시 [A]~[F] 검증 대장 — 화면 원천 기준`);
out.push(``);
out.push(`> 생성: \`node pipeline/bracket_ledger.mjs > docs/bracket_verification_ledger.md\``);
out.push(`> **화면값**을 싣는다. 화면 원천은 \`annotations.json\`(all_data 를 덮어씀) ∪ \`visual_marks.json\` 이고,`);
out.push(`> \`getBracketInfo\` 가 첫 매치에서 반환하므로 판정 단위는 **라벨**이다.`);
out.push(`> all_data 의 \`set.annotations\` 값은 화면이 읽지 않는다 — 「all_data 잔재」 열로 격리했다.`);
out.push(`> PDF 대조 여부는 자동 판정하지 않는다. \`pipeline/bracket_ledger.mjs\` 의 \`VERIFIED\` 에 손으로 적는다.`);
out.push(``);
out.push(`## 요약`);
out.push(``);
out.push(`| 항목 | 라벨 | 세트 | LIVE |`);
out.push(`|---|--:|--:|--:|`);
out.push(`| 화면에 그려지는 라벨 | ${ver.length + unver.length} | ${setsOf([...ver, ...unver])} | ${L(ver) + L(unver)} |`);
out.push(`| **PDF 대조 완료** | **${ver.length}** | **${setsOf(ver)}** | **${L(ver)}** |`);
out.push(`| 미대조 | ${unver.length} | ${setsOf(unver)} | ${L(unver)} |`);
out.push(`| 화면에 안 나옴 (all_data 잔재만) | ${noShow.length} | ${setsOf(noShow)} | ${L(noShow)} |`);
out.push(`| all_data 잔재가 화면값과 다름 | ${staleRows.length} | ${setsOf(staleRows)} | ${L(staleRows)} |`);
out.push(``);
out.push(`「all_data 잔재」는 화면에 영향이 없다. 수기 수정·삭제 금지(F-25 소관) — 기록만 한다.`);
out.push(``);

const tbl = (title, arr, withV, note) => {
  if (!arr.length) return;
  out.push(`## ${title}`);
  if (note) { out.push(``); out.push(note); }
  out.push(``);
  out.push(`| 회차 | 세트 | 노출 | 라벨 | 화면값 | 행수 | 원천 | all_data 잔재 |${withV ? " 대조자 | 커밋 | 근거 |" : ""}`);
  out.push(`|---|---|---|---|---|--:|---|---|${withV ? "---|---|---|" : ""}`);
  for (const r of arr) {
    const base = `| ${r.yk} | \`${r.sid}\` | ${r.live ? "🔴 LIVE" : "비노출"} | ${r.label} | \`${r.shown ?? "(없음)"}\` | ${r.lines ?? "—"} | ${r.srcName} | ${r.stale === "일치" ? "일치" : r.stale === "—" ? "—" : `\`${r.stale}\``} |`;
    out.push(withV ? `${base} ${r.V.by} | \`${r.V.commit}\` | ${r.V.note} |` : base);
  }
  out.push(``);
};
tbl("PDF 대조 완료", ver, true);
tbl("미대조 — 원본과 대조한 적이 없다", unver, false);
tbl("화면에 안 나옴 — all_data 잔재만 있는 라벨", noShow, false,
  `D-108 ⓪ 판정: \`l2022c\` [C][D][E] 는 결함이 아니다 — 문항이 참조하지 않고, C-5 원본에도 [A][B] 뿐이며 화면도 [A][B] 다.`);
console.log(out.join("\n"));
