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

// ─── 메인 검증 루프 ────────────────────────────────────────

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

  for (const section of ["reading", "literature"]) {
    for (let si = 0; si < result[section].length; si++) {
      let set = result[section][si];
      console.log(`\n[step5] 검증 중: ${set.id} (${set.range})`);

      let mismatches = await verifySetByReanalysis(set, answerKey);

      if (mismatches.length === 0) {
        console.log(`  ✅ 일치`);
      } else {
        console.log(
          `  ❌ 불일치 ${mismatches.length}건: ${mismatches.map((m) => `${m.qId}번(기대:${m.expected} 재도출:${m.derived})`).join(", ")}`,
        );

        if (!step2Data) {
          console.log(`  ⚠️  step2Data 없음 — 재실행 불가, needsReview 플래그`);
          mismatches.forEach((m) =>
            stats.needsReview.push({ setId: set.id, qId: m.qId }),
          );
        } else {
          // 최대 3회 재시도
          let attempt = 0;
          while (mismatches.length > 0 && attempt < maxRetries) {
            attempt++;
            console.log(`  [retry ${attempt}/${maxRetries}] step3 재실행...`);

            // step2 원본 세트 찾기
            const step2Set = [
              ...step2Data.reading,
              ...step2Data.literature,
            ].find((s) => s.id === set.id);
            if (!step2Set) {
              console.warn(`  step2 세트 없음: ${set.id}`);
              break;
            }

            // step3 재실행 + postProcess
            let retried = await retrySet(step2Set, answerKey);
            const wrapped = {
              reading: section === "reading" ? [retried] : [],
              literature: section === "literature" ? [retried] : [],
            };
            const processed = await postProcess(wrapped, answerKey);
            retried = processed[section][0];

            // step4 재실행 (해당 세트만)
            const step4Wrapped = {
              reading: section === "reading" ? [retried] : [],
              literature: section === "literature" ? [retried] : [],
            };
            const reassigned = await assignCsIds(step4Wrapped);
            set = reassigned[section][0];

            mismatches = await verifySetByReanalysis(set, answerKey);
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
            // 해당 문항에 needsReview: true 추가
            set = {
              ...set,
              questions: set.questions.map((q) => {
                const m = mismatches.find((x) => x.qId === q.id);
                return m ? { ...q, needsReview: true } : q;
              }),
            };
            mismatches.forEach((m) =>
              stats.needsReview.push({ setId: set.id, qId: m.qId }),
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
