import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { jsonrepair } from "jsonrepair";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
// [수정 1] 코드 레벨에서 자동 [] 처리할 패턴
// R3: 과도한 추론 — 지문에 근거 없음
// V:  어휘 치환 판단 — 지문 문장 특정 불가
// null: pat 미지정 — AI에 맡기지 않음
// ─────────────────────────────────────────────
const AUTO_EMPTY_PATS = new Set(["R3", "V", null]);

// ─────────────────────────────────────────────
// [수정 2] SYSTEM_PROMPT — 구체계 pat:3 → R3/V 명세
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `너는 수능 국어 선지와 지문 문장을 매칭하는 전문가다.
반드시 순수 JSON만 출력하라. 마크다운, 설명 텍스트 없음.

[cs_ids 규칙]
- 각 선지의 ok/analysis 근거가 되는 지문 문장 ID를 찾아라
- ok:true인 선지: 선지 내용이 사실임을 직접 뒷받침하는 문장 ID
- ok:false인 선지: 선지가 왜곡·전도·짜깁기한 원래 지문 문장 ID (패턴의 출처)
- 근거 문장이 여러 개면 모두 포함 (최대 5개)
- 반드시 실제 존재하는 sent.id만 사용할 것
- ⚠️ 빈 배열 [] 절대 금지 — 목록에 포함된 모든 선지는 반드시 1개 이상의 sent.id를 반환할 것

[근거 선택 우선순위 — 몰빵 방지]
- 동일 세트에서 특정 sent.id를 반복 선택할 수는 있으나,
  각 선지의 핵심 판단 근거가 실제로 같은 문장인지 먼저 검토하라.
- 도입부/일반론 문장을 모든 선지의 공통 근거로 남발하지 말 것.
- 선지별 차이를 직접 판정하게 만드는 문장이 있으면 그 문장을 우선 선택하라.
- 결과적으로 동일 sent.id가 과도하게 반복되면,
  그 선택 이유를 다시 검토하고 더 직접적인 근거가 있는지 재탐색하라.

[자동 처리 — 이 선지들은 목록에 포함되지 않음, AI 불필요]
- ok:false + pat:R3 (과도한 추론): 지문에 근거 없는 내용이므로 [] 자동 적용
- ok:false + pat:V  (어휘 치환):   어휘 문제로 지문 문장 특정 불가이므로 [] 자동 적용

출력 형식:
[{ "questionId": 1, "num": 1, "cs_ids": ["r2022a_s3", "r2022a_s4"] }, ...]`;

