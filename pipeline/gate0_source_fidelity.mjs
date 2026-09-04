// gate0_source_fidelity.mjs — vFinal
// Y.1 turn 정정 — W.3/W.4 path 영구 반영
// Scope manifest 정합 / V9 strong/weak 분리 / sig_3 정밀화 / bucket 5종 / lane 5종
// r2014a → scope_pending (broken X 정합)
// 자동 release 부여 표현 영구 제거 (X.2 Safety Stopper 정합)

import fs from "fs";

const DATA_PATH = "data-source/all_data_204.json";
const REPORT_PATH = "pipeline/gate0_source_fidelity_report.json";
const SET_STATUS_PATH = "pipeline/set_status.json";

// ─── Scope manifest ───────────────────────────────────────────
const SUPPORTED_DOMAIN = ["reading", "literature"];
const UNSUPPORTED_DOMAIN = ["speech_writing", "language_media", "grammar"];

const SCOPES = {
  A: ["2026수능"],
  B_FREE: ["2022수능", "2023수능", "2024수능", "2025수능", "2026수능"],
  B_NEAR: [
    "2026_9월",
    "2026_6월",
    "2025_9월",
    "2025_6월",
    "2024_9월",
    "2024_6월",
    "2023_9월",
    "2023_6월",
    "2022_9월",
    "2022_6월",
  ],
};

const QUARANTINE_SETS = [
  { setId: "l20156c", yearKey: "2015_6월A", reason: "본문 손상 (사용자 확정)" },
];

// ─── V9 literature signal detector ────────────────────────────
// strong: sig_1 ~ sig_4 (CRITICAL 분류 가능)
// weak  : sig_5 (NEEDS_HUMAN 분류)
// sig_3 정밀화: strong 단독 trigger 영구 제거, sig_1/sig_2 동시 또는 작품명 keyword 의무
const WORK_KEYWORDS = [
  "시조",
  "소설",
  "시가",
  "가사",
  "연시조",
  "수필",
  "고전소설",
  "현대시",
  "현대소설",
];

function detectSignals(s) {
  const sents = s.sents || [];
  const title = s.title || "";
  const strong = { sig_1: false, sig_2: false, sig_3: false, sig_4: false };
  const weak = { sig_5: false };
  const triggers = [];

  // sig_1: 끝 5 sents 안 "- 작가 -" pattern
  const tail = sents
    .slice(-5)
    .map((x) => x.t || "")
    .join(" ");
  const m1 = tail.match(/[-—–]\s*[가-힣]+(?:,\s*[가-힣 ]+)?\s*[-—–]/);
  if (m1) {
    strong.sig_1 = true;
    triggers.push({ sig: "sig_1", text: m1[0] });
  }

  // sig_2: title 안 "(작가)" pattern
  const m2 = title.match(/\([가-힣]+\)/);
  if (m2) {
    strong.sig_2 = true;
    triggers.push({ sig: "sig_2", text: m2[0] });
  }

  // sig_3 정밀화: "/" 또는 "·" 분리 + 한글 단어 2개+ AND (sig_1 OR sig_2 OR 작품명 keyword)
  const sig3_base = (() => {
    if (!/[\/·]/.test(title)) return false;
    const parts = title
      .split(/[\/·]/)
      .map((p) => p.trim())
      .filter((p) => /[가-힣]/.test(p));
    return parts.length >= 2;
  })();
  const sig3_keyword = WORK_KEYWORDS.some((kw) => title.includes(kw));
  if (sig3_base && (strong.sig_1 || strong.sig_2 || sig3_keyword)) {
    strong.sig_3 = true;
    triggers.push({ sig: "sig_3", text: title });
  }

  // sig_4: 본문 안 "작자미상"
  const allText = sents.map((x) => x.t || "").join(" ");
  const m4 = allText.match(/작자\s*미상/);
  if (m4) {
    strong.sig_4 = true;
    triggers.push({ sig: "sig_4", text: m4[0] });
  }

  // sig_5 (weak): 작품 marker 단독 — 보기 single character bracket pattern 영구 제거
  const m5 = allText.match(/\[앞부분의 줄거리\]|\[중략\]|\[현대어 풀이\]/);
  if (m5) {
    weak.sig_5 = true;
    triggers.push({ sig: "sig_5", text: m5[0] });
  }

  const strongHit = Object.values(strong).some(Boolean);
  const weakHit = Object.values(weak).some(Boolean);
  return { strong, weak, strongHit, weakHit, triggers };
}

// ─── scope + bucket + lane ────────────────────────────────────
function scopeOf(yk) {
  if (SCOPES.A.includes(yk)) return "scopeA";
  if (SCOPES.B_FREE.includes(yk)) return "scopeB_FREE";
  if (SCOPES.B_NEAR.includes(yk)) return "scopeB_NEAR";
  return "scopeC_LEGACY";
}

