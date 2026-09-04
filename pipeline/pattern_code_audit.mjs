// pattern_code_audit.mjs — 해설 본문에 패턴 코드가 텍스트로 섞인 실태 조사 (발주 D-83)
//
// 목적: choices[].analysis 본문에 R1·L3 같은 **내부 패턴 코드**가 글자로 박혀 있는지,
//       몇 건이고 어느 세트인지, 학생이 실제로 보는 건 몇 건인지 확정한다.
//       데이터 수정은 이번 범위 밖 — 조사만 한다.
//
// 코드 집합은 pat 필드의 실제 값에서 가져온다(R1~R4 · L1~L5). 추측하지 않는다.
//   V 와 0 은 제외한다 — 한 글자라 본문의 보통 글자와 구분되지 않는다(오탐 원천).
//
// 유형 분류 — 위치로 가른다
//   앞머리 : analysis 맨 앞 12자 안
//   꼬리   : 맨 끝 30자 안 (해설 결론 뒤에 붙은 고정 꼬리)
//   중간   : 그 밖 — 문장 안에 진짜로 섞인 것
// 서식은 따로 센다: `— 패턴: 이름(코드)` / `…진술 (코드)` / `…진술 [코드]` / 기타
//
// 🔴 확정 방침 (2026-08-21) — 이 스크립트는 조사용이다. 정리 실행은 별도 발주 사항.
//   · 꼬리 4서식은 일괄 제거로 간다. 단 실행은 (가) 렌더 정제 배포 뒤.
//   · 본문↔pat 불일치 6건은 **제외 목록**으로 보존한다. 일괄 제거에 휩쓸리면 안 된다.
//     각 선지 내용을 읽어 수동 판정한 뒤에만 손댄다.
//   · V·0 은 문자열 매칭이 아니라 「꼬리 위치 + 구분 기호 동반」 조건으로만 잡는다.
//   · pat null 3,515건은 별도 백로그. 이번 축이 아니다.
//
// 사용: node pipeline/pattern_code_audit.mjs
// 금지: 데이터 수정. (읽기 전용 스크립트다)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "data-source/all_data_204.json");
const OUT = path.join(ROOT, "docs/pattern_code_audit_20260821.md");

const data = JSON.parse(fs.readFileSync(SRC, "utf8"));

// ── RELEASE_KEYS — src/ 는 읽기만 한다 ──
const RELEASE = (() => {
  const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
  const at = src.indexOf("const RELEASE_KEYS = new Set([");
  const end = src.indexOf("]);", at);
  return new Set([...src.slice(at, end).matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.includes("::")));
})();

// 코드 사전 — pat 필드의 실제 값에서 수집
const CODES = new Set();
for (const yk of Object.keys(data))
  for (const sec of ["reading", "literature"])
    for (const s of data[yk][sec] || [])
      for (const q of s.questions || [])
        for (const c of q.choices || []) {
          const p = c.pat;
          if (p == null) continue;
          for (const v of Array.isArray(p) ? p : [p]) {
            const t = String(v).trim();
            if (/^[RL]\d$/.test(t)) CODES.add(t);
          }
        }
const CODE_RE = new RegExp(`(?<![A-Za-z0-9])(${[...CODES].join("|")})(?![A-Za-z0-9])`, "g");
const HEAD_ZONE = 12;   // 맨 앞 몇 자까지를 「앞머리」로 볼 것인가
const TAIL_ZONE = 30;   // 맨 끝 몇 자까지를 「꼬리」로 볼 것인가

