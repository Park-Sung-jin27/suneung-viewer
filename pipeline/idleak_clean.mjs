// idleak_clean.mjs — analysis 본문에 노출된 내부 문장 id 제거 (발주 2026-08-24 ④)
//
// step3 가 근거를 인용하면서 문장 id 를 괄호로 병기했다:
//   "…새로운 감성과 감각이 일깨워진다." (r20199cs26)
//   …청년이 공동묘지 이야기를 꺼내고(l20146fs9~11), 장돌뱅이도…
// 학생 화면에 그대로 보인다. 게이트 H_analysis_id_leak 이 잡는 결함이다.
//
// 제거 조건은 **괄호로 감싼 id** 로 한정한다. 괄호 없이 본문에 박힌 id 는
// 문장 구조를 무너뜨릴 수 있으므로 손대지 않고 목록으로 남긴다.
// step3 프롬프트 자체의 수정은 이 발주 범위 밖(백로그).
//
// 사용: node pipeline/idleak_clean.mjs [--only <yearKey>] [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();

const SID = "[rl]\\d{4,6}[a-z]?s\\d+";
// (r20199cs26) · (l20146fs9~11) · (r20179cs16~17) · (l20146fs9, l20146fs12)
// 괄호 안 앞머리에 한글 라벨이 붙기도 한다: (지문 l20149es30~34)
const PAREN = new RegExp(
  `\\s*[（(]\\s*(?:[가-힣]+\\s+)?${SID}(?:\\s*[~∼\\-,·/]\\s*(?:${SID}|\\d+))*\\s*[）)]`, "g");
const BARE = new RegExp(SID, "g");

const rounds = fs.readdirSync(STEP3).filter((d) => fs.existsSync(path.join(STEP3, d, "step4_result.json")));
const targets = ONLY ? rounds.filter((r) => r === ONLY) : rounds;

let gParen = 0, gChoice = 0;
const leftover = [];

console.log(`## analysis 내부 id 제거 ${APPLY ? "적용" : "DRY-RUN"} — ${targets.length}회차\n`);
for (const yk of targets) {
  const p = path.join(STEP3, yk, "step4_result.json");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  let paren = 0, ch = 0;
  for (const s of [...(j.reading || []), ...(j.literature || [])])
    for (const q of s.questions || []) for (const c of q.choices || []) {
      const a = String(c.analysis ?? "");
      if (!a || !BARE.test(a)) { BARE.lastIndex = 0; continue; }
      BARE.lastIndex = 0;
      const cleaned = a.replace(PAREN, "");
      const n = (a.match(PAREN) || []).length;
      if (n) { paren += n; ch++; if (APPLY) c.analysis = cleaned; }
      // 괄호 밖에 남은 id — 손대지 않는다
      const rest = cleaned.match(BARE) || [];
      for (const r of rest) {
        const at = cleaned.indexOf(r);
        leftover.push({ yk, set: s.id, q: q.id, c: c.num, id: r, ctx: cleaned.slice(Math.max(0, at - 28), at + r.length + 22) });
      }
    }
  if (APPLY) fs.writeFileSync(p, JSON.stringify(j, null, 2), "utf8");
  if (paren || leftover.some((x) => x.yk === yk))
    console.log(`  ${yk.padEnd(11)} 괄호형 제거 ${String(paren).padStart(3)} (선지 ${ch}) · 괄호 밖 잔존 ${leftover.filter((x) => x.yk === yk).length}`);
  gParen += paren; gChoice += ch;
}
console.log(`\n## 합계 — 괄호형 ${gParen}건 제거 (선지 ${gChoice}개) · 괄호 밖 잔존 ${leftover.length}건`);
if (leftover.length) {
  const rp = path.join(ROOT, "docs/idleak_leftover_20260824.md");
  const md = ["# 괄호 밖에 남은 내부 id (2026-08-24)", "",
    "> 문장 안에 그대로 박혀 있어 기계적으로 지우면 문장이 깨진다. **손대지 않았다.**",
    "> 개별 판단이 필요하다.", "", `총 ${leftover.length}건`, "",
    "| 회차 | 세트 | 문항 | 선지 | id | 앞뒤 |", "|---|---|--:|--:|---|---|"];
  for (const x of leftover)
    md.push(`| ${x.yk} | ${x.set} | ${x.q} | ${x.c} | \`${x.id}\` | …${x.ctx.replace(/\|/g, "\\|").replace(/\n/g, " ")}… |`);
  fs.writeFileSync(rp, md.join("\n"), "utf8");
  console.log(`   목록 → docs/idleak_leftover_20260824.md`);
  for (const x of leftover.slice(0, 6)) console.log(`   ⚠ ${x.yk} ${x.set} Q${x.q}#${x.c}: …${x.ctx.replace(/\n/g, " ")}…`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
