#!/usr/bin/env node
// pipeline/lane_report.mjs
// Merge structure + annotation + image audits + employee report (22 grading errors)
// into one per-set lane report.
// Lane: clean | suspect | broken

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ALL_DATA = path.join(ROOT, "public/data/all_data_204.json");
const ANNO = path.join(ROOT, "public/data/annotations.json");

const FREE_YEARS = ["2026수능", "2025수능", "2024수능", "2023수능", "2022수능"];

// Employee report: 22 grading-suspect questions
const GRADING_SUSPECT = {
  "2019수능/r2019e": ["Q40"],
  "2019수능/l2019a": ["Q35"],
  "2019수능/l2019b": ["Q43", "Q45"],
  "2020_6월/r20206d": ["Q38", "Q39"],
  "2020_6월/r20206e": ["Q40"],
  "2020수능/l2020d": ["Q43"],
  "2021_6월/l20216c": ["Q39", "Q40"],
  "2021_6월/l20216d": ["Q42", "Q43", "Q44", "Q45"],
  "2021_9월/r20219d": ["Q35", "Q37"],
  "2021_9월/l20219b": ["Q39", "Q40", "Q42"],
  "2021_9월/l20219c": ["Q44", "Q45"],
  "2021수능/l2021c": ["Q38"],
};

function buildSentIndex(allData) {
  const idx = new Map();
  for (const [yk, yd] of Object.entries(allData)) {
    for (const sec of ["reading", "literature"]) {
      if (!Array.isArray(yd[sec])) continue;
      for (const s of yd[sec]) {
        for (const sent of s.sents || []) {
          if (!sent.id) continue;
          idx.set(sent.id, { t: sent.t || "", yk, setId: s.id });
          const noUnder = sent.id.replace("_s", "s");
          if (noUnder !== sent.id)
            idx.set(noUnder, { t: sent.t || "", yk, setId: s.id });
          const withUnder = sent.id.replace(/([a-z0-9]+)s(\d+)$/, "$1_s$2");
          if (withUnder !== sent.id)
            idx.set(withUnder, { t: sent.t || "", yk, setId: s.id });
        }
      }
    }
  }
  return idx;
}

function audit() {
  const j = JSON.parse(fs.readFileSync(ALL_DATA, "utf-8"));
  const anno = JSON.parse(fs.readFileSync(ANNO, "utf-8"));
  const sentIdx = buildSentIndex(j);

  // Per-set record
  const records = new Map(); // key = "yk/setId" → {yk, setId, sec, range, ...flags}

  function rec(yk, setId, sec, range) {
    const k = `${yk}/${setId}`;
    if (!records.has(k)) {
      records.set(k, {
        yk,
        setId,
        sec,
        range: range || "?",
        C: 0,
        E: 0,
        F: 0,
        G: 0,
        L: 0,
        grading: 0,
        total_q: 0,
        total_sent: 0,
        hasFig: false,
      });
    }
    return records.get(k);
  }

  // structure findings (C, E) + per-set basics
  for (const [yk, yd] of Object.entries(j)) {
    let ytq = 0;
    for (const sec of ["reading", "literature"]) {
      if (!Array.isArray(yd[sec])) continue;
      for (const s of yd[sec]) {
        const r = rec(yk, s.id, sec, s.range);
        r.total_q = (s.questions || []).length;
        r.total_sent = (s.sents || []).length;
        r.hasFig = !!s.hasFig;
        ytq += r.total_q;

        if (r.total_sent === 0) r.C += 1;

        if (s.range && r.total_q > 0) {
          const m = String(s.range).match(/(\d+)\s*~\s*(\d+)/);
          if (m) {
            const lo = parseInt(m[1], 10),
              hi = parseInt(m[2], 10);
            const exp = [];
            for (let i = lo; i <= hi; i++) exp.push(i);
            const act = (s.questions || [])
              .map((q) => q.id)
              .filter((x) => Number.isInteger(x))
              .sort((a, b) => a - b);
            const same =
              act.length === exp.length && act.every((v, i) => v === exp[i]);
            if (!same) r.E += 1;
          }
        }
      }
    }
    // D = yearKey level (apply to all sets in that year as warning flag)
    if (ytq < 25) {
      for (const r of records.values()) {
        if (r.yk === yk) r.yearShort = 25 - ytq;
      }
    }
  }

  // annotation findings (F, G)
  for (const [yk, sets] of Object.entries(anno)) {
    for (const [setId, arr] of Object.entries(sets)) {
      for (const e of arr) {
        if (e.type === "bracket") continue; // bracket = deprecated render path
        const k = `${yk}/${setId}`;
        const r = records.get(k);
        if (!r) continue;
        if (!e.sentId || !sentIdx.has(e.sentId)) {
          r.F += 1;
          continue;
        }
        const sentInfo = sentIdx.get(e.sentId);
        if (e.text && !sentInfo.t.includes(e.text)) {
          r.G += 1;
        }
      }
    }
  }

  // image findings (L: hasFig but no image sent)
  for (const r of records.values()) {
    if (r.hasFig) {
      const allDataYK = j[r.yk];
      const sets = allDataYK?.[r.sec] || [];
      const s = sets.find((x) => x.id === r.setId);
      const hasImgSent = (s?.sents || []).some(
        (x) => x.type === "image" || x.sentType === "image",
      );
      if (!hasImgSent) r.L += 1;
    }
  }

  // employee grading suspect
  for (const [k, qs] of Object.entries(GRADING_SUSPECT)) {
    const r = records.get(k);
    if (r) r.grading = qs.length;
  }

  // Lane decision
  for (const r of records.values()) {
    const isBroken =
      r.C > 0 ||
      r.E > 0 ||
      r.G >= 3 ||
      r.grading > 0 ||
      (r.yearShort && r.yearShort >= 5);
    const isSuspect =
      !isBroken &&
      (r.G > 0 || r.F > 0 || r.L > 0 || (r.yearShort && r.yearShort > 0));
    r.lane = isBroken ? "broken" : isSuspect ? "suspect" : "clean";
    r.free = FREE_YEARS.includes(r.yk);
  }

  return [...records.values()];
}

