import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { jsonrepair } from "jsonrepair";
import { chooseRegenAnalysis } from "./haesol_v2_gate.mjs";
// [발주 D-89 ④] 토큰 계측만 추가 — 프롬프트·형식·로직은 건드리지 않는다.
import { logUsage } from "./api_usage.mjs";

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
// δ patch: final-line 우선 — extractConclusionRegion 영역 본문 전체 검색 폐기
//   ok:true: finalLine ❌ 시작 시 flag set / 본문 중간 ❌은 BODY_CONFLICT_HINT warning 영역 (validateAnalysisQuality cover)
//   ok:false: finalLine ✅ 시작 시 flag set / 본문 중간 ✅은 BODY_CONFLICT_HINT warning 영역
function detectOkAnalysisMismatch(choice) {
  const a = choice?.analysis || "";
  if (!a) return null;
  const trimmed = a.trim();
  const lines = trimmed.split(/\n+/);
  const finalLine = (lines.at(-1) || "").trim();
  const hasTick = finalLine.startsWith("✅");
  const hasX = finalLine.startsWith("❌");
  if (!hasTick && !hasX) return null; // 결론 마커 부재 — 판단 보류
  if (choice.ok === true && hasX) {
    return {
      code: "ok_true_but_analysis_negates",
      has_tick: false,
      has_x: true,
      final_line: finalLine.slice(0, 100),
    };
  }
  if (choice.ok === false && hasTick) {
    return {
      code: "ok_false_but_analysis_confirms",
      has_tick: true,
      has_x: false,
      final_line: finalLine.slice(0, 100),
    };
  }
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

[analysis 작성 규칙 — v2]
모든 선지 해설은 아래 3단 구조로 자립적으로 작성한다. 다른 선지를 가리키는 별도 비교 블록(🔎)을 만들지 말 것. 배제·변별 논리는 해당 선지 자신의 풀이에 녹인다.
- 반드시 지문의 실제 문장을 근거로 사용
- 3~5등급 학생도 이해할 수 있게 구체적으로
- 형식:
  ok:true:  '📌 지문 근거: "..."\n🔍 [풀이]\n✅ {이 선지에만 해당하는 고유한 한 줄 결론}'
  ok:false: '📌 지문 근거: "..."\n🔍 [풀이]\n❌ {이 선지에만 해당하는 고유한 한 줄 결론} [패턴명]'

[🔍 풀이 — 3단 강제, 최소 2문장]
① 근거 풀이: 📌의 지문 문장이 '무슨 뜻인지' 학생 눈높이로 쉽게 풀어 쓴다. 지문 표현을 그대로 되풀이 금지, 반드시 쉬운 말로 바꿔 설명.
② 선지-지문 매칭: 선지의 어느 표현이 지문의 어느 부분과 어떻게 맞물리는지(또는 어긋나는지) 구체적으로 연결한다. "명시되어 있다 / 언급하고 있다" 같은 메타 서술 금지.
③ 판정 연결: 그래서 이 선지가 왜 맞는지(틀리는지)로 마무리한다.

[오답(ok:false) 추가 의무 — 함정 진단]
오답 해설은 "~아니다"라는 부정으로 끝내지 말 것. 반드시 다음을 포함한다:
- 이 오답이 왜 매력적인가: 학생이 어느 단어·구절에 낚이기 쉬운지 한 번 짚는다.
- 어디서 착각하나: 지문의 실제 내용과 선지가 갈라지는 지점을 정확히 지목한다.
  예) "'대립'이라는 말에 낚이기 쉽지만, 실제로는 질문-답변 관계일 뿐 의견이 부딪치지 않는다."

[ok:true 해설 필수 규칙]
ok:true 해설에서는 부정 판정 표현(어긋나다/왜곡/잘못/부적절/맞지 않다/일치하지 않다)을 절대 사용하지 말 것.
단, ② 매칭 단계에서 "왜 이 선지가 다른 그럴듯한 선지보다 정확한지"를 한 구절 녹여 변별력을 준다(별도 블록 X, 문장 안에서).

[결론 한 줄 규칙]
✅/❌ 뒤 결론은 선지마다 다르게 쓴다. 같은 문항 안에서 동일 문구 복붙 금지. 선지 내용을 반영한 고유 표현으로 작성. (나쁜 예: 5선지 모두 "부적절한 설명")

