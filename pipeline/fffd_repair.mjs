// fffd_repair.mjs — U+FFFD 인코딩 손상 복구 (발주 2026-08-24 ⑤ 후단)
//
// 원인: 코덱스가 본 pdftotext 출력에서 책·문집명 기호가 U+FFFD 로 흘렀다.
//   PyMuPDF 로 같은 자리를 다시 읽으면 U+F0854 / U+F0855 (SPUA-A) 쌍이다.
//   기존 353세트 관례가 근거다 — 책·문집·신문명은 『』(U+300E/300F) 80회,
//   작품명은 「」(U+300C/300D) 240회. 『시경』은 기존 데이터에 3건 실재한다.
//
// 고치는 것은 **근거가 확정된 형태뿐**이다.
//   ① 「…」를 감싼 U+FFFD 덩어리 쌍  → 『 … 』
//   ② 온전한 단어 사이에 낀 U+FFFD 낱자 → 제거(글자가 사라진 게 아니라 끼어든 것)
// 그 외는 손대지 않고 목록으로 남긴다.
//
// 사용: node pipeline/fffd_repair.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const APPLY = process.argv.includes("--apply");

// ① 덩어리 쌍이 제목을 감싼 꼴:  ▯▯▯시경▯▯▯  →  『시경』
const WRAP = /�{2,}([^�]{1,20}?)�{2,}/g;
// ② 한글 사이에 낀 낱자:  펼▯쳐진다  →  펼쳐진다
const LONE = /(?<=[가-힣])�(?=[가-힣])/g;

let gWrap = 0, gLone = 0;
const left = [];

console.log(`## U+FFFD 복구 ${APPLY ? "적용" : "DRY-RUN"}\n`);
for (const d of fs.readdirSync(STEP3)) {
  const p = path.join(STEP3, d, "step4_result.json");
  if (!fs.existsSync(p)) continue;
  const raw = fs.readFileSync(p, "utf8");
  if (!raw.includes("�")) continue;
  const j = JSON.parse(raw);
  let w = 0, l = 0;

  const fix = (s, where) => {
    if (typeof s !== "string" || !s.includes("�")) return s;
    let out = s.replace(WRAP, (_, inner) => { w++; return `『${inner}』`; });
    out = out.replace(LONE, () => { l++; return ""; });
    if (out.includes("�")) {
      const at = out.indexOf("�");
      left.push({ d, where, ctx: out.slice(Math.max(0, at - 30), at + 30).replace(/\n/g, " ") });
    }
    if (out !== s) console.log(`  [${d}] ${where}\n     전: ${s.slice(0, 72)}\n     후: ${out.slice(0, 72)}`);
    return out;
  };
  const walk = (o, where) => {
    if (typeof o === "string") return fix(o, where);
    if (Array.isArray(o)) return o.map((x, i) => walk(x, `${where}[${i}]`));
    if (o && typeof o === "object") {
      const r = {};
      for (const [k, v] of Object.entries(o)) r[k] = walk(v, `${where}.${k}`);
      return r;
    }
    return o;
  };
  const fixed = walk(j, "");
  if (APPLY) fs.writeFileSync(p, JSON.stringify(fixed, null, 2), "utf8");
  gWrap += w; gLone += l;
}
console.log(`\n## 합계 — 제목 기호 복구 ${gWrap}쌍 · 낱자 제거 ${gLone}자 · 미해결 ${left.length}건`);
for (const x of left) console.log(`   ⚠ [${x.d}] ${x.where}: …${x.ctx}…`);
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
