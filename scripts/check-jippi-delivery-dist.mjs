import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(ROOT, "public", "fortune", "delivery");
const distRoot = path.join(ROOT, "dist", "fortune", "delivery");
const footerTag = '<script src="/fortune/delivery/_footer.js" defer></script>';
const noReferrerTag = '<meta name="referrer" content="no-referrer"';

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const tokens = fs.readdirSync(sourceRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (tokens.length === 0) throw new Error("No tracked fortune delivery files found");
if (fs.existsSync(path.join(ROOT, "dist", "fortune", "index.html"))) {
  throw new Error("Legacy fortune landing leaked into dist; it must remain a Netlify proxy");
}

for (const token of tokens) {
  const source = path.join(sourceRoot, token, "index.html");
  const built = path.join(distRoot, token, "index.html");
  if (!fs.existsSync(built)) throw new Error(`Built delivery missing: ${token}`);
  if (!fs.readFileSync(source, "utf8").includes(footerTag)) {
    throw new Error(`Delivery library footer missing in source: ${token}`);
  }
  if (!fs.readFileSync(source, "utf8").includes(noReferrerTag)) {
    throw new Error(`Delivery no-referrer policy missing in source: ${token}`);
  }
  if (!fs.readFileSync(built, "utf8").includes(footerTag)) {
    throw new Error(`Delivery library footer missing in build: ${token}`);
  }
  if (!fs.readFileSync(built, "utf8").includes(noReferrerTag)) {
    throw new Error(`Delivery no-referrer policy missing in build: ${token}`);
  }
  if (sha256(source) !== sha256(built)) throw new Error(`Built delivery hash drift: ${token}`);
}

for (const relative of [
  path.join("fortune", "delivery", "_footer.js"),
  "my.html",
  "my.js",
]) {
  const source = path.join(ROOT, "public", relative);
  const built = path.join(ROOT, "dist", relative);
  if (!fs.existsSync(source) || !fs.existsSync(built)) {
    throw new Error(`Library static asset missing: ${relative}`);
  }
  if (sha256(source) !== sha256(built)) {
    throw new Error(`Library static asset hash drift: ${relative}`);
  }
}

console.log(`JIPPI_DELIVERY_DIST_CHECK PASS reports=${tokens.length}`);
