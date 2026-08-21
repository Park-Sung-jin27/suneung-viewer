// choice_source_diff.mjs — 선지 원문(시험지 PDF) ↔ DB 자동 대조기 (발주 p ①)
//
// 목적: 선지에 박힌 마커 기호(㉠~㉭)가 원본 시험지와 다른지 전수 검출한다.
//   해설은 선지를 인용해 논증하므로, 선지 기호가 오염되면 그 위에 쓴 해설이 전부 폐기 대상이 된다.
//   휴리스틱(조사 이상·첫기호 다양성)은 오탐이 압도적이라 금지 — 원본 PDF 대조만 유효(발주 p).
//
// 읽기 전용: all_data_204.json 기록 절대 금지. 산출은 output JSON 1개.
//
// 사용: node pipeline/choice_source_diff.mjs --yk=2024_9월        (파일럿)
//       node pipeline/choice_source_diff.mjs --all               (전수, 심사관 승인 후)
//
// [추출 모드] pdftotext -raw 를 1차로 쓴다.
//   발주 사양은 -layout 이었으나, 그 근거인 "좌우 단이 한 줄에 섞여 나온다"가 -raw 에서는
//   발생하지 않는다(2024_9월 실측: -layout 은 좌단 본문+우단 선지가 한 줄, -raw 는 선지가 연속 3줄).
//   -raw 로 스켈레톤을 못 찾으면 -layout 으로 자동 폴백해 양쪽 다 시도한다.
//   ⚠ pdftotext 는 poppler/Xpdf 두 구현이 있고 같은 PDF에서 다른 출력을 낸다(§도구명≠구현).
//      산출 JSON 에 extractor 버전을 기록한다.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync, execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public/data/all_data_204.json");

const args = process.argv.slice(2);
const ykArg = (args.find((a) => a.startsWith("--yk=")) || "").split("=")[1];
const ALL = args.includes("--all");
const EXPANDED = args.includes("--expanded"); // 발주 s ①: 스코프 확대 + 2세트 분리
const OUT_PATH = path.join(
  __dirname,
  EXPANDED
    ? "output/_choice_symbol_diff_expanded.json"
    : "output/_choice_symbol_diff.json",
);
if (!ykArg && !ALL) {
  console.error(
    "사용: node pipeline/choice_source_diff.mjs --yk=<yearKey> | --all",
  );
  process.exit(2);
}

// 마커 기호 + 그 직후 조사(발주 사양: 은/는/이/가/을/를/와/과/의).
//   이 두 글자가 탐지 대상이므로 정규화하지 않고 캡처해 비교한다.
// [발주 r ①] 범위를 원문자 전 계열로 확대 — ⓐ↔㉠ 계열 상이가 구조적 사각이었다
//   (2025_9월 r20259b Q5: 한 문항에 ⓐ/㉠/㉡ 3계열 혼재, 5선지 중 1건만 검출).
const SYM_CLASS = "㉠-㉭ⓐ-ⓩ①-⑳Ⓐ-Ⓩ";
const SYM = new RegExp(`[${SYM_CLASS}][은는이가을를와과의]?`, "g");

// 기호의 계열(family) — 계열이 다르면 조사와 무관하게 치명(발주 r ①).
function family(ch) {
  const c = ch.codePointAt(0);
  if (c >= 0x3220 && c <= 0x3243) return "㉠"; // ㉠-㉭ 괄호한글
  if (c >= 0x24d0 && c <= 0x24e9) return "ⓐ"; // ⓐ-ⓩ 원문자 소문자
  if (c >= 0x24b6 && c <= 0x24cf) return "Ⓐ"; // Ⓐ-Ⓩ 원문자 대문자
  if (c >= 0x2460 && c <= 0x2473) return "①"; // ①-⑳ 원숫자
  return "?";
}

// 정규화(발주 d + r ①): 공백·줄바꿈 제거, 따옴표·괄호 이형 통일, 전각/반각 공백 통일.
//   기호·조사는 여기 들어오지 않는다(캡처 대상).
const norm = (s) =>
  String(s || "")
    .replace(/[“”„‟＂]/g, '"')
    .replace(/[‘’‚‛＇]/g, "'")
    .replace(/[｢「]/g, "「")
    .replace(/[｣」]/g, "」")
    .replace(/[『｢]/g, "『")
    .replace(/[』｣]/g, "』")
    .replace(/[ 　 -​]/g, "")
    .replace(/\s+/g, "");

