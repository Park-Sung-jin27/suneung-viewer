// delegation_package.mjs — 외부 모델(코덱스) 위임 패키지 생성 (발주 D-87 ①)
//
// 무엇을 만드나
//   docs/delegation/<회차>/
//     source_layout.txt   원본 텍스트 (pdftotext -layout) — 필요한 구간만
//     source_raw.txt      원본 텍스트 (pdftotext -raw)    — 2단 조판 대비
//     INSTRUCTIONS.md     추출 지시문 (세트 경계 규칙 · 뽑을 번호 · 채우지 말 것)
//     SCHEMA.md           JSON 스키마 + 정상 세트 실물 예시 1개
//
// 🔴 원본 텍스트는 **미추출 구간만** 잘라 넣는다.
//    시험지 전체를 주면 (a) 파일이 회차당 240KB 로 불어나고
//    (b) 코덱스가 스코프 밖(화작·문법·선택과목)까지 뽑아 온다 — 발주 ⓪ 가 막으려던 바로 그것.
//
// 작업 범위는 missing_scope_audit 이 확정한 「세트 통째 미추출」 구간만 쓴다.
//
// 사용: node pipeline/delegation_package.mjs
// 금지: all_data 병합. RELEASE_KEYS 변경.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanSetRanges, pdfText } from "./set_ranges.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs/delegation");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data-source/all_data_204.json"), "utf8"));
const RELEASE = (() => {
  const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
  const at = src.indexOf("const RELEASE_KEYS = new Set([");
  return new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
    .map((m) => m[1]).filter((k) => k.includes("::")));
})();

// ── 정상 세트 실물 예시 — 짝 검사 통과본에서 가져온다 ──
const EXAMPLE = (() => {
  const p = path.join(ROOT, "pipeline/reextract/2016_6월B_literature.prev-D86.json");
  const r = JSON.parse(fs.readFileSync(p, "utf8"));
  const s = (r.literature || []).find((x) => x.id === "l20166b");   // 짝 검사 통과 세트
  // 문항은 1개만 남겨 예시를 짧게 — 구조는 그대로 보인다
  return { ...s, sents: (s.sents || []).slice(0, 6), questions: (s.questions || []).slice(0, 1) };
})();

const targets = [];
for (const yk of Object.keys(data)) {
  const dir = path.join(ROOT, "_done", yk);
  if (!fs.existsSync(dir)) continue;
  const pdfName = fs.readdirSync(dir).find((f) => f.endsWith(".pdf") && f.includes("시험지"));
  if (!pdfName) continue;

  const have = new Set();
  let live = 0, all = 0;
  for (const sec of ["reading", "literature"])
    for (const s of data[yk][sec] || []) {
      all++; if (RELEASE.has(`${yk}::${s.id}`)) live++;
      for (const q of s.questions || []) have.add(Number(q.id));
    }

  const isNew = Number(yk.slice(0, 4)) >= 2022;
  const inScope = (r) => (isNew ? r.to <= 34 : r.from >= 16);
  const ranges = scanSetRanges(path.join(dir, pdfName), { min: 1, max: 45 })
    .filter((r) => r.kind === "set" && inScope(r))
    .filter((r) => { for (let n = r.from; n <= r.to; n++) if (have.has(n)) return false; return true; });
  if (!ranges.length) continue;

  targets.push({ yk, pdfPath: path.join(dir, pdfName), ranges, live, all,
    nq: ranges.reduce((a, r) => a + (r.to - r.from + 1), 0) });
}
// 노출 회차 우선, 그 다음 문항 수 많은 순
targets.sort((a, b) => (b.live > 0) - (a.live > 0) || b.nq - a.nq);

