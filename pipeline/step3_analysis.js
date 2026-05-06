import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { jsonrepair } from "jsonrepair";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── [NEW] pat overrides 로더 ─────────────────────────────────
// config/pat_overrides.json 을 최초 호출 시 1회 로드. key 형식: "<setId>:<qId>:<choiceNum>".
// 사람이 검토한 정답 pat 을 강제. enforcePatDomain 감지 flag 는 이 경로에서 제거됨.
const PAT_OVERRIDES_PATH = path.resolve(
  __dirname,
  "../config/pat_overrides.json",
);
let __patOverrides = null;
function loadPatOverrides() {
  if (__patOverrides !== null) return __patOverrides;
  try {
    if (fs.existsSync(PAT_OVERRIDES_PATH)) {
      const raw = JSON.parse(fs.readFileSync(PAT_OVERRIDES_PATH, "utf8"));
      __patOverrides = raw.overrides || raw || {};
      console.log(
        `[postProcess:override] 로드: ${path.relative(path.resolve(__dirname, ".."), PAT_OVERRIDES_PATH)} (${Object.keys(__patOverrides).length}건)`,
      );
    } else {
      __patOverrides = {};
    }
  } catch (err) {
    console.warn(`[postProcess:override] 로드 실패: ${err.message}`);
    __patOverrides = {};
  }
  return __patOverrides;
}
function lookupPatOverride(setId, qId, choiceNum) {
  const ov = loadPatOverrides();
  return ov[`${setId}:${qId}:${choiceNum}`] || null;
}

// ─── [NEW] ok overrides 로더 ─────────────────────────────────
// config/ok_overrides.json 을 최초 호출 시 1회 로드. key 형식: "<setId>:<qId>:<choiceNum>".
// 값: boolean (true|false). answerKey 기반 보정 이후 **최종 덮어쓰기** 단계.
// 등재 시 _ok_analysis_mismatch flag 자동 제거 (pat 은 영향 없음).
const OK_OVERRIDES_PATH = path.resolve(
  __dirname,
  "../config/ok_overrides.json",
);
let __okOverrides = null;
function loadOkOverrides() {
  if (__okOverrides !== null) return __okOverrides;
  try {
    if (fs.existsSync(OK_OVERRIDES_PATH)) {
      const raw = JSON.parse(fs.readFileSync(OK_OVERRIDES_PATH, "utf8"));
      __okOverrides = raw.overrides || raw || {};
      console.log(
        `[postProcess:okOverride] 로드: ${path.relative(path.resolve(__dirname, ".."), OK_OVERRIDES_PATH)} (${Object.keys(__okOverrides).length}건)`,
      );
    } else {
      __okOverrides = {};
    }
  } catch (err) {
    console.warn(`[postProcess:okOverride] 로드 실패: ${err.message}`);
    __okOverrides = {};
  }
  return __okOverrides;
}
function lookupOkOverride(setId, qId, choiceNum) {
  const ov = loadOkOverrides();
  const key = `${setId}:${qId}:${choiceNum}`;
  if (Object.prototype.hasOwnProperty.call(ov, key)) return ov[key];
  return null;
}

// ─── [NEW] ok/analysis 모순 감지 ──────────────────────────────
// choice.ok 값과 analysis 결론 마커(✅/❌) 의 일치 여부 확인.
// false positive 방지를 위해 analysis 전체가 아닌 **결론 구간** 만 스캔:
//   1) analysis 에 [결론] 라벨이 있으면 그 블록 이후 끝까지
//   2) 없으면 analysis 마지막 100 자 (tail)
//
// - ok:true 인데 결론 구간에 ❌ 만 → ok_true_but_analysis_negates
// - ok:false 인데 결론 구간에 ✅ 만 → ok_false_but_analysis_confirms
// - 둘 다 존재 OR 둘 다 부재 → null (애매, 판단 보류)
const CONCLUSION_TAIL_LEN = 100;
function extractConclusionRegion(a) {
  if (!a) return "";
  // 1순위: [결론] 라벨 블록
  const labelMatch = a.match(/(?:\[결론\]|【결론】|결론\s*[:：])[\s\S]*$/);
  if (labelMatch) return labelMatch[0];
  // 2순위: 🔎 섹션 (정답 비교 / 배제 근거) 은 ❌ 를 포함해 noise 발생.
  //        🔎 마지막 등장 지점 **이후** 부분만 결론으로 채택.
  const lastDiscrimIdx = a.lastIndexOf("🔎");
  let afterDiscrim = lastDiscrimIdx >= 0 ? a.slice(lastDiscrimIdx) : a;
  // 🔎 섹션 줄 전체를 건너뛰기 — 🔎 줄 끝(다음 개행) 다음부터가 결론
  if (lastDiscrimIdx >= 0) {
    const nextNl = afterDiscrim.indexOf("\n");
    // 🔎 한 줄이면 다음 개행까지 섹션. 여러 줄이면 마지막 개행까지의 블록 스킵.
    // 보수적: 🔎 라인 끝 개행부터를 후보 구간으로
    if (nextNl >= 0) afterDiscrim = afterDiscrim.slice(nextNl + 1);
    else afterDiscrim = "";
  }
  // 🔎 이후 실질 텍스트의 마지막 1~2줄만 결론으로 채택
  const lines = afterDiscrim
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const tail = lines.slice(-2).join("\n");
  if (tail) return tail;
  // fallback: 전체 analysis 의 마지막 100자
  return a.slice(-CONCLUSION_TAIL_LEN);
}
function detectOkAnalysisMismatch(choice) {
  const a = choice?.analysis || "";
  if (!a) return null;
  const region = extractConclusionRegion(a);
  const hasTick = region.includes("✅");
  const hasX = region.includes("❌");
  if (!hasTick && !hasX) return null; // 결론 마커 부재 — 판단 보류
  if (hasTick && hasX) return null; // 혼재 — 판단 보류
  if (choice.ok === true && hasX)
    return { code: "ok_true_but_analysis_negates", has_tick: false, has_x: true, region_len: region.length };
  if (choice.ok === false && hasTick)
    return { code: "ok_false_but_analysis_confirms", has_tick: true, has_x: false, region_len: region.length };
  return null;
}

