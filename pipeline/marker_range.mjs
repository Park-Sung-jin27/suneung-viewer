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
