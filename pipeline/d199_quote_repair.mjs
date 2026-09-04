// d199_quote_repair.mjs — 📌 인용 변형 + 선지 라벨 혼입 수리 (발주 D-199 ②③)
//
// set_intake_gate 가 잡은 것을 고친다. 인용문을 새로 짓지 않고 **본문에서 잘라낸다** —
//   시작·끝 어구를 원문에서 찾아 그 사이를 그대로 가져오므로 결과가 연속 부분문자열임이
//   보장된다(D-196 에서 쓴 방식 그대로).
//
// 유형별 처리
//   ㉮ 종결 부호 부착 — 끝 1~2자가 원문에 없다. 그만큼 잘라낸다.
//   ㉯ 말줄임 생략 — 「A… B」로 가운데를 덜어냈다. 두 갈래로 나뉜다.
//        · 메우기 : 덜어낸 구간이 짧으면(기본 60자) 원문 그대로 이어 붙인다.
//                   인용이 조금 길어지지만 연속 원문이 되고 형광펜도 자연스럽다.
//        · 나누기 : 덜어낸 구간이 길면 두 인용으로 분리한다("A" / "B").
//                   같은 세트 Q26#5 가 이미 쓰는 형식이다.
//     ★ 한 규칙으로 밀어붙이지 않는 이유: 먼 두 구간을 억지로 이으면 인용이 지문
//       절반이 되고, 가까운 구간을 굳이 나누면 문맥이 끊긴다. 길이로 가른다.
//
// ㉰ 선지 라벨 혼입 — 선지 끝의 단독 [X] 줄을 자른다. 해설·cs 는 손대지 않는다.
//
// 본문 서술(🔍)과 결론줄은 어떤 경우에도 건드리지 않는다. 📌 줄과 선지 t 만 고친다.
//
// 사용: node pipeline/d199_quote_repair.mjs --year 2027_9월 [--apply] [--gap 60]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { quoteResolved } from "./haesol_v2_gate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const YEAR = opt("--year", null);
const GAP = Number(opt("--gap", "60"));
const APPLY = argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
if (!YEAR) { console.error("--year <회차> 필수"); process.exit(1); }

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));

// 📌 줄에서 ASCII 큰따옴표 짝을 떠 인용을 꺼낸다 (haesol_v2_gate.extractQuotes 와 같은 규칙)
const quotesOf = (line) => {
  const pos = []; for (let i = 0; i < line.length; i++) if (line[i] === '"') pos.push(i);
  const out = [];
  for (let i = 0; i + 1 < pos.length; i += 2) { const q = line.slice(pos[i] + 1, pos[i + 1]); if (q.length >= 12) out.push(q); }
  return out;
};
const RE_ELL = /\s*(?:…+|\.{2,})\s*/;