const SYSTEM_PROMPT = `너는 수능 국어 전문 해설 작성자다.
반드시 순수 JSON 배열만 출력하라. 마크다운, 설명 텍스트 없음.

[핵심 원칙]
정답 선지 번호가 주어진다. 정답을 확정한 상태에서 각 선지의 ok값과 해설을 작성하라.
정답 선지의 ok값은 questionType에 따라 결정된다:
- questionType: positive → 정답 선지 ok: true, 나머지 ok: false
- questionType: negative → 정답 선지 ok: false, 나머지 ok: true

[ok 필드 규칙]
ok: true = 지문 내용과 사실적으로 일치하는 선지
ok: false = 지문 내용과 사실적으로 일치하지 않는 선지
발문 유형과 무관하게 사실 일치 여부로만 판단

[pat 필드 규칙 - ok:false인 선지만 해당]
독서 세트(set id가 r로 시작)는 R1~R4만 사용:
  R1: 사실 왜곡 — 수치·상태·방향을 정반대나 다른 값으로 서술
  R2: 인과·관계 전도 — 주체-객체, 원인-결과, 포함관계를 뒤바꿈
  R3: 과잉 추론 — 지문에 없는 내용, 1단계 이상 비약
  R4: 개념 혼합 — 서로 다른 문단의 개념어를 섞어 거짓 문장 구성

문학 세트(set id가 l로 시작)는 L1~L5만 사용:
  L1: 표현·형식 오독 — 시어·이미지·수사법·서술 방식을 잘못 파악
  L2: 정서·태도 오독 — 화자·인물의 감정·태도·심리를 반대로 파악
  L3: 주제·의미 과잉 — 작품에 없는 의미 도출, 근거 없는 확대 해석
  L4: 구조·맥락 오류 — 시점·구성·대비 구조·장면 전환을 잘못 설명
  L5: 보기 대입 오류 — 보기 조건을 작품에 잘못 적용하거나 보기 자체를 오독

ok:true인 선지는 pat: null
ok:false 선지는 **반드시** R1~R4 / L1~L5 / V 중 하나로 pat 을 채워라. null 또는 미기재 금지.
analysis 꼬리 [결론] 에 [R1]~[R4] 또는 [L1]~[L5] 또는 [V] 라벨이 들어갔다면
pat 필드에도 **동일한 코드** 를 반드시 반환하라. (예: analysis 에 [L5] 쓰면 pat: "L5")
정말로 분류 불가일 때만 pat: 0 (수동 검토 플래그)

[analysis 작성 규칙]
- 반드시 지문의 실제 문장을 근거로 사용
- 3~5등급 학생도 이해할 수 있게 구체적으로
- 형식:
  ok:true:  '📌 지문 근거: "..."\n🔍 선지 분해: ...\n🔎 배제 근거: ...\n✅ 지문과 일치하는 적절한 진술'
  ok:false: '📌 지문 근거: "..."\n🔍 선지 분해: ...\n🔎 정답 비교: ...\n❌ 지문과 어긋나는 부적절한 진술 [패턴명]'

[변별 판단 규칙 — 필수]
단순히 "사실 일치/불일치" 만 설명하면 부족하다.
각 선지의 해설은 반드시 **다른 선지와 비교하여 왜 이 선지가 정답/오답인지** 를 드러내야 한다.

questionType: "positive" (가장 적절한 것은?)
  - 정답 선지 (ok:true) 는 🔎 배제 근거 섹션에 **4개 오답 선지 각각이 왜 정답이 될 수 없는지** 한 줄씩 밝힐 것.
    예) "#2 는 '비 기원' 이 원문에 없음 · #3 은 원문 '바람이 한창인 제' 와 정반대 · #4 는 ⓐ·ⓑ 공통 속성 오인 · #5 는 '집단 의지' 가 작품에 없음"
  - 오답 선지 (ok:false) 는 🔎 정답 비교 섹션에 **정답 선지 #N 이 왜 이 선지보다 더 적절한지** 한 줄로 밝힐 것.

questionType: "negative" (적절하지 않은 것은?)
  - 정답 선지 (ok:false) 는 🔎 배제 근거 섹션에 **4개 오답 선지 (ok:true) 가 왜 지문과 일치하는지** 간략히 언급할 것.
  - 오답 선지 (ok:true) 는 🔎 정답 비교 섹션에 **정답 선지 #N 이 왜 지문과 어긋나는지** 한 줄로 언급할 것.

비교 대상의 최소 수량:
  - positive 정답 해설은 4개 오답에 대한 배제 근거 4줄 (생략 금지).
  - negative 정답 해설은 4개 오답(ok:true) 일치 근거 4줄 (생략 금지).
  - 오답 해설은 정답 1개에 대한 비교 1줄 (생략 금지).

[ok:true 해설 필수 규칙]
ok:true 해설에서는 부정 판정 표현을 절대 사용하지 말 것 (단, 🔎 배제 근거 섹션에서 타 선지 왜 틀린지 기술하는 것은 허용).
금지 표현 (정답 선지 자체에 대한 기술에서만): 어긋나다, 왜곡, 잘못, 부적절, 맞지 않다, 일치하지 않다
정답 해설은 아래 4가지 기술:
- 지문 근거 (어디서 확인했는지)
- 선지와의 직접 일치 (어떻게 같은지)
- 🔎 배제 근거 (타 선지가 정답이 될 수 없는 이유)
- 왜 맞는지 (한 줄 결론)

[보기 문제 특별 규칙]
bogi 필드가 비어있지 않은 문항은 반드시 아래 세 가지 중
해당하는 오류 유형을 analysis에 명시해줘.

오류 유형:
① 보기 오독: 보기 조건 자체를 잘못 이해한 경우
② 보기 대입 오류: 보기 조건을 지문/작품에 잘못 적용한 경우
③ 지문 오독: 보기와 무관하게 지문 사실 자체를 왜곡한 경우

ok:false 선지 analysis 형식 (보기 문제):
'📌 보기 근거: "보기의 핵심 조건"\n📌 지문 근거: "지문의 실제 내용"\n🔍 ...\n❌ [오류유형①②③] 지문과 어긋나는 부적절한 진술 [패턴명]'

ok:true 선지 analysis 형식 (보기 문제):
'📌 보기 근거: "보기의 핵심 조건"\n📌 지문 근거: "지문의 실제 내용"\n🔍 ...\n✅ 보기 조건과 지문이 일치하는 적절한 진술'

[검증]
작성 후 스스로 확인: 정답 선지의 ok값이 questionType과 일치하는가?
- questionType: positive → 정답 선지 ok: true
- questionType: negative → 정답 선지 ok: false`;

