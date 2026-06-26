import { get, put } from "@vercel/blob";
import crypto from "node:crypto";

const BLOB_ACCESS = "private";
const EVENT_PREFIX = "inyeon-growth/events";
const EVENT_DAILY_PREFIX = "inyeon-growth/daily";
const WAITLIST_PREFIX = "inyeon-growth/waitlist";
const WAITLIST_DAILY_PREFIX = "inyeon-growth/waitlist-daily";
const EVENT_NAMES = new Set(["room_create", "room_join", "room_share_click", "room_cta_click"]);

function nowIso() {
  return new Date().toISOString();
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function hasBlobConfig() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function blobAuthOptions() {
  const options = {};
  if (process.env.BLOB_READ_WRITE_TOKEN) options.token = process.env.BLOB_READ_WRITE_TOKEN;
  if (process.env.BLOB_STORE_ID) options.storeId = process.env.BLOB_STORE_ID;
  return options;
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8") || "{}");
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function blobText(result) {
  if (!result) return "";
  if (result.stream) return await new Response(result.stream).text();
  if (result.url) {
    const response = await fetch(result.url, { cache: "no-store" });
    if (!response.ok) return "";
    return await response.text();
  }
  return "";
}

async function readJson(key, fallback = null) {
  if (!hasBlobConfig()) throw new Error("BLOB_STORAGE_NOT_CONFIGURED");
  try {
    const result = await get(key, { access: BLOB_ACCESS, useCache: false, ...blobAuthOptions() });
    const text = await blobText(result);
    return text ? JSON.parse(text) : fallback;
  } catch (error) {
    if (/not.?found|404|BlobNotFound/i.test(String(error?.message || error))) return fallback;
    throw error;
  }
}

async function writeJson(key, value) {
  if (!hasBlobConfig()) throw new Error("BLOB_STORAGE_NOT_CONFIGURED");
  await put(key, JSON.stringify(value), {
    access: BLOB_ACCESS,
    contentType: "application/json; charset=utf-8",
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    ...blobAuthOptions(),
  });
}

function cleanText(value, limit = 120) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, limit);
}

function cleanRoomCode(value) {
  const code = cleanText(value, 12).toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : "";
}

function cleanParticipantId(value) {
  const id = cleanText(value, 64);
  return /^[a-z0-9-]{8,64}$/i.test(id) ? id : "";
}

function clientMeta(req) {
  return {
    ua: cleanText(req.headers["user-agent"], 240),
    referer: cleanText(req.headers.referer || req.headers.referrer, 240),
    ipHash: hashValue(
      req.headers["x-forwarded-for"] ||
        req.headers["x-real-ip"] ||
        req.socket?.remoteAddress ||
        ""
    ),
  };
}

function hashValue(value) {
  const text = cleanText(value, 240).toLowerCase();
  if (!text) return "";
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 24);
}

function randomId() {
  return crypto.randomBytes(8).toString("hex");
}

function increment(target, key, amount = 1) {
  target[key] = (Number(target[key]) || 0) + amount;
}

async function updateEventDaily(record) {
  const key = `${EVENT_DAILY_PREFIX}/${record.date}.json`;
  const daily = (await readJson(key, null)) || {
    schema: "JIPPI_INYEON_GROWTH_DAILY_V1",
    date: record.date,
    updatedAt: record.createdAt,
    total: 0,
    events: {},
    sources: {},
    rooms: {},
  };

  daily.updatedAt = record.createdAt;
  daily.total += 1;
  increment(daily.events, record.event);

  const source = record.source || "unknown";
  daily.sources[source] = daily.sources[source] || {};
  increment(daily.sources[source], record.event);

  if (record.roomCode) {
    daily.rooms[record.roomCode] = daily.rooms[record.roomCode] || {
      total: 0,
      events: {},
      participants: [],
    };
    const room = daily.rooms[record.roomCode];
    room.total += 1;
    increment(room.events, record.event);
    if (record.participantId && !room.participants.includes(record.participantId)) {
      room.participants.push(record.participantId);
      room.participants = room.participants.slice(-60);
    }
  }

  await writeJson(key, daily);
  return daily;
}

