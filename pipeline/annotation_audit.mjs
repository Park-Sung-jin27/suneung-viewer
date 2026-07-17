#!/usr/bin/env node
// pipeline/annotation_audit.mjs
// annotations.json 4 type entry validity check
// F. dead sentId  G. text not in sent.t  H. bracket sentFrom/sentTo dead
// I. set has 0 annotations  J. set in annotations but not in all_data

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ALL_DATA = path.join(ROOT, "public/data/all_data_204.json");
const ANNO = path.join(ROOT, "public/data/annotations.json");

function buildSentIndex(allData) {
  // Map: sentId (canonical) -> sent.t text
  // Accept both forms: r2026a_s1 and r2026as1
  const idx = new Map();
  for (const [yk, yd] of Object.entries(allData)) {
    for (const sec of ["reading", "literature"]) {
      if (!Array.isArray(yd[sec])) continue;
      for (const s of yd[sec]) {
        for (const sent of s.sents || []) {
          if (!sent.id) continue;
          const t = sent.t || "";
          idx.set(sent.id, { t, yk, setId: s.id, sec });
          // also store normalized (no underscore) alias
          const noUnder = sent.id.replace("_s", "s");
          if (noUnder !== sent.id)
            idx.set(noUnder, { t, yk, setId: s.id, sec });
          // also store with underscore alias
          const withUnder = sent.id.replace(/([a-z0-9]+)s(\d+)$/, "$1_s$2");
          if (withUnder !== sent.id)
            idx.set(withUnder, { t, yk, setId: s.id, sec });
        }
      }
    }
  }
  return idx;
}

function buildAllDataSetIds(allData) {
  const setIds = new Set();
  for (const [yk, yd] of Object.entries(allData)) {
    for (const sec of ["reading", "literature"]) {
      if (!Array.isArray(yd[sec])) continue;
      for (const s of yd[sec]) setIds.add(`${yk}/${s.id}`);
    }
  }
  return setIds;
}

function audit() {
  const allData = JSON.parse(fs.readFileSync(ALL_DATA, "utf-8"));
  const anno = JSON.parse(fs.readFileSync(ANNO, "utf-8"));
  const sentIdx = buildSentIndex(allData);
  const allDataSetIds = buildAllDataSetIds(allData);

  const findings = [];
  const sum = { entries: 0, F: 0, G: 0, H: 0, I: 0, J: 0, by_type: {} };

  // entries check (F, G, H)
  const annoSetIds = new Set();
  for (const [yk, sets] of Object.entries(anno)) {
    for (const [setId, arr] of Object.entries(sets)) {
      annoSetIds.add(`${yk}/${setId}`);
      if (arr.length === 0) {
        findings.push({ yk, setId, issue: "I_SET_EMPTY" });
        sum.I += 1;
        continue;
      }
      // J: set in annotations but not in all_data
      if (!allDataSetIds.has(`${yk}/${setId}`)) {
        findings.push({ yk, setId, issue: "J_SET_NOT_IN_ALL_DATA" });
        sum.J += 1;
      }
      for (const e of arr) {
        sum.entries += 1;
        const t = e.type || "?";
        sum.by_type[t] = (sum.by_type[t] || 0) + 1;

        if (t === "bracket") {
          // H: sentFrom or sentTo dead
          if (e.sentFrom && !sentIdx.has(e.sentFrom)) {
            findings.push({
              yk,
              setId,
              issue: "H_BRACKET_FROM_DEAD",
              sentFrom: e.sentFrom,
              label: e.label,
            });
            sum.H += 1;
          }
          if (e.sentTo && !sentIdx.has(e.sentTo)) {
            findings.push({
              yk,
              setId,
              issue: "H_BRACKET_TO_DEAD",
              sentTo: e.sentTo,
              label: e.label,
            });
            sum.H += 1;
          }
        } else {
          // F: sentId dead
          if (!e.sentId || !sentIdx.has(e.sentId)) {
            findings.push({
              yk,
              setId,
              issue: "F_SENT_DEAD",
              type: t,
              sentId: e.sentId,
              text: e.text,
              marker: e.marker,
            });
            sum.F += 1;
            continue;
          }
          // G: text not in sent.t
          const sentInfo = sentIdx.get(e.sentId);
          if (e.text && !sentInfo.t.includes(e.text)) {
            findings.push({
              yk,
              setId,
              issue: "G_TEXT_MISSING",
              type: t,
              sentId: e.sentId,
              text: e.text,
              sent_t_preview: sentInfo.t.slice(0, 80),
              marker: e.marker,
            });
            sum.G += 1;
          }
        }
      }
    }
  }

  // Aggregate: set 단위 결함 count
  const setIssueMap = new Map();
  for (const f of findings) {
    if (!f.setId) continue;
    const k = `${f.yk}/${f.setId}`;
    setIssueMap.set(k, (setIssueMap.get(k) || 0) + 1);
  }
  const setsWithIssues = [...setIssueMap.entries()].sort((a, b) => b[1] - a[1]);

  return { sum, findings, setsWithIssues, totalAnnoSets: annoSetIds.size };
}

function main() {
  const { sum, findings, setsWithIssues, totalAnnoSets } = audit();
  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(ROOT, "pipeline/reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `annotation_audit_${today}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify({ sum, findings, setsWithIssues, totalAnnoSets }, null, 2),
    "utf-8",
  );

  console.log("=== ANNOTATION AUDIT", today, "===");
  console.log(`anno sets: ${totalAnnoSets}  entries: ${sum.entries}`);
  console.log("by type:", JSON.stringify(sum.by_type));
  console.log(
    `F dead sentId: ${sum.F}  G text-missing: ${sum.G}  H bracket-dead: ${sum.H}  I set-empty: ${sum.I}  J set-not-in-data: ${sum.J}`,
  );
  console.log("");
  console.log("--- top 15 sets by issue count ---");
  for (const [k, c] of setsWithIssues.slice(0, 15)) {
    console.log(`  ${k}: ${c} issues`);
  }
  console.log("");
  console.log("--- G samples (text not in sent) — first 10 ---");
  const gList = findings.filter((f) => f.issue === "G_TEXT_MISSING");
  for (const f of gList.slice(0, 10)) {
    const mk = f.marker ? ` [${f.marker}]` : "";
    console.log(
      `  ${f.yk}/${f.setId} ${f.type}${mk} sent=${f.sentId} text="${f.text}"`,
    );
    console.log(`    sent_t: "${f.sent_t_preview}..."`);
  }
  console.log("");
  console.log("--- F samples (dead sentId) — first 10 ---");
  for (const f of findings
    .filter((f) => f.issue === "F_SENT_DEAD")
    .slice(0, 10)) {
    console.log(
      `  ${f.yk}/${f.setId} ${f.type} sentId=${f.sentId} text="${f.text || ""}"`,
    );
  }
  console.log("");
  console.log("report:", path.relative(ROOT, outFile));
}

main();
