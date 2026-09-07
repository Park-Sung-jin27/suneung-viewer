// d210_header_strip.mjs — r20279a Q3 선지 ⑤ 머리글 혼입 제거 (발주 D-210)
//
// 쪽 상단 표지 머리글이 선지 텍스트 끝에 흡수됐다. 지면(2027_9월 p1 우단)에서
// 선지 ⑤ 는 y1055.5 「인물이 진로와 관련하여 겪었던 사건들을 정리하였다.」로
// 끝나고, 그 아래는 쪽번호 20 과 저작권 문구다.
//
// ★ 원인(수리 범위 밖, 별건 백로그) — step2_extract.js:699~710 의 페이지 푸터/헤더
//   제거 필터가 ① passageText 경로에만 있고 선지 경로에는 없으며 ② 패턴 목록에
//   「N학년도 … 문제지 N」·「제 N 교시」가 없다. 신규 회차 파싱 전에 선처리해야 한다.
//
// ★ 전수 스크리닝 결과 코퍼스 전체에서 이 1건뿐이다(문자열 101,684개·417만 자 탐색).
//   넓힌 패턴의 오탐 후보는 전건 정상이었다 — 저작권 34건은 지문 내용,
//   숫자 단독 18건은 표 셀과 시의 연 번호(sentType=workTag).
//
// 사용: node pipeline/d210_header_strip.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const YK = "2027_9월", SID = "r20279a", QID = 3, CNUM = 5;
const CUT = 59;                       // 상신·승인된 절단 인덱스
const TAIL = "\n2027학년도 대학수학능력시험 9월 모의평가 문제지 1\n제 1 교시";
const KEEP = "인물의 삶을 파악하는 과정에서, 도해 조직자를 활용하여\n인물이 진로와 관련하여 겪었던 사건들을 정리하였다.";

const raw = fs.readFileSync(DATA, "utf8");
const j = JSON.parse(raw);

console.log("# 시험지 머리글 혼입 제거 (D-210)");
console.log("");
console.log(`- \`data-source/all_data_204.json\` 적용 전 MD5 \`${md5(raw)}\``);
console.log("");

const fail = [];
const set = (j[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
const q = set && (set.questions || []).find((x) => x.id === QID);
const c = q && (q.choices || []).find((x) => x.num === CNUM);
if (!c) fail.push(`${YK}::${SID} Q${QID} 선지 ${CNUM} 을 못 찾았다`);

if (c) {
  // ★ 상신 때 읽은 값과 지금 값이 같은가 — 다르면 그 사이에 데이터가 바뀐 것이다
  if (c.t.length !== 97) fail.push(`길이가 ${c.t.length} — 상신 때는 97 이었다`);
  if (c.t.indexOf(TAIL) !== CUT) fail.push(`꼬리가 index ${c.t.indexOf(TAIL)} — 승인된 절단 인덱스는 ${CUT} 이다`);
  if (c.t.slice(0, CUT) !== KEEP) fail.push("보존부가 상신안과 다르다");
  if (c.t !== KEEP + TAIL) fail.push("원문이 보존부+꼬리로 정확히 나뉘지 않는다");
  // ★ 다른 필드 불가침 — 꼬리 문자열이 다른 곳에도 있으면 이 도구로 지우면 안 된다
  const others = JSON.stringify({ ...c, t: "" });
  if (/문제지|교시|모의평가/.test(others)) fail.push("같은 선지의 다른 필드에도 머리글 흔적이 있다 — 범위 밖이다");
}

console.log("| 항목 | 값 |");
console.log("|---|---|");
if (c) {
  console.log(`| 대상 | \`${YK}::${SID}\` Q${QID} \`choices[${CNUM - 1}].t\` |`);
  console.log(`| 현재 길이 | ${c.t.length}자 |`);
  console.log(`| 절단 인덱스 | ${CUT} |`);
  console.log(`| 제거 | ${JSON.stringify(TAIL)} (${TAIL.length}자) |`);
  console.log(`| 보존 | ${JSON.stringify(KEEP)} (${KEEP.length}자) |`);
}
console.log("");

if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("✅ 사전 검사 통과 — 1건");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ─────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.json.before_d210"), raw, "utf8");
c.t = KEEP;
fs.writeFileSync(DATA, JSON.stringify(j), "utf8");   // §13⑪ minified 유지

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const raw2 = fs.readFileSync(DATA, "utf8");
const j2 = JSON.parse(raw2);
const bad = [];
const c2 = (j2[YK].reading.find((x) => (x.setId || x.id) === SID).questions || [])
  .find((x) => x.id === QID).choices.find((x) => x.num === CNUM);
if (c2.t !== KEEP) bad.push("보존부가 다르다");
if (/문제지|교시|모의평가|학년도/.test(c2.t)) bad.push("머리글이 남아 있다");
// ★ 보존부가 수리 전 원문의 0~58 과 바이트 동일한가 (심사관 지정)
if (Buffer.from(c2.t, "utf8").compare(Buffer.from(JSON.parse(raw)[YK].reading
  .find((x) => (x.setId || x.id) === SID).questions.find((x) => x.id === QID)
  .choices.find((x) => x.num === CNUM).t.slice(0, CUT), "utf8")) !== 0)
  bad.push("🔴 보존부가 원문 0~58 과 바이트 다르다");
// ★ 역방향 — 꼬리를 되붙이면 파일 전체가 원본과 바이트 일치해야 한다
const j3 = JSON.parse(raw2);
j3[YK].reading.find((x) => (x.setId || x.id) === SID).questions.find((x) => x.id === QID)
  .choices.find((x) => x.num === CNUM).t = KEEP + TAIL;
if (JSON.stringify(j3) !== JSON.stringify(JSON.parse(raw)))
  bad.push("🔴 역방향 바이트 일치 실패 — 이 한 필드 외에 달라진 곳이 있다");

console.log(`- 적용 후 MD5 \`${md5(raw2)}\` (${raw2.length - raw.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.json.before_d210`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- 보존부가 원문 0~58 과 바이트 동일 · 역방향 바이트 일치 · 다른 필드 무변");
console.log("- annotations 는 열지도 쓰지도 않았다");
