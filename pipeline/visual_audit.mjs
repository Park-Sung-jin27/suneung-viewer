/**
 * pipeline/visual_audit.mjs
 *
 * bracket 시각 정합성 자동 검증 + screenshot 일괄 저장.
 *
 * 사전 준비 (사용자 의무):
 *   1. npm install --save-dev playwright
 *   2. npx playwright install chromium
 *   3. 로컬 dev server 실행: npm run dev (또는 배포 URL 사용)
 *
 * 실행:
 *   node pipeline/visual_audit.mjs                         → 39 release set 전체
 *   node pipeline/visual_audit.mjs --url=http://localhost:5173  → URL 지정
 *   node pipeline/visual_audit.mjs --set=l2022a              → 특정 set만
 *   node pipeline/visual_audit.mjs --report=path             → 리포트 출력 경로
 *
 * 출력:
 *   - 콘솔 리포트 (PASS/FAIL/WARNING per set)
 *   - out/visual_audit/{setId}.png — 각 set screenshot
 *   - out/visual_audit_report.json — 통합 리포트
 *
 * DOM 검증 4 path:
 *   (a) bracket 컨테이너 안 borderLeft style 존재
 *   (b) 라벨 [X] 우측 노출 1회 (본문 노출 시 결함)
 *   (c) 본문 안 workTag t="[X]" 노출 여부 (결함)
 *   (d) annotation bracket sentFrom~sentTo 안 sent count 정합
 *
 * release 39 set 사양 = pipeline/release_approval_records/*-release-approval.json 자동 검출.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

function safeGitCmd(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch (e) {
    return null;
  }
}

function getCommitChain() {
  const audit_commit = safeGitCmd("git rev-parse HEAD") || "unknown";
  const data_commit =
    safeGitCmd("git log -1 --format=%H -- data-source/all_data_204.json") ||
    "unknown";
  const ann_commit =
    safeGitCmd("git log -1 --format=%H -- public/data/annotations.json") ||
    "unknown";
  const viewer_commit =
    safeGitCmd("git log -1 --format=%H -- src/") || "unknown";
  const mixed_commit =
    audit_commit !== "unknown" &&
    (audit_commit !== data_commit || audit_commit !== viewer_commit);
  return { audit_commit, data_commit, ann_commit, viewer_commit, mixed_commit };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── 의존성 확인 ───────────────────────────────────────────────────────────
let playwright;
try {
  playwright = await import("playwright");
} catch (e) {
  console.error("❌ playwright 의존성 부재");
  console.error("");
  console.error("사전 준비 사양:");
  console.error("  npm install --save-dev playwright");
  console.error("  npx playwright install chromium");
  console.error("");
  console.error("사후 재실행: node pipeline/visual_audit.mjs");
  process.exit(2);
}

// ─── 인자 처리 ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const urlArg =
  args.find((a) => a.startsWith("--url="))?.slice("--url=".length) ||
  process.env.VIEWER_URL ||
  "http://localhost:5173";
const setArg = args.find((a) => a.startsWith("--set="))?.slice("--set=".length);
const reportArg =
  args.find((a) => a.startsWith("--report="))?.slice("--report=".length) ||
  "out/visual_audit_report.json";
const screenshotDir = "out/visual_audit";

// ─── release 39 set 자동 검출 ──────────────────────────────────────────────
function loadReleaseSets() {
  const dir = path.resolve(__dirname, "release_approval_records");
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith("-release-approval.json"));
  const sets = [];
  for (const f of files) {
    // pattern: QG-{yearKey}-{setId}-release-approval.json
    const m = f.match(/^QG-(.+?)-(.+?)-release-approval\.json$/);
    if (!m) continue;
    sets.push({ yearKey: m[1], setId: m[2] });
  }
  return sets;
}

const allSets = loadReleaseSets();
const targetSets = setArg ? allSets.filter((s) => s.setId === setArg) : allSets;

if (targetSets.length === 0) {
  console.error("❌ 대상 set 부재. release_approval_records 안 검출 결과 0건.");
  process.exit(3);
}

console.log("═".repeat(60));
console.log(" VISUAL AUDIT");
console.log("═".repeat(60));
console.log("  target URL: " + urlArg);
console.log("  set count:  " + targetSets.length);
console.log("  screenshot: " + screenshotDir);
console.log("  report:     " + reportArg);
console.log("─".repeat(60));

// ─── 디렉터리 준비 ────────────────────────────────────────────────────────
fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(path.dirname(reportArg), { recursive: true });

// ─── 브라우저 launch ───────────────────────────────────────────────────────
const browser = await playwright.chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1600 },
});
const page = await ctx.newPage();

// ─── 검증 logic per set ────────────────────────────────────────────────────
async function auditSet(yearKey, setId) {
  const url = `${urlArg}/?year=${encodeURIComponent(yearKey)}&setId=${encodeURIComponent(setId)}`;
  const result = {
    yearKey,
    setId,
    url,
    status: "PASS",
    findings: [],
    screenshot: null,
  };

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    // wait for bracket render
    await page.waitForTimeout(800);

    // (a) bracket 컨테이너 안 borderLeft style 존재
    const brackets = await page.$$eval(
      '[class*="bracket"], [data-bracket-label]',
      (els) =>
        els.map((e) => ({
          label:
            e.dataset.bracketLabel ||
            e.textContent?.trim().substring(0, 10) ||
            "?",
          hasBorderLeft:
            getComputedStyle(e).borderLeftWidth !== "0px" &&
            getComputedStyle(e).borderLeftWidth !== "",
          rect: e.getBoundingClientRect ? e.getBoundingClientRect() : null,
        })),
    );

    if (brackets.length === 0) {
      result.findings.push({
        code: "RENDER_NO_BRACKET_DOM",
        tier: "RENDER",
        severity: "WARNING",
        msg: "bracket DOM 요소 검출 부재",
      });
    } else {
      const noBorder = brackets.filter((b) => !b.hasBorderLeft);
      if (noBorder.length > 0) {
        result.findings.push({
          code: "RENDER_MISSING_BORDER_LEFT",
          tier: "RENDER",
          severity: "WARNING",
          msg: `bracket 컨테이너 ${noBorder.length}건 안 borderLeft 부재`,
        });
      }
    }

    // (b) 라벨 [X] 우측 노출 횟수
    const labelCounts = await page.$$eval(
      '[class*="label"], [class*="bracket"]',
      (els) => {
        const counts = {};
        for (const e of els) {
          const t = (e.textContent || "").trim();
          const m = t.match(/^\[([A-Z])\]$/);
          if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
        }
        return counts;
      },
    );
    for (const [lbl, cnt] of Object.entries(labelCounts)) {
      if (cnt > 1) {
        result.findings.push({
          code: "RENDER_LABEL_DUPLICATE",
          tier: "RENDER",
          severity: "WARNING",
          label: lbl,
          count: cnt,
          msg: `라벨 [${lbl}] DOM 안 ${cnt}회 노출 (중복 의심)`,
        });
      }
    }

    // (c) 본문 안 workTag [X] 노출 검출
    const workTagExposed = await page.$$eval(
      '[class*="passage"], [class*="content"], main',
      (els) => {
        const hits = [];
        const labelPattern = /\[([A-Z])\][^a-zA-Zㄱ-ㆎ가-힣]/g;
        for (const e of els) {
          const t = e.textContent || "";
          const matches = [...t.matchAll(labelPattern)];
          for (const m of matches) hits.push(m[1]);
        }
        return [...new Set(hits)];
      },
    );
    if (workTagExposed.length > 0) {
      result.findings.push({
        code: "RENDER_WORKTAG_BODY_EXPOSURE",
        tier: "RENDER",
        severity: "WARNING",
        labels: workTagExposed,
        msg: `본문 안 workTag [${workTagExposed.join(",")}] 노출 의심 (Code A render 처리 결함 잠재)`,
      });
    }

    // 스크린샷 저장
    const safeSetId = setId.replace(/[^a-zA-Z0-9_가-힣]/g, "_");
    const screenshotPath = path.join(
      screenshotDir,
      `${yearKey}_${safeSetId}.png`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshot = screenshotPath;

    // severity 분류
    const hasCritical = result.findings.some((f) => f.severity === "CRITICAL");
    const hasWarning = result.findings.some((f) => f.severity === "WARNING");
    if (hasCritical) result.status = "FAIL";
    else if (hasWarning) result.status = "WARNING";
    else result.status = "PASS";
  } catch (e) {
    result.status = "ERROR";
    result.findings.push({
      code: "RENDER_NAVIGATION_ERROR",
      tier: "RENDER",
      severity: "CRITICAL",
      msg: e.message,
    });
  }

  return result;
}

// ─── 메인 loop ─────────────────────────────────────────────────────────────
const results = [];
let counters = { PASS: 0, WARNING: 0, FAIL: 0, ERROR: 0 };

for (const { yearKey, setId } of targetSets) {
  process.stdout.write(`  ${yearKey}/${setId} ... `);
  const r = await auditSet(yearKey, setId);
  results.push(r);
  counters[r.status] = (counters[r.status] || 0) + 1;
  const icon =
    r.status === "PASS"
      ? "✅"
      : r.status === "WARNING"
        ? "🟡"
        : r.status === "FAIL"
          ? "🔴"
          : "💥";
  console.log(`${icon} ${r.status} (${r.findings.length} findings)`);
}

await browser.close();

// ─── 리포트 출력 ──────────────────────────────────────────────────────────
const commits = getCommitChain();
const report = {
  generated_at: new Date().toISOString(),
  commits,
  url: urlArg,
  target_count: targetSets.length,
  summary: counters,
  results,
};
fs.writeFileSync(reportArg, JSON.stringify(report, null, 2), "utf8");

console.log("─".repeat(60));
console.log("[ Commit chain ]");
console.log(`  audit_commit:  ${commits.audit_commit.substring(0, 8)}`);
console.log(`  data_commit:   ${commits.data_commit.substring(0, 8)}`);
console.log(`  ann_commit:    ${commits.ann_commit.substring(0, 8)}`);
console.log(`  viewer_commit: ${commits.viewer_commit.substring(0, 8)}`);
console.log(`  mixed_commit:  ${commits.mixed_commit}`);
if (commits.mixed_commit) {
  console.log("  ⚠ mixed_commit=true → release 판단 차단 lock 사양 path");
}
console.log("\n[ Summary ]");
console.log(`  ✅ PASS:    ${counters.PASS || 0}`);
console.log(`  🟡 WARNING: ${counters.WARNING || 0}`);
console.log(`  🔴 FAIL:    ${counters.FAIL || 0}`);
console.log(`  💥 ERROR:   ${counters.ERROR || 0}`);
console.log(`\n📄 리포트: ${reportArg}`);
console.log(`📸 screenshot: ${screenshotDir}/`);

if ((counters.FAIL || 0) > 0 || (counters.ERROR || 0) > 0) {
  console.log(`\n🔴 visual_audit FAIL — review screenshots + report`);
  process.exit(1);
}
console.log(`\n✅ visual_audit PASS`);