// [발주 r ①] 텍스트 레이어 사망 연도 — 심사관 49개년 전수 실측 확정(본문 17자/4자).
//   결함 후보가 아니라 커버리지 공백이므로 별도 버킷으로 뺀다.
const NO_TEXT_LAYER = new Set(["2014수능A", "2014수능B"]);

// 선지에 기호가 있는지 검사용(비-global — global은 lastIndex가 남아 오판한다).
const HAS_SYM = new RegExp(`[${SYM_CLASS}]`);
// [발주 s ①] 스코프 확대 + 분모 이원화.
//   set_A_legacy269 : 발문에 ㉠-㉭ 포함(기존 269) — 회귀 비교용, 동결.
//   set_B_expanded  : 발문이 신규 계열(ⓐ/①/Ⓐ)만 — 한 번도 대조된 적 없는 122문항.
//   ★ 두 세트를 합산하지 말 것(발주 s). 각각 5버킷을 따로 낸다.
const HAS_Q_SYM = EXPANDED ? new RegExp(`[${SYM_CLASS}]`) : /[㉠-㉭]/; // --expanded 시에만 확대
const LEGACY_Q_SYM = /[㉠-㉭]/; // 세트 판별: 참이면 A(legacy269), 거짓이면 B(expanded)
const setOf = (qt) => (LEGACY_Q_SYM.test(qt || "") ? "A" : "B");

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function extractorLabel() {
  try {
    execSync("pdftotext -v", { stdio: ["ignore", "pipe", "pipe"] });
    return "pdftotext (unknown)";
  } catch (e) {
    const first = ((e && e.stderr) || "")
      .toString()
      .split("\n")
      .map((x) => x.trim())
      .find(Boolean);
    return first && !/not recognized|not found/i.test(first)
      ? `pdftotext (${first})`
      : "PyMuPDF fallback";
  }
}

const fitzCache = new Map();

function fitzText(pdfPath) {
  if (fitzCache.has(pdfPath)) return fitzCache.get(pdfPath);
  try {
    const text = execFileSync(
      "python3",
      [
        "-X",
        "utf8",
        "-c",
        "import fitz,sys; d=fitz.open(sys.argv[1]); sys.stdout.write('\\n'.join(p.get_text('text', sort=False) for p in d))",
        pdfPath,
      ],
      {
        maxBuffer: 2e8,
        env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
      },
    ).toString();
    fitzCache.set(pdfPath, text);
    return text;
  } catch {
    fitzCache.set(pdfPath, null);
    return null;
  }
}

function pdfText(yk, mode) {
  for (const dir of [`_done/${yk}`, `_done/${yk}A`, `_done/${yk}B`]) {
    const d = path.join(ROOT, dir);
    if (!fs.existsSync(d)) continue;
    const hit = fs.readdirSync(d).find((x) => x.endsWith("시험지.pdf"));
    if (!hit) continue;
    const pdfPath = path.join(d, hit);
    try {
      return execSync(`pdftotext ${mode} -enc UTF-8 "${pdfPath}" -`, {
        maxBuffer: 2e8,
        stdio: ["ignore", "pipe", "ignore"],
      }).toString();
    } catch {
      return fitzText(pdfPath);
    }
  }
  return null;
}

// DB 선지 텍스트 → {segments, symbols}
//   "㉠는 경제적…이고, ㉡은 이러한…" → segments ["", "경제적…이고,", "이러한…"], symbols ["㉠는","㉡은"]
function split(text) {
  const symbols = String(text || "").match(SYM) || [];
  const segments = String(text || "")
    .split(SYM)
    .map(norm);
  return { symbols, segments };
}

