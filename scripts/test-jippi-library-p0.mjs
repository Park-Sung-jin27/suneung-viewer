import assert from "node:assert/strict";
import { createLibraryService } from "../api/_libraryStore.js";
import { redactSensitiveUrl } from "../api/_growthStore.js";

class MemoryStorage {
  constructor() {
    this.map = new Map();
    this.sequence = 0;
  }

  async read(key) {
    const entry = this.map.get(key);
    return entry ? structuredClone(entry) : null;
  }

  async write(key, value, options = {}) {
    await Promise.resolve();
    const current = this.map.get(key);
    if (options.createOnly && current) throw conflict();
    if (options.ifMatch && (!current || current.etag !== options.ifMatch)) throw conflict();
    const etag = `etag-${++this.sequence}`;
    this.map.set(key, { value: structuredClone(value), etag });
    return { etag };
  }

  async remove(key) {
    this.map.delete(key);
  }

  dump() {
    return JSON.stringify([...this.map.entries()]);
  }
}

function conflict() {
  const error = new Error("STORAGE_CONFLICT");
  error.code = "STORAGE_CONFLICT";
  return error;
}

function tokenFromLink(link) {
  const url = new URL(link);
  assert.equal(url.search, "", "magic credential must not appear in the HTTP request query");
  return new URLSearchParams(url.hash.replace(/^#/, "")).get("token");
}

function expectCode(code) {
  return (error) => error?.code === code;
}

const secret = "test-only-secret-that-is-longer-than-thirty-two-bytes";
const email = "reader@example.com";
const storage = new MemoryStorage();
const sent = [];
let now = Date.parse("2026-08-04T09:00:00.000Z");

const service = createLibraryService({
  storage,
  secret,
  baseUrl: "https://www.jippi.kr",
  clock: () => now,
  resolveDelivery: async (deliveryToken, meta) => ({
    deliveryToken,
    productId: meta.productId || "unknown",
    productName: meta.productName || "지피 리포트",
    title: meta.title || "지피 리포트",
    calculatedAt: meta.calculatedAt || "",
  }),
  sendMagicEmail: async (message) => sent.push(structuredClone(message)),
});

const tokenA = "A".repeat(32);
const tokenB = "B".repeat(32);
const tokenC = "C".repeat(32);

const claimA = await service.requestClaim({
  email,
  deliveryToken: tokenA,
  productId: "fortune_theme_love",
  productName: "연애 리포트",
  title: "첫 번째 리포트",
}, { ip: "192.0.2.10" });
assert.equal(claimA.verificationRequired, true);
assert.equal(await storage.read([...storage.map.keys()].find((key) => key.includes("/users/"))), null);
assert.equal(sent.length, 1);
assert(!storage.dump().includes(email), "plaintext email leaked into storage");
assert(!storage.dump().includes(tokenFromLink(sent[0].link)), "raw magic token leaked into storage");

now += 5 * 60 * 1000 + 1;
await service.requestClaim({
  email,
  deliveryToken: tokenB,
  productId: "fortune_theme_career",
  productName: "일과 돈 리포트",
  title: "두 번째 리포트",
}, { ip: "192.0.2.10" });

const magicA = tokenFromLink(sent[0].link);
const magicB = tokenFromLink(sent[1].link);
const [exchangeA, exchangeB] = await Promise.all([
  service.exchangeSession(magicA, { ip: "192.0.2.10" }),
  service.exchangeSession(magicB, { ip: "192.0.2.10" }),
]);
assert.equal(exchangeA.ok, true);
assert.equal(exchangeB.ok, true);
const libraryA = await service.getLibrary(exchangeA.sessionToken);
assert.deepEqual(libraryA.library.items.map((item) => item.deliveryToken).sort(), [tokenA, tokenB]);
assert(!JSON.stringify(libraryA).includes("emailKey"));
assert(!JSON.stringify(libraryA).includes("createdIp"));
await assert.rejects(() => service.exchangeSession(magicA), expectCode("MAGIC_TOKEN_USED"));

await service.recordOpen({ deliveryToken: tokenA }, exchangeA.sessionToken);
const opened = await service.getLibrary(exchangeA.sessionToken);
assert.equal(opened.library.items.find((item) => item.deliveryToken === tokenA).openCount, 1);

now += 5 * 60 * 1000 + 1;
await service.requestClaim({
  email: "another@example.net",
  deliveryToken: tokenA,
  title: "공유 가능한 원래 링크",
}, { ip: "192.0.2.11" });
const other = await service.exchangeSession(tokenFromLink(sent.at(-1).link), { ip: "192.0.2.11" });
const otherLibrary = await service.getLibrary(other.sessionToken);
assert.equal(otherLibrary.library.items[0].deliveryToken, tokenA, "same report must be bookmarkable by another verified email");

now += 5 * 60 * 1000 + 1;
const sentBeforeMissing = sent.length;
assert.deepEqual(
  await service.requestLink({ email: "missing@example.org" }, { ip: "192.0.2.12" }),
  { ok: true, verificationRequired: true },
);
assert.equal(sent.length, sentBeforeMissing, "unknown account must not receive mail");
assert.deepEqual(
  await service.requestLink({ email: "not-an-email" }, { ip: "192.0.2.12" }),
  { ok: true, verificationRequired: true },
);

await service.requestLink({ email }, { ip: "192.0.2.13" });
assert.equal(sent.length, sentBeforeMissing + 1, "existing account should receive login link");
const login = await service.exchangeSession(tokenFromLink(sent.at(-1).link), { ip: "192.0.2.13" });
assert.equal((await service.getLibrary(login.sessionToken)).library.items.length, 2);
await service.logout(login.sessionToken);
await assert.rejects(() => service.getLibrary(login.sessionToken), expectCode("AUTH_REQUIRED"));

const expiringStorage = new MemoryStorage();
const expiringSent = [];
let expiringNow = now;
const expiringService = createLibraryService({
  storage: expiringStorage,
  secret,
  baseUrl: "https://www.jippi.kr",
  clock: () => expiringNow,
  resolveDelivery: async (deliveryToken) => ({ deliveryToken, title: "만료 검사" }),
  sendMagicEmail: async (message) => expiringSent.push(message),
});
await expiringService.requestClaim({ email: "expiry@example.com", deliveryToken: tokenC }, { ip: "198.51.100.1" });
expiringNow += 20 * 60 * 1000 + 1;
await assert.rejects(
  () => expiringService.exchangeSession(tokenFromLink(expiringSent[0].link)),
  expectCode("MAGIC_TOKEN_EXPIRED"),
);

const rateStorage = new MemoryStorage();
const rateService = createLibraryService({
  storage: rateStorage,
  secret,
  baseUrl: "https://www.jippi.kr",
  clock: () => now,
  resolveDelivery: async (deliveryToken) => ({ deliveryToken, title: "속도 제한" }),
  sendMagicEmail: async () => {},
});
await rateService.requestClaim({ email: "rate@example.com", deliveryToken: tokenC }, { ip: "203.0.113.1" });
await assert.rejects(
  () => rateService.requestClaim({ email: "rate@example.com", deliveryToken: tokenC }, { ip: "203.0.113.1" }),
  expectCode("EMAIL_RATE_LIMITED"),
);

const parallelRateStorage = new MemoryStorage();
const parallelRateSent = [];
const parallelRateService = createLibraryService({
  storage: parallelRateStorage,
  secret,
  baseUrl: "https://www.jippi.kr",
  clock: () => now,
  resolveDelivery: async (deliveryToken) => ({ deliveryToken, title: "동시 요청 검사" }),
  sendMagicEmail: async (message) => parallelRateSent.push(message),
});
const parallelRateResults = await Promise.allSettled([
  parallelRateService.requestClaim({ email: "parallel@example.com", deliveryToken: tokenA }, { ip: "203.0.113.2" }),
  parallelRateService.requestClaim({ email: "parallel@example.com", deliveryToken: tokenA }, { ip: "203.0.113.2" }),
]);
assert.equal(parallelRateResults.filter((result) => result.status === "fulfilled").length, 1);
assert.equal(parallelRateResults.filter((result) => result.status === "rejected" && result.reason?.code === "EMAIL_RATE_LIMITED").length, 1);
assert.equal(parallelRateSent.length, 1, "parallel requests must send exactly one email");

const replayStorage = new MemoryStorage();
const replaySent = [];
const replayService = createLibraryService({
  storage: replayStorage,
  secret,
  baseUrl: "https://www.jippi.kr",
  clock: () => now,
  resolveDelivery: async (deliveryToken) => ({ deliveryToken, title: "동시 재사용 검사" }),
  sendMagicEmail: async (message) => replaySent.push(message),
});
await replayService.requestClaim({ email: "replay@example.com", deliveryToken: tokenB }, { ip: "203.0.113.3" });
const replayToken = tokenFromLink(replaySent[0].link);
const replayResults = await Promise.allSettled([
  replayService.exchangeSession(replayToken, { ip: "203.0.113.3" }),
  replayService.exchangeSession(replayToken, { ip: "203.0.113.3" }),
]);
assert.equal(replayResults.filter((result) => result.status === "fulfilled").length, 1);
assert.equal(replayResults.filter((result) => result.status === "rejected" && result.reason?.code === "MAGIC_TOKEN_USED").length, 1);
assert(!replayStorage.dump().includes(replayToken), "raw magic credential leaked into replay storage");

const sensitiveToken = "x".repeat(32);
const redacted = redactSensitiveUrl(
  `https://www.jippi.kr/fortune/delivery/${sensitiveToken}/?paymentKey=secret&orderId=order-1&safe=yes`,
);
assert(!redacted.includes(sensitiveToken));
assert(!redacted.includes("secret"));
assert(!redacted.includes("order-1"));
assert(redacted.includes("[redacted]"));
assert(redacted.includes("safe=yes"));

await assert.rejects(
  () => service.requestClaim({ email, deliveryToken: "short" }),
  expectCode("INVALID_DELIVERY_TOKEN"),
);
await assert.rejects(() => service.exchangeSession("bad"), expectCode("INVALID_MAGIC_TOKEN"));

console.log(JSON.stringify({
  ok: true,
  tests: 25,
  concurrentLibraryItems: libraryA.library.items.length,
  plaintextEmailInStorage: false,
  replayBlocked: true,
  crossEmailBookmarkAllowed: true,
  analyticsTokenRedacted: true,
  parallelRateLimitBlocked: true,
  simultaneousReplayBlocked: true,
  magicTokenUsesFragment: true,
}, null, 2));
