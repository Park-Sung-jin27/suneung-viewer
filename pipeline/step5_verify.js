import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { jsonrepair } from "jsonrepair";
import { retrySet, postProcess } from "./step3_analysis.js";
import { assignCsIds } from "./step4_csids.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `너는 수능 국어 문제를 검토하는 전문가다.
주어진 선지 해설(analysis)만 읽고 정답을 골라라.
반드시 순수 JSON만 출력하라.
출력 형식: { "1": 3, "2": 1 } (문항번호: 정답선지번호)`;

// ─── JSON 파싱 ─────────────────────────────────────────────

function stripMarkdown(text) {
  return text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "");
}

function parseJSON(raw) {
  const text = stripMarkdown(raw);
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  try {
    return JSON.parse(jsonrepair(text));
  } catch {
    /* fall through */
  }
  throw new Error(`JSON 파싱 실패: ${text.slice(0, 200)}`);
}

// ─── Claude로 정답 재도출 ──────────────────────────────────

async function rederiveAnswers(set) {
  const questionBlocks = set.questions
    .map((q) => {
      const choicesText = q.choices
        .map((c) => `  선지${c.num}: ${c.analysis || "(해설 없음)"}`)
        .join("\n");
      return `[${q.id}번]\n${choicesText}`;
    })
    .join("\n\n");

  const userPrompt = `다음 문항들의 선지 해설을 읽고, 각 문항의 정답 선지 번호를 골라줘.
선지 해설을 분석해서 가장 적절한/부적절한 선지를 판별하라.

${questionBlocks}

