// step3_v2.mjs — v2 해설 재생성 드라이버 (마커 범위 주입 정식 경로)
//   기존 step3_analysis.js는 프롬프트 내장 + 마커 범위 주입 0이라 v2 확산 경로가 없었음.
//   본 드라이버가 그 배선을 정식화:
//     1) system 프롬프트 = config/step3_prompt_v2.txt 파일 읽기(하드코딩 금지, §2 완화 조건 a)
//     2) payload에 marker_context.buildMarkerBlock 결과 [마커 범위 — 정본] 주입
//     3) 스코프 --yk / --set / --q (yearKey 배치 단위)
//     4) 출력 스키마 = 기존 step3와 동일 [{ qId, num, pat, analysis }]
//     5) --dry-run: LLM 호출 없이 payload를 파일 덤프(크레딧 0 배선 실증)
// 사용:
//   node pipeline/step3_v2.mjs --yk=2026수능 --set=l2026a --q=19 --dry-run
//   node pipeline/step3_v2.mjs --yk=2026수능                 (실호출 — 크레딧 필요)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildMarkerBlock } from "./marker_context.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public/data/all_data_204.json");
const PROMPT_V2_PATH = path.join(ROOT, "config/step3_prompt_v2.txt");

const args = process.argv.slice(2);
const opt = (k) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=").slice(1).join("=") : null;
};
const DRY = args.includes("--dry-run");
const yk = opt("yk");
const setFilter = opt("set");
const qFilter = opt("q");

if (!yk) {
  console.error("--yk=<yearKey> 필수 (배치 단위)");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
if (!data[yk]) {
  console.error(`SCOPE_EMPTY: ${yk} 데이터 없음`);
  process.exit(1);
}
// 프롬프트 정본 = 파일 단일 소스 (하드코딩 금지)
const systemPrompt = fs.readFileSync(PROMPT_V2_PATH, "utf8");

function selectSets() {
  const out = [];
  for (const sec of ["reading", "literature"])
    for (const s of data[yk][sec] || []) {
      if (setFilter && s.id !== setFilter) continue;
      out.push(s);
    }
  return out;
}

// userPrompt = 기존 step3 형식(정답 정보 + 세트 데이터 + 반환 스키마) + 마커 범위 블록
function buildUserPrompt(set) {
  const answerGuide = set.questions
    .map((q) => {
      const correct = (q.choices || []).find((c) => c.ok);
      return correct
        ? `문항 ${q.id}번 (${q.questionType}): 정답 선지 = ${correct.num}번`
        : null;
    })
    .filter(Boolean)
    .join("\n");

  // 문항별 [마커 범위 — 정본] 블록 (marker_context — annotations.json 단일 소스)
  const markerBlocks = set.questions
    .map((q) => {
      const { block } = buildMarkerBlock(yk, set.id, q);
      return `▷ 문항 ${q.id}\n${block}`;
    })
    .join("\n\n");

  return `다음 세트를 분석해줘.

[정답 정보]
${answerGuide}

[마커 범위 — 문항별 정본]
${markerBlocks}

[세트 데이터]
${JSON.stringify(set)}

각 선지의 pat과 analysis만 작성해줘. ok 필드는 출력하지 마.
- 정답 선지(ok:true에 해당): pat: null
- 오답 선지(ok:false에 해당): 독서 세트는 R1~R4, 문학 세트는 L1~L5, 어휘는 V 중 하나
- 위 [마커 범위 — 정본]의 범위를 근거로 마커 관련 선지를 서술할 것(범위 밖 어구 추측 금지).

choices 배열만 JSON으로 반환해줘.
형식: [{ qId: 1, num: 1, pat: null, analysis: "..." }, ...]
반드시 qId(문항 id)를 포함해줘.`;
}

// 기존 step3 산출물 호환 파서 (마크다운 펜스 제거 후 JSON 배열 추출)
function parseChoices(text) {
  let t = String(text || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const lo = t.indexOf("[");
  const hi = t.lastIndexOf("]");
  if (lo < 0 || hi < 0) throw new Error("JSON 배열 미검출");
  return JSON.parse(t.slice(lo, hi + 1));
}

const sets = selectSets();
if (!sets.length) {
  console.error(
    `SCOPE_EMPTY: ${yk}${setFilter ? "::" + setFilter : ""} 검사 대상 0세트`,
  );
  process.exit(1);
}

const OUT_DIR = path.join(ROOT, "pipeline/output/v2_dryrun");

async function main() {
  let client = null;
  if (!DRY) {
    // 실호출 경로 — 크레딧 필요 (dry-run이 아닐 때만 SDK 로드)
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { default: dotenv } = await import("dotenv");
    dotenv.config({ path: path.join(ROOT, ".env"), override: true });
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    fs.mkdirSync(OUT_DIR, { recursive: true });
  } else {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  for (const set of sets) {
    // --q 필터: 해당 문항만 남긴 세트 사본(sents는 전체 유지 = 근거 문맥 보존)
    const scoped = qFilter
      ? {
          ...set,
          questions: set.questions.filter(
            (q) => String(q.id) === String(qFilter),
          ),
        }
      : set;
    if (qFilter && !scoped.questions.length) {
      console.warn(`  ${set.id}: 문항 ${qFilter} 없음 — skip`);
      continue;
    }
    const userPrompt = buildUserPrompt(scoped);

    if (DRY) {
      const fname = `${yk}_${set.id}${qFilter ? "_q" + qFilter : ""}.txt`;
      const fpath = path.join(OUT_DIR, fname);
      fs.writeFileSync(
        fpath,
        `===== SYSTEM PROMPT (config/step3_prompt_v2.txt, ${systemPrompt.length}자) =====\n` +
          `${systemPrompt}\n\n` +
          `===== USER PAYLOAD (${userPrompt.length}자) =====\n${userPrompt}\n`,
        "utf8",
      );
      console.log(`[dry-run] 덤프: ${path.relative(ROOT, fpath)}`);
      continue;
    }

    // 실호출 (크레딧 필요) — 스키마: [{ qId, num, pat, analysis }]
    const resp = await client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      },
      { headers: { "anthropic-beta": "output-128k-2025-02-19" } },
    );
    const choices = parseChoices(resp.content[0].text);
    const fpath = path.join(OUT_DIR, `${yk}_${set.id}_result.json`);
    fs.writeFileSync(fpath, JSON.stringify(choices, null, 2), "utf8");
    // 실단가 측정용 usage 기록 (배치 예산 산출 근거 — 추정 아닌 실측)
    const u = resp.usage || {};
    console.log(
      `[생성] ${set.id}: ${choices.length}선지 → ${path.relative(ROOT, fpath)} (stop=${resp.stop_reason})`,
    );
    console.log(
      `[usage] input=${u.input_tokens ?? "?"} output=${u.output_tokens ?? "?"}` +
        (u.cache_read_input_tokens != null
          ? ` cache_read=${u.cache_read_input_tokens}`
          : ""),
    );
    fs.writeFileSync(
      path.join(OUT_DIR, `${yk}_${set.id}_usage.json`),
      JSON.stringify(
        { setId: set.id, choices: choices.length, usage: u },
        null,
        2,
      ),
      "utf8",
    );
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
