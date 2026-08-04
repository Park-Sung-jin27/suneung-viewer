/* global Buffer, process */

import { del, get, put } from "@vercel/blob";
import crypto from "node:crypto";

const BLOB_ACCESS = "private";
const STORE_PREFIX = "jippi-library/v1";
const MAGIC_TTL_MS = 20 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_RATE_WINDOW_MS = 5 * 60 * 1000;
const IP_RATE_WINDOW_MS = 60 * 60 * 1000;
const IP_RATE_LIMIT = 10;
const COOKIE_NAME = "jippi_lib";
const DELIVERY_TOKEN_RE = /^[A-Za-z0-9_-]{24,96}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRODUCT_IDS = new Set([
  "fortune_theme_card",
  "fortune_theme_career",
  "fortune_theme_love",
  "fortune_theme_destiny",
  "fortune_theme_premium",
  "unknown",
]);

function nowIso(now = Date.now()) {
  return new Date(now).toISOString();
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

function cleanText(value, limit = 160) {
  return String(value ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[<>\u0000-\u001f]/g, "")
    .trim()
    .slice(0, limit);
}

export function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase().slice(0, 254);
  if (!EMAIL_RE.test(email)) throw libraryError("INVALID_EMAIL", 400);
  return email;
}

function maskEmail(email) {
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, Math.min(8, local.length - visible.length)))}@${domain}`;
}

function cleanDeliveryToken(value) {
  const token = String(value ?? "").trim();
  if (!DELIVERY_TOKEN_RE.test(token)) throw libraryError("INVALID_DELIVERY_TOKEN", 400);
  return token;
}

function cleanProductId(value) {
  const productId = cleanText(value || "unknown", 64);
  return PRODUCT_IDS.has(productId) ? productId : "unknown";
}

function cleanDeliveryMeta(value = {}) {
  return {
    productId: cleanProductId(value.productId),
    productName: cleanText(value.productName || "지피 리포트", 80),
    title: cleanText(value.title || value.productName || "지피 리포트", 140),
    calculatedAt: /^\d{4}-\d{2}-\d{2}/.test(String(value.calculatedAt || ""))
      ? String(value.calculatedAt).slice(0, 10)
      : "",
  };
}

function libraryError(code, status = 500, details = null) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function isNotFound(error) {
  return /not.?found|404|BlobNotFound/i.test(String(error?.message || error));
}

function isConflict(error) {
  return /precondition|already.?exists|409|412|BlobAlreadyExists|BlobPrecondition/i.test(
    String(error?.name || "") + String(error?.message || error),
  );
}

function hmac(secret, namespace, value) {
  return crypto.createHmac("sha256", secret).update(`${namespace}:${value}`).digest("hex");
}

function timingSafeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function userKey(emailKey) {
  return `${STORE_PREFIX}/users/${emailKey}.json`;
}

function magicKey(tokenKey) {
  return `${STORE_PREFIX}/magic/${tokenKey}.json`;
}

function sessionKey(tokenKey) {
  return `${STORE_PREFIX}/sessions/${tokenKey}.json`;
}

function deliveryKey(token) {
  return `${STORE_PREFIX}/deliveries/${token}.json`;
}

function rateEmailKey(emailKey) {
  return `${STORE_PREFIX}/rates/email/${emailKey}.json`;
}

function rateIpKey(ipKey) {
  return `${STORE_PREFIX}/rates/ip/${ipKey}.json`;
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

export function createBlobLibraryStorage() {
  return {
    async read(key) {
      if (!hasBlobConfig()) throw libraryError("BLOB_STORAGE_NOT_CONFIGURED", 503);
      try {
        const result = await get(key, {
          access: BLOB_ACCESS,
          useCache: false,
          ...blobAuthOptions(),
        });
        const text = await blobText(result);
        if (!text) return null;
        const etag = result.blob?.etag || "";
        if (!etag) throw libraryError("BLOB_ETAG_MISSING", 503);
        return { value: JSON.parse(text), etag };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async write(key, value, options = {}) {
      if (!hasBlobConfig()) throw libraryError("BLOB_STORAGE_NOT_CONFIGURED", 503);
      const writeOptions = {
        access: BLOB_ACCESS,
        contentType: "application/json; charset=utf-8",
        cacheControlMaxAge: 60,
        addRandomSuffix: false,
        allowOverwrite: options.createOnly !== true,
        ...blobAuthOptions(),
      };
      if (options.ifMatch) writeOptions.ifMatch = options.ifMatch;
      try {
        return await put(key, JSON.stringify(value), writeOptions);
      } catch (error) {
        if (isConflict(error)) throw libraryError("STORAGE_CONFLICT", 409);
        throw error;
      }
    },

    async remove(key) {
      if (!hasBlobConfig()) throw libraryError("BLOB_STORAGE_NOT_CONFIGURED", 503);
      await del(key, blobAuthOptions());
    },
  };
}

async function updateJson(storage, key, updater, { attempts = 8, createValue = null } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await storage.read(key);
    const base = current ? structuredClone(current.value) : structuredClone(createValue);
    const next = await updater(base, current);
    try {
      await storage.write(key, next, current
        ? { ifMatch: current.etag }
        : { createOnly: true });
      return next;
    } catch (error) {
      if (error?.code !== "STORAGE_CONFLICT" || attempt === attempts - 1) throw error;
    }
  }
  throw libraryError("STORAGE_CONFLICT", 409);
}

function sessionPublic(user) {
  const items = Array.isArray(user?.items) ? user.items : [];
  return {
    emailMasked: cleanText(user?.emailMasked, 254),
    items: items
      .map((item) => ({
        deliveryToken: cleanDeliveryToken(item.deliveryToken),
        productId: cleanProductId(item.productId),
        productName: cleanText(item.productName, 80),
        title: cleanText(item.title, 140),
        calculatedAt: cleanText(item.calculatedAt, 10),
        savedAt: cleanText(item.savedAt, 32),
        lastOpenedAt: cleanText(item.lastOpenedAt, 32),
        openCount: Math.max(0, Number(item.openCount) || 0),
        href: `/fortune/delivery/${encodeURIComponent(item.deliveryToken)}/`,
      }))
      .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))),
  };
}

function initialUser(emailKey, emailMasked, at) {
  return {
    schema: "JIPPI_LIBRARY_USER_V1",
    emailKey,
    emailMasked,
    createdAt: at,
    updatedAt: at,
    items: [],
  };
}

function getIp(context = {}) {
  return cleanText(context.ip || "", 128).toLowerCase();
}

function getSecret(options = {}) {
  const secret = options.secret || process.env.JIPPI_LIBRARY_HMAC_SECRET || "";
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw libraryError("LIBRARY_SECRET_NOT_CONFIGURED", 503);
  }
  return secret;
}

function getBaseUrl(options = {}) {
  const raw = options.baseUrl || process.env.JIPPI_PUBLIC_BASE_URL || "https://www.jippi.kr";
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw libraryError("INVALID_PUBLIC_BASE_URL", 503);
  }
  return url.origin;
}

async function defaultResolveDelivery(token, meta, baseUrl, storage) {
  const known = await storage.read(deliveryKey(token));
  if (known?.value?.exists === true) return { ...cleanDeliveryMeta(known.value), deliveryToken: token };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  let response;
  try {
    response = await fetch(`${baseUrl}/fortune/delivery/${encodeURIComponent(token)}/`, {
      method: "HEAD",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response?.ok || !String(response.headers.get("content-type") || "").includes("text/html")) {
    throw libraryError("DELIVERY_NOT_FOUND", 404);
  }

  const at = nowIso();
  const record = {
    schema: "JIPPI_LIBRARY_DELIVERY_V1",
    exists: true,
    ...cleanDeliveryMeta(meta),
    firstSeenAt: at,
    updatedAt: at,
  };
  await storage.write(deliveryKey(token), record, { createOnly: true }).catch(async (error) => {
    if (error?.code !== "STORAGE_CONFLICT") throw error;
  });
  return { ...record, deliveryToken: token };
}

async function defaultSendMagicEmail({ email, link, purpose, options = {} }) {
  const apiKey = options.resendApiKey || process.env.RESEND_API_KEY;
  if (!apiKey) throw libraryError("RESEND_NOT_CONFIGURED", 503);
  const from = options.fromEmail
    || process.env.LIBRARY_FROM_EMAIL
    || process.env.ORDER_FROM_EMAIL
    || process.env.JIPPI_FROM_EMAIL;
  if (!from) throw libraryError("LIBRARY_FROM_EMAIL_NOT_CONFIGURED", 503);
  const subject = purpose === "claim" ? "지피 리포트를 보관함에 저장해 주세요" : "지피 보관함을 열어 주세요";
  const intro = purpose === "claim"
    ? "아래 링크를 누르면 지금 읽은 리포트가 보관함에 저장됩니다."
    : "아래 링크를 누르면 지피 보관함이 열립니다.";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject,
      text: `${intro}\n\n${link}\n\n이 링크는 20분 동안 한 번만 사용할 수 있습니다.`,
    }),
  });
  if (!response.ok) throw libraryError("MAGIC_EMAIL_FAILED", 502);
  return { ok: true };
}

export function createLibraryService(options = {}) {
  const storage = options.storage || createBlobLibraryStorage();
  const secret = getSecret(options);
  const baseUrl = getBaseUrl(options);
  const clock = options.clock || (() => Date.now());
  const resolveDelivery = options.resolveDelivery || ((token, meta) => defaultResolveDelivery(token, meta, baseUrl, storage));
  const sendMagicEmail = options.sendMagicEmail || ((input) => defaultSendMagicEmail({ ...input, options }));

  const digest = (namespace, value) => hmac(secret, namespace, value);

  async function enforceRate(emailKey, ip, now) {
    const ipKey = digest("ip", ip || "unknown");
    const emailRate = await storage.read(rateEmailKey(emailKey));
    if (emailRate && now - Date.parse(emailRate.value.lastSentAt) < EMAIL_RATE_WINDOW_MS) {
      throw libraryError("EMAIL_RATE_LIMITED", 429);
    }
    const ipRate = await storage.read(rateIpKey(ipKey));
    const recent = (Array.isArray(ipRate?.value?.requests) ? ipRate.value.requests : [])
      .map((value) => Number(value))
      .filter((value) => now - value < IP_RATE_WINDOW_MS);
    if (recent.length >= IP_RATE_LIMIT) throw libraryError("IP_RATE_LIMITED", 429);

    try {
      await storage.write(rateEmailKey(emailKey), {
        schema: "JIPPI_LIBRARY_RATE_EMAIL_V1",
        lastSentAt: nowIso(now),
      }, emailRate ? { ifMatch: emailRate.etag } : { createOnly: true });
    } catch (error) {
      if (error?.code === "STORAGE_CONFLICT") throw libraryError("EMAIL_RATE_LIMITED", 429);
      throw error;
    }
    await updateJson(storage, rateIpKey(ipKey), (value) => ({
      schema: "JIPPI_LIBRARY_RATE_IP_V1",
      requests: [...(Array.isArray(value?.requests) ? value.requests : [])
        .map(Number)
        .filter((entry) => now - entry < IP_RATE_WINDOW_MS), now],
      updatedAt: nowIso(now),
    }), { createValue: { requests: [] } });
  }

  async function createMagic({ email, purpose, delivery = null, context = {} }) {
    const now = clock();
    const normalized = normalizeEmail(email);
    const emailKey = digest("email", normalized);
    await enforceRate(emailKey, getIp(context), now);
    const rawToken = randomToken();
    const tokenKey = digest("magic", rawToken);
    const record = {
      schema: "JIPPI_LIBRARY_MAGIC_V1",
      purpose,
      status: "pending",
      emailKey,
      emailMasked: maskEmail(normalized),
      deliveryToken: delivery?.deliveryToken || "",
      deliveryMeta: delivery ? cleanDeliveryMeta(delivery) : null,
      createdAt: nowIso(now),
      expiresAt: nowIso(now + MAGIC_TTL_MS),
      createdIpKey: digest("ip", getIp(context) || "unknown"),
    };
    await storage.write(magicKey(tokenKey), record, { createOnly: true });
    // Keep the one-time credential out of HTTP request URLs, access logs and
    // referrer headers. The browser exchanges the fragment after removing it.
    const link = `${baseUrl}/my#token=${encodeURIComponent(rawToken)}`;
    await sendMagicEmail({ email: normalized, link, purpose });
    return { emailKey, rawToken, record };
  }

  async function requestClaim(input, context = {}) {
    const deliveryToken = cleanDeliveryToken(input?.deliveryToken);
    const delivery = await resolveDelivery(deliveryToken, cleanDeliveryMeta(input));
    const magic = await createMagic({ email: input?.email, purpose: "claim", delivery, context });
    return { ok: true, verificationRequired: true, emailMasked: magic.record.emailMasked };
  }

  async function requestLink(input, context = {}) {
    let normalized;
    try {
      normalized = normalizeEmail(input?.email);
    } catch {
      return { ok: true, verificationRequired: true };
    }
    const emailKey = digest("email", normalized);
    const user = await storage.read(userKey(emailKey));
    if (!user) return { ok: true, verificationRequired: true };
    try {
      await createMagic({ email: normalized, purpose: "login", context });
    } catch (error) {
      if (!["EMAIL_RATE_LIMITED", "IP_RATE_LIMITED"].includes(error?.code)) throw error;
    }
    return { ok: true, verificationRequired: true };
  }

  async function exchangeSession(rawToken, context = {}) {
    const token = String(rawToken ?? "").trim();
    if (!/^[a-f0-9]{64}$/.test(token)) throw libraryError("INVALID_MAGIC_TOKEN", 400);
    const tokenKey = digest("magic", token);
    const stored = await storage.read(magicKey(tokenKey));
    if (!stored) throw libraryError("INVALID_OR_EXPIRED_MAGIC_TOKEN", 400);
    const record = stored.value;
    if (record.status !== "pending") throw libraryError("MAGIC_TOKEN_USED", 409);
    if (Date.parse(record.expiresAt) <= clock()) throw libraryError("MAGIC_TOKEN_EXPIRED", 400);

    const consuming = { ...record, status: "consuming", consumingAt: nowIso(clock()) };
    try {
      await storage.write(magicKey(tokenKey), consuming, { ifMatch: stored.etag });
    } catch (error) {
      if (error?.code === "STORAGE_CONFLICT") throw libraryError("MAGIC_TOKEN_USED", 409);
      throw error;
    }

    const at = nowIso(clock());
    const user = await updateJson(storage, userKey(record.emailKey), (value) => {
      const next = value || initialUser(record.emailKey, record.emailMasked, at);
      next.emailKey = record.emailKey;
      next.emailMasked = record.emailMasked;
      next.updatedAt = at;
      next.items = Array.isArray(next.items) ? next.items : [];
      if (record.purpose === "claim" && record.deliveryToken) {
        const index = next.items.findIndex((item) => item.deliveryToken === record.deliveryToken);
        const existing = index >= 0 ? next.items[index] : {};
        const item = {
          ...existing,
          deliveryToken: record.deliveryToken,
          ...cleanDeliveryMeta(record.deliveryMeta || {}),
          savedAt: existing.savedAt || at,
          lastOpenedAt: existing.lastOpenedAt || "",
          openCount: Math.max(0, Number(existing.openCount) || 0),
        };
        if (index >= 0) next.items[index] = item;
        else next.items.push(item);
      }
      return next;
    }, { createValue: initialUser(record.emailKey, record.emailMasked, at) });

    const rawSession = randomToken();
    const sessionDigest = digest("session", rawSession);
    await storage.write(sessionKey(sessionDigest), {
      schema: "JIPPI_LIBRARY_SESSION_V1",
      emailKey: record.emailKey,
      createdAt: at,
      expiresAt: nowIso(clock() + SESSION_TTL_MS),
      createdIpKey: digest("ip", getIp(context) || "unknown"),
    }, { createOnly: true });
    await storage.write(magicKey(tokenKey), {
      ...consuming,
      status: "used",
      usedAt: at,
    }, { ifMatch: (await storage.read(magicKey(tokenKey)))?.etag });
    return { ok: true, sessionToken: rawSession, library: sessionPublic(user) };
  }

  async function authenticate(rawSession) {
    const token = String(rawSession ?? "").trim();
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const digestValue = digest("session", token);
    const session = await storage.read(sessionKey(digestValue));
    if (!session || Date.parse(session.value.expiresAt) <= clock()) return null;
    const user = await storage.read(userKey(session.value.emailKey));
    return user ? { sessionKey: digestValue, session: session.value, user: user.value } : null;
  }

  async function getLibrary(rawSession) {
    const auth = await authenticate(rawSession);
    if (!auth) throw libraryError("AUTH_REQUIRED", 401);
    return { ok: true, library: sessionPublic(auth.user) };
  }

  async function logout(rawSession) {
    const token = String(rawSession ?? "").trim();
    if (/^[a-f0-9]{64}$/.test(token)) {
      await storage.remove(sessionKey(digest("session", token))).catch(() => {});
    }
    return { ok: true };
  }

  async function recordOpen(input, rawSession) {
    const deliveryToken = cleanDeliveryToken(input?.deliveryToken);
    const auth = await authenticate(rawSession);
    if (!auth) return { ok: true };
    const at = nowIso(clock());
    await updateJson(storage, userKey(auth.session.emailKey), (user) => {
      const index = (user?.items || []).findIndex((item) => item.deliveryToken === deliveryToken);
      if (index < 0) return user;
      user.items[index].lastOpenedAt = at;
      user.items[index].openCount = Math.max(0, Number(user.items[index].openCount) || 0) + 1;
      user.updatedAt = at;
      return user;
    });
    return { ok: true };
  }

  async function getDeliveryMeta(input) {
    const deliveryToken = cleanDeliveryToken(input?.deliveryToken);
    const delivery = await resolveDelivery(deliveryToken, {});
    return { ok: true, delivery: { ...cleanDeliveryMeta(delivery), deliveryToken } };
  }

  return {
    requestClaim,
    requestLink,
    exchangeSession,
    getLibrary,
    logout,
    recordOpen,
    getDeliveryMeta,
    authenticate,
  };
}