// ★ 공백 역매핑 잘라내기.
//   이 조판은 줄이 단어 중간에서 끊긴다 — 「…항상 근심 / 하고, 자기가…」. 그래서
//   원문을 공백 한 칸으로 이어 붙여도 인용 조각이 그대로는 안 나온다. 공백을 모두
//   지운 문자열에서 찾은 다음, 그 위치를 원문 인덱스로 되돌려 원문을 잘라낸다.
//   ★ 새 문자열을 짓지 않는다 — 결과는 언제나 원문에서 떼어낸 조각이다.
function stripMap(src) {
  let flat = ""; const map = [];
  for (let i = 0; i < src.length; i++) if (!/\s/.test(src[i])) { flat += src[i]; map.push(i); }
  return { flat, map };
}
function carveLoose(src, head, tail) {
  const S = stripMap(src), H = head.replace(/\s+/g, ""), T = tail.replace(/\s+/g, "");
  if (!H || !T) return null;
  // 시작 어구가 여러 곳이면(짧은 조각일 때 흔하다) 끝 어구를 담는 **가장 짧은** 구간을
  //   고른다. 앞쪽 것을 무턱대고 쓰면 인용이 지문 절반이 된다.
  let i = -1, j = -1, best = Infinity;
  for (let p = S.flat.indexOf(H); p >= 0; p = S.flat.indexOf(H, p + 1)) {
    // 조각이 하나뿐이면 시작과 끝이 같은 문자열이다. 그때 끝을 시작 "뒤에서" 찾으면
    //   같은 말이 다시 나올 리 없어 늘 실패한다 — 그 자리 자체가 구간이다.
    const q = H === T ? p : S.flat.indexOf(T, p + H.length);
    if (q < 0) continue;
    const span = q + T.length - p;
    if (span < best) { best = span; i = p; j = q; }
  }
  if (i < 0 || j < 0) return null;
  const from = S.map[i], to = S.map[j + T.length - 1];
  return src.slice(from, to + 1).replace(/\s+/g, " ");
}
const plans = [], skipped = [];
let warnOnly = 0;
for (const sec of ["reading", "literature"]) for (const set of data[YEAR]?.[sec] || []) {
  const sid = set.setId || set.id;
  const sents = set.sents || [];
  const PASSAGE = sents.map((s) => String(s.t)).join(" ");
  for (const q of set.questions || []) {
    const ctx = { sents, bogi: q.bogi || "", qt: q.t, choices: q.choices || [] };
    // 인용은 지문에서만 오지 않는다 — <보기>·발문에서 온 것도 있다(l20279c Q31 이 그렇다).
    //   quoteResolved 가 보는 범위와 같게 맞춘다. 원천을 하나로 이어 붙이면 없던
    //   인접이 생기므로 각각 따로 두고 순서대로 찾는다.
    const SOURCES = [PASSAGE, String(q.bogi || ""), String(q.t || "")].filter((x) => x.trim());
    for (const c of q.choices || []) {
      const at = `${sid} Q${q.id}#${c.num}`;

      // ㉰ 선지 라벨 혼입
      const lines = String(c.t || "").split("\n");
      const keep = lines.filter((l) => !/^\s*\[[A-F]\]\s*$/.test(l));
      if (keep.length !== lines.length) {
        const next = keep.join("\n").replace(/\s+$/, "");
        if (!next.trim()) skipped.push(`${at} — 라벨을 빼면 선지가 빈다`);
        else plans.push({ kind: "라벨", at, set, q, c, field: "t", before: String(c.t), after: next,
          why: `단독 [X] 줄 ${lines.length - keep.length}개 제거` });
      }

      // ㉮㉯ 📌 인용
      const aLines = String(c.analysis || "").split("\n");
      aLines.forEach((line, li) => {
        if (!line.includes("📌")) return;
        let next = line;
        for (const quote of quotesOf(line)) {
          const how = quoteResolved(quote, ctx);
          if (how && how !== "ellipsis") continue;                      // 원문 그대로 — 정상
          let fixed = null, why = null;

          if (!how) {                                                    // 해소 안 됨
            for (const n of [1, 2]) if (quoteResolved(quote.slice(0, -n), ctx)) { fixed = quote.slice(0, -n); why = `끝 ${JSON.stringify(quote.slice(-n))} 제거 — 원문에 없는 종결 부호`; break; }
          }
          if (!fixed && RE_ELL.test(quote)) {
            const frags = quote.split(RE_ELL).map((x) => x.trim()).filter(Boolean);
            if (frags.length >= 2) {
              const last = frags[frags.length - 1];
              for (const SRC of SOURCES) {
                const i = SRC.indexOf(frags[0]);
                const j = i >= 0 ? SRC.indexOf(last, i) : -1;
                if (i < 0 || j < 0) continue;
                const whole = SRC.slice(i, j + last.length);
                const gap = whole.length - frags.join("").length;
                // 📌 는 한 줄이다. 원문의 조판 줄바꿈을 그대로 넣으면 해설 줄이 쪼개져
                //   extractQuotes 가 인용을 반토막으로 읽는다. 공백 한 칸으로 줄인다 —
                //   quoteResolved 는 공백을 정규화해 대조하므로 해소에는 영향이 없다.
                if (gap <= GAP) { fixed = whole.replace(/\s+/g, " "); why = `덜어낸 ${gap}자를 원문으로 메움 (한도 ${GAP})`; }
                else if (frags.every((f) => SRC.includes(f))) {
                  fixed = frags.map((f) => `"${f.replace(/\s+/g, " ")}"`).join(" / ").slice(1, -1);
                  why = `덜어낸 구간이 ${gap}자라 ${frags.length}개 인용으로 분리`;
                }
                if (fixed) break;
              }
            }
          }
          // 인용 끝에 말줄임을 달아 「여기서 끊었다」고 표시한 경우 — 조각이 하나뿐이다.
          //   덜어낸 가운데가 없으므로 말줄임만 떼면 원문 그대로가 된다.
          if (!fixed && RE_ELL.test(quote)) {
            const only = quote.split(RE_ELL).map((x) => x.trim()).filter(Boolean);
            if (only.length === 1) {
              const cand = only[0];
              // 원문에서 잘라낸 것을 쓴다. 인용과 글자가 같아도 공백이 다를 수 있는데,
              //   그때 인용 쪽을 그대로 두면 게이트가 다시 못 잡는다 — 원문이 정본이다.
              const carved = SOURCES.map((SRC) => carveLoose(SRC, cand, cand)).find(Boolean);
              if (quoteResolved(cand, ctx)) { fixed = cand; why = `인용 끝의 말줄임 제거 — 덜어낸 가운데가 없다`; }
              else if (carved) { fixed = carved; why = `인용 끝의 말줄임 제거 + 원문으로 잘라내기(공백 역매핑)`; }
            }
          }
          // 공백 join 으로 못 찾은 것을 공백 역매핑으로 한 번 더 시도한다
          if (!fixed && RE_ELL.test(quote)) {
            const fr2 = quote.split(RE_ELL).map((x) => x.trim()).filter(Boolean);
            if (fr2.length >= 2) for (const SRC of SOURCES) {
              const whole = carveLoose(SRC, fr2[0], fr2[fr2.length - 1]);
              if (!whole) continue;
              const gap = whole.replace(/\s+/g, "").length - fr2.join("").replace(/\s+/g, "").length;
              if (gap >= 0 && gap <= GAP) { fixed = whole; why = `덜어낸 ${gap}자를 원문으로 메움 (공백 역매핑 · 한도 ${GAP})`; break; }
            }
          }
          const isFail = why != null || /\s[~～∼]\s/.test(quote) || RE_ELL.test(quote) || how === "ellipsis";
          if (!fixed) {
            // 게이트가 WARN 으로 둔 것(조판 줄 분할 등)은 손대지 않기로 했다 — 세기만 한다.
            if (!isFail) { warnOnly++; continue; }
            skipped.push(`${at} — FAIL 인데 고칠 방법을 못 찾았다: ${JSON.stringify(quote.slice(0, 40))}`);
            continue;
          }
          if (next.split(`"${quote}"`).length - 1 !== 1) { skipped.push(`${at} — 대상 인용이 그 줄에 1곳이 아니다`); continue; }
          next = next.replace(`"${quote}"`, `"${fixed}"`);
          plans.push({ kind: "인용", at, set, q, c, field: "analysis", li, quote, fixedQuote: fixed, why, ctx });
        }
        if (next !== line) {
          const p = plans.filter((x) => x.kind === "인용" && x.at === at && x.li === li);
          p.forEach((x) => { x.lineBefore = line; x.lineAfter = next; });
        }
      });
    }
  }
}

