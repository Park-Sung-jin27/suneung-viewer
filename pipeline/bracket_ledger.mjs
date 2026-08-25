// bracket_ledger.mjs — 구간 표시 검증 대장 생성 (발주 D-106 ④)
//
// ⑦축·⑥축은 「회귀 방지」용이다. 커버리지(어디까지 원본과 대조했는가)는
// 축이 아니라 이 대장이 담당한다 — 축은 대조하지 않은 세트를 통과로 보여 줄 수 있다.
//
// 실태(범위·렌더 여부)는 데이터에서 자동으로 뽑는다.
// 「PDF 대조 완료·대조자·커밋」만 아래 VERIFIED 에 손으로 적는다 — 자동 판정하지 않는다.
//
// 사용: node pipeline/bracket_ledger.mjs > docs/bracket_verification_ledger.md

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

// setId → { 대조자, 커밋, 근거 }.  ★ 자동 판정 금지 — 실제로 원본과 대조한 것만 적는다.
const VERIFIED = {
  l2019b:  { by: "엔지니어+심사관", commit: "e2efb2f", note: "16면. 심사관 LIVE 교차확정" },
  l2023d:  { by: "엔지니어+심사관", commit: "9e7e1f0 / 3cb64e3", note: "21면. 기존 4개 오정박 → 6개 재정박. D-106 ① 에서 벡터로 재확인(가로획 6쌍 일치)" },
  l2015b:  { by: "엔지니어",        commit: "4bee58a", note: "12면" },
  l2015d:  { by: "엔지니어",        commit: "4bee58a", note: "14면" },
  l2018a:  { by: "엔지니어",        commit: "4bee58a", note: "7면" },
  l2018c:  { by: "엔지니어",        commit: "c82d95e", note: "12면" },
  l2020c:  { by: "엔지니어",        commit: "c82d95e", note: "12~13면" },
  r2021b:  { by: "엔지니어",        commit: "c82d95e", note: "10면" },
  l2023b:  { by: "엔지니어+심사관", commit: "563878f / 9608b96", note: "8면. 기존 3개 전부 오정박 → 재정박. [B] 는 심사관 확정값. s56 인라인 [C] 제거" },
  r2024a:  { by: "엔지니어(벡터)",  commit: "cc07f26", note: "1면. 가로획 362.1/603.0" },
  r20256d: { by: "엔지니어(벡터)",  commit: "83540dc", note: "5면. 가로획 420.4/734.0" },
  l20276a: { by: "엔지니어(벡터)+심사관", commit: "56e77ff", note: "6~7면 걸침. 가로획 904.9/181.6. C-4 판독보다 1행 길다 — 심사관 원본 대조로 확정(Q20 ⑤ 가 '궁둥이를 탁 치'를 [A] 로 인용)" },
  l20276c: { by: "엔지니어(벡터)",  commit: "870c2d2", note: "10면 좌→우단 걸침. 가로획 735.8/182.9" },
  l20276d: { by: "엔지니어(벡터)+심사관", commit: "3b01333", note: "11면. 3구간. C-4 판독보다 [A] 가 1행 길다 — 심사관 원본 대조로 확정. 조판 규칙의 기준점" },
  r20249b: { by: "엔지니어(벡터)",  commit: "59eb645", note: "2면. 가로획 695.6/862.3, 879.4/1009.2" },
};

const norm = (s) => String(s).replace(/_/g, "");
const rows = [];
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const br = (s.annotations || []).filter((a) => a && a.type === "bracket");
      if (!br.length) continue;
      const ids = (s.sents || []).map((x) => String(x.id));
      const soft = new Set(ids.map(norm));
      for (const a of br) {
        const f = ids.indexOf(String(a.sentFrom)), t = ids.indexOf(String(a.sentTo));
        let render;
        if (f >= 0 && t >= 0) render = f <= t ? "그려짐" : "역방향";
        else if (soft.has(norm(a.sentFrom)) && soft.has(norm(a.sentTo))) render = "🔴 안 그려짐(언더스코어)";
        else render = "🔴 안 그려짐(죽은 참조)";
        rows.push({
          yk, sid: s.id, live: REL.has(`${yk}::${s.id}`), label: a.label,
          range: `${a.sentFrom} ~ ${a.sentTo}`,
          lines: f >= 0 && t >= 0 && f <= t ? t - f + 1 : null,
          render,
        });
      }
    }
