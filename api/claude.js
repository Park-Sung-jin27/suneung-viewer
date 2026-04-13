// api/claude.js — Vercel Serverless Function
// 브라우저 → 이 함수 → Anthropic API (키 서버에서만 사용)
// ANTHROPIC_API_KEY 환경변수 필요 (VITE_ 없이)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const body = req.body;

    // ── 수능 국어 관련 질문 필터링 ──────────────────────────
    // 사용자 마지막 메시지 추출
    const messages = body.messages ?? [];
    const lastUserMsg =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    // 시스템 프롬프트에 필터링 지시 주입
    const systemBase = body.system ?? "";
    const guardPrompt = `당신은 수능 국어 전문 AI 튜터입니다.
수능 국어(독서·문학·화법·작문·언어·매체) 관련 질문에만 답하세요.
관계없는 질문(욕설, 다른 과목, 일상, 코딩 등)에는 반드시 이 문장만 답하세요:
"수능 국어 문제에 대해서만 도움드릴 수 있어요 😊"
${systemBase}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        ...body,
        system: guardPrompt,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    console.error("[/api/claude]", e);
    return res.status(500).json({ error: e.message });
  }
}