const RETRY_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  `

경고: ok:false인 선지는 반드시 pat을 채워야 한다.
독서 세트(set id가 r로 시작)는 R1~R4 중 하나, 문학 세트(set id가 l로 시작)는 L1~L5 중 하나.
pat: null은 ok:true인 선지에만 허용된다.`;

const REANALYSIS_SYSTEM_PROMPT = `너는 수능 국어 전문 해설 작성자다.
반드시 순수 JSON 객체만 출력하라. 마크다운, 설명 텍스트 없음.

주어진 선지 하나에 대해 analysis만 작성해줘.
형식:
  ok:true:  '📌 지문 근거: "..."\n🔍 선지 분해: ...\n🔎 배제 근거: ...\n✅ 지문과 일치하는 적절한 진술'
  ok:false: '📌 지문 근거: "..."\n🔍 선지 분해: ...\n🔎 정답 비교: ...\n❌ 지문과 어긋나는 부적절한 진술 [패턴명]'

[변별 판단 규칙 — 필수]
재작성 시에도 반드시 타 선지와의 비교를 포함할 것.
  - questionType: "positive" 정답(ok:true) → 🔎 배제 근거에 4개 오답 각각이 정답이 아닌 이유를 한 줄씩 (4줄)
  - questionType: "positive" 오답(ok:false) → 🔎 정답 비교에 정답 #N 이 이 선지보다 적절한 이유 1줄
  - questionType: "negative" 정답(ok:false) → 🔎 배제 근거에 4개 오답(ok:true) 이 지문과 일치하는 이유 4줄
  - questionType: "negative" 오답(ok:true) → 🔎 정답 비교에 정답 #N 이 지문과 어긋나는 이유 1줄

반드시 지문의 실제 문장을 근거로 사용. 3~5등급 학생도 이해할 수 있게 구체적으로.
출력 형식: { "analysis": "..." }

입력에 neighbor_choices (같은 문항의 다른 선지 목록) 가 주어지면 해당 정보를 활용해 🔎 섹션을 채울 것.`;

const VOCAB_SYSTEM_PROMPT = `너는 수능 국어 어휘·표현 문제 전문 해설 작성자다.
반드시 순수 JSON 배열만 출력하라. 마크다운, 설명 텍스트 없음.

이 문항은 어휘/문맥적 의미 문제다. 각 선지마다 아래 형식으로 analysis를 작성하라.

[analysis 형식]
[문맥 속 의미]
'밑줄 단어'는 이 지문에서 "~하다"는 의미로 쓰임 (사전적 의미와 구별)

[호응 성분]
목적어: ~을/를
부사어: ~하게 / ~으로
주어: ~이/가

[치환 판단]
이 문맥에서 '선지단어'로 바꾸면 → 자연스럽다/어색하다
이유: ~

[결론]
✅ 적절 / ❌ 부적절 — 한 줄 근거

[추가 규칙]
- cs_ids는 반드시 빈 배열 []로 설정
- "지문이 제공되지 않았으나" 같은 문구 절대 금지
- 지문 문장 인용은 호응 성분 확인용으로만 사용
- ok:true 선지: 결론에 ✅ 적절
- ok:false 선지: 결론에 ❌ 부적절

[pat 규칙 — 어휘 문항 우선 규칙]
- ok:true 선지: pat = null
- ok:false 선지: **반드시** pat 을 채워라. null / 미기재 금지. 분류 불가일 때만 pat: 0
- ok:false 선지 기본값: **V** (어휘 치환/문맥 의미 오류, 독서/문학 양 도메인 공통 사용)
- analysis 꼬리 [결론] 에 [V]/[R1~R4]/[L1~L5] 라벨이 있으면 pat 필드도 동일 코드로 반환
- 아래 계열 문항은 **우선적으로 V** 를 선택할 것:
  · "어휘 의미" · "문맥적 의미" · "문맥상 의미" · "사전적 의미"
  · "의미로 쓰인 예" · "의미로 쓰였" · "바꿔 쓰기" · "바꿔 쓴"
  · ⓐ/ⓑ 같은 2기호 또는 ⓐ~ⓔ 5기호 대응, "바르게 짝지어진 것은"
- **예외**: 어휘 외 다른 오류 패턴 (인과 전도, 구조 오류 등) 이 analysis 에 명백히 드러난 경우에만
  독서 세트 R1~R4 / 문학 세트 L1~L5 중 하나를 사용 가능.
- 독서 세트에 L*, 문학 세트에 R* 배정 금지.

출력 형식: [{ qId: 1, num: 1, pat: null, analysis: "..." }, ...]
반드시 qId를 포함해줘.`;

// ─── 재시도 유틸 ─────────────────────────────────────────────

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

// ─── JSON 파싱 유틸 ──────────────────────────────────────────

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

  console.warn("JSON 직접 파싱 실패, 따옴표 수정 시도");
  const fixed = tryParse(fixUnescapedQuotes(text));
  if (fixed) return fixed;

  console.warn("따옴표 수정 실패, 여러 배열 병합 시도");
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

  console.warn("배열 병합 실패, jsonrepair 시도");
  const repaired = jsonrepair(text);
  return JSON.parse(repaired);
}