// 서식 판정 — 코드를 감싼 표기 형태
function formOf(a, at, code) {
  const before = a.slice(Math.max(0, at - 60), at);
  const wrapL = a[at - 1], wrapR = a[at + code.length];
  if (/[—–-]\s*패턴\s*:\s*[^()]{1,30}\($/.test(before)) return "— 패턴: 이름(코드)";
  if (wrapL === "(" && wrapR === ")") return "(코드)";
  if (wrapL === "[" && wrapR === "]") return "[코드]";
  return "기타";
}

const hits = [];
for (const yk of Object.keys(data))
  for (const sec of ["reading", "literature"])
    for (const s of data[yk][sec] || []) {
      const live = RELEASE.has(`${yk}::${s.id}`);
      for (const q of s.questions || [])
        for (const c of q.choices || []) {
          const a = String(c.analysis || "");
          if (!a) continue;
          const found = [...a.matchAll(CODE_RE)];
          if (!found.length) continue;
          const patField = c.pat == null ? null : String(Array.isArray(c.pat) ? c.pat.join("|") : c.pat);
          for (const m of found) {
            const at = m.index;
            const type = at < HEAD_ZONE ? "앞머리"
              : (a.length - (at + m[1].length)) <= TAIL_ZONE ? "꼬리" : "중간";
            hits.push({
              yk, sec, setId: s.id, qid: q.id, num: c.num, live,
              code: m[1], at, type, form: formOf(a, at, m[1]),
              dup: patField != null && patField.split("|").includes(m[1]),
              patField,
              ctx: a.slice(Math.max(0, at - 28), at + 34).replace(/\s+/g, " "),
            });
          }
        }
    }

// ── 집계 ──
const choiceKey = (h) => `${h.yk}::${h.setId}::${h.qid}::${h.num}`;
const choices = new Map();
for (const h of hits) if (!choices.has(choiceKey(h))) choices.set(choiceKey(h), h);
const liveHits = hits.filter((h) => h.live);
const liveChoices = [...choices.values()].filter((h) => h.live);
const TYPES = ["앞머리", "꼬리", "중간"];
const byType = (arr) => Object.fromEntries(TYPES.map((t) => [t, arr.filter((h) => h.type === t).length]));
const byForm = (arr) => {
  const o = {};
  for (const h of arr) o[h.form] = (o[h.form] || 0) + 1;
  return Object.entries(o).sort((a, b) => b[1] - a[1]);
};
const dupN = hits.filter((h) => h.dup).length;

const bySet = {};
for (const h of hits) {
  const k = `${h.yk}::${h.setId}`;
  (bySet[k] ??= { yk: h.yk, setId: h.setId, live: h.live, n: 0, codes: new Set() });
  bySet[k].n++; bySet[k].codes.add(h.code);
}
const sets = Object.values(bySet).sort((a, b) => b.n - a.n);

console.log(`코드 사전: ${[...CODES].sort().join(" ")}  (V·0 은 오탐 방지로 제외)`);
console.log(`총 검출 ${hits.length}건 · 선지 ${choices.size}개 · 세트 ${sets.length}개 · 회차 ${new Set(hits.map(h=>h.yk)).size}개`);
console.log(`노출(LIVE) 기준: ${liveHits.length}건 · 선지 ${liveChoices.length}개 · 세트 ${sets.filter(s=>s.live).length}개`);
console.log(`유형: ${TYPES.map((t) => `${t} ${byType(hits)[t]}`).join(" · ")}`);
console.log(`서식: ${byForm(hits).map(([f, n]) => `${f} ${n}`).join(" · ")}`);
console.log(`pat 필드와 중복: ${dupN}건 / ${hits.length}건 (${(dupN / (hits.length || 1) * 100).toFixed(1)}%)`);
console.log(`\n대표 예시 (노출 세트, 서식별 1개씩):`);
const seen = new Set();
for (const h of hits.filter((x) => x.live)) {
  if (seen.has(h.form)) continue;
  seen.add(h.form);
  console.log(`  ${h.yk} ${h.setId} Q${h.qid}#${h.num} [${h.type}/${h.form}] pat=${h.patField} 중복=${h.dup ? "예" : "아니오"}\n    …${h.ctx}…`);
}

// ── 문서 ──
const md = ["# 해설 본문 패턴 코드 잔재 조사 (발주 D-83 · 2026-08-21)", ""];
md.push("> **조사만 한다. 데이터는 손대지 않았다.** 정리 방침은 별도 발주 사항.", "");
md.push("## 세는 방법", "");
md.push(`- 코드 사전은 \`pat\` 필드의 실제 값에서 수집했다: \`${[...CODES].sort().join("` `")}\``);
md.push("- `V` 와 `0` 은 제외했다 — 한 글자라 본문의 보통 글자와 구분되지 않아 오탐이 된다.");
md.push("- 앞뒤가 영문·숫자면 코드로 세지 않는다(예: `R10`, `AR1`).");
md.push("- 유형은 **위치**로 가른다: 앞머리(맨 앞 12자 안) · 꼬리(맨 끝 30자 안) · 중간(그 밖).", "");
md.push("## 규모", "");
md.push("| 구분 | 검출 건수 | 선지 수 | 세트 수 |");
md.push("|---|--:|--:|--:|");
md.push(`| 전체 | ${hits.length} | ${choices.size} | ${sets.length} |`);
md.push(`| **노출(LIVE)** | **${liveHits.length}** | **${liveChoices.length}** | **${sets.filter((s) => s.live).length}** |`);
md.push(`| 비노출 | ${hits.length - liveHits.length} | ${choices.size - liveChoices.length} | ${sets.filter((s) => !s.live).length} |`);
md.push("");
md.push("## 유형", "");
md.push("| 유형 | 전체 | 노출(LIVE) |");
md.push("|---|--:|--:|");
const TYPE_LABEL = { 앞머리: "앞머리(맨 앞 12자 안)", 꼬리: "꼬리(맨 끝 30자 안)", 중간: "문장 중간 삽입" };
for (const t of TYPES) md.push(`| ${TYPE_LABEL[t]} | ${byType(hits)[t]} | ${byType(liveHits)[t]} |`);
md.push("");
md.push("## 서식", "");
md.push("| 서식 | 전체 | 노출(LIVE) |");
md.push("|---|--:|--:|");
const lf = Object.fromEntries(byForm(liveHits));
for (const [f, n] of byForm(hits)) md.push(`| \`${f}\` | ${n} | ${lf[f] ?? 0} |`);
md.push("");
md.push(`## pat 필드와의 중복 — ${dupN}/${hits.length}건 (${(dupN / (hits.length || 1) * 100).toFixed(1)}%)`, "");
md.push("같은 코드가 `pat` 필드에도 있는데 본문에도 박혀 있으면 **본문 쪽이 잔재**다.", "");
md.push("## 🔴 확정 방침 (2026-08-21) — 정리 실행 전 반드시 읽을 것", "");
md.push("- 꼬리 4서식은 **일괄 제거**로 간다. 단 실행은 **(가) 렌더 정제 배포 뒤**, 별도 발주로 한다.");
md.push("- 아래 **불일치 6건은 제외 목록**이다. 일괄 제거에 휩쓸리면 판정 근거가 사라진다.");
md.push("  각 선지 내용을 읽어 수동 판정한 뒤에만 손댄다. (`pat` 쪽 기본값 오채움이 유력하나 미확정)");
md.push("- `V`(216)·`0`(18)은 정리 발주에 포함하되, **문자열 매칭이 아니라 「꼬리 위치 + 구분 기호 동반」 조건으로만** 잡는다.");
md.push("- `pat` null 3,515건은 **별도 백로그**. 이번 축이 아니다.", "");
const MISMATCH = hits.filter((h) => !h.dup);
md.push(`### 제외 목록 — 본문↔pat 불일치 ${MISMATCH.length}건`, "");
md.push("| 회차 | 세트 | 문항 | 선지 | 본문 코드 | pat 필드 | 노출 | 문맥 |");
md.push("|---|---|--:|--:|---|---|---|---|");
for (const h of MISMATCH)
  md.push(`| ${h.yk} | \`${h.setId}\` | ${h.qid} | ${h.num} | **${h.code}** | ${h.patField ?? "-"} | ${h.live ? "🔴 LIVE" : "비노출"} | …${h.ctx.replace(/\|/g, "\|")}… |`);
md.push("");
md.push("## 세트별", "");
md.push("| 회차 | 세트 | 노출 | 건수 | 코드 |");
md.push("|---|---|---|--:|---|");
for (const s of sets)
  md.push(`| ${s.yk} | \`${s.setId}\` | ${s.live ? "🔴 LIVE" : "비노출"} | ${s.n} | ${[...s.codes].sort().join(" ")} |`);
md.push("");
md.push("## 전체 목록", "");
md.push("| 회차 | 세트 | 문항 | 선지 | 코드 | 유형 | pat | 중복 | 앞뒤 문맥 |");
md.push("|---|---|--:|--:|---|---|---|---|---|");
for (const h of hits)
  md.push(`| ${h.yk} | \`${h.setId}\` | ${h.qid} | ${h.num} | ${h.code} | ${h.type} | ${h.patField ?? "-"} | ${h.dup ? "예" : "아니오"} | …${h.ctx.replace(/\|/g, "\\|")}… |`);
md.push("");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md.join("\n"), "utf8");
console.log(`\n문서: ${path.relative(ROOT, OUT)}`);
