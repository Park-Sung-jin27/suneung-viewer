#!/usr/bin/env node
// pipeline/image_audit.mjs
// K. image sent url missing from public/images
// L. set.hasFig=true but no image sent
// M. orphan files in public/images not referenced

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ALL_DATA = path.join(ROOT, "public/data/all_data_204.json");
const IMG_DIR = path.join(ROOT, "public/images");

function audit() {
  const j = JSON.parse(fs.readFileSync(ALL_DATA, "utf-8"));
  const referenced = new Set();
  const findings = [];
  const sum = { image_sents: 0, K: 0, L: 0, M: 0, hasFig_sets: 0 };

  for (const [yk, yd] of Object.entries(j)) {
    for (const sec of ["reading", "literature"]) {
      if (!Array.isArray(yd[sec])) continue;
      for (const s of yd[sec]) {
        const hasFig = !!s.hasFig;
        if (hasFig) sum.hasFig_sets += 1;
        let imgInSet = 0;
        for (const sent of s.sents || []) {
          if (sent.type === "image" || sent.sentType === "image") {
            sum.image_sents += 1;
            imgInSet += 1;
            const u = sent.url || sent.src;
            if (u) {
              const fname = u.startsWith("/images/")
                ? u.slice("/images/".length)
                : u.replace(/^\//, "");
              referenced.add(fname);
              const abs = path.join(IMG_DIR, fname);
              if (!fs.existsSync(abs)) {
                findings.push({
                  yk,
                  setId: s.id,
                  sec,
                  issue: "K_IMG_MISSING",
                  url: u,
                  sentId: sent.id,
                });
                sum.K += 1;
              }
            } else {
              findings.push({
                yk,
                setId: s.id,
                sec,
                issue: "K_IMG_MISSING",
                url: null,
                sentId: sent.id,
              });
              sum.K += 1;
            }
          }
        }
        if (hasFig && imgInSet === 0) {
          findings.push({ yk, setId: s.id, sec, issue: "L_HASFIG_NO_IMG" });
          sum.L += 1;
        }
      }
    }
  }

  // M: orphan files
  if (fs.existsSync(IMG_DIR)) {
    for (const f of fs.readdirSync(IMG_DIR)) {
      if (f.startsWith(".")) continue;
      if (!referenced.has(f)) {
        findings.push({ issue: "M_ORPHAN", file: f });
        sum.M += 1;
      }
    }
  }
  return { sum, findings };
}

function main() {
  const { sum, findings } = audit();
  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(ROOT, "pipeline/reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `image_audit_${today}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify({ sum, findings }, null, 2),
    "utf-8",
  );

  console.log("=== IMAGE AUDIT", today, "===");
  console.log(
    `image sents: ${sum.image_sents}  hasFig sets: ${sum.hasFig_sets}`,
  );
  console.log(
    `K img missing: ${sum.K}  L hasFig-no-img: ${sum.L}  M orphan: ${sum.M}`,
  );
  console.log("");
  console.log("--- L (hasFig but no image sent) — set list ---");
  const lList = findings.filter((f) => f.issue === "L_HASFIG_NO_IMG");
  console.log(`total: ${lList.length}`);
  for (const f of lList.slice(0, 30)) {
    console.log(`  ${f.yk}/${f.setId} (${f.sec})`);
  }
  if (lList.length > 30) console.log(`  ... +${lList.length - 30} more`);
  console.log("");
  console.log("--- K (image url missing on disk) ---");
  for (const f of findings.filter((f) => f.issue === "K_IMG_MISSING")) {
    console.log(`  ${f.yk}/${f.setId} url=${f.url} sentId=${f.sentId}`);
  }
  console.log("");
  console.log("--- M (orphan files in public/images) — first 30 ---");
  const mList = findings.filter((f) => f.issue === "M_ORPHAN");
  console.log(`total: ${mList.length}`);
  for (const f of mList.slice(0, 30)) console.log(`  ${f.file}`);
  console.log("");
  console.log("report:", path.relative(ROOT, outFile));
}

main();
