// polarity_regen.mjs — 극성역전 (B) 4건 해설 재생성 (발주 2026-08-24 ②-B)
//
// (A) 4건은 표지만 틀려 polarity_fix.mjs 로 끝났다. (B) 4건은 **본문 서술까지**
// 선지를 긍정해 표지만 뒤집으면 모순된다. 해설 자체를 다시 만들어야 한다.
//
// 43세트를 만든 바로 그 함수(step3_analysis.js의 reanalyzeSingleChoice)를 쓴다.
// 프롬프트·모델·시스템 프롬프트·형식 전부 무변경 — 대상만 4개 선지로 좁혔다.
// questionType 을 그대로 넘기므로 positive/negative 둘 다 정상 처리된다.
//
// 재생성 후:
//   ① 재대조 — 결론 표지가 ok 와 맞는지. 어긋나면 채택하지 않고 원본 유지.
//   ② 후처리 — step3 가 붙이는 꼬리 패턴 코드([L4] 등) 제거(D-85 재오염 차단).
//
// 사용: node pipeline/polarity_regen.mjs [--apply] [--retry N]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reanalyzeSingleChoice } from "./step3_analysis.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const APPLY = process.argv.includes("--apply");
const RETRY = (() => { const i = process.argv.indexOf("--retry"); return i > 0 ? Number(process.argv[i + 1]) : 3; })();

// (B) — 본문 서술도 선지를 긍정한 4건. 전부 ok=false 가 정답키상 맞다.
const TARGET = [
  ["2014_9월A", "l20149d", 43, 5],
  ["2015_9월B", "l20159d", 45, 3],
  ["2016_6월B", "l20166b", 35, 5],
  ["2016_9월B", "l20169b", 34, 2],
];

// 결론 표지가 ok 와 맞는가 (reanalyze_positive.mjs 의 isReversed 와 같은 기준)
function conclusionOk(analysis, ok) {
  const a = String(analysis || "");
  if (!a.trim()) return false;
  const at = Math.max(a.lastIndexOf("✅"), a.lastIndexOf("❌"));
  if (at < 0) return false;
  const pos = a[at] === "✅";
  return ok === true ? pos : !pos;
}

// step3 꼬리 패턴 코드 제거 — 데이터에는 pat 필드로 들어가고 본문에는 안 나온다.
// D-85 에서 기존 6,840개를 청소했으나 생성기는 계속 붙인다.
const TAIL = /\s*[\[(]\s*(?:R[1-9]|L[1-9]|V|0)\s*[\])]\s*$/;
function stripTail(analysis) {
  const lines = String(analysis || "").split("\n");
  const last = lines.length - 1;
  if (TAIL.test(lines[last])) lines[last] = lines[last].replace(TAIL, "");
  return lines.join("\n");
}

console.log(`## (B) 해설 재생성 ${APPLY ? "적용" : "DRY-RUN"} — ${TARGET.length}건 (재시도 최대 ${RETRY})\n`);

const byYk = {};
for (const [yk, ...rest] of TARGET) (byYk[yk] ??= []).push(rest);

let done = 0, kept = 0;
for (const [yk, list] of Object.entries(byYk)) {
  const p = path.join(STEP3, yk, "step4_result.json");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  let touched = false;

  for (const [sid, qid, cn] of list) {
    const set = [...(j.reading || []), ...(j.literature || [])].find((x) => x.id === sid);
    const q = (set?.questions || []).find((x) => String(x.id) === String(qid));
    const c = (q?.choices || []).find((x) => String(x.num) === String(cn));
    if (!c) { console.log(`  🔴 ${yk} ${sid} Q${qid}#${cn} — 못 찾음`); continue; }

    const before = String(c.analysis || "");
    console.log(`\n  ${yk} ${sid} Q${qid}#${cn}  ok=${c.ok} · ${q.questionType}`);
    console.log(`    전: ${before.slice(Math.max(0, before.lastIndexOf("✅"), before.lastIndexOf("❌"))).slice(0, 70).replace(/\n/g, " ")}`);

    if (!APPLY) { console.log(`    (DRY-RUN — 호출하지 않음)`); continue; }

    let adopted = null;
    for (let t = 1; t <= RETRY; t++) {
      let out;
      try { out = await reanalyzeSingleChoice(set, q, c); }
      catch (e) { console.log(`    ⟳ ${t}회 실패: ${String(e.message).slice(0, 90)}`); continue; }
      if (!out) { console.log(`    ⟳ ${t}회 빈 응답`); continue; }
      out = stripTail(out);
      if (conclusionOk(out, c.ok)) { adopted = out; break; }
      console.log(`    ⟳ ${t}회 결론 표지가 여전히 ok 와 어긋남`);
    }
    if (adopted) {
      c.analysis = adopted;
      touched = true; done++;
      const at = Math.max(adopted.lastIndexOf("✅"), adopted.lastIndexOf("❌"));
      console.log(`    후: ${adopted.slice(at).slice(0, 70).replace(/\n/g, " ")}  ✅ 채택`);
    } else {
      kept++;
      console.log(`    🔴 ${RETRY}회 모두 실패 — **원본 유지**(빈 해설로 덮지 않는다)`);
    }
  }
  if (APPLY && touched) fs.writeFileSync(p, JSON.stringify(j, null, 2), "utf8");
}

console.log(`\n## 채택 ${done} · 원본 유지 ${kept} / 대상 ${TARGET.length}`);
if (!APPLY) console.log(`\n### DRY-RUN — API 를 호출하지 않았다. 실행하려면 --apply`);
