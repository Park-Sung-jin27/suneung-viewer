import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIRECTORY = process.env.MATH_LEGACY_SOURCE_DIRECTORY
  ? path.resolve(process.env.MATH_LEGACY_SOURCE_DIRECTORY)
  : path.join(ROOT, "raw_sources", "math_eval_pdfs_legacy");
const MANIFEST_PATH = path.join(
  ROOT,
  "평가원_수학영어_확장",
  "08_math_data",
  "math_legacy_source_manifest_v1.json",
);
const LIST_ENDPOINT =
  "https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperListAjax.ajax";
const DOWNLOAD_BASE = "https://wdown.ebsi.co.kr/W61001/01exam";
const ACTUAL_YEARS = [2016, 2017, 2018, 2019, 2020];
const TRACK_LABELS = { ga: "가형", na: "나형" };
const SESSION_LABELS = { "06": "6월", "09": "9월", csat: "수능" };

function fail(code, detail = "") {
  throw new Error(`${code}${detail ? `: ${detail}` : ""}`);
}

function ensure(condition, code, detail = "") {
  if (!condition) fail(code, detail);
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath) {
  return sha256Buffer(readFileSync(filePath));
}

function fingerprint(value) {
  return sha256Buffer(JSON.stringify(value));
}

function decodeHtml(value) {
  return String(value ?? "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteDownloadUrl(value) {
  const normalized = String(value).replace(/^http:/, "https:");
  return normalized.startsWith("https://")
    ? normalized
    : `${DOWNLOAD_BASE}${normalized}`;
}

function firstArgument(block, functionName) {
  const pattern = new RegExp(`${functionName}\\('([^']+)'`);
  return block.match(pattern)?.[1] ?? "";
}

function parseRecordBlock(block, actualYear) {
  const title = decodeHtml(
    block.match(/<div class="qus_tit">([\s\S]*?)<\/div>/)?.[1],
  );
  if (!title || !/수학\s*(?:가|나)형/.test(title)) return null;
  if (title.includes("짝수형")) return null;

  const track = /수학\s*가형/.test(title) ? "ga" : "na";
  const session = title.includes("대학수학능력시험")
    ? "csat"
    : title.includes("9월")
      ? "09"
      : title.includes("6월")
        ? "06"
        : "";
  ensure(session, "LEGACY_SESSION_PARSE", title);

  const problem = firstArgument(block, "goDownLoadP");
  const answer = firstArgument(block, "goDownLoadJ");
  const explanation = firstArgument(block, "goDownLoadH");
  ensure(problem && answer && explanation, "LEGACY_SOURCE_URL", title);

  const schoolYear = actualYear + 1;
  const examKey = `math_${schoolYear}_${session}_${track}`;
  const filenamePrefix = `${schoolYear}학년도_${SESSION_LABELS[session]}_수학_${TRACK_LABELS[track]}`;
  const answerExtension = path.extname(new URL(answer).pathname) || ".jpg";
  return {
    examKey,
    schoolYear,
    actualYear,
    session,
    sessionLabel: SESSION_LABELS[session],
    curriculum: "legacy_ga_na",
    track,
    trackLabel: TRACK_LABELS[track],
    title,
    expectedQuestionCount: 30,
    sourceUrls: {
      problem: absoluteDownloadUrl(problem),
      answer: absoluteDownloadUrl(answer),
      explanation: absoluteDownloadUrl(explanation),
    },
    filenames: {
      problem: `${filenamePrefix}_문제.pdf`,
      answer: `${filenamePrefix}_정답${answerExtension}`,
      explanation: `${filenamePrefix}_해설.pdf`,
    },
  };
}

async function fetchYearRecords(actualYear) {
  const body = new URLSearchParams({
    targetCd: "D300",
    yearList: String(actualYear),
    monthList: "06,09,11,12",
    arOrd: "2",
    subjIdList: "firstEnter",
    sort: "recent",
    currentPage: "1",
  });
  const response = await fetch(LIST_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body,
  });
  ensure(response.ok, "LEGACY_LIST_FETCH", `${actualYear}:${response.status}`);
  const html = await response.text();
  const records = html
    .split('<div class="qus_box math">')
    .slice(1)
    .map((block) => parseRecordBlock(block, actualYear))
    .filter(Boolean);
  ensure(records.length === 6, "LEGACY_YEAR_SCOPE", `${actualYear}:${records.length}`);
  return records;
}

async function discoverRecords() {
  const records = (
    await Promise.all(ACTUAL_YEARS.map((year) => fetchYearRecords(year)))
  ).flat();
  ensure(records.length === 30, "LEGACY_EXAM_SCOPE", String(records.length));
  ensure(new Set(records.map((record) => record.examKey)).size === 30, "LEGACY_EXAM_DUPLICATE");
  return records.sort((left, right) => left.examKey.localeCompare(right.examKey));
}

async function downloadArtifact(url, filePath) {
  const response = await fetch(url);
  ensure(response.ok, "LEGACY_FILE_FETCH", `${response.status}:${url}`);
  const content = Buffer.from(await response.arrayBuffer());
  ensure(content.length > 1_000, "LEGACY_FILE_TOO_SMALL", `${content.length}:${url}`);
  writeFileSync(filePath, content);
  return {
    size: content.length,
    sha256: sha256Buffer(content),
  };
}

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return null;
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