function bucketFor(scope, severity, outOfScope) {
  if (outOfScope) return "OUT_OF_SCOPE";
  if (scope === "scopeA" || scope === "scopeB_FREE")
    return severity === "critical" ? "P0" : "P1";
  if (scope === "scopeB_NEAR") return "P1";
  return "P2";
}

function detectOutOfScope(s, yk) {
  if (
    SCOPES.B_FREE.includes(yk) ||
    SCOPES.B_NEAR.includes(yk) ||
    SCOPES.A.includes(yk)
  )
    return false;
  const m = String(s.range || "").match(/(\d+)\s*[~∼]\s*(\d+)/);
  if (!m) return false;
  return parseInt(m[1]) >= 1 && parseInt(m[2]) <= 15;
}

// lane 5종 도출
function laneFor(setStatus) {
  if (setStatus.out_of_scope) return "out_of_scope";
  if (setStatus.source_status === "broken") return "broken_rebuild";
  if (setStatus.source_status === "suspect") return "scope_pending";
  if (setStatus.source_status === "clean" && setStatus.v9_status === "ok")
    return "clean_existing";
  if (setStatus.source_status === "missing") return "clean_new";
  return "scope_pending";
}

// ─── main ─────────────────────────────────────────────────────
const all = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

const issues = [];
const setStatus = {};
function addIssue(setId, yk, code, severity, bucket, msg) {
  issues.push({ setId, yearKey: yk, code, severity, bucket, msg });
}

const allSentIds = new Set();
const setSentIds = {};
for (const yk of Object.keys(all)) {
  const ex = all[yk];
  if (!ex.reading && !ex.literature) continue;
  for (const s of [...(ex.reading || []), ...(ex.literature || [])]) {
    setSentIds[s.id] = new Set();
    for (const sent of s.sents || []) {
      allSentIds.add(sent.id);
      setSentIds[s.id].add(sent.id);
    }
  }
}

for (const yk of Object.keys(all)) {
  const ex = all[yk];
  if (!ex.reading && !ex.literature) continue;
  const scope = scopeOf(yk);

  for (const section of ["reading", "literature"]) {
    for (const s of ex[section] || []) {
      const setKey = s.id;
      const outOfScope = detectOutOfScope(s, yk);

      if (!setStatus[setKey]) {
        setStatus[setKey] = {
          setId: s.id,
          yearKey: yk,
          scope,
          section_declared: section,
          out_of_scope: outOfScope,
          source_status: outOfScope ? "out_of_scope" : "clean",
          scope_status: "ok",
          v9_status: null,
          v9_triggers: null,
          lane: null,
          gate1_status: "pending",
          gate2_status: "pending",
          gate3_status: "pending",
          release_status: outOfScope ? "hidden" : "verifying",
          issues: [],
          last_audit: new Date().toISOString(),
        };
      }
      if (outOfScope) {
        addIssue(
          s.id,
          yk,
          "OUT_OF_SCOPE",
          "info",
          "OUT_OF_SCOPE",
          `range ${s.range}`,
        );
        continue;
      }

      // r2014a 정합: sents 0건 → suspect + scope_pending (broken X)
      if (!s.sents || s.sents.length === 0) {
        addIssue(
          s.id,
          yk,
          "V1_no_sents",
          "critical",
          bucketFor(scope, "critical"),
          "sents 0",
        );
        setStatus[setKey].source_status = "suspect";
        setStatus[setKey].scope_status = "needs_scope_check";
        setStatus[setKey].release_status = "hidden";
        continue;
      }

      const sig = detectSignals(s);
      setStatus[setKey].v9_triggers = sig.triggers;

      if (sig.strongHit && section === "reading") {
        addIssue(
          s.id,
          yk,
          "V9_MISMATCH_CRITICAL",
          "critical",
          bucketFor(scope, "critical"),
          `strong sig hit, declared=reading`,
        );
        setStatus[setKey].v9_status = "mismatch_critical";
      } else if (!sig.strongHit && sig.weakHit && section === "reading") {
        addIssue(
          s.id,
          yk,
          "V9_NEEDS_HUMAN",
          "warning",
          bucketFor(scope, "warning"),
          `weak sig only`,
        );
        setStatus[setKey].v9_status = "needs_human";
      } else if (section === "literature" && !sig.strongHit && !sig.weakHit) {
        addIssue(
          s.id,
          yk,
          "V9_NEEDS_HUMAN",
          "warning",
          bucketFor(scope, "warning"),
          `literature, sig 0`,
        );
        setStatus[setKey].v9_status = "needs_human";
      } else {
        setStatus[setKey].v9_status = "ok";
      }

      const qCount = (s.questions || []).length;
      if (s.range && qCount > 0) {
        const m = String(s.range).match(/(\d+)\s*[~∼]\s*(\d+)/);
        if (m) {
          const exp = parseInt(m[2]) - parseInt(m[1]) + 1;
          if (exp !== qCount)
            addIssue(
              s.id,
              yk,
              "V3_range_qcount_mismatch",
              "warning",
              bucketFor(scope, "warning"),
              `exp ${exp} act ${qCount}`,
            );
        }
      }

      for (const q of s.questions || []) {
        for (const c of q.choices || []) {
          for (const csId of c.cs_ids || []) {
            if (!allSentIds.has(csId))
              addIssue(
                s.id,
                yk,
                "V6_dead_csid",
                "critical",
                bucketFor(scope, "critical"),
                `dead ${csId}`,
              );
            else if (!setSentIds[s.id].has(csId))
              addIssue(
                s.id,
                yk,
                "V6_cross_set_leak",
                "warning",
                bucketFor(scope, "warning"),
                `cross ${csId}`,
              );
          }
        }
        const choices = q.choices || [];
        if (choices.length !== 5)
          addIssue(
            s.id,
            yk,
            "V7a_choice_count",
            "warning",
            bucketFor(scope, "warning"),
            `cnt ${choices.length}`,
          );
        else {
          const okCount = choices.filter((c) => c.ok === true).length;
          const expOk = q.questionType === "positive" ? 1 : 4;
          if (okCount !== expOk)
            addIssue(
              s.id,
              yk,
              "V7a_ok_distribution",
              "warning",
              bucketFor(scope, "warning"),
              `ok=${okCount}`,
            );
        }
      }
    }
  }
}

