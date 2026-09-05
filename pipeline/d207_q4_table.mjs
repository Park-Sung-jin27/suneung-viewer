// d207_q4_table.mjs — r20239b Q4 「독서 활동지」 표 복원 (발주 D-207 ①, 가안)
//
// 발문이 활동지를 부르는데 bogi 가 "" 였다. 지면(2023_9월 p2 우단)에는 표가
// **텍스트 레이어에 실재**한다(이미지가 아니다). 괘선으로 구조를 확정했다:
//   세로 x 447.8│508.4│631.3│754.1 → 3열 [구분│(가)│(나)]
//   가로 y 589.9│610.6│632.3│671.3│744.8│783.7 → 머리행 + 4행
//
// ★ 병합 셀 — 4행 중 3행이 (가)·(나)를 가로지른다. parseMarkdownTable 의
//   splitRow 는 단순 split("|") 이라 colspan 을 표현할 수 없다. 심사관 판정으로
//   **(가안)** 채택: 3열 유지, 병합 행은 셀 2개로만 적는다. 정본 선례
//   `2024수능::r2024b` Q7 도 헤더 5칸 / 본문 4칸으로 어긋나 있다.
//   화면에서 병합 행의 (나) 열이 비어 테두리가 끊기는 것은 **판정된 예외**이며
//   gate3 지면 1:1 축에서 불일치로 계상하지 않는다. colspan 은 F 백로그.
//
// ★ 조립에서 뺀 지면 요소 — **점선 리더 `····`**. 마커 Ⓐ~Ⓔ 를 셀 오른쪽 끝으로
//   미는 조판 요소이지 문장 내용이 아니다(불릿 U+2219→U+2022 와 같은 기준).
//   심사관 직권 승인분. 마커 자체는 살려 선지 ①Ⓐ~⑤Ⓔ 와 대응시킨다.
//
// ★ 어절 경계 5건은 심사관 판정을 적용했다 — 줄머리가 조사·어미면 어절 중간
//   분리이므로 붙이고(화제와·정의하고·논지를), 양쪽이 완결 어절이면 띄운다
//   (의미를 설명함·의의를 밝히고). 행 머리 2건은 둘째 줄이 x463.7 가운데 정렬이라
//   조판 줄바꿈이 아니라 두 줄짜리 항목명임이 좌표로 확정된다.
//
// 사용: node pipeline/d207_q4_table.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const YK = "2023_9월", SEC = "reading", SID = "r20239b", QID = 4;
const BOGI = [
  "다음은 (가)와 (나)를 읽고 수행한 독서 활동지의 일부이다.",
  "",
  "구분 | (가) | (나)",
  "--- | --- | ---",
  "글의 화제 | 아도르노의 예술관 Ⓐ",
  "서술 방식의 공통점 | 구체적인 예를 제시하고 그것에 담긴 의미를 설명함. Ⓑ",
  "서술 방식의 차이점 | (가)는 (나)와 달리 화제와 관련된 개념을 정의하고 개념의 변화 과정을 제시함. Ⓒ | (나)는 (가)와 달리 논지를 강화하기 위해 다른 이의 견해를 인용함. Ⓓ",
  "서술된 내용 간의 관계 | (가)에서 소개한 이론에 대해 (나)에서 의의를 밝히고 한계를 지적함. Ⓔ",
].join("\n");

const FILE = "public/data/all_data_204.json";   // 정본만. free/pro 는 build_split 산출물

console.log("# r20239b Q4 독서 활동지 표 복원 (D-207 ①)");
console.log("");

const fail = [];

// ── 렌더 경로 — 정본 파서를 소스에서 떼어 그대로 돌린다 ──────────────────
//   복사하지 않는다(D-200 규율: 판정식은 프론트가 정본). 프론트가 고쳐지면
//   여기도 같이 따라간다.
const src = fs.readFileSync(path.join(ROOT, "src/QuizPanel.jsx"), "utf8");
const si = src.indexOf("function parseMarkdownTable");
const sj = src.indexOf("\n}", src.indexOf("return {", si)) + 2;
if (si < 0 || sj < 2) { console.log("## 🔴 parseMarkdownTable 을 소스에서 못 찾았다"); process.exit(1); }
const parseMarkdownTable = new Function(src.slice(si, sj) + "; return parseMarkdownTable;")();