function sourceAvailability(records) {
  const filenames = records.flatMap((record) => Object.values(record.filenames));
  const available = filenames.filter((filename) =>
    existsSync(path.join(SOURCE_DIRECTORY, filename)),
  ).length;
  if (available > 0 && available < filenames.length) {
    fail("LEGACY_SOURCE_PARTIAL", `${available}/${filenames.length}`);
  }
  return available === filenames.length ? "verified" : "recorded";
}

function recordedArtifactsByExam(manifest) {
  return new Map((manifest?.exams ?? []).map((exam) => [exam.examKey, exam.artifacts]));
}

async function buildManifest(records, mode) {
  const recordedManifest = readManifest();
  const recordedArtifacts = recordedArtifactsByExam(recordedManifest);
  const availability = sourceAvailability(records);
  ensure(mode !== "--write" || availability === "verified", "LEGACY_SOURCE_REQUIRED_FOR_WRITE");
  ensure(availability === "verified" || recordedManifest, "LEGACY_RECORDED_MANIFEST_MISSING");

  const exams = [];
  for (const record of records) {
    const artifacts = {};
    for (const kind of ["problem", "answer", "explanation"]) {
      const filePath = path.join(SOURCE_DIRECTORY, record.filenames[kind]);
      if (availability === "verified") {
        artifacts[kind] = {
          filename: record.filenames[kind],
          url: record.sourceUrls[kind],
          size: statSync(filePath).size,
          sha256: sha256File(filePath),
        };
      } else {
        const recorded = recordedArtifacts.get(record.examKey)?.[kind];
        ensure(recorded?.filename === record.filenames[kind], "LEGACY_RECORDED_FILENAME", `${record.examKey}:${kind}`);
        ensure(recorded?.url === record.sourceUrls[kind], "LEGACY_RECORDED_URL", `${record.examKey}:${kind}`);
        ensure(Number(recorded?.size) > 1_000, "LEGACY_RECORDED_SIZE", `${record.examKey}:${kind}`);
        ensure(/^[a-f0-9]{64}$/.test(recorded?.sha256 ?? ""), "LEGACY_RECORDED_HASH", `${record.examKey}:${kind}`);
        artifacts[kind] = recorded;
      }
    }
    exams.push({
      examKey: record.examKey,
      schoolYear: record.schoolYear,
      actualYear: record.actualYear,
      session: record.session,
      sessionLabel: record.sessionLabel,
      curriculum: record.curriculum,
      track: record.track,
      trackLabel: record.trackLabel,
      title: record.title,
      expectedQuestionCount: record.expectedQuestionCount,
      extractionStatus: "pending",
      answerCrossCheckStatus: "pending",
      artifacts,
    });
  }

  const sourceRows = exams.flatMap((exam) =>
    Object.entries(exam.artifacts).map(([kind, artifact]) => [
      exam.examKey,
      kind,
      artifact.filename,
      artifact.url,
      artifact.size,
      artifact.sha256,
    ]),
  );
  ensure(sourceRows.length === 90, "LEGACY_ARTIFACT_SCOPE", String(sourceRows.length));
  ensure(new Set(sourceRows.map((row) => row[5])).size === 90, "LEGACY_ARTIFACT_HASH_DUPLICATE");

  return {
    schemaVersion: "math-legacy-source-manifest-v1",
    status: "internal_source_inventory",
    publicConnected: false,
    scope: {
      schoolYears: [2017, 2018, 2019, 2020, 2021],
      sessions: ["06", "09", "csat"],
      tracks: ["ga", "na"],
      curriculum: "legacy_ga_na",
    },
    summary: {
      schoolYearCount: 5,
      examCount: exams.length,
      expectedQuestionCount: exams.reduce(
        (sum, exam) => sum + exam.expectedQuestionCount,
        0,
      ),
      sourceArtifactCount: sourceRows.length,
      extractedQuestionCount: 0,
      answerCrossCheckCount: 0,
    },
    exams,
    integrity: {
      examFingerprint: fingerprint(exams.map((exam) => exam.examKey)),
      sourceFingerprint: fingerprint(sourceRows),
    },
  };
}

async function downloadSources(records) {
  mkdirSync(SOURCE_DIRECTORY, { recursive: true });
  for (const record of records) {
    await Promise.all(
      ["problem", "answer", "explanation"].map((kind) =>
        downloadArtifact(
          record.sourceUrls[kind],
          path.join(SOURCE_DIRECTORY, record.filenames[kind]),
        ),
      ),
    );
    console.log(`MATH_LEGACY_SOURCE_DOWNLOAD: ${record.examKey}`);
  }
}

const mode = process.argv[2] ?? "--check";
ensure(["--check", "--write", "--download"].includes(mode), "MODE_INVALID", mode);
const records = await discoverRecords();
if (mode === "--download") await downloadSources(records);
const manifest = await buildManifest(records, mode === "--download" ? "--write" : mode);
const serialized = stableJson(manifest);

if (mode === "--write" || mode === "--download") {
  writeFileSync(MANIFEST_PATH, serialized, "utf8");
} else {
  ensure(existsSync(MANIFEST_PATH), "LEGACY_MANIFEST_MISSING", MANIFEST_PATH);
  ensure(readFileSync(MANIFEST_PATH, "utf8") === serialized, "LEGACY_MANIFEST_DRIFT");
}

console.log(
  `MATH_LEGACY_SOURCE_INVENTORY: pass mode=${mode.slice(2)} years=${manifest.summary.schoolYearCount} exams=${manifest.summary.examCount} questions=${manifest.summary.expectedQuestionCount} sources=${manifest.summary.sourceArtifactCount} extracted=${manifest.summary.extractedQuestionCount} answers=${manifest.summary.answerCrossCheckCount}`,
);
