// defect_marker_clear.mjs — 결함 표지 밑줄 키를 **수리가 끝난 뒤에** 지운다 (발주 D-133 ②)
//
// ★ 순서가 규칙이다 — 수리가 먼저, 제거가 나중.
//   표지를 먼저 지우면 결함이 남은 채 게이트만 조용해진다. 그래서 이 도구는
//   **지우기 전에 그 표지가 가리키던 결함이 실제로 사라졌는지 스스로 확인한다.**
//   확인이 안 되면 아무것도 지우지 않는다.
//
// 다루는 키:
//   _pat_error              — pat 이 비어 있다는 표지. pat 이 채워졌으면 해소
//   _ok_analysis_mismatch   — ok 와 결론 기호가 어긋난다는 표지. 맞아졌으면 해소
//   _discriminative_validation — 일상 산출물이라 **지우지 않는다**. passed 만 갱신한다.
//                                (LIVE 세트 526건이 이 키를 갖고 있다 — 결함 표지가 아니다)
//
// 안전장치 셋 (replace·pat 모드와 같다):
//   ① 선지별 SPEC — 세트 단위 일괄이 아니라 한 선지씩 적는다
//   ② 지우기 전에 기존 값을 전부 출력한다
//   ③ 쓴 뒤 되읽어 검산하고, 어긋나면 exit 1
//
// 사용: node pipeline/defect_marker_clear.mjs [--only <setId>] [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();

const SPEC = [
  // ── D-133 ② l20219d Q32#5 — 심사관 승인 ─────────────────────────────
  //   수리가 먼저 끝났다: pat L4 부여(D-131 ④) · 결론줄 표준화(D-133 ①).
  //   그 두 수리가 이 표지들이 가리키던 결함을 각각 없앴다.
  {
    yk: "2021_9월", setId: "l20219d", qId: 32, num: 5,
    clear: ["_pat_error", "_ok_analysis_mismatch"],
    validation: {
      passed: true,
      resolved: ["PAT_FIELD_MISSING", "wrong_no_trap_diagnosis"],
      note: "PAT_FIELD_MISSING 은 pat L4 부여(D-131 ④)로, wrong_no_trap_diagnosis 는 "
        + "결론줄을 형제 정형구로 표준화(D-133 ①)하여 해소했다. 재실행이 아니라 근거를 명시한 갱신이다.",
      updated_by: "D-133 ②",
    },
    why: "pat 이 L4 로 채워졌고 결론줄이 「❌ 지문과 어긋나는 부적절한 진술」로 ok:false 와 맞아졌다",
  },

  // ── D-190 트랙2 r20279b 3선지 — 심사관 gate3 통과 뒤 (2026-09-02) ────
  //   세 선지 모두 ok=false 인데 결론줄이 「✅ 적절」이었고 pat 이 0(10종에 없는 값)이었다.
  //   D-190 트랙2 에서 해설을 다시 쓰고 pat 을 부여해 두 결함을 함께 없앴다.
  //   ★ S-10 의 「수리가 끝난 뒤」에서 '끝'은 사람 검증까지다(심사관 확정).
  //     게이트가 ⑫축에서 이 3선지를 계속 가리키고 있던 것은 검증 전 안전핀이었고,
  //     gate3 를 통과한 지금이 지울 시점이다.
  ...[
    { qId: 7, num: 2, pat: "R4", tail: "표준적 입장의 '범주 일치'를 '관계에 따른 범주 변동'으로 바꿔 읽은" },
    { qId: 7, num: 5, pat: "R1", tail: "표준적 입장이 부정하는 '피행위자' 지위를 동물에게 부여한" },
    { qId: 8, num: 3, pat: "R3", tail: "<보기>가 배제한 '대표 구성원 → 종 전체' 추론을 그대로 한" },
  ].map((x) => ({
    yk: "2027_9월", setId: "r20279b", qId: x.qId, num: x.num,
    clear: ["_pat_error", "_ok_analysis_mismatch"],
    validation: {
      passed: true,
      resolved: ["PAT_FIELD_MISSING", "ok_analysis_conflict"],
      note: `PAT_FIELD_MISSING 은 pat ${x.pat} 부여로, ok_analysis_conflict 는 해설 재작성`
        + "(D-190 트랙2 · 심사관 승인 문안)으로 해소했다. pat 구분 기준은 "
        + "docs/backlog_pat_criteria.md 참조. 재실행이 아니라 근거를 명시한 갱신이다.",
      updated_by: "D-190 트랙2",
    },
    why: `pat 이 0 에서 ${x.pat} 로 채워졌고, 결론줄이 「❌ ${x.tail} 부적절한 진술 [${x.pat}]」로 ok:false 와 맞아졌다`,
  })),

  // ── D-196 l20279b Q25#3 — 심사관 gate3 통과 뒤 (2026-09-04) ──────────
  //   문학 세트인데 pat 이 R3(독서 계열)이라 도메인 위반 표지가 붙어 있었다.
  //   심사관이 L3(의미 부풀리기)로 확정했고, pat 과 결론줄 라벨을 함께 맞췄다.
  //   해설 본문은 손대지 않았다 — 논지가 이미 「원문에 없는 의미를 덧씌웠다」였다.
  {
    yk: "2027_9월", setId: "l20279b", qId: 25, num: 3,
    clear: ["_pat_error"],
    why: "pat 이 R3 에서 L3 로 확정됐고 결론줄이 「❌ 지문과 어긋나는 부적절한 진술 [L3]」로 맞아졌다. 판정 순서 ① 도메인(문학=L)을 지킨다",
  },
];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const flat = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
let n = 0, bad = false;
console.log(`## 결함 표지 해소 ${APPLY ? "적용" : "DRY-RUN"} — ${SPEC.length}건\n`);