// ─── 핵심 로직 ───────────────────────────────────────────────

const VALID_PATS = new Set([
  "R1",
  "R2",
  "R3",
  "R4",
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "V",
]);

// analysis 키워드 → pat 자동 분류 (postProcess fallback)
function detectPatFromAnalysis(a, sec) {
  const m = a.match(/\[(R[1-4]|L[1-5]|V)\]/);
  if (m) return m[1];
  // [NEW] 어휘/문맥 의미 문항은 V 를 우선 매핑 (독서/문학 공통)
  // "어휘 의미", "문맥적 의미", "의미로 쓰였다", "바꿔 쓰기" 등 vocab 단서
  if (
    /어휘\s*의미|문맥적\s*의미|문맥상\s*의미|의미로\s*쓰였|의미로\s*쓰인|바꿔\s*쓰기|바꿔\s*쓴|사전적\s*의미/.test(
      a,
    )
  )
    return "V";
  if (/\[오류유형[①②③]/.test(a) || a.includes("📌 보기 근거"))
    return sec === "reading" ? "R4" : "L5";
  // [NEW] 보기 조건 왜곡 — Q26#2 케이스. 문학=L5(보기대입), 독서=R2(관계전도)
  if (/조건\s*왜곡|보기\s*조건\s*왜곡|조건\s*오독/.test(a))
    return sec === "reading" ? "R2" : "L5";
  if (
    /팩트 왜곡|사실 왜곡|의미 왜곡|정반대|역전된/.test(a)
  )
    return sec === "reading" ? "R1" : "L1";
  if (
    /관계[··]인과|인과 전도|인과관계 왜곡|논리 왜곡|반박-지지|대상 바꿔치기|순서 역전/.test(
      a,
    )
  )
    return sec === "reading" ? "R2" : "L4";
  if (
    /과도한 추론|과잉 추론|지문에 없|근거 부재|지문 핵심 미파악|과장 해석/.test(
      a,
    )
  )
    return sec === "reading" ? "R3" : "L3";
  if (/개념 짜깁기|개념 혼합|개념 혼동/.test(a))
    return sec === "reading" ? "R4" : "L1";
  if (/심리 오독|정서\s?오독|인물 의도|맥락 오독/.test(a))
    return sec === "reading" ? "R1" : "L2";
  if (/수사법|시어|이미지|표현법|시간 표지/.test(a) && sec === "literature")
    return "L1";
  if (
    /구조.*오류|맥락.*오류|화자.*오독|인물.*오인/.test(a) &&
    sec === "literature"
  )
    return "L4";
  if (/정서.*오류|태도 오독|화자의 태도 오독/.test(a) && sec === "literature")
    return "L2";
  if (/권면 대상|핵심 의미 왜곡|과도한 의미/.test(a) && sec === "literature")
    return "L3";
  return null;
}

// ─── [NEW] pat 도메인 검사 (감지 전용) ──────────────────────
//
// 기존 fallback 구조는 모든 오류를 L3/R3 로 수렴시켜 pat 정보를 파괴한다.
// → 이 함수는 **pat 을 절대 수정하지 않는다**. 감지 결과만 리턴.
// → 호출부가 _pat_error flag 를 부여하고, 최종 판단은 step5 fail-fast 에 위임.
//
// 도메인 단일 진실값: set.id prefix
//   - set.id l* (문학): L1~L5, V 만 valid
//   - set.id r* (독서): R1~R4, V 만 valid
//   - V 는 양 도메인 공통
//
// 반환:
//   { pat: <입력 그대로>, error: null | {code, pat_seen, expected_domain?} }
//
// error.code 값:
//   - "pat_missing"       : null / undefined / 0
//   - "pat_invalid"       : VALID_PATS 셋에 없는 값
//   - "pat_out_of_domain" : 도메인 위반 (l-set 에 R 또는 r-set 에 L)
//
// 주의: fallback 없음. L3/R3 로 덮어쓰지 않는다.
function enforcePatDomain(pat, setId /*, analysis */) {
  const isLit = String(setId || "").startsWith("l");
  const expectedDomain = isLit ? "L" : "R";

  // pat_missing: null / undefined / 0
  if (pat === null || pat === undefined || pat === 0) {
    return {
      pat,
      error: { code: "pat_missing", pat_seen: pat, expected_domain: expectedDomain },
    };
  }

  // pat_invalid: 유효 집합에 없음
  if (!VALID_PATS.has(pat)) {
    return {
      pat,
      error: { code: "pat_invalid", pat_seen: pat, expected_domain: expectedDomain },
    };
  }

  // V 는 양 도메인 공통 허용
  if (pat === "V") return { pat, error: null };

  // 도메인 위반 검사
  if (isLit && /^R[1-4]$/.test(pat)) {
    return {
      pat,
      error: { code: "pat_out_of_domain", pat_seen: pat, expected_domain: "L" },
    };
  }
  if (!isLit && /^L[1-5]$/.test(pat)) {
    return {
      pat,
      error: { code: "pat_out_of_domain", pat_seen: pat, expected_domain: "R" },
    };
  }

  return { pat, error: null };
}

function sanitizePat(pat, ok) {
  // ok:true는 무조건 null
  if (ok === true) return null;
  // 유효한 문자열 패턴이면 그대로
  if (typeof pat === "string" && VALID_PATS.has(pat)) return pat;
  // 숫자나 기타 → null (postProcess에서 detectPat으로 재분류 시도)
  return null;
}

function applyChoices(set, updatedChoices) {
  const updatedQuestions = set.questions.map((q) => ({
    ...q,
    choices: q.choices.map((orig) => {
      const updated = updatedChoices.find(
        (c) => c.qId === q.id && c.num === orig.num,
      );
      if (updated) {
        const patRaw = updated.pat ?? orig.pat;
        const okVal = updated.ok ?? orig.ok;
        return {
          ...orig,
          ok: okVal,
          pat: sanitizePat(patRaw, okVal),
          analysis: updated.analysis ?? orig.analysis,
        };
      }
      return orig;
    }),
  }));
  return { ...set, questions: updatedQuestions };
}

async function callAnalyze(set, answerKey, systemPrompt) {
  const answerGuide = set.questions
    .map((q) => {
      const correctNum = answerKey[String(q.id)];
      if (correctNum === undefined) return null;
      return { qId: q.id, questionType: q.questionType, correctNum };
    })
    .filter(Boolean);

  const userPrompt = `다음 세트를 분석해줘.

[정답 정보]
${answerGuide.map((g) => `문항 ${g.qId}번 (${g.questionType}): 정답 선지 = ${g.correctNum}번`).join("\n")}

[세트 데이터]
${JSON.stringify(set)}

각 선지의 pat과 analysis만 작성해줘. ok 필드는 출력하지 마.
- 정답 선지(ok:true에 해당): pat: null
- 오답 선지(ok:false에 해당): 독서 세트는 R1~R4, 문학 세트는 L1~L5 중 하나

choices 배열만 JSON으로 반환해줘.
형식: [{ qId: 1, num: 1, pat: null, analysis: "..." }, ...]
반드시 qId(문항 id)를 포함해줘. qId는 set.questions[n].id 값이다.`;

  const response = await callWithRetry(() =>
    client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      },
      { headers: { "anthropic-beta": "output-128k-2025-02-19" } },
    ),
  );

  return parseJSON(response.content[0].text);
}