// 정규화된 PDF 전문에서 이 선지의 기호열을 찾아 돌려준다(없으면 null).
//   기호 자리를 와일드카드로 둔 정규식으로 매칭 → 캡처된 것이 PDF 원문의 기호.
//   반환: {status, symbols?} — status = ok | no_symbol | anchor_short | text_mismatch
//   ★ 실패를 한 버킷에 뭉치면 "커버리지 공백"과 "본문 오염 결함"이 구분되지 않는다(발주 q ①-a).
//     본문(segments)이 오염되면 정규식이 안 맞아 실패로 떨어지는데, 그건 결함 후보이지 미검사가 아니다.
function findPdfSymbols(segments, normPdf) {
  if (segments.length < 2) return { status: "no_symbol" };
  // 앵커: 가장 긴 세그먼트가 충분히 길어야 오매칭이 안 난다.
  const longest = Math.max(...segments.map((s) => s.length));
  if (longest < 12) return { status: "anchor_short" };
  const pat = segments.map(reEsc).join(`([${SYM_CLASS}][은는이가을를와과의]?)`);
  const m = new RegExp(pat).exec(normPdf);
  if (m) return { status: "ok", symbols: m.slice(1) };
  return { status: "text_mismatch" }; // PDF 있고 앵커 충분한데 불일치 = 본문 오염 의심
}

// 본문_불일치_의심 선지의 PDF 측 유사 후보를 찾는다(발주 q ①-b).
//   가장 긴 세그먼트의 앞 20자를 앵커로 재검색해, 그 지점 주변 원문을 돌려준다.
function nearestPdfCandidate(segments, normPdf, wantLen) {
  const longest = segments.reduce((a, b) => (b.length > a.length ? b : a), "");
  for (const anchorLen of [20, 14, 10]) {
    if (longest.length < anchorLen) continue;
    const anchor = longest.slice(0, anchorLen);
    const at = normPdf.indexOf(anchor);
    if (at >= 0) {
      const start = Math.max(0, at - 30);
      return {
        anchor,
        anchor_len: anchorLen,
        pdf_excerpt: normPdf.slice(start, start + (wantLen || 160) + 30),
      };
    }
  }
  return { anchor: null, anchor_len: 0, pdf_excerpt: null };
}

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const years = ALL ? Object.keys(data) : [ykArg];

const findings = [];
const textMismatches = []; // ★ 결함 후보(커버리지 공백 아님)
// [발주 u ①] 문항별 **전 선지** 기호 매핑(diff 유무 무관) — 항등쌍 포함 단사성 판정 입력.
//   diff쌍만으로 단사성을 보면 항등쌍이 빠져 충돌을 놓친다(r20259b Q5 실증: D2로 오판).
//   항등쌍(DB기호 == PDF기호)도 "이 DB기호는 이 PDF기호를 가리킨다"는 지시 관계를 규정한다.
const qSymbolMaps = {};
// 세트별 5버킷(발주 s ①) — 합산 금지.
const mkBucket = () => ({
  대조대상문항: 0,
  기호없음문항: 0,
  성공문항: 0,
  불일치문항: 0,
  불일치선지: 0,
  치명_계열상이: 0,
  치명_기호상이: 0,
  경미_조사만: 0,
  앵커부족선지: 0,
  본문불일치의심선지: 0,
  본문텍스트없음선지: 0,
  PDF없음선지: 0,
});
const SET = { A: mkBucket(), B: mkBucket() };
let qScanned = 0,
  qNoSymbol = 0,
  qMatched = 0,
  qMismatch = 0,
  cMismatch = 0;
let cAnchorShort = 0,
  cTextMismatch = 0,
  cNoPdf = 0,
  cNoTextLayer = 0,
  cFamily = 0,
  cSymbol = 0,
  cJosa = 0;
const extractor = extractorLabel();
const modeUsed = {};
const perYear = {}; // 연도별 표(발주 q ①-c)
const noPdfYears = [];