[보기 문제 특별 규칙]
bogi 필드가 비어있지 않은 문항은 반드시 아래 세 가지 중
해당하는 오류 유형을 analysis에 명시해줘.

오류 유형:
① 보기 오독: 보기 조건 자체를 잘못 이해한 경우
② 보기 대입 오류: 보기 조건을 지문/작품에 잘못 적용한 경우
③ 지문 오독: 보기와 무관하게 지문 사실 자체를 왜곡한 경우

ok:false 선지 analysis 형식 (보기 문제):
'📌 보기 근거: "보기의 핵심 조건"\n📌 지문 근거: "지문의 실제 내용"\n🔍 [3단 풀이: ①보기 조건이 무엇을 요구하는지 → ②그 조건을 지문/작품에 대입하면 어떻게 되는지 → ③판정 + 함정 진단]\n❌ {고유 결론} [오류유형①②③ 명시] [패턴명]'

ok:true 선지 analysis 형식 (보기 문제):
'📌 보기 근거: "보기의 핵심 조건"\n📌 지문 근거: "지문의 실제 내용"\n🔍 [3단 풀이: ①보기 조건이 무엇을 요구하는지 → ②그 조건을 지문/작품에 대입하면 어떻게 맞물리는지 → ③판정]\n✅ {고유 결론}'

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
  ok:true:  '📌 지문 근거: "..."\n🔍 [3단 풀이]\n✅ {고유 한 줄 결론}'
  ok:false: '📌 지문 근거: "..."\n🔍 [3단 풀이]\n❌ {고유 한 줄 결론} [패턴명]'

[🔍 풀이 — 3단 강제, 최소 2문장]
① 근거 풀이: 📌 지문 문장의 뜻을 학생 눈높이로 쉽게 풀어 쓴다(지문 되풀이 금지).
② 선지-지문 매칭: 선지의 어느 표현이 지문의 어느 부분과 맞물리는지/어긋나는지 구체적으로 연결한다("명시/언급하고 있다" 메타 서술 금지).
③ 판정 연결: 그래서 맞는지/틀리는지로 마무리.
오답(ok:false)은 함정 진단 의무: 학생이 어느 단어에 낚이는지 + 어디서 착각하는지를 짚는다.
별도 비교 블록(🔎) 금지. 변별 논리는 ② 매칭 문장 안에 녹인다.