// 구간만 잘라내기 — 지시문 시작부터 다음 지시문 직전까지
function sliceRanges(txt, ranges) {
  const marks = [...txt.matchAll(/\[\s*(\d{1,2})\s*[~～∼]\s*(\d{1,2})\s*\]/g)]
    .map((m) => ({ from: +m[1], to: +m[2], at: m.index })).sort((a, b) => a.at - b.at);
  const out = [];
  for (const r of ranges) {
    const start = marks.find((m) => m.from === r.from && m.to === r.to);
    if (!start) { out.push(`### [${r.from}~${r.to}] — 원본에서 지시문을 못 찾음\n`); continue; }
    const next = marks.find((m) => m.at > start.at && !(m.from === r.from && m.to === r.to));
    out.push(`### [${r.from}~${r.to}]\n` + txt.slice(start.at, next ? next.at : txt.length).trim() + "\n");
  }
  return out.join("\n\n");
}

fs.mkdirSync(OUT, { recursive: true });
const made = [];
for (const t of targets) {
  const dir = path.join(OUT, t.yk);
  fs.mkdirSync(dir, { recursive: true });
  const lay = pdfText(t.pdfPath, true), raw = pdfText(t.pdfPath, false);
  const layCut = sliceRanges(lay, t.ranges), rawCut = sliceRanges(raw, t.ranges);
  fs.writeFileSync(path.join(dir, "source_layout.txt"), layCut, "utf8");
  fs.writeFileSync(path.join(dir, "source_raw.txt"), rawCut, "utf8");

  const nums = t.ranges.flatMap((r) => { const a = []; for (let n = r.from; n <= r.to; n++) a.push(n); return a; });
  const sec = "literature";   // 저장 파일명 규칙용 기본값. 실제 분류는 아래 지시문에서 시킨다.

  const ins = [];
  ins.push(`# ${t.yk} — 전사 작업 지시문`, "");
  ins.push(`수능 국어 시험지에서 **아직 데이터에 없는 지문 세트**만 JSON 으로 전사한다.`, "");
  ins.push(`## 뽑을 것 — 이것만, 하나도 빠짐없이`, "");
  ins.push(`| 세트 구간 | 문항 번호 |`, `|---|---|`);
  for (const r of t.ranges) {
    const a = []; for (let n = r.from; n <= r.to; n++) a.push(n);
    ins.push(`| [${r.from}~${r.to}] | ${a.join(", ")} |`);
  }
  ins.push("", `**총 ${t.ranges.length}세트 · ${nums.length}문항** — ${nums.join(", ")}`, "");
  ins.push(`## 반드시 지킬 규칙`, "");
  ins.push(`1. **세트를 가르지 마라.** 세트의 경계는 \`[NN~NN] 다음 글을 읽고 물음에 답하시오.\` 지시문이다.`);
  ins.push(`   한 세트의 지문(sents)과 문항(questions)은 **반드시 같은 지시문 아래 것**끼리 묶는다.`);
  ins.push(`   다른 번호대의 지문을 끌어오면 안 된다. (과거 이 실수로 [31~33] 문항에 [41~43] 지문이 붙은 적이 있다.)`);
  ins.push(`2. 위 표에 없는 문항은 뽑지 않는다. 화법과작문·언어와매체(문법)·선택과목은 **대상이 아니다.**`);
  ins.push(`3. **\`ok\` · \`pat\` · \`analysis\` · \`cs_ids\` 는 절대 채우지 마라.** 그 값들은 다음 단계(step3)가 만든다.`);
  ins.push(`   지금은 **구조와 원문 전사만** 한다. 정답을 추측하지 마라.`);
  ins.push(`4. 원문 그대로 보존: ㉠㉡㉢ · ⓐⓑⓒ · [A][B] · <보기> · 각주 기호 \`*\` 를 바꾸지 마라.`);
  ins.push(`5. 지문에 없는 문장을 지어내지 마라. 원본에 있는 것만 옮긴다.`);
  ins.push("");
  ins.push(`## 원본`, "");
  ins.push(`- \`source_layout.txt\` — 2단 조판이 보이는 판본. 표·시 행갈이는 이쪽이 정확하다.`);
  ins.push(`- \`source_raw.txt\` — 읽기 순서 판본. 문장이 이어져 있어 산문은 이쪽이 정확하다.`);
  ins.push(`- **둘을 대조해서** 옮긴다. 한쪽만 보면 2단 조판에서 문장이 끊기거나 좌우가 섞인다.`);
  ins.push("");
  ins.push(`## 저장`, "");
  ins.push(`- 파일: \`pipeline/reextract/${t.yk}_${sec}.json\``);
  ins.push(`- 인코딩: **UTF-8** (BOM 없이)`);
  ins.push(`- 최상위 형태: \`{ "reading": [ ... ], "literature": [ ... ] }\``);
  ins.push(`  - 독서(비문학) 세트는 \`reading\`, 문학(시·소설·수필·희곡) 세트는 \`literature\` 에 넣는다.`);
  ins.push(`  - 세트 id: 독서 \`r${t.yk.replace(/[^0-9]/g, "")}a\`, 문학 \`l${t.yk.replace(/[^0-9]/g, "")}a\` … 알파벳 순.`);
  ins.push("");
  ins.push(`스키마와 실물 예시는 \`SCHEMA.md\` 를 그대로 따른다.`);
  fs.writeFileSync(path.join(dir, "INSTRUCTIONS.md"), ins.join("\n"), "utf8");

  const sch = [];
  sch.push(`# JSON 스키마 + 실물 예시`, "");
  sch.push(`아래 예시는 **실제로 검수를 통과한 세트**다. 형태를 그대로 따라라.`);
  sch.push(`스키마 설명보다 이 예시가 우선이다 — 미세한 형태 차이가 가장 흔한 실패 원인이다.`, "");
  sch.push("```json");
  sch.push(JSON.stringify({ reading: [], literature: [EXAMPLE] }, null, 2));
  sch.push("```", "");
  sch.push(`## 필드 설명`, "");
  sch.push("| 필드 | 뜻 |", "|---|---|");
  sch.push("| `id` | 세트 id. 문학 `l`+연도+알파벳, 독서 `r`+연도+알파벳 |");
  sch.push("| `title` | 지문 제목(작품명·주제). 원본에 없으면 내용으로 짧게 |");
  sch.push("| `range` | `\"34~36번\"` 형태 |");
  sch.push("| `sents[]` | 지문을 문장 단위로. `id`는 `<세트id>s<번호>` |");
  sch.push("| `sents[].sentType` | `body`(산문) · `verse`(운문 행) · `workTag`((가)(나)) · `author`(- 작자 -) · `footnote`(각주 `*`) |");
  sch.push("| `questions[].id` | 문항 번호(숫자) |");
  sch.push("| `questions[].t` | 발문 |");
  sch.push("| `questions[].bogi` | `<보기>` 가 있으면 그 내용, 없으면 생략 |");
  sch.push("| `questions[].choices[].num` | 1~5 |");
  sch.push("| `questions[].choices[].t` | 선지 원문 |");
  sch.push("");
  sch.push(`🔴 \`ok\` · \`pat\` · \`analysis\` · \`cs_ids\` 는 **넣지 않는다.** 예시에도 없다.`);
  fs.writeFileSync(path.join(dir, "SCHEMA.md"), sch.join("\n"), "utf8");

  made.push({ ...t, layBytes: Buffer.byteLength(layCut), rawBytes: Buffer.byteLength(rawCut) });
}

console.log(`## 위임 패키지 — ${made.length}회차`);
console.log(`  총 ${made.reduce((a, m) => a + m.ranges.length, 0)}세트 · ${made.reduce((a, m) => a + m.nq, 0)}문항\n`);
console.log("| 회차 | 노출 | 세트 | 문항 | layout | raw |");
console.log("|---|---|--:|--:|--:|--:|");
for (const m of made)
  console.log(`| ${m.yk} | ${m.live > 0 ? `LIVE ${m.live}/${m.all}` : "비노출"} | ${m.ranges.length} | ${m.nq} | ${(m.layBytes / 1024).toFixed(0)}KB | ${(m.rawBytes / 1024).toFixed(0)}KB |`);
console.log(`\n위치: ${path.relative(ROOT, OUT)}`);