for (const yk of years) {
  if (!data[yk]) {
    console.warn(`⚠️  ${yk} 없음`);
    continue;
  }
  const py = (perYear[yk] = {
    대조대상: 0,
    기호없음: 0,
    성공: 0,
    앵커부족: 0,
    본문불일치의심: 0,
    불일치문항: 0,
    불일치선지: 0,
    raw: 0,
    layout: 0,
  });
  if (NO_TEXT_LAYER.has(yk)) {
    // 본문텍스트없음(발주 r ① 4번째 버킷) — image-only. 결함 후보 아님.
    for (const sec of ["reading", "literature"])
      for (const set of data[yk][sec] || [])
        for (const q of set.questions || [])
          if (HAS_Q_SYM.test(q.t || "")) {
            const B = SET[setOf(q.t)];
            qScanned++;
            py.대조대상++;
            B.대조대상문항++;
            for (const c of q.choices || [])
              if (HAS_SYM.test(c.t || "")) {
                cNoTextLayer++;
                B.본문텍스트없음선지++;
              }
          }
    py.본문텍스트없음 = true;
    console.warn(`⚠️  ${yk} 본문 텍스트 레이어 없음(image-only) — 대조 불가`);
    continue;
  }
  const rawText = pdfText(yk, "-raw");
  const layoutText = pdfText(yk, "-layout");
  if (!rawText && !layoutText) {
    // PDF_없음 — 커버리지 공백(결함 아님). 해당 연도 대조대상 전량을 이 버킷에 귀속.
    noPdfYears.push(yk);
    for (const sec of ["reading", "literature"])
      for (const set of data[yk][sec] || [])
        for (const q of set.questions || [])
          if (HAS_Q_SYM.test(q.t || "")) {
            const B = SET[setOf(q.t)];
            qScanned++;
            py.대조대상++;
            B.대조대상문항++;
            for (const c of q.choices || [])
              if (HAS_SYM.test(c.t || "")) {
                cNoPdf++;
                B.PDF없음선지++;
              }
          }
    py.PDF없음 = true;
    console.warn(`⚠️  ${yk} 시험지 PDF 없음/추출불가`);
    continue;
  }
  const normRaw = norm(rawText || "");
  const normLayout = norm(layoutText || "");

  for (const sec of ["reading", "literature"]) {
    for (const set of data[yk][sec] || []) {
      for (const q of set.questions || []) {
        // 발문에 마커가 있는 문항만(발주 c)
        if (!HAS_Q_SYM.test(q.t || "")) continue;
        qScanned++;
        py.대조대상++;
        const SB = SET[setOf(q.t)]; // 이 문항이 속한 세트(A=legacy269 / B=expanded)
        SB.대조대상문항++;
        let anyMatched = false,
          qHasMismatch = false,
          symBearing = 0; // 기호를 가진 선지 수(0이면 대조 대상 아님 — 추출 실패와 구분)
        for (const c of q.choices || []) {
          const { symbols, segments } = split(c.t);
          if (!symbols.length) continue; // 이 선지엔 기호 없음
          symBearing++;
          let r = findPdfSymbols(segments, normRaw);
          let mode = "-raw";
          if (r.status !== "ok") {
            const r2 = findPdfSymbols(segments, normLayout);
            if (r2.status === "ok") {
              r = r2;
              mode = "-layout";
            }
          }
          if (r.status === "anchor_short") {
            cAnchorShort++;
            py.앵커부족++;
            SB.앵커부족선지++;
            continue;
          }
          if (r.status === "text_mismatch") {
            // ★ 결함 후보 — PDF 있고 앵커 충분한데 본문이 안 맞는다(발주 q ①-b)
            cTextMismatch++;
            py.본문불일치의심++;
            SB.본문불일치의심선지++;
            const cand = nearestPdfCandidate(
              segments,
              normRaw,
              norm(c.t).length,
            );
            textMismatches.push({
              set: setOf(q.t),
              yearKey: yk,
              setId: set.id,
              qId: q.id,
              num: c.num,
              db_text: c.t,
              db_symbols: symbols,
              ...cand,
            });
            continue;
          }
          if (r.status !== "ok") continue;
          const pdfSyms = r.symbols;
          anyMatched = true;
          {
            // 전 선지 매핑 기록(발주 u ①) — diff 없는 선지도 항등쌍으로 남긴다.
            const mk = `${setOf(q.t)}|${yk}|${set.id}|${q.id}`;
            (qSymbolMaps[mk] = qSymbolMaps[mk] || []).push({
              num: c.num,
              db: symbols,
              pdf: pdfSyms,
            });
          }
          modeUsed[mode] = (modeUsed[mode] || 0) + 1;
          if (mode === "-raw") py.raw++;
          else py.layout++;
          const diffs = [];
          for (let i = 0; i < symbols.length; i++) {
            if (symbols[i] === pdfSyms[i]) continue;
            // 심각도 3분: 계열상이 > 기호상이 > 조사만(경미)
            const dbF = family(symbols[i][0]);
            const pdfF = family(pdfSyms[i][0]);
            const sev =
              dbF !== pdfF
                ? "계열상이"
                : symbols[i][0] !== pdfSyms[i][0]
                  ? "기호상이"
                  : "조사만";
            if (sev === "계열상이") {
              cFamily++;
              SB.치명_계열상이++;
            } else if (sev === "기호상이") {
              cSymbol++;
              SB.치명_기호상이++;
            } else {
              cJosa++;
              SB.경미_조사만++;
            }
            diffs.push({ pos: i, db: symbols[i], pdf: pdfSyms[i], sev });
          }
          if (diffs.length) {
            qHasMismatch = true;
            cMismatch++;
            py.불일치선지++;
            SB.불일치선지++;
            findings.push({
              set: setOf(q.t),
              yearKey: yk,
              setId: set.id,
              qId: q.id,
              num: c.num,
              db_text: c.t,
              pdf_symbols: pdfSyms,
              db_symbols: symbols,
              diffs,
              mode,
            });
          }
        }
        // "선지에 기호 없음"(대조 불요)을 실패로 세면 커버리지 공백으로 오독된다
        // (2024_9월 r20249a Q2 실증).
        if (symBearing === 0) {
          qNoSymbol++;
          py.기호없음++;
          SB.기호없음문항++;
        } else if (anyMatched) {
          qMatched++;
          py.성공++;
          SB.성공문항++;
        }
        if (qHasMismatch) {
          qMismatch++;
          py.불일치문항++;
          SB.불일치문항++;
        }
      }
    }
  }
}

