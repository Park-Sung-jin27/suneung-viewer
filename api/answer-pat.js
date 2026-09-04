/* global process, Buffer */

// api/answer-pat.js — 오답 패턴(pat) 서버 기록 (발주 F-61 · A′)
//
//   POST /api/answer-pat
//   Authorization: Bearer <supabase access_token>
//   body: { yearKey, setId, items: [{ questionId, choiceNum }, ...] }
//
//   클라이언트는 "무엇을 골랐는지"만 보낸다. pat 은 서버가 data-pro/<yearKey>.json
//   에서 찾아 user_answers 에 직접 쓴다.
//
//   🔴 pat 을 응답 본문에 넣지 않는다. 넣는 순간 이 발주의 존재 이유가 사라진다.
//      pat 은 정답을 노출한다 — 한 문항에서 pat 이 없는(또는 있는) 선지 하나가
//      곧 정답이고, questionType 이 free 에 있어 반전도 자동이다.
//      그래서 C_PRO 에 남기고, 브라우저에는 끝까지 내려보내지 않는다.
//
//   ★ 이용권을 보지 않는다. 무료 계정도 오답 패턴 리포트가 나와야 한다는 것이
//     이 발주의 목적이다(대표 결정). pat 이 브라우저로 나가지 않으므로
//     유료 자산은 새지 않는다 — /api/pro-data 의 402 게이트와 목적이 다르다.
//
//   ★ 쓰기는 service role 이 아니라 사용자 JWT 로 한다. RLS "본인 응답만"
//     (auth.uid() = user_id) 이 남의 행을 막는다. 서버가 남의 답안을
//     고칠 수 있는 권한을 새로 만들지 않는다.
//
//   ★ 정오 판정은 DB 가 한다 — is_correct = false 인 행만 채운다.
//     클라이언트가 보낸 choiceNum 은 WHERE 조건으로만 쓴다. 어긋나면
//     매칭되는 행이 없어 아무것도 쓰이지 않는다(스스로 검산된다).
//
//   실패 시: 답안은 이미 저장돼 있고 pat 만 null 로 남는다 — F-61 이전과 같은 최악.
//
//   필요 env: SUPABASE_URL(또는 VITE_) · SUPABASE_ANON_KEY(또는 VITE_)
//   ※ data-pro/ 는 public/ 밖이다. vercel.json 의 functions.includeFiles 로
//     이 함수 번들에도 포함시킨다(런타임 fs 읽기라 정적 추적이 안 된다).

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const MAX_ITEMS = 60; // 한 세트 문항 수 상한 여유분

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase configuration missing");
  }
  return { supabaseUrl, anonKey };
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

// 사용자 JWT 를 그대로 단 클라이언트. 이후 모든 쿼리에 RLS 가 걸린다.
function userClient(token) {
  const { supabaseUrl, anonKey } = getSupabaseConfig();
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// yearKey / setId 는 파일 경로·조회 키에 들어간다. 경로 탈출을 차단한다.
//   (api/pro-data.js 와 같은 판정을 쓴다)
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

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });

    const client = userClient(token);
    const { data: authData, error: authError } = await client.auth.getUser(token);
    const user = authError ? null : authData?.user;
    if (!user) return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });

    const body = await readBody(req);
    const yearKey = body?.yearKey;
    const setId = body?.setId;
    if (!isSafeSegment(yearKey) || !isSafeSegment(setId)) {
      return res.status(400).json({ ok: false, error: "INVALID_TARGET" });
    }
    const items = Array.isArray(body?.items) ? body.items.slice(0, MAX_ITEMS) : [];
    if (items.length === 0) return res.status(200).json({ ok: true, count: 0 });

    const yearData = readProYear(yearKey);
    // 비노출 세트는 data-pro 에 없다(build_split 이 LIVE 만 만든다).
    //   마스터 검수 경로에서 오는 요청이 여기 해당한다 — 조용히 0건으로 끝낸다.
    const setPro = yearData?.sets?.[setId];
    if (!setPro) return res.status(200).json({ ok: true, count: 0 });

    let count = 0;
    for (const it of items) {
      const questionId = Number(it?.questionId);
      const choiceNum = Number(it?.choiceNum);
      if (!Number.isInteger(questionId) || !Number.isInteger(choiceNum)) continue;

      const pat =
        setPro.questions?.[String(questionId)]?.choices?.[String(choiceNum)]?.pat;
      if (typeof pat !== "string" || pat.length === 0) continue;

      const { error } = await client
        .from("user_answers")
        .update({ pat })
        .eq("user_id", user.id)
        .eq("year_key", yearKey)
        .eq("set_id", setId)
        .eq("question_id", questionId)
        .eq("choice_num", choiceNum)
        .eq("is_correct", false);
      if (error) {
        console.warn("[/api/answer-pat] update 실패", error.message);
        continue;
      }
      count += 1;
    }

    // 🔴 pat 값을 돌려주지 않는다. 시도 건수만 알린다(세트 단위 집계라
    //    문항별 정보가 되지 않는다).
    return res.status(200).json({ ok: true, count });
  } catch (e) {
    console.error("[/api/answer-pat]", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
