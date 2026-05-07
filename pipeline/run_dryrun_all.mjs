import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const envPath = path.join(rootDir, ".env");
dotenv.config({ path: envPath });

const args = process.argv.slice(2);

function getArg(name, fallback = null) {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

const limitRaw = getArg("--limit", null);
const limit = limitRaw ? Number.parseInt(limitRaw, 10) : null;

const outPath = getArg("--out", null);
const failFast = args.includes("--fail-fast");

const tempRaw = getArg("--temperature", null);
const temperature = tempRaw !== null ? Number.parseFloat(tempRaw) : 1;

if (tempRaw !== null && !Number.isFinite(temperature)) {
  console.error(`Invalid --temperature value: ${tempRaw}`);
  process.exit(1);
}

if (!outPath) {
  console.error("Usage: node pipeline/run_dryrun_all.mjs --out <output_json> [--limit N] [--fail-fast] [--temperature T]");
  process.exit(1);
}

if (limitRaw && (!Number.isFinite(limit) || limit <= 0)) {
  console.error(`Invalid --limit value: ${limitRaw}`);
  process.exit(1);
}

console.log(`[run_dryrun_all] .env path: ${envPath}`);
console.log(`[run_dryrun_all] OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "loaded" : "MISSING"}`);
console.log(`[run_dryrun_all] temperature: ${temperature}`);

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY missing after dotenv load. Aborting.");
  process.exit(1);
}

const { createOpenAICaller } = await import("./d_engine_caller_openai.mjs");
const { callDEngineWithMajority } = await import("./d_engine_wrapper.mjs");

const inputsPath = path.join(rootDir, "config", "d_engine_dryrun_inputs.json");
const outputPath = path.join(rootDir, outPath);

const inputs = JSON.parse(fs.readFileSync(inputsPath, "utf8"));
const samples = inputs.samples || inputs;

if (!Array.isArray(samples)) {
  console.error("Invalid d_engine_dryrun_inputs.json: expected samples array or root array.");
  process.exit(1);
}

const targetSamples = limit ? samples.slice(0, limit) : samples;

console.log(`[run_dryrun_all] total samples: ${samples.length}`);
console.log(`[run_dryrun_all] target samples: ${targetSamples.length}`);
console.log(`[run_dryrun_all] output: ${outputPath}`);

const caller = createOpenAICaller({});
const results = [];

for (let i = 0; i < targetSamples.length; i++) {
  const sample = targetSamples[i];
  const sampleId = sample.sample_id;

  if (!sampleId) {
    const msg = `Sample at index ${i} has no sample_id`;
    if (failFast) {
      console.error(msg);
      process.exit(1);
    }
    results.push({ sample_id: null, error: msg });
    continue;
  }

  const input = sample.input || sample;

  console.log(`[${i + 1}/${targetSamples.length}] ${sampleId} ...`);

  try {
    const wrapperResult = await callDEngineWithMajority(input, { caller, temperature });
    const final = wrapperResult.final || {};

    results.push({
      sample_id: sampleId,
      decision: wrapperResult.decision,
      pass: final.pass ?? null,
      error_type: final.error_type ?? null,
      rule_hits: final.rule_hits ?? [],
      reason: final.reason ?? "",
      confidence: final.confidence ?? null,
      _metadata: wrapperResult.metadata ?? null
    });

    console.log(
      `  decision=${wrapperResult.decision} pass=${final.pass ?? "null"} error_type=${final.error_type ?? "null"}`
    );
  } catch (error) {
    const msg = error?.message || String(error);
    console.error(`  ERROR: ${msg}`);

    if (failFast) {
      throw error;
    }

    results.push({
      sample_id: sampleId,
      decision: "ERROR",
      pass: null,
      error_type: "ERROR",
      rule_hits: [],
      reason: msg,
      confidence: null,
      error: msg
    });
  }
}

const payload = {
  generated_at: new Date().toISOString(),
  source: inputsPath,
  mode: limit ? "smoke" : "full",
  total_samples: samples.length,
  target_samples: targetSamples.length,
  results
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

console.log(`[run_dryrun_all] wrote ${results.length} results to ${outputPath}`);
