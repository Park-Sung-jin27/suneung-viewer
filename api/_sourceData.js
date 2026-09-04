/* global process, Buffer */

// api/_sourceData.js — 서버 전용 원본 조회 · 인증 · 발급 토큰 (발주 F-62)
//
//   훈련 출제와 코칭 해설은 pro 필드(analysis · pat · cs_ids)를 써야 한다.
//   그 필드는 브라우저로 내려보내지 않는다 — 서버가 여기서 읽는다.
//
//   ★ 원본 1개만 읽는다. free 조각(지문·선지 텍스트)과 pro 필드가 한 파일에
//     같이 있어 조각 두 벌을 번들에 넣지 않아도 된다.
//     발주 F-60 ⓓ 로 원본이 data-source/ 로 옮겨지면 SOURCE_REL 한 줄과
//     vercel.json 의 includeFiles 만 바꾼다.
//
//   ★ 콜드 스타트에 한 번만 파싱하고 모듈 스코프에 둔다. 웜 인스턴스는 재사용한다.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SOURCE_REL = "public/data/all_data_204.json";

let _source = null;
export function loadSource() {
  if (_source) return _source;
  const file = path.join(process.cwd(), SOURCE_REL);
  if (!fs.existsSync(file)) return null;
  _source = JSON.parse(fs.readFileSync(file, "utf8"));
  return _source;
}

export function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("Supabase configuration missing");
  return { supabaseUrl, anonKey };
}

export function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

// 사용자 JWT 를 단 클라이언트. 이후 모든 쿼리에 RLS 가 걸린다.
//   ★ service role 을 쓰지 않는다 — 남의 답안을 읽을 수 있는 권한을 만들지 않는다.
export function userClient(token) {
  const { supabaseUrl, anonKey } = getSupabaseConfig();
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// { user, client } 또는 null. 로그인만 본다(이용권 불요 — 발주 F-62 인증 수준).
export async function authenticate(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const client = userClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return { user: data.user, client };
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

// ── 발급 토큰 ────────────────────────────────────────────────
//   /api/training-item 이 어떤 선지를 냈는지 서명해 둔다.
//   /api/training-reveal 은 이 서명이 맞을 때만 해설을 준다.
//   ★ 없으면 좌표(회차·세트·문항·선지)를 순회하는 것만으로 해설 7,770건이
//     통째로 나간다. 훈련 문항은 학생이 푼 적 없는 문항이라 user_answers 로는
//     본인 검증이 안 된다 — 그래서 발급 사실 자체를 서명한다.
//   ★ 비밀키는 서버 전용 env 를 쓴다. 서명 결과로 키를 되찾을 수 없다.
//     전용 키를 새로 두려면 TRAINING_TOKEN_SECRET 만 넣으면 그쪽이 우선한다.
function tokenSecret() {
  const s =
    process.env.TRAINING_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("token secret missing");
  return s;
}

export function signIssue(userId, coord) {
  const payload = [
    userId,
    coord.yearKey,
    coord.setId,
    coord.questionId,
    coord.choiceNum,
  ].join("|");
  return crypto.createHmac("sha256", tokenSecret()).update(payload).digest("hex");
}

export function verifyIssue(userId, coord, token) {
  if (typeof token !== "string" || token.length !== 64) return false;
  const expected = signIssue(userId, coord);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── 조회 도우미 ──────────────────────────────────────────────
export function isSafeSegment(v) {
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

// 좌표 → { set, question, choice }. 못 찾으면 null.
//   ★ setId 는 회차 간 충돌한다(l20146a 가 2014_6월A·B 양쪽에 있다).
//     yearKey 를 반드시 함께 받는다 — dataLoader.sectionOfSet 과 같은 규율이다.
export function findChoice(source, coord) {
  const yd = source?.[coord.yearKey];
  if (!yd) return null;
  for (const section of ["reading", "literature"]) {
    const set = (yd[section] ?? []).find((s) => s.id === coord.setId);
    if (!set) continue;
    const question = (set.questions ?? []).find(
      (q) => String(q.id) === String(coord.questionId),
    );
    if (!question) return null;
    const choice = (question.choices ?? []).find(
      (c) => Number(c.num) === Number(coord.choiceNum),
    );
    if (!choice) return null;
    return { set, question, choice, section };
  }
  return null;
}

// cs_ids → 지문 문장 텍스트. pro 필드를 그대로 내보내지 않고 문장만 뽑는다.
export function groundingSentences(set, choice) {
  return (choice.cs_ids ?? [])
    .map((sid) => (set.sents ?? []).find((s) => s.id === sid)?.t)
    .filter(Boolean);
}
