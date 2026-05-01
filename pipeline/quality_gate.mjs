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
// Gate 5: 확장 CRITICAL 검사 (기본 off — 점진적 활성화)
const GATE5 = args.includes("--gate5");
// Gate 7: 골든셋만 돌림 (회귀 테스트 모드)
const GOLDEN_ONLY = args.includes("--golden");
// --scope 프리셋: "suneung5" = 2022~2026수능 5개
const SCOPE = (() => {
  const scopeArg = args.find((a) => a.startsWith("--scope="));
  if (!scopeArg) return null;
  return scopeArg.split("=")[1];
})();
const SCOPE_YEARS = {
  suneung5: ["2022수능", "2023수능", "2024수능", "2025수능", "2026수능"],
  모의고사전체: [
    "2022_6월", "2022_9월",
    "2023_6월", "2023_9월",
    "2024_6월", "2024_9월",
    "2025_6월", "2025_9월",
    "2026_6월", "2026_9월",
  ],
};
const YEAR = args.find((a) => !a.startsWith("--"));

// ─── Gate 7 골든셋 로드 ────────────────────────────────────────────────────────
const GOLDEN_PATH = path.resolve(__dirname, "golden_set.json");
let GOLDEN = [];
try {
  GOLDEN = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf8")).items || [];
} catch {}
const goldenMatch = (yearKey, setId, qId) =>
  GOLDEN.some(
    (g) =>
      g.year === yearKey &&
      (!g.setId || g.setId === setId) &&
      (!g.questionId || g.questionId === qId),
  );
