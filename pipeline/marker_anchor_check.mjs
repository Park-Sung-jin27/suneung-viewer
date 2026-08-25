// marker_anchor_check.mjs — 마커 정합성 축 (발주 D-92 ①)
//
// 왜 필요한가
//   선지·발문이 ㉠·ⓐ·[A] 같은 마커를 가리키는데, 그 마커가 지문(sents)에도
//   보기(bogi)에도 없으면 학생은 무엇을 말하는지 알 수 없다.
//   2016_9월A 에서 실증: 코덱스가 Q40 의 bogi(학습활동 상자)를 빠뜨려
//   선지의 ㉠~㉤ 이 정박할 곳이 없었고, step3 가 세트를 통째로 skip 했다.
//   delegation_verify 의 앵커 대조는 이걸 못 잡는다 — hard() 가 마커를 지우기 때문이다.
//
// 🔴 부분 미정박도 실패다.
//   step3 는 「전부 없을 때」만 skip 한다. 절반만 없으면 조용히 통과해 화면에 나간다.
//
// 마커 종류
//   ㉠~㉭ (원문자 한글)   ⓐ~ⓩ (원문자 라틴)   [A]~[Z] (대괄호 구간 표시)
//   ①~⑤ 는 선지 번호라 제외한다.
//
// 사용: import { checkMarkerAnchors } from "./marker_anchor_check.mjs"
//       node pipeline/marker_anchor_check.mjs <yearKey>   ← 단독 점검
// 금지: 데이터 수정. (읽기 전용이다)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const KINDS = [
  { name: "㉠류", re: /[㉠-㉭]/g },
  { name: "ⓐ류", re: /[ⓐ-ⓩ]/g },
  { name: "[A]류", re: /\[([A-Z])\]/g },
];

const grab = (s, kind) => new Set(String(s || "").match(kind.re) || []);

/**
 * 세트 하나의 마커 정합성.
 * @returns [{qid, kind, missing:[...], refIn, anchorIn}]
 */
// bogi 는 문자열일 때도, 객체(표·이미지 등)일 때도 있다.
// String() 으로 뭉개면 "[object Object]" 가 되어 안에 든 마커를 통째로 놓친다(실증).
const flat = (v) => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(flat).join("\n");
  if (typeof v === "object") return Object.values(v).map(flat).join("\n");
  return String(v);
};

export function checkSetMarkers(set) {
  // 정박처 ① 지문 문장  ② 문항의 보기  ③ annotations
  //   🔴 [A] 는 sents 텍스트가 아니라 annotations 의 {type:"bracket", label:"A"} 로 표시된다.
  //      이걸 빼면 정상 데이터가 대량 오탐된다 — D-94 1차 스캔의 [A]류 75건이 그랬다.
  const sentsText = (set.sents || []).map((t) => t.t || "").join("\n");
  const annLabels = (set.annotations || [])
    .map((a) => (a && a.label ? `[${a.label}]` : "")).join(" ");
  const annText = flat(set.annotations);
  const out = [];
  for (const q of set.questions || []) {
    const anchorText = sentsText + "\n" + flat(q.bogi) + "\n" + annLabels + "\n" + annText;
    // 참조처 — 발문 + 선지
    const refText = flat(q.t) + "\n" + (q.choices || []).map((c) => c.t || "").join("\n");
    for (const kind of KINDS) {
      const refs = grab(refText, kind);
      if (!refs.size) continue;
      const anchors = grab(anchorText, kind);
      const missing = [...refs].filter((m) => !anchors.has(m));
      if (missing.length)
        out.push({
          qid: q.id, kind: kind.name,
          missing, refs: [...refs], anchors: [...anchors],
          부분: missing.length < refs.size,
        });
    }
  }
  return out;
}

/** 산출물 파일 하나를 검사 */
export function checkMarkerAnchors(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const sets = [...(j.reading || []), ...(j.literature || [])];
  const rows = [];
  for (const s of sets)
    for (const r of checkSetMarkers(s)) rows.push({ setId: s.id, ...r });
  return { sets: sets.length, rows };
}

// ── 단독 실행 ──
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const yk = process.argv[2];
  if (!yk) { console.error("사용법: node pipeline/marker_anchor_check.mjs <yearKey>"); process.exit(1); }
  const f = path.join(ROOT, `pipeline/reextract/${yk}_literature.json`);
  if (!fs.existsSync(f)) { console.error(`🔴 없음: ${path.relative(ROOT, f)}`); process.exit(1); }
  const { sets, rows } = checkMarkerAnchors(f);
  console.log(`## 마커 정합성 — ${yk} (세트 ${sets})`);
  if (!rows.length) { console.log("  ✅ 미정박 없음"); process.exit(0); }
  for (const r of rows)
    console.log(`  🔴 ${r.setId} Q${r.qid} ${r.kind} — 미정박 ${r.missing.join("")} ` +
      `(참조 ${r.refs.join("")} / 정박 ${r.anchors.join("") || "없음"}) ${r.부분 ? "[부분]" : "[전부]"}`);
  process.exit(1);
}

/**
 * ⑥ bracket 정박 축 (발주 D-104 ③)
 *
 * `workTag` 로 들어간 `[A]`~`[F]` 단독 문장은 **렌더러가 의도적으로 숨긴다**
 * (PassagePanel.jsx 의 `_isAreaEndMarker` — "visual 본문 노출 NOT path").
 * 실제 구간 표시는 `annotations` 의 `{type:"bracket", label, sentFrom, sentTo}` 가 그린다.
 *
 * 따라서 **workTag 는 있는데 bracket 이 없으면 화면에 아무것도 안 나온다.**
 * ⑤축(마커 정합성)은 이걸 못 잡는다 — 텍스트에는 실재하기 때문이다.
 *
 * 반환: 결함이면 { labels, nTags } · 정상이면 null
 */
export function checkBracketAnchored(set) {
  const TAG = /^\[([A-F])\]$/;
  const tagLabels = new Set(
    (set.sents || [])
      .map((x) => String(x.t ?? "").trim().match(TAG))
      .filter(Boolean)
      .map((m) => m[1]));
  const brLabels = new Set(
    (set.annotations || []).filter((a) => a && a.type === "bracket").map((a) => a.label));

  // 문항이 실제로 가리키는 라벨 — 이것이 화면에 나와야 한다
  const refLabels = new Set();
  for (const q of set.questions || []) {
    const parts = [flat(q.t), flat(q.bogi), ...(q.choices || []).map((c) => c.t || "")];
    for (const m of parts.join(" ").match(/\[[A-F]\]/g) || []) refLabels.add(m[1]);
  }

  const missTagNoBr = [...tagLabels].filter((l) => !brLabels.has(l)).sort();
  const missBrNoTag = [...brLabels].filter((l) => !tagLabels.has(l)).sort();
  const missRefNoBr = [...refLabels].filter((l) => !brLabels.has(l)).sort();

  if (!missTagNoBr.length && !missBrNoTag.length && !missRefNoBr.length) return null;
  return {
    // (a) workTag 는 있는데 bracket 이 없다 → 그 구간은 화면에 안 나온다
    tagNoBracket: missTagNoBr,
    // (b) bracket 은 있는데 workTag 가 없다 → 렌더는 되지만 데이터가 비대칭이다
    bracketNoTag: missBrNoTag,
    // (c) 문항이 가리키는데 bracket 이 없다 → **학생이 못 보는 구간**. 가장 실질적이다
    refNoBracket: missRefNoBr,
    labels: missTagNoBr,            // 하위호환 (기존 호출부)
    nTags: tagLabels.size,
    partial: brLabels.size > 0,
  };
}
