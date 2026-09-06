/* global process */

// scripts/backfill_answer_pat.mjs — user_answers.pat 백필 + 잔여 null 분류 (발주 F-65)
//
//   사용: node scripts/backfill_answer_pat.mjs            조회·분류만 (기본)
//         node scripts/backfill_answer_pat.mjs --apply    실제 UPDATE
//
//   배경: F-61 이전에는 클라이언트가 pat 을 보냈는데, pat 은 pro 필드라
//     무료 계정 브라우저에는 없었다. 그래서 오답의 pat 이 null 로 쌓였다.
//     수도관은 F-61(/api/answer-pat)이 고쳤고, 이 스크립트는 이미 샌 물을 채운다.
//
//   ★ 일회성 로컬 도구다. 상시 엔드포인트로 만들지 않는다 — service role 은
//     RLS 를 넘는 권한이라 공격면을 남기면 안 된다(발주 F-65).
//   ★ 실행 후 .env.local(키)은 지운다. 스크립트만 남긴다.
//
//   조회 원본은 data-source/all_data_204.json 이다. data-pro/ 는 LIVE 세트만
//   담으므로 비노출 세트를 푼 기록(마스터 검수 등)을 못 채운다. 원본은 전부 있다.
//
//   잔여 null 분류 (발주 F-65 2단계)
//     ① 기록 결손  — positive 발문 오답인데 null. 백필로 채워졌어야 한다.
//                     positive 는 정답이 ok===true 이므로 오답 선지는 ok===false 이고,
//                     그 선지에는 pat 이 붙어 있어야 한다. 남으면 데이터 결손이다.
//     ② negative 오판 — negative 발문 오답. 정답이 ok===false 이므로 오답 선지는
//                     ok===true, 즉 결함이 없는 선지다. pat 이 원래 없다(정상).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
// 3분류 규칙·좌표 조회는 src/patternClassify.js 가 정본이다 (발주 F-65 ③).
//   화면(PatternReport)과 같은 함수를 쓴다 — 규칙이 갈리면 화면과 DB 가
//   다른 말을 하게 된다.
import {
  findChoice,
  classifyWrong,
} from "../src/patternClassify.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const SELFTEST = process.argv.includes("--selftest");
const DIAGNOSE = process.argv.includes("--diagnose");
// 발주 F-65 후속 ②: question_type 결손 채움. pat 백필과 판정을 분리한다
//   — pat 은 이미 승인됐고 qt 는 조회 확인 뒤에 승인되므로 플래그를 따로 둔다.
const APPLY_QT = process.argv.includes("--apply-qt");
const PAGE = 1000;

