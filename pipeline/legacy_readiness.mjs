// legacy_readiness.mjs — LEGACY 모의 출시 준비도 진단 (read-only)
// 데이터-측 release_ready 6기준 + 해설/cs_ids/annotation 완성도를 set별로 매트릭스화.
// 구조/정답/본문 무결성(structure·answer·passage_fidelity)은 별도 게이트로 병행 — 본 도구는 데이터 완성도 분류.
// 사용: node pipeline/legacy_readiness.mjs [--yk=2017_9월] [--full]
import fs from "fs";
const d = JSON.parse(fs.readFileSync("public/data/all_data_204.json", "utf8"));
let ann = {};
try {
  ann = JSON.parse(fs.readFileSync("public/data/annotations.json", "utf8"));
} catch {}
const args = process.argv.slice(2);
const ykFilter = (args.find((a) => a.startsWith("--yk=")) || "").split("=")[1];
const full = args.includes("--full");

const RE = /^20(1[4-9]|2[01])_(6월|9월)[AB]?$/;
const PAT_NEED_CS = new Set(["R1", "R2", "R4", "L1", "L2", "L4", "L5"]);
const yks = Object.keys(d).filter(
  (k) => RE.test(k) && (!ykFilter || k === ykFilter),
);

const sets = [];
for (const yk of yks) {
  const annYk = ann[yk] || {};
  for (const area of ["reading", "literature"]) {
    for (const s of d[yk][area] || []) {
      const sentIds = new Set((s.sents || []).map((x) => x.id));
      const sentN = (s.sents || []).length;
      const qN = (s.questions || []).length;
      let choices5 = true,
        okTrueNoCs = 0,
        dead = 0,
        emptyAnalysis = 0,
        okFalsePatNoCs = 0;
      let totChoice = 0,
        withAnalysis = 0,
        okTrue = 0,
        okTrueWithCs = 0;
      for (const q of s.questions || []) {
        if ((q.choices || []).length !== 5) choices5 = false;
        for (const c of q.choices || []) {
          totChoice++;
          const hasA = !!(c.analysis && c.analysis.trim());
          if (hasA) withAnalysis++;
          else emptyAnalysis++;
          const cs = c.cs_ids || [];
          for (const id of cs) if (!sentIds.has(id)) dead++;
          if (c.ok === true) {
            okTrue++;
            if (cs.length) okTrueWithCs++;
            else okTrueNoCs++;
          }
          if (c.ok === false && PAT_NEED_CS.has(c.pat) && cs.length === 0)
            okFalsePatNoCs++;
        }
      }
      // sent 최소 (독서 ≥10 & ≥3.0/q / 문학 ≥5 & ≥1.5/q)
      const ratio = qN ? sentN / qN : 0;
      const sentOk =
        area === "reading"
          ? sentN >= 10 && ratio >= 3.0
          : sentN >= 5 && ratio >= 1.5;
      const annCount = (annYk[s.id] || []).length;
      const analysisRatio = totChoice ? withAnalysis / totChoice : 0;
      const csRatio = okTrue ? okTrueWithCs / okTrue : 1;
      // release_ready 6기준 (데이터-측)
      const rrFail = [];
      if (okTrueNoCs) rrFail.push("ok:true cs[]=" + okTrueNoCs);
      if (dead) rrFail.push("DEAD=" + dead);
      if (emptyAnalysis) rrFail.push("해설공백=" + emptyAnalysis);
      if (okFalsePatNoCs) rrFail.push("pat-cs[]=" + okFalsePatNoCs);
      if (!sentOk) rrFail.push("sent부족(" + sentN + "/" + qN + ")");
      if (!choices5) rrFail.push("선지≠5");
      // 분류
      let cat;
      if (analysisRatio === 0) cat = "해설생성";
      else if (rrFail.length === 0) cat = "즉시가능";
      else if (emptyAnalysis > 0 && analysisRatio < 1) cat = "해설보완";
      else if (okTrueNoCs > 0 || csRatio < 1 || dead > 0) cat = "cs완성";
      else if (!sentOk) cat = "구조정정";
      else cat = "기타정정";
      sets.push({
        yk,
        area,
        id: s.id,
        sentN,
        qN,
        annCount,
        analysisRatio: +analysisRatio.toFixed(2),
        csRatio: +csRatio.toFixed(2),
        cat,
        rrFail,
      });
    }
  }
}

// 집계
const byCat = {};
for (const s of sets) byCat[s.cat] = (byCat[s.cat] || 0) + 1;
console.log(
  `=== LEGACY 모의 준비도 (데이터-측) — ${sets.length} set / ${yks.length} yk ===`,
);
console.log("분류 집계:", JSON.stringify(byCat));
console.log(
  "annotation 보유 set:",
  sets.filter((s) => s.annCount > 0).length,
  "| 해설 전무 set:",
  sets.filter((s) => s.analysisRatio === 0).length,
  "| cs 완성(100%) set:",
  sets.filter((s) => s.csRatio === 1 && s.cat !== "해설생성").length,
);
console.log("\n=== 분류별 set 목록 ===");
for (const cat of [
  "즉시가능",
  "cs완성",
  "해설보완",
  "해설생성",
  "구조정정",
  "기타정정",
]) {
  const list = sets.filter((s) => s.cat === cat);
  if (!list.length) continue;
  console.log(`\n[${cat}] ${list.length} set:`);
  for (const s of list)
    console.log(
      `  ${s.yk} ${s.id}(${s.area[0]}) sent${s.sentN}/Q${s.qN} 해설${s.analysisRatio} cs${s.csRatio} ann${s.annCount}${s.rrFail.length ? " | " + s.rrFail.join(",") : ""}`,
    );
}
