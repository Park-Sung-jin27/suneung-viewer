/* global process */

// api/payment-confirm.js — Toss 결제 서버 사이드 검증 path.
//   직전 client 안 URL params 단독 신뢰 path (App.jsx L2396) → 서버 안
//   Toss confirm API + 금액 검증 + 서버 사이드 subscription upsert 정합.
//
// 필요 env vars:
//   TOSS_SECRET_KEY — Toss 시크릿 키 (Basic auth path)
//   SUPABASE_URL / VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY — RLS 우회 안 서버 upsert path
//   SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY — 사용자 JWT 검증 path
//
// 정합 요약:
//   ① JWT 안 사용자 인증 (createClient + auth.getUser).
//   ② orderId 안 프리픽스 검증 (order_{userId}_{ts} 정합 — 사용자 위조 회피).
//   ③ amount 안 화이트리스트 검증 (39900 = pro 1개월. 89000 은 D-4 에서 제거).
//   ④ Toss /v1/payments/confirm 안 secret key 안 서버 사이드 호출.
//   ⑤ Toss 응답 안 amount 재검증 (요청값 == 응답값 정합).
//   ⑥ service role 안 subscriptions upsert (RLS 우회 정합).
//   ⑦ 실패 path 안 로그 + 일반화 에러 (내부 정보 누설 차단).

import { createClient } from "@supabase/supabase-js";

// [발주 D-4 ②] 프리미엄(89,000)은 제공 불가 상태다 — 핵심 혜택인
//   「월 2회 전문가 1:1 리뷰」를 수행할 사람이 없다. 팔 수 없는 상품을
//   결제 가능 상태로 두면 구매 즉시 제공 불가 + 환불이 된다.
//   제공할 수 있게 되면 다시 넣는다. 지금은 39,900 만 허용한다.
const ALLOWED_AMOUNTS = new Map([[39900, "pro"]]);

// [발주 D-4 ①] 1개월 이용권(단건). 빌링키 정기결제는 미구현이므로
//   승인 시각 기준 1개월 뒤를 만료로 박는다. 이 값이 없으면
//   is_pro() 의 expires_at IS NULL 분기 때문에 영구 Pro 가 된다.
//   말일 보정: 1/31 + 1개월 → 2/28(윤년 2/29). 다음 달로 넘치지 않게 자른다.
function addOneMonth(from) {
  const r = new Date(from);
  const day = r.getDate();
  r.setMonth(r.getMonth() + 1);
  if (r.getDate() < day) r.setDate(0);
  return r;
}

// [발주 D-4 ③] 권한 부여 실패 알림 — 결제는 승인됐는데 구독 반영이
//   실패한 경우다. 돈은 나가고 권한은 없는 상태라 사람이 즉시 알아야 한다.
//   ★ 카드정보·시크릿 키는 넣지 않는다. 식별자와 사유만 보낸다.
async function notifyEntitlementFailure(info) {
  const webhook =
    process.env.ORDER_DISCORD_WEBHOOK_URL ||
    process.env.WAITLIST_DISCORD_WEBHOOK_URL;
  if (!webhook) return { skipped: true };
  const content = [
    "[JIPPI 결제] 권한 부여 실패 — 수동 확인 필요",
    `userId: ${info.userId}`,
    `orderId: ${info.orderId}`,
    `paymentKey: ${info.paymentKey}`,
    `plan: ${info.plan}`,
    `reason: ${info.reason}`,
    `at: ${info.at}`,
  ].join("\n");
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "```\n" + content + "\n```" }),
    });
    return { ok: true };
  } catch (e) {
    console.error("[/api/payment-confirm] notify failed", e?.message);
    return { ok: false };
  }
}

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

// orderId path: "order_{userId}_{ts}" 사양 정합 (Payment.jsx L367).
//   userId 파싱 후 인증 사용자 id 와 비교 → 위조 회피 path.
function parseOrderIdUserId(orderId) {
  if (typeof orderId !== "string") return null;
  const m = orderId.match(/^order_([0-9a-f-]{20,})_/i);
  return m?.[1] ?? null;
}

