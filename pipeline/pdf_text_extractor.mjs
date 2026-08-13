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

// ─── 텍스트 리더 선택 (고정) ────────────────────────────────
//   pdf-parse / pdftotext -raw = 단(column) 단위 분리  → 정상 32/36
//   pdftotext -layout          = 시각적 행 병합        → 붕괴 8/19, 블록 36→19
//   2단 조판 시험지에서 -layout 계열로 교체 금지. 2026-08 예시문항 실측.
//   -layout 은 좌단 지문과 우단 선지를 물리적으로 같은 줄에 놓아, 문항 헤더가
//   줄 첫머리에 오지 못하고 선지 경계가 무너진다(6·7·9·11개로 흩어짐).
//   pdfplumber 도 같은 계열(심사관 실측 5/34)이므로 동일하게 금지.

/**
 * 2단 조판이 한 줄로 병합됐는지 판정한다.
 *   병합된 텍스트는 "지문 문장 도중에 선지/문항헤더가 박히는" 행이 급증한다.
 *   임계는 리허설 실측에서 도출: -raw 65~67건(=문항 경계, 정상) vs -layout 77건(병합).
 *   행수가 리더마다 달라 절대건수 대신 1000행당 비율로 본다.
 *     -raw 67/1763행 = 38.0‰   ·   -layout 77/1266행 = 60.8‰
 *   임계 50‰ — 두 실측값 사이. 넘으면 단 병합으로 보고 중단한다.
 */
