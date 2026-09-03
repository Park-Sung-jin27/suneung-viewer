/* global process */

// api/pro-data.js — 유료 데이터(해설·근거 형광펜) 전달 (발주 F-19)
//
//   GET /api/pro-data?year=<yearKey>&set=<setId>
//   Authorization: Bearer <supabase access_token>
//
//   ① 토큰 없음                    → 401
//   ② auth.getUser 실패            → 401
//   ③ service role 로 이용권 조회  → 미보유·만료 → 402 { reason: "no_pass" }
//   ④ 통과 → data-pro/<yearKey>.json 에서 해당 세트만 잘라 반환
//
//   🔴 Referer / Origin 을 판단 근거로 쓰지 않는다.
//      F-8 Edge Middleware 가 그 방식이고, D-67 에서 헤더를 직접 붙여
//      8.5MB 를 받아냈다. 그것은 인증이 아니다.
//      판단 근거는 Supabase 가 서명한 JWT 와 DB 의 이용권 행 두 가지뿐이다.
//
//   ★ 인증 헬퍼는 api/payment-confirm.js 의 검증된 패턴을 그대로 쓴다.
//
//   필요 env: SUPABASE_URL(또는 VITE_) · SUPABASE_ANON_KEY(또는 VITE_)
//            · SUPABASE_SERVICE_ROLE_KEY
//   ※ data-pro/ 는 public/ 밖이라 정적 URL 이 없다. 서버 함수만 읽는다.
//     Vercel 번들 포함은 vercel.json 의 functions.includeFiles 로 지정한다.

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
// 유입 회차 무료 개방 — 대표 확정 2026-09-03 (F-49) · 정본 통합 (F-50)
//   로그인(①②)은 그대로 요구하고, 이용권 검사(③)만 건너뛴다.
//   그 외 회차는 기존 402 흐름을 그대로 유지한다.
//   ★ 목록을 여기에 복제하지 않는다 — src/freeAccess.js 가 단일 정본이다.
import { isFreeProYear } from "../src/freeAccess.js";

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    throw new Error("Supabase configuration missing");
  }
  return { supabaseUrl, anonKey, serviceKey };
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function getAuthedUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const { supabaseUrl, anonKey } = getSupabaseConfig();
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return data.user ?? null;
}

// 이용권 판정 — is_pro() 와 같은 조건을 서버에서 직접 확인한다.
//   plan='pro' · status='active' · (expires_at IS NULL OR expires_at > now)
//   ★ 프론트의 isPro 는 화면 표시용이다. 여기서만 접근을 허가한다.
async function hasActivePass(userId) {
  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from("subscriptions")
    .select("plan, status, expires_at")
    .eq("user_id", userId)
    .limit(1);
  if (error) {
    console.warn("[/api/pro-data] subscription 조회 실패", error.message);
    return { ok: false, reason: "lookup_failed" };
  }
  const row = data?.[0];
  if (!row) return { ok: false, reason: "no_pass" };
  if (row.plan !== "pro" || row.status !== "active")
    return { ok: false, reason: "no_pass" };
  if (row.expires_at && new Date(row.expires_at) <= new Date())
    return { ok: false, reason: "no_pass" };
  return { ok: true };
}

// yearKey / setId 는 파일 경로에 들어간다. 경로 탈출을 차단한다.
//   (yearKey 는 한글·숫자·밑줄 조합이므로 구분자만 거른다)
function isSafeSegment(v) {
  return (
    typeof v === "string" &&
    v.length > 0 &&
    v.length < 64 &&
    !v.includes("/") &&
    !v.includes("\\") &&
    !v.includes("..") &&
    !v.includes("\0")
  );
}

function readProYear(yearKey) {
  const file = path.join(process.cwd(), "data-pro", `${yearKey}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  // 유료 자산이다. 어떤 경로에서도 캐시되지 않게 한다.
  res.setHeader("Cache-Control", "private, no-store");

  try {
    // ①② 인증 — 토큰 부재와 검증 실패를 구분하지 않는다(정보 노출 최소화)
    const user = await getAuthedUser(req);
    if (!user) return res.status(401).json({ error: "Login required" });

    // ③ 이용권 — 유입 개방 회차(F-49)는 로그인만으로 통과시킨다.
    if (!isFreeProYear(req.query?.year)) {
      const pass = await hasActivePass(user.id);
      if (!pass.ok) {
        return res
          .status(402)
          .json({ error: "Pass required", reason: "no_pass" });
      }
    }

    // ④ 입력 검증 후 해당 세트만 절단
    const year = req.query?.year;
    const set = req.query?.set;
    if (!isSafeSegment(year) || !isSafeSegment(set)) {
      return res.status(400).json({ error: "Invalid year or set" });
    }

    const yearData = readProYear(year);
    if (!yearData) return res.status(404).json({ error: "Year not found" });

    const setData = yearData.sets?.[set];
    if (!setData) return res.status(404).json({ error: "Set not found" });

    return res.status(200).json({ yearKey: year, setId: set, ...setData });
  } catch (e) {
    console.error("[/api/pro-data]", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
