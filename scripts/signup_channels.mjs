/* global process */

// scripts/signup_channels.mjs — 채널별 가입자 수 (발주 F-69 ④)
//
//   사용: node scripts/signup_channels.mjs
//         node scripts/signup_channels.mjs --since 2026-09-01
//         node scripts/signup_channels.mjs --detail        캠페인까지 쪼개서
//
//   유입 정보는 signup_attribution 테이블에 가입 1회만 들어간다(src/attribution.js).
//   ★ 조회 전용이다. 아무것도 쓰지 않는다.
//   ★ service role 은 RLS 를 넘으므로 상시 엔드포인트로 만들지 않는다.
//     실행 후 키는 지운다(창을 닫으면 사라진다).
//
//   PowerShell:
//     $env:SUPABASE_URL = "https://<project>.supabase.co"
//     $env:SUPABASE_SERVICE_ROLE_KEY = "<service_role 키>"
//     node scripts/signup_channels.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DETAIL = process.argv.includes("--detail");
const SINCE = (() => {
  const i = process.argv.indexOf("--since");
  return i >= 0 ? process.argv[i + 1] : null;
})();
const PAGE = 1000;

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
    console.error('   PowerShell:  $env:SUPABASE_SERVICE_ROLE_KEY = "<키>"');
    process.exitCode = 1;
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const label = (v) => (v == null || v === "" ? "(없음)" : String(v));

async function main() {
  const db = admin();
  if (!db) return;

  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let q = db
      .from("signup_attribution")
      .select("user_id, utm_source, utm_medium, utm_campaign, referrer, created_at")
      .order("user_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (SINCE) q = q.gte("created_at", SINCE);
    const { data, error } = await q;
    if (error) throw new Error(`signup_attribution 조회 실패: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  console.log(
    `\n## 가입 유입 기록 ${rows.length}건${SINCE ? ` (${SINCE} 이후)` : ""}`,
  );
  if (rows.length === 0) {
    console.log("   기록이 없다. 아직 UTM 링크로 가입한 사람이 없거나 테이블이 비어 있다.");
    return;
  }

  const key = (r) =>
    DETAIL
      ? `${label(r.utm_source)} / ${label(r.utm_medium)} / ${label(r.utm_campaign)}`
      : `${label(r.utm_source)} / ${label(r.utm_medium)}`;

  const counts = new Map();
  for (const r of rows) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const head = DETAIL ? "source / medium / campaign" : "source / medium";
  console.log(`\n   ${head.padEnd(46)} 가입자   비중`);
  for (const [k, n] of sorted) {
    const pctStr = ((n / rows.length) * 100).toFixed(1) + "%";
    console.log(`   ${k.padEnd(46)} ${String(n).padStart(5)}   ${pctStr}`);
  }

  const withUtm = rows.filter((r) => r.utm_source != null).length;
  console.log(
    `\n   UTM 있는 가입 ${withUtm}건 · 없는 가입 ${rows.length - withUtm}건`,
  );
  console.log(
    "   ※ UTM 없이 온 가입(직접 방문·검색)은 (없음)으로 묶인다. 정상이다.",
  );

  console.log(`\n## 같은 집계를 SQL 한 줄로 (Supabase SQL Editor)`);
  console.log(
    "   select coalesce(utm_source,'(없음)') src, coalesce(utm_medium,'(없음)') med," +
      " count(*) n from signup_attribution group by 1,2 order by n desc;",
  );
}

main().catch((e) => {
  console.error("🔴", e.message);
  process.exitCode = 1;
});
