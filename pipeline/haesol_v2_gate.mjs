// haesol_v2_gate.mjs — v2 해설 재생성 세트 6축 자동 검증 harness
// 사용: node pipeline/haesol_v2_gate.mjs --sets=2023수능::r2023b,2024수능::r2024d
//   재생성 세트 → 6축 검증 → 전선지 로그 → PASS(대표 검수 큐) / FAIL(반려).
// 6축: ① §2 인용 exact(전선지·다문장 WARNING 별도) ② C_anchor ③ W_bogi_anchor
//      ④ W_analysis_marker_mismatch ⑤ cs_anchor_mismatch ⑥ 결론줄=ok + DEAD_csid + CRITICAL 0.
// 권위 게이트(quality_gate)를 1회 실행해 output JSON을 갱신, 그 결과를 세트별로 필터.
// PASS 기준(§2 완화 조건 b): 해당 세트 CRITICAL 0 AND §2 real-FAIL 0. WARNING은 비차단(검수 큐).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "output");
const args = process.argv.slice(2);
const setsArg =
  (args.find((a) => a.startsWith("--sets=")) || "").split("=")[1] || "";
const targets = setsArg
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (!targets.length) {
  console.error(
    "사용: node pipeline/haesol_v2_gate.mjs --sets=<yk>::<setId>[,...]",
  );
  process.exit(2);
}

// 1) 권위 게이트 1회 실행(output JSON 갱신)
console.log(
  "[1/3] quality_gate --scope=release 실행(권위 게이트 output 갱신)…",
);
try {
  execSync("node pipeline/quality_gate.mjs --scope=release", {
    cwd: ROOT,
    stdio: "ignore",
  });
} catch (e) {
  // quality_gate는 release_blocked 시 exit≠0일 수 있음 — output JSON은 이미 기록됨
}
const readOut = (f) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
  } catch {
    return [];
  }
};
const allCritical = readOut("all_critical.json");
const csAnchor = readOut("cs_anchor_mismatch.json");
const bogiAnchor = readOut("bogi_anchor.json");
const markerMis = readOut("analysis_marker_mismatch.json");

// 2) all_data 로드 + 세트 찾기
const d = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"),
);
function findSet(yk, sid) {
  for (const sec of ["reading", "literature"])
    for (const s of (d[yk] || {})[sec] || [])
      if ((s.setId || s.id) === sid) return s;
  return null;
}
// CRITICAL loc은 setId/yearKey 순서가 섞여 있어, setId 문자열 포함으로 매칭
const criticalForSet = (yk, sid) =>
  allCritical.filter(
    (i) =>
      (i.yearKey === yk || String(i.loc || "").includes(yk)) &&
      String(i.loc || "").includes(sid),
  );