async function reanalyzeSingleChoice(set, question, choice) {
  // [NEW] 변별 판단용 neighbor choices — 같은 문항 내 타 선지 num/t/ok 를 함께 전달
  const neighbor_choices = (question.choices || [])
    .filter((c) => c.num !== choice.num)
    .map((c) => ({ num: c.num, t: c.t, ok: c.ok }));
  const answerNumObj = (question.choices || []).find(
    (c) => c.ok === (question.questionType === "positive"),
  );
  const answer_num = answerNumObj ? answerNumObj.num : null;

  const userPrompt = `지문 세트: ${JSON.stringify({ id: set.id, title: set.title, sents: set.sents })}
문항: ${JSON.stringify({ id: question.id, t: question.t, questionType: question.questionType })}
선지: { num: ${choice.num}, t: "${choice.t}", ok: ${choice.ok} }
정답 선지 번호: ${answer_num}
neighbor_choices: ${JSON.stringify(neighbor_choices)}

위 선지의 ok 값(${choice.ok})에 맞게 analysis를 작성해줘. 반드시 변별 판단 규칙에 따라 🔎 섹션을 포함할 것.
출력: { "analysis": "..." }`;

  const response = await callWithRetry(() =>
    client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        system: REANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
      { headers: { "anthropic-beta": "output-128k-2025-02-19" } },
    ),
  );

  const parsed = parseJSON(response.content[0].text);
  return parsed.analysis || "";
}