반드시 지문의 실제 문장을 근거로 사용. 3~5등급 학생도 이해할 수 있게 구체적으로.
출력 형식: { "analysis": "..." }`;

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
(ok:false는 함정 진단 한 줄: 그 치환이 왜 그럴듯해 보이는데 어색한지 — 사전적 의미는 비슷하나 문맥 호응이 어긋나는 지점을 짚을 것)

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

// [회기 4 patch 2] retry 강화 — 10회 + 점진 backoff (총 ~25분 견딤)
// Connection error / timeout 영역 적극 retry, API error (529/500) 동일 정책
const RETRY_DELAYS_MS = [
  5000, 15000, 30000, 60000, 120000, 300000, 300000, 300000, 300000, 300000,
];
async function callWithRetry(fn, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isConnectionError =
        err.message?.includes("Connection") ||
        err.message?.includes("timeout") ||
        err.message?.includes("ECONNRESET") ||
        err.message?.includes("ETIMEDOUT");
      const isApiError = err.status === 529 || err.status === 500;
      const isRetryable = isConnectionError || isApiError;
      if (isRetryable && i < maxRetries - 1) {
        const delay = RETRY_DELAYS_MS[i] || 300000;
        const errType = isConnectionError ? "Connection" : "API";
        console.warn(
          `  ⚠️ ${errType} 오류 (${i + 1}/${maxRetries}): ${err.message}`,
        );
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
  if (/팩트 왜곡|사실 왜곡|의미 왜곡|정반대|역전된/.test(a))
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
      error: {
        code: "pat_missing",
        pat_seen: pat,
        expected_domain: expectedDomain,
      },
    };
  }

  // pat_invalid: 유효 집합에 없음
  if (!VALID_PATS.has(pat)) {
    return {
      pat,
      error: {
        code: "pat_invalid",
        pat_seen: pat,
        expected_domain: expectedDomain,
      },
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

  // [cu1] 프롬프트 입력 결손 검사 — 이 경로는 JSON.stringify(set) 으로 세트 전체를
  //   넘기므로 정상 상태에서는 전건 통과한다. 향후 payload 를 줄이는 변경이 들어오면
  //   여기서 드러난다. 세트 단위 호출이라 문항 skip 은 불가 — 사유를 로그로 남긴다.
  for (const _q of set.questions || []) {
    const g = checkPromptInputs(userPrompt, _q, set);
    if (!g.ok)
      console.warn(`  [step3:input] ${set.id} Q${_q.id} 입력 결손 — ${g.reasons.join(" / ")}`);
  }

  const response = await callWithRetry(() =>
    client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      },
      { headers: { "anthropic-beta": "output-128k-2025-02-19" } },
    ),
  );
  logUsage("step3", (typeof set !== "undefined" && set && set.id) ? set.id : "?", response);

  console.log(`[diagnostic] stop_reason=${response.stop_reason}`);
  console.log(
    `[diagnostic] response length=${response.content[0].text.length}`,
  );
  console.log(
    `[diagnostic] response tail (last 100): ${response.content[0].text.slice(-100)}`,
  );

  return parseJSON(response.content[0].text);
}

// ─── 프롬프트 입력 결손 검사 (발주 cu[1]) ────────────────────
// 해설 생성 직전, 모델이 판단에 필요한 값이 실제로 프롬프트에 들어갔는지 본다.
//   배경: 변별 재생성 경로가 bogi 를 넘기지 않아 선지가 'ㄱ, ㄷ' 뿐인 문항에서
//   모델이 <보기> 내용을 지어냈다(r20206d Q40 · l20229a Q19 · r20236b Q7-4).
//   bogi 인자가 미래에 되돌려져도 이 검사가 있으면 조용히 통과하지 않는다.
// 실패는 전체 중단이 아니라 **문항 단위 skip** 이다 — 배치를 통째로 잃지 않기 위해서(cm 전례).
const _SYM1 = /^[ㄱ-ㅎa-zA-Zⅰ-ⅹ①-⑮ⓐ-ⓔ㉠-㉤]$/;
const _flat = (v) => { const a = []; (function w(x) {
  if (typeof x === "string") a.push(x);
  else if (Array.isArray(x)) x.forEach(w);
  else if (x && typeof x === "object") Object.values(x).forEach(w);
})(v); return a.join("\n"); };

// ─── 생성 순서 강제 (발주 cv[1]) ──────────────────────────────
// 마커를 참조하는 문항이 있는데 그 마커가 아직 본문/보기에 정박되지 않았다면
// 해설을 생성해선 안 된다 — 모델이 참조 대상 없이 내용을 지어낸다.
//   실증: l20229a Q19 는 마커 정박 이전에 해설이 생성돼 ⓐ~ⓔ 를 서로 뒤바꿔 설명했고,
//   해설 자신이 "지문에 ⓐ~ⓔ 표시가 없어 판단 불가능"이라 적은 채 LIVE 로 나갔다.
// 마커 정박은 세트 속성이므로 **세트 단위 skip** 이다(문항으로 나눌 실익 없음).
export function checkMarkerAnchored(set) {
  const MARK = /[ⓐ-ⓔ㉠-㉤㉮-㉲]/g;
  const anchored = new Set();
  for (const sn of set?.sents || [])
    for (const m of String(sn.t || "").match(MARK) || []) anchored.add(m);
  for (const q of set?.questions || [])
    for (const m of _flat(q.bogi).match(MARK) || []) anchored.add(m);

  const missing = new Map();
  for (const q of set?.questions || []) {
    const refs = new Set();
    const rm = String(q.t || "").match(/([ⓐ-ⓔ㉠-㉤㉮-㉲])\s*[~～∼]\s*([ⓐ-ⓔ㉠-㉤㉮-㉲])/);
    if (rm) {
      for (const pool of ["ⓐⓑⓒⓓⓔ", "㉠㉡㉢㉣㉤", "㉮㉯㉰㉱㉲"]) {
        if (pool.includes(rm[1]) && pool.includes(rm[2])) {
          pool.slice(pool.indexOf(rm[1]), pool.indexOf(rm[2]) + 1).split("").forEach((x) => refs.add(x));
          break;
        }
      }
    }
    for (const m of String(q.t || "").match(MARK) || []) refs.add(m);
    for (const c of q.choices || []) for (const m of String(c.t || "").match(MARK) || []) refs.add(m);
    for (const r of refs) if (!anchored.has(r)) {
      if (!missing.has(r)) missing.set(r, []);
      missing.get(r).push(q.id);
    }
  }
  return {
    ok: missing.size === 0,
    reasons: [...missing.entries()].map(([m, qs]) => `${m}(Q${[...new Set(qs)].join(",")})`),
  };
}

export function checkPromptInputs(prompt, question, set) {
  const P = String(prompt || "");
  const reasons = [];
  const bogi = _flat(question?.bogi);

  // 검사 1 — bogi 가 있으면 그 내용이 프롬프트에 있어야 한다
  if (bogi.trim()) {
    const probe = bogi.replace(/\s+/g, "").slice(0, 24);
    if (probe && !P.replace(/\s+/g, "").includes(probe))
      reasons.push("bogi_missing: 문항에 <보기>가 있으나 프롬프트에 없음");
  }
  // 마커 정의 소재 — bogi 항목 또는 본문 정박 문장
  const anchorOf = (sym) => {
    const b = bogi.match(new RegExp(`(^|\\n)\\s*${sym}[.．)\\s][^\\n]*`, "m"));
    if (b) return b[0].trim();
    // <보기> 본문 인라인 정박 (예: "…글 전체에서 ⓐ중요하다고 생각하는 단어만…")
    // 항목 형식(줄머리+구분자)만 인정하면 인라인 정박 7건이 근거 없이 막힌다.
    const bi = bogi.indexOf(sym);
    if (bi >= 0) return bogi.slice(bi, bi + 40);
    for (const sn of set?.sents || []) {
      const i = String(sn.t || "").indexOf(sym);
      if (i >= 0) return String(sn.t).slice(i, i + 40);
    }
    return null;
  };
  const inPrompt = (txt) => {
    if (!txt) return false;
    const p = txt.replace(/\s+/g, "").slice(0, 16);
    return p.length >= 4 && P.replace(/\s+/g, "").includes(p);
  };
  // 검사 2 — 선지가 마커 나열뿐이면 그 마커들의 정의가 있어야 한다
  const cs = question?.choices || [];
  const comboSyms = new Set();
  const isCombo = cs.length >= 4 && cs.every((c) => {
    const toks = String(c.t || "").split(/[,·、\s]+/).filter(Boolean);
    const ok = toks.length >= 1 && toks.length <= 4 && toks.every((t) => _SYM1.test(t));
    if (ok) toks.forEach((t) => comboSyms.add(t));
    return ok;
  });
  if (isCombo) {
    const miss = [...comboSyms].filter((s) => !inPrompt(anchorOf(s)));
    if (miss.length) reasons.push(`combo_def_missing: 선지가 마커 나열뿐인데 [${miss.join("")}] 정의가 프롬프트에 없음`);
  }
  // 검사 3 — 발문이 마커 범위를 선언하면 범위 내 전 마커 정박 문장이 있어야 한다
  const rm = String(question?.t || "").match(/([ⓐ-ⓔ㉠-㉤ㄱ-ㅎ])\s*[~～∼]\s*([ⓐ-ⓔ㉠-㉤ㄱ-ㅎ])/);
  if (rm) {
    const POOLS = ["ⓐⓑⓒⓓⓔ", "㉠㉡㉢㉣㉤", "ㄱㄴㄷㄹㅁ"];
    const pool = POOLS.find((p) => p.includes(rm[1]) && p.includes(rm[2]));
    if (pool) {
      const span = pool.slice(pool.indexOf(rm[1]), pool.indexOf(rm[2]) + 1).split("");
      const miss = span.filter((s) => !inPrompt(anchorOf(s)));
      if (miss.length) reasons.push(`range_def_missing: 발문이 ${rm[1]}~${rm[2]} 선언인데 [${miss.join("")}] 정박 문장이 프롬프트에 없음`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}

// export: 선지 단위 재생성을 외부 도구(polarity_regen.mjs)에서도 쓴다.
// 프롬프트·모델·시스템 프롬프트·형식은 손대지 않았다 — 노출만 했다.
export async function reanalyzeSingleChoice(set, question, choice) {
  // [NEW] 변별 판단용 neighbor choices — 같은 문항 내 타 선지 num/t/ok 를 함께 전달
  const neighbor_choices = (question.choices || [])
    .filter((c) => c.num !== choice.num)
    .map((c) => ({ num: c.num, t: c.t, ok: c.ok }));
  const answerNumObj = (question.choices || []).find(
    (c) => c.ok === (question.questionType === "positive"),
  );
  const answer_num = answerNumObj ? answerNumObj.num : null;

  const userPrompt = `지문 세트: ${JSON.stringify({ id: set.id, title: set.title, sents: set.sents })}
