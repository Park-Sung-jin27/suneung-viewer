/**
 * pipeline/pdf_text_extractor.mjs
 *
 * pdf-parse 기반 PDF 직접 텍스트 추출.
 * Gemini OCR 대비: 원문자 (㉠㉡㉢㉣㉤, ⓐⓑⓒⓓⓔ, ①②③④⑤) 와 기호 (가)(나)(다) 보존력 검증됨.
 *
 * 책임:
 *   - PDF → 전체 텍스트
 *   - 문항 단위 블록 분해 (번호. 패턴 기준)
 *   - 각 문항의 choice 분리 (①~⑤ 시작)
 *   - 발문 / bogi / 선지 텍스트 원문 보존 (재서술 금지)
 *
 * 한계 (솔직):
 *   - 레이아웃 기반 칼럼/표는 단순 텍스트로 flatten 됨
 *   - figure/이미지 내 텍스트는 추출 불가
 *   - sentType (body/verse/workTag/author/footnote) 분류 책임 없음 — 이 모듈은 원문만
 *   - 공백/줄바꿈은 PDF 렌더 그대로. 문장 단위 splitting 은 상위 단계 (step2_postprocess) 책임
 *
 * 사용:
 *   import { extractPdfText, parseQuestionBlocks } from "./pdf_text_extractor.mjs";
 *   const { fullText, numpages } = await extractPdfText(pdfPath);
 *   const questions = parseQuestionBlocks(fullText);  // [{ id, stem, choices[], bogi, raw_block }]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";

// ─── PDF → 전체 텍스트 ──────────────────────────────────────
export async function extractPdfText(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  const d = await parser.getText();
  return {
    fullText: d.text || "",
    numpages: d.numpages || null,
    raw: d,
  };
}

// ─── 문항 블록 분해 ─────────────────────────────────────────
// 수능 PDF 의 선지 마커는 3가지 포맷이 혼재:
//   (A) leading circled:   "① 선지…"
//   (B) leading number:    "1. 선지…"  (일부 활동지/구버전)
//   (C) trailing circled:  "…설명… ·········· ①"  (학습 활동지·표 기반 문항)
//
// Q 번호 패턴: line 시작에 `\d+\.` 또는 `\d+\.\t`
const Q_HEADER_RE = /^\s*(\d{1,2})\.\s*(?:\t|\s{2,})?(.*)$/;
const LEADING_NUMBER_RE = /^\s*([1-5])\.\s+(.+)$/;

// ─── 마커 집합 정본 (단일 출처) ─────────────────────────────
// U+3260~3264 (㉠~㉤), U+2460~2464 (①~⑤), U+24D0~24D4 (ⓐ~ⓔ)
//   선지 마커 정규식·scanMarkers 가 모두 이 정의만 참조한다.
const MARKER_SETS = {
  circled_hangul: { chars: "㉠㉡㉢㉣㉤".split(""), label: "㉠~㉤" },
  circled_number: { chars: "①②③④⑤".split(""), label: "①~⑤" },
  circled_latin: { chars: "ⓐⓑⓒⓓⓔ".split(""), label: "ⓐ~ⓔ" },
  section_bracket: {
    chars: ["(가)", "(나)", "(다)", "(라)"],
    label: "(가)~(라)",
  },
  square_letter: { chars: ["[A]", "[B]", "[C]"], label: "[A]~[C]" },
};

// 선지 마커 계열은 MARKER_SETS 단일 출처에서 생성한다.
//   정규식에 문자를 다시 적으면 정의와 매처가 갈라져 사각이 생긴다(§13⑮).
const CHOICE_MARKER_KEYS = ["circled_number", "circled_latin", "circled_hangul"];
const CHOICE_MARKER_CLASS = CHOICE_MARKER_KEYS.flatMap((k) => MARKER_SETS[k].chars).join("");
const LEADING_CIRCLED_RE = new RegExp(`^\\s*([${CHOICE_MARKER_CLASS}])\\s*(.*)$`);
// trailing: 끝에 '··· ①' 또는 '...  ⓐ' — 점/공백 3자+ 후 마커 + 종료
const TRAILING_CIRCLED_RE = new RegExp(`^(.*?)[·…\\.\\s]{3,}([${CHOICE_MARKER_CLASS}])\\s*$`);
// 한 줄에 선지가 모두 들어간 형식 탐지용: "① ⓐ ② ⓑ ③ ⓒ ④ ⓓ ⑤ ⓔ"
const INLINE_NUM_G = new RegExp(`[${MARKER_SETS.circled_number.chars.join("")}]`, "g");

function circledToNum(ch) {
  for (const k of CHOICE_MARKER_KEYS) {
    const i = MARKER_SETS[k].chars.indexOf(ch);
    if (i >= 0) return i + 1;
  }
  return null;
}

/**
 * "① ⓐ ② ⓑ ③ ⓒ ④ ⓓ ⑤ ⓔ" 처럼 한 줄에 선지가 모두 들어간 형식을 분리한다.
 * ①부터 오름차순 연속 3개 이상 + 각 조각 ≤16자 일 때만 — 일반 선지 줄 오탐 방지.
 * @returns {{num:number,t:string}[]|null}
 */
