// reextract_postprocess.mjs — step3 산출물 후처리 (발주 D-89 2단계 ①)
//
// 왜 필요한가
//   D-85 는 all_data 의 꼬리 패턴 코드 771건을 지웠지만 **생성기는 안 고쳤다.**
//   step3 가 만드는 새 해설에 같은 서식이 그대로 붙는다(2016_6월B 25/60 실증).
//   병합 전에 걷어내지 않으면 지운 오염이 되돌아온다.
//
// 규칙은 pattern_code_clean.mjs 와 **동일**하다. 다르면 두 경로가 갈라진다.
//   대상: [코드] · [코드 이름] · (코드) · (코드: 이름) · — 패턴: 이름(코드) · 끊긴 꼬리
//   제외: 코드에 0 이 든 것(본문 숫자)
//   공백 정리는 제거가 일어난 선지에만.
//
// 사용: node pipeline/reextract_postprocess.mjs <yearKey> [--apply]
// 금지: all_data 병합. (산출물 파일만 고친다)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yk = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!yk) { console.error("사용법: node pipeline/reextract_postprocess.mjs <yearKey> [--apply]"); process.exit(1); }

const file = path.join(ROOT, `pipeline/reextract/step3/${yk}/step3_result.json`);
if (!fs.existsSync(file)) { console.error(`🔴 step3 결과 없음: ${path.relative(ROOT, file)}`); process.exit(1); }

const CODE = "[RL]\\d|V|0";
const WRAP = new RegExp(
  `([\\[(])\\s*((?:${CODE})(?:\\s*,\\s*(?:${CODE}))*)(?:\\s*[:：\\-–—]\\s*[^)\\]]{1,30}|\\s+[^)\\]]{1,30})?\\s*([\\])])`, "g");
const TMPL = new RegExp(`\\s*[—–-]\\s*패턴\\s*:\\s*[^()\\n]{1,30}\\(\\s*(?:${CODE})\\s*\\)`, "g");
const OPEN_TAIL = new RegExp(`\\s*[\\[(]\\s*(?:[RL]\\d|V)\\s*$`);

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const sets = [...(data.reading || []), ...(data.literature || [])];

let hits = 0, touched = 0, chars = 0, skipZero = 0;
const samples = [];
for (const s of sets)
  for (const q of s.questions || [])
    for (const c of q.choices || []) {
      const a0 = String(c.analysis || "");
      if (!a0) continue;
      let a = a0, n = 0;
      a = a.replace(TMPL, (m) => (/[\[(]\s*0\s*[\])]/.test(m) ? m : (n++, "")));
      a = a.replace(WRAP, (m, _l, codes) => (codes.split(/\s*,\s*/).includes("0") ? (skipZero++, m) : (n++, "")));
      if (OPEN_TAIL.test(a)) { a = a.replace(OPEN_TAIL, ""); n++; }
      if (n) {
        a = a.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([.,、。」』\])])/g, "$1")
             .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        hits += n; touched++; chars += a0.length - a.length;
        if (samples.length < 3) samples.push([`${s.id} Q${q.id}#${c.num}`, a0.slice(-52), a.slice(-52)]);
        if (APPLY) c.analysis = a;
      }
    }

console.log(`## 후처리 ${APPLY ? "적용" : "DRY-RUN"} — ${yk}`);
console.log(`  제거 ${hits}건 · 수정 선지 ${touched}개 · 글자 감소 ${chars} · 0 제외 ${skipZero}`);
for (const [k, b, a] of samples) console.log(`   ${k}\n     전: …${b.replace(/\s+/g, " ")}\n     후: …${a.replace(/\s+/g, " ")}`);

if (APPLY) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  // 검산 — 남은 게 있으면 실패로 알린다
  const again = JSON.parse(fs.readFileSync(file, "utf8"));
  const all = [...(again.reading || []), ...(again.literature || [])]
    .flatMap((s) => (s.questions || []).flatMap((q) => (q.choices || []).map((c) => String(c.analysis || ""))));
  const left = all.filter((a) => {
    const m = a.match(new RegExp(WRAP.source, "g")) || [];
    return m.some((x) => !/[\[(]\s*0\s*[\])]/.test(x)) || TMPL.test(a);
  }).length;
  console.log(`  검산: 잔존 ${left}건 ${left === 0 ? "✅" : "🔴"}`);
  if (left > 0) process.exit(1);
} else {
  console.log(`  실제로 쓰려면 --apply`);
}
