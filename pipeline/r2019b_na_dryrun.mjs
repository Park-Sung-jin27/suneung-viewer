// r2019b_na_dryrun.mjs — 2019수능::r2019b (나) 「오발탄」 재추출 dry-run (발주 D-146 ②)
//
// 아무것도 쓰지 않는다. 산출물을 화면에 찍기만 한다.
//   · pdf_text_extractor 로 2019수능 시험지에서 21~26번 구간을 뽑는다
//   · (가)/(나) 경계를 찾아 (나)만 잘라낸다
//   · 분할안 두 가지를 나란히 보여 준다 — S-11 산문 규약 · §13⑧ 극문학 규약
//   · 기존 s1~s13 은 읽기만 한다. 새 문장은 s14~ 로만 번호를 매긴다
//   · ㉠㉡㉢ 마커가 원본에서 어디에 붙는지 D-145 상신과 대조한다
//
// 사용: node pipeline/r2019b_na_dryrun.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPdfText } from "./pdf_text_extractor.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PDF = path.join(ROOT, "_done/2019수능/2019수능_시험지.pdf");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const NL = String.fromCharCode(10);

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const set = data["2019수능"].literature.find((x) => (x.setId || x.id) === "r2019b");
const sents = set.sents || [];

console.log("# r2019b (나) 재추출 dry-run");
console.log("");
console.log("> **아무것도 쓰지 않았다.** 심사관 판정 후에 적용한다.");
console.log("");
console.log(`- 기존 세트: 문장 ${sents.length} (s1~s${sents.length}) · 문항 ${(set.questions || []).map((q) => q.id).join(",")}`);

const { fullText, numpages, sanity } = await extractPdfText(PDF);
console.log(`- PDF: ${numpages}면 · 추출 ${fullText.length}자 · sanity ${sanity.permille}‰ (임계 ${sanity.threshold}‰) ${sanity.ok ? "통과" : "🔴 실패"}`);

