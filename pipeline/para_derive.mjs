// para_derive.mjs — 독서 문단(para) 자동 도출 (들여쓰기 기반, dry-run 제안)
//   원천: _done/{yk}/{yk}_시험지.pdf → pdftotext -layout -enc UTF-8 (한글+들여쓰기 보존).
//   방법(§2): 원문을 "연속 passage concat"으로 재구성(행 래핑 넘어 앵커) + 행별 들여쓰기 기록.
//     all_data body 문장을 concat에 앵커 → 그 문장이 "행 시작 + 들여쓰기≥임계"면 문단 시작.
//   ⚠ 감으로 경계 확정 금지 — §3 양성회귀(known-good 독서 3세트 재현) 통과 전엔 신뢰 불가.
//   all_data 무변경. 산출은 pipeline/output/para_fix/ 사이드카.
// 사용:
//   node pipeline/para_derive.mjs --gate
//   node pipeline/para_derive.mjs --yk=2025_9월 --set=r20259d
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "pipeline/output/para_fix/_raw");
const DATA_PATH = path.join(ROOT, "data-source/all_data_204.json");

// 매칭용 정규화: 마커(㉠ⓐ①[A])·공백 제거 → pdftotext 마커 렌더 편차로 인한 앵커 실패 축소.
const MARK_RE = /[ⓐ-ⓩⒶ-Ⓩ㉠-㉯①-⑳]|\[[A-E]\]/g;
const norm = (s) =>
  String(s || "")
    .replace(MARK_RE, "")
    .replace(/\s+/g, "");
// 행 선두 들여쓰기 폭: 반각공백 1, 전각공백(U+3000) 2, 탭 4.
function leadIndent(line) {
  let w = 0;
  for (const ch of line) {
    if (ch === " ") w += 1;
    else if (ch === "　") w += 2;
    else if (ch === "\t") w += 4;
    else break;
  }
  return w;
}

function rawtextFor(yk) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const cache = path.join(RAW_DIR, `${yk}.txt`);
  if (fs.existsSync(cache)) return fs.readFileSync(cache, "utf8");
  const pdf = path.join(ROOT, `_done/${yk}/${yk}_시험지.pdf`);
  if (!fs.existsSync(pdf)) throw new Error(`PDF 없음: ${pdf}`);
  const txt = execSync(`pdftotext -layout -enc UTF-8 "${pdf}" -`, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"], // 폰트 Syntax Error(stderr) 무시
  });
  // 한글 어절이 거의 없으면 폰트 추출 실패(Adobe-Korea1 CMap 등)
  const hangul = (txt.match(/[가-힣]/g) || []).length;
  if (hangul < 500)
    throw new Error(
      `PDF 한글 추출 실패(폰트 CMap 부재 의심, 한글 ${hangul}자) — manual 큐`,
    );
  fs.writeFileSync(cache, txt, "utf8");
  return txt;
}

// 원문 → 연속 passage concat + 행별 시작오프셋/들여쓰기.
function buildConcat(rawLines) {
  const segs = []; // {startOff, len, indent}
  let concat = "";
  for (const line of rawLines) {
    const left = line.replace(/\s{8,}.*$/, ""); // 우측단(2단 편집 우열/선지) 제거
    const content = norm(left);
    if (content.length < 5) continue; // 페이지번호·짧은 헤더 노이즈 skip
    if (/^\d+$/.test(content)) continue;
    segs.push({
      startOff: concat.length,
      len: content.length,
      indent: leadIndent(left),
    });
    concat += content;
  }
  return { concat, segs };
}

