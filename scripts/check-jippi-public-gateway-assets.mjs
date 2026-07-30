const baseArg = process.argv.find((arg) => arg.startsWith("--base="));
const base = (baseArg ? baseArg.slice("--base=".length) : "https://www.jippi.kr").replace(/\/+$/, "");
const proof = `gateway-smoke-${Date.now()}`;

const checks = [
  ["/fortune/", /^text\/html\b/i, 20_000],
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

console.table(results);

const failures = results.filter((result) => !result.pass);
if (failures.length > 0) {
  console.error(`JIPPI_PUBLIC_GATEWAY_ASSET_CHECK FAIL ${failures.length}/${results.length}`);
  process.exit(1);
}

console.log(`JIPPI_PUBLIC_GATEWAY_ASSET_CHECK PASS ${results.length}/${results.length} base=${base}`);