// ─── 변별 판단 품질 검증기 ───────────────────────────────────
// 각 choice.analysis 가 변별 판단 규칙을 만족하는지 표면 패턴으로 검사.
// 만족 못 하면 reanalyzeSingleChoice 로 재생성.
//
// 검사 항목:
//   - 📌 지문 근거 존재
//   - 🔎 섹션 존재 (positive 정답=배제근거, positive 오답=정답비교, negative 반대)
//   - 정답(positive)·정답(negative) 은 타 선지 4개 언급 필요 (#N 또는 선지N 표기 ≥ 4)
//   - 오답 선지는 정답 선지 참조 ≥ 1
//   - ok:false 는 ❌ 결론 + [Rn|Ln|V] 패턴 코드
//   - ok:true 는 ✅ 결론 + 금지 표현 미포함 (🔎 배제 근거 내부는 예외)
function validateAnalysisQuality(choice, question) {
  const a = String(choice?.analysis || "");
  const issues = [];
  if (!a) return { ok: false, issues: ["empty_analysis"] };
  if (!a.includes("📌")) issues.push("no_passage_ref");

  const isPositiveQ = question?.questionType === "positive";
  const isCorrect = choice.ok === isPositiveQ; // positive & ok:true, or negative & ok:false

  // 🔎 섹션 존재
  const hasDiscriminator = a.includes("🔎");
  if (!hasDiscriminator) issues.push("no_discriminator_section");

  // 타 선지 참조 수 (#1~#5 또는 선지1~선지5)
  const refMatches = a.match(/#[1-5]|선지\s*[1-5]/g) || [];
  const refCount = new Set(refMatches.map((s) => s.replace(/\D/g, ""))).size;

  if (isCorrect) {
    // 정답 선지: 4개 오답 전부 언급 기대. 3개 이상이면 허용 (엄격 4→완화 3)
    if (refCount < 3) issues.push(`correct_insufficient_refs:${refCount}`);
  } else {
    // 오답 선지: 정답 선지 1개 이상 언급
    if (refCount < 1) issues.push(`wrong_no_correct_ref`);
  }

  // ok:false 결론 형식
  if (choice.ok === false) {
    if (!a.includes("❌")) issues.push("wrong_no_negation_mark");
    if (!/\[\s*(R[1-4]|L[1-5]|V)\s*[:： ].*?\]|\[\s*(R[1-4]|L[1-5]|V)\s*\]/.test(a))
      issues.push("wrong_no_pat_code");
  }

  // ok:true 결론 형식 + 금지 표현 (🔎 섹션 앞 부분에 한해 체크)
  if (choice.ok === true) {
    if (!a.includes("✅")) issues.push("correct_no_positive_mark");
    const beforeDiscrim = a.split("🔎")[0] || a;
    const FORBIDDEN_POS = ["어긋나", "왜곡", "잘못", "부적절", "맞지 않", "일치하지 않"];
    for (const w of FORBIDDEN_POS) {
      if (beforeDiscrim.includes(w)) {
        issues.push(`correct_forbidden_phrase:${w}`);
        break;
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

// ─── 후처리 보정 ─────────────────────────────────────────────

const DISCRIMINATIVE_VALIDATION_ENABLED =
  process.env.STEP3_DISCRIMINATIVE_VALIDATION !== "false";
const DISCRIMINATIVE_MAX_RETRIES = Number(
  process.env.STEP3_DISCRIMINATIVE_MAX_RETRIES || 2,
);

export async function postProcess(result, answerKey) {
  const correctedSets = { reading: [], literature: [] };
  let totalOkFixed = 0,
    totalPatFlagged = 0,
    totalPatNullFixed = 0;
  let totalDiscrimRegen = 0,
    totalDiscrimGiveUp = 0;

  for (const section of ["reading", "literature"]) {
    for (const set of result[section]) {
      const updatedQuestions = [];

      for (const q of set.questions) {
        const correctNum = answerKey[String(q.id)];
        if (correctNum === undefined) {
          updatedQuestions.push(q);
          continue;
        }

        const updatedChoices = [];
        for (const c of q.choices) {
          let choice = { ...c };
          const isCorrect = c.num === correctNum;
          const expectedOk =
            q.questionType === "positive" ? isCorrect : !isCorrect;
          const okChanged = choice.ok !== expectedOk;

          if (okChanged) {
            console.warn(
              `  [postProcess] ok 보정: ${set.id} ${q.id}번 선지${c.num} ${choice.ok} → ${expectedOk}`,
            );
            choice.ok = expectedOk;
            totalOkFixed++;
          }

          // [NEW] ok override 최종 적용 — answerKey 보정 이후 사람 확정값으로 덮어쓰기
          //   - override 등재 시: choice.ok 를 override 값으로 강제. 이전 값 _ok_overridden 메타에 보존.
          //   - 이 경로를 탄 choice 는 ok/analysis 모순 감지에서 자동 제외 대상.
          const okOverride = lookupOkOverride(set.id, q.id, c.num);
          if (okOverride !== null && typeof okOverride === "boolean") {
            const prevOk = choice.ok;
            if (prevOk !== okOverride) {
              choice._ok_overridden = {
                source: "config/ok_overrides.json",
                prev: prevOk,
                applied: okOverride,
                expected_from_answer_key: expectedOk,
              };
              console.log(
                `  [postProcess:okOverride] ${set.id} Q${q.id}#${c.num} ok: ${prevOk} → ${okOverride} (human-approved; answerKey-derived=${expectedOk})`,
              );
              choice.ok = okOverride;
            }
          }

          // ok:true → pat 강제 null
          if (choice.ok === true && choice.pat !== null) {
            choice.pat = null;
            totalPatNullFixed++;
          }
          // ok:false → pat 감지만 (수정 금지, flag 만 부여)
          // fallback 없음 — 오류 시 pat 은 그대로 두고 _pat_error 로 기록
          // step5 fail-fast 가 최종 차단 담당
          if (choice.ok === false) {
            // [NEW] 1차: config/pat_overrides.json 조회 — 사람이 확정한 pat 이 있으면 우선 적용
            const override = lookupPatOverride(set.id, q.id, c.num);
            if (override) {
              const prev = choice.pat;
              choice.pat = override;
              if (choice._pat_error) delete choice._pat_error;
              choice._pat_overridden = {
                source: "config/pat_overrides.json",
                prev,
                applied: override,
              };
              console.log(
                `  [postProcess:override] ${set.id} Q${q.id}#${c.num} pat: ${JSON.stringify(prev)} → ${override} (human-approved)`,
              );
            } else {
              // 2차: enforcePatDomain 감지 — fallback 없음, flag 만
              const { error } = enforcePatDomain(
                choice.pat,
                set.id,
                choice.analysis,
              );
              if (error) {
                const domain = String(set.id).startsWith("l")
                  ? "literature"
                  : "reading";
                const suggested = detectPatFromAnalysis(
                  choice.analysis || "",
                  domain,
                );
                choice._pat_error = {
                  ...error,
                  set_id: set.id,
                  q_id: q.id,
                  choice_num: c.num,
                  suggested_pat: suggested ?? null,
                };
                console.warn(
                  `  [postProcess:patError] ${set.id} Q${q.id}#${c.num} ${error.code} (pat=${JSON.stringify(choice.pat)}, expected=${error.expected_domain}, suggested=${suggested ?? "(null)"})`,
                );
                totalPatFlagged++;
              } else if (choice._pat_error) {
                // 이전 라운드 잔여 flag 제거
                delete choice._pat_error;
              }
            }
          }

          // [NEW] ok/analysis 모순 감지 — pat 문제 아님, ok 재검토 대상
          // override 가 적용된 choice 는 사람 확정이므로 모순 감지에서 제외.
          {
            if (choice._ok_overridden) {
              if (choice._ok_analysis_mismatch) delete choice._ok_analysis_mismatch;
            } else {
              const mismatch = detectOkAnalysisMismatch(choice);
              if (mismatch) {
                choice._ok_analysis_mismatch = {
                  ...mismatch,
                  set_id: set.id,
                  q_id: q.id,
                  choice_num: c.num,
                  ok: choice.ok,
                };
                console.warn(
                  `  [postProcess:okMismatch] ${set.id} Q${q.id}#${c.num} ${mismatch.code} (ok=${choice.ok}, has_tick=${mismatch.has_tick}, has_x=${mismatch.has_x}) — ok_recheck 대상`,
                );
              } else if (choice._ok_analysis_mismatch) {
                delete choice._ok_analysis_mismatch;
              }
            }
          }

          if (okChanged) {
            console.log(
              `  [postProcess] analysis 재생성: ${set.id} ${q.id}번 선지${c.num}`,
            );
            try {
              // neighbor 를 채우려면 질문의 최신 choice 집합 필요 — 임시 q 객체에 현재까지 갱신된 choice 들 주입
              const neighborSnapshot = {
                ...q,
                choices: [
                  ...updatedChoices,
                  choice,
                  ...q.choices.slice(updatedChoices.length + 1),
                ],
              };
              choice.analysis = await reanalyzeSingleChoice(
                set,
                neighborSnapshot,
                choice,
              );
            } catch (err) {
              console.warn(
                `  [postProcess] analysis 재생성 실패: ${err.message}`,
              );
            }
          }

          // [NEW] 변별 판단 품질 검증 + 재생성 루프
          if (DISCRIMINATIVE_VALIDATION_ENABLED) {
            const neighborSnapshot = {
              ...q,
              choices: [
                ...updatedChoices,
                choice,
                ...q.choices.slice(updatedChoices.length + 1),
              ],
            };
            let vres = validateAnalysisQuality(choice, neighborSnapshot);
            let attempt = 0;
            while (!vres.ok && attempt < DISCRIMINATIVE_MAX_RETRIES) {
              attempt++;
              console.warn(
                `  [postProcess:discrim] 변별 기준 미달 ${set.id} Q${q.id}#${c.num} (attempt ${attempt}/${DISCRIMINATIVE_MAX_RETRIES}) issues=${vres.issues.join(",")} — 재생성`,
              );
              try {
                choice.analysis = await reanalyzeSingleChoice(
                  set,
                  neighborSnapshot,
                  choice,
                );
                totalDiscrimRegen++;
              } catch (err) {
                console.warn(
                  `  [postProcess:discrim] 재생성 실패: ${err.message}`,
                );
                break;
              }
              vres = validateAnalysisQuality(choice, neighborSnapshot);
            }
            if (!vres.ok) {
              totalDiscrimGiveUp++;
              choice._discriminative_validation = {
                passed: false,
                issues: vres.issues,
                attempts: attempt,
              };
              console.warn(
                `  [postProcess:discrim] ${set.id} Q${q.id}#${c.num} — ${attempt}회 후 기준 미달. needsReview 대상.`,
              );
            }
          }

          updatedChoices.push(choice);
        }
        updatedQuestions.push({ ...q, choices: updatedChoices });
      }
      correctedSets[section].push({ ...set, questions: updatedQuestions });
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("[postProcess] 보정 완료 요약");
  console.log("=".repeat(50));
  if (totalOkFixed === 0) console.log(`ok 보정: ✅ 0건`);
  else console.warn(`ok 보정: ⚠️ ${totalOkFixed}건`);
  console.log(`pat:null→0 플래그: ${totalPatFlagged}건`);
  console.log(`ok:true & pat→null: ${totalPatNullFixed}건`);
  if (DISCRIMINATIVE_VALIDATION_ENABLED) {
    console.log(
      `변별 재생성: ${totalDiscrimRegen}건 · 기준 미달 잔존: ${totalDiscrimGiveUp}건`,
    );
  } else {
    console.log(`변별 검증: 비활성화 (STEP3_DISCRIMINATIVE_VALIDATION=false)`);
  }

  let remaining = 0;
  for (const section of ["reading", "literature"]) {
    for (const set of correctedSets[section]) {
      for (const q of set.questions) {
        const correctNum = answerKey[String(q.id)];
        if (!correctNum) continue;
        const correctChoice = q.choices.find((c) => c.num === correctNum);
        if (!correctChoice) continue;
        const expectedOk = q.questionType === "positive" ? true : false;
        if (correctChoice.ok !== expectedOk) remaining++;
      }
    }
  }
  console.log(`ok 불일치 잔여: ${remaining}건`);
  console.log("=".repeat(50));

  return correctedSets;
}

function injectOkValues(choices, set, answerKey) {
  return choices.map((c) => {
    const q = set.questions.find((q) => q.id === c.qId);
    if (!q) {
      console.warn(`  [injectOk] qId ${c.qId} 매칭 실패 — num ${c.num}`);
      return c;
    }
    const correctNum = answerKey[String(q.id)];
    if (correctNum === undefined) return c;
    const isCorrect = c.num === correctNum;
    c.ok = q.questionType === "positive" ? isCorrect : !isCorrect;
    return c;
  });
}

// [NEW] Q13 유형 (ⓐ,ⓑ 2기호 + "의미로 쓰인 예") 등 vocab 문항 확장 인식
// 기존 패턴 유지 + "의미로 쓰인", "바르게 짝지어진", "ⓐ(이)?의 의미", "ⓑ(이)?의 의미", "문맥상 .* 의미" 추가
const VOCAB_PATTERN =
  /사전적 의미|문맥상 의미|문맥적 의미|밑줄 친.*의미|ⓐ.*~.*ⓔ|㉠.*~.*㉤|의미로 쓰인|바르게 짝지어진|ⓐ[,\s에는]*의 의미|ⓑ[,\s에는]*의 의미|ⓐ[,\s]*ⓑ[^\n]*의미|문맥상[^\n]*의미|어휘[^\n]*의미|바꿔 쓰기에/;

function isVocabQuestion(q) {
  return VOCAB_PATTERN.test(q.t);
}

async function analyzeSet(set, answerKey) {
  const vocabQIds = new Set(
    set.questions.filter(isVocabQuestion).map((q) => q.id),
  );

  if (vocabQIds.size === 0) {
    const choices = await callAnalyze(set, answerKey, SYSTEM_PROMPT);
    return injectOkValues(choices, set, answerKey);
  }

  // 일반 문항과 어휘 문항 분리
  const normalSet = {
    ...set,
    questions: set.questions.filter((q) => !vocabQIds.has(q.id)),
  };
  const vocabSet = {
    ...set,
    questions: set.questions.filter((q) => vocabQIds.has(q.id)),
  };

  let allChoices = [];

  if (normalSet.questions.length > 0) {
    const normalChoices = await callAnalyze(
      normalSet,
      answerKey,
      SYSTEM_PROMPT,
    );
    allChoices.push(...normalChoices);
  }

  if (vocabSet.questions.length > 0) {
    const vocabChoices = await callAnalyze(
      vocabSet,
      answerKey,
      VOCAB_SYSTEM_PROMPT,
    );
    allChoices.push(...vocabChoices);
  }

  return injectOkValues(allChoices, set, answerKey);
}

export async function retrySet(set, answerKey) {
  console.log(`[step3:retry] 재분석 중: ${set.id} (${set.range})`);
  const updatedChoices = await callAnalyze(set, answerKey, RETRY_SYSTEM_PROMPT);
  return applyChoices(set, updatedChoices);
}

// ─── ★ 핵심: 세트별 중간 저장으로 중단 내성 강화 ─────────────
/**
 * partialCachePath가 주어지면:
 * - 이미 완료된 세트는 캐시에서 로드하여 스킵
 * - 새로 완료된 세트는 즉시 캐시에 저장
 * → 절전/네트워크 끊김 후 재실행 시 완료된 세트부터 이어서 진행
 */
export async function analyzeStructure(
  structureData,
  answerKey,
  partialCachePath = null,
) {
  // 기존 부분 완료 결과 로드
  let partial = { reading: [], literature: [] };
  if (partialCachePath && fs.existsSync(partialCachePath)) {
    partial = JSON.parse(fs.readFileSync(partialCachePath, "utf8"));
    const completedIds = [
      ...partial.reading.map((s) => s.id),
      ...partial.literature.map((s) => s.id),
    ];
    if (completedIds.length > 0) {
      console.log(
        `  📂 부분 완료 로드: ${completedIds.join(", ")} — 이어서 진행`,
      );
    }
  }

  const result = {
    reading: [...partial.reading],
    literature: [...partial.literature],
  };

  const completedIds = new Set([
    ...partial.reading.map((s) => s.id),
    ...partial.literature.map((s) => s.id),
  ]);

  for (const section of ["reading", "literature"]) {
    for (const set of structureData[section]) {
      // 이미 완료된 세트 스킵
      if (completedIds.has(set.id)) {
        console.log(`[step3] 스킵 (이미 완료): ${set.id}`);
        continue;
      }

      console.log(`[step3] 분석 중: ${set.id} (${set.range})`);
      const updatedChoices = await analyzeSet(set, answerKey);
      const analyzed = applyChoices(set, updatedChoices);
      result[section].push(analyzed);

      // ★ 세트 완료 즉시 부분 캐시 저장
      if (partialCachePath) {
        atomicWrite(partialCachePath, result);
        console.log(
          `  💾 부분 저장: ${set.id} 완료 → ${path.basename(partialCachePath)}`,
        );
      }
    }
  }

  return result;
}

// ─── ★ 원자적 파일 쓰기 유틸 ────────────────────────────────
/**
 * 임시 파일에 먼저 쓰고 완료되면 rename → 중단돼도 원본 보존
 */
export function atomicWrite(filePath, data) {
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

// step3 output 후 호출. 위반 시 needs_human 마킹, retry X.
function validateStep3Output(set, choices) {
  const issues = [];
  for (const q of set.questions) {
    for (const c of q.choices) {
      if (c.ok === false && (c.pat === null || c.pat === undefined)) {
        issues.push({ qid: q.id, num: c.num, code: 'PAT_MISSING_ON_FALSE' });
      }
      if (c.ok === true && c.pat !== null && c.pat !== undefined) {
        issues.push({ qid: q.id, num: c.num, code: 'PAT_PRESENT_ON_TRUE' });
      }
    }
  }
  return issues;
}

// ─── 커맨드라인 ──────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const structurePath = process.argv[2];
  const answerKeyPath = process.argv[3];
  const retryFlag = process.argv.indexOf("--retry");
  const retryId = retryFlag !== -1 ? process.argv[retryFlag + 1] : null;

  if (!structurePath || !answerKeyPath) {
    console.error(
      "사용법: node pipeline/step3_analysis.js [step2결과JSON] [정답키JSON] [--retry setId]",
    );
    process.exit(1);
  }

  const structurePath_abs = path.resolve(structurePath);
  const structureData = JSON.parse(fs.readFileSync(structurePath_abs, "utf8"));
  const answerKey = JSON.parse(
    fs.readFileSync(path.resolve(answerKeyPath), "utf8"),
  );

  if (retryId) {
    const step3Path = path.resolve(
      path.dirname(structurePath_abs),
      "step3_result.json",
    );
    if (!fs.existsSync(step3Path)) {
      console.error(`step3 결과 없음: ${step3Path}`);
      process.exit(1);
    }
    const step3Data = JSON.parse(fs.readFileSync(step3Path, "utf8"));
    const allSets = [...step3Data.reading, ...step3Data.literature];
    const targetSet = allSets.find((s) => s.id === retryId);
    if (!targetSet) {
      console.error(`세트 ID 없음: ${retryId}`);
      process.exit(1);
    }

    retrySet(targetSet, answerKey)
      .then((updated) => {
        for (const section of ["reading", "literature"]) {
          const idx = step3Data[section].findIndex((s) => s.id === retryId);
          if (idx !== -1) {
            step3Data[section][idx] = updated;
            break;
          }
        }
        atomicWrite(step3Path, step3Data);
        console.log(`\n✅ ${retryId} 재분석 완료`);
      })
      .catch((err) => {
        console.error("오류:", err.message);
        process.exit(1);
      });
  } else {
    analyzeStructure(structureData, answerKey)
      .then(async (raw) => {
        const corrected = await postProcess(raw, answerKey);
        const outPath = path.resolve(
          path.dirname(structurePath_abs),
          "step3_result.json",
        );
        atomicWrite(outPath, corrected);
        console.log(`\n✅ 저장 완료: ${outPath}`);
      })
      .catch((err) => {
        console.error("오류:", err.message);
        process.exit(1);
      });
  }
}