문항: ${JSON.stringify({ id: question.id, t: question.t, questionType: question.questionType, bogi: question.bogi })}
선지: { num: ${choice.num}, t: "${choice.t}", ok: ${choice.ok} }
정답 선지 번호: ${answer_num}
neighbor_choices: ${JSON.stringify(neighbor_choices)}

위 선지의 ok 값(${choice.ok})에 맞게 analysis를 작성해줘. 🔍 풀이는 3단(근거 풀이 → 선지-지문 매칭 → 판정)으로 쓰고, 오답이면 함정 진단을 포함할 것. 별도 🔎 비교 블록은 만들지 말 것.
출력: { "analysis": "..." }`;

  // [cu1] 프롬프트 입력 결손 검사 — API 호출 전. 실패하면 이 문항만 skip 한다.
  const gate = checkPromptInputs(userPrompt, question, set);
  if (!gate.ok) {
    console.warn(
      `  [step3:skip] ${set.id} Q${question.id}#${choice.num} 생성 skip — ${gate.reasons.join(" / ")}`,
    );
    return ""; // 빈 값 → adoptRegeneratedAnalysis 가 채택하지 않고 기존 해설 유지
  }

  const response = await callWithRetry(() =>
    client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 8000,
        system: REANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
      { headers: { "anthropic-beta": "output-128k-2025-02-19" } },
    ),
  );
  logUsage("step3", (typeof set !== "undefined" && set && set.id) ? set.id : "?", response);

  const parsed = parseJSON(response.content[0].text);
  return parsed.analysis || "";
}

