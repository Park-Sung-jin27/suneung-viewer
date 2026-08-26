// analysis_format_fix.mjs — 해설의 **형식**만 고친다 (발주 D-115 ③)
//
// ★ 논지는 건드리지 않는다. 두 가지만 한다:
//   ① CONCLUSION — 결론 블록(마지막 줄 `❌ …`)이 빠진 해설에 그 줄만 덧붙인다.
//      quality_gate:1628 이 「결론줄 = ✅/❌ 를 포함하는 마지막 줄」로 ok 와 대조하는데,
//      이모지가 아예 없으면 포맷 파손으로 보고 reversed 판정을 낸다.
//      **정답표 대조로 ok 가 맞다는 것을 먼저 확인한 건만 넣는다.**
//   ② MARKDOWN — `**강조**` / `__강조__` 의 표시 문자만 벗긴다(안쪽 글자는 그대로).
//      학생 화면이 마크다운을 렌더하지 않아 별표가 그대로 보인다.
//
// 기존 6,840개와 같은 틀을 지킨다 — 결론 줄 형식은 `❌ <요약> [<pat 표기>]` 이고,
// pat 표기는 데이터에서 가장 많이 쓰인 표기를 그대로 쓴다
//   R1 [사실 왜곡] 161 · R2 [인과·관계 전도] 60 · R3 [과잉 추론] 85
//   R4 [개념 혼합] 32 · L4 [구조·맥락 오류] 32
//
// 사용: node pipeline/analysis_format_fix.mjs [--only <setId>] [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();

// [yearKey, setId, qId, choiceNum, 종류, 값, 근거]
const SPEC = [
  ["2026_6월", "r20266a", 3, 3, "CONCLUSION",
    "❌ 문맥에 어울리는지 여부를 정반대로 뒤바꾼 부적절한 진술 [인과·관계 전도]",
    "정답표 2026_6월 3번 = ③ 이고 데이터도 ok:false 가 #3 하나뿐이다(negative 발문) — 논지·ok 모두 정합. 결론 블록만 없었다. pat=R2"],
  ["2026_9월", "l20269d", 30, 1, "CONCLUSION",
    "❌ (나)·(다)의 태도를 (가)에 그대로 겹쳐 읽은 부적절한 진술 [구조·맥락 오류]",
    "정답표 2026_9월 30번 = ① 이고 데이터도 ok:false 가 #1 하나뿐이다 — 논지·ok 모두 정합. pat=L4"],

  ["2026_6월", "r20266b", 4, 5, "MARKDOWN", null, "강조 2곳"],
  ["2026_6월", "r20266b", 5, 1, "MARKDOWN", null, "강조 2곳"],
  ["2026_6월", "r20266b", 9, 2, "MARKDOWN", null, "강조 1곳"],
  ["2026_6월", "r20266b", 9, 4, "MARKDOWN", null, "강조 5곳"],
  ["2026_6월", "r20266b", 9, 5, "MARKDOWN", null, "강조 1곳"],
  ["2026_6월", "l20266c", 29, 3, "MARKDOWN", null, "강조 2곳"],
];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const flat = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
let n = 0, bad = false;
console.log(`## 해설 형식 수리 ${APPLY ? "적용" : "DRY-RUN"} — ${SPEC.length}건\n`);

for (const [yk, sid, qid, num, kind, val, why] of SPEC) {
  if (ONLY && sid !== ONLY) continue;
  let set = null;
  for (const sec of ["reading", "literature"]) {
    const f = (data[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (f) { set = f; break; }
  }
  if (!set) { console.log(`  🔴 ${yk} ${sid} — 세트 없음`); bad = true; continue; }
  const q = (set.questions || []).find((x) => String(x.id) === String(qid));
  const c = q && (q.choices || []).find((x) => String(x.num) === String(num));
  if (!c) { console.log(`  🔴 ${sid} Q${qid}#${num} — 선지 없음`); bad = true; continue; }
  const a = flat(c.analysis);

  if (kind === "CONCLUSION") {
    if (/[✅❌]/.test(a)) { console.log(`  ⚠ ${sid} Q${qid}#${num} — 이미 결론 이모지가 있다, 건너뜀`); continue; }
    if (c.ok !== false) { console.log(`  🔴 ${sid} Q${qid}#${num} — ok 가 false 가 아니다(${c.ok}). ❌ 블록을 넣으면 안 된다`); bad = true; continue; }
    const next = a.replace(/\s+$/, "") + "\n" + val;
    console.log(`  ${yk} ${sid} Q${qid}#${num} [결론 블록 추가]`);
    console.log(`     기존 끝: ${JSON.stringify(a.replace(/\s+$/, "").slice(-46))}`);
    console.log(`     추가:    ${JSON.stringify(val)}`);
    console.log(`     근거: ${why}`);
    if (APPLY) c.analysis = next;
    n++;
    continue;
  }

  if (kind === "MARKDOWN") {
    // 표시 문자만 벗긴다. 안쪽 글자는 한 글자도 바꾸지 않는다.
    const next = a.replace(/(\*\*|__)(.+?)\1/gs, "$2");
    if (next === a) { console.log(`  ⚠ ${sid} Q${qid}#${num} — 강조 표시가 없다, 건너뜀`); continue; }
    const hits = [...a.matchAll(/(\*\*|__)(.+?)\1/gs)];
    if (a.length - next.length !== hits.length * 4) {
      console.log(`  🔴 ${sid} Q${qid}#${num} — 길이 변화(${a.length - next.length})가 표시 문자 수(${hits.length * 4})와 다르다. 중단`);
      bad = true; continue;
    }
    console.log(`  ${yk} ${sid} Q${qid}#${num} [강조 표시 제거] ${hits.length}곳 — ${why}`);
    for (const h of hits) console.log(`     ${JSON.stringify(h[0].slice(0, 34))} → ${JSON.stringify(h[2].slice(0, 30))}`);
    if (APPLY) c.analysis = next;
    n++;
  }
}

if (bad) { console.log(`\n🔴 검증 실패가 있다 — 아무것도 쓰지 않았다`); process.exit(1); }
if (APPLY && n) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · ${n}건`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