각 문항의 정답 번호만 JSON으로 반환:
형식: { "문항번호": 선지번호 }`;

  const response = await client.messages.create(
    {
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    },
    { headers: { "anthropic-beta": "output-128k-2025-02-19" } },
  );

  return parseJSON(response.content[0].text);
}

// ─── 세트 검증 ─────────────────────────────────────────────

function verifySet(set, answerKey) {
  const mismatches = [];
  for (const q of set.questions) {
    const correct = answerKey[String(q.id)];
    if (correct === undefined) continue;
    // step4 데이터에서 현재 저장된 정답 선지 확인
    const correctChoice = q.choices.find((c) => {
      const expectedOk = q.questionType === "positive" ? true : false;
      return c.num === correct && c.ok === expectedOk;
    });
    if (!correctChoice) {
      mismatches.push(q.id);
    }
  }
  return mismatches;
}

async function verifySetByReanalysis(set, answerKey) {
  const derived = await rederiveAnswers(set);
  const mismatches = [];
  for (const q of set.questions) {
    const correct = answerKey[String(q.id)];
    const derivedAnswer = derived[String(q.id)];
    if (
      correct !== undefined &&
      derivedAnswer !== undefined &&
      correct !== derivedAnswer
    ) {
      mismatches.push({ qId: q.id, expected: correct, derived: derivedAnswer });
    }
  }
  return mismatches;
}

// ─── [NEW] 결정적 검증 ─────────────────────────────────────
//
// rederive 기반 검증의 비결정성 문제(정상 Q33 도 randomly needsReview 로 떨어짐) 를
// 해결하기 위해 step5 의 기본 경로는 다음 3가지 결정적 검사만 수행한다:
//
//   1. answerKey ↔ choice.ok 일치
//      - questionType=positive: 정답 번호 선지만 ok:true, 나머지 ok:false
//      - questionType=negative: 정답 번호 선지만 ok:false, 나머지 ok:true
//
//   2. cs_ids 존재 여부 (공개 가능 KPI — CLAUDE.md 출시 기준)
//      - ok:true → cs_ids 비어있지 않아야 함
//      - ok:false + pat ∈ {R3, V} 또는 pat === null → cs_ids [] 허용
//      - 그 외 ok:false → cs_ids 비어있지 않아야 함
//
//   3. pat 도메인 유효성
//      - ok:true → pat === null
//      - ok:false + set.id r 프리픽스 → pat ∈ {R1,R2,R3,R4,V}
//      - ok:false + set.id l 프리픽스 → pat ∈ {L1,L2,L3,L4,L5,V}
//
// 위 3개 중 하나라도 위반이면 해당 question 에 needsReview 플래그.
const VALID_R_PATS = new Set(["R1", "R2", "R3", "R4", "V"]);
const VALID_L_PATS = new Set(["L1", "L2", "L3", "L4", "L5", "V"]);
const AUTO_EMPTY_CS_PATS = new Set(["R3", "V"]); // cs_ids=[] 허용

function verifyDeterministic(set, answerKey) {
  const issuesByQ = new Map(); // qId → [reasons]
  const addIssue = (qId, reason) => {
    if (!issuesByQ.has(qId)) issuesByQ.set(qId, []);
    issuesByQ.get(qId).push(reason);
  };
  const isLit = (set.id || "").startsWith("l");
  const validPats = isLit ? VALID_L_PATS : VALID_R_PATS;

  for (const q of set.questions || []) {
    const correct = answerKey[String(q.id)];
    if (correct === undefined) continue;

    for (const c of q.choices || []) {
      // [NEW] ok/analysis 모순 flag 수집 — step3 postProcess 가 _ok_analysis_mismatch 부여
      if (c._ok_analysis_mismatch) {
        addIssue(
          q.id,
          `ok_analysis_mismatch:#${c.num} ${c._ok_analysis_mismatch.code}`,
        );
      }
      const isCorrectNum = c.num === correct;
      const expectedOk =
        q.questionType === "positive" ? isCorrectNum : !isCorrectNum;

      // 1. ok 일치
      if (c.ok !== expectedOk) {
        addIssue(
          q.id,
          `ok_mismatch:#${c.num} got=${c.ok} expected=${expectedOk}`,
        );
      }

      // 3. pat 도메인 유효성
      if (c.ok === true) {
        if (c.pat !== null && c.pat !== undefined) {
          addIssue(q.id, `pat_invalid:#${c.num} ok=true but pat=${c.pat}`);
        }
      } else if (c.ok === false) {
        if (c.pat === null || c.pat === undefined || c.pat === 0) {
          addIssue(q.id, `pat_missing:#${c.num} ok=false but pat=${c.pat}`);
        } else if (!validPats.has(c.pat)) {
          addIssue(
            q.id,
            `pat_out_of_domain:#${c.num} pat=${c.pat} not in ${isLit ? "L" : "R"} set`,
          );
        }
      }

      // 2. cs_ids 존재 여부
      const cs = Array.isArray(c.cs_ids) ? c.cs_ids : null;
      if (cs === null) {
        addIssue(q.id, `cs_ids_not_array:#${c.num}`);
      } else if (c.ok === true) {
        if (cs.length === 0) addIssue(q.id, `cs_ids_empty_on_ok_true:#${c.num}`);
      } else if (c.ok === false) {
        const patKey = c.pat;
        const autoEmptyAllowed =
          patKey === null || patKey === undefined || AUTO_EMPTY_CS_PATS.has(patKey);
        if (!autoEmptyAllowed && cs.length === 0) {
          addIssue(
            q.id,
            `cs_ids_empty_on_ok_false:#${c.num} pat=${patKey}`,
          );
        }
      }
    }
  }

  const mismatches = [];
  for (const [qId, reasons] of issuesByQ.entries()) {
    mismatches.push({ qId, reasons });
  }
  return mismatches;
}

// ─── 메인 검증 루프 ────────────────────────────────────────
//
// [변경] 기본 경로는 결정적 검증(verifyDeterministic).
// 레거시 rederive 경로는 STEP5_ENABLE_REDERIVE=true 로만 활성화.
//
// 결정적 검증 기준:
//   1) answerKey ↔ choice.ok 일치
//   2) cs_ids 존재 여부 (ok:true 필수, ok:false+R3/V 제외 필수)
//   3) pat 도메인 유효성 (ok:true→null, ok:false→R/L 도메인 내)
//
// mismatch 발생 시 해당 question 에 needsReview: true + 상세 reason 배열 첨부.