// ─── 변별 판단 품질 검증기 ───────────────────────────────────
// 각 choice.analysis 가 변별 판단 규칙을 만족하는지 표면 패턴으로 검사.
// 만족 못 하면 reanalyzeSingleChoice 로 재생성.
//
// 검사 항목:
//   - 📌 지문 근거 존재
//   - 🔍 풀이 섹션 존재 + 최소 분량 (1줄 되풀이 방지) [v2]
//   - 오답 선지는 함정 진단 흔적 권고 [v2]
//   - ok:false 는 ❌ 결론 + [Rn|Ln|V] 패턴 코드
//   - ok:true 는 ✅ 결론 + 금지 표현 미포함
function validateAnalysisQuality(choice, question) {
  const a = String(choice?.analysis || "");
  const issues = [];
  if (!a) return { ok: false, issues: ["empty_analysis"] };
  if (!a.includes("📌")) issues.push("no_passage_ref");

  const isPositiveQ = question?.questionType === "positive";
  const isCorrect = choice.ok === isPositiveQ;

  // v2: 🔎 비교 블록·타 선지 #N 참조 의무 폐기 (§7 자립 해설).
  // 대신 🔍 풀이 존재 + 최소 분량(되풀이 1줄 방지)을 표면 검사.
  if (!a.includes("🔍")) issues.push("no_explanation_section");
  const explMatch = a.match(/🔍([\s\S]*?)(?:\n[✅❌]|$)/);
  const explLen = explMatch ? explMatch[1].replace(/\s/g, "").length : 0;
  if (explLen < 40) issues.push(`explanation_too_thin:${explLen}`);
  // 오답은 함정 진단 흔적 권고 (없으면 재작성 유도)
  if (!isCorrect) {
    const trapHint =
      /낚이|착각|그럴듯|보이지만|쉽지만|혼동|함정|처럼 보이|헷갈/.test(a);
    if (!trapHint) issues.push("wrong_no_trap_diagnosis");
  }

  // γ patch: validator final-line 우선 + pat gate + issue code 세분화
  const trimmed = a.trim();
  const lines = trimmed.split(/\n+/);
  const finalLine = (lines.at(-1) || "").trim();
  const beforeFinal = lines.slice(0, -1).join("\n");
  const VALID_PATS = [
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
  ];
  const patBracketRe = /\[\s*(R[1-4]|L[1-5]|V)\s*([:： ][^\]]*)?\]/;

  // pat gate
  if (choice.ok === true && choice.pat) {
    issues.push(`OK_PAT_INCONSISTENCY:pat_${choice.pat}`);
  }
  if (choice.ok === false) {
    if (choice.pat === null || choice.pat === undefined) {
      issues.push("PAT_FIELD_MISSING");
    } else if (
      !VALID_PATS.includes(choice.pat) ||
      choice.pat === 0 ||
      choice.pat === "0"
    ) {
      issues.push(`PAT_INVALID_NEEDS_HUMAN:invalid_${choice.pat}`);
    }
  }

  // final-line 검사
  if (choice.ok === true) {
    if (!finalLine.startsWith("✅")) {
      issues.push("FINAL_FOOTER_MISMATCH:ok_true_no_check");
    }
    if (patBracketRe.test(finalLine)) {
      issues.push("FINAL_FOOTER_MISMATCH:ok_true_has_pat_bracket");
    }
  }
  if (choice.ok === false && VALID_PATS.includes(choice.pat)) {
    if (!finalLine.startsWith("❌")) {
      issues.push("FINAL_FOOTER_MISMATCH:ok_false_no_x");
    }
    const m = finalLine.match(patBracketRe);
    if (!m) {
      issues.push("PAT_BRACKET_MISSING");
    } else if (m[1] !== choice.pat) {
      issues.push(`FINAL_FOOTER_MISMATCH:pat_${m[1]}_neq_${choice.pat}`);
    }
  }

  // ok:true 금지 표현 (🔎 사전 영역, 지문 인용 strip — patch C-1 유지)
  if (choice.ok === true) {
    const beforeDiscrim = a.split("🔎")[0] || a;
    const stripped = beforeDiscrim.replace(/"[^"]*"/g, "");
    const FORBIDDEN_POS = [
      "어긋나",
      "왜곡",
      "잘못",
      "부적절",
      "맞지 않",
      "일치하지 않",
    ];
    for (const w of FORBIDDEN_POS) {
      if (stripped.includes(w)) {
        issues.push(`correct_forbidden_phrase:${w}`);
        break;
      }
    }
  }

  // BODY_CONFLICT_HINT (warning, ok 영역 0 영향)
  const bodyConflicts = [];
  for (const w of ["✅", "❌"]) {
    if (beforeFinal.includes(w)) bodyConflicts.push(w);
  }
  if (bodyConflicts.length) {
    issues.push(`BODY_CONFLICT_HINT:${bodyConflicts.join(",")}`);
  }

  // BODY_CONFLICT_HINT는 fatal 영역 외 (warning)
  const fatalIssues = issues.filter((i) => !i.startsWith("BODY_CONFLICT_HINT"));
  return { ok: fatalIssues.length === 0, issues };
}