rows.sort((a, b) => (a.yk + a.sid + a.label).localeCompare(b.yk + b.sid + b.label));

const setsOf = (pred) => new Set(rows.filter(pred).map((r) => `${r.yk}::${r.sid}`)).size;
const ver = rows.filter((r) => VERIFIED[r.sid]);
const unver = rows.filter((r) => !VERIFIED[r.sid]);
const bad = rows.filter((r) => r.render.startsWith("🔴"));

const out = [];
out.push(`# 구간 표시 [A]~[F] 검증 대장`);
out.push(``);
out.push(`> 생성: \`node pipeline/bracket_ledger.mjs > docs/bracket_verification_ledger.md\``);
out.push(`> 실태(범위·렌더 여부)는 데이터에서 자동으로 뽑는다. **PDF 대조 여부는 손으로 적는다** — 자동 판정하지 않는다.`);
out.push(`> ⑥축·⑦축은 회귀 방지용이고, 「어디까지 원본과 대조했는가」는 이 대장이 답한다.`);
out.push(``);
out.push(`## 요약`);
out.push(``);
out.push(`| 항목 | bracket | 세트 | LIVE bracket |`);
out.push(`|---|--:|--:|--:|`);
out.push(`| 전체 | ${rows.length} | ${setsOf(() => true)} | ${rows.filter((r) => r.live).length} |`);
out.push(`| **PDF 대조 완료** | **${ver.length}** | **${setsOf((r) => VERIFIED[r.sid])}** | **${ver.filter((r) => r.live).length}** |`);
out.push(`| 미대조 | ${unver.length} | ${setsOf((r) => !VERIFIED[r.sid])} | ${unver.filter((r) => r.live).length} |`);
out.push(`| 🔴 화면에 안 그려짐 | ${bad.length} | ${setsOf((r) => r.render.startsWith("🔴"))} | ${bad.filter((r) => r.live).length} |`);
out.push(``);
out.push(`「안 그려짐」은 렌더러 \`getBracketInfo\`(src/PassagePanel.jsx:655)가 \`sentIds.indexOf\` 로`);
out.push(`**정확 일치**만 보기 때문이다. 못 찾으면 \`continue\` 로 조용히 건너뛴다 — 데이터에는 있는데 화면에 없다.`);
out.push(``);
out.push(`## 대조 완료`);
out.push(``);
out.push(`| 회차 | 세트 | 노출 | 라벨 | 범위 | 행수 | 렌더 | 대조자 | 커밋 | 근거 |`);
out.push(`|---|---|---|---|---|--:|---|---|---|---|`);
for (const r of ver) {
  const V = VERIFIED[r.sid];
  out.push(`| ${r.yk} | \`${r.sid}\` | ${r.live ? "🔴 LIVE" : "비노출"} | ${r.label} | \`${r.range}\` | ${r.lines ?? "—"} | ${r.render} | ${V.by} | \`${V.commit}\` | ${V.note} |`);
}
out.push(``);
out.push(`## 미대조 — 원본과 대조한 적이 없다`);
out.push(``);
out.push(`| 회차 | 세트 | 노출 | 라벨 | 범위 | 행수 | 렌더 |`);
out.push(`|---|---|---|---|---|--:|---|`);
for (const r of unver)
  out.push(`| ${r.yk} | \`${r.sid}\` | ${r.live ? "🔴 LIVE" : "비노출"} | ${r.label} | \`${r.range}\` | ${r.lines ?? "—"} | ${r.render} |`);
out.push(``);
console.log(out.join("\n"));