for (const S of SPEC) {
  if (ONLY && S.setId !== ONLY) continue;
  let set = null;
  for (const sec of ["reading", "literature"]) {
    const f = (data[S.yk]?.[sec] || []).find((x) => (x.setId || x.id) === S.setId);
    if (f) { set = f; break; }
  }
  if (!set) { console.log(`  🔴 ${S.yk} ${S.setId} — 세트 없음`); bad = true; continue; }
  const q = (set.questions || []).find((x) => String(x.id) === String(S.qId));
  const c = q && (q.choices || []).find((x) => String(x.num) === String(S.num));
  if (!c) { console.log(`  🔴 ${S.setId} Q${S.qId}#${S.num} — 선지 없음`); bad = true; continue; }

  console.log(`  ${S.yk} ${S.setId} Q${S.qId}#${S.num}`);

  // ★ 수리가 실제로 끝났는지 스스로 확인한다 — 안 끝났으면 아무것도 지우지 않는다
  const a = flat(c.analysis).replace(/\s+$/, "");
  const lastLine = a.split("\n").pop().trim();
  const wantMark = c.ok === false ? "❌" : "✅";
  const badMark = c.ok === false ? "✅" : "❌";
  const checks = [];
  if (S.clear.includes("_pat_error"))
    checks.push([`pat 이 채워졌는가`, !!flat(c.pat).trim(), `pat=${JSON.stringify(flat(c.pat))}`]);
  if (S.clear.includes("_ok_analysis_mismatch"))
    checks.push([`결론 기호가 ok 와 맞는가`, lastLine.includes(wantMark) && !lastLine.includes(badMark),
      `ok=${c.ok} · 결론줄 ${JSON.stringify(lastLine.slice(0, 40))}`]);
  for (const [label, ok, detail] of checks) {
    console.log(`     ${ok ? "✅" : "🔴"} 선행 수리 확인 — ${label}: ${detail}`);
    if (!ok) bad = true;
  }
  if (bad) { console.log(`     수리가 끝나지 않았다 — 표지를 지우지 않는다`); continue; }

  for (const k of S.clear) {
    if (!(k in c)) { console.log(`     ⚠ ${k} 가 이미 없다, 건너뜀`); continue; }
    console.log(`     ${k} 제거 — 기존 값:`);
    console.log(`        ${JSON.stringify(c[k]).slice(0, 220)}`);
    if (APPLY) delete c[k];
    n++;
  }

  if (S.validation) {
    const cur = c._discriminative_validation;
    if (!cur) console.log(`     ⚠ _discriminative_validation 이 없다 — 갱신 건너뜀`);
    else {
      console.log(`     _discriminative_validation 갱신 (지우지 않는다 — 일상 산출물):`);
      console.log(`        기존: ${JSON.stringify(cur).slice(0, 180)}`);
      const next = { ...cur, ...S.validation };
      console.log(`        갱신: ${JSON.stringify(next).slice(0, 260)}`);
      if (APPLY) c._discriminative_validation = next;
      n++;
    }
  }
  console.log(`     근거: ${S.why}`);
}

if (bad) { console.log(`\n🔴 검증 실패가 있다 — 아무것도 쓰지 않았다`); process.exit(1); }
if (APPLY && n) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · ${n}건`);
  // 되읽기 검산 — S-02
  const back = JSON.parse(fs.readFileSync(DATA, "utf8"));
  let miss = 0;
  for (const S of SPEC) {
    if (ONLY && S.setId !== ONLY) continue;
    let set = null;
    for (const sec of ["reading", "literature"]) {
      const f = (back[S.yk]?.[sec] || []).find((x) => (x.setId || x.id) === S.setId);
      if (f) { set = f; break; }
    }
    const q = (set?.questions || []).find((x) => String(x.id) === String(S.qId));
    const c = q && (q.choices || []).find((x) => String(x.num) === String(S.num));
    if (!c) continue;
    for (const k of S.clear)
      if (k in c) { console.log(`  🔴 되읽기 실패: ${S.setId} Q${S.qId}#${S.num} ${k} 잔존`); miss++; }
    if (S.validation && c._discriminative_validation?.passed !== S.validation.passed) {
      console.log(`  🔴 되읽기 실패: ${S.setId} Q${S.qId}#${S.num} _discriminative_validation.passed`); miss++;
    }
  }
  if (miss) { console.log(`\n🔴 되읽기에서 ${miss}건이 어긋났다`); process.exit(1); }
  console.log(`  되읽기 검산 통과`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