// ─── 후처리 보정 ─────────────────────────────────────────────

const DISCRIMINATIVE_VALIDATION_ENABLED =
  process.env.STEP3_DISCRIMINATIVE_VALIDATION !== "false";
const DISCRIMINATIVE_MAX_RETRIES = Number(
  process.env.STEP3_DISCRIMINATIVE_MAX_RETRIES || 2,
);

// ─── normalizeAnalysisPatLabel: deterministic [pat] bracket rendering ──
// 회기 2 — 2단계 spec (회기 1 측정: wrong_no_pat_code 49건/65건 = 75.4%)
//
// 3 case 처리:
//   1. 누락:   ok:false + pat ∈ {R/L/V} + analysis 영역 [pat] bracket 부재 → ❌ 결말에 추가
//   2. 불일치: choice.pat="R2" + analysis 결말 line "...[R1]" → [R1] 제거 + [R2] 추가
//              본문 인용 [R1] 영역 보존 (❌ 결말 line 단독 처리)
//   3. 옛 라벨: analysis="...[패턴3]" 또는 "...[오류유형②]" → 단독 제거 + [pat] 추가
//              한글 자유 라벨 ([인과관계 역전] 등) 영역 보존
//
// dry-run 검증: false positive 0/6, case 1/2/3 정합 ✓, 가드 정합 ✓
export function normalizeAnalysisPatLabel(choice) {
  if (choice.ok !== false || !choice.pat) return choice.analysis;
  if (choice.pat === 0 || choice.pat === "0") return choice.analysis;

  const validPats = ["R1", "R2", "R3", "R4", "L1", "L2", "L3", "L4", "L5", "V"];
  if (!validPats.includes(choice.pat)) return choice.analysis;

  let a = choice.analysis || "";

  // case 3: 옛 라벨만 단독 제거
  a = a.replace(/\[\s*패턴\s*\d+\s*\]/g, "");
  a = a.replace(/\[\s*오류\s*유형[^\]]*\]/g, "");

  // case 2: 다른 pat code — ❌ 결말 line 단독 (본문 인용 보존)
  const otherPats = validPats.filter((p) => p !== choice.pat);
  const lines = a.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("❌")) continue;
    for (const p of otherPats) {
      const re = new RegExp(String.raw`\[\s*${p}\s*([:： ][^\]]*)?\]`, "g");
      lines[i] = lines[i].replace(re, "");
    }
  }
  a = lines.join("\n");

  a = a.replace(/\s+$/, "");

  // case 1 + 4 (β patch A): choice.pat bracket 부재 → 마지막 ❌ line 끝에 [pat] 추가
  //   case 1: ❌ line 부재 → analysis 끝에 추가
  //   case 4: ❌ line 안 [pat] 미포함 (한글 자유 라벨만 있어도) → 추가
  //   (직전 case 1 regex `(❌[^\n]*)$`는 string 끝 단일 line만 match — multi-line ❌ 사후 본문 잔존 시 미작동)
  const targetRe = new RegExp(
    String.raw`\[\s*${choice.pat}\s*([:： ][^\]]*)?\]`,
  );
  if (!targetRe.test(a)) {
    const allLines = a.split("\n");
    let lastXIdx = -1;
    for (let i = allLines.length - 1; i >= 0; i--) {
      if (allLines[i].includes("❌")) {
        lastXIdx = i;
        break;
      }
    }
    if (lastXIdx >= 0) {
      allLines[lastXIdx] = allLines[lastXIdx] + ` [${choice.pat}]`;
      a = allLines.join("\n");
    } else {
      a = a + ` [${choice.pat}]`;
    }
  }

  return a;
}