const summary = {
  extractor,
  scope: ALL ? "all" : ykArg,
  mode_used: modeUsed,
  대조_대상_문항: qScanned,
  선지에_기호없음_대조불요: qNoSymbol,
  대조_성공_문항: qMatched,
  불일치_문항: qMismatch,
  불일치_선지: cMismatch,
  // 심각도 3분(발주 r ①) — 치명(계열상이+기호상이) vs 경미(조사만)
  치명_계열상이_곳: cFamily,
  치명_기호상이_곳: cSymbol,
  경미_조사만_곳: cJosa,
  // 실패 4갈래(발주 q ①-a + r ①) — 커버리지 공백 vs 결함 후보를 분리한다.
  실패_PDF없음_선지: cNoPdf,
  실패_앵커부족_선지: cAnchorShort,
  "★본문불일치의심_선지(결함후보)": cTextMismatch,
  실패_본문텍스트없음_선지: cNoTextLayer,
  // ★ 발주 s ①: 합산 금지. 세트별로 따로 읽을 것.
  set_A_legacy269: SET.A,
  set_B_expanded: SET.B,
  PDF없음_연도: noPdfYears,
  본문텍스트없음_연도: [...NO_TEXT_LAYER],
};
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(
  OUT_PATH,
  JSON.stringify(
    {
      summary,
      set_A_legacy269: SET.A,
      set_B_expanded: SET.B,
      per_year: perYear,
      findings,
      text_mismatches: textMismatches,
      q_symbol_maps: qSymbolMaps,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(JSON.stringify(summary, null, 2));
if (ALL) {
  console.log("\n=== 연도별 표 ===");
  console.log(
    "yearKey        대상 기호없음 성공 앵커부족 ★본문불일치 불일치문항 불일치선지 raw/layout",
  );
  for (const [yk, p] of Object.entries(perYear)) {
    if (!p.대조대상) continue;
    console.log(
      `${yk.padEnd(14)} ${String(p.대조대상).padStart(4)} ${String(p.기호없음).padStart(8)} ${String(p.성공).padStart(4)} ${String(p.앵커부족).padStart(8)} ${String(p.본문불일치의심).padStart(10)} ${String(p.불일치문항).padStart(10)} ${String(p.불일치선지).padStart(10)}  ${p.raw}/${p.layout}${p.PDF없음 ? "  [PDF없음]" : ""}`,
    );
  }
}
console.log(`\n=== 불일치 선지 ${findings.length}건 ===`);
for (const f of findings) {
  console.log(`${f.yearKey} ${f.setId} Q${f.qId}-${f.num} [${f.mode}]`);
  for (const d of f.diffs)
    console.log(`    pos${d.pos}: DB "${d.db}" → PDF "${d.pdf}"`);
}
console.log(`\n📄 ${path.relative(ROOT, OUT_PATH)}`);