async function confirmWithToss({ paymentKey, orderId, amount }) {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) throw new Error("Toss secret key not configured");
  const basic = Buffer.from(`${secret}:`).toString("base64");
  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const ct = req.headers["content-type"] || "";
  if (!ct.toLowerCase().includes("application/json")) {
    return res
      .status(415)
      .json({ error: "Content-Type must be application/json" });
  }

  try {
    // ① JWT 사용자 인증
    const user = await getAuthedUser(req);
    if (!user) return res.status(401).json({ error: "Login required" });

    // ② 입력 파싱 + 기본 validation
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
    const paymentKey =
      typeof body.paymentKey === "string" ? body.paymentKey : null;
    const orderId = typeof body.orderId === "string" ? body.orderId : null;
    const amount = Number(body.amount);
    if (!paymentKey || !orderId || !Number.isFinite(amount)) {
      return res.status(400).json({ error: "Invalid payment payload" });
    }

    // ③ amount 화이트리스트 검증
    const plan = ALLOWED_AMOUNTS.get(amount);
    if (!plan) {
      console.warn("[/api/payment-confirm] invalid amount", {
        amount,
        userId: user.id,
      });
      return res.status(400).json({ error: "Invalid subscription amount" });
    }

    // ④ orderId 안 사용자 위조 검사
    const orderUserId = parseOrderIdUserId(orderId);
    if (!orderUserId || orderUserId !== user.id) {
      console.warn("[/api/payment-confirm] orderId user mismatch", {
        orderUserId,
        userId: user.id,
      });
      return res.status(403).json({ error: "Order does not match user" });
    }

    // ⑤ Toss confirm API 호출 (secret key path — 서버 사이드 단독).
    const toss = await confirmWithToss({ paymentKey, orderId, amount });
    if (!toss.ok) {
      console.warn("[/api/payment-confirm] toss failed", {
        status: toss.status,
        userId: user.id,
        tossCode: toss.body?.code,
        tossMessage: toss.body?.message,
      });
      return res.status(402).json({ error: "Payment confirmation failed" });
    }

    // ⑥ Toss 응답 amount 재검증 (요청 amount 와 동일 사실 확정).
    const confirmedAmount = Number(
      toss.body?.totalAmount ?? toss.body?.amount ?? NaN,
    );
    if (!Number.isFinite(confirmedAmount) || confirmedAmount !== amount) {
      console.warn("[/api/payment-confirm] amount mismatch", {
        requested: amount,
        confirmed: confirmedAmount,
        userId: user.id,
      });
      return res.status(400).json({ error: "Amount mismatch" });
    }

    // ⑦ subscriptions upsert — service role path (RLS 우회 정합).
    const { supabaseUrl, serviceKey } = getSupabaseConfig();
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // [발주 D-4 ①] 재결제는 「연장」이다. 남은 기간이 있으면 그 끝에서
    //   1개월을 더한다. 덮어쓰면 이미 낸 잔여 기간이 사라져 손해가 된다.
    const { data: existing } = await admin
      .from("subscriptions")
      .select("expires_at, status")
      .eq("user_id", user.id)
      .maybeSingle();
    const now = new Date();
    const remain =
      existing?.status === "active" && existing?.expires_at
        ? new Date(existing.expires_at)
        : null;
    const base = remain && remain > now ? remain : now;
    const expiresAt = addOneMonth(base).toISOString();

    const { error: upsertErr } = await admin.from("subscriptions").upsert(
      {
        user_id: user.id,
        plan,
        status: "active",
        expires_at: expiresAt,
        toss_payment_key: paymentKey,
        toss_order_id: orderId,
      },
      { onConflict: "user_id" },
    );
    if (upsertErr) {
      console.error("[/api/payment-confirm] upsert failed", upsertErr);
      // [발주 D-4 ③] 돈은 나갔는데 권한이 없다. 사람이 즉시 알아야 한다.
      await notifyEntitlementFailure({
        userId: user.id,
        orderId,
        paymentKey,
        plan,
        reason: upsertErr.message || "upsert failed",
        at: now.toISOString(),
      });
      return res.status(500).json({
        error: "Subscription update failed",
        code: "ENTITLEMENT_FAILED",
      });
    }

    return res.status(200).json({ ok: true, plan });
  } catch (e) {
    console.error("[/api/payment-confirm]", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
