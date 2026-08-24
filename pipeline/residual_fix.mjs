// residual_fix.mjs — 병합 데이터의 알려진 잔존 정리 (발주 D-100)
//
// 대상은 **병합된 `public/data/all_data_204.json` 안의 신규 43세트**다.
// 같은 내용을 `pipeline/reextract/step3/*/step4_result.json` 에도 반영해 재현성을 지킨다.
//
// ① 줄바꿈 잔존 19건
//    · PDF 로 확정한 3건은 `newline_residual.mjs` 가 처리한다.
//    · PDF 로도 판별되지 않는 16건은 **국어 어법**으로 판정했다(아래 표에 근거 기록).
//      16건 모두 `sentType: "body"` — 산문이라 줄바꿈이 행 구분이 아니다.
//      (시라면 `verse` 이고, 그때는 줄바꿈이 구조이므로 손대면 안 된다.)
//
// ② PUA 별종 2자리
//    원본 PDF 를 잘라 자형을 눈으로 확인했다(`pipeline/pua_render.py`).
//
// 사용: node pipeline/residual_fix.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const APPLY = process.argv.includes("--apply");

// ── ① 어법 판정 16건 ──
//    sp=true 공백 / sp=false 붙임. why 는 판단 근거 한 줄.
const NL = [
  ["2014_6월A", "l20146ds28", true, "접속부사 「그러나」와 서술어는 별개 어절"],
  ["2015_6월B", "l20156cs8", true, "부사 「어찌」 뒤 목적어는 별개 어절"],
  ["2014_9월A", "l20149ds18", true, "부사 「이에」 뒤 용언은 별개 어절"],
  ["2014_9월B", "l20149es24", true, "조사 「와」로 어절이 완결됨"],
  ["2016_6월B", "l20166cs16", true, "연결어미 「하고」 뒤 부사는 별개 어절"],
  ["2016_6월B", "l20166es51", false, "「어딜」(어디를의 준말)은 한 어절"],
  ["2016_9월B", "l20169bs53", true, "관형어 「푸른」 뒤 체언은 별개 어절"],
  ["2016_9월A", "l20169es26", true, "보조사 「인가」로 어절이 완결됨"],
  ["2016_9월A", "l20169es36", false, "접속부사 「그리고」는 한 어절"],
  ["2018_9월", "l20189bs11", true, "조사 「은」으로 어절이 완결됨"],
  ["2018_9월", "l20189bs81", true, "관형사 「이」는 뒤 체언과 띄어 씀"],
  ["2018_9월", "l20189cs14", true, "부사 「진정」 뒤 부정부사는 별개 어절"],
  ["2018_9월", "l20189ds34", true, "「암만 해도」는 부사+용언으로 띄어 씀"],
  ["2020_6월", "l20206ds42", true, "부사 「이제」 뒤 용언은 별개 어절"],
  ["2020_9월", "l20209ds25", true, "쉼표로 어절이 끝남"],
  ["2020_9월", "l20209ds46", true, "부사 「통」 뒤 주어는 별개 어절"],
];

// ── ② PUA 별종 ──
//    U+F675  : 각주 「暗質) :▩어리석은」 의 콜론 뒤. PDF 렌더 결과 같은 면의 다른 각주가
//              모두 「: 」(콜론+공백)이다 → 일반 공백.
//    U+E06D/E000/E001 : <보기> 의 세로 분수. PDF 렌더 결과 위 B · 가로선 · 아래 A → 「B/A」.
//              기존 353세트에는 분수를 텍스트로 쓴 전례가 없다(수식 <보기>는 이미지 처리).
//              이미지 대체는 별건이므로 여기서는 읽을 수 있는 「B/A」로 둔다.
const PUA = [
  ["2016_9월A", "l20169e", "sent", "l20169es42", "", " ", "각주 콜론 뒤 공백 (같은 면 다른 각주와 동일)"],
  ["2017_9월", "r20179c", "bogi", 33, "\n", "B/A", "세로 분수 B/A (PDF 렌더 확인)"],
  // 같은 자리의 조판 붙임 오류 — 조사 「을」 뒤는 띄어 쓴다
  ["2017_9월", "r20179c", "bogi", 33, "일당량을구하면", "일당량을 구하면", "조사 「을」 뒤는 띄어 씀"],
];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const findSet = (yk, sid) => {
  for (const sec of ["reading", "literature"]) {
    const s = (data[yk]?.[sec] || []).find((x) => x.id === sid);
    if (s) return s;
  }
  return null;
};
const findSentAnywhere = (yk, sentId) => {
  for (const sec of ["reading", "literature"])
    for (const s of data[yk]?.[sec] || []) {
      const x = (s.sents || []).find((z) => z.id === sentId);
      if (x) return x;
    }
  return null;
};

console.log(`## 잔존 정리 ${APPLY ? "적용" : "DRY-RUN"}\n`);

