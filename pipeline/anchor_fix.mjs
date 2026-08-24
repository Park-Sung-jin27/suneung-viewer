// anchor_fix.mjs — C_anchor_exact_fail 건별 정정 (발주 2026-08-24 ③)
//
// 게이트는 analysis 의 「📌 지문 근거」 인용문과 sent.t 를 대조해 공백 배치가
// 어긋나면 잡는다. 자동 판정은 셋 다 실패했다:
//   · PDF 줄 끝 공백 — 1차 근거지만 줄 매칭이 어긋난 자리가 바로 이 20건이다
//   · analysis 인용문 — step3 는 줄바꿈 자리에 **항상 공백을 넣는다**. 근거가 못 된다
//     (실증: "것이⏎라면야" 를 "것이 라면야" 로 인용했다)
//   · 기존 353세트 코퍼스 — 958k자로는 대부분 판정 불가(9개 표본 중 8개 미출현)
//
// 그래서 **건별로 판정**했다. 두 방향이 있다:
//   (가) 본문이 틀렸다 → sent.t 를 고친다 (SENT_FIX)
//   (나) 본문이 옳고 인용문이 틀렸다 → analysis 인용문을 본문 원문으로 맞춘다 (QUOTE_OK)
//
// 사용: node pipeline/anchor_fix.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const APPLY = process.argv.includes("--apply");

// ── (가) 본문이 틀렸다 — 어절 경계인데 붙였거나, 어절 중간인데 띄었다 ──
const SENT_FIX = [
  ["2014_6월B", "l20146fs6", "봉건적성장과", "봉건적 성장과"],
  ["2015_9월B", "l20159bs55", "지구의절반을", "지구의 절반을"],
  ["2016_9월B", "l20169cs29", "도도 가 무엇인가를", "도도가 무엇인가를"],
  ["2019_9월", "r20199cs10", "있었다고주장하였다", "있었다고 주장하였다"],
  ["2019_9월", "r20199cs37", "집단적으로공유하면서", "집단적으로 공유하면서"],
  ["2019_9월", "r20199cs40", "근대 도시 는", "근대 도시는"],
  ["2020_9월", "l20209bs23", "서대주노비", "서대주 노비"],
  ["2020_9월", "l20209bs25", "흑공단두루마기", "흑공단 두루마기"],
  ["2020_9월", "l20209ds45", "그처럼잘난", "그처럼 잘난"],
  // 2차 — 위를 적용한 뒤 드러난 자리
  ["2015_9월B", "l20159bs55", "도요새 의 고통", "도요새의 고통"],
  ["2020_9월", "l20209bs25", "위풍이 헌앙한짐승이라", "위풍이 헌앙한 짐승이라"],
  ["2020_9월", "l20209ds54", "삽니다아 ―부서진", "삽니다아 ― 부서진"],
];

// ── (나) 본문이 옳다 — 한 어절인데 인용문이 쪼갰다. 인용문을 본문에 맞춘다 ──
//    「대대손손」·「것이라면야」·「이렇듯이」는 붙여 쓰는 것이 맞다.
const QUOTE_OK = [
  ["2022_9월", "l20229cs9"],
  ["2014_6월A", "l20146ds31"],
  ["2015_9월A", "l20159ds43"],
  ["2015_9월B", "l20159cs43"],
  // 2차 — 「못내」는 한 단어, 마커 뒤 한 칸은 본문 관례, 문장 앞 공백은 본문이 정본
  ["2015_9월A", "l20159ds25"],
  ["2016_9월A", "l20169es17"],
  ["2019_9월", "r20199cs34"],
];

const W = (s) => String(s).replace(/\s/g, "");
const cache = {};
const load = (yk) => (cache[yk] ??= JSON.parse(fs.readFileSync(path.join(STEP3, yk, "step4_result.json"), "utf8")));
const dirty = new Set();
const findSent = (j, id) => {
  for (const s of [...(j.reading || []), ...(j.literature || [])]) {
    const x = (s.sents || []).find((z) => z.id === id);
    if (x) return { set: s, sent: x };
  }
  return null;
};

console.log(`## C_anchor 건별 정정 ${APPLY ? "적용" : "DRY-RUN"}\n`);

// ── (가) ──
console.log(`### (가) 본문 정정 — ${SENT_FIX.length}곳`);
let a = 0;
for (const [yk, sid, from, to] of SENT_FIX) {
  const hit = findSent(load(yk), sid);
  if (!hit) { console.log(`  🔴 ${yk} ${sid} — 문장 없음`); continue; }
  const t = String(hit.sent.t);
  if (!t.includes(from)) {
    console.log(`  ⚠ ${yk} ${sid} — "${from}" 없음 (이미 정정됐거나 형태가 다르다)`);
    continue;
  }
  if (W(t.replace(from, to)) !== W(t)) { console.log(`  🔴 ${yk} ${sid} — 공백 외 글자가 바뀐다. 중단`); continue; }
  console.log(`  ${yk} ${sid}:  "${from}" → "${to}"`);
  if (APPLY) { hit.sent.t = t.replace(from, to); dirty.add(yk); }
  a++;
}

// ── (나) analysis 인용문을 본문 원문으로 맞춘다 ──
//    인용문 안에서 본문과 공백만 다른 구간을 찾아 본문 원문으로 바꾼다.
//    글자는 손대지 않는다 — 공백 배치만 본문 쪽으로 돌린다.
function fixQuotes(setObj, sentT) {
  const sw = W(sentT);
  // 본문의 비공백 문자 → 원본 인덱스
  const map = [];
  for (let i = 0; i < sentT.length; i++) if (!/\s/.test(sentT[i])) map.push(i);
  let n = 0;
  for (const q of setObj.questions || []) for (const c of q.choices || []) {
    const orig = String(c.analysis || "");
    if (!orig) continue;
    // 큰따옴표 안 인용 단위로 검사
    const out = orig.replace(/[""]([^""\n]{10,})[""]/g, (whole, inner) => {
      if (sentT.includes(inner)) return whole;          // 이미 일치
      const iw = W(inner);
      const at = sw.indexOf(iw);
      if (at < 0 || sw.indexOf(iw, at + 1) >= 0) return whole;   // 없거나 두 곳 이상
      const seg = sentT.slice(map[at], map[at + iw.length - 1] + 1);
      if (W(seg) !== iw) return whole;
      n++;
      return whole[0] + seg + whole[whole.length - 1];
    });
    if (out !== orig && APPLY) c.analysis = out;
  }
  return n;
}

console.log(`\n### (나) 인용문을 본문에 맞춤 — ${QUOTE_OK.length}문장`);
let b = 0;
for (const [yk, sid] of QUOTE_OK) {
  const hit = findSent(load(yk), sid);
  if (!hit) { console.log(`  🔴 ${yk} ${sid} — 문장 없음`); continue; }
  const n = fixQuotes(hit.set, String(hit.sent.t));
  console.log(`  ${yk} ${sid}: 인용 ${n}곳 재정박`);
  if (n && APPLY) dirty.add(yk);
  b += n;
}

if (APPLY) for (const yk of dirty)
  fs.writeFileSync(path.join(STEP3, yk, "step4_result.json"), JSON.stringify(cache[yk], null, 2), "utf8");

console.log(`\n## 본문 정정 ${a}곳 · 인용 재정박 ${b}곳`);
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
