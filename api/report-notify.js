// 뷰어 오류 신고 Discord 알림 (발주 F-21 ②)
//   저장은 클라이언트가 Supabase 에 직접 한다. 이 경로는 알림 전용이다.
//   웹훅 URL 을 번들에 넣지 않기 위해 서버를 한 번 경유한다.
//   실패해도 200 을 돌려준다 — 신고 저장은 이미 끝났고, 알림 실패로
//   사용자에게 오류를 보이면 안 된다.

const TYPE_LABEL = {
  no_image: "이미지 없음",
  bad_analysis: "해설 이상",
  typo: "오탈자",
  etc: "기타",
};

function clean(v, max) {
  return String(v ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, max);
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
    res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    return;
  }

  const webhook =
    process.env.ISSUE_REPORT_DISCORD_WEBHOOK_URL ||
    process.env.ORDER_DISCORD_WEBHOOK_URL;
  if (!webhook) {
    res.status(200).json({ ok: true, skipped: "NO_WEBHOOK" });
    return;
  }

  try {
    const b = await readBody(req);
    const type = clean(b.report_type, 20);
    const content = [
      "[JIPPI 오류 신고]",
      `회차: ${clean(b.year_key, 40)}  세트: ${clean(b.set_id, 40)}  문항: ${clean(b.question_id, 10) || "-"}`,
      `유형: ${TYPE_LABEL[type] || type || "-"}   모드: ${b.is_pro ? "유료" : "무료"}   ${b.user_id ? "로그인" : "비로그인"}`,
      `내용: ${clean(b.body, 300)}`,
      `경로: ${clean(b.path, 200) || "-"}`,
    ].join("\n");

    const r = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "```\n" + content + "\n```" }),
    });
    res.status(200).json({ ok: r.ok });
  } catch (e) {
    res.status(200).json({ ok: false, error: e?.message });
  }
}
