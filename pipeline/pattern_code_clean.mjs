// pattern_code_clean.mjs — 해설 본문 패턴 코드 잔재 정리 (발주 D-85)
//
// 🔴 데이터 수정 스크립트다. 기본은 dry-run 이고, --apply 를 줘야 실제로 쓴다.
//    --apply 전에 백업을 만든다(public/data/all_data_204.backup.<stamp>.json · gitignore 대상).
//
// 대상 (감싼 형태만 — 맨몸 코드는 건드리지 않는다)
//   [코드] · [코드 이름] · [코드-이름] · (코드) · (코드: 이름) · — 패턴: 이름(코드)
//   코드 = R1~R4 · L1~L5 · V
//   「— 패턴: 이름(코드)」 는 **템플릿 전체**를 지운다. 코드만 빼면 `— 패턴: 어휘()` 가 남아 더 나쁘다.
//   그 밖은 감싼 덩어리만 지우고 앞뒤 문장·마침표는 보존한다.
//
// 🔴 제외 — 절대 건드리지 않는다
//   (1) 본문↔pat 불일치 6건: 어느 쪽이 정본인지 미판정. 선지 대조 뒤에만 손댄다.
//   (2) 코드에 `0` 이 든 것: 2건 모두 본문 숫자다(오차 값 `(0)`, 이진수 `100(0)`).
//       참고로 맨몸 `0` 은 소수점(0.75·0.67)을 187건 오탐한다 — 감싼 형태로만 보는 이유다.
//
// 사용: node pipeline/pattern_code_clean.mjs [--apply]
// 검증: 제거 글자수 합계 == analysis 총 글자수 감소분

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");

const raw = fs.readFileSync(SRC, "utf8");
const data = JSON.parse(raw);

const CODE = "[RL]\\d|V|0";
// 감싼 덩어리: 여는 기호 + 코드(들) + [구분자 + 이름] + 닫는 기호
const WRAP = new RegExp(
  `([\\[(])\\s*((?:${CODE})(?:\\s*,\\s*(?:${CODE}))*)(?:\\s*[:：\\-–—]\\s*[^)\\]]{1,30}|\\s+[^)\\]]{1,30})?\\s*([\\])])`,
  "g");
// 「— 패턴: 이름(코드)」 템플릿 — 앞의 구분선까지 통째로
const TMPL = new RegExp(`\\s*[—–-]\\s*패턴\\s*:\\s*[^()\\n]{1,30}\\(\\s*(?:${CODE})\\s*\\)`, "g");
// 닫는 기호가 없는 깨진 꼬리 — 문자열 **맨 끝**에서 `… [L3` 처럼 끊긴 것 (1건 실재)
const OPEN_TAIL = new RegExp(`\\s*[\\[(]\\s*(?:[RL]\\d|V)\\s*$`);

// 제외 1 — 본문↔pat 불일치 (D-83 제외 목록)
const MISMATCH = new Set([
  "2025수능::r2025b::6::1", "2025수능::r2025c::11::3", "2025수능::r2025c::11::4",
  "2025수능::r2025c::11::5", "2025수능::r2025d::15::5", "2022수능::l2022b::25::5",
]);

let removedChars = 0, removedHits = 0, touched = 0, skipMismatch = 0, skipZero = 0;
const log = [];
const before = { chars: 0 }, after = { chars: 0 };

for (const yk of Object.keys(data))
  for (const sec of ["reading", "literature"])
    for (const s of data[yk][sec] || [])
      for (const q of s.questions || [])
        for (const c of q.choices || []) {
          const a0 = String(c.analysis || "");
          if (!a0) continue;
          before.chars += a0.length;
          const key = `${yk}::${s.id}::${q.id}::${c.num}`;
          if (MISMATCH.has(key)) { skipMismatch++; after.chars += a0.length; continue; }

          let a = a0, n = 0;
          // ① 템플릿 먼저 — 안쪽 괄호가 WRAP 에 먼저 잡히면 껍데기가 남는다
          a = a.replace(TMPL, (m) => {
            if (/[\[(]\s*0\s*[\])]/.test(m)) { skipZero++; return m; }
            removedHits++; n++; return "";
          });
          // ② 남은 감싼 덩어리
          a = a.replace(WRAP, (m, _l, codes) => {
            if (codes.split(/\s*,\s*/).includes("0")) { skipZero++; return m; }
            removedHits++; n++; return "";
          });
          // ②-b 닫는 기호 없이 끊긴 꼬리
          if (OPEN_TAIL.test(a)) { a = a.replace(OPEN_TAIL, ""); removedHits++; n++; }
          // ③ 공백 정리 — **제거가 일어난 선지에만** 건다.
          //    전 선지에 걸면 코드와 무관한 1,700여 개가 함께 바뀌어 발주 밖 변경이 된다.
          if (n > 0) {
            a = a.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([.,、。」』\])])/g, "$1")
                 .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
          }

          after.chars += a.length;
          if (a !== a0) {
            touched++;
            removedChars += a0.length - a.length;
            if (log.length < 8) log.push({ key, from: a0.slice(-70), to: a.slice(-70) });
            if (APPLY) c.analysis = a;
          }
        }

console.log(`## ${APPLY ? "적용" : "DRY-RUN (쓰지 않음)"}`);
console.log(`  제거 덩어리 ${removedHits}건 · 수정된 선지 ${touched}개`);
console.log(`  제외 — 불일치 ${skipMismatch}개 선지 · 코드 0 포함 ${skipZero}건`);
console.log(`  analysis 총 글자수 ${before.chars.toLocaleString()} → ${after.chars.toLocaleString()} (감소 ${removedChars.toLocaleString()})`);
console.log(`  계수 대조: ${before.chars - after.chars === removedChars ? "✅ 일치" : "🔴 불일치"}`);
console.log(`\n## 변경 표본 (해설 끝 70자)`);
for (const x of log) console.log(`  ${x.key}\n    전: …${x.from.replace(/\s+/g, " ")}\n    후: …${x.to.replace(/\s+/g, " ")}`);

if (APPLY) {
  const stamp = fs.statSync(SRC).mtime.toISOString().slice(0, 10).replace(/-/g, "");
  const bak = path.join(ROOT, `public/data/all_data_204.backup.${stamp}-D85.json`);
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, raw, "utf8");   // 원본 바이트 그대로
  console.log(`\n백업: ${path.relative(ROOT, bak)} (${(Buffer.byteLength(raw) / 1048576).toFixed(2)}MB)`);
  fs.writeFileSync(SRC, JSON.stringify(data), "utf8");           // minified 재직렬화 — 최소 diff
  console.log(`쓰기 완료: ${path.relative(ROOT, SRC)} (${(fs.statSync(SRC).size / 1048576).toFixed(2)}MB)`);
} else {
  console.log(`\n실제로 쓰려면 --apply 를 붙인다.`);
}
