// marker_range.mjs — 발문 마커 범위표기 공용 파서
//   두 게이트가 공유: quality_gate(W_orphan_marker referenced 전개) +
//   structure_fidelity(발문 범위표기 ↔ 시험지 문자 대조).
//   같은 파서를 공유해야 사각이 갈라지지 않는다(§13⑮).
//   "ⓐ~ⓔ" 같은 범위표기는 ⓐ·ⓔ만 문자로 존재하고 ⓑⓒⓓ는 "~"로 생략됨 →
//   전개하지 않으면 (a) W_orphan이 ⓑⓒⓓ를 고아로 오탐 (b) structure가 절단
//   "ⓐ~ⓒ"를 "ⓐ~ⓔ"와 구분 못 함(§13⑥ r2023c 실증).

// 연속 마커 풀(전개 기준). 물결 종류(~ U+007E · ～ U+FF5E · ∼ U+223C) 무관.
const POOLS = ["ⓐⓑⓒⓓⓔⓕⓖⓗ", "ⒶⒷⒸⒹⒺⒻ", "㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩"];
const CH = "ⓐ-ⓗⒶ-Ⓕ㉠-㉩";

function poolOf(c) {
  for (const p of POOLS) if (p.includes(c)) return p;
  return null;
}

/** 텍스트의 범위표기("ⓐ~ⓔ")를 전개한 마커 Set 반환. 범위표기 없으면 빈 Set. */
export function expandMarkerRanges(text) {
  const out = new Set();
  const re = new RegExp(`([${CH}])\\s*[~～∼]\\s*([${CH}])`, "g");
  for (const m of String(text || "").matchAll(re)) {
    const p = poolOf(m[1]);
    if (!p || poolOf(m[2]) !== p) continue;
    const i = p.indexOf(m[1]),
      j = p.indexOf(m[2]);
    if (i < 0 || j < 0 || j < i) continue;
    for (let k = i; k <= j; k++) out.add(p[k]);
  }
  return out;
}

/** 발문 마커 참조 집합 = 개별 마커 + 범위표기 전개 (structure/orphan 공용). */
export function questionMarkerRefs(text) {
  const s = String(text || "");
  const out = expandMarkerRanges(s);
  const re = new RegExp(`[${CH}]`, "g");
  for (const m of s.match(re) || []) out.add(m);
  return out;
}

// 전체 마커 문자(원문자 ㉠~ · ⓐ~ · Ⓐ~). 오배치 검출용(범위파서 CH보다 넓음).
const ALL_MARKER_RE = /[㉠-㉿]|[ⓐ-ⓩ]|[Ⓐ-Ⓩ]/g;

/**
 * 오배치 마커 검출: 같은 마커가 sent.t 인라인과 annotation marker 양쪽에 있는데
 * sentId가 전혀 겹치지 않으면 = 인라인 기호가 잘못된 sent에 붙음(동일 어구 다출현 시
 * 첫 출현에 오정박 등). annotation을 정본으로 간주(payload 렌더 기준).
 * structure Layer4가 시험지↔데이터라면 이 축은 데이터 내부 정합(상보적).
 * 실증: r2022b ㉡(인라인 s9 ↔ ann s18) · l2024b ⓓ(인라인 s19 ↔ ann s18).
 * @param {Array} sents  세트 sents
 * @param {Array} annList  해당 세트 annotations (marker 필드 보유 레코드 포함)
 * @returns {Array<{marker, inline:string[], ann:string[]}>}
 */
export function misplacedMarkers(sents, annList) {
  const inlineOf = new Map();
  for (const s of sents || [])
    for (const m of String(s.t || "").match(ALL_MARKER_RE) || []) {
      if (!inlineOf.has(m)) inlineOf.set(m, []);
      if (!inlineOf.get(m).includes(s.id)) inlineOf.get(m).push(s.id);
    }
  const annOf = new Map();
  for (const o of annList || [])
    if (o.marker && o.sentId) {
      if (!annOf.has(o.marker)) annOf.set(o.marker, []);
      if (!annOf.get(o.marker).includes(o.sentId))
        annOf.get(o.marker).push(o.sentId);
    }
  const out = [];
  for (const [m, inS] of inlineOf) {
    const aS = annOf.get(m);
    if (!aS || !aS.length) continue; // annotation 없으면 대조 불가(오배치 판정 제외)
    if (!inS.some((x) => aS.includes(x)))
      out.push({ marker: m, inline: inS, ann: aS });
  }
  return out;
}