// expected 코드 맵: "yearKey/setId/qId" → Set<코드>
const GOLDEN_EXPECTED = new Map();
for (const g of GOLDEN) {
  const k = `${g.year}/${g.setId || "*"}/${g.questionId || "*"}`;
  GOLDEN_EXPECTED.set(k, new Set(g.expected || []));
}
function goldenExpected(yearKey, setId, qId) {
  return (
    GOLDEN_EXPECTED.get(`${yearKey}/${setId}/${qId}`) ||
    GOLDEN_EXPECTED.get(`${yearKey}/${setId}/*`) ||
    GOLDEN_EXPECTED.get(`${yearKey}/*/*`) ||
    new Set()
  );
}

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
      // ── [Gate 5] C_figure_missing — figure sent이 있으나 FIGURE_IMAGE_MAP에 미매핑 ─
      //   constants.js의 FIGURE_IMAGE_MAP을 로드해 매핑 누락 figure 탐지
      //   --golden 모드일 땐 골든셋에 등록된 세트만 검사
      const _goldenSetAllowed = !GOLDEN_ONLY || GOLDEN.some(
        (g) => g.year === yearKey && (!g.setId || g.setId === set.id),
      );
      if (GATE5 && _goldenSetAllowed) {
        if (!globalThis.__figureMap) {
          try {
            const c = fs.readFileSync(
              path.resolve(__dirname, "../src/constants.js"),
              "utf8",
            );
            // FIGURE_IMAGE_MAP = { ... } 블록 전체 (최상위 { } 균형 탐색)
            const idx = c.indexOf("FIGURE_IMAGE_MAP");
            let body = "";
            if (idx >= 0) {
              const start = c.indexOf("{", idx);
              if (start >= 0) {
                let depth = 0;
                for (let i = start; i < c.length; i++) {
                  if (c[i] === "{") depth++;
                  else if (c[i] === "}") {
                    depth--;
                    if (depth === 0) {
                      body = c.slice(start + 1, i);
                      break;
                    }
                  }
                }
              }
            }
            const map = new Set();
            // 최상위 키만 추출 — depth 1에서 `<id>:` 패턴 (중첩 객체 내부 키 제외)
            let d = 0;
            for (const line of body.split(/\r?\n/)) {
              // 이 줄 처리 전 depth가 0이면 최상위
              if (d === 0) {
                const m2 = line.match(
                  /^\s*["']?([a-zA-Z_$][a-zA-Z0-9_$]*)["']?\s*:/,
                );
                if (m2) map.add(m2[1]);
              }
              for (const ch of line) {
                if (ch === "{") d++;
                else if (ch === "}") d--;
              }
            }
            globalThis.__figureMap = map;
          } catch {
            globalThis.__figureMap = new Set();
          }
        }
        for (const s of set.sents || []) {
          if (s.sentType === "figure" && !globalThis.__figureMap.has(s.id)) {
            issue(
              "C_figure_missing",
              yearKey,
              `${set.id} ${s.id}`,
              `figure sent 이미지 자산 미매핑 (FIGURE_IMAGE_MAP)`,
            );
          }
        }
      }

      for (const q of set.questions) {
        // [Gate 7] --golden 지정 시 골든셋 외 스킵
        if (GOLDEN_ONLY && !goldenMatch(yearKey, set.id, q.id)) continue;
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

          // ── [Gate 5] 확장 CRITICAL 검사 (기본 off, --gate5로 활성화) ───
          if (GATE5) {
            const csSents = (c.cs_ids || [])
              .map((id) => set.sents.find((s) => s.id === id))
              .filter(Boolean);

            // [Tier 2] 인용표현 미반영 — 2단계 분리
            //   W_quote_unreflected (WARNING): cs_ids sent 본문에만 없음
            //   C_quote_unreflected (WARNING/승격후보): sent + cs_spans + analysis 전부 부재
            const quoteMatches = [
              ...(c.t || "").matchAll(/['‘]([^'’]{2,40})['’]|["“]([^"”]{2,40})["”]/g),
            ].map((m) => (m[1] || m[2] || "").trim()).filter(Boolean);
            const norm = (s) => String(s || "").replace(/\s+/g, "");
            const joined = norm(csSents.map((s) => s.t || "").join(" "));
            const spansText = norm((c.cs_spans || []).map((s) => s.text || "").join(" "));
            const analysisText = norm(ana || "");
            for (const quote of quoteMatches) {
              const nq = norm(quote);
              if (nq.length < 2) continue;
              if (joined.includes(nq)) continue; // 정상 통과
              const inSpans = spansText.includes(nq);
              const inAnalysis = analysisText.includes(nq);
              if (!inSpans && !inAnalysis) {
                // triple miss → 강한 경고 (향후 승격 후보)
                issue(
                  "C_quote_unreflected",
                  yearKey,
                  cLoc,
                  `선지 인용 "${quote}"가 cs_ids sent / cs_spans / analysis 어디에도 없음`,
                );
              } else {
                issue(
                  "W_quote_unreflected",
                  yearKey,
                  cLoc,
                  `선지 인용 "${quote}"가 cs_ids sent 본문에 없음 (spans/analysis엔 존재)`,
                );
              }
              break;
            }

            // C_work_mismatch — 선지가 언급한 모든 작품 라벨의 합집합 범위 밖 cs_ids 탐지
            //   heuristic: 선지·stem 본문의 "(가)|(나)|(다)|(라)" 전부 수집 →
            //              각 라벨 범위 합집합 계산 → cs_ids가 합집합 밖이면 flag
            //   stem만 "(가)~(다)" 같은 포괄 언급이면 모든 작품 허용 → skip
            const workMarksChoice = [
              ...new Set(
                ((c.t || "").match(/\((가|나|다|라)\)/g) || []).map(
                  (s) => s[1],
                ),
              ),
            ];
            const stemIsGeneric = /\((가|나|다|라)\)\s*[~∼]\s*\((가|나|다|라)\)/.test(
              q.t || "",
            );
            if (workMarksChoice.length > 0 && csSents.length > 0 && !stemIsGeneric) {
              // workTag 경계 수집
              const tagIdx = [];
              set.sents.forEach((s, i) => {
                if (s.sentType === "workTag") {
                  const mm = (s.t || "").match(/\((가|나|다|라)\)/);
                  if (mm) tagIdx.push({ i, label: mm[1] });
                }
              });
              if (tagIdx.length >= 2) {
                // 선지가 언급한 각 라벨의 [lo, hi) 범위 합집합
                const allowedRanges = [];
                for (const label of workMarksChoice) {
                  const tIdx = tagIdx.findIndex((t) => t.label === label);
                  if (tIdx < 0) continue;
                  const lo = tagIdx[tIdx].i;
                  const hi =
                    tIdx + 1 < tagIdx.length
                      ? tagIdx[tIdx + 1].i
                      : set.sents.length;
                  allowedRanges.push([lo, hi]);
                }
                if (allowedRanges.length > 0) {
                  const ranges = csSents.map((s) =>
                    set.sents.findIndex((x) => x.id === s.id),
                  );
                  const outside = ranges.filter(
                    (r) =>
                      r >= 0 &&
                      !allowedRanges.some(([lo, hi]) => r >= lo && r < hi),
                  );
                  if (outside.length > 0) {
                    issue(
                      "C_work_mismatch",
                      yearKey,
                      cLoc,
                      `선지가 지시한 (${workMarksChoice.join("·")}) 작품 범위 밖 sent 참조 ${outside.length}건`,
                    );
                  }
                }
              }
            }

            // C_marker_pollution — body sent에 부당한 원문자 잔존
            //   "부당"의 heuristic: sent.sentType === 'body' 이면서, 해당 세트의 question/choice 에서
            //   그 원문자를 참조하지 않는 경우. (참조되는 원문자는 의도된 표지이므로 허용)
            // (세트 단위로 1번만 수집하여 per-choice 루프에서 중복 쿼리 방지)
            if (!set.__q5_marker_cache) {
              const referenced = new Set();
              const re = /[ⓐ-ⓘ㉠-㉦①-⑨]|\[[A-E]\]/g;
              for (const qq of set.questions) {
                for (const cc of qq.choices || []) {
                  for (const m of (cc.t || "").matchAll(re)) referenced.add(m[0]);
                }
                for (const m of (qq.t || "").matchAll(re)) referenced.add(m[0]);
              }
              const pollution = [];
              for (const s of set.sents) {
                if (s.sentType !== "body") continue;
                for (const m of (s.t || "").matchAll(re)) {
                  if (!referenced.has(m[0])) pollution.push({ id: s.id, mk: m[0] });
                }
              }
              set.__q5_marker_cache = pollution;
            }
            if (c.num === 1 && set.__q5_marker_cache.length > 0) {
              for (const p of set.__q5_marker_cache) {
                issue(
                  "C_marker_pollution",
                  yearKey,
                  `${set.id} ${p.id}`,
                  `body sent에 참조되지 않는 원문자 "${p.mk}"`,
                );
              }
              set.__q5_marker_cache = []; // 보고 후 클리어
            }

            // C_pat_mismatch — ok:false인데 analysis가 주장하는 오류 성격과 pat 명백히 불일치
            if (c.ok === false && c.pat && typeof c.pat === "string") {
              const a = ana || "";
              const claimsReverse = /정반대|역전|반대로 서술|뒤집|반대되는/.test(a);
              const claimsCausal = /인과|관계 전도|뒤바|주체-객체/.test(a);
              const claimsOveraim = /지문에 없|과잉 추론|과도한 추론|끼워 넣|외삽/.test(a);
              const p = c.pat;
              let mismatch = false;
              if (claimsOveraim && !/^(R3|L3)$/.test(p)) mismatch = true;
              else if (claimsCausal && !/^(R2|L2|L4)$/.test(p)) mismatch = true;
              else if (
                claimsReverse &&
                !/^(R1|L1|L2)$/.test(p)
              )
                mismatch = true;
              if (mismatch) {
                issue(
                  "C_pat_mismatch",
                  yearKey,
                  cLoc,
                  `pat=${p} vs analysis가 주장하는 오류 성격 불일치`,
                );
              }
            }

            // C_highlight_analysis_divergence — analysis의 📌 지문 근거 인용문이 cs_ids 본문에 완전 부재
            const anchorMatch = (ana || "").match(/📌\s*(?:지문 근거|보기 근거)\s*:\s*["“]([^"”]{10,200})["”]/);
            if (anchorMatch && csSents.length > 0) {
              const needle = norm(anchorMatch[1].slice(0, 30));
              if (needle.length >= 10 && !joined.includes(needle)) {
                issue(
                  "C_highlight_analysis_divergence",
                  yearKey,
                  cLoc,
                  `analysis 인용문이 cs_ids 본문과 겹치지 않음`,
                );
              }
            }

            // W_argument_thin — ok:false 인데 분해 표지(①②③/첫째/둘째) 없음
            if (c.ok === false && ana && !/①|②|③|❶|❷|❸|조건 ?분해|첫째|둘째|\[선지 조건/.test(ana)) {
              issue("W_argument_thin", yearKey, cLoc, "선지 조건 분해 없음 (①②③ 미사용)");
            }

            // W_expression_analysis_missing — 선지에 인용/원문자 있는데 표현 기능 키워드 부재
            const hasExprMarker =
              /[ⓐ-ⓘ㉠-㉦①-⑨]|\[[A-E]\]|['‘].+['’]|["“].+["”]/.test(c.t || "");
            if (hasExprMarker && ana && !/기능|상징|효과|평가|표현|인용|의미|전달|강조/.test(ana)) {
              issue(
                "W_expression_analysis_missing",
                yearKey,
                cLoc,
                "선지 인용/원문자 있으나 표현 분석 키워드 부재",
              );
            }

            // W_single_evidence — 문학 표현/복합 문항에서만 검사 (독서는 off)
            //   "표현/복합" heuristic: 선지·stem에 원문자·인용표현·(가)(나)(다) 지시가 있을 때
            if (
              c.ok === true &&
              Array.isArray(c.cs_ids) &&
              c.cs_ids.length === 1 &&
              sec === "literature"
            ) {
              const exprComplex =
                /[ⓐ-ⓘ㉠-㉦①-⑨]|\[[A-E]\]|['‘].+['’]|["“].+["”]|\((가|나|다|라)\)/;
              if (exprComplex.test(c.t || q.t || "")) {
                issue(
                  "W_single_evidence",
                  yearKey,
                  cLoc,
                  "문학 표현/복합 문항 ok:true 단일 근거 — multi-evidence 권장",
                );
              }
            }

            // [Gate 5] C_label_domain_mismatch — pat R계열이지만 analysis [L*] (또는 반대)
            //   pat 값과 analysis 본문 라벨이 같은 도메인이어야 함.
            //   --fix 시 pat에 맞춰 라벨을 자동 교체.
            if (c.ok === false && typeof c.pat === "string" && c.analysis) {
              const isR = /^R[1-4]$/.test(c.pat);
              const isL = /^L[1-5]$/.test(c.pat);
              const wrongRe = isR
                ? /\[L[1-5]\]/g
                : isL
                  ? /\[R[1-4]\]/g
                  : null;
              if (wrongRe && wrongRe.test(c.analysis)) {
                if (FIX) {
                  const before = c.analysis;
                  c.analysis = before.replace(wrongRe, `[${c.pat}]`);
                  if (c.analysis !== before) {
                    fixed(
                      "C_label_domain_mismatch_fixed",
                      yearKey,
                      cLoc,
                      `라벨 도메인 교정 → [${c.pat}]`,
                    );
                  }
                } else {
                  issue(
                    "C_label_domain_mismatch",
                    yearKey,
                    cLoc,
                    `pat=${c.pat} vs analysis 라벨 도메인 불일치`,
                  );
                }
              }
            }

            // [Gate 5] C_vpat_dirty — pat=V 인데 cs_ids/cs_spans 비어있지 않음
            //   어휘 문항(V)은 cs_ids=[], cs_spans 없음이 규칙.
            //   --fix 시 cs_ids=[], cs_spans 제거.
            if (c.pat === "V") {
              const dirtyIds = Array.isArray(c.cs_ids) && c.cs_ids.length > 0;
              const dirtySpans =
                Array.isArray(c.cs_spans) && c.cs_spans.length > 0;
              if (dirtyIds || dirtySpans) {
                if (FIX) {
                  c.cs_ids = [];
                  if (c.cs_spans) delete c.cs_spans;
                  fixed(
                    "C_vpat_dirty_fixed",
                    yearKey,
                    cLoc,
                    `V pat 정합 — cs_ids/cs_spans 비움`,
                  );
                } else {
                  issue(
                    "C_vpat_dirty",
                    yearKey,
                    cLoc,
                    `pat=V인데 cs_ids=${(c.cs_ids || []).length}건 / cs_spans=${(c.cs_spans || []).length}건`,
                  );
                }
              }
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
// [Gate 5] 출시 차단(critical) vs 품질 향상(warning) 명확 분리
//
// CRITICAL — 출시 차단:
//   - 형광펜 없음 (MISSING_csid_true, MISSING_csid_false)
//   - 작품 mismatch (C_work_mismatch — 선지가 가리키는 작품과 cs_ids 범위 불일치)
//   - 인용표현 미반영 (C_quote_unreflected — 선지의 '...' / "..." 인용이 cs_ids sent 안에 없음)
//   - 그림/도식 누락 (C_figure_missing — sentType=figure 인데 이미지 자산 미매핑)
//   - 원문자 오염 (C_marker_pollution — 지문 body 에 부당한 원문자 잔존)
//   - 내부 ID 노출 (H_analysis_id_leak)
//   - pat 명백한 불일치 (C_pat_mismatch — analysis 본문이 주장하는 오류 성격과 pat 값 충돌)
//   - 해설-형광펜 완전 불일치 (C_highlight_analysis_divergence)
//   - 해설 결론 파손 (F_empty_analysis)
//   - DEAD_csid
//
// WARNING — 품질 향상:
//   - F_content_reversed (결론 이모지만 뒤집힘)
//   - W_argument_thin (조건 ①②③ 분해 없음)
//   - W_expression_analysis_missing (선지 인용/원문자 있는데 analysis에 표현 분석 키워드 없음)
//   - W_single_evidence (ok:true 인데 cs_ids 1개만 — multi-evidence 권장)
//   - H_cs_concentration
//
// IGNORE — 중요도 낮음
const SEVERITY_MAP = {
  // CRITICAL (출시 차단) — Tier 1
  DEAD_csid: "CRITICAL",
  F_empty_analysis: "CRITICAL",
  MISSING_csid_true: "CRITICAL",
  MISSING_csid_false: "CRITICAL",
  H_analysis_id_leak: "CRITICAL",      // Tier 1
  C_figure_missing: "CRITICAL",        // Tier 1
  C_marker_pollution: "CRITICAL",      // Tier 1
  C_work_mismatch: "CRITICAL",         // Tier 1
  C_label_domain_mismatch: "CRITICAL", // Tier 1 (pat R ↔ 라벨 L / 반대)
  C_vpat_dirty: "CRITICAL",            // Tier 1 (pat=V 인데 cs_ids/cs_spans 비어있지 않음)

  // WARNING (품질 향상) — Tier 2·3
  // Tier 2 (검증 필요 — 승격 후보, false positive 검수 후 CRITICAL로)
  C_quote_unreflected: "WARNING",              // Tier 2: sent/spans/analysis 전부 부재
  C_highlight_analysis_divergence: "WARNING",  // Tier 2
  W_quote_unreflected: "WARNING",              // 약한 변형: cs_ids sent 본문에만 부재

  // Tier 3 (승격 금지)
  C_pat_mismatch: "WARNING",                   // Tier 3

  // 기존 WARNING
  F_content_reversed: "WARNING",
  D_true_has_pat: "WARNING",
  H_cs_concentration: "WARNING",
  W_argument_thin: "WARNING",
  W_expression_analysis_missing: "WARNING",
  W_single_evidence: "WARNING",

  // IGNORE
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

// [Gate 7] 골든셋 게이트 판정 — --golden 모드에서만
// 정책:
//  - 골든셋 각 문항의 issue 목록에서 expected(허용 백서)에 없는 CRITICAL이 있으면 blocked
//  - expected에 있는 코드는 '이미 알려진 알려진 이슈'로 간주되어 통과
if (GOLDEN_ONLY && GATE5) {
  console.log("\n" + "═".repeat(60));
  console.log(" GATE 7 — 골든셋 회귀 테스트");
  console.log("═".repeat(60));
  const unexpected = [];
  for (const f of ALL_FINDINGS) {
    const sev = SEVERITY_MAP[f.type] || "WARNING";
    if (sev !== "CRITICAL") continue;
    // loc에서 setId/qId 추출 — 두 포맷 지원
    //   "<yearKey> <setId> Q<n>-[<num>]"
    //   "<setId> <sentId>"  (figure·marker pollution 등 세트 레벨)
    let setId = null, qId = null;
    const mq = f.loc.match(/([a-zA-Z0-9_]+) Q(\d+)/);
    if (mq) { setId = mq[1]; qId = +mq[2]; }
    else {
      const ms = f.loc.match(/^([a-zA-Z0-9_]+)(?:\s|$)/);
      if (ms) setId = ms[1];
    }
    const expected = goldenExpected(f.yearKey, setId, qId);
    if (!expected.has(f.type)) unexpected.push(f);
  }
  if (unexpected.length === 0) {
    console.log(" ✅ 골든셋 통과 — 예상 외 CRITICAL 0건 (merge 허용)");
  } else {
    console.log(
      ` 🔴 골든셋 차단 — 예상 외 CRITICAL ${unexpected.length}건 (merge 금지)`,
    );
    for (const f of unexpected.slice(0, 20)) {
      console.log(`   [${f.type}] ${f.yearKey} ${f.loc}: ${f.message}`);
    }
    if (unexpected.length > 20) console.log(`   ... 외 ${unexpected.length - 20}건`);
  }
  console.log("═".repeat(60) + "\n");
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