function splitInlineChoices(line) {
  const hits = [...line.matchAll(INLINE_NUM_G)];
  if (hits.length < 3) return null;
  const nums = hits.map((h) => circledToNum(h[0]));
  if (!nums.every((n, i) => n === i + 1)) return null;
  const out = [];
  for (let i = 0; i < hits.length; i++) {
    const from = hits[i].index + hits[i][0].length;
    const to = i + 1 < hits.length ? hits[i + 1].index : line.length;
    const t = line.slice(from, to).trim();
    if (t.length > 16) return null;
    out.push({ num: nums[i], t });
  }
  return out.every((c) => c.t) ? out : null;
}

export function parseQuestionBlocks(fullText) {
  const lines = fullText.split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 새 문항 시작?
    const qm = line.match(Q_HEADER_RE);
    const qId = qm ? parseInt(qm[1], 10) : null;
    const looksLikeQ =
      qm &&
      qId >= 1 &&
      qId <= 45 &&
      qm[2] &&
      /[가-힣<㉠ⓐ①\[]/.test(qm[2].slice(0, 10));

    if (looksLikeQ) {
      if (current) blocks.push(finalizeBlock(current));
      current = {
        id: qId,
        stem_lines: [qm[2]],
        choices: [],
        bogi_lines: [],
        _section: "stem",
        _currentChoice: null,
        _pendingPre: [], // 첫 choice 등장 전 누적 (활동지 trailing 마커 대비)
        _rawLines: [qm[2]], // 활동지 block-level 재파싱용 원본
        raw_start_line: i,
      };
      continue;
    }

    if (!current) continue;

    // 모든 후속 라인은 block-level 재파싱을 위해 원본 보존
    current._rawLines.push(line);

    // <보기> 시작?
    if (/<\s*보\s*기\s*>/.test(line)) {
      current._section = "bogi";
      current.bogi_lines.push(line);
      continue;
    }

    // (A-0) 한 줄에 선지가 모두 들어간 형식 — "① ⓐ ② ⓑ ③ ⓒ ④ ⓓ ⑤ ⓔ"
    //   (A) 보다 먼저 검사해야 한다. (A) 는 첫 ① 만 잡고 나머지를 본문으로 삼아
    //   선지 5개를 1개로 뭉갠다(l20196b Q31 실측).
    const inline = splitInlineChoices(line);
    if (inline) {
      current._section = "choice";
      for (const c of inline) current.choices.push({ num: c.num, lines: [c.t] });
      current._currentChoice = null;
      current._pendingPre = [];
      continue;
    }

    // (A) leading circled marker
    const mA = line.match(LEADING_CIRCLED_RE);
    if (mA) {
      const num = circledToNum(mA[1]);
      if (num !== null) {
        current._section = "choice";
        current._currentChoice = { num, lines: [mA[2]] };
        current.choices.push(current._currentChoice);
        current._pendingPre = [];
        continue;
      }
    }

    // (B) leading "N. ..." (반드시 stem 또는 bogi 가 이미 시작된 뒤에만, 숫자 오해 방지)
    if (current._section !== "stem" || current.stem_lines.length >= 2) {
      const mB = line.match(LEADING_NUMBER_RE);
      if (mB) {
        const num = parseInt(mB[1], 10);
        // 연속성 체크: 현재 선지가 없거나 num === 이전 num + 1 인 경우만 인정
        const prev = current._currentChoice;
        const acceptable =
          !prev ||
          num === prev.num + 1 ||
          (num === 1 && current.choices.length === 0);
        if (acceptable && num >= 1 && num <= 5) {
          current._section = "choice";
          current._currentChoice = { num, lines: [mB[2]] };
          current.choices.push(current._currentChoice);
          current._pendingPre = [];
          continue;
        }
      }
    }

    // (C) trailing circled marker
    //   ⚠ <보기> 내부에서는 검사하지 않는다. 보기 안의 항목도 "… ⓐ" 형식으로 끝나므로
    //     (예: "학생 1 : … 알 수 있어요. ·········· ⓐ", l20196b Q31) 그대로 두면
    //     보기 항목이 선지로 탈취되고 마커까지 버려진다.
    const mC = current._section === "bogi" ? null : line.match(TRAILING_CIRCLED_RE);
    if (mC) {
      const num = circledToNum(mC[2]);
      if (num !== null) {
        const prefix = (mC[1] || "").trim();
        if (current._currentChoice) {
          // 이전 leading-start 선지 진행 중 + trailing 마커 발견 → 이 줄의 prefix 를 추가하고 마감
          if (prefix) current._currentChoice.lines.push(prefix);
          current._currentChoice = null;
        } else {
          // 시작 마커 없이 trailing 만 — pendingPre + 이 줄 prefix 를 choice.t 로
          const body = [...current._pendingPre, prefix]
            .filter((s) => (s || "").trim())
            .join("\n");
          current.choices.push({ num, lines: [body] });
          current._pendingPre = [];
        }
        continue;
      }
    }

    // 본문 이어짐
    if (current._section === "choice" && current._currentChoice) {
      current._currentChoice.lines.push(line);
    } else if (current._section === "bogi") {
      current.bogi_lines.push(line);
    } else {
      // stem 단계이면서 이미 다른 choice 가 존재하지 않음 → stem 또는 pendingPre
      if (current.choices.length > 0) {
        // 이미 선지 1개 이상 있음 → 다음 trailing 선지의 pendingPre 로
        current._pendingPre.push(line);
      } else {
        current.stem_lines.push(line);
        current._pendingPre.push(line);
      }
    }
  }
  if (current) blocks.push(finalizeBlock(current));
  return blocks;
}

