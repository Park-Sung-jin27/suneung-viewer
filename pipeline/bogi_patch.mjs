// bogi_patch.mjs — 발문 참조 상자 부재 2건 패치 (발주 D-101 ②)
//
// ① 2016_6월B l20166b Q36 — <학습 활동 과제> 상자가 통째로 없다.
//    PDF 텍스트 레이어에도 없다(래스터). 원본 지면을 420dpi 로 렌더해 전사했다.
//    (2016_9월A Q40 과 같은 방법 — OCR 이 아니라 원본 지면 판독)
//
// ② 2015_9월B l20159d Q45 — 상자 내용이 **발문 문자열 안에** 붙어 있다.
//    발문과 상자를 분리한다. 글자는 하나도 바꾸지 않는다 — 자르기만 한다.
//
// 형식은 기존 353세트를 따랐다(l20146d Q36: 상자 제목 + 줄바꿈 + 내용).
//
// 사용: node pipeline/bogi_patch.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const APPLY = process.argv.includes("--apply");

// ── ① 원본 지면에서 전사한 전문 ──
const Q36_BOGI = [
  "학습 활동 과제",
  "최일남의 ｢흐르는 북｣은 산업화 시대에 전통 예술을 둘러싼 세대 간의 가치관 대립과 갈등, 그리고 화해의 문제를 다룬 소설이다. 다음을 참고하여 작품을 감상해 보자.",
  "",
  "소통은 경험이나 가치관의 공유를 전제로 하는데, 인간은 다양한 방식의 소통을 통해 사회적 관계 속에서 자신의 존재 가치를 인정받으려 한다. 그런데 산업화 시대에는 가치관이 급격히 변하고 세대 간에 서로가 경험을 공유하지 못하여 소통에 어려움을 겪는 경우가 많았다. 이는 예술가의 삶에도 영향을 미쳤다.",
].join("\n");

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const getQ = (yk, sid, qid) => {
  for (const sec of ["reading", "literature"]) {
    const s = (data[yk]?.[sec] || []).find((x) => x.id === sid);
    if (!s) continue;
    return (s.questions || []).find((x) => String(x.id) === String(qid)) || null;
  }
  return null;
};

const done = [];
console.log(`## 참조 상자 패치 ${APPLY ? "적용" : "DRY-RUN"}\n`);

// ── ① l20166b Q36 ──
{
  const q = getQ("2016_6월B", "l20166b", 36);
  if (!q) console.log("  🔴 2016_6월B l20166b Q36 — 못 찾음");
  else if (q.bogi) console.log("  ⚠ 2016_6월B l20166b Q36 — 이미 bogi 있음");
  else {
    console.log(`  2016_6월B l20166b Q36 — <학습 활동 과제> 전사 삽입`);
    console.log(`     발문: ${String(q.t).replace(/\n/g, " ").slice(0, 56)}`);
    for (const line of Q36_BOGI.split("\n")) console.log(`     │ ${line.slice(0, 62)}`);
    if (APPLY) q.bogi = Q36_BOGI;
    done.push({ yk: "2016_6월B", sid: "l20166b", qid: 36, bogi: Q36_BOGI });
  }
}

// ── ② l20159d Q45 — 발문에서 상자를 잘라 낸다 ──
{
  const q = getQ("2015_9월B", "l20159d", 45);
  if (!q) console.log("\n  🔴 2015_9월B l20159d Q45 — 못 찾음");
  else if (q.bogi) console.log("\n  ⚠ 2015_9월B l20159d Q45 — 이미 bogi 있음");
  else {
    const t = String(q.t);
    const cut = t.indexOf("<보기 1>", t.indexOf("[3점]"));
    if (cut < 0) console.log("\n  🔴 2015_9월B l20159d Q45 — 자를 자리를 못 찾음");
    else {
      const head = t.slice(0, cut).trim(), box = t.slice(cut).trim();
      // 글자 손실이 없어야 한다
      const W = (s) => s.replace(/\s/g, "");
      if (W(head) + W(box) !== W(t)) console.log("\n  🔴 자르기에서 글자가 바뀐다. 중단");
      else {
        console.log(`\n  2015_9월B l20159d Q45 — 발문에서 상자 분리`);
        console.log(`     발문: ${head}`);
        console.log(`     상자: ${box.slice(0, 70)}… (${box.length}자)`);
        if (APPLY) { q.t = head; q.bogi = box; }
        done.push({ yk: "2015_9월B", sid: "l20159d", qid: 45, t: head, bogi: box });
      }
    }
  }
}

if (APPLY && done.length) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB`);
  // step4_result 동기화
  for (const d of done) {
    const p = path.join(STEP3, d.yk, "step4_result.json");
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const s of [...(j.reading || []), ...(j.literature || [])]) {
      if (s.id !== d.sid) continue;
      const q = (s.questions || []).find((x) => String(x.id) === String(d.qid));
      if (!q) continue;
      if (d.t !== undefined) q.t = d.t;
      q.bogi = d.bogi;
    }
    fs.writeFileSync(p, JSON.stringify(j, null, 2), "utf8");
  }
  console.log(`  step4_result 동기화 ${done.length}건`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