export function readerSanity(fullText, { threshold = 50 } = {}) {
  const L = fullText.split(/\r?\n/);
  let n = 0;
  for (let i = 1; i < L.length - 1; i++) {
    const p = L[i - 1].trim(), c = L[i].trim(), x = L[i + 1].trim();
    if (p && !/[.!?”'"」』…]$/.test(p) && /^(\d{1,2}\.\s|[①-⑤]\s|<보\s*기>)/.test(c) && x) n++;
  }
  const permille = L.length ? (n / L.length) * 1000 : 0;
  return { lines: L.length, interleaves: n, permille: Math.round(permille * 10) / 10,
    ok: permille <= threshold, threshold };
}

// ─── PDF → 전체 텍스트 ──────────────────────────────────────
export async function extractPdfText(pdfPath, { skipSanity = false } = {}) {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  const d = await parser.getText();
  const fullText = d.text || "";
  const sanity = readerSanity(fullText);
  if (!skipSanity && !sanity.ok) {
    throw new Error(
      `★ 리더 sanity 실패 — 2단 조판이 한 줄로 병합된 것으로 보입니다.\n` +
        `   문장중간삽입 ${sanity.interleaves}건 / ${sanity.lines}행 = ${sanity.permille}‰ (임계 ${sanity.threshold}‰)\n` +
        `   -layout·pdfplumber 계열 텍스트일 가능성이 큽니다. 단 단위로 분리하는 리더를 쓰십시오.`,
    );
  }
  return {
    fullText,
    numpages: d.numpages || null,
    sanity,
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
// [발주 fb 사양1] 실사용 최대치로 확장 — 전 코퍼스 실측:
//   ⓐ~ⓖ(7) · ㉠~㉩(10) · ①~⑦(7).
//   확장 전 5종 고정이라 l2026a(ⓕ) · l20249c(ⓕⓖ) · r20176a(ⓕ) ·
//   l2020a(㉥~㉩) · r20259d/r2021b(⑦) 의 마커가 추출기에서 보이지 않았다.
//   ★ 임의 확장 금지 — 실사용을 넘겨 넓히면 오탐이 는다. 새 마커가 나오면 다시 실측해 넓힌다.
// U+3260~3269, U+2460~2466, U+24D0~24D6
//   선지 마커 정규식·scanMarkers 가 모두 이 정의만 참조한다.
const MARKER_SETS = {
  circled_hangul: { chars: "㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩".split(""), label: "㉠~㉩" },
  circled_number: { chars: "①②③④⑤".split(""), label: "①~⑤" },
  //   ★ circled_number 는 넓히지 않았다 — 이 상수는 CHOICE_MARKER_KEYS(선지 번호)로도
  //     쓰여 ⑥⑦ 을 넣으면 ⑥⑦ 로 시작하는 줄을 선지로 오인한다. 지문 자료 번호로 ⑦ 을
  //     쓰는 세트가 2개 있다(r20259d · r2021b) — 선지 번호와 분리한 뒤에 넓혀야 한다.
  circled_latin: { chars: "ⓐⓑⓒⓓⓔⓕⓖ".split(""), label: "ⓐ~ⓖ" },
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
// leading 은 ①~⑤ 전용이다. ⓐ~ⓔ·㉠~㉤ 까지 넓히면 표·짝지음 문항의 항목행
//   ("ⓐ : 그 사람에게…", "ⓑ ⓒ")이 선지로 오인된다 — 2022예시 실측에서
//   정상 5선지 문항이 33/36 → 29/36 으로 악화(Q4·Q16·Q24·Q34). 개선은 0건이었다.
const LEADING_CIRCLED_RE = new RegExp(
  `^\\s*([${MARKER_SETS.circled_number.chars.join("")}])\\s*(.*)$`,
);
// trailing 은 전 계열 유지 — 줄 끝 '··· ⓐ' 형식은 항목행과 형태가 겹치지 않아 악화가 없다.
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
function splitInlineChoices(line, startNum = 1) {
  const hits = [...line.matchAll(INLINE_NUM_G)];
  if (hits.length < 2) return null; // 2개부터 — "① … ② …" 2열 조판(2022예시 Q32)
  const nums = hits.map((h) => circledToNum(h[0]));
  // startNum 부터 오름차순 연속이어야 한다. 줄이 이어지는 형식("③ … ④ …")도 허용.
  if (!nums.every((n, i) => n === startNum + i)) return null;
  // 첫 마커 앞에 본문이 있으면 일반 줄 — 자르지 않는다
  if (line.slice(0, hits[0].index).trim()) return null;
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
        _inBullet: false,
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
    //   여러 줄에 걸친 2열 조판("① … ② …" / "③ … ④ …")도 이어받는다.
    const inline = splitInlineChoices(line, current.choices.length + 1);
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
    //   ⚠ 활동지 불릿 항목도 제외한다. 활동지는 두 종류가 섞여 있다:
    //       (가) 불릿 항목의 trailing 이 ①~⑤  → 그 항목이 곧 선지다 (Q31 형)
    //       (나) 불릿 항목의 trailing 이 ⓐ~ⓔ  → 항목은 자료이고 선지는 별도 ①~⑤ (Q16 형)
    //     (나)를 억제하지 않으면 자료 항목이 선지로 삼켜진다(Q16 실측 3+5=8개).
    //     불릿과 trailing 마커가 서로 다른 줄에 있을 수 있어 상태로 추적한다.
    if (/^\s*[∙◦]/.test(line)) current._inBullet = true;
    const mRaw = line.match(TRAILING_CIRCLED_RE);
    const bulletNonNumber =
      current._inBullet &&
      mRaw &&
      !MARKER_SETS.circled_number.chars.includes(mRaw[2]);
    if (mRaw) current._inBullet = false;
    const mC =
      current._section === "bogi" || bulletNonNumber ? null : mRaw;
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
  // 활동지 케이스 병합 — fixtures/extractor_*.json 를 모두 읽는다
  for (const f of fs.readdirSync(path.join(dir, "fixtures"))
    .filter((x) => /^extractor_.*\.json$/.test(x) && x !== "extractor_marker_forms.json")) {
    fx.cases.push(...JSON.parse(fs.readFileSync(path.join(dir, "fixtures", f), "utf8")).cases);
  }
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