// ─── activity-sheet 유형 감지 ────────────────────────────────
// Q16 같은 "학습 활동지" 는 [핵심 개념 N] 표 헤더 + ∙ bullet + trailing ①~⑤ 구조.
// 일반 문항 파서 (줄 단위) 로는 bullet 단위 선지를 정확히 자를 수 없다.
// → block-level 재파싱: [핵심 개념] 헤더 무시, ∙ bullet 단위로 grouping,
//    trailing marker 가 있는 bullet 만 선지로 채택.
function isActivitySheet(rawLines) {
  const joined = rawLines.join("\n");
  const hasConceptHeader = /\[핵심 개념/.test(joined);
  const bulletCount = (joined.match(/(^|\n)\s*∙/g) || []).length;
  const trailingMarkerCount = (joined.match(/[·…\.\s]{3,}[①②③④⑤]\s*$/gm) || [])
    .length;
  return hasConceptHeader && bulletCount >= 4 && trailingMarkerCount >= 3;
}

function parseActivitySheet(rawLines) {
  // stem: 첫 □ / [ / ∙ 등장 전까지의 모든 라인을 합침.
  // Q 헤더 발문이 여러 줄에 걸친 경우(예: "... 윗글을\n바탕으로 할 때, 적절하지 않은 것은?") 전부 포함.
  const stemLines = [];
  let stemEndIdx = rawLines.length; // 기본: 모두 stem (다음 activity body 가 없다면)
  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = (rawLines[i] || "").trim();
    if (!trimmed) continue;
    if (
      trimmed.startsWith("□") ||
      trimmed.startsWith("[") ||
      trimmed.startsWith("∙")
    ) {
      stemEndIdx = i;
      break;
    }
    stemLines.push(rawLines[i]);
  }
  const stemLine = stemLines
    .join(" ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // bullet 그룹화: ∙ 로 시작하는 라인에서 새 bullet 시작,
  // 다음 ∙ 또는 [ / □ / 빈 줄 만나면 종료
  const bullets = [];
  let cur = null;
  // stem 이후부터 body 순회
  for (let i = stemEndIdx; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      if (cur) {
        bullets.push(cur);
        cur = null;
      }
      continue;
    }
    if (trimmed.startsWith("∙")) {
      if (cur) bullets.push(cur);
      cur = [line];
      continue;
    }
    if (trimmed.startsWith("[") || trimmed.startsWith("□")) {
      if (cur) {
        bullets.push(cur);
        cur = null;
      }
      continue; // 헤더는 버림
    }
    // bullet 이어짐
    if (cur) cur.push(line);
    // (cur 없으면 pre-bullet 텍스트 — stem 에 포함될 수 있으나 여기선 무시)
  }
  if (cur) bullets.push(cur);

  // 각 bullet 조립 + trailing marker 탐지
  const choices = [];
  const seenNums = new Set();
  for (const bulletLines of bullets) {
    const text = bulletLines
      .join(" ")
      .replace(/\s+/g, " ")
      .replace(/\t+/g, " ")
      .trim();
    const m = text.match(/^(.+?)[·…\.\s]{3,}([①②③④⑤])\s*$/);
    if (!m) continue; // trailing marker 없는 bullet = 컨텍스트/제외
    const num = "①②③④⑤".indexOf(m[2]) + 1;
    if (num < 1 || seenNums.has(num)) continue;
    seenNums.add(num);
    // bullet 본문 — 선행 "∙" 제거, 내부 공백 정리
    const body = m[1]
      .replace(/^\s*∙\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    choices.push({ num, t: body });
  }
  choices.sort((a, b) => a.num - b.num);

  return {
    stem: stemLine.replace(/\s+/g, " ").trim(),
    choices,
  };
}

function finalizeBlock(b) {
  const joinClean = (arr) =>
    arr
      .join("\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();

  // [NEW] activity-sheet 감지 시 block-level 재파싱
  const raw = b._rawLines || [];
  if (isActivitySheet(raw)) {
    const activity = parseActivitySheet(raw);
    // 감지되었지만 5 choice 추출 실패 시 일반 파서 결과로 폴백
    if (activity.choices.length === 5) {
      return {
        id: b.id,
        stem: activity.stem,
        bogi: joinClean(b.bogi_lines),
        choices: activity.choices,
        raw_block_line: b.raw_start_line,
        _activity_sheet: true,
      };
    }
  }

  return {
    id: b.id,
    stem: joinClean(b.stem_lines),
    bogi: joinClean(b.bogi_lines),
    choices: b.choices.map((c) => ({
      num: c.num,
      t: joinClean(c.lines),
    })),
    raw_block_line: b.raw_start_line,
  };
}

// ─── 회귀 자체 검사 ─────────────────────────────────────────
// `node pipeline/pdf_text_extractor.mjs --selftest`
//   fixtures/extractor_marker_forms.json 의 선지 마커 형식 케이스를 파싱해 검증한다.
//   실패 시 종료 코드 1. 파서·정규식을 고치면 반드시 먼저 통과시킬 것(§13⑮(7)).
export function selftest() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const fx = JSON.parse(
    fs.readFileSync(path.join(dir, "fixtures/extractor_marker_forms.json"), "utf8"),
  );
  let fail = 0;
  console.log(`추출기 회귀 — 케이스 ${fx.cases.length}건\n`);
  for (const c of fx.cases) {
    const blocks = parseQuestionBlocks(c.text.join("\n"));
    const b = blocks[0] || { choices: [], bogi: "" };
    const errs = [];
    const e = c.expect || {};
    if (e.choiceCount !== undefined && b.choices.length !== e.choiceCount)
      errs.push(`선지 ${b.choices.length}개 (기대 ${e.choiceCount})`);
    if (e.choiceTexts)
      e.choiceTexts.forEach((t, i) => {
        if ((b.choices[i] || {}).t !== t)
          errs.push(`선지${i + 1}="${(b.choices[i] || {}).t}" (기대 "${t}")`);
      });
    if (e.bogiContains)
      for (const s of e.bogiContains)
        if (!String(b.bogi || "").includes(s)) errs.push(`bogi 에 "${s}" 없음`);
    if (errs.length) fail++;
    console.log(`  ${errs.length ? "🔴 실패" : "✅"}  ${c.name}`);
    for (const x of errs) console.log(`        ${x}`);
    if (errs.length) console.log(`        사유: ${c.why}`);
  }
  console.log(
    `\n${fail ? `★ 회귀 실패 ${fail}건 — 추출기가 기지 형식을 처리하지 못합니다.` : "회귀 전건 통과."}`,
  );
  return fail;
}

// ─── 원문자 / 마커 스캔 ─────────────────────────────────────
//   MARKER_SETS 정의는 상단으로 이동함 — 선지 마커 정규식이 이를 단일 출처로 삼는다.
export function scanMarkers(text) {
  const out = {};
  for (const [key, def] of Object.entries(MARKER_SETS)) {
    const counts = {};
    for (const ch of def.chars) {
      const esc = ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      counts[ch] = (text.match(new RegExp(esc, "g")) || []).length;
    }
    out[key] = { label: def.label, counts };
  }
  return out;
}

// CLI: 회귀 자체 검사
if (process.argv.includes("--selftest")) process.exit(selftest() ? 1 : 0);