function parseCookies(header = "") {
  return String(header)
    .split(";")
    .map((part) => part.trim().split("="))
    .filter(([key]) => key)
    .reduce((out, [key, ...rest]) => {
      const value = rest.join("=");
      try {
        out[key] = decodeURIComponent(value);
      } catch {
        // A malformed unrelated cookie must not turn library auth into a 500.
        out[key] = value;
      }
      return out;
    }, {});
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

function requestContext(req) {
  return {
    ip: String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || "")
      .split(",")[0]
      .trim(),
  };
}

function sendJson(res, status, body, cookie = "") {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  if (cookie) res.setHeader("Set-Cookie", cookie);
  res.end(JSON.stringify(body));
}

function sessionCookie(token, maxAge = Math.floor(SESSION_TTL_MS / 1000)) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export async function handleLibrary(req, res, rawAction = "") {
  const action = Array.isArray(rawAction) ? rawAction[0] : String(rawAction || "");
  const cookies = parseCookies(req.headers.cookie || "");
  const session = cookies[COOKIE_NAME] || "";
  try {
    const service = createLibraryService();
    if (!action && req.method === "GET") return sendJson(res, 200, await service.getLibrary(session));
    if (action === "claim" && req.method === "POST") {
      return sendJson(res, 200, await service.requestClaim(await readBody(req), requestContext(req)));
    }
    if (action === "link" && req.method === "POST") {
      return sendJson(res, 200, await service.requestLink(await readBody(req), requestContext(req)));
    }
    if (action === "session" && req.method === "POST") {
      const body = await readBody(req);
      const result = await service.exchangeSession(body.token, requestContext(req));
      const { sessionToken, ...publicResult } = result;
      return sendJson(res, 200, publicResult, sessionCookie(sessionToken));
    }
    if (action === "logout" && req.method === "POST") {
      return sendJson(res, 200, await service.logout(session), sessionCookie("", 0));
    }
    if (action === "open" && req.method === "POST") {
      return sendJson(res, 200, await service.recordOpen(await readBody(req), session));
    }
    if (action === "delivery-meta" && req.method === "GET") {
      return sendJson(res, 200, await service.getDeliveryMeta({ deliveryToken: req.query?.deliveryToken }));
    }
    return sendJson(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const code = error?.code || error?.message || "LIBRARY_REQUEST_FAILED";
    const safeCode = status >= 500 ? "LIBRARY_REQUEST_FAILED" : code;
    return sendJson(res, status, { ok: false, error: safeCode });
  }
}

export const __test = {
  STORE_PREFIX,
  COOKIE_NAME,
  deliveryKey,
  magicKey,
  sessionKey,
  userKey,
  hmac,
  timingSafeEqualHex,
  sessionPublic,
};