export async function verifyAndFix(
  step4Data,
  answerKey,
  { step2Data, maxRetries = 3 } = {},
) {
  const result = {
    reading: step4Data.reading.map((s) => ({ ...s })),
    literature: step4Data.literature.map((s) => ({ ...s })),
  };

  const stats = { total: 0, matched: 0, needsReview: [] };
  const useRederive = process.env.STEP5_ENABLE_REDERIVE === "true";
  console.log(
    `[step5] 검증 모드: ${useRederive ? "rederive (LEGACY, 비결정적)" : "deterministic (기본)"}`,
  );

  for (const section of ["reading", "literature"]) {
    for (let si = 0; si < result[section].length; si++) {
      let set = result[section][si];
      console.log(`\n[step5] 검증 중: ${set.id} (${set.range})`);

      // [기본 경로] 결정적 검증
      let detMismatches = verifyDeterministic(set, answerKey);
      // [옵션] rederive — 비결정성 있음, 기본 off
      let rederiveMismatches = useRederive
        ? await verifySetByReanalysis(set, answerKey)
        : [];

      // 통합 mismatch 결정:
      //   - 기본(off): deterministic 만 사용
      //   - rederive(on): deterministic ∪ rederive (둘 중 하나라도 걸리면 flag)
      const mergedByQ = new Map();
      for (const m of detMismatches) {
        mergedByQ.set(m.qId, {
          qId: m.qId,
          deterministic_reasons: m.reasons,
          rederive: null,
        });
      }
      for (const m of rederiveMismatches) {
        const prev = mergedByQ.get(m.qId) || {
          qId: m.qId,
          deterministic_reasons: null,
        };
        prev.rederive = { expected: m.expected, derived: m.derived };
        mergedByQ.set(m.qId, prev);
      }
      let mismatches = [...mergedByQ.values()];

      if (mismatches.length === 0) {
        console.log(`  ✅ 일치 (deterministic)`);
      } else {
        const summary = mismatches
          .map((m) => {
            const parts = [];
            if (m.deterministic_reasons)
              parts.push(`det:${m.deterministic_reasons.join("/")}`);
            if (m.rederive)
              parts.push(
                `rederive:기대${m.rederive.expected}≠재도출${m.rederive.derived}`,
              );
            return `${m.qId}번(${parts.join(" | ")})`;
          })
          .join(", ");
        console.log(`  ❌ 불일치 ${mismatches.length}건: ${summary}`);

        if (!step2Data) {
          console.log(`  ⚠️  step2Data 없음 — 재실행 불가, needsReview 플래그`);
          mismatches.forEach((m) =>
            stats.needsReview.push({
              setId: set.id,
              qId: m.qId,
              reasons: m.deterministic_reasons || [],
              rederive: m.rederive || null,
            }),
          );
        } else {
          // 최대 maxRetries 회 재시도 — step3/step4 재실행 후 결정적 재검증
          let attempt = 0;
          while (mismatches.length > 0 && attempt < maxRetries) {
            attempt++;
            console.log(`  [retry ${attempt}/${maxRetries}] step3 재실행...`);

            const step2Set = [
              ...step2Data.reading,
              ...step2Data.literature,
            ].find((s) => s.id === set.id);
            if (!step2Set) {
              console.warn(`  step2 세트 없음: ${set.id}`);
              break;
            }

            let retried = await retrySet(step2Set, answerKey);
            const wrapped = {
              reading: section === "reading" ? [retried] : [],
              literature: section === "literature" ? [retried] : [],
            };
            const processed = await postProcess(wrapped, answerKey);
            retried = processed[section][0];

            const step4Wrapped = {
              reading: section === "reading" ? [retried] : [],
              literature: section === "literature" ? [retried] : [],
            };
            const reassigned = await assignCsIds(step4Wrapped);
            set = reassigned[section][0];

            detMismatches = verifyDeterministic(set, answerKey);
            rederiveMismatches = useRederive
              ? await verifySetByReanalysis(set, answerKey)
              : [];

            const m2 = new Map();
            for (const m of detMismatches)
              m2.set(m.qId, {
                qId: m.qId,
                deterministic_reasons: m.reasons,
                rederive: null,
              });
            for (const m of rederiveMismatches) {
              const prev = m2.get(m.qId) || {
                qId: m.qId,
                deterministic_reasons: null,
              };
              prev.rederive = { expected: m.expected, derived: m.derived };
              m2.set(m.qId, prev);
            }
            mismatches = [...m2.values()];

            if (mismatches.length === 0) {
              console.log(`  ✅ retry ${attempt}: 불일치 해소`);
            } else {
              console.log(
                `  ❌ retry ${attempt}: 불일치 ${mismatches.length}건 남음`,
              );
            }
          }

          if (mismatches.length > 0) {
            console.log(
              `  ⚠️  ${maxRetries}회 후에도 불일치 — needsReview 플래그`,
            );
            set = {
              ...set,
              questions: set.questions.map((q) => {
                const m = mismatches.find((x) => x.qId === q.id);
                if (!m) return q;
                return {
                  ...q,
                  needsReview: true,
                  needsReview_reasons: m.deterministic_reasons || [],
                  needsReview_rederive: m.rederive || null,
                };
              }),
            };
            mismatches.forEach((m) =>
              stats.needsReview.push({
                setId: set.id,
                qId: m.qId,
                reasons: m.deterministic_reasons || [],
                rederive: m.rederive || null,
              }),
            );
          }
        }
      }

      // 통계
      for (const q of set.questions) {
        if (answerKey[String(q.id)] !== undefined) {
          stats.total++;
          const m = mismatches ? mismatches.find((x) => x.qId === q.id) : null;
          if (!m) stats.matched++;
        }
      }

      result[section][si] = set;
    }
  }

  // [NEW] fail-fast: pat_out_of_domain / pat_missing 은 도메인 무결성 위반이므로
  // 재시도 이후에도 남아 있으면 파이프라인을 즉시 중단한다.
  // STEP5_FAIL_FAST=false 로만 해제 가능 (기본 enabled).
  const FAIL_FAST_ENABLED = process.env.STEP5_FAIL_FAST !== "false";
  const FATAL_PATTERNS = [
    /^pat_out_of_domain/,
    /^pat_missing/,
    /^pat_invalid/,
    /^ok_analysis_mismatch/, // [NEW] ok/analysis 모순도 release 차단
  ];
  const fatal = [];
  for (const entry of stats.needsReview) {
    for (const r of entry.reasons || []) {
      if (FATAL_PATTERNS.some((re) => re.test(r))) {
        fatal.push({ setId: entry.setId, qId: entry.qId, reason: r });
      }
    }
  }
  if (fatal.length > 0) {
    console.error(
      "\n" + "=".repeat(60),
    );
    console.error(
      `[step5:FAIL-FAST] 도메인 무결성 위반 ${fatal.length}건 — 파이프라인 중단`,
    );
    console.error("=".repeat(60));
    for (const f of fatal) {
      console.error(`  🔴 [${f.setId}] Q${f.qId}: ${f.reason}`);
    }
    if (FAIL_FAST_ENABLED) {
      console.error(
        `\n→ STEP5_FAIL_FAST=false 로 일시 해제 가능하나, 릴리즈 전 반드시 해소 필요.`,
      );
      process.exit(1);
    } else {
      console.warn(
        `\n⚠️  STEP5_FAIL_FAST=false 로 해제됨 — 경고만 출력하고 진행.`,
      );
    }
  }

  return { result, stats };
}