const segIdxAt = (cc, off) => {
  for (let i = 0; i < cc.segs.length; i++) {
    const s = cc.segs[i];
    if (off >= s.startOff && off < s.startOff + s.len) return i;
  }
  return -1;
};
// 문장 시작 offset이 속한 seg + 행시작 여부 + 들여쓰기 + segIdx. 긴 접두부터(유일성↑) fallback.
function anchorSent(sentText, cc) {
  const full = norm(sentText);
  for (const L of [30, 22, 14]) {
    const key = full.slice(0, L);
    if (key.length < 10) continue;
    const off = cc.concat.indexOf(key);
    if (off < 0) continue;
    if (cc.concat.indexOf(key, off + 1) >= 0) continue; // 비유일 → 더 짧은 접두 skip
    const idx = segIdxAt(cc, off);
    if (idx < 0) continue;
    const seg = cc.segs[idx];
    return {
      off,
      atLineStart: off === seg.startOff,
      indent: seg.indent,
      segIdx: idx,
    };
  }
  return null;
}

function derivePara(yk, setId) {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const secs = data[yk] || {};
  let set = null;
  for (const sec of ["reading", "literature"])
    for (const s of secs[sec] || []) if ((s.setId || s.id) === setId) set = s;
  if (!set) throw new Error(`세트 없음: ${yk}::${setId}`);
  const body = (set.sents || []).filter((x) => x.sentType === "body");

  const cc = buildConcat(rawtextFor(yk).split(/\r?\n/));
  const anchors = body.map((sn) => ({ sn, a: anchorSent(sn.t, cc) }));

  // 임계 = "문단 들여쓰기" = 첫 문장(무조건 para1 시작)이 앵커된 행의 들여쓰기.
  //   문단시작 = 행시작 + 들여쓰기 ≥ 문단들여쓰기. 연속행(더 작은 들여쓰기)은 제외.
  const lineStarts = anchors.filter((x) => x.a && x.a.atLineStart);
  const paraIndent = lineStarts.length ? lineStarts[0].a.indent : Infinity;
  const threshold = paraIndent;
  const baseline = Math.min(...lineStarts.map((x) => x.a.indent), paraIndent);
  // 연속행(문단들여쓰기보다 작은 들여쓰기의 행시작)이 존재해야 문단 구분 신호 유효.
  const hasSignal = lineStarts.some((x) => x.a.indent < paraIndent);
  // [열넘김 휴리스틱] 진짜 문단시작은 "직전 행이 우측여백 전에 짧게 끝남"(단 최대행폭의 <85%).
  //   직전 행이 꽉 참 → 열/페이지 래핑으로 들여쓰기된 것이므로 문단시작 부정(false-start 제거).
  const widths = cc.segs.map((s) => s.len);
  const maxWidth = widths.length ? Math.max(...widths) : 0;
  const prevShort = (segIdx) => {
    // 직전 비어있지 않은 passage seg의 폭이 최대행폭의 85% 미만이면 "짧게 끝남".
    for (let j = segIdx - 1; j >= 0; j--) {
      const w = cc.segs[j].len;
      if (w <= 0) continue;
      return w < 0.85 * maxWidth;
    }
    return true; // 직전 행 없음(passage 첫 행) = 문단시작 허용
  };

  const out = [];
  let cur = 0,
    ambiguous = 0,
    falseStartSuppressed = 0;
  for (let i = 0; i < anchors.length; i++) {
    const { sn, a } = anchors[i];
    if (!a) {
      out.push({
        sentId: sn.id,
        para: null,
        para_start: false,
        source_off: -1,
        flag: "ambiguous_no_anchor",
      });
      ambiguous++;
      continue;
    }
    const indentStart = a.atLineStart && a.indent >= threshold;
    // 들여쓰기는 됐으나 직전 행이 꽉 참 = 열/페이지 래핑 → 문단시작 부정.
    const short = prevShort(a.segIdx);
    if (i > 0 && indentStart && !short) falseStartSuppressed++;
    const isStart = i === 0 || (indentStart && short);
    if (isStart) cur += 1;
    // confidence: 문단시작(들여쓰기+짧은직전)=high, 연속=mid, 앵커실패=flag(별도).
    const confidence = isStart ? "high" : "mid";
    out.push({
      sentId: sn.id,
      para: cur,
      para_start: isStart,
      confidence,
      source_off: a.off,
      indent: a.indent,
    });
  }
  return {
    setId,
    body_total: body.length,
    assigned: out.filter((x) => x.para !== null).length,
    ambiguous,
    false_start_suppressed: falseStartSuppressed,
    hasSignal,
    baseline,
    threshold,
    out,
    existing: body.map((s) => s.para ?? null),
  };
}

