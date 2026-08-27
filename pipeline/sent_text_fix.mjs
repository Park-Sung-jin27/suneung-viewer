// sent_text_fix.mjs — 본문 문장(sent.t)을 고치고 참조 3계층을 동시에 맞춘다 (발주 D-118 ①)
//
// D-102 계열 절차. 문장을 고치면 그 문장을 가리키는 것들이 함께 어긋나므로 한 번에 맞춘다:
//   ① sents[].t                       — 본문
//   ② cs_spans[].text                 — 형광펜 (text 매칭이라 옛 형태가 남으면 하이라이트가 죽는다)
//   ③ analysis 안 인용                 — 해설이 옛 형태로 인용하고 있으면 알린다(자동 치환은 하지 않는다)
//
// **원본 PDF 대조가 끝난 건만 SPEC 에 넣는다.** 게이트 메시지만 보고 넣지 않는다 —
// C_anchor 클래스는 원문·해설 어느 쪽이 결함인지 스스로 판별하지 못한다(D-116 실증).
//
// 안전장치 (하나라도 어긋나면 아무것도 쓰지 않는다):
//   · 찾을 문자열이 그 문장에 **정확히 한 번**만 나와야 한다
//   · 바꾼 뒤 길이 변화가 예상과 같아야 한다
//   · cs_spans 는 옛 형태를 품은 것만 골라 같은 치환을 적용한다
//
// 사용: node pipeline/sent_text_fix.mjs [--only <setId>] [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();

// [yearKey, setId, sentId, 찾을 문자열, 바꿀 문자열, 근거]
const SPEC = [
  ["2024_9월", "r20249a", "r20249as12", "끄적 거리는", "끄적거리는",
    "원본 1면 PDF 에서 「끄적 거리는」 매치 rect 의 y 가 673.3 / 691.6 으로 **서로 다른 줄**이다 — "
    + "조판 줄바꿈이 추출 과정에서 공백으로 굳었다. 「끄적거리다」는 한 어절이다. "
    + "해설 Q2#1·Q2#4 는 이미 「끄적거리는」으로 인용하고 있어, 문장을 고치면 정합된다"],
  ["2024_9월", "l20249c", "l20249cs1", "누구 보다도", "누구보다도",
    "원본 10면 PDF 에서 매치 rect y 가 253.1 / 271.6 으로 **서로 다른 줄**이다 — 줄바꿈이 공백으로 굳었다. "
    + "「누구보다도」는 대명사 + 조사 '보다' + '도' 로 붙여 쓴다. 해설 Q28#3 은 이미 붙여 인용한다"],
  ["2024_9월", "r20249d", "r20249ds11", "직역을 얻고자", "직역*을 얻고자",
    "원본 4면 PDF 는 「직역*을 얻고자 하는 현상이 나타났다.」(y 560.7)이다 — 각주 마커 * 가 빠져 있었다. "
    + "각주부 r20249ds20 「*직역 : 신분에 따라 정해진 의무로서의 역할.」과 짝을 이룬다. "
    + "s12 의 「직역 명칭」에는 원본에도 * 가 없다(첫 출현에만 붙는다) — 그쪽은 건드리지 않는다"],
];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const flat = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const norm = (s) => String(s).replace(/_/g, "");
let n = 0, bad = false;
console.log(`## 본문 문장 수리 ${APPLY ? "적용" : "DRY-RUN"} — ${SPEC.length}건\n`);