async function callWithRetry(fn, maxRetries = 3, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable =
        err.message?.includes("Connection") ||
        err.message?.includes("timeout") ||
        err.status === 529 ||
        err.status === 500;
      if (isRetryable && i < maxRetries - 1) {
        console.warn(`  ⚠️ API 오류 (${i + 1}/${maxRetries}): ${err.message}`);
        console.warn(`  ${delay / 1000}초 후 재시도...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

function stripMarkdown(text) {
  return text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "");
}

function fixUnescapedQuotes(jsonStr) {
  const result = [];
  let inString = false;
  let i = 0;
  while (i < jsonStr.length) {
    const ch = jsonStr[i];
    if (ch === "\\" && inString) {
      result.push(ch, jsonStr[i + 1] || "");
      i += 2;
      continue;
    }
    if (ch === '"') {
      if (!inString) {
        inString = true;
        result.push(ch);
      } else {
        let j = i + 1;
        while (j < jsonStr.length && " \n\r\t".includes(jsonStr[j])) j++;
        const next = jsonStr[j];
        if (
          next === ":" ||
          next === "," ||
          next === "}" ||
          next === "]" ||
          j >= jsonStr.length
        ) {
          inString = false;
          result.push(ch);
        } else {
          result.push('\\"');
        }
      }
    } else {
      result.push(ch);
    }
    i++;
  }
  return result.join("");
}

function tryParse(text) {
  try {
    const parsed = JSON.parse(text);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      Array.isArray(parsed[0])
    ) {
      return parsed.flat();
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseJSON(raw) {
  const text = stripMarkdown(raw);

  const direct = tryParse(text);
  if (direct) return direct;

  const fixed = tryParse(fixUnescapedQuotes(text));
  if (fixed) return fixed;

  // 여러 배열 병합
  const arrays = [];
  let depth = 0,
    start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "]") {
      depth--;
      if (depth === 0 && start !== -1) {
        const chunk = text.slice(start, i + 1);
        const parsed = tryParse(chunk) || tryParse(fixUnescapedQuotes(chunk));
        if (parsed) arrays.push(...parsed);
        start = -1;
      }
    }
  }
  if (arrays.length > 0) return arrays;

  const repaired = jsonrepair(text);
  return JSON.parse(repaired);
}

// [B-12] 선지에서 원문자 추출
const MARKER_IN_CHOICE_RE = /[ⓐ-ⓘ㉠-㉦①-⑨]|\[[A-E]\]/g;

function buildMarkerHint(choices, markers) {
  if (!markers || markers.length === 0) return "";
  const used = new Set();
  for (const c of choices) {
    const m = (c.t || "").match(MARKER_IN_CHOICE_RE);
    if (m) m.forEach((x) => used.add(x));
  }
  const relevant = markers.filter((m) => used.has(m.marker));
  if (relevant.length === 0) return "";
  const lines = relevant.map(
    (m) => `  ${m.marker} → ${m.sentId}의 "${m.text}" 부근`,
  );
  return `\n[마커 가이드 — 선지에 나오는 원문자의 구체적 span]\n${lines.join("\n")}\n마커가 있는 선지는 해당 sentId를 우선 cs_ids에 포함하라.\n`;
}

async function matchCsIds(set, markers = []) {
  const sentIds = new Set(set.sents.map((s) => s.id));

  // ─────────────────────────────────────────────
  // [수정 1] AUTO_EMPTY_PATS 선지는 AI 호출 전 분리
  // ─────────────────────────────────────────────
  const autoEmptyChoices = [];
  const needsMatchChoices = [];

  for (const q of set.questions) {
    for (const c of q.choices) {
      const isAutoEmpty = c.ok === false && AUTO_EMPTY_PATS.has(c.pat);
      if (isAutoEmpty) {
        autoEmptyChoices.push({ questionId: q.id, num: c.num, cs_ids: [] });
      } else {
        needsMatchChoices.push({
          questionId: q.id,
          num: c.num,
          t: c.t,
          ok: c.ok,
          pat: c.pat,
          analysis: c.analysis,
        });
      }
    }
  }

  console.log(
    `  자동 [] 처리: ${autoEmptyChoices.length}건 (R3/V/null), AI 매칭 대상: ${needsMatchChoices.length}건`,
  );

  // AI 매칭 대상이 없으면 API 호출 생략
  if (needsMatchChoices.length === 0) {
    return autoEmptyChoices;
  }

  const markerHint = buildMarkerHint(needsMatchChoices, markers);

  const userPrompt = `다음 세트에서 각 선지의 cs_ids를 찾아줘.

지문 문장 목록:
${JSON.stringify(set.sents.map((s) => ({ id: s.id, t: s.t })))}

선지 목록:
${JSON.stringify(needsMatchChoices)}
${markerHint}

각 선지의 cs_ids 배열만 반환해줘.
형식: [{ "questionId": 1, "num": 1, "cs_ids": [...] }, ...]`;

  // [수정 3] max_tokens 4000 → 8000
  const response = await callWithRetry(() =>
    client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
      { headers: { "anthropic-beta": "output-128k-2025-02-19" } },
    ),
  );

  const matches = parseJSON(response.content[0].text);

  // 존재하지 않는 sentId 제거 + 통계
  let totalMatched = 0;
  let invalidRemoved = 0;

  const cleaned = matches.map((m) => {
    const validIds = (m.cs_ids || []).filter((id) => {
      if (sentIds.has(id)) return true;
      invalidRemoved++;
      return false;
    });
    totalMatched += validIds.length;
    return { ...m, cs_ids: validIds };
  });

  // [B-12] cs_spans 생성: 선지에 원문자 있고 marker annotation 있으면 spans 추가
  for (const m of cleaned) {
    const set_q = set.questions.find((q) => q.id === m.questionId);
    const set_c = set_q?.choices.find((c) => c.num === m.num);
    if (!set_c) continue;
    const markersInChoice = (set_c.t || "").match(MARKER_IN_CHOICE_RE);
    if (!markersInChoice) continue;
    const spans = [];
    for (const mk of [...new Set(markersInChoice)]) {
      const found = markers.find((x) => x.marker === mk);
      if (found) spans.push({ sent_id: found.sentId, text: found.text });
    }
    if (spans.length > 0) m.cs_spans = spans;
  }

  console.log(
    `  매칭: ${totalMatched}개 cs_ids, 무효 ID 제거: ${invalidRemoved}개`,
  );

  // autoEmpty + AI 매칭 결과 병합
  return [...autoEmptyChoices, ...cleaned];
}

export async function assignCsIds(step3Data, annotations = {}) {
  const result = { reading: [], literature: [] };

  for (const section of ["reading", "literature"]) {
    for (const set of step3Data[section]) {
      console.log(`[step4] cs_ids 매칭 중: ${set.id} (${set.range})`);

      // [B-12] 해당 세트의 marker annotation 전달
      const setMarkers = (annotations[set.id] || []).filter(
        (a) => a.type === "marker",
      );
      const matches = await matchCsIds(set, setMarkers);

      const matchMap = new Map();
      const spansMap = new Map();
      for (const m of matches) {
        matchMap.set(`${m.questionId}_${m.num}`, m.cs_ids);
        if (m.cs_spans) spansMap.set(`${m.questionId}_${m.num}`, m.cs_spans);
      }

      const updatedQuestions = set.questions.map((q) => ({
        ...q,
        choices: q.choices.map((c) => {
          const cs_ids = matchMap.get(`${q.id}_${c.num}`);
          const cs_spans = spansMap.get(`${q.id}_${c.num}`);
          const next = cs_ids !== undefined ? { ...c, cs_ids } : { ...c };
          if (cs_spans) next.cs_spans = cs_spans;
          return next;
        }),
      }));

      result[section].push({ ...set, questions: updatedQuestions });
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// 타겟 재실행 모드: 기존 all_data_204.json에서
// ok:false cs_ids=[] 중 R3/V/null 제외한 선지만
// 세트 단위로 API 재호출해 cs_ids 채우기
//
// 사용법:
//   node pipeline/step4_csids.js --retarget [yearKey]
//   node pipeline/step4_csids.js --retarget          (전체 5개 시험)
// ─────────────────────────────────────────────
async function retarget(targetYear) {
  const DATA_PATH = path.resolve(__dirname, "../public/data/all_data_204.json");
  const ANN_PATH = path.resolve(__dirname, "../public/data/annotations.json");
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  let ann = {};
  try {
    ann = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));
  } catch {}

  const years = targetYear
    ? [targetYear]
    : ["2022수능", "2023수능", "2024수능", "2025수능", "2026수능"];

  let totalFixed = 0;

  for (const yr of years) {
    if (!data[yr]) {
      console.warn(`⚠️ ${yr} 키 없음 — 스킵`);
      continue;
    }

    for (const section of ["reading", "literature"]) {
      const sets = data[yr][section] || [];

      for (const set of sets) {
        // 이 세트에서 재매핑 대상 선지 존재 여부 확인
        // 1. ok:true + cs_ids=[]   → 근거 문장 미매핑 (CRITICAL)
        // 2. ok:false + R1/R2/R4/L1/L2/L4/L5 + cs_ids=[] → 왜곡 출처 미매핑 (CRITICAL)
        // 3. 동일 sent.id 5회+ 반복 → 몰빵 (WARNING) — 재분석 대상
        const emptyCase = set.questions.some((q) =>
          q.choices.some((c) => {
            const empty = !c.cs_ids || c.cs_ids.length === 0;
            if (!empty) return false;
            if (c.ok === true) return true;
            if (c.ok === false && !AUTO_EMPTY_PATS.has(c.pat)) return true;
            return false;
          }),
        );
        let concentrationCase = false;
        const freq = new Map();
        for (const q of set.questions || []) {
          for (const c of q.choices || []) {
            for (const id of c.cs_ids || []) freq.set(id, (freq.get(id) || 0) + 1);
          }
        }
        for (const cnt of freq.values()) {
          if (cnt >= 5) { concentrationCase = true; break; }
        }
        const needsWork = emptyCase || concentrationCase;

        if (!needsWork) continue;
        if (concentrationCase && !emptyCase) {
          console.log(`  [몰빵 감지] ${set.id} — 재분석 진행`);
        }

        console.log(`\n[retarget] ${yr} ${set.id} (${set.range})`);

        // [B-12] marker annotation 조회
        const setMarkers = (ann[yr]?.[set.id] || []).filter(
          (a) => a.type === "marker",
        );
        if (setMarkers.length > 0) {
          console.log(`  [마커] ${setMarkers.length}개 로드`);
        }

        const matches = await matchCsIds(set, setMarkers);
        const matchMap = new Map();
        const spansMap = new Map();
        for (const m of matches) {
          matchMap.set(`${m.questionId}_${m.num}`, m.cs_ids);
          if (m.cs_spans) spansMap.set(`${m.questionId}_${m.num}`, m.cs_spans);
        }

        for (const q of set.questions) {
          for (const c of q.choices) {
            const key = `${q.id}_${c.num}`;
            if (matchMap.has(key)) {
              const newIds = matchMap.get(key);
              if (newIds.length > 0 || AUTO_EMPTY_PATS.has(c.pat)) {
                c.cs_ids = newIds;
                if (newIds.length > 0) totalFixed++;
              }
            }
            if (spansMap.has(key)) {
              c.cs_spans = spansMap.get(key);
            }
          }
        }
      }
    }

    console.log(`✅ ${yr} 완료`);
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  console.log(`\n✅ all_data_204.json 저장 완료 — ${totalFixed}건 cs_ids 채움`);
}

// 커맨드라인
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];

  if (mode === "--retarget") {
    // 기존 데이터 타겟 재실행
    const targetYear = process.argv[3] || null;
    retarget(targetYear).catch((err) => {
      console.error("오류:", err.message);
      process.exit(1);
    });
  } else {
    // 기존 신규 파이프라인 모드
    const inputPath = mode;
    if (!inputPath) {
      console.error(
        "사용법:\n" +
          "  신규: node pipeline/step4_csids.js [step3결과JSON경로]\n" +
          "  재실행: node pipeline/step4_csids.js --retarget [연도키(선택)]",
      );
      process.exit(1);
    }

    const inputPath_abs = path.resolve(inputPath);
    const step3Data = JSON.parse(fs.readFileSync(inputPath_abs, "utf8"));

    assignCsIds(step3Data)
      .then((result) => {
        const outPath = path.resolve(
          path.dirname(inputPath_abs),
          path.basename(inputPath_abs).replace("step3_", "step4_"),
        );
        fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
        console.log(`\n✅ 저장 완료: ${outPath}`);
      })
      .catch((err) => {
        console.error("오류:", err.message);
        process.exit(1);
      });
  }
}
