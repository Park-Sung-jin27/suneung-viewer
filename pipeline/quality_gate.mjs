/**
 * pipeline/quality_gate.mjs
 *
 * 전체 데이터 품질 검증 + 자동수정 단일 진입점.
 * 기존 일회성 패치 스크립트들을 모두 대체.
 *
 * 실행:
 *   node pipeline/quality_gate.mjs                → 전체 리포트 (dry-run)
 *   node pipeline/quality_gate.mjs --fix          → 자동수정 가능한 것 모두 처리
 *   node pipeline/quality_gate.mjs --fix 2025수능 → 특정 연도만
 *   node pipeline/quality_gate.mjs --report       → JSON 리포트 출력
 *
 * 자동수정 항목 (--fix):
 *   A. q.t 보기 혼재 → bogi 분리
 *   B. questionType 누락 → 발문 패턴 감지
 *   C. 선지 오염 텍스트 제거 (페이지번호/저작권/다음지문/확인사항)
 *   D. ok:true + pat → null
 *   E. ok:false + pat:0 → analysis 기반 자동 분류
 *   F. analysis 결론(✅/❌) vs ok 불일치 → 결론 줄 수정
 *   G. annotations sentId 형식 오류 (underscore 누락, 2022_6월 setKey)
 *
 * 수동 처리 목록 출력:
 *   - 선지 내용 없음 (표 파싱 실패)
 *   - analysis 🔍 내용 반전 → reanalyze_positive.mjs 호출 필요
 *   - bogi 없는 보기 문항
 *   - pat 분류 불가 (ok:false + analysis 키워드 없음)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// ─── 인라인 헬퍼 (step2_postprocess / step3_rules 핵심 로직 내장) ─────────────
const NEG_PATTERNS = [
  "않은",
  "않는",
  "틀린",
  "아닌",
  "없는",
  "거리가 먼",
  "잘못",
  "적절하지",
  "맞지 않",
  "옳지 않",
  "부적절",
  "해당하지",
  "일치하지",
  "어색한",
  "알 수 없는",
  "옳지않",
  "적합하지",
];
function detectQuestionType(t) {
  for (const p of NEG_PATTERNS) if ((t || "").includes(p)) return "negative";
  return "positive";
}
function splitBogiFromQt(q) {
  const t = q.t || "";
  const bogiIdx = t.search(/<보\s기>/);
  if (bogiIdx !== -1) {
    if (!q.bogi || q.bogi === "") q.bogi = t.slice(bogiIdx).trim();
    q.t = t.slice(0, bogiIdx).trim();
    return true;
  }
  const first = t.indexOf("<학습 활동>");
  const second = first !== -1 ? t.indexOf("<학습 활동>", first + 1) : -1;
  if (second !== -1 && (!q.bogi || q.bogi === "")) {
    q.bogi = t.slice(second).trim();
    q.t = t.slice(0, second).trim();
    return true;
  }
  return false;
}
function cleanChoiceText(c) {
  let t = c.t || "";
  const before = t;
  t = t.replace(/\s+\d{1,2}\s+\d\s*$/, "").trim();
  t = t.replace(/\s*20\s+이 문제지에 관한 저작권은.*$/, "").trim();
  t = t.replace(/\s*\*\s*확인 사항[\s\S]*$/, "").trim();
  t = t.replace(/\s*\[\d+[～~]\d+\][\s\S]*$/, "").trim();
  c.t = t;
  return t !== before;
}
function isEmptyChoice(c) {
  return !c.t?.trim() || /^\s*\d\s*$/.test(c.t);
}
const NEG_CONTENT = [
  "어긋나",
  "틀리",
  "왜곡",
  "오류",
  "잘못",
  "부적절",
  "맞지 않",
];
const POS_CONTENT = ["일치", "적절한", "올바르", "합당"];

function detectPatFromAnalysis(analysis, sec) {
  const a = analysis;
  if (
    /\[오류유형[①②③]/.test(a) ||
    a.includes("[L5]") ||
    a.includes("📌 보기 근거")
  )
    return "L5";
  if (a.includes("심리 오독") || a.includes("정서오독") || a.includes("[L2]"))
    return "L2";
  if (
    a.includes("팩트 왜곡") ||
    a.includes("개념 짜깁기") ||
    a.includes("[L1]") ||
    a.includes("사실 왜곡") ||
    a.includes("[R1]")
  )
    return sec === "reading" ? "R1" : "L1";
  if (
    a.includes("관계·인과") ||
    a.includes("인과 전도") ||
    a.includes("[L4]") ||
    a.includes("[R2]")
  )
    return sec === "reading" ? "R2" : "L4";
  if (
    a.includes("과도한 추론") ||
    a.includes("[L3]") ||
    a.includes("[R3]") ||
    a.includes("지문에 없")
  )
    return sec === "reading" ? "R3" : "L3";
  if (a.includes("개념 혼합") || a.includes("[R4]"))
    return sec === "reading" ? "R4" : "L1";
  if (a.includes("구조") || a.includes("대비") || a.includes("[L4]"))
    return "L4";
  if (a.includes("정서") || a.includes("감정") || a.includes("심리"))
    return "L2";
  return null;
}

function fixAnalysisConclusion(ana, ok) {
  const lines = ana.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes("✅") && !lines[i].includes("❌")) continue;
    if (ok === true && lines[i].includes("❌")) {
      lines[i] = lines[i]
        .replace(/❌.*\[.*?\]\s*$/, "✅ 지문과 일치하는 적절한 진술")
        .replace(/❌.*$/, "✅ 지문과 일치하는 적절한 진술");
    } else if (ok === false && lines[i].includes("✅")) {
      lines[i] = lines[i].replace(
        /✅.*$/,
        "❌ 지문과 어긋나는 부적절한 진술[?]",
      );
    }
    break;
  }
  return lines.join("\n");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const DATA_PATH = path.resolve(__dirname, "../public/data/all_data_204.json");
const ANN_PATH = path.resolve(__dirname, "../public/data/annotations.json");
const BACKUP_DIR = path.resolve(__dirname, "../pipeline/backups");

const args = process.argv.slice(2);
const FIX = args.includes("--fix");
const REPORT = args.includes("--report");
// --scope 프리셋: "suneung5" = 2022~2026수능 5개
const SCOPE = (() => {
  const scopeArg = args.find((a) => a.startsWith("--scope="));
  if (!scopeArg) return null;
  return scopeArg.split("=")[1];
})();
const SCOPE_YEARS = {
  suneung5: ["2022수능", "2023수능", "2024수능", "2025수능", "2026수능"],
};
const YEAR = args.find((a) => !a.startsWith("--"));

// ─── 로드 ────────────────────────────────────────────────────────────────────
const raw = fs.readFileSync(DATA_PATH, "utf8");
const data = JSON.parse(raw);

let ann = null;
try {
  ann = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));
} catch {}

// ─── 결과 수집 ────────────────────────────────────────────────────────────────
const issues = []; // 발견된 문제 전체
const autoFixed = []; // 자동 수정된 항목
const manual = []; // 수동 처리 필요 항목

function issue(type, yearKey, loc, message, severity = "warn") {
  issues.push({ type, yearKey, loc, message, severity });
}
function fixed(type, yearKey, loc, message) {
  autoFixed.push({ type, yearKey, loc, message });
}
function needsManual(type, yearKey, loc, message) {
  manual.push({ type, yearKey, loc, message });
}

// ─── sentId 유효 세트 수집 ────────────────────────────────────────────────────
const validSentIds = new Set();
for (const yd of Object.values(data))
  for (const sec of ["reading", "literature"])
    for (const s of yd[sec] || [])
      for (const sent of s.sents || []) validSentIds.add(sent.id);

// ─── 메인 순회 ────────────────────────────────────────────────────────────────
const yearsToCheck =
  SCOPE && SCOPE_YEARS[SCOPE]
    ? SCOPE_YEARS[SCOPE]
    : YEAR
      ? [YEAR]
      : Object.keys(data);

for (const yearKey of yearsToCheck) {
  if (!data[yearKey]) {
    console.warn(`⚠️  ${yearKey} 없음`);
    continue;
  }

  for (const sec of ["reading", "literature"]) {
    for (const set of data[yearKey][sec] || []) {
      for (const q of set.questions) {
        const qLoc = `${yearKey} ${set.id} Q${q.id}`;

        // ── A: q.t 보기 혼재 ──────────────────────────────────────────────
        const beforeT = q.t || "";
        if (FIX) splitBogiFromQt(q);
        if ((q.t || "").length < beforeT.length) {
          fixed("A_bogi_split", yearKey, qLoc, `q.t에서 보기 분리`);
        }

        // ── B: questionType 누락 ──────────────────────────────────────────
        if (!q.questionType || q.questionType === "N/A") {
          const detected = detectQuestionType(q.t);
          issue(
            "B_qt_missing",
            yearKey,
            qLoc,
            `questionType 없음 → 감지: ${detected}`,
          );
          if (FIX) {
            q.questionType = detected;
            fixed("B_qt_set", yearKey, qLoc, `questionType → ${detected}`);
          }
        }

        for (const c of q.choices) {
          const cLoc = `${qLoc}-[${c.num}]`;

          // ── C: 선지 오염 텍스트 ────────────────────────────────────────
          const before = c.t || "";
          const wasCleaned = cleanChoiceText(c);
          if (wasCleaned) {
            issue(
              "C_choice_pollution",
              yearKey,
              cLoc,
              `선지 오염: "${before.slice(-30)}"`,
            );
            if (!FIX) {
              c.t = before;
            } else {
              fixed("C_cleaned", yearKey, cLoc, "오염 제거");
            }
          }

          // ── C-2: 선지 내용 없음 ────────────────────────────────────────
          if (isEmptyChoice(c)) {
            needsManual(
              "C_empty_choice",
              yearKey,
              cLoc,
              "선지 내용 없음 (표 파싱 실패) → 수동 입력 필요",
            );
          }

          // ── D: ok:true + pat 있음 ──────────────────────────────────────
          if (c.ok === true && c.pat !== null && c.pat !== undefined) {
            issue("D_true_has_pat", yearKey, cLoc, `ok:true인데 pat:${c.pat}`);
            if (FIX) {
              c.pat = null;
              fixed("D_pat_null", yearKey, cLoc, "pat → null");
            }
          }

          // ── E: ok:false + pat 없음/0 ───────────────────────────────────
          if (c.ok === false && (!c.pat || c.pat === "0" || c.pat === 0)) {
            const detected = detectPatFromAnalysis(c.analysis || "", sec);
            if (detected) {
              issue("E_pat_zero", yearKey, cLoc, `pat:0 → 감지: ${detected}`);
              if (FIX) {
                c.pat = detected;
                fixed("E_pat_classified", yearKey, cLoc, `pat → ${detected}`);
              }
            } else {
              needsManual(
                "E_pat_unclassifiable",
                yearKey,
                cLoc,
                "pat 분류 불가 → 수동 확인",
              );
            }
          }

          // ── F: analysis 결론 vs ok 불일치 ─────────────────────────────
          const ana = c.analysis || "";
          const hasOkMark = ana.includes("✅");
          const hasFailMark = ana.includes("❌");
          const conclusionMismatch =
            (c.ok === true && hasFailMark && !hasOkMark) ||
            (c.ok === false && hasOkMark && !hasFailMark);

          if (conclusionMismatch) {
            issue(
              "F_conclusion_mismatch",
              yearKey,
              cLoc,
              `ok:${c.ok} ↔ analysis 결론 불일치`,
            );
            if (FIX) {
              c.analysis = fixAnalysisConclusion(ana, c.ok);
              fixed("F_conclusion_fixed", yearKey, cLoc, "결론 줄 수정");
            }
          }

          // ── F-2: analysis 반전 (결론 이모지 기준, isReversed와 동기화) ─
          // 마지막 ✅/❌ 이모지가 ok 값과 일치하는지 검사
          // - ok:true + 결론 ❌ → reversed
          // - ok:false + 결론 ✅ → reversed
          // - 결론 이모지 없음 → reversed (포맷 파손)
          let contentReversed = false;
          if (!ana.trim()) {
            // 빈 analysis는 F_empty_analysis로 별도 처리
          } else {
            const lastPos = Math.max(
              ana.lastIndexOf("✅"),
              ana.lastIndexOf("❌"),
            );
            if (lastPos < 0) {
              contentReversed = true;
            } else {
              const conclusion = ana.slice(lastPos);
              if (c.ok === true && conclusion.startsWith("❌"))
                contentReversed = true;
              if (c.ok === false && conclusion.startsWith("✅"))
                contentReversed = true;
            }
          }

          if (contentReversed && !conclusionMismatch) {
            needsManual(
              "F_content_reversed",
              yearKey,
              cLoc,
              "결론 이모지(✅/❌) vs ok 불일치 → reanalyze 필요",
            );
          }

          // ── F-3: analysis 비어있음 ─────────────────────────────────────
          if (!ana.trim()) {
            needsManual(
              "F_empty_analysis",
              yearKey,
              cLoc,
              "analysis 비어있음 → step3 재실행 필요",
            );
          }

          // ── DEAD cs_ids ────────────────────────────────────────────────
          for (const csId of c.cs_ids || []) {
            if (!validSentIds.has(csId)) {
              needsManual("DEAD_csid", yearKey, cLoc, `DEAD cs_id: ${csId}`);
            }
          }

          // ── H: analysis 내부 ID 노출 ────────────────────────────────────
          // [r2024cs11], r2024cs11, (as11), (as11~as15), q1_c3 등
          const ID_LEAK_RE =
            /\[[a-z_0-9]+s\d+\]|\[[a-z0-9]+_s\d+\]|\((?:as|cs|bs|ds|es)\d+(?:~(?:as|cs|bs|ds|es)\d+)?\)|q\d+_c\d+|\b[rl]\d{4}[a-z_0-9]*s\d+\b/;
          if (ana && ID_LEAK_RE.test(ana)) {
            if (FIX) {
              const cleaned = ana
                .replace(/\s*\[[a-z_0-9]+s\d+\]/g, "")
                .replace(/\s*\[[a-z0-9]+_s\d+\]/g, "")
                .replace(
                  /\s*\((?:as|cs|bs|ds|es)\d+(?:~(?:as|cs|bs|ds|es)\d+)?\)/g,
                  "",
                )
                .replace(/\s*q\d+_c\d+/g, "")
                .replace(/\s*\b[rl]\d{4}[a-z_0-9]*s\d+\b/g, "")
                .replace(/\s{2,}/g, " ")
                .replace(/ ([.,])/g, "$1")
                .trim();
              c.analysis = cleaned;
              fixed("H_id_leak_removed", yearKey, cLoc, "내부 ID 패턴 제거");
            } else {
              issue(
                "H_analysis_id_leak",
                yearKey,
                cLoc,
                "analysis에 내부 ID 노출",
              );
            }
          }

          // ── MISSING cs_ids: 근거 있어야 할 선지에 cs_ids 없음 ───────────
          const hasCsIds = Array.isArray(c.cs_ids) && c.cs_ids.length > 0;
          if (!hasCsIds) {
            if (c.ok === true) {
              needsManual(
                "MISSING_csid_true",
                yearKey,
                cLoc,
                "ok:true인데 cs_ids 없음 (근거 문장 미매핑)",
              );
            } else if (c.ok === false) {
              const pat = c.pat;
              // R3/V/0/null은 [] 허용, 그 외 R1/R2/R4/L1/L2/L4/L5는 필수
              const REQUIRES_CS = ["R1", "R2", "R4", "L1", "L2", "L4", "L5"];
              if (REQUIRES_CS.includes(pat)) {
                needsManual(
                  "MISSING_csid_false",
                  yearKey,
                  cLoc,
                  `ok:false pat:${pat}인데 cs_ids 없음 (왜곡 출처 미매핑)`,
                );
              }
            }
          }
        }

        // ── bogi 없는 보기 문항 경고 ─────────────────────────────────────
        const hasBogiKeyword = /<보기>|<보\s기>|<학습\s활동>/.test(q.t || "");
        if (hasBogiKeyword && !q.bogi) {
          needsManual(
            "G_missing_bogi",
            yearKey,
            qLoc,
            "보기 문항인데 bogi 없음",
          );
        }
      }

      // ── H2: 세트 내 cs_ids 몰빵 감지 (동일 sent_id 5회+ 반복) ───────────
      const freq = new Map();
      for (const q of set.questions || []) {
        for (const c of q.choices || []) {
          for (const id of c.cs_ids || [])
            freq.set(id, (freq.get(id) || 0) + 1);
        }
      }
      for (const [id, cnt] of freq) {
        if (cnt >= 5) {
          needsManual(
            "H_cs_concentration",
            yearKey,
            `${set.id} ${id}`,
            `동일 sent ${cnt}회 반복 — 재분석 대상`,
          );
        }
      }
    }
  }
}

// ─── annotations 검증 (G) ─────────────────────────────────────────────────────
if (ann) {
  for (const [yearKey, yearAnn] of Object.entries(ann)) {
    for (const [setKey, items] of Object.entries(yearAnn)) {
      for (const item of items) {
        for (const field of ["sentId", "sentFrom", "sentTo"]) {
          const sid = item[field];
          if (!sid || validSentIds.has(sid)) continue;

          // 자동 수정 시도
          const fix1 = sid.replace(/^([a-zA-Z]+\d{4}[a-z])(s\d+)$/, "$1_$2");
          const fix2 = sid.replace(
            /^([rl])2022j([abcd])(s\d+)$/,
            (_, r, l, s) => `${r}20226${l}_${s}`,
          );

          if (validSentIds.has(fix1)) {
            issue(
              "G_ann_sentid",
              yearKey,
              `${setKey}[${field}]`,
              `${sid} → ${fix1}`,
            );
            if (FIX) {
              item[field] = fix1;
              fixed("G_ann_fixed", yearKey, `${setKey}`, `${sid}→${fix1}`);
            }
          } else if (validSentIds.has(fix2)) {
            issue(
              "G_ann_sentid",
              yearKey,
              `${setKey}[${field}]`,
              `${sid} → ${fix2}`,
            );
            if (FIX) {
              item[field] = fix2;
              fixed("G_ann_fixed", yearKey, `${setKey}`, `${sid}→${fix2}`);
            }
          } else {
            needsManual(
              "G_ann_dead",
              yearKey,
              `${setKey}[${field}]`,
              `DEAD sentId: ${sid}`,
            );
          }
        }
      }
    }
  }
}

// ─── 결과 출력 ────────────────────────────────────────────────────────────────
// chalk 불필요 — 단순 텍스트 출력
const chalk = {
  red: (s) => s,
  yellow: (s) => s,
  green: (s) => s,
  cyan: (s) => s,
  bold: (s) => s,
};

console.log("\n" + "═".repeat(60));
console.log(" QUALITY GATE REPORT");
console.log("═".repeat(60));

// 연도별 이슈 집계
const issuesByYear = {};
for (const iss of issues) {
  if (!issuesByYear[iss.yearKey]) issuesByYear[iss.yearKey] = 0;
  issuesByYear[iss.yearKey]++;
}

console.log("\n[ 연도별 이슈 ]");
for (const [y, cnt] of Object.entries(issuesByYear)) {
  const status = cnt === 0 ? "✅" : "🔴";
  console.log(`  ${status} ${y}: ${cnt}건`);
}

// ─── 3단계 분류: CRITICAL / WARNING / IGNORE ──────────────────────────────────
// CRITICAL: 기능 깨짐 (사용자 경험 직접 영향)
// WARNING:  품질 문제 (내용은 보이나 부정확)
// IGNORE:   중요도 낮음 (형식 문제, 자동분류 가능)
const SEVERITY_MAP = {
  DEAD_csid: "CRITICAL",
  F_empty_analysis: "CRITICAL",
  MISSING_csid_true: "CRITICAL",
  MISSING_csid_false: "CRITICAL",
  H_analysis_id_leak: "CRITICAL",
  F_content_reversed: "WARNING",
  D_true_has_pat: "WARNING",
  H_cs_concentration: "WARNING",
  E_pat_unclassifiable: "IGNORE",
  F_conclusion_mismatch: "IGNORE",
  E_pat_zero: "IGNORE",
};
const ALL_FINDINGS = [...issues, ...manual];
const bySeverity = { CRITICAL: [], WARNING: [], IGNORE: [] };
for (const f of ALL_FINDINGS) {
  const sev = SEVERITY_MAP[f.type] || "WARNING";
  bySeverity[sev].push(f);
}

function printSeverity(label, arr, icon) {
  console.log(`\n[ ${icon} ${label}: ${arr.length}건 ]`);
  const byType = {};
  for (const f of arr) byType[f.type] = (byType[f.type] || 0) + 1;
  for (const [t, cnt] of Object.entries(byType))
    console.log(`  ${t}: ${cnt}건`);
}
printSeverity("CRITICAL (기능 깨짐)", bySeverity.CRITICAL, "🔴");
printSeverity("WARNING (품질 문제)", bySeverity.WARNING, "🟡");
printSeverity("IGNORE (중요도 낮음)", bySeverity.IGNORE, "⚪");

console.log(`\n[ 자동수정 가능: ${issues.length}건 ]`);
const typeCount = {};
for (const iss of issues) typeCount[iss.type] = (typeCount[iss.type] || 0) + 1;
for (const [t, cnt] of Object.entries(typeCount))
  console.log(`  ${t}: ${cnt}건`);

// CRITICAL 상세는 항상 출력 (0건이 목표이므로 남으면 반드시 확인)
if (bySeverity.CRITICAL.length > 0 && !REPORT) {
  console.log("\n  🔴 CRITICAL 상세:");
  for (const m of bySeverity.CRITICAL.slice(0, 20))
    console.log(`    ${m.yearKey} ${m.loc}: ${m.message}`);
  if (bySeverity.CRITICAL.length > 20)
    console.log(`    ... 외 ${bySeverity.CRITICAL.length - 20}건`);
}

if (FIX) {
  console.log(`\n[ 자동수정 완료: ${autoFixed.length}건 ]`);

  // 저장
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.writeFileSync(
    path.join(BACKUP_DIR, `all_data_204_backup_${ts}.json`),
    raw,
  );
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  if (ann) fs.writeFileSync(ANN_PATH, JSON.stringify(ann, null, 2), "utf8");
  console.log("✅ 파일 저장 완료 (백업 포함)");
}

if (REPORT) {
  const reportPath = path.resolve(__dirname, "../pipeline/quality_report.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        issues,
        autoFixed,
        manual,
        critical: bySeverity.CRITICAL,
        warning: bySeverity.WARNING,
        ignore: bySeverity.IGNORE,
      },
      null,
      2,
    ),
  );
  console.log(`\n📄 리포트 저장: ${reportPath}`);
}

if (!FIX && issues.length > 0) {
  console.log("\n→ 자동수정 적용: node pipeline/quality_gate.mjs --fix");
}

// 릴리스 판정 — CRITICAL 0건이면 release_ready
console.log("\n" + "═".repeat(60));
if (bySeverity.CRITICAL.length === 0) {
  console.log("✅ release_ready — CRITICAL 0건");
} else {
  console.log(
    `🔴 release_blocked — CRITICAL ${bySeverity.CRITICAL.length}건 남음`,
  );
}
console.log("═".repeat(60) + "\n");