for (const [yk, sid, sentId, from, to, why] of SPEC) {
  if (ONLY && sid !== ONLY) continue;
  let set = null;
  for (const sec of ["reading", "literature"]) {
    const f = (data[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (f) { set = f; break; }
  }
  if (!set) { console.log(`  🔴 ${yk} ${sid} — 세트 없음`); bad = true; continue; }
  const sent = (set.sents || []).find((x) => String(x.id) === sentId);
  if (!sent) { console.log(`  🔴 ${sentId} — 문장 없음`); bad = true; continue; }
  const t = flat(sent.t);
  const cnt = t.split(from).length - 1;
  if (cnt !== 1) { console.log(`  🔴 ${sentId} — ${JSON.stringify(from)} 가 ${cnt}번 나온다(1번이어야 함)`); bad = true; continue; }
  const nextT = t.replace(from, to);
  if (nextT.length - t.length !== to.length - from.length) {
    console.log(`  🔴 ${sentId} — 길이 변화가 예상과 다르다`); bad = true; continue;
  }

  // ② 그 문장을 가리키면서 옛 형태를 품은 cs_spans
  const spanFix = [];
  for (const q of set.questions || [])
    for (const c of q.choices || [])
      for (const sp of c.cs_spans || []) {
        if (norm(sp.sent_id) !== norm(sentId)) continue;
        const st = flat(sp.text);
        if (!st.includes(from)) continue;
        spanFix.push([sp, st.replace(from, to), q.id, c.num]);
      }

  // ③ 해설이 옛 형태로 인용하고 있는지 — 알리기만 한다
  const anaOld = [];
  for (const q of set.questions || [])
    for (const c of q.choices || [])
      if (flat(c.analysis).includes(from)) anaOld.push(`Q${q.id}#${c.num}`);

  const i = t.indexOf(from);
  console.log(`  ${yk} ${sid} ${sentId}`);
  console.log(`     전: ${JSON.stringify(t.slice(Math.max(0, i - 24), i + from.length + 20))}`);
  console.log(`     후: ${JSON.stringify(nextT.slice(Math.max(0, i - 24), i + to.length + 20))}`);
  for (const [sp, fixed, qid, num] of spanFix)
    console.log(`     cs_span 동반 수정 Q${qid}#${num}: ${JSON.stringify(flat(sp.text).slice(0, 40))} → ${JSON.stringify(fixed.slice(0, 40))}`);
  if (!spanFix.length) console.log(`     cs_span: 옛 형태를 품은 span 없음`);
  if (anaOld.length) console.log(`     ⚠ 해설이 아직 옛 형태로 인용한다: ${anaOld.join(", ")} — 자동 치환하지 않는다, 판정 필요`);
  else console.log(`     해설: 이미 새 형태로 인용하고 있다 — 문장을 고치면 정합된다`);
  console.log(`     근거: ${why}`);

  if (APPLY) {
    sent.t = nextT;
    for (const [sp, fixed] of spanFix) sp.text = fixed;
  }
  n++;
}

if (bad) { console.log(`\n🔴 검증 실패가 있다 — 아무것도 쓰지 않았다`); process.exit(1); }
if (APPLY && n) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · ${n}건`);
  // 되읽어 확인한다 — 「적용」이라 찍고 안 써진 사고가 있었다(D-120). 채택 규칙 ②
  const back = JSON.parse(fs.readFileSync(DATA, "utf8"));
  let miss = 0;
  for (const [yk, sid, sentId, from, to] of SPEC) {
    if (ONLY && sid !== ONLY) continue;
    let set = null;
    for (const sec of ["reading", "literature"]) {
      const f = (back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
      if (f) { set = f; break; }
    }
    const sent = (set?.sents || []).find((x) => String(x.id) === sentId);
    if (!sent) continue;
    const t = flat(sent.t);
    if (t.includes(from) || !t.includes(to)) { console.log(`  🔴 되읽기 실패: ${sentId} 본문`); miss++; }
    for (const q of set.questions || [])
      for (const c of q.choices || [])
        for (const sp of c.cs_spans || []) {
          if (norm(sp.sent_id) !== norm(sentId)) continue;
          if (flat(sp.text).includes(from)) { console.log(`  🔴 되읽기 실패: Q${q.id}#${c.num} cs_span 에 옛 형태 잔존`); miss++; }
          if (!t.includes(flat(sp.text))) { console.log(`  🔴 되읽기 실패: Q${q.id}#${c.num} cs_span 이 문장에서 안 잡힌다`); miss++; }
        }
  }
  if (miss) { console.log(`
🔴 되읽기에서 ${miss}건이 어긋났다`); process.exit(1); }
  console.log(`  되읽기 검산 통과 — 본문·cs_span 정합`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