// ─── γ patch: deterministic footer ────────────────────────────
// expectedFooter / applyDeterministicFooter
// 사양: choice.ok / choice.pat 기준 deterministic 생성 — Claude 응답 영역 외
//   - 기존 final verdict line (✅ 또는 ❌ 시작) + 사후 본문 제거
//   - expectedFooter replace (append 금지)
//   - expectedFooter null 시 needs_human queue (pat:null 자동 부여 금지)

export function expectedFooter(choice) {
  if (choice?.ok === true) {
    return "✅ 지문과 일치하는 적절한 진술";
  }
  if (choice?.ok === false && choice.pat) {
    return `❌ 지문과 어긋나는 부적절한 진술 [${choice.pat}]`;
  }
  return null;
}

export function applyDeterministicFooter(choice) {
  const expected = expectedFooter(choice);
  if (expected === null) return choice.analysis;

  const a = choice.analysis || "";
  const lines = a.split("\n");

  let lastVerdictIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (t.startsWith("✅") || t.startsWith("❌")) {
      lastVerdictIdx = i;
      break;
    }
  }

  if (lastVerdictIdx >= 0) {
    lines.splice(lastVerdictIdx);
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  lines.push("");
  lines.push(expected);

  return lines.join("\n");
}

export async function postProcess(result, answerKey) {
  const correctedSets = { reading: [], literature: [] };
  let totalOkFixed = 0,
    totalPatFlagged = 0,
    totalPatNullFixed = 0;
  let totalDiscrimRegen = 0,
    totalDiscrimGiveUp = 0;
  let totalRegenAccepted = 0,
    totalRegenRejected = 0,
    totalRegenWarned = 0;

  function adoptRegeneratedAnalysis(choice, regeneratedAnalysis, context) {
    const verdict = chooseRegenAnalysis(
      choice.analysis,
      regeneratedAnalysis,
      choice.pat,
      choice.ok,
    );
    if (!verdict.accept) {
      totalRegenRejected++;
      console.warn(
        `  [postProcess:regenGate] 거부 ${context}: ${verdict.reason} — 기존 analysis 보존`,
      );
      return false;
    }
    totalRegenAccepted++;
    if (verdict.warn) {
      totalRegenWarned++;
      console.warn(
        `  [postProcess:regenGate] 경고 ${context}: ${verdict.warn}`,
      );
    }
    choice.analysis = verdict.analysis;
    return true;
  }

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
              const regeneratedAnalysis = await reanalyzeSingleChoice(
                set,
                neighborSnapshot,
                choice,
              );
              adoptRegeneratedAnalysis(
                choice,
                regeneratedAnalysis,
                `${set.id} Q${q.id}#${c.num} ok보정`,
              );
            } catch (err) {
              console.warn(
                `  [postProcess] analysis 재생성 실패: ${err.message}`,
              );
            }
          }

          // [NEW 회기 2-2단계] deterministic [pat] bracket rendering
          // — wrong_no_pat_code 자동 해소 (회기 1 측정: 75.4% 비중)
          choice.analysis = applyDeterministicFooter(choice);

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
                const regeneratedAnalysis = await reanalyzeSingleChoice(
                  set,
                  neighborSnapshot,
                  choice,
                );
                const adopted = adoptRegeneratedAnalysis(
                  choice,
                  regeneratedAnalysis,
                  `${set.id} Q${q.id}#${c.num} 변별재생성 attempt=${attempt}`,
                );
                if (!adopted) continue;
                // [회기 4 patch 1] 변별 재생성 사후 normalize 재호출
                // → wrong_no_pat_code 잔존 영역 자동 해소 (회기 3 보완)
                choice.analysis = applyDeterministicFooter(choice);
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

          // ε patch: ok/analysis 모순 감지 — 모든 정정 (applyDeterministicFooter + discriminative loop) 사후 final detect
          // override 가 적용된 choice 는 사람 확정이므로 모순 감지에서 제외.
          {
            if (choice._ok_overridden) {
              if (choice._ok_analysis_mismatch)
                delete choice._ok_analysis_mismatch;
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
  console.log(
    `재생성 채택 게이트: 채택 ${totalRegenAccepted}건 · 거부 ${totalRegenRejected}건 · 경고 ${totalRegenWarned}건`,
  );

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
    // 입력에 해당 섹션 키가 없어도 죽지 않는다.
    //   2026-08 실증: literature 키가 없는 입력에서 해설을 전부 생성해 놓고
    //   저장 직전 'structureData[section] is not iterable' 로 죽어 LLM 1회분이
    //   통째로 유실됐다(부분 캐시 없음). 빈 배열 기본값으로 그 낭비를 막는다.
    for (const set of structureData[section] || []) {
      // 이미 완료된 세트 스킵
      if (completedIds.has(set.id)) {
        console.log(`[step3] 스킵 (이미 완료): ${set.id}`);
        continue;
      }

      // [cv1] 생성 순서 강제 — 마커 참조 문항이 있는데 정박이 안 됐으면 세트 전체 skip
      const anchorGate = checkMarkerAnchored(set);
      if (!anchorGate.ok) {
        console.warn(
          `[step3:skip] ${set.id} 세트 skip — 마커 미정박: ${anchorGate.reasons.join(" ")}\n` +
            `            마커를 본문/보기에 먼저 정박한 뒤 재실행하십시오.`,
        );
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
        issues.push({ qid: q.id, num: c.num, code: "PAT_MISSING_ON_FALSE" });
      }
      if (c.ok === true && c.pat !== null && c.pat !== undefined) {
        issues.push({ qid: q.id, num: c.num, code: "PAT_PRESENT_ON_TRUE" });
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