// ─── 커맨드라인 ───────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const step4Path = process.argv[2];
  const answerKeyPath = process.argv[3];

  if (!step4Path || !answerKeyPath) {
    console.error(
      "사용법: node pipeline/step5_verify.js [step4결과JSON] [정답키JSON]",
    );
    process.exit(1);
  }

  const step4Path_abs = path.resolve(step4Path);
  const step4Data = JSON.parse(fs.readFileSync(step4Path_abs, "utf8"));
  const answerKey = JSON.parse(
    fs.readFileSync(path.resolve(answerKeyPath), "utf8"),
  );

  // step2 데이터 자동 탐색 (같은 디렉토리에 step2_result_*.json 이 있으면 로드)
  const dir = path.dirname(step4Path_abs);
  const step2File = fs
    .readdirSync(dir)
    .find((f) => f.startsWith("step2_result"));
  let step2Data = null;
  if (step2File) {
    step2Data = JSON.parse(fs.readFileSync(path.join(dir, step2File), "utf8"));
    console.log(`[step5] step2 데이터 로드: ${step2File}`);
  } else {
    console.warn("[step5] step2 데이터 없음 — 불일치 시 재실행 불가");
  }

  verifyAndFix(step4Data, answerKey, { step2Data })
    .then(({ result, stats }) => {
      console.log("\n" + "=".repeat(50));
      console.log("[step5] 최종 결과");
      console.log("=".repeat(50));
      console.log(
        `정답률: ${stats.matched}/${stats.total} (${Math.round((stats.matched / stats.total) * 100)}%)`,
      );
      if (stats.needsReview.length > 0) {
        console.log(`\nneedsReview 문항 (${stats.needsReview.length}건):`);
        stats.needsReview.forEach((r) =>
          console.log(`  - [${r.setId}] ${r.qId}번`),
        );
      } else {
        console.log("needsReview 문항: 없음 ✅");
      }

      const outPath = path.resolve(
        dir,
        path.basename(step4Path_abs).replace("step4_", "step5_"),
      );
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
      console.log(`\n✅ 저장 완료: ${outPath}`);
    })
    .catch((err) => {
      console.error("오류:", err.message);
      process.exit(1);
    });
}
