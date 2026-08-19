// anchor.mjs — 원문 앵커 공용 모듈 (발주 D-34)
//
// 같은 앵커 코드를 스크립트마다 복사한 탓에 같은 결함이 세 번 재발했다.
//   D-25 재현율 놓침 2건 · D-26 정밀도 0/20 · D-33 정밀도 오판 13건
// 전부 「선지 맨 앞 마커가 앵커 구간 밖으로 빠진다」가 원인이었다.
// 앵커는 여기 한 곳에만 둔다.

// 원문자 마커 — 강정규화 전에 떼어낸다. NFKC 는 ⓑ→b, ①→1, ㉠→ㄱ 로 접는다.
export const MARK = /[\u2460-\u2473\u2474-\u2487\u24B6-\u24E9\u3200-\u321E\u3220-\u3229\u3260-\u327F]/;
export const MARK_G = new RegExp(MARK.source, "g");
// 선지 번호. 본문 마커가 아니므로 앵커를 앞으로 늘릴 때 여기서 멈춘다.
const CHOICE_NUM = /[\u2460-\u2464]/;

export const hard = (s) =>
  String(s || "").replace(MARK_G, "").normalize("NFKC")
    .replace(/[^\p{Script=Hangul}\p{Script=Han}\p{Script=Latin}0-9]/gu, "");

// 원문 인덱스. ★ NFKC 가 한 글자를 여러 글자로 늘리면(㈜→(주)) H 와 map 의
//   길이가 어긋난다. 늘어난 만큼 map 에도 같은 원본 위치를 넣어야 한다.
export function buildIndex(raw) {
  const map = [];
  let H = "";
  for (let i = 0; i < raw.length; i++) {
    const h = hard(raw[i]);
    if (!h) continue;
    H += h;
    for (const _ of h) map.push(i);
  }
  return { raw, H, map };
}

// text 에 대응하는 원문 구간을 돌려준다.
//   ok:false 사유 — short(너무 짧음) / notfound(원문에 없음) / ambiguous(다중 출현)
// ★ expand:true 는 시작점을 선지 번호 직후까지 앞으로 늘린다. 선지 맨 앞
//   마커가 구간 밖으로 빠지는 문제를 푼다. 기본값은 false — 발문·지문에
//   적용하면 회귀한다(D-34 실측: 재현율 75%→31%). 선지에만 켠다.
export function locateSpan(idx, text, { minLen = 15, expand = false } = {}) {
  const n = hard(text);
  if (n.length < minLen) return { ok: false, why: "short" };
  const at = idx.H.indexOf(n);
  if (at < 0) return { ok: false, why: "notfound" };
  if (idx.H.indexOf(n, at + 1) >= 0) return { ok: false, why: "ambiguous" };
  let s = idx.map[at];
  const e = idx.map[at + n.length - 1] + 1;
  if (expand) {
    let j = s - 1;
    while (j >= 0) {
      const c = idx.raw[j];
      if (/[\s\u00a0]/.test(c)) { j--; continue; }
      if (CHOICE_NUM.test(c)) break;      // 선지 번호를 만나면 멈춘다
      if (MARK.test(c)) { s = j; j--; continue; }  // 본문 마커는 구간에 넣는다
      break;
    }
  }
  return { ok: true, span: idx.raw.slice(s, e), from: s, to: e };
}

// 등장 순서를 유지한 채 중복만 없앤 마커 나열
export const markSeq = (s) => {
  const out = [];
  for (const m of String(s || "").match(MARK_G) || []) if (!out.includes(m)) out.push(m);
  return out.join("");
};

// 문자열을 첫 본문 문자 ~ 마지막 본문 문자 구간으로 자른다.
//   원문 구간은 hard 경계로 잘려 있으므로 데이터 쪽도 같은 규칙을 적용해야
//   양끝의 마커·구두점이 「차이」로 잡히지 않는다. (D-35 회귀 원인)
// 🔴 §13 확정 (2026-08-20) — clipHard() 는 **지문 문장에만** 쓴다.
//   선지·발문에 쓰면 맨 앞 마커(㉠·ⓐ·⑦…)를 본문 문자가 아니라고 보고 잘라낸다.
//   그러면 「데이터에 마커가 없다」로 읽혀 오탐이 무더기로 생긴다.
//   D-35(재현율 75→31 가짜 회귀) · D-37(정밀도 2/20) · D-57(진짜 7→3) 세 번 재발했다.
//   선지·발문은 markSeq(원문 그대로) 로 비교하고, 원문 쪽은 locateSpan(...,{expand:true}) 를 쓴다.
export const clipHard = (x) => {
  const a = [...String(x || "")];
  let i = 0, j = a.length - 1;
  while (i < a.length && !hard(a[i])) i++;
  while (j >= 0 && !hard(a[j])) j--;
  return i > j ? "" : a.slice(i, j + 1).join("");
};

// 등장 순서 그대로, 중복도 유지한 마커 나열.
//   markSeq() 는 중복을 없앤다. 「㉠…㉠」 이 「㉠」 이 되어 두 문자열이
//   우연히 같아진다. 존재·소실 대조에는 이쪽을 쓴다. (D-35 회귀 원인)
export const markList = (s) => (String(s || "").match(MARK_G) || []).join("");
