// marker_context.mjs — 해설 생성 payload용 [마커 범위] 블록 빌더
//   결함: 해설 LLM이 sent.t의 마커 기호로 "시작점"만 알고 "끝점(밑줄 범위)·bracket·box"를
//   모른 채 추측 → 범위 밖 어구를 그 마커 내용으로 서술하는 오답 해설 발생.
//   조치: annotations.json(단일 소스)의 범위를 payload에 명시 주입. 하드코딩 0.
// 사용: import { buildMarkerBlock, markersInQuestion } from "./marker_context.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ANN_PATH = path.resolve(__dirname, "../public/data/annotations.json");
const DATA_PATH = path.resolve(__dirname, "../public/data/all_data_204.json");

let _ann = null;
function loadAnn() {
  if (_ann) return _ann;
  try {
    _ann = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));
  } catch {
    _ann = {};
  }
  return _ann;
}

// 마커 문자 집합: 원문자(㉠~ · ⓐ~ · ①~) + bracket 라벨 [A]~[F] · [가] 등 한글 1자
//   한글 bracket 라벨 실재: 2018수능 r2018b Q30 발문 "[가]의 ㉠～㉢과 하나씩 대응"
//   ([A-F] 한정 시 문항 참조 필터가 해당 bracket 범위를 통째 누락시킴)
const MARKER_RE = /[㉠-㉿]|[ⓐ-ⓩⒶ-Ⓩ]|\[[A-F가-힣]\]/g;

/**
 * bogi.type==='diagram' 문항의 items[].label = 이미지 라벨.
 * 지문 밑줄이 아니라 그림 자체를 가리키므로 밑줄 범위가 물리적으로 부재.
 * → 마커 참조에서 제외(범위 결손 오탐 차단). 의미는 bogi.description이 이미 전달.
 * 실증: r2025c Q13 (㉠=원본 이미지 · ㉡=확산 이미지 · ㉢=노이즈 이미지, 각 .png)
 */
function diagramLabels(q) {
  const b = q.bogi;
  if (!b || typeof b !== "object" || b.type !== "diagram") return [];
  return (b.items || []).map((it) => it.label).filter(Boolean);
}

/** 문항이 참조하는 마커 목록(발문+보기+선지 기준, diagram 이미지 라벨 제외) */
export function markersInQuestion(q) {
  const out = new Set();
  const scan = (s) => {
    for (const m of String(s || "").match(MARKER_RE) || []) out.add(m);
  };
  scan(q.t);
  scan(typeof q.bogi === "string" ? q.bogi : JSON.stringify(q.bogi || ""));
  for (const c of q.choices || []) scan(c.t);
  for (const label of diagramLabels(q)) out.delete(label);
  return [...out];
}

/**
 * 문항의 annotation 범위 블록 생성.
 * 산출 단위 = 문항(세트 아님). 세트 전체 마커를 누적하면 covered 분모가 부풀려짐.
 * @returns {{block: string, covered: string[], missing: string[], refs: string[]}}
 *   refs = 문항이 참조하는 마커 / covered = 그중 범위가 주입된 마커
 *   missing = 그중 범위 정보 없는 마커(빈칸 금지 → 명시). covered ⊆ refs 불변.
 */
