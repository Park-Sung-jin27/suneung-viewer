const DEFAULT_TO = "seongjinpark12@gmail.com";
const DEFAULT_FROM = "JIPPI Orders <orders@jippi.kr>";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function text(value, limit = 2000) {
  return String(value ?? "")
    .trim()
    .slice(0, limit);
}

function summarizeOrder(order) {
  const product = order?.product?.name || order?.selectedProduct || "-";
  const total = Number(order?.totalPrice || 0).toLocaleString("ko-KR");
  const customer = order?.customer || {};
  const self = order?.self || {};
  const partner = order?.partner || {};
  const context = order?.context || {};
  const payment = order?.payment || {};
  const topics = Array.isArray(order?.options?.selectedInterests)
    ? order.options.selectedInterests
        .map((item) => item?.label)
        .filter(Boolean)
        .join(", ")
    : "";

  return [
    "[JIPPI Fortune Order]",
    `orderCode: ${text(order?.orderCode, 80)}`,
    `intakeSource: ${text(order?.intakeSource || order?.source, 120)}`,
    `product: ${text(product, 200)}`,
    `totalPrice: ${total} KRW`,
    `paymentStatus: ${text(payment.status, 120)}`,
    `tossOrderId: ${text(payment.tossOrderId, 160)}`,
    "",
    "[customer]",
    `name: ${text(customer.name, 200)}`,
    `contact: ${text(customer.contact, 200)}`,
    `email: ${text(customer.email, 200)}`,
    `delivery: ${text(customer.delivery, 200)}`,
    "",
    "[birth]",
    `gender: ${text(self.gender, 50)}`,
    `birthDate: ${text(self.birthDate, 50)} (${text(self.calendar, 50)})`,
    `birthTime: ${text(self.birthTime, 50)} / accuracy: ${text(self.timeAccuracy, 100)}`,
    `birthCity: ${text(self.birthCity, 100)}`,
    `relationshipStatus: ${text(self.relationshipStatus, 100)}`,
    "",
    "[partner]",
    `partnerMode: ${order?.partnerMode ? "YES" : "NO"}`,
    `name: ${text(partner.name, 200)}`,
    `gender: ${text(partner.gender, 50)}`,
    `birthDate: ${text(partner.birthDate, 50)} (${text(partner.calendar, 50)})`,
    `birthTime: ${text(partner.birthTime, 50)} / accuracy: ${text(partner.timeAccuracy, 100)}`,
    `birthCity: ${text(partner.birthCity, 100)}`,
    "",
    "[modules]",
    topics || "-",
    "",
    "[context]",
    `mainConcern: ${text(context.mainConcern)}`,
    `optionA: ${text(context.optionA)}`,
    `optionB: ${text(context.optionB)}`,
    `period: ${text(context.period)}`,
    `analysisYear: ${text(context.analysisYear)}`,
    `lifeArea: ${text(context.lifeArea)}`,
    `frequentPlaces: ${text(context.frequentPlaces)}`,
    `desiredOutcome: ${text(context.desiredOutcome)}`,
    `questions: ${text(context.questions)}`,
    `exclude: ${text(context.exclude)}`,
  ].join("\n");
}

async function sendResendEmail(order) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: true, reason: "RESEND_API_KEY missing" };

  const to = process.env.ORDER_NOTIFY_EMAIL || DEFAULT_TO;
  const from = process.env.ORDER_FROM_EMAIL || DEFAULT_FROM;
  const subject = `[JIPPI Order] ${order?.orderCode || "NO-CODE"} - ${order?.product?.name || "Unknown product"}`;
  const textBody = `${summarizeOrder(order)}\n\n[rawOrderJson]\n${JSON.stringify(order, null, 2)}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text: textBody }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend email failed: ${response.status} ${errorText}`);
  }

  return { ok: true, provider: "resend", result: await response.json() };
}

async function sendDiscordWebhook(order) {
  const webhook = process.env.ORDER_DISCORD_WEBHOOK_URL;
  if (!webhook)
    return { skipped: true, reason: "ORDER_DISCORD_WEBHOOK_URL missing" };

  const content = `\`\`\`\n${summarizeOrder(order).slice(0, 1800)}\n\`\`\``;
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} ${errorText}`);
  }

  return { ok: true, provider: "discord" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const order =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!order || typeof order !== "object") {
      return sendJson(res, 400, { ok: false, error: "Invalid order payload" });
    }

    if (
      !order.orderCode ||
      !order.product?.name ||
      !order.customer?.name ||
      !order.customer?.contact
    ) {
      return sendJson(res, 400, {
        ok: false,
        error: "Missing required order fields",
        required: [
          "orderCode",
          "product.name",
          "customer.name",
          "customer.contact",
        ],
      });
    }

    const [emailResult, discordResult] = await Promise.all([
      sendResendEmail(order),
      sendDiscordWebhook(order),
    ]);
    const delivered = Boolean(emailResult.ok || discordResult.ok);

    if (!delivered) {
      return sendJson(res, 503, {
        ok: false,
        error: "No order notification sink configured",
        needsEnv: [
          "RESEND_API_KEY + ORDER_NOTIFY_EMAIL",
          "or ORDER_DISCORD_WEBHOOK_URL",
        ],
      });
    }

    return sendJson(res, 200, {
      ok: true,
      orderCode: order.orderCode,
      notifications: { email: emailResult, discord: discordResult },
    });
  } catch (error) {
    console.error("[/api/fortune-order]", error);
    return sendJson(res, 500, {
      ok: false,
      error: error.message || "Order intake failed",
    });
  }
}
