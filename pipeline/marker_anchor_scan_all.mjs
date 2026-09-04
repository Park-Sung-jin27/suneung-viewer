// marker_anchor_scan_all.mjs — 기존 353세트 마커 정합성 전수 스캔 (발주 D-94)
//
// 왜
//   재추출 19회차에서 「학습활동 상자가 이미지라 마커가 통째로 빠진」 유형이 2건 나왔다.
//   같은 유형이 **기존 데이터에도 있으면 이미 학생에게 나가고 있는 결함**이다.
//
// 검사만 한다. 수정은 결과 보고 후.
//
// 사용: node pipeline/marker_anchor_scan_all.mjs
// 금지: 데이터 수정. (읽기 전용이다)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkSetMarkers } from "./marker_anchor_check.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs/marker_anchor_scan_20260822.md");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data-source/all_data_204.json"), "utf8"));
const RELEASE = (() => {
  const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
  const at = src.indexOf("const RELEASE_KEYS = new Set([");
  return new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
    .map((m) => m[1]).filter((k) => k.includes("::")));
})();

let sets = 0, qs = 0;
const rows = [];
for (const yk of Object.keys(data))
  for (const sec of ["reading", "literature"])
    for (const s of data[yk][sec] || []) {
      sets++;
      qs += (s.questions || []).length;
      const live = RELEASE.has(`${yk}::${s.id}`);
      for (const m of checkSetMarkers(s)) rows.push({ yk, setId: s.id, sec, live, ...m });
    }

const live = rows.filter((r) => r.live);
const full = rows.filter((r) => !r.부분);
const part = rows.filter((r) => r.부분);
const byKind = {};
for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;

console.log(`## 기존 데이터 마커 정합성 전수 스캔`);
console.log(`  세트 ${sets} · 문항 ${qs}`);
console.log(`  🔴 미정박 ${rows.length}건 (문항 기준) · 그중 노출(LIVE) ${live.length}건`);
console.log(`     전부 누락 ${full.length} · 일부 누락 ${part.length}`);
console.log(`     종류별: ${Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(" · ")}\n`);
for (const r of rows.slice(0, 25))
  console.log(`  ${r.live ? "🔴LIVE" : "  비노출"} ${r.yk} ${r.setId} Q${r.qid} ${r.kind} — ` +
    `미정박 ${r.missing.join("")} (참조 ${r.refs.join("")} / 정박 ${r.anchors.join("") || "없음"})${r.부분 ? " [일부]" : ""}`);
if (rows.length > 25) console.log(`  … 외 ${rows.length - 25}건`);

const md = ["# 기존 데이터 마커 정합성 전수 스캔 (발주 D-94 · 2026-08-22)", ""];
md.push("> 선지·발문이 가리키는 `㉠`·`ⓐ`·`[A]` 가 그 세트의 지문(sents)이나 보기(bogi)에 실재하는가.",
  "> 없으면 학생은 무엇을 가리키는지 알 수 없다. **검사만 한다. 수정은 보고 후.**", "");
md.push("## 규모", "");
md.push("| 구분 | 건수 |", "|---|--:|");
md.push(`| 검사 대상 | 세트 ${sets} · 문항 ${qs} |`);
md.push(`| 🔴 미정박 (문항 기준) | **${rows.length}** |`);
md.push(`| 그중 노출(LIVE) | **${live.length}** |`);
md.push(`| 전부 누락 / 일부 누락 | ${full.length} / ${part.length} |`);
for (const [k, v] of Object.entries(byKind)) md.push(`| 종류 ${k} | ${v} |`);
md.push("");
md.push("## 전체 목록", "");
md.push("| 노출 | 회차 | 세트 | 문항 | 종류 | 미정박 | 참조 | 정박 | 범위 |");
md.push("|---|---|---|--:|---|---|---|---|---|");
for (const r of rows)
  md.push(`| ${r.live ? "🔴 LIVE" : "비노출"} | ${r.yk} | \`${r.setId}\` | ${r.qid} | ${r.kind} | ` +
    `**${r.missing.join("")}** | ${r.refs.join("")} | ${r.anchors.join("") || "없음"} | ${r.부분 ? "일부" : "전부"} |`);
md.push("");
md.push("## 한계", "");
md.push("- `(가)`·`(나)` 같은 작품 표지는 검사하지 않았다 — 본문에도 흔히 쓰여 오탐이 난다.");
md.push("- `①~⑤` 는 선지 번호라 제외했다.");
md.push("- 마커가 **이미지 안에만** 있는 경우(2016_9월A·2014_6월A 유형)는 여기서 「미정박」으로 잡힌다.");
md.push("  원본에 없는 것이 아니라 **텍스트로 못 옮긴 것**이므로, 수정은 원본 확인을 거쳐야 한다.");
md.push("");
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md.join("\n"), "utf8");
console.log(`\n문서: ${path.relative(ROOT, OUT)}`);