const tbl = parseMarkdownTable(BOGI);
if (!tbl) fail.push("파싱 실패 — pre-wrap 폴백으로 떨어진다");
else {
  if (tbl.header.length !== 3) fail.push(`헤더가 ${tbl.header.length}칸 — 3칸이어야 한다`);
  if (tbl.rows.length !== 4) fail.push(`본문이 ${tbl.rows.length}행 — 4행이어야 한다`);
  // Ⓐ~Ⓔ 다섯 마커가 전부 셀 안에 들어갔는가 — 선지 ①Ⓐ~⑤Ⓔ 가 가리킬 대상이다
  const flat = tbl.rows.flat().join("");
  for (const m of ["Ⓐ", "Ⓑ", "Ⓒ", "Ⓓ", "Ⓔ"]) if (!flat.includes(m)) fail.push(`마커 ${m} 가 표에 없다`);
}

console.log("## 렌더 결과 — `src/QuizPanel.jsx` 의 parseMarkdownTable 실행");
console.log("");
if (tbl) {
  console.log("```");
  console.log(`before: ${JSON.stringify(tbl.before || "")}`);
  console.log(`header (${tbl.header.length}칸): ${JSON.stringify(tbl.header)}`);
  tbl.rows.forEach((r, k) => console.log(`row${k + 1} (${r.length}칸): ${JSON.stringify(r)}`));
  console.log(`after: ${JSON.stringify(tbl.after || "")}`);
  console.log("```");
}
console.log("");

// ── 사전 대조 ────────────────────────────────────────────────────────────
const abs = path.join(ROOT, FILE);
const raw = fs.readFileSync(abs, "utf8");
const j = JSON.parse(raw);
const set = (j[YK]?.[SEC] || []).find((x) => (x.setId || x.id) === SID);
if (!set) fail.push(`${SID} 없음`);
const q = set && (set.questions || []).find((x) => x.id === QID);
if (!q) fail.push(`Q${QID} 없음`);
else if (!(q.bogi === "" || q.bogi == null)) fail.push(`bogi 가 비어 있지 않다: ${JSON.stringify(q.bogi).slice(0, 60)}`);

// 선지 ①Ⓐ~⑤Ⓔ 가 표의 마커를 부르는가 — 부르지 않으면 대상 문항이 틀린 것이다
if (q) for (const m of ["Ⓐ", "Ⓑ", "Ⓒ", "Ⓓ", "Ⓔ"])
  if (!(q.choices || []).some((c) => String(c.t).includes(m))) fail.push(`선지가 ${m} 를 부르지 않는다`);

console.log(`- \`${FILE}\` 적용 전 MD5 \`${md5(raw)}\``);
console.log("");
if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## 렌더 경로 — 보기 표시 전후");
console.log("");
console.log(`- \`${YK}::${SID}\` Q${QID} 보기 블록: **0 → 1** (빈 문자열은 falsy 라 블록 자체가 안 나왔다)`);
console.log(`- 표 ${tbl.rows.length}행 · 마커 Ⓐ~Ⓔ 5건 전건 셀 안 · 선지 5개가 전부 그 마커를 부른다`);
console.log("");
console.log("✅ 사전 검사 통과");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ─────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, "pipeline/backups", path.basename(FILE) + ".before_d207c"), raw, "utf8");
q.bogi = BOGI;
fs.writeFileSync(abs, JSON.stringify(j), "utf8");   // §13⑪ minified 유지

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const bad = [];
const raw2 = fs.readFileSync(abs, "utf8");
const j2 = JSON.parse(raw2);
const q2 = j2[YK][SEC].find((x) => (x.setId || x.id) === SID).questions.find((x) => x.id === QID);
if (q2.bogi !== BOGI) bad.push("bogi 가 다르다");
if (!parseMarkdownTable(q2.bogi)) bad.push("되읽은 bogi 가 파싱되지 않는다");
// ★ 역방향 바이트 일치 — 그 bogi 만 "" 로 되돌리면 파일 전체가 원본과 같아야 한다
const j3 = JSON.parse(raw2);
j3[YK][SEC].find((x) => (x.setId || x.id) === SID).questions.find((x) => x.id === QID).bogi = "";
if (JSON.stringify(j3) !== JSON.stringify(JSON.parse(raw))) bad.push("🔴 대상 bogi 외에 달라진 곳이 있다");

console.log(`- 적용 후 MD5 \`${md5(raw2)}\` (${raw2.length - raw.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.json.before_d207c`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- 대상 1건 외 전 구조 무변(역방향 바이트 일치) · 되읽은 bogi 도 정본 파서를 통과");
console.log("- annotations 는 열지도 쓰지도 않았다 (표 분기는 annotation 미적용 — 알려진 사실)");