export function buildMarkerBlock(yk, setId, q) {
  const ann = loadAnn();
  const list = (ann[yk] || {})[setId] || [];
  const refs = markersInQuestion(q);
  const refSet = new Set(refs);
  const lines = [];
  const covered = new Set();

  for (const o of list) {
    // qId 보유 레코드는 해당 문항에만 귀속(타 문항 유입 차단)
    if (o.qId !== undefined && String(o.qId) !== String(q.id)) continue;
    const isBogi = o.target === "bogi" || o.target === "choice";
    const tag = isBogi ? " (보기)" : "";
    if (o.type === "bracket") {
      const label = `[${o.label}]`;
      if (!refSet.has(label)) continue; // 문항 미참조 = 타 문항 소속
      lines.push(`  [bracket] ${label} = ${o.sentFrom}~${o.sentTo}${tag}`);
      covered.add(label);
    } else if (o.marker) {
      if (!refSet.has(o.marker)) continue; // 문항 미참조 = 타 문항 소속
      // marker 타입: 원문자 + 밑줄 범위 text
      lines.push(
        `  ${o.marker} = "${o.text ?? "(텍스트 없음)"}"${o.sentId ? ` (sentId: ${o.sentId})` : ""}${tag}`,
      );
      covered.add(o.marker);
    } else if (o.text) {
      // box / underline / blank-box (라벨 없음 = 문항 귀속 판정 불가 → 세트 맥락으로 유지)
      lines.push(
        `  [${o.type}] "${o.text}"${o.sentId ? ` (sentId: ${o.sentId})` : ""}${tag}`,
      );
    }
  }

  // 문항이 참조하나 범위 annotation이 없는 마커 = 범위 정보 없음(단정 금지 대상)
  const missing = refs.filter((m) => !covered.has(m));
  for (const m of missing) lines.push(`  ${m} = 범위 정보 없음`);

  const block = lines.length
    ? `[마커 범위 — 정본]\n${lines.join("\n")}`
    : `[마커 범위 — 정본]\n  (해당 문항에 마커 annotation 없음)`;
  return { block, covered: [...covered], missing, refs };
}

// ── CLI: 마커 범위 주입 커버리지 산출 (§13⑮ 분모 의무 — 모듈 자체 산출이 정본) ──
// 사용: node pipeline/marker_context.mjs [--yk=2025수능]
export function coverageReport(ykFilter) {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const stat = {
    sets: 0,
    questions: 0,
    refQuestions: 0,
    refMarkers: 0,
    missQuestions: 0,
    missMarkers: 0,
    diagramLabels: 0,
  };
  const gaps = [];
  for (const yk of Object.keys(data)) {
    if (ykFilter && yk !== ykFilter) continue;
    const groups = [
      ...(data[yk].reading || []),
      ...(data[yk].literature || []),
    ];
    for (const set of groups) {
      stat.sets++;
      for (const q of set.questions || []) {
        stat.questions++;
        stat.diagramLabels += diagramLabels(q).length;
        const { covered, missing, refs } = buildMarkerBlock(yk, set.id, q);
        if (!refs.length) continue;
        stat.refQuestions++;
        stat.refMarkers += refs.length;
        if (missing.length) {
          stat.missQuestions++;
          stat.missMarkers += missing.length;
          gaps.push(
            `${yk}::${set.id} Q${q.id} — 참조 ${refs.length} / 주입 ${covered.length} / 결손 ${missing.join(" ")}`,
          );
        }
      }
    }
  }
  return { stat, gaps };
}

function main() {
  const arg = process.argv.slice(2).find((a) => a.startsWith("--yk="));
  const ykFilter = arg ? arg.slice(5) : null;
  const { stat, gaps } = coverageReport(ykFilter);
  if (stat.sets === 0) {
    console.error(
      `SCOPE_EMPTY: 검사 대상 0 세트${ykFilter ? ` (--yk=${ykFilter} 미존재)` : ""}`,
    );
    process.exit(1);
  }
  console.log(
    `검사 스코프: 세트 ${stat.sets} / 문항 ${stat.questions}${ykFilter ? ` (yk=${ykFilter})` : " (전 코퍼스)"}`,
  );
  console.log(`diagram 이미지 라벨 제외: ${stat.diagramLabels}개`);
  console.log(
    `마커참조 문항 ${stat.refQuestions} (참조 마커 ${stat.refMarkers})`,
  );
  console.log(
    `  → 범위 결손 문항 ${stat.missQuestions} / 결손 마커 ${stat.missMarkers}`,
  );
  console.log(
    `  → 주입 마커 ${stat.refMarkers - stat.missMarkers} = ${stat.refMarkers ? ((1 - stat.missMarkers / stat.refMarkers) * 100).toFixed(1) : "0.0"}%`,
  );
  if (gaps.length) {
    console.log(`\n[결손 목록]`);
    for (const g of gaps) console.log(`  ${g}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();