console.log(`# 📌 인용 · 선지 라벨 수리 — ${YEAR} (D-199)`);
console.log("");
console.log(`- all_data MD5 \`${md5(before)}\` · 메우기 한도 ${GAP}자`);
console.log("");
console.log("## 계획");
console.log("");
for (const p of plans) {
  console.log(`**${p.at}** · ${p.kind} — ${p.why}`);
  console.log("```");
  console.log("전: " + JSON.stringify(p.kind === "라벨" ? p.before : p.quote));
  console.log("후: " + JSON.stringify(p.kind === "라벨" ? p.after : p.fixedQuote));
  console.log("```");
}
console.log("");
console.log(`- 게이트 WARN(조판 줄 분할 등) ${warnOnly}건은 대상이 아니다 — 인용을 비틀지 않는다`);
console.log("");
if (skipped.length) { console.log("## 🔴 FAIL 인데 못 고친 것 — 사람이 봐야 한다"); skipped.forEach((x) => console.log(`- ${x}`)); console.log(""); }
console.log(`계획 ${plans.length}건 (인용 ${plans.filter((p) => p.kind === "인용").length} · 라벨 ${plans.filter((p) => p.kind === "라벨").length}) · 보류 ${skipped.length}건`);
console.log("");
if (!plans.length) { console.log("고칠 것이 없다."); process.exit(0); }
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d199.json"), before);
const pre = JSON.parse(before.toString("utf8"));
for (const p of plans) {
  if (p.kind === "라벨") { p.c.t = p.after; continue; }
  const L = String(p.c.analysis).split("\n");
  L[p.li] = L[p.li].replace(`"${p.quote}"`, `"${p.fixedQuote}"`);
  p.c.analysis = L.join("\n");
}
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
const back = JSON.parse(after.toString("utf8"));
const bad = [];
let nl = 0; for (const x of after) if (x === 10) nl++;
if (nl) bad.push(`개행 ${nl} — minified 위반`);
const get = (yk, sid, qid, num) => {
  for (const sec of ["reading", "literature"]) {
    const s = (back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (s) return s.questions.find((x) => String(x.id) === String(qid)).choices.find((x) => x.num === num);
  }
  return null;
};
for (const p of plans) {
  const sid = p.set.setId || p.set.id;
  const c = get(YEAR, sid, p.q.id, p.c.num);
  if (p.kind === "라벨") { if (/^\s*\[[A-F]\]\s*$/m.test(String(c.t))) bad.push(`${p.at} 라벨 잔존`); continue; }
  if (String(c.analysis).includes(`"${p.quote}"`)) bad.push(`${p.at} 옛 인용 잔존`);
  if (!String(c.analysis).includes(`"${p.fixedQuote}"`)) bad.push(`${p.at} 새 인용 없음`);
  // 새 인용이 실제로 해소되는가
  for (const frag of p.fixedQuote.split(/"\s*\/\s*"/)) {
    const how = quoteResolved(frag, p.ctx);
    if (!how || how === "ellipsis") bad.push(`${p.at} 새 인용이 여전히 해소되지 않는다: ${JSON.stringify(frag.slice(0, 30))}`);
  }
}
// 📌 줄과 선지 t 외 무변
for (const [yk, v] of Object.entries(pre)) for (const sec of ["reading", "literature"]) for (const s of v[sec] || []) {
  const sid = s.setId || s.id;
  const cur = (back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
  if (JSON.stringify(s.sents) !== JSON.stringify(cur.sents)) bad.push(`${yk}::${sid} 본문이 달라졌다`);
  for (const oq of s.questions || []) for (const oc of oq.choices || []) {
    const cc = cur.questions.find((x) => String(x.id) === String(oq.id)).choices.find((x) => x.num === oc.num);
    const strip = (x) => JSON.stringify({ ...x, t: null, analysis: null });
    if (strip(oc) !== strip(cc)) bad.push(`${yk}::${sid} Q${oq.id}#${oc.num} 의 t·analysis 외 필드가 달라졌다`);
    // analysis 는 📌 줄만 바뀌어야 한다
    const A = String(oc.analysis || "").split("\n"), B = String(cc.analysis || "").split("\n");
    if (A.length !== B.length) { bad.push(`${yk}::${sid} Q${oq.id}#${oc.num} 해설 줄 수가 달라졌다`); continue; }
    for (let i = 0; i < A.length; i++) if (A[i] !== B[i] && !A[i].includes("📌")) bad.push(`${yk}::${sid} Q${oq.id}#${oc.num} 📌 아닌 줄이 달라졌다`);
  }
}
console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.before_d199.json`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.slice(0, 20).forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- 새 인용이 전건 원문으로 해소됨 · 옛 인용 잔존 0 · 라벨 잔존 0");
console.log("- 본문·🔍·결론줄·ok·pat·cs 전건 무변 (📌 줄과 선지 t 만 변경)");