export async function recordGrowthEvent(req, res) {
  try {
    if (req.method === "GET") return readGrowthSummary(req, res);
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });

    const body = await readBody(req);
    const event = cleanText(body.event, 40);
    if (!EVENT_NAMES.has(event)) return sendJson(res, 400, { ok: false, error: "INVALID_EVENT" });

    const createdAt = nowIso();
    const record = {
      schema: "JIPPI_INYEON_GROWTH_EVENT_V1",
      id: randomId(),
      event,
      date: todayKey(new Date(createdAt)),
      createdAt,
      roomCode: cleanRoomCode(body.roomCode),
      participantId: cleanParticipantId(body.participantId),
      source: cleanText(body.source || "room", 40),
      target: cleanText(body.target, 80),
      path: cleanText(body.path, 180),
      meta: clientMeta(req),
    };

    await writeJson(`${EVENT_PREFIX}/${record.date}/${record.createdAt.replace(/[:.]/g, "-")}-${record.id}.json`, record);
    await updateEventDaily(record);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    const missingStore = error?.message === "BLOB_STORAGE_NOT_CONFIGURED";
    return sendJson(res, missingStore ? 503 : 500, {
      ok: false,
      error: error?.message || "GROWTH_EVENT_FAILED",
      needsEnv: missingStore ? ["BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID"] : undefined,
    });
  }
}

async function readGrowthSummary(req, res) {
  const configuredKey = process.env.JIPPI_METRICS_KEY || "";
  if (!configuredKey || req.query?.key !== configuredKey) {
    return sendJson(res, 403, { ok: false, error: "METRICS_KEY_REQUIRED" });
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query?.date || ""))
    ? String(req.query.date)
    : todayKey();
  const daily = (await readJson(`${EVENT_DAILY_PREFIX}/${date}.json`, null)) || {
    schema: "JIPPI_INYEON_GROWTH_DAILY_V1",
    date,
    total: 0,
    events: {},
    sources: {},
    rooms: {},
  };
  return sendJson(res, 200, { ok: true, daily });
}

async function notifyWaitlist(lead) {
  const webhook = process.env.WAITLIST_DISCORD_WEBHOOK_URL || process.env.ORDER_DISCORD_WEBHOOK_URL;
  if (!webhook) return { skipped: true };
  const content = [
    "[JIPPI Waitlist]",
    `source: ${lead.source}`,
    `name: ${lead.name || "-"}`,
    `contact: ${lead.contact}`,
    `roomCode: ${lead.roomCode || "-"}`,
    `createdAt: ${lead.createdAt}`,
  ].join("\n");
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `\`\`\`\n${content}\n\`\`\`` }),
  });
  if (!response.ok) throw new Error(`WAITLIST_WEBHOOK_FAILED_${response.status}`);
  return { ok: true };
}

async function updateWaitlistDaily(lead) {
  const key = `${WAITLIST_DAILY_PREFIX}/${lead.date}.json`;
  const daily = (await readJson(key, null)) || {
    schema: "JIPPI_WAITLIST_DAILY_V1",
    date: lead.date,
    updatedAt: lead.createdAt,
    total: 0,
    sources: {},
    rooms: {},
  };
  daily.updatedAt = lead.createdAt;
  daily.total += 1;
  increment(daily.sources, lead.source || "unknown");
  if (lead.roomCode) increment(daily.rooms, lead.roomCode);
  await writeJson(key, daily);
  return daily;
}

export async function recordWaitlist(req, res) {
  try {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
    const body = await readBody(req);
    const contact = cleanText(body.contact, 120);
    if (contact.length < 3) return sendJson(res, 400, { ok: false, error: "CONTACT_REQUIRED" });

    const createdAt = nowIso();
    const date = todayKey(new Date(createdAt));
    const contactHash = hashValue(contact);
    const lead = {
      schema: "JIPPI_WAITLIST_LEAD_V1",
      id: contactHash || randomId(),
      createdAt,
      updatedAt: createdAt,
      date,
      source: cleanText(body.source || "room", 40),
      name: cleanText(body.name, 40),
      contact,
      contactHash,
      roomCode: cleanRoomCode(body.roomCode),
      participantId: cleanParticipantId(body.participantId),
      path: cleanText(body.path, 180),
      meta: clientMeta(req),
    };

    await writeJson(`${WAITLIST_PREFIX}/leads/${lead.id}.json`, lead);
    await updateWaitlistDaily(lead);
    const notification = await notifyWaitlist(lead).catch((error) => ({ ok: false, error: error?.message }));
    return sendJson(res, 200, { ok: true, notification });
  } catch (error) {
    const missingStore = error?.message === "BLOB_STORAGE_NOT_CONFIGURED";
    return sendJson(res, missingStore ? 503 : 500, {
      ok: false,
      error: error?.message || "WAITLIST_FAILED",
      needsEnv: missingStore ? ["BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID"] : undefined,
    });
  }
}
