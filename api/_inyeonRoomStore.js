import { get, put } from "@vercel/blob";

const ROOM_CODE_RE = /^[A-Z0-9]{6}$/;
const PARTICIPANT_ID_RE = /^[a-z0-9-]{12,48}$/i;
const STORE_PREFIX = "inyeon-rooms";
const BLOB_ACCESS = "private";

function nowIso() {
  return new Date().toISOString();
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
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.end(JSON.stringify(body));
}

function cleanName(value) {
  return (
    String(value || "친구")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 20) || "친구"
  );
}

function cleanCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (!ROOM_CODE_RE.test(code)) throw new Error("INVALID_ROOM_CODE");
  return code;
}

function cleanParticipantId(value) {
  const id = String(value || "").trim();
  if (!PARTICIPANT_ID_RE.test(id)) throw new Error("INVALID_PARTICIPANT_ID");
  return id;
}

function cleanLevel(value) {
  return (
    String(value || "중간")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 24) || "중간"
  );
}

function cleanAxis(axis) {
  const src = axis && typeof axis === "object" ? axis : {};
  return {
    key: String(src.key || "")
      .replace(/[^a-z_]/gi, "")
      .slice(0, 24),
    label: String(src.label || "")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 20),
    score: Math.max(0, Math.min(100, Number(src.score) || 50)),
    level: cleanLevel(src.level),
  };
}

function normalizeProfile(raw) {
  const profile = raw && typeof raw === "object" ? raw : {};
  const axes = Array.isArray(profile.axes)
    ? profile.axes.map(cleanAxis).filter((axis) => axis.key && axis.label)
    : [];
  if (axes.length < 3) throw new Error("INVALID_PROFILE_AXES");
  return {
    element: String(profile.element || "")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 4),
    dayPillar: String(profile.dayPillar || "")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 16),
    hourPillar: String(profile.hourPillar || "")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 16),
    teaser: String(profile.teaser || "")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 120),
    axes: axes.slice(0, 5),
  };
}

function normalizeParticipant(raw) {
  const body = raw && typeof raw === "object" ? raw : {};
  return {
    id: cleanParticipantId(body.participantId || body.id),
    name: cleanName(body.name),
    isAdult: body.isAdult === true,
    profile: normalizeProfile(body.profile),
  };
}

function roomKey(code) {
  return `${STORE_PREFIX}/${cleanCode(code)}.json`;
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

async function readRoom(code) {
  if (!hasBlobConfig()) throw new Error("BLOB_STORAGE_NOT_CONFIGURED");
  try {
    const result = await get(roomKey(code), { access: BLOB_ACCESS, useCache: false, ...blobAuthOptions() });
    const text = await blobText(result);
    return text ? JSON.parse(text) : null;
  } catch (error) {
    if (/not.?found|404|BlobNotFound/i.test(String(error?.message || error))) return null;
    throw error;
  }
}

async function writeRoom(room) {
  if (!hasBlobConfig()) throw new Error("BLOB_STORAGE_NOT_CONFIGURED");
  await put(roomKey(room.code), JSON.stringify(room), {
    access: BLOB_ACCESS,
    contentType: "application/json; charset=utf-8",
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    ...blobAuthOptions(),
  });
}

function publicRoom(room) {
  return {
    schema: room.schema,
    code: room.code,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    hostId: room.hostId,
    participants: (room.participants || []).map((item) => ({
      id: item.id,
      name: item.name,
      isAdult: item.isAdult === true,
      profile: item.profile,
      joinedAt: item.joinedAt,
      updatedAt: item.updatedAt,
    })),
  };
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

async function createRoom(body) {
  const participant = normalizeParticipant(body || {});
  let code = randomCode();
  for (let i = 0; i < 5; i += 1) {
    if (!(await readRoom(code))) break;
    code = randomCode();
  }
  const timestamp = nowIso();
  const room = {
    schema: "JIPPI_INYEON_ROOM_V1",
    code,
    createdAt: timestamp,
    updatedAt: timestamp,
    hostId: participant.id,
    participants: [{ ...participant, joinedAt: timestamp, updatedAt: timestamp }],
  };
  await writeRoom(room);
  return publicRoom(room);
}

async function joinRoom(code, body) {
  const participant = normalizeParticipant(body || {});
  const room = await readRoom(code);
  if (!room) return null;
  const timestamp = nowIso();
  const list = Array.isArray(room.participants) ? room.participants : [];
  const index = list.findIndex((item) => item.id === participant.id);
  const next = {
    ...participant,
    joinedAt: index >= 0 ? list[index].joinedAt : timestamp,
    updatedAt: timestamp,
  };
  if (index >= 0) list[index] = next;
  else list.push(next);
  room.participants = list.slice(0, 24);
  room.updatedAt = timestamp;
  await writeRoom(room);
  return publicRoom(room);
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export async function handleInyeonRoom(req, res, rawCode = "") {
  try {
    const code = rawCode ? cleanCode(Array.isArray(rawCode) ? rawCode[0] : rawCode) : "";

    if (req.method === "GET") {
      if (!code) return sendJson(res, 400, { ok: false, error: "ROOM_CODE_REQUIRED" });
      const room = await readRoom(code);
      if (!room) return sendJson(res, 404, { ok: false, error: "ROOM_NOT_FOUND" });
      return sendJson(res, 200, { ok: true, room: publicRoom(room) });
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const room = code ? await joinRoom(code, body) : await createRoom(body);
      if (!room) return sendJson(res, 404, { ok: false, error: "ROOM_NOT_FOUND" });
      return sendJson(res, 200, { ok: true, room });
    }

    return sendJson(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    const message = error?.message || "INYEON_ROOM_FAILED";
    const badRequest = String(message).startsWith("INVALID");
    const missingStore = message === "BLOB_STORAGE_NOT_CONFIGURED";
    return sendJson(res, missingStore ? 503 : badRequest ? 400 : 500, {
      ok: false,
      error: message,
      needsEnv: missingStore ? ["BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID"] : undefined,
    });
  }
}
