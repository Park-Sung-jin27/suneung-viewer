import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const baseArg = process.argv.find((arg) => arg.startsWith("--base="));
const base = (baseArg ? baseArg.slice("--base=".length) : "https://www.jippi.kr").replace(/\/+$/, "");
const proof = `gateway-smoke-${Date.now()}`;

const checks = [
  ["/fortune/", /^text\/html\b/i, 20_000],
  ["/tarot", /^text\/html\b/i, 20_000],
  ["/room", /^text\/html\b/i, 10_000],
  ["/payment-success.html", /^text\/html\b/i, 4_000],
  ["/fortune-preview.js", /javascript/i, 10_000],
  ["/assets/jippi-payments.js", /javascript/i, 1_000],
  ["/assets/signatures/sig_004_deep_lake.webp", /^image\/webp\b/i, 100_000],
  ["/assets/signatures/sig_011_side_mirror.webp", /^image\/webp\b/i, 100_000],
  ["/assets/mega_chapters/part_04_relation_doors.webp", /^image\/webp\b/i, 100_000],
  ["/assets/mega_chapters/part_03_work_money_compass.webp", /^image\/webp\b/i, 100_000],
  ["/assets/signatures/sig_005_guiding_lantern.webp", /^image\/webp\b/i, 100_000],
  ["/fonts/PretendardVariable.woff2", /^font\/woff2\b/i, 1_000_000],
  ["/fonts/NotoSerifKR-Regular.woff2", /^font\/woff2\b/i, 1_000_000],
  ["/fonts/NotoSerifKR-Bold.woff2", /^font\/woff2\b/i, 1_000_000],
];

const results = [];

for (const [path, expectedType, minimumBytes] of checks) {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${base}${path}${separator}proof=${proof}`;
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "cache-control": "no-cache" },
    });
    const type = response.headers.get("content-type") || "";
    const bytes = Number(response.headers.get("content-length") || 0);
    const pass =
      response.status === 200 &&
      expectedType.test(type) &&
      (bytes === 0 || bytes >= minimumBytes);
    results.push({ path, status: response.status, type, bytes, pass });
  } catch (error) {
    results.push({
      path,
      status: 0,
      type: "",
      bytes: 0,
      pass: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const deliveryRoot = path.join(ROOT, "public", "fortune", "delivery");
const deliveryTokens = fs.readdirSync(deliveryRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const token of deliveryTokens) {
  const route = `/fortune/delivery/${token}/`;
  const localFile = path.join(deliveryRoot, token, "index.html");
  const expected = fs.readFileSync(localFile);
  const expectedHash = crypto.createHash("sha256").update(expected).digest("hex");
  try {
    const response = await fetch(`${base}${route}?proof=${proof}`, {
      redirect: "follow",
      headers: { "cache-control": "no-cache" },
    });
    const actual = Buffer.from(await response.arrayBuffer());
    const actualHash = crypto.createHash("sha256").update(actual).digest("hex");
    results.push({
      path: route,
      status: response.status,
      type: response.headers.get("content-type") || "",
      bytes: actual.length,
      pass: response.status === 200 && actualHash === expectedHash,
    });
  } catch (error) {
    results.push({ path: route, status: 0, type: "", bytes: 0, pass: false, error: error.message });
  }
}

const unknownDeliveryRoute = `/fortune/delivery/gateway-smoke-unknown-${Date.now()}/`;
try {
  const response = await fetch(`${base}${unknownDeliveryRoute}`, {
    redirect: "manual",
    headers: { "cache-control": "no-cache" },
  });
  results.push({
    path: unknownDeliveryRoute,
    status: response.status,
    type: response.headers.get("content-type") || "",
    bytes: Number(response.headers.get("content-length") || 0),
    pass: response.status === 404,
  });
} catch (error) {
  results.push({ path: unknownDeliveryRoute, status: 0, type: "", bytes: 0, pass: false, error: error.message });
}

console.table(results);

const failures = results.filter((result) => !result.pass);
if (failures.length > 0) {
  console.error(`JIPPI_PUBLIC_GATEWAY_ASSET_CHECK FAIL ${failures.length}/${results.length}`);
  process.exit(1);
}

console.log(`JIPPI_PUBLIC_GATEWAY_ASSET_CHECK PASS ${results.length}/${results.length} base=${base}`);
