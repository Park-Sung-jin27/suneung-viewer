// pua_guard.mjs — 사용자 정의 영역(PUA) 문자 검출 (발주 D-198 ②)
//
// 왜 막는가: 한양 계열 폰트가 쓰는 PUA 문자는 그 폰트가 없는 기기에서 □ 로 나온다.
//   2027_9월 r20279a Q3 의 『요리사의 식탁』 겹낫표 2자가 그랬다(D-198 에서 교체).
//   추출을 다시 돌리면 원본 PDF 텍스트층에 같은 PUA 가 그대로 있으므로 되돌아온다.
//   그래서 추출 단계에서 걸러야 한다 — 사람이 매번 눈으로 찾을 수는 없다.
//
// 범위: BMP 사용자 영역(U+E000~U+F8FF) + 보조면 15·16(U+F0000~U+10FFFD).
//   한양 PUA 는 보조면 15 를 쓴다(U+F0854 등). BMP 쪽도 함께 본다 — 다른 폰트 유입 대비.
//
// 매핑은 자동으로 하지 않는다. 글리프 육안 판독은 금지(§13⑬)이고, 어떤 글자인지는
//   원본 고해상도 렌더의 획을 보고 심사관이 정한다. 이 도구는 **찾아서 멈추게만** 한다.
//
// 사용:
//   node pipeline/pua_guard.mjs <JSON파일>        (단독 검사 — 발견 시 exit 1)
//   import { scanPUA, reportPUA } from "./pua_guard.mjs"   (파이프라인 편입)

import fs from "node:fs";

const RE_PUA = /[-]|[\uDB80-\uDBFF][\uDC00-\uDFFF]/g;

/** 객체 전체를 훑어 PUA 문자를 찾는다. 경로와 코드포인트, 앞뒤 문맥을 함께 낸다. */
export function scanPUA(root) {
  const out = [];
  (function walk(o, p) {
    if (typeof o === "string") {
      for (const m of o.matchAll(RE_PUA)) {
        const i = m.index;
        out.push({
          path: p,
          cp: m[0].codePointAt(0),
          context: o.slice(Math.max(0, i - 14), i) + "◆" + o.slice(i + m[0].length, i + m[0].length + 14),
        });
      }
    } else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (o && typeof o === "object") for (const [k, x] of Object.entries(o)) walk(x, p ? `${p}.${k}` : k);
  })(root, "");
  return out;
}

/** 사람이 읽을 보고문. 발견 0건이면 빈 문자열. */
export function reportPUA(hits, label = "") {
  if (!hits.length) return "";
  const by = new Map();
  for (const h of hits) {
    const k = "U+" + h.cp.toString(16).toUpperCase();
    by.set(k, [...(by.get(k) || []), h]);
  }
  const L = [];
  L.push(`🔴 PUA(사용자 정의 영역) 문자 ${hits.length}건${label ? ` — ${label}` : ""}`);
  L.push("   이 글자들은 한양 계열 폰트가 없는 기기에서 □ 로 보인다. 그대로 내보내면 안 된다.");
  for (const [cp, list] of by) {
    L.push(`   ${cp} × ${list.length}`);
    for (const h of list.slice(0, 6)) L.push(`      ${h.path}  …${h.context}…`);
    if (list.length > 6) L.push(`      … 외 ${list.length - 6}건`);
  }
  L.push("   조치: 원본 고해상도 렌더에서 글리프 획을 판독해 대응 문자를 **심사관이** 확정한다.");
  L.push("         글리프를 눈으로 보고 고르지 말 것(§13⑬). 확정 뒤 교체 도구로 일괄 치환한다.");
  return L.join("\n");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const f = process.argv[2];
  if (!f) { console.error("사용법: node pipeline/pua_guard.mjs <JSON파일>"); process.exit(1); }
  const hits = scanPUA(JSON.parse(fs.readFileSync(f, "utf8")));
  if (!hits.length) { console.log(`✅ PUA 0건 — ${f}`); process.exit(0); }
  console.error(reportPUA(hits, f));
  process.exit(1);
}