// 3) 세트별 6축 판정
const conclOf = (a) => {
  const ls = String(a || "")
    .trim()
    .split("\n");
  return ls[ls.length - 1].trim();
};
const results = [];
for (const t of targets) {
  const [yk, sid] = t.split("::");
  const s = findSet(yk, sid);
  if (!s) {
    results.push({ set: t, verdict: "ERROR", reason: "세트 없음" });
    continue;
  }
  const sents = new Set((s.sents || []).map((x) => x.id));
  const sentArr = s.sents || [];
  const hay = sentArr.map((x) => x.t).join("\n");
  // 문학 세트는 어휘(V) 판정 제외 — '의미/가까운' <보기> 문항은 L*(보기/감상)이지 어휘 아님
  const isLit = ((d[yk] || {}).literature || []).some(
    (x) => (x.setId || x.id) === sid,
  );
  let s2fail = 0,
    s2warn = 0,
    revBad = 0,
    dead = 0,
    vDirty = 0,
    vocabPatBad = 0,
    anchorGap = 0;
  const s2failEx = [];
  for (const q of s.questions || []) {
    const bogi = typeof q.bogi === "string" ? q.bogi : "";
    // 어휘 문항 판별(§6): 발문 키워드(문맥상 의미·바꿔 쓰기·가장 가까운)
    // 어휘 판별(확장): 의미/뜻·바꿔쓰기(삽입어 허용)·가장 가까운 의미로 쓰인.
    //   제외: '의미를 추론/파악'(추론 문항)·'주장/관점/내용…가까운'(내용 문항) — 어휘 아님.
    const qtStr = String(q.t || "");
    const isVocab =
      !/의미를 (추론|파악)|(주장|관점|내용).{0,6}가까운/.test(qtStr) &&
      /문맥[상적].{0,8}(의미|뜻)|(의미|뜻)[가와]? 가장 가까운|가장 가까운 의미로 쓰인|바꿔\s?쓰기?.{0,8}적절|바꿔 쓸 수 있는/.test(
        qtStr,
      );
    for (const c of q.choices || []) {
      const a = c.analysis || "";
      // ① §2 전선지: 📌 인용(12+) ⊆ sents∪bogi. 다문장=WARNING, 그 외=FAIL
      // ④ 근거완전성(발주#4): 지문 인용 sent가 cs_ids에 없으면 FAIL(⚡·🧠 참조 누락 색출)
      for (const m of a.matchAll(/"([^"]{12,})"/g)) {
        const qt = m[1];
        const hit = sentArr.find((sn) => (sn.t || "").includes(qt));
        if (hit) {
          if (!(c.cs_ids || []).includes(hit.id)) {
            anchorGap++;
            if (s2failEx.length < 6)
              s2failEx.push(
                `Q${q.id}c${c.num} 근거누락(cs∌${hit.id.replace(sid, "")}): ${qt.slice(0, 26)}`,
              );
          }
          continue;
        }
        if (bogi && bogi.includes(qt)) continue; // 보기 인용(bogi)
        if (qt.split(/[.!?]/).filter(Boolean).length > 1 || /…|\.{2,}/.test(qt))
          s2warn++;
        else {
          s2fail++;
          if (s2failEx.length < 6)
            s2failEx.push(`Q${q.id}c${c.num}: ${qt.slice(0, 34)}`);
        }
      }
      // ⑥ 결론줄=ok
      if (a.trim()) {
        const cc = conclOf(a);
        if (!(c.ok ? cc.startsWith("✅") : cc.startsWith("❌"))) revBad++;
      }
      // DEAD_csid
      for (const id of c.cs_ids || []) if (!sents.has(id)) dead++;
      // V 오답 cs 규칙(C_vpat_dirty 선제)
      if (c.ok === false && c.pat === "V" && (c.cs_ids || []).length) vDirty++;
      // 어휘 문항 오답 pat != V (기존 데이터 pat 오분류 색출 겸용) — 독서만(문학 제외)
      if (isVocab && !isLit && c.ok === false && c.pat !== "V") vocabPatBad++;
    }
  }
  const crit = criticalForSet(yk, sid);
  const setCs = csAnchor.filter((x) => x.setId === sid);
  const setBogi = bogiAnchor.filter((x) => x.setId === sid);
  const setMk = markerMis.filter((x) => x.setId === sid);
  // PASS: CRITICAL 0 AND §2 real-FAIL 0 AND 결론줄 위반 0 AND DEAD 0 AND V-dirty 0 AND 어휘pat 0
  const blocking =
    crit.length + s2fail + revBad + dead + vDirty + vocabPatBad + anchorGap;
  const verdict = blocking === 0 ? "PASS" : "FAIL";
  results.push({
    set: t,
    verdict,
    critical: crit.length,
    s2_fail: s2fail,
    s2_warn: s2warn,
    concl_bad: revBad,
    dead,
    v_dirty: vDirty,
    vocab_pat_bad: vocabPatBad,
    anchor_gap: anchorGap,
    warn: {
      bogi_anchor: setBogi.length,
      marker_mismatch: setMk.length,
      cs_anchor: setCs.length,
    },
    s2failEx,
    critTypes: [...new Set(crit.map((c) => c.type))],
  });
}

// 로그 출력 + 파일
console.log("\n========== v2 게이트 판정 (전선지 로그) ==========");
for (const r of results) {
  console.log(`\n■ ${r.set} → ${r.verdict}`);
  if (r.verdict === "ERROR") {
    console.log("  " + r.reason);
    continue;
  }
  console.log(
    `  [차단축] CRITICAL ${r.critical}${r.critTypes.length ? "(" + r.critTypes.join(",") + ")" : ""} · §2 FAIL ${r.s2_fail} · 결론줄위반 ${r.concl_bad} · DEAD ${r.dead} · V-dirty ${r.v_dirty} · 어휘pat오분류 ${r.vocab_pat_bad} · 근거누락 ${r.anchor_gap}`,
  );
  console.log(
    `  [비차단 WARNING] §2 다문장 ${r.s2_warn} · bogi_anchor ${r.warn.bogi_anchor} · marker ${r.warn.marker_mismatch} · cs_anchor ${r.warn.cs_anchor}`,
  );
  r.s2failEx.forEach((x) => console.log("    §2 FAIL " + x));
}
const pass = results.filter((r) => r.verdict === "PASS").map((r) => r.set);
const fail = results.filter((r) => r.verdict === "FAIL").map((r) => r.set);
console.log(`\n========== 요약 ==========`);
console.log(`PASS(대표 검수 큐): ${pass.length} [${pass.join(", ")}]`);
console.log(`FAIL(반려·재생성): ${fail.length} [${fail.join(", ")}]`);
fs.writeFileSync(
  path.join(OUT, "haesol_v2_gate.json"),
  JSON.stringify(results, null, 2),
);
console.log("→ output/haesol_v2_gate.json 기록");
process.exit(fail.length ? 1 : 0);
