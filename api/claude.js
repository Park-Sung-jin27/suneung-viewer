/* global process */

import { createClient } from "@supabase/supabase-js";

const MODEL = "claude-sonnet-4-6";
const MAX_PROMPT_CHARS = 12000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 12;
const ALLOWED_TASKS = new Set([
  "question_qa",
  "pattern_coach_initial",
  "pattern_coach_reply",
]);
const rateBuckets = new Map();

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function getAuthedUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase auth is not configured");
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return data.user ?? null;
}

function isRateLimited(key) {
  const now = Date.now();
  const bucket = rateBuckets.get(key) ?? { start: now, count: 0 };
  if (now - bucket.start > RATE_WINDOW_MS) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count > RATE_LIMIT;
}

function asSafePrompt(body) {
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return "";
  return prompt.slice(0, MAX_PROMPT_CHARS);
}

function getTask(body) {
  const task = typeof body?.task === "string" ? body.task : "";
  return ALLOWED_TASKS.has(task) ? task : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const user = await getAuthedUser(req);
    if (!user) {
      return res.status(401).json({ error: "Login required" });
    }

    if (isRateLimited(user.id)) {
      return res.status(429).json({ error: "Too many AI requests" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const task = getTask(body);
    if (!task) {
      return res.status(400).json({ error: "Unknown AI task" });
    }

    const prompt = asSafePrompt(body);
    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    const guardPrompt = `You are a Korean CSAT language tutor for the product "Jini teacher".
Answer only questions about Korean CSAT reading, literature, grammar, writing, speech, and media.
Use only the passage, choices, student answer, answer key, commentary, and evidence sentences provided by the app.
If the evidence is not enough, say that the app data is not enough to confirm the answer.
If the user asks about an unrelated topic, reply in Korean: "수능 국어 문제에 대해서만 도와드릴 수 있어요."
Keep explanations short, concrete, and student-friendly.
Task: ${task}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        system: guardPrompt,
        messages: [{ role: "user", content: prompt }],
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