// ── ① ──
console.log(`### ① 줄바꿈 어법 판정 — ${NL.length}건`);
let n1 = 0;
const nlDone = [];
for (const [yk, sid, sp, why] of NL) {
  const x = findSentAnywhere(yk, sid);
  if (!x) { console.log(`  🔴 ${yk} ${sid} — 문장 없음`); continue; }
  const t = String(x.t ?? "");
  if (!t.includes("\n")) { console.log(`  ⚠ ${yk} ${sid} — ⏎ 없음(이미 처리됨)`); continue; }
  const parts = t.split("\n");
  // 조각 사이 공백이 이미 있을 수 있다 — 중복 공백을 만들지 않는다
  const out = parts.map((p, i) => (i === 0 ? p.replace(/\s+$/, "") : p.replace(/^\s+/, "")))
    .join(sp ? " " : "");
  console.log(`  ${yk} ${sid}  ${sp ? "공백" : "붙임"} — ${why}`);
  console.log(`     전: …${t.replace(/\n/g, " ⏎ ").slice(0, 62)}…`);
  console.log(`     후: …${out.slice(0, 62)}…`);
  if (APPLY) x.t = out;
  nlDone.push({ yk, sid, out });
  n1++;
}

// ── ② ──
console.log(`\n### ② PUA 별종 — ${PUA.length}건`);
let n2 = 0;
const puaDone = [];
for (const [yk, setId, kind, key, from, to, why] of PUA) {
  const s = findSet(yk, setId);
  if (!s) { console.log(`  🔴 ${yk} ${setId} — 세트 없음`); continue; }
  let target = null, apply = null;
  if (kind === "sent") {
    // 🔴 target 을 문자열로 덮어쓰면 apply 클로저가 가리키던 객체를 잃는다. 별도 변수로 든다.
    const sent = (s.sents || []).find((z) => z.id === key);
    if (sent) { apply = (v) => { sent.t = v; }; target = String(sent.t); }
  } else {
    const q = (s.questions || []).find((z) => String(z.id) === String(key));
    if (q) {
      if (typeof q.bogi === "string") { target = q.bogi; apply = (v) => { q.bogi = v; }; }
      else if (q.bogi && typeof q.bogi === "object")
        for (const [k, v] of Object.entries(q.bogi))
          if (typeof v === "string" && v.includes(from)) { target = v; apply = (nv) => { q.bogi[k] = nv; }; }
    }
  }
  if (target === null || target === undefined) { console.log(`  🔴 ${yk} ${setId} ${key} — 대상 없음`); continue; }
  if (!String(target).includes(from)) { console.log(`  ⚠ ${yk} ${setId} ${key} — 대상 문자열 없음(이미 처리됨)`); continue; }
  const out = String(target).replace(from, to);
  const at = String(target).indexOf(from);
  console.log(`  ${yk} ${setId} ${key} — ${why}`);
  console.log(`     전: …${String(target).slice(Math.max(0, at - 26), at + 26).replace(/\n/g, "⏎")}…`);
  console.log(`     후: …${out.slice(Math.max(0, at - 26), at + 26).replace(/\n/g, "⏎")}…`);
  if (APPLY) apply(out);
  puaDone.push({ yk, setId, kind, key, from, to });
  n2++;
}

if (APPLY) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB`);
  // step4_result 에도 같은 내용을 반영 (재현성)
  const touched = new Set([...nlDone, ...puaDone].map((x) => x.yk));
  for (const yk of touched) {
    const p = path.join(STEP3, yk, "step4_result.json");
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const d of nlDone.filter((x) => x.yk === yk))
      for (const s of [...(j.reading || []), ...(j.literature || [])]) {
        const x = (s.sents || []).find((z) => z.id === d.sid);
        if (x) x.t = d.out;
      }
    for (const d of puaDone.filter((x) => x.yk === yk))
      for (const s of [...(j.reading || []), ...(j.literature || [])]) {
        if (s.id !== d.setId) continue;
        if (d.kind === "sent") {
          const x = (s.sents || []).find((z) => z.id === d.key);
          if (x && String(x.t).includes(d.from)) x.t = String(x.t).replace(d.from, d.to);
        } else {
          const q = (s.questions || []).find((z) => String(z.id) === String(d.key));
          if (!q) continue;
          if (typeof q.bogi === "string" && q.bogi.includes(d.from)) q.bogi = q.bogi.replace(d.from, d.to);
          else if (q.bogi && typeof q.bogi === "object")
            for (const [k, v] of Object.entries(q.bogi))
              if (typeof v === "string" && v.includes(d.from)) q.bogi[k] = v.replace(d.from, d.to);
        }
      }
    fs.writeFileSync(p, JSON.stringify(j, null, 2), "utf8");
  }
  console.log(`  step4_result 동기화 ${touched.size}회차`);
}
console.log(`\n## 줄바꿈 ${n1}건 · PUA ${n2}건`);
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
