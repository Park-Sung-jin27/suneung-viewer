// marker_ref_audit.mjs — 원문자 마커 오치환·소실 클래스 전수 점검 (발주 D-119 ③)
//
// r20249b Q5 에서 본 사고: 본문에는 ㉮㉯㉰㉱ 가 멀쩡한데 문항 쪽에서 「가·나·다·라·카」로
// 오치환되고 일부는 아예 소실됐다. 「카」는 ㉮~㉱ 범위 밖 글자였다.
// 그 결과 본문 마커 4개가 고아로 남고 선지가 무엇을 가리키는지 알 수 없게 됐다.
//
// 세 방향으로 본다:
//   ① 고아      — 본문에 있는데 어떤 문항도 참조하지 않는 마커
//   ② 역고아    — 문항이 참조하는데 본문에 없는 마커
//   ③ 오치환 후보 — 발문이 「X~Y」 범위를 말하는데 그 자리에 마커가 없는 경우 등
//
// 판정은 사람이 한다. 원본 지면 대조 없이는 고아가 결함인지(오치환) 관례인지
// (예: 어휘 문항이 마커 대신 단어를 직접 인용) 가릴 수 없다 — r20249d ⓐ 가 그 예다.
//
// 사용: node pipeline/marker_ref_audit.mjs [--md]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (f) => path.join(ROOT, "public/data", f);
const data = JSON.parse(fs.readFileSync(P("all_data_204.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

// 원문자 계열 — 지문·문항에서 지시자로 쓰이는 것들
const MARK = /[ⓐ-ⓩ㉠-㉯㉰-㉾㈀-㈜]/g;
const flat = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));

const orphan = [], rev = [], suspect = [];
let sets = 0;
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const setId = s.setId || s.id;
      const live = REL.has(`${yk}::${setId}`);
      const inBody = new Set();
      for (const x of s.sents || [])
        for (const m of flat(x.t).match(MARK) || []) inBody.add(m);
      const inQ = new Set();
      const qText = [];
      for (const q of s.questions || []) {
        const parts = [flat(q.t), flat(q.bogi), ...(q.choices || []).flatMap((c) => [flat(c.t), flat(c.analysis)])];
        qText.push([q.id, parts.join(" ")]);
        const joined = parts.join(" ");
        for (const m of joined.match(MARK) || []) inQ.add(m);
        // 「ⓐ~ⓔ」 같은 범위 표기는 사이의 마커를 전부 가리킨다 (D-120 ⓪ — r2021a ⓑⓒⓓ 오탐)
        for (const r of joined.matchAll(/([①-⓿㈀-㋿])\s*[~～〜–—-]\s*([①-⓿㈀-㋿])/g)) {
          const [a0, b0] = [r[1].codePointAt(0), r[2].codePointAt(0)];
          if (b0 <= a0 || b0 - a0 > 12) continue;   // 같은 계열의 짧은 범위만
          for (let c = a0; c <= b0; c++) inQ.add(String.fromCodePoint(c));
        }
      }
      if (!inBody.size && !inQ.size) continue;
      sets++;

      const o = [...inBody].filter((m) => !inQ.has(m)).sort();
      const r = [...inQ].filter((m) => !inBody.has(m)).sort();
      if (o.length) orphan.push({ yk, setId, live, marks: o, bodyN: inBody.size, qN: inQ.size });
      if (r.length) rev.push({ yk, setId, live, marks: r });

      // ③ 발문이 「X～Y」 범위를 말하는데 그 자리에 마커가 없는 경우
      for (const [qid, txt] of qText) {
        const range = txt.match(/(.)\s*[~～]\s*(.)에 대해|(.)\s*[~～]\s*(.)\s*(?:중|의|를|을)/);
        if (!range) continue;
        const a = range[1] ?? range[3], b = range[2] ?? range[4];
        const isMark = (ch) => ch && MARK.test(ch) && ((MARK.lastIndex = 0), true);
        MARK.lastIndex = 0;
        if (!isMark(a) || !isMark(b))
          suspect.push({ yk, setId, live, qid, hint: range[0].slice(0, 24), bodyMarks: [...inBody].join("") });
      }
    }

const L = (a) => a.filter((x) => x.live).length;
const out = [];
out.push(`# 원문자 마커 참조 전수 점검 (D-119 ③)`);
out.push(``);
out.push(`> 생성: \`node pipeline/marker_ref_audit.mjs --md\``);
out.push(`> 본문 마커와 문항(발문·보기·선지·해설) 참조를 대조한다. **판정은 원본 지면 대조로만 한다.**`);
out.push(``);
out.push(`| 항목 | 세트 | LIVE |`);
out.push(`|---|--:|--:|`);
out.push(`| 마커를 쓰는 세트 | ${sets} | — |`);
out.push(`| ① 고아 — 본문에 있는데 문항이 안 가리킴 | ${orphan.length} | ${L(orphan)} |`);
out.push(`| ② 역고아 — 문항이 가리키는데 본문에 없음 | ${rev.length} | ${L(rev)} |`);
out.push(`| ③ 범위 표기에 마커가 없음 (오치환 후보) | ${suspect.length} | ${L(suspect)} |`);
out.push(``);
const tbl = (title, arr, cols, row) => {
  if (!arr.length) return;
  out.push(`## ${title}`);
  out.push(``);
  out.push(`| ${cols.join(" | ")} |`);
  out.push(`|${cols.map(() => "---").join("|")}|`);
  for (const x of arr) out.push(`| ${row(x).join(" | ")} |`);
  out.push(``);
};
tbl("① 고아 마커", orphan, ["회차", "세트", "노출", "고아", "본문 마커 수", "문항 마커 수"],
  (x) => [x.yk, `\`${x.setId}\``, x.live ? "🔴" : "—", x.marks.join(""), x.bodyN, x.qN]);
tbl("② 역고아 — 문항이 가리키는데 본문에 없다", rev, ["회차", "세트", "노출", "마커"],
  (x) => [x.yk, `\`${x.setId}\``, x.live ? "🔴" : "—", x.marks.join("")]);
tbl("③ 범위 표기에 마커가 없다 — 오치환 후보", suspect, ["회차", "세트", "노출", "문항", "표기", "본문 마커"],
  (x) => [x.yk, `\`${x.setId}\``, x.live ? "🔴" : "—", `Q${x.qid}`, `\`${x.hint}\``, x.bodyMarks || "없음"]);

if (process.argv.includes("--md")) console.log(out.join("\n"));
else console.log(out.slice(0, out.indexOf("## ① 고아 마커")).join("\n") + "\n(전체 표는 --md 로)");
