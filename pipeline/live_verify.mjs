// live_verify.mjs — 복원값이 LIVE 배포본까지 도달했는지 검증 (발주 D-67)
//
// 복원 → 커밋 → push → 배포 → 화면 사이에서 어디가 끊겨도
// 「고쳤다」고 착각하게 된다. 이 도구는 **배포본을 직접 받아** 확인한다.
//
// 검증 2단계
//   ① 전체 동일성 — origin/main 의 all_data_204.json 과 LIVE 배포본이 같은가
//      같으면 개별 건은 자동으로 전부 반영이다. 가장 강한 검증이다.
//   ② 개별 확정 건 — pipeline/live_expect.json 의 「기대 문구」가 LIVE 에 있는가
//      ①이 실패했을 때 **무엇이** 빠졌는지 짚는다.
//
// ★ /data/* 는 F-8 Edge Middleware 가 막는다. 앱과 같은 헤더로 요청한다.
// ★ 기준: 미반영 0건. 1건이라도 나오면 광고 개시 조건 ㉠ 불충족.
//
// 사용: node pipeline/live_verify.mjs [--url <origin>] [--local <경로>]
//   --local 을 주면 그 파일을 「배포본」으로 보고 대조한다(오프라인 검증용).

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ORIGIN = arg("--url", "https://suneung-viewer.vercel.app");
const LOCAL = arg("--local", null);

async function fetchLive() {
  if (LOCAL) return fs.readFileSync(LOCAL, "utf8");
  const r = await fetch(`${ORIGIN}/data/all_data_204.json`, {
    headers: {
      // 앱이 보내는 것과 같은 맥락. 미들웨어는 이 둘 중 하나만 있으면 통과시킨다.
      Referer: `${ORIGIN}/`,
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Dest": "empty",
      "User-Agent": "Mozilla/5.0 (live_verify)",
      "Cache-Control": "no-cache",
    },
  });
  if (!r.ok) throw new Error(`LIVE 요청 실패 HTTP ${r.status} — ${await r.text()}`);
  return await r.text();
}

const liveText = await fetchLive();
// 기준본 — origin/main 의 값. 작업트리가 아니라 원격이 기준이다.
const refText = execFileSync("git", ["cat-file", "-p", "origin/main:data-source/all_data_204.json"],
  { cwd: ROOT, encoding: "buffer", maxBuffer: 1 << 28 }).toString("utf8");

console.log(`## LIVE 도달 검증\n`);
console.log(`기준본 origin/main : ${refText.length.toLocaleString()}자`);
console.log(`배포본 ${LOCAL ? LOCAL : ORIGIN} : ${liveText.length.toLocaleString()}자\n`);

// ── ① 전체 동일성 ──
const same = liveText === refText;
console.log(`① 전체 동일성 : ${same ? "✅ 동일 — 개별 건은 전부 반영됨" : "🔴 다름"}\n`);

// ── ② 개별 확정 건 ──
let expect = [];
try { expect = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/live_expect.json"), "utf8")); }
catch { console.log("② live_expect.json 없음 — 개별 검증 생략"); process.exit(same ? 0 : 1); }
const L = JSON.parse(liveText);
const pick = (d, yk, sid, loc) => {
  const set = ["reading", "literature"].map((s) => (d[yk]?.[s] || []).find((v) => v.id === sid)).find(Boolean);
  if (!set) return null;
  let m;
  if ((m = /^지문 (.+)$/.exec(loc))) return (set.sents || []).find((t) => t.id === m[1])?.t ?? null;
  if ((m = /^Q(\d+) 발문$/.exec(loc))) return set.questions.find((q) => q.id === +m[1])?.t ?? null;
  if ((m = /^Q(\d+) 보기$/.exec(loc))) { const b = set.questions.find((q) => q.id === +m[1])?.bogi; return typeof b === "string" ? b : null; }
  if ((m = /^Q(\d+) 선지(\d)$/.exec(loc))) return set.questions.find((q) => q.id === +m[1])?.choices.find((c) => c.num === +m[2])?.t ?? null;
  return null;
};
const bad = [];
for (const e of expect) {
  const got = pick(L, e.yk, e.setId, e.where);
  if (got === null) { bad.push({ ...e, got: "(단위를 찾을 수 없음)" }); continue; }
  if (!String(got).includes(e.expect)) bad.push({ ...e, got: String(got).slice(0, 60) });
}
console.log(`② 개별 확정 건 ${expect.length}건 검증 → 미반영 ${bad.length}건`);
if (bad.length) {
  console.log("\n| 회차 | 세트 | 위치 | 기대값 | LIVE 실제값 |\n|---|---|---|---|---|");
  for (const b of bad) console.log(`| ${b.yk} | \`${b.setId}\` | ${b.where} | ${b.expect} | ${b.got} |`);
}
console.log(`\n${same && !bad.length ? "✅ 미반영 0건 — 광고 개시 조건 ㉠ 충족" : "🔴 미반영 있음 — 조건 ㉠ 불충족"}`);
process.exit(same && !bad.length ? 0 : 1);