// ── 21~26 구간 잘라내기 ────────────────────────────────────
const mStart = fullText.match(/\[\s*21\s*[~～]\s*26\s*\]/);
if (!mStart) { console.log(NL + "🔴 21~26 구간 앵커를 못 찾았다. 멈춘다."); process.exit(1); }
const i0 = mStart.index;
const mEnd = fullText.slice(i0).match(/\[\s*27\s*[~～]/);
const seg = fullText.slice(i0, i0 + (mEnd ? mEnd.index : 12000));

// (나) 시작 = 줄 하나가 통째로 "(나)" 인 곳 / 끝 = 출처 표기 줄
const lines = seg.split(NL);
const naStart = lines.findIndex((l) => l.trim() === "(나)");
const naEnd = lines.findIndex((l, i) => i > naStart && /^\s*-\s*이범선/.test(l));
if (naStart < 0 || naEnd < 0) { console.log(NL + "🔴 (나) 경계를 못 찾았다. 멈춘다."); process.exit(1); }

// 각주 2줄(◯E · O･L 설명)까지 포함한다 — 본문 각주는 sentType:footnote 로 들어간다
let footEnd = naEnd + 1;
while (footEnd < lines.length && /^\s*\*/.test(lines[footEnd])) footEnd++;

const naLines = lines.slice(naStart, naEnd + 1).map((l) => l.trim()).filter(Boolean);
const footLines = lines.slice(naEnd + 1, footEnd).map((l) => l.trim()).filter(Boolean);
const naRaw = naLines.join(NL);

console.log(`- 21~26 구간 ${seg.length}자 · **(나) 본문 ${naRaw.length}자 / ${naLines.length}줄** · 각주 ${footLines.length}줄`);
console.log("");

// ── ㉠㉡㉢ 위치 대조 (발주 ②) ──────────────────────────────
console.log("## ㉠㉡㉢ 원본 위치 — D-145 상신과 대조");
console.log("");
const gaRaw = lines.slice(0, naStart).join(NL);
const EXPECT = { "㉠": "r2019bs7", "㉡": "r2019bs9", "㉢": "r2019bs13" };
console.log("| 마커 | 원본 문맥 | 붙을 문장 | D-145 상신 | 일치 |");
console.log("|---|---|---|---|---|");
let markerOk = true;
for (const mk of ["㉠", "㉡", "㉢"]) {
  const at = gaRaw.indexOf(mk);
  if (at < 0) { console.log(`| ${mk} | **원본에 없음** | — | ${EXPECT[mk]} | 🔴 |`); markerOk = false; continue; }
  const after = gaRaw.slice(at + 1).replace(/\s+/g, " ").trim().slice(0, 22);
  // 그 문구를 담고 있는 기존 문장 찾기 — 공백을 지운 형태로 비교한다(줄바꿈 artifact 회피)
  const needle = after.replace(/\s/g, "").slice(0, 14);
  const hit = sents.find((x) => String(x.t || "").replace(/\s/g, "").includes(needle));
  const got = hit ? hit.id : "못 찾음";
  const ok = got === EXPECT[mk];
  if (!ok) markerOk = false;
  console.log(`| ${mk} | \`${after}…\` | ${got} | ${EXPECT[mk]} | ${ok ? "✅" : "🔴"} |`);
}
console.log("");
if (!markerOk) {
  console.log("🔴 **상신 위치와 재추출 결과가 다르다. 발주 ② 대로 여기서 멈춘다 — 맞추지 않는다.**");
  process.exit(1);
}
console.log("✅ 3개 전부 D-145 상신 위치와 일치한다. 마커는 원본대로 살아난다.");
console.log("");

// ── 분할안 A: S-11 산문 규약 ───────────────────────────────
const { resplitProse } = await import("./step2_postprocess.mjs");
const proseIn = naLines.filter((l) => l !== "(나)").map((t, i) => ({ id: `tmps${i + 1}`, t, sentType: "body" }));
const proseOut = resplitProse(proseIn);

// ── 분할안 B: §13⑧ 극문학 규약 (stage / speech) ────────────
//   PDF 줄바꿈은 조판 산물이라 그대로 쓰면 문장이 중간에서 끊긴다.
//   새 문장이 시작되는 자리는 셋뿐이다 — 장면 번호 · 화자 표지 · (중략)
//   그 밖의 줄은 앞줄에 이어 붙인다.
const SCENE = /^#\d{1,3}\./;
//   화자 표지는 `철호 :` · `철호◯\tE :` 처럼 효과음 원문자가 끼어들 수 있다
const SPEAKER = /^[가-힣]{1,6}\s*(◯\s*E)?\s*[*]?\s*:/;
const dramaOut = [];
const pushLine = (t, type) => dramaOut.push({ t, sentType: type });
let cur = null;
const flush = () => { if (cur) { pushLine(cur.parts.join(" ").replace(/\s+/g, " ").trim(), cur.type); cur = null; } };
for (const t of naLines) {
  if (t === "(나)") { flush(); pushLine(t, "workTag"); continue; }
  if (/^-\s*이범선/.test(t)) { flush(); pushLine(t, "author"); continue; }
  if (SCENE.test(t)) { flush(); cur = { type: "stage", parts: [t] }; flush(); continue; }
  if (t === "(중략)") { flush(); pushLine(t, "stage"); continue; }
  if (SPEAKER.test(t)) { flush(); cur = { type: "speech", parts: [t] }; continue; }
  if (!cur) cur = { type: "stage", parts: [] };
  cur.parts.push(t);
}
flush();
for (const t of footLines) pushLine(t, "footnote");

const show = (title, arr, note) => {
  console.log(`## 분할안 ${title} — ${arr.length}문장`);
  console.log("");
  console.log(note);
  console.log("");
  arr.forEach((x, i) => {
    const id = `r2019bs${sents.length + i + 1}`;
    console.log(`  ${id} [${x.sentType || "body"}] ${JSON.stringify(String(x.t).slice(0, 72))}`);
  });
  console.log("");
};
show("A — S-11 산문 규약(발주 지정)", proseOut,
  "발주가 지정한 방식이다. `resplitProse` 를 (나) 줄들에만 돌렸다.");
show("B — §13⑧ 극문학 규약(권고)", dramaOut,
  "장면 번호=`stage`, 화자 대사=`speech`, 각주=`footnote`. 기존 극문학 세트(l20216d 전우치 시나리오)와 같은 틀이다.");

// ── 손실 검산 — 분할이 글자를 흘리지 않았는가 ───────────────
const norm = (s) => String(s).replace(/\s+/g, "");
const srcAll = norm(naRaw + footLines.join(""));
const chk = (arr) => {
  const got = norm(arr.map((x) => x.t).join(""));
  return { len: got.length, ok: got === srcAll };
};
const ca = chk(proseOut), cb = chk(dramaOut);
console.log("## 손실 검산 — 원본 글자가 그대로 들어갔는가");
console.log("");
console.log(`- 원본 (나)+각주 공백 제외 **${srcAll.length}자**`);
console.log(`- A 산문 분할 결과 ${ca.len}자 ${ca.ok ? "✅ 일치" : `🔴 **${srcAll.length - ca.len}자 차이**`}`);
console.log(`- B 극문학 분할 결과 ${cb.len}자 ${cb.ok ? "✅ 일치" : `🔴 **${srcAll.length - cb.len}자 차이**`}`);
console.log("");
console.log("## 두 안의 차이");
console.log("");
console.log("| | A (S-11 산문) | B (§13⑧ 극문학) |");
console.log("|---|--:|--:|");
console.log(`| 문장 수 | ${proseOut.length} | ${dramaOut.length} |`);
console.log(`| \`sentType\` 종류 | body 단일 | ${[...new Set(dramaOut.map((x) => x.sentType))].join(" · ")} |`);
console.log(`| 장면 번호 \`#68\`~\`#75\` 독립 문장 | ${proseOut.filter((x) => SCENE.test(x.t)).length}개 | ${dramaOut.filter((x) => x.sentType === "stage" && SCENE.test(x.t)).length}개 |`);
console.log(`| 각주 2줄 | 미포함 | 포함 |`);
console.log("");
console.log("> ⚠ **S-11 은 독서 전용 규약이다**(D-138: `if (sec === \"reading\")`). (나)는 시나리오라");
console.log("> §13⑧ 극문학 표준(stage/speech)이 맞는 틀로 보인다. **판정 사항이라 고르지 않고 둘 다 낸다.**");
console.log("");
// ── ◯E 추출 artifact 표시 (발주 D-147 ② · §13⑬) ──────────
const EFF = /◯\s*E/g;
const effHits = [];
dramaOut.forEach((x, i) => {
  const t = String(x.t);
  if (EFF.test(t)) effHits.push({ id: `r2019bs${sents.length + i + 1}`, t });
  EFF.lastIndex = 0;
});
console.log("## 🔴 `◯E` 추출 artifact — 그대로 넣지 않는다 `[확인 필요]`");
console.log("");
console.log("효과음 원문자가 `원문자 + 탭 + E` 로 추출된다. **원본은 한 글자(ⓔ)로 보인다.**");
console.log("§13⑬ 대로 추출 결과를 원문으로 삼지 않는다 — **화면으로 글자를 확인한 뒤 확정한다.**");
console.log("");
const effCount = effHits.reduce((a, h) => a + (String(h.t).match(/◯\s*E/g) || []).length, 0);
console.log(`- 해당 문장 **${effHits.length}개** · 출현 **${effCount}회**`);
console.log("");
console.log("| 문장 | 추출된 형태 (raw) |");
console.log("|---|---|");
for (const h of effHits)
  console.log(`| \`${h.id}\` | ${JSON.stringify(h.t.slice(0, 46))} |`);
console.log("");
console.log(`> **적용 시 이 ${effHits.length}개 문장은 추출 문자열 그대로 넣지 말 것.** 심사관이 화면에서 글자를 확정한 뒤`);
console.log("> 그 글자로 일괄 치환한다. 확정 전에는 `[확인 필요]` 상태로 남긴다.");
console.log("");

console.log("## 적용 시 안전 절차 (아직 실행하지 않음)");
console.log("");
console.log("1. `pipeline/backups/` 로 백업 + MD5 기록");
console.log("2. `s1`~`s13` 무변경 · 새 문장은 `s14`~ 로만 추가 (id 재부여 금지)");
console.log("3. ㉠㉡㉢ 를 s7·s9·s13 에 정박 (별도 발주)");
console.log("4. 되읽기 검산(S-02) — 문장 수 · s1~s13 동일성 · 마커 실재");
console.log("5. `passage_gap_audit` 재실행 → `#68`~`#75` 부재 0 확인");