function main() {
  const records = audit();
  records.sort((a, b) => {
    const order = { broken: 0, suspect: 1, clean: 2 };
    if (order[a.lane] !== order[b.lane]) return order[a.lane] - order[b.lane];
    if (a.free !== b.free) return a.free ? -1 : 1;
    return a.yk.localeCompare(b.yk) || a.setId.localeCompare(b.setId);
  });

  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(ROOT, "pipeline/reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `lane_report_${today}.json`);
  fs.writeFileSync(outFile, JSON.stringify(records, null, 2), "utf-8");

  const total = records.length;
  const byLane = { broken: 0, suspect: 0, clean: 0 };
  const byLaneFree = { broken: 0, suspect: 0, clean: 0 };
  const byLaneLegacy = { broken: 0, suspect: 0, clean: 0 };
  for (const r of records) {
    byLane[r.lane] += 1;
    (r.free ? byLaneFree : byLaneLegacy)[r.lane] += 1;
  }

  console.log("=== LANE REPORT", today, "===");
  console.log(`total sets: ${total}`);
  console.log(
    `  broken: ${byLane.broken}   suspect: ${byLane.suspect}   clean: ${byLane.clean}`,
  );
  console.log(
    `  FREE:   broken ${byLaneFree.broken}, suspect ${byLaneFree.suspect}, clean ${byLaneFree.clean}`,
  );
  console.log(
    `  LEGACY: broken ${byLaneLegacy.broken}, suspect ${byLaneLegacy.suspect}, clean ${byLaneLegacy.clean}`,
  );
  console.log("");

  console.log("--- BROKEN FREE sets (release blocker) ---");
  for (const r of records.filter((x) => x.lane === "broken" && x.free)) {
    const tag = [
      r.C && `C`,
      r.E && `E`,
      r.G >= 3 && `G${r.G}`,
      r.grading && `grading${r.grading}`,
    ]
      .filter(Boolean)
      .join(",");
    console.log(`  ${r.yk}/${r.setId} (${r.range}) [${tag}]`);
  }
  console.log("");

  console.log("--- BROKEN LEGACY sets ---");
  const brokenLegacy = records.filter((x) => x.lane === "broken" && !x.free);
  console.log(`total: ${brokenLegacy.length}`);
  for (const r of brokenLegacy.slice(0, 40)) {
    const tag = [
      r.C && `C`,
      r.E && `E`,
      r.G >= 3 && `G${r.G}`,
      r.grading && `grading${r.grading}`,
      r.yearShort && `year-${r.yearShort}`,
    ]
      .filter(Boolean)
      .join(",");
    console.log(`  ${r.yk}/${r.setId} (${r.range}) [${tag}]`);
  }
  if (brokenLegacy.length > 40)
    console.log(`  ... +${brokenLegacy.length - 40} more`);
  console.log("");

  console.log("--- SUSPECT FREE sets ---");
  for (const r of records.filter((x) => x.lane === "suspect" && x.free)) {
    const tag = [r.G && `G${r.G}`, r.F && `F${r.F}`, r.L && `L`]
      .filter(Boolean)
      .join(",");
    console.log(`  ${r.yk}/${r.setId} (${r.range}) [${tag}]`);
  }
  console.log("");

  console.log("report:", path.relative(ROOT, outFile));
}

main();