// quarantine
for (const q of QUARANTINE_SETS) {
  if (setStatus[q.setId]) {
    setStatus[q.setId].source_status = "broken";
    setStatus[q.setId].release_status = "rebuild_required";
    addIssue(q.setId, q.yearKey, "QUARANTINE", "critical", "P2", q.reason);
  }
}

// lane + release_status 도출 (X.2 Safety Stopper 정합 — 자동 부여 영구 제거)
for (const sKey of Object.keys(setStatus)) {
  const ss = setStatus[sKey];
  ss.lane = laneFor(ss);
  if (ss.out_of_scope) ss.release_status = "hidden";
  else if (ss.source_status === "broken")
    ss.release_status = "rebuild_required";
  else if (ss.source_status === "suspect") ss.release_status = "hidden";
  else ss.release_status = "verifying";
  // 자동 "release" 부여 영구 금지 — gate1/2/3 + 사용자 승인 사후 결정
  ss._x2_safety_stopper = "auto_release_blocked_pending_gate1_2_3";
  ss.issues = issues
    .filter((i) => i.setId === sKey)
    .map((i) => ({
      code: i.code,
      severity: i.severity,
      bucket: i.bucket,
      msg: i.msg,
    }));
}

// ─── stats 도출 ───────────────────────────────────────────────
const set_counts = {
  total_sets_all: Object.keys(setStatus).length,
  total_sets_in_scope: Object.values(setStatus).filter((s) => !s.out_of_scope)
    .length,
  total_sets_out_of_scope: Object.values(setStatus).filter(
    (s) => s.out_of_scope,
  ).length,
  source_clean_sets: Object.values(setStatus).filter(
    (s) => s.source_status === "clean",
  ).length,
  source_suspect_sets: Object.values(setStatus).filter(
    (s) => s.source_status === "suspect",
  ).length,
  source_broken_sets: Object.values(setStatus).filter(
    (s) => s.source_status === "broken",
  ).length,
  source_missing_sets: Object.values(setStatus).filter(
    (s) => s.source_status === "missing",
  ).length,
};

const issue_counts = {
  total_issues: issues.length,
  issues_by_code: {},
  issues_by_bucket: { P0: 0, P1: 0, P2: 0, P3: 0, OUT_OF_SCOPE: 0 },
  issues_by_scope: {
    scopeA: 0,
    scopeB_FREE: 0,
    scopeB_NEAR: 0,
    scopeC_LEGACY: 0,
  },
  issues_by_severity: { critical: 0, warning: 0, info: 0 },
};
for (const i of issues) {
  issue_counts.issues_by_code[i.code] =
    (issue_counts.issues_by_code[i.code] || 0) + 1;
  issue_counts.issues_by_bucket[i.bucket] =
    (issue_counts.issues_by_bucket[i.bucket] || 0) + 1;
  issue_counts.issues_by_scope[scopeOf(i.yearKey)] =
    (issue_counts.issues_by_scope[scopeOf(i.yearKey)] || 0) + 1;
  issue_counts.issues_by_severity[i.severity] =
    (issue_counts.issues_by_severity[i.severity] || 0) + 1;
}

