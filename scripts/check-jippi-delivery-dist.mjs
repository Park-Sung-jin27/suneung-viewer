import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(ROOT, "public", "fortune", "delivery");
const distRoot = path.join(ROOT, "dist", "fortune", "delivery");

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
  if (sha256(source) !== sha256(built)) throw new Error(`Built delivery hash drift: ${token}`);
}

console.log(`JIPPI_DELIVERY_DIST_CHECK PASS reports=${tokens.length}`);
