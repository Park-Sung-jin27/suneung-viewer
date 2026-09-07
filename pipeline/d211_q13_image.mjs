// d211_q13_image.mjs — r20279c Q13 〈보기〉 회로 블록도 연결 (발주 D-211 추가 ② ⑦)
//
// 지면(2027_9월 p5 좌단)의 <보기>는 텍스트 + 그림이다. 그림은 보기 텍스트 마지막 줄
// 「…이차 측이라고 한다.」(y314) 과 선지 ①(y437) 사이 y335.8~413.2 에 임베디드
// 이미지(2388×646, xref 13)로 들어 있고, 데이터에는 텍스트만 있었다.
//
// ★ 이 그림이 없으면 문항을 풀 수 없다 — 선지 ③④⑤ 가 가리키는 「일차 측/이차 측
//   평활 회로」·「비교 회로」의 위치가 그림에만 있다.
//
// ★ 2027_9월 8세트 전수에서 이미지·표 필드는 0건이었고(문항 키: id·t·bogi·
//   questionType·choices 뿐), 지면 공통과목 범위(p1~p11, 선택과목은 p12부터)의
//   그림은 표지 로고를 빼면 이것 하나다 — 누락 1건.
//
// ★ alt 에 블록 이름을 옮겨 적지 않는다(전사 금지 §13⑬). 「그림」 수준 서술만.
// ★ 형식은 정본 선례 `2023_6월::r20236a` Q2 의 {text, image:{url,alt}} 다.
//   image 를 {url,alt} 객체로 주는 근거는 src/QuizPanel.jsx:408 resolveBogiImage.
//
// 사용: node pipeline/d211_q13_image.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const YK = "2027_9월", SID = "r20279c", QID = 13;
const IMG = "2027_r20279c_q13_bogi.png";
const ALT = "어댑터 회로 블록도";

const raw = fs.readFileSync(DATA, "utf8");
const j = JSON.parse(raw);

console.log("# r20279c Q13 <보기> 회로 블록도 연결 (D-211 ②)");
console.log("");
console.log(`- \`data-source/all_data_204.json\` 적용 전 MD5 \`${md5(raw)}\``);
console.log("");

const fail = [];
const imgPath = path.join(ROOT, "public/images", IMG);
if (!fs.existsSync(imgPath)) fail.push(`이미지 ${IMG} 가 없다`);
else console.log(`- \`public/images/${IMG}\` ${Math.round(fs.statSync(imgPath).size / 1024)}KB ✅`);

const set = (j[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
const q = set && (set.questions || []).find((x) => x.id === QID);
if (!q) fail.push(`${YK}::${SID} Q${QID} 를 못 찾았다`);

let NEXT = null, TEXT = null;
if (q) {
  // ★ 지금 문자열인가 — 이미 객체면 누군가 손댄 것이고 덮어쓰면 안 된다
  if (typeof q.bogi !== "string") fail.push(`bogi 가 문자열이 아니다: ${JSON.stringify(q.bogi).slice(0, 60)}`);
  else if (!q.bogi.trim()) fail.push("bogi 가 비어 있다 — 텍스트가 있어야 {text,image} 병용이다");
  else {
    TEXT = q.bogi;
    // 보기 텍스트는 한 글자도 바꾸지 않는다. 그림만 얹는다.
    NEXT = { text: TEXT, image: { url: `/images/${IMG}`, alt: ALT } };
  }
  // alt 가 그림 내용을 옮겨 적지 않았는가 — 블록 이름이 들어가면 전사다
  for (const w of ["정류기", "평활", "스위치", "변압기", "비교 회로", "기준 전압"])
    if (ALT.includes(w)) fail.push(`alt 에 그림 내용 「${w}」 가 들어 있다 — 전사 금지`);
}

console.log("");
if (NEXT) {
  console.log("| 항목 | 값 |");
  console.log("|---|---|");
  console.log(`| 대상 | \`${YK}::${SID}\` Q${QID} \`bogi\` |`);
  console.log(`| 현재 | 문자열 ${TEXT.length}자 |`);
  console.log(`| 이후 | \`{text, image:{url, alt}}\` — 텍스트 무변 + 그림 1개 |`);
  console.log(`| alt | ${JSON.stringify(ALT)} |`);
  console.log("");
}

if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }

// ── 렌더 경로 — resolveBogiImage 를 소스에서 떼어 실행(복사 금지) ────────
const src = fs.readFileSync(path.join(ROOT, "src/QuizPanel.jsx"), "utf8");
const ri = src.indexOf("function resolveBogiImage");
const rj = src.indexOf("\n}", src.indexOf("return { url, alt }", ri)) + 2;
if (ri < 0 || rj < 2) { console.log("## 🔴 resolveBogiImage 를 소스에서 못 찾았다"); process.exit(1); }
const resolveBogiImage = new Function(src.slice(ri, rj) + "; return resolveBogiImage;")();
const r = resolveBogiImage(NEXT.image);
if (!r || r.url !== `/images/${IMG}` || r.alt !== ALT) {
  console.log(`## 🔴 렌더가 이 형태를 못 읽는다: ${JSON.stringify(r)}`); process.exit(1);
}
console.log(`✅ 렌더 확인 — resolveBogiImage 가 \`${r.url}\` · alt \`${r.alt}\` 로 읽는다`);
console.log("   (src/QuizPanel.jsx 에서 떼어 실행)");
console.log("");
console.log("✅ 사전 검사 통과 — 1건");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ─────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.json.before_d211img"), raw, "utf8");
q.bogi = NEXT;
fs.writeFileSync(DATA, JSON.stringify(j), "utf8");   // §13⑪ minified 유지

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const raw2 = fs.readFileSync(DATA, "utf8");
const j2 = JSON.parse(raw2);
const bad = [];
const q2 = (j2[YK].reading.find((x) => (x.setId || x.id) === SID).questions || []).find((x) => x.id === QID);
if (q2.bogi.text !== TEXT) bad.push("🔴 보기 텍스트가 바뀌었다");
if (q2.bogi.image?.url !== `/images/${IMG}`) bad.push("이미지 경로가 다르다");
if (q2.bogi.image?.alt !== ALT) bad.push("alt 가 다르다");
if (!resolveBogiImage(q2.bogi.image)) bad.push("되읽은 값을 렌더가 못 읽는다");
// ★ 역방향 바이트 일치 — bogi 를 문자열로 되돌리면 파일 전체가 원본과 같아야 한다
const j3 = JSON.parse(raw2);
j3[YK].reading.find((x) => (x.setId || x.id) === SID).questions.find((x) => x.id === QID).bogi = TEXT;
if (JSON.stringify(j3) !== JSON.stringify(JSON.parse(raw)))
  bad.push("🔴 역방향 바이트 일치 실패 — 이 bogi 외에 달라진 곳이 있다");

console.log(`- 적용 후 MD5 \`${md5(raw2)}\` (${raw2.length - raw.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.json.before_d211img`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- 보기 텍스트 무변 · 그림 1개 추가 · 역방향 바이트 일치");
console.log("- cs_ids 는 손대지 않았다 (근거 연결은 별도 커밋)");
