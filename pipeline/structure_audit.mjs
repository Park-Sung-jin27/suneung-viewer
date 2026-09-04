#!/usr/bin/env node
// pipeline/structure_audit.mjs
// 41 yearKey set 단위 구조 결손 자동 점검
// A. q.id null/non-int  B. questions=0  C. sents=0
// D. yearKey questions < 25  E. range vs q.id mismatch

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data-source/all_data_204.json");
const MIN_Q = 25;

function audit() {
  const j = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  const findings = [];
  const sum = {
    yearKeys: 0,
    sets: 0,
    questions: 0,
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
  };

  for (const [yk, yd] of Object.entries(j)) {
    sum.yearKeys += 1;
    let ytq = 0;
    for (const sec of ["reading", "literature"]) {
      const sets = yd[sec];
      if (!Array.isArray(sets)) continue;
      for (const s of sets) {
        sum.sets += 1;
        const sid = s.id || s.setId || "?";
        const qs = s.questions || [];
        const sents = s.sents || [];
        sum.questions += qs.length;
        ytq += qs.length;

        const idBad = qs.filter((q) => q.id == null || !Number.isInteger(q.id));
        if (idBad.length > 0) {
          findings.push({
            yk,
            sid,
            sec,
            issue: "A",
            count: idBad.length,
            total: qs.length,
          });
          sum.A += 1;
        }
        if (qs.length === 0) {
          findings.push({ yk, sid, sec, issue: "B", range: s.range || "?" });
          sum.B += 1;
        }
        if (sents.length === 0) {
          findings.push({ yk, sid, sec, issue: "C", range: s.range || "?" });
          sum.C += 1;
        }
        if (s.range && qs.length > 0) {
          const m = String(s.range).match(/(\d+)\s*~\s*(\d+)/);
          if (m) {
            const lo = parseInt(m[1], 10);
            const hi = parseInt(m[2], 10);
            const exp = [];
            for (let i = lo; i <= hi; i++) exp.push(i);
            const act = qs
              .map((q) => q.id)
              .filter((x) => Number.isInteger(x))
              .sort((a, b) => a - b);
            const same =
              act.length === exp.length && act.every((v, i) => v === exp[i]);
            if (!same) {
              findings.push({
                yk,
                sid,
                sec,
                issue: "E",
                range: s.range,
                expected: exp,
                actual: act,
              });
              sum.E += 1;
            }
          }
        }
      }
    }
    if (ytq < MIN_Q) {
      findings.push({ yk, issue: "D", total: ytq, min: MIN_Q });
      sum.D += 1;
    }
  }
  return { sum, findings };
}

function main() {
  const { sum, findings } = audit();
  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(ROOT, "pipeline/reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `structure_audit_${today}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify({ sum, findings }, null, 2),
    "utf-8",
  );

  console.log("=== STRUCTURE AUDIT", today, "===");
  console.log(
    "yearKeys:",
    sum.yearKeys,
    " sets:",
    sum.sets,
    " questions:",
    sum.questions,
  );
  console.log(
    "A q.id-bad:",
    sum.A,
    " B q=0:",
    sum.B,
    " C sents=0:",
    sum.C,
    " D year<25:",
    sum.D,
    " E range-mismatch:",
    sum.E,
  );
  console.log("");
  console.log("--- D (year < 25 questions) ---");
  for (const f of findings
    .filter((f) => f.issue === "D")
    .sort((a, b) => a.total - b.total)) {
    console.log(`  ${f.yk}: ${f.total}/25  (missing ${25 - f.total})`);
  }
  console.log("");
  console.log("--- E (range vs q.id mismatch) ---");
  const eList = findings.filter((f) => f.issue === "E");
  console.log(`total: ${eList.length}`);
  for (const f of eList.slice(0, 30)) {
    console.log(
      `  ${f.yk}/${f.sid} range=${f.range} expected=[${f.expected.join(",")}] actual=[${f.actual.join(",")}]`,
    );
  }
  if (eList.length > 30) console.log(`  ... +${eList.length - 30} more`);
  console.log("");
  console.log("--- C (sents=0) ---");
  for (const f of findings.filter((f) => f.issue === "C"))
    console.log(`  ${f.yk}/${f.sid} range=${f.range}`);
  console.log("");
  console.log("report:", path.relative(ROOT, outFile));
}

main();
