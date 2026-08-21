// set_ranges.mjs — 원본 시험지에서 **세트 구간**을 스캔한다 (발주 D-86b ①)
//
// 왜 필요한가
//   구형 포맷 추출은 청크를 고정 번호(16~27 / 28~39 / 40~45)로 잘랐다.
//   그 경계가 세트 한가운데를 지나가면 **지문과 문항이 서로 다른 청크로 갈린다.**
//   2016_6월B 파일럿에서 실증됐다:
//     · l20166a — 문항은 [31~33](고전시가)인데 본문은 [41~43](현대시)
//     · Q41~43 문항은 통째로 사라짐
//   그래서 청크는 **세트 경계에서만** 잘라야 한다.
//
// 세트 구간의 근거
//   지시문 `[34～36] 다음 글을 읽고 물음에 답하시오.` 가 세트의 시작이다.
//   지시문에 안 묶인 번호는 단독 문항으로 각자 한 구간이 된다.
//
// 사용: import { scanSetRanges, planChunks } from "./set_ranges.mjs"
//       node pipeline/set_ranges.mjs <yearKey>      ← 단독 실행 시 스캔 결과 출력

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function pdfText(pdfPath, layout = true) {
  return execFileSync("pdftotext",
    [...(layout ? ["-layout"] : ["-raw"]), "-enc", "UTF-8", pdfPath, "-"],
    { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

/**
 * 세트 구간 스캔.
 * @returns [{from, to, kind:"set"|"single"}]  번호 오름차순, 겹침 없음
 */
export function scanSetRanges(pdfPath, { min = 1, max = 45 } = {}) {
  const txt = pdfText(pdfPath);

  // ① 지시문 [a~b] 수집
  const ranges = [];
  for (const m of txt.matchAll(/\[\s*(\d{1,2})\s*[~～∼]\s*(\d{1,2})\s*\]/g)) {
    const from = Number(m[1]), to = Number(m[2]);
    if (from >= min && to <= max && from <= to) ranges.push({ from, to, kind: "set" });
  }
  // 같은 구간이 여러 번 찍히면(쪽 넘김) 하나로
  const seen = new Set();
  const sets = ranges.filter((r) => {
    const k = `${r.from}-${r.to}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).sort((a, b) => a.from - b.from);

  // ② 실재하는 문항 번호 수집
  const nums = new Set();
  for (const line of txt.split(/\r?\n/))
    for (const seg of line.split(/ {3,}/)) {
      const m = seg.trim().match(/^(\d{1,2})\.\s*\S/);
      if (m) { const n = Number(m[1]); if (n >= min && n <= max) nums.add(n); }
    }

  // ③ 세트에 안 묶인 번호는 단독 구간
  const covered = new Set();
  for (const r of sets) for (let n = r.from; n <= r.to; n++) covered.add(n);
  const singles = [...nums].filter((n) => !covered.has(n)).sort((a, b) => a - b)
    .map((n) => ({ from: n, to: n, kind: "single" }));

  return [...sets, ...singles].sort((a, b) => a.from - b.from);
}

/**
 * 세트 경계를 지키며 청크를 만든다.
 * @param maxQ 한 청크가 담을 문항 수 상한 (넘겨도 세트는 절대 안 자른다)
 */
export function planChunks(ranges, maxQ = 13) {
  const chunks = [];
  let cur = [];
  const size = (arr) => arr.reduce((a, r) => a + (r.to - r.from + 1), 0);
  for (const r of ranges) {
    const rn = r.to - r.from + 1;
    if (cur.length && size(cur) + rn > maxQ) { chunks.push(cur); cur = []; }
    cur.push(r);
  }
  if (cur.length) chunks.push(cur);
  return chunks.map((c) => ({
    from: c[0].from, to: c[c.length - 1].to, ranges: c, count: size(c),
  }));
}

// ── 단독 실행 ──
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const yk = process.argv[2];
  if (!yk) { console.error("사용법: node pipeline/set_ranges.mjs <yearKey>"); process.exit(1); }
  const dir = path.join(ROOT, "_done", yk);
  const pdf = fs.readdirSync(dir).find((f) => f.endsWith(".pdf") && f.includes("시험지"));
  const ranges = scanSetRanges(path.join(dir, pdf));
  console.log(`## ${yk} — 세트 구간 ${ranges.length}개`);
  for (const r of ranges)
    console.log(`  ${r.kind === "set" ? "세트" : "단독"} [${r.from}~${r.to}] (${r.to - r.from + 1}문항)`);
  const chunks = planChunks(ranges);
  console.log(`\n## 청크 계획 ${chunks.length}개 (세트를 자르지 않는다)`);
  for (const [i, c] of chunks.entries())
    console.log(`  청크${i + 1}: ${c.from}~${c.to} · ${c.count}문항 · ` +
      c.ranges.map((r) => `[${r.from}~${r.to}]`).join(" "));
}
