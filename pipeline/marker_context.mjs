// marker_context.mjs — 해설 생성 payload용 [마커 범위] 블록 빌더
//   결함: 해설 LLM이 sent.t의 마커 기호로 "시작점"만 알고 "끝점(밑줄 범위)·bracket·box"를
//   모른 채 추측 → 범위 밖 어구를 그 마커 내용으로 서술하는 오답 해설 발생.
//   조치: annotations.json(단일 소스)의 범위를 payload에 명시 주입. 하드코딩 0.
// 사용: import { buildMarkerBlock, markersInQuestion } from "./marker_context.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANN_PATH = path.resolve(__dirname, "../public/data/annotations.json");

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

// 마커 문자 집합: 원문자(㉠~ · ⓐ~ · ①~) + [A]~[F] bracket 라벨
const MARKER_RE = /[㉠-㉿]|[ⓐ-ⓩⒶ-Ⓩ]|\[[A-F]\]/g;

/** 문항이 참조하는 마커 목록(발문+선지 기준, 선지번호 ①~⑤ 제외) */
export function markersInQuestion(q) {
  const out = new Set();
  const scan = (s) => {
    for (const m of String(s || "").match(MARKER_RE) || []) out.add(m);
  };
  scan(q.t);
  scan(typeof q.bogi === "string" ? q.bogi : JSON.stringify(q.bogi || ""));
  for (const c of q.choices || []) scan(c.t);
  return [...out];
}

/**
 * 세트의 annotation 범위 블록 생성.
 * @returns {{block: string, covered: string[], missing: string[]}}
 *   covered = 범위가 주입된 마커 / missing = 범위 정보 없는 마커(빈칸 금지 → 명시)
 */
export function buildMarkerBlock(yk, setId, q) {
  const ann = loadAnn();
  const list = (ann[yk] || {})[setId] || [];
  const refs = markersInQuestion(q);
  const lines = [];
  const covered = new Set();

  for (const o of list) {
    const isBogi = o.target === "bogi" || o.target === "choice";
    const tag = isBogi ? " (보기)" : "";
    if (o.type === "bracket") {
      const label = `[${o.label}]`;
      lines.push(`  [bracket] ${label} = ${o.sentFrom}~${o.sentTo}${tag}`);
      covered.add(label);
    } else if (o.marker) {
      // marker 타입: 원문자 + 밑줄 범위 text
      lines.push(
        `  ${o.marker} = "${o.text ?? "(텍스트 없음)"}"${o.sentId ? ` (sentId: ${o.sentId})` : ""}${tag}`,
      );
      covered.add(o.marker);
    } else if (o.text) {
      // box / underline / blank-box (마커 라벨 없음)
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
  return { block, covered: [...covered], missing };
}