const lane_counts = {
  clean_existing: 0,
  clean_new: 0,
  broken_rebuild: 0,
  scope_pending: 0,
  out_of_scope: 0,
};
for (const s of Object.values(setStatus))
  lane_counts[s.lane] = (lane_counts[s.lane] || 0) + 1;

// release_queue_counts — gate1/2/3 + 사용자 승인 사후만 정합. 본 vFinal 안 자동 release 0건.
const release_queue_counts = {
  scopeA_gate0_pass: Object.values(setStatus).filter(
    (s) => s.scope === "scopeA" && s.lane === "clean_existing",
  ).length,
  scopeB_free_gate0_pass: Object.values(setStatus).filter(
    (s) => s.scope === "scopeB_FREE" && s.lane === "clean_existing",
  ).length,
  scopeB_near_gate0_pass: Object.values(setStatus).filter(
    (s) => s.scope === "scopeB_NEAR" && s.lane === "clean_existing",
  ).length,
  scopeC_legacy_gate0_pass: Object.values(setStatus).filter(
    (s) => s.scope === "scopeC_LEGACY" && s.lane === "clean_existing",
  ).length,
  note: "gate0 PASS 단독. gate1/2/3 + 사용자 승인 사후만 release 결정.",
};

// V9_summary
const V9_summary = {
  ok: Object.values(setStatus).filter((s) => s.v9_status === "ok").length,
  mismatch_critical: Object.values(setStatus).filter(
    (s) => s.v9_status === "mismatch_critical",
  ).length,
  needs_human: Object.values(setStatus).filter(
    (s) => s.v9_status === "needs_human",
  ).length,
  null_count: Object.values(setStatus).filter(
    (s) => s.v9_status === null && !s.out_of_scope,
  ).length,
};

// V9_mismatch_raw 14 field
const V9_mismatch_raw = Object.values(setStatus)
  .filter((s) => s.v9_status === "mismatch_critical")
  .map((ss) => {
    const ex = all[ss.yearKey];
    const sets = [...(ex.reading || []), ...(ex.literature || [])];
    const s = sets.find((x) => x.id === ss.setId);
    const sents = s.sents || [];
    const triggers = ss.v9_triggers || [];
    return {
      yearKey: ss.yearKey,
      setId: ss.setId,
      section: ss.section_declared,
      title: s.title,
      range: s.range,
      triggered_signal: triggers.map((t) => t.sig).join(","),
      triggered_text: triggers.map((t) => t.text).join(" | "),
      first80: sents[0] ? (sents[0].t || "").slice(0, 80) : "",
      last80:
        sents.length > 0 ? (sents[sents.length - 1].t || "").slice(-80) : "",
      V9_predicted_domain: "literature",
      actual_section: ss.section_declared,
      classification: triggers.some(
        (t) => t.sig === "sig_1" || t.sig === "sig_2" || t.sig === "sig_4",
      )
        ? "A_true_section_mismatch"
        : "C_mixed_or_unclear",
      recommended_action: "section 정정 또는 needs_human",
    };
  });

const report = {
  meta: {
    version: "vFinal",
    generated_at: new Date().toISOString(),
    tool: "gate0_source_fidelity.mjs vFinal",
  },
  scope_manifest: {
    supported_domain: SUPPORTED_DOMAIN,
    unsupported_domain: UNSUPPORTED_DOMAIN,
    scopes: SCOPES,
  },
  set_counts,
  issue_counts,
  lane_counts,
  release_queue_counts,
  V9_summary,
  V9_mismatch_raw,
  issues,
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
fs.writeFileSync(SET_STATUS_PATH, JSON.stringify(setStatus, null, 2));

console.log("=== Y.1 gate0 vFinal ===");
console.log("set_counts:", JSON.stringify(set_counts));
console.log(
  "issue_counts.by_bucket:",
  JSON.stringify(issue_counts.issues_by_bucket),
);
console.log(
  "issue_counts.by_scope:",
  JSON.stringify(issue_counts.issues_by_scope),
);
console.log("lane_counts:", JSON.stringify(lane_counts));
console.log("release_queue_counts:", JSON.stringify(release_queue_counts));
console.log("V9_summary:", JSON.stringify(V9_summary));
console.log("V9_mismatch_critical count:", V9_mismatch_raw.length);
const r2014a = setStatus["r2014a"];
const l20156c = setStatus["l20156c"];
console.log(
  "r2014a:",
  r2014a
    ? JSON.stringify({
        src: r2014a.source_status,
        lane: r2014a.lane,
        rel: r2014a.release_status,
      })
    : "X",
);
console.log(
  "l20156c:",
  l20156c
    ? JSON.stringify({
        src: l20156c.source_status,
        lane: l20156c.lane,
        rel: l20156c.release_status,
      })
    : "X",
);
