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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const SELFTEST = process.argv.includes("--selftest");
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
    console.error("   vercel env pull .env.local 로 받은 뒤 다시 실행한다.");
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// 좌표 → 선지. api/_sourceData.js 의 findChoice 와 같은 규율
//   (setId 는 회차 간 충돌하므로 yearKey 를 반드시 함께 본다).
function findChoice(source, yearKey, setId, questionId, choiceNum) {
  const yd = source?.[yearKey];
  if (!yd) return null;
  for (const section of ["reading", "literature"]) {
    const set = (yd[section] ?? []).find((s) => s.id === setId);
    if (!set) continue;
    const q = (set.questions ?? []).find(
      (x) => String(x.id) === String(questionId),
    );
    if (!q) return null;
    const c = (q.choices ?? []).find((x) => Number(x.num) === Number(choiceNum));
    return c ? { set, question: q, choice: c } : null;
  }
  return null;
}

async function fetchAllWrong(db) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("user_answers")
      .select(
        "id, user_id, year_key, set_id, question_id, choice_num, pat, question_type, is_correct",
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

  const wrong = await fetchAllWrong(db);
  console.log(`\n## 대상 — user_answers 의 오답(is_correct=false) ${wrong.length}건`);
  console.log(`   그중 pat null: ${wrong.filter((r) => r.pat == null).length}건\n`);

  // ── 백필 ────────────────────────────────────────────────
  const fill = [];   // { row, pat }
  const notFound = []; // 원본에서 좌표를 못 찾은 행
  for (const r of wrong) {
    if (r.pat != null) continue;
    const hit = findChoice(source, r.year_key, r.set_id, r.question_id, r.choice_num);
    if (!hit) {
      notFound.push(r);
      continue;
    }
    const p = hit.choice.pat;
    if (typeof p === "string" && p.length > 0) {
      // 결함 쪽 선지(ok===false)인가. 아니면 ② 로 분류돼야 할 행에 pat 이 붙는다 —
      //   원본의 pat/ok 불일치다. 채우되 건수를 따로 보고한다(발주 판단 사항).
      fill.push({ row: r, pat: p, defectSide: hit.choice.ok === false });
    }
  }

  console.log(`## 1단계 백필`);
  console.log(`   채울 수 있는 행: ${fill.length}건`);
  console.log(`   원본에서 좌표를 못 찾은 행: ${notFound.length}건`);
  const oddSide = fill.filter((f) => !f.defectSide);
  console.log(
    `   ─ 그중 결함 쪽 선지(ok=false): ${fill.length - oddSide.length}건 · 아닌 것: ${oddSide.length}건`,
  );
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
  console.log(`\n## 2단계 잔여 null 분류 — 총 ${remain.length}건`);
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
  process.exit(1);
});
