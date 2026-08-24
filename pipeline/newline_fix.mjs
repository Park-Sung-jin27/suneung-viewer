// newline_fix.mjs — 재추출 sents.t 의 PDF 조판 줄바꿈 정리 (발주 2026-08-24 ①)
//
// 규칙 (원본 PDF 에서 판별 — 추측 금지)
//   PDF 줄이 **공백으로 끝나면** 어절 경계 → `\n` 을 공백으로
//   PDF 줄이 공백 없이 끝나면 어절 중간 강제 절단 → `\n` 을 제거
//   (2016_6월B 표본 14/14 검증. "조각"+"을 내었다" → "조각을 내었다",
//    "그 북을"+"통해" → "그 북을 통해")
//
// 판별 불가 건은 **고치지 않고 목록으로 남긴다**. 추측으로 메우지 않는다.
//
// 사용: node pipeline/newline_fix.mjs [--only <yearKey>] [--apply]
// 금지: all_data 병합. 원본 PDF 없이 텍스트 생성(§13⑬).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();
// --fields : 발문·선지·보기까지 확장 (기본은 sents.t 만)
const FIELDS = process.argv.includes("--fields");

const W = (s) => String(s).replace(/\s/g, "");

// ── PDF 줄 목록 (끝 공백 여부 포함) ──
function pdfLines(yk) {
  const dir = path.join(ROOT, "_done", yk);
  const f = fs.readdirSync(dir).find((x) => x.endsWith(".pdf") && x.includes("시험지"));
  if (!f) throw new Error(`${yk}: 시험지 PDF 없음`);
  const out = path.join(os.tmpdir(), `lines_${yk}.json`);
  execFileSync("python", [path.join(ROOT, "pipeline/pdf_line_ends.py"), path.join(dir, f), out],
    { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(fs.readFileSync(out, "utf8")).lines;
}

// ── 줄바꿈 한 지점의 판별 ──
//   앞 조각 꼬리 + 뒤 조각 머리로 **연속한 PDF 줄 쌍** 을 찾는다.
//   쌍으로 찾으면 유일성이 높아 오판이 거의 없다. 못 찾으면 단일 줄 꼬리로 재시도.
function decide(lines, idx, prev, next) {
  for (const n of [16, 12, 9, 7, 5]) {
    const a = W(prev), b = W(next);
    if (a.length < n) continue;
    const ka = a.slice(-n), kb = b.slice(0, Math.min(n, b.length));
    const hits = [];
    for (let i = 0; i < lines.length - 1; i++) {
      if (!W(lines[i].t).endsWith(ka)) continue;
      if (kb && !W(lines[i + 1].t).startsWith(kb)) continue;
      hits.push(lines[i]);
    }
    if (hits.length && hits.every((h) => h.sp === hits[0].sp))
      return { sp: hits[0].sp, how: `쌍매칭 ${n}자` };
  }
  // 역방향 — 앞 조각이 짧을 때(문장 첫머리 등)는 **뒤 조각 머리로 시작하는 줄**을
  //   찾고 그 **바로 앞 줄**의 끝 공백을 본다. ("아들은" ⏎ "민 노인을…" 류 구제)
  for (const n of [20, 16, 12, 9]) {
    const b = W(next);
    if (b.length < n) continue;
    const kb = b.slice(0, n);
    const hits = [];
    for (let i = 1; i < lines.length; i++)
      if (W(lines[i].t).startsWith(kb)) hits.push(lines[i - 1]);
    if (hits.length && hits.every((h) => h.sp === hits[0].sp))
      return { sp: hits[0].sp, how: `역방향 ${n}자` };
  }
  // 단일 줄 꼬리 (다음 줄이 다른 단·다른 쪽으로 넘어간 경우)
  for (const n of [18, 14, 10]) {
    const a = W(prev);
    if (a.length < n) continue;
    const hits = lines.filter((l) => W(l.t).endsWith(a.slice(-n)));
    if (hits.length && hits.every((h) => h.sp === hits[0].sp))
      return { sp: hits[0].sp, how: `단일 ${n}자` };
  }
  return null;
}

const rounds = fs.readdirSync(STEP3).filter((d) => fs.existsSync(path.join(STEP3, d, "step4_result.json")));
const targets = ONLY ? rounds.filter((r) => r === ONLY) : rounds;
if (!targets.length) { console.error(`🔴 대상 회차 없음`); process.exit(1); }

console.log(`## 줄바꿈 정리 ${APPLY ? "적용" : "DRY-RUN"} — ${targets.length}회차\n`);
let gTot = 0, gSp = 0, gNo = 0, gUnk = 0;
const unresolved = [];

for (const yk of targets) {
  const p = path.join(STEP3, yk, "step4_result.json");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  let lines;
  try { lines = pdfLines(yk); }
  catch (e) { console.log(`  ${yk.padEnd(11)} 🔴 ${e.message}`); continue; }

  let tot = 0, sp = 0, no = 0, unk = 0;
  for (const s of [...(j.reading || []), ...(j.literature || [])]) {
    // 한 문자열의 조판 줄바꿈을 정리한다. 판별 불가 지점은 \n 그대로 남긴다.
    const clean = (raw, where) => {
      const t = String(raw ?? "");
      if (!t.includes("\n")) return t;
      const parts = t.split("\n");
      let out = parts[0];
      for (let i = 0; i < parts.length - 1; i++) {
        tot++;
        const d = decide(lines, i, parts[i], parts[i + 1]);
        if (d === null) {
          unk++;
          unresolved.push({ yk, set: s.id, sid: where, a: parts[i].slice(-24), b: parts[i + 1].slice(0, 24) });
          out += "\n" + parts[i + 1];          // 판별 불가 — 손대지 않는다
        } else if (d.sp) { sp++; out += " " + parts[i + 1]; }
        else { no++; out += parts[i + 1]; }
      }
      return out;
    };

    for (const x of s.sents || []) {
      const v = clean(x.t, x.id);
      if (APPLY) x.t = v;
    }
    // 발문·선지·보기도 같은 조판 줄바꿈을 안고 있다(실측: 발문 30% · 선지 75% · 보기 100%).
    // choices.analysis 는 제외한다 — 해설이 문단을 줄바꿈으로 나누는 것은 정상이고,
    // 기존 353세트도 99.4%가 줄바꿈을 갖는다.
    if (FIELDS)
      for (const q of s.questions || []) {
        const qv = clean(q.t, `Q${q.id}.t`);
        if (APPLY) q.t = qv;
        if (typeof q.bogi === "string") {
          const bv = clean(q.bogi, `Q${q.id}.bogi`);
          if (APPLY) q.bogi = bv;
        } else if (q.bogi && typeof q.bogi === "object" && !Array.isArray(q.bogi)) {
          for (const k of Object.keys(q.bogi))
            if (typeof q.bogi[k] === "string") {
              const bv = clean(q.bogi[k], `Q${q.id}.bogi.${k}`);
              if (APPLY) q.bogi[k] = bv;
            }
        }
        for (const c of q.choices || []) {
          const cv = clean(c.t, `Q${q.id}#${c.num}.t`);
          if (APPLY) c.t = cv;
        }
      }
  }
  if (APPLY) fs.writeFileSync(p, JSON.stringify(j, null, 2), "utf8");
  console.log(`  ${yk.padEnd(11)} 줄바꿈 ${String(tot).padStart(4)} → 공백 ${String(sp).padStart(4)} · 붙임 ${String(no).padStart(4)} · 판별불가 ${String(unk).padStart(3)}${unk ? " ⚠" : " ✅"}`);
  gTot += tot; gSp += sp; gNo += no; gUnk += unk;
}

console.log(`\n## 합계 — 줄바꿈 ${gTot}개`);
console.log(`   공백으로 (어절 경계)     ${gSp} (${(gSp / gTot * 100).toFixed(1)}%)`);
console.log(`   붙임으로 (어절 중간 절단) ${gNo} (${(gNo / gTot * 100).toFixed(1)}%)`);
console.log(`   판별 불가 (손대지 않음)   ${gUnk} (${(gUnk / gTot * 100).toFixed(1)}%)`);

if (unresolved.length) {
  const rp = path.join(ROOT, "docs/newline_unresolved_20260824.md");
  const md = ["# 줄바꿈 판별 불가 목록 (2026-08-24)", "",
    "> PDF 에서 줄 끝 공백 여부를 확정하지 못한 지점. **추측으로 메우지 않고 원형 그대로 두었다.**",
    "> 원본 PDF 육안 대조가 필요하다.", "",
    `총 ${unresolved.length}건`, "", "| 회차 | 세트 | 문장 | 앞 조각 | 뒤 조각 |", "|---|---|---|---|---|"];
  for (const u of unresolved)
    md.push(`| ${u.yk} | ${u.set} | ${u.sid} | …${u.a.replace(/\|/g, "\\|")} | ${u.b.replace(/\|/g, "\\|")}… |`);
  fs.writeFileSync(rp, md.join("\n"), "utf8");
  console.log(`\n   판별 불가 목록 → docs/newline_unresolved_20260824.md`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