// ── CLI ──
const args = process.argv.slice(2);
const opt = (k) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=").slice(1).join("=") : null;
};
const OUT_FIX = path.join(ROOT, "pipeline/output/para_fix");

if (args.includes("--gate")) {
  const GATE = [
    ["2026수능", "r2026a"],
    ["2026_6월", "r20266a"],
    ["2023수능", "r2023a"],
  ];
  const results = [];
  for (const [yk, sid] of GATE) {
    try {
      const r = derivePara(yk, sid);
      // 경계 재현 대조 — 앵커된 문장만(null 제외). 직전 앵커 문장과의 para 증가 여부로 boundary 판정.
      //   (para 번호 자체는 false-start 하나로 이후가 통째 shift → cascade 오계수 방지.)
      let falseStart = 0,
        missedStart = 0,
        anchoredMismatch = 0;
      let prevExisting = null,
        prevDerived = null;
      for (let i = 0; i < r.out.length; i++) {
        if (r.out[i].para === null) continue; // 앵커실패(null)는 아래 별도 카운트
        const ex = r.existing[i];
        const de = r.out[i].para;
        if (prevExisting !== null) {
          const exBoundary = ex !== prevExisting;
          const deBoundary = de !== prevDerived;
          if (deBoundary && !exBoundary) falseStart++;
          if (!deBoundary && exBoundary) missedStart++;
          if (deBoundary !== exBoundary) anchoredMismatch++;
        }
        prevExisting = ex;
        prevDerived = de;
      }
      const ok = anchoredMismatch === 0 && falseStart <= 1;
      results.push({
        set: `${yk}::${sid}`,
        body: r.body_total,
        anchored_mismatch: anchoredMismatch,
        false_start: falseStart,
        missed_start: missedStart,
        anchor_fail: r.ambiguous,
        draft_ok: ok,
      });
      console.log(
        `■ ${yk}::${sid}: body ${r.body_total} · 앵커불일치 ${anchoredMismatch}(false-start ${falseStart}·missed ${missedStart}) · 앵커실패 ${r.ambiguous} (thr ${r.threshold}) → ${ok ? "초안허가 ✓" : "미충족 ✗"}`,
      );
      if (!ok) {
        console.log(
          `   derived : ${r.out.map((x) => x.para ?? "·").join(",")}`,
        );
        console.log(`   existing: ${r.existing.join(",")}`);
      }
    } catch (e) {
      results.push({ set: `${yk}::${sid}`, error: e.message });
      console.log(`■ ${yk}::${sid}: 오류 ${e.message}`);
    }
  }
  const pass = results.filter((r) => r.draft_ok).length;
  console.log(
    `\n§3 초안 허가 게이트(앵커불일치 0 AND false-start ≤1/세트): ${pass}/3 ${pass === 3 ? "→ PASS (15세트 초안 생성 가능)" : "→ FAIL (규칙 보정, 초안 생성 금지)"}`,
  );
  fs.mkdirSync(OUT_FIX, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_FIX, "_positive_regression.json"),
    JSON.stringify(results, null, 2),
    "utf8",
  );
} else {
  const yk = opt("yk"),
    sid = opt("set");
  if (!yk || !sid) {
    console.error("사용: --gate  또는  --yk=<yk> --set=<setId>");
    process.exit(1);
  }
  const r = derivePara(yk, sid);
  console.log(
    `${yk}::${sid}: body ${r.body_total} · assigned ${r.assigned} · ambiguous ${r.ambiguous} · base ${r.baseline}/thr ${r.threshold}`,
  );
  console.log(`derived para: ${r.out.map((x) => x.para ?? "·").join(",")}`);
}