// .env.local (vercel env pull) 을 읽는다. 이미 환경변수가 있으면 그쪽이 우선.
function loadEnvLocal() {
  const f = path.join(ROOT, ".env.local");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

function admin() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("🔴 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다.");
    console.error("   PowerShell:  $env:SUPABASE_SERVICE_ROLE_KEY = \"<키>\"");
    // process.exit 은 열린 핸들을 끊어 Windows 에서 libuv 경고를 낸다.
    //   종료 코드만 세우고 자연히 끝나게 둔다.
    process.exitCode = 1;
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchAllWrong(db) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("user_answers")
      .select(
        "id, user_id, year_key, set_id, question_id, choice_num, pat, question_type, is_correct, answered_at",
      )
      .eq("is_correct", false)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`user_answers 조회 실패: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

// 진단 출력 한 줄 — user_id 는 앞 8자만(식별은 되고 전체는 남기지 않는다)
function rowLine(r, extra = "") {
  const at = r.answered_at ? String(r.answered_at).slice(0, 10) : "날짜없음";
  const qt = r.question_type ?? "(null)";
  return (
    `${String(r.user_id).slice(0, 8)} ${at} ${r.year_key} ${r.set_id} ` +
    `q${r.question_id} c${r.choice_num} qt=${qt}${extra}`
  );
}

function pct(n, d) {
  return d === 0 ? "0.0%" : ((n / d) * 100).toFixed(1) + "%";
}

// DB 없이 조회·분류 로직만 실증한다(service role 이 Sensitive 라 되읽기가 안 되는
//   환경에서도 스크립트가 맞는지 보이기 위한 것). 원본에서 실제 좌표를 뽑아
//   positive/negative 별로 오답 선지의 pat 유무를 센다.
function selftest(source) {
  let posWrongWithPat = 0, posWrongNoPat = 0;
  let negWrongWithPat = 0, negWrongNoPat = 0;
  let lookupOk = 0, lookupFail = 0;
  const posNoPatList = [];
  const negHasPatList = [];
  for (const [yearKey, yd] of Object.entries(source)) {
    for (const sec of ["reading", "literature"]) {
      for (const set of yd[sec] ?? []) {
        for (const q of set.questions ?? []) {
          const qt = q.questionType ?? "negative";
          for (const c of q.choices ?? []) {
            // 그 선지를 골랐다면 오답이 되는가?
            const wrong = qt === "positive" ? c.ok !== true : c.ok !== false;
            if (!wrong) continue;
            const hit = findChoice(source, yearKey, set.id, q.id, c.num);
            if (hit && hit.choice === c) lookupOk += 1; else lookupFail += 1;
            const has = typeof c.pat === "string" && c.pat.length > 0;
            const where = `${yearKey} ${set.id} q${q.id} c${c.num}`;
            if (qt === "positive") {
              if (has) posWrongWithPat++;
              else { posWrongNoPat++; posNoPatList.push(where); }
            } else {
              if (has) { negWrongWithPat++; negHasPatList.push(`${where} → ${c.pat}`); }
              else negWrongNoPat++;
            }
          }
        }
      }
    }
  }
  console.log("\n## 자체 시험 — 원본만으로 (DB 미접속)");
  console.log(`   좌표 조회 성공 ${lookupOk} · 실패 ${lookupFail}`);
  console.log(`   positive 발문의 오답 선지: pat 있음 ${posWrongWithPat} · 없음 ${posWrongNoPat}  ← 없음이 곧 ① 후보`);
  console.log(`   negative 발문의 오답 선지: pat 있음 ${negWrongWithPat} · 없음 ${negWrongNoPat}  ← 없음이 정상(②)`);
  if (posNoPatList.length > 0) {
    console.log(`\n   ① 가 남을 수 있는 자리 — positive 오답 선지인데 원본에 pat 이 없는 곳:`);
    for (const x of posNoPatList) console.log(`     ${x}`);
  }
  // 3분류 규칙 자체를 실제 함수로 돌려 본다 — 원본에서 좌표를 골라 합성 행을 만든다.
  //   시뮬레이션이 아니라 화면·백필이 쓸 classify() 를 그대로 부른다.
  const probe = [];
  outer: for (const [yk, yd] of Object.entries(source)) {
    for (const sec of ["reading", "literature"]) {
      for (const set of yd[sec] ?? []) {
        for (const q of set.questions ?? []) {
          if ((q.questionType ?? "negative") !== "negative") continue;
          const okTrue = (q.choices ?? []).find((c) => c.ok === true);
          const okFalse = (q.choices ?? []).find((c) => c.ok === false);
          if (!okTrue || !okFalse) continue;
          const base = { year_key: yk, set_id: set.id, question_id: q.id };
          probe.push([
            "pat 있음 → 패턴",
            { ...base, choice_num: okTrue.num, pat: "R1", question_type: "negative" },
            "패턴",
          ]);
          probe.push([
            "pat null · negative · 고른 선지 ok=true → 실수",
            { ...base, choice_num: okTrue.num, pat: null, question_type: "negative" },
            "실수",
          ]);
          probe.push([
            "pat null · negative · 고른 선지 ok=false → 미분류",
            { ...base, choice_num: okFalse.num, pat: null, question_type: "negative" },
            "미분류",
          ]);
          probe.push([
            "pat null · qt null → 미분류",
            { ...base, choice_num: okTrue.num, pat: null, question_type: null },
            "미분류",
          ]);
          probe.push([
            "원본에 좌표 없음(s세트) → 미분류",
            { year_key: "2026수능", set_id: "s1", question_id: 1, choice_num: 1, pat: null, question_type: "negative" },
            "미분류",
          ]);
          break outer;
        }
      }
    }
  }
  console.log(`\n   [3분류 규칙 음성/양성 시험] classifyWrong() 직접 호출`);
  let pass = 0;
  for (const [name, row, want] of probe) {
    const got = classifyWrong(row, source);
    const okMark = got === want ? "✔" : "🔴";
    if (got === want) pass += 1;
    console.log(`     ${okMark} ${name.padEnd(42)} 기대=${want} 실제=${got}`);
  }
  console.log(`     통과 ${pass}/${probe.length}`);

  if (negHasPatList.length > 0) {
    console.log(`\n   ⚠ negative 오답 선지인데 pat 이 있는 곳 (pat/ok 불일치 ${negHasPatList.length}건, 앞 20):`);
    for (const x of negHasPatList.slice(0, 20)) console.log(`     ${x}`);
  }
}

async function main() {
  const source = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data-source/all_data_204.json"), "utf8"),
  );
  if (SELFTEST) {
    selftest(source);
    return;
  }
  const db = admin();
  if (!db) return;

  const wrong = await fetchAllWrong(db);
  console.log(`\n## 대상 — user_answers 의 오답(is_correct=false) ${wrong.length}건`);
  console.log(`   그중 pat null: ${wrong.filter((r) => r.pat == null).length}건\n`);

  // ── 백필 ────────────────────────────────────────────────
  const fill = [];     // 채울 수 있는 행
  const notFound = []; // 좌표 자체를 원본에서 못 찾은 행
  const noPat = [];    // 좌표는 찾았으나 원본 선지에 pat 이 없는 행
  for (const r of wrong) {
    if (r.pat != null) continue;
    const hit = findChoice(source, r.year_key, r.set_id, r.question_id, r.choice_num);
    if (!hit) {
      notFound.push(r);
      continue;
    }
    const p = hit.choice.pat;
    if (!(typeof p === "string" && p.length > 0)) {
      noPat.push({ row: r, ok: hit.choice.ok });
    }
    if (typeof p === "string" && p.length > 0) {
      // 결함 쪽 선지(ok===false)인가. 아니면 ② 로 분류돼야 할 행에 pat 이 붙는다 —
      //   원본의 pat/ok 불일치다. 채우되 건수를 따로 보고한다(발주 판단 사항).
      fill.push({ row: r, pat: p, defectSide: hit.choice.ok === false });
    }
  }

  const nullRows = wrong.filter((r) => r.pat == null).length;
  const oddSide = fill.filter((f) => !f.defectSide);
  console.log(`## 1단계 백필 — pat null ${nullRows}건의 갈래 (셋은 서로 겹치지 않는다)`);
  console.log(`   (a) 채울 수 있는 행          : ${fill.length}건`);
  console.log(`       └ 그 ${fill.length}건 중 결함 쪽(ok=false) ${fill.length - oddSide.length} · 아닌 것 ${oddSide.length}`);
  console.log(`   (b) 좌표를 원본에서 못 찾음  : ${notFound.length}건`);
  console.log(`   (c) 좌표는 찾았으나 pat 없음 : ${noPat.length}건`);
  console.log(`   합계 ${fill.length}+${notFound.length}+${noPat.length}=${fill.length + notFound.length + noPat.length} (pat null ${nullRows} 과 같아야 한다)`);
  if (oddSide.length > 0) {
    console.log(`   ⚠ 아닌 것 ${oddSide.length}건은 원본의 pat/ok 불일치다. 채우면 ② 가 패턴으로 잡힌다:`);
    for (const f of oddSide.slice(0, 20)) {
      const r = f.row;
      console.log(`     ${r.year_key} ${r.set_id} q${r.question_id} c${r.choice_num} → ${f.pat}`);
    }
  }
  if (!APPLY) {
    console.log(`   (조회 모드 — 쓰지 않았다. --apply 로 실행하면 UPDATE 한다)`);
  } else {
    let ok = 0;
    let fail = 0;
    for (const f of fill) {
      const { error } = await db
        .from("user_answers")
        .update({ pat: f.pat })
        .eq("id", f.row.id);
      if (error) {
        fail += 1;
        console.log(`   🔴 UPDATE 실패 id=${f.row.id}: ${error.message}`);
      } else {
        ok += 1;
        f.row.pat = f.pat; // 이후 분류에 반영
      }
    }
    console.log(`   UPDATE 성공 ${ok}건 · 실패 ${fail}건`);
  }

  // ── qt 백필 (발주 F-65 후속 ②) ─────────────────────────
  //   question_type 컬럼은 2026-06-17(967c068)에 추가됐다. 그 이전 기록은
  //   전부 null 이다. 원본에 좌표가 있으면 원본의 questionType 으로 채운다.
  //   ★ "negative" 기본값으로 일괄 채우지 않는다(발주 금지). 원본 값만 쓴다.
  //     원본 문항에 questionType 이 없으면 채우지 않고 건별로 보고한다.
  const qtFill = [];     // 채울 수 있는 행 { row, qt }
  const qtNoCoord = [];  // 좌표가 원본에 없어 대상 외 (s세트 등)
  const qtNoSource = []; // 좌표는 있으나 원본에 questionType 이 없는 행
  for (const r of wrong) {
    if (r.question_type != null) continue;
    const hit = findChoice(source, r.year_key, r.set_id, r.question_id, r.choice_num);
    if (!hit) {
      qtNoCoord.push(r);
      continue;
    }
    const qt = hit.question.questionType;
    if (typeof qt === "string" && qt.length > 0) qtFill.push({ row: r, qt });
    else qtNoSource.push(r);
  }

  console.log(
    `\n## qt 백필 — question_type null ${qtFill.length + qtNoCoord.length + qtNoSource.length}건의 갈래`,
  );
  console.log(`   (a) 원본 값으로 채울 수 있음 : ${qtFill.length}건`);
  console.log(`   (b) 좌표가 원본에 없음(대상 외): ${qtNoCoord.length}건`);
  console.log(`   (c) 원본에 questionType 없음 : ${qtNoSource.length}건`);
  if (qtFill.length > 0) {
    console.log(`\n   [전건] 현재 null → 채울 값`);
    for (const f of qtFill) console.log(`     ${rowLine(f.row)}  →  ${f.qt}`);
  }
  if (qtNoCoord.length > 0) {
    console.log(`\n   [대상 외] 좌표 없음`);
    for (const r of qtNoCoord) console.log(`     ${rowLine(r)}`);
  }
  if (qtNoSource.length > 0) {
    console.log(`\n   [보류] 원본에 questionType 이 없어 채우지 않는다`);
    for (const r of qtNoSource) console.log(`     ${rowLine(r)}`);
  }
  if (APPLY_QT) {
    let ok = 0;
    let fail = 0;
    for (const f of qtFill) {
      const { error } = await db
        .from("user_answers")
        .update({ question_type: f.qt })
        .eq("id", f.row.id);
      if (error) {
        fail += 1;
        console.log(`   🔴 qt UPDATE 실패 id=${f.row.id}: ${error.message}`);
      } else {
        ok += 1;
        f.row.question_type = f.qt;
      }
    }
    console.log(`   qt UPDATE 성공 ${ok}건 · 실패 ${fail}건`);
  } else {
    console.log(`   (조회 모드 — 쓰지 않았다. --apply-qt 로 실행하면 UPDATE 한다)`);
  }

  // ── 3분류 예상 분포 (발주 F-65 ③ 규칙) ──────────────────
  //   pat 백필과 qt 백필이 둘 다 적용됐다고 가정한 값을 함께 낸다.
  //   조회 모드에서는 메모리상으로만 반영해 계산한다(DB 는 안 건드린다).
  const projected = wrong.map((r) => ({ ...r }));
  const byId = new Map(projected.map((r) => [r.id, r]));
  for (const f of fill) { const t = byId.get(f.row.id); if (t) t.pat = f.pat; }
  for (const f of qtFill) { const t = byId.get(f.row.id); if (t) t.question_type = f.qt; }
  const now3 = { 패턴: 0, 실수: 0, 미분류: 0 };
  const next3 = { 패턴: 0, 실수: 0, 미분류: 0 };
  for (const r of wrong) now3[classifyWrong(r, source)] += 1;
  for (const r of projected) next3[classifyWrong(r, source)] += 1;
  console.log(`\n## 3분류 (발주 ③ 규칙) — 현재 → 백필 후 예상`);
  console.log(`   ⑴ 패턴 오답   ${now3["패턴"]} → ${next3["패턴"]}`);
  console.log(`   ⑵ 판단 실수형 ${now3["실수"]} → ${next3["실수"]}`);
  console.log(`   ⑶ 미분류      ${now3["미분류"]} → ${next3["미분류"]}`);
  const sNow = now3["패턴"] + now3["실수"] + now3["미분류"];
  const sNext = next3["패턴"] + next3["실수"] + next3["미분류"];
  console.log(`   합계 검산: ${sNow} / ${sNext} (오답 총수 ${wrong.length} 과 둘 다 같아야 한다)`);

  // ── 2단계 잔여 null 분류 ────────────────────────────────
  const remain = wrong.filter((r) => r.pat == null);
  const g1 = []; // ① 기록 결손 (positive)
  const g2 = []; // ② negative 오판
  const gUnknown = []; // questionType 결손
  for (const r of remain) {
    const qt = r.question_type;
    if (qt === "positive") g1.push(r);
    else if (qt === "negative") g2.push(r);
    else gUnknown.push(r);
  }
  console.log(
    APPLY
      ? `\n## 2단계 백필 후 잔여 null — 총 ${remain.length}건`
      : `\n## 2단계 현재 null 분류 (백필 전 — 조회 모드다) — 총 ${remain.length}건`,
  );
  console.log(`   ① 기록 결손(positive 오답인데 null): ${g1.length}건`);
  console.log(`   ② negative 오판(정상 — pat 원래 없음): ${g2.length}건`);
  console.log(`   ─ questionType 결손: ${gUnknown.length}건`);

  if (g1.length > 0) {
    console.log(`\n   ① 건별 내역 (발주 지시 — 남으면 건별 보고)`);
    for (const r of g1) {
      const hit = findChoice(source, r.year_key, r.set_id, r.question_id, r.choice_num);
      const why = !hit
        ? "원본에 좌표 없음"
        : hit.choice.pat == null
          ? `원본 선지에 pat 없음 (ok=${JSON.stringify(hit.choice.ok)})`
          : "원인 불명";
      console.log(
        `     ${r.year_key} ${r.set_id} q${r.question_id} c${r.choice_num} — ${why}`,
      );
    }
  }

  // ── 진단 (발주 F-65 후속 설명 3건) ──────────────────────
  if (DIAGNOSE) {
    console.log(
      `\n## 진단 A — questionType 결손 ${gUnknown.length}건 (question_type 컬럼은 2026-06-17 967c068 에 추가됐다)`,
    );
    for (const r of gUnknown) console.log(`     ${rowLine(r)}`);

    console.log(`\n## 진단 B — 좌표를 원본에서 못 찾은 ${notFound.length}건`);
    for (const r of notFound) console.log(`     ${rowLine(r)}`);

    console.log(`\n## 진단 C — 채울 수 있는 ${fill.length}건 (백필 대상)`);
    for (const f of fill) {
      console.log(
        `     ${rowLine(f.row, ` → pat=${f.pat} ok=${JSON.stringify(f.defectSide ? false : "not-false")}`)}`,
      );
    }

    console.log(`\n## 진단 D — 좌표는 찾았으나 원본 선지에 pat 이 없는 ${noPat.length}건`);
    for (const x of noPat.slice(0, 40)) {
      console.log(`     ${rowLine(x.row, ` ok=${JSON.stringify(x.ok)}`)}`);
    }

    // 옛 행 가설 검증 — question_type 결손이 컬럼 추가 이전 행인가
    const CUT = "2026-06-17";
    const before = gUnknown.filter(
      (r) => r.answered_at && String(r.answered_at).slice(0, 10) < CUT,
    ).length;
    console.log(
      `\n## 진단 E — questionType 결손 ${gUnknown.length}건 중 ${CUT} 이전 기록: ${before}건 · 이후: ${gUnknown.length - before}건`,
    );
  }

  // ── 3단계 분포 ──────────────────────────────────────────
  const byUser = new Map();
  for (const r of wrong) {
    if (!byUser.has(r.user_id)) {
      byUser.set(r.user_id, { wrong: 0, withPat: 0, pats: new Map(), g1: 0, g2: 0 });
    }
    const u = byUser.get(r.user_id);
    u.wrong += 1;
    if (r.pat != null) {
      u.withPat += 1;
      u.pats.set(r.pat, (u.pats.get(r.pat) ?? 0) + 1);
    } else if (r.question_type === "positive") u.g1 += 1;
    else if (r.question_type === "negative") u.g2 += 1;
  }

  console.log(`\n## 3단계 학생별 분포 — 오답이 있는 학생 ${byUser.size}명`);
  console.log(
    `   ${"user_id(앞8)".padEnd(12)} ${"오답".padStart(5)} ${"패턴".padStart(5)} ${"①".padStart(4)} ${"②".padStart(4)}  패턴별 발생`,
  );
  const users = [...byUser.entries()].sort((a, b) => b[1].wrong - a[1].wrong);
  for (const [uid, u] of users) {
    const dist = [...u.pats.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([p, n]) => `${p}:${n}`)
      .join(" ");
    console.log(
      `   ${String(uid).slice(0, 8).padEnd(12)} ${String(u.wrong).padStart(5)} ${String(u.withPat).padStart(5)} ${String(u.g1).padStart(4)} ${String(u.g2).padStart(4)}  ${dist}`,
    );
  }

  // 패턴 발생 횟수 분포 — 임계 판단용 (학생×패턴 쌍의 발생 횟수 히스토그램)
  const hist = new Map();
  for (const [, u] of byUser) {
    for (const [, n] of u.pats) hist.set(n, (hist.get(n) ?? 0) + 1);
  }
  const pairs = [...hist.entries()].sort((a, b) => a[0] - b[0]);
  const totalPairs = pairs.reduce((a, [, c]) => a + c, 0);
  console.log(`\n## 패턴 발생 횟수 분포 (학생×패턴 쌍 ${totalPairs}개)`);
  let cum = 0;
  for (const [n, c] of pairs) {
    cum += c;
    console.log(
      `   ${String(n).padStart(3)}회 발생: ${String(c).padStart(4)}쌍  (누적 ${pct(cum, totalPairs)})`,
    );
  }

  console.log(
    `\n## 전체 요약\n   오답 ${wrong.length} · 패턴 있음 ${wrong.filter((r) => r.pat != null).length} (${pct(wrong.filter((r) => r.pat != null).length, wrong.length)})` +
      ` · ① ${g1.length} · ② ${g2.length} · questionType 결손 ${gUnknown.length}`,
  );
}

main().catch((e) => {
  console.error("🔴", e.message);
  process.exitCode = 1;
});
