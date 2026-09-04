// pattern_code_mismatch_fix.mjs — 본문↔pat 불일치 6건 확정 처리 (발주 D-85b)
//
// 🔴 데이터 수정 스크립트다. 기본은 dry-run 이고 --apply 를 줘야 쓴다.
//
// D-85 에서 제외해 둔 6선지를, 심사관 판정이 확정됐으므로 마무리한다.
//   ① pat 을 확정값으로 맞춘다 (아래 표가 판정 결과 그대로다)
//   ② 그 6선지의 본문 꼬리 코드도 제거한다 — 증거 보존 사유가 소멸했다
//
// 대상은 **이 6선지뿐**이다. 다른 선지는 건드리지 않는다(D-85 에서 이미 정리됨).
//
// 사용: node pipeline/pattern_code_mismatch_fix.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");

// 판정 결과 (발주 D-85b) — yk, setId, qid, num, 확정 pat, 사유
const DECISION = [
  ["2025수능", "r2025b", 6, 1, "R1", "pat 유지 — 지문에 있는 입장을 뒤집은 것이라 '없는 말'(R3) 아님"],
  ["2025수능", "r2025c", 11, 3, null, "빈 축 백로그 — '생략·불완전 서술' 코드가 없어 null 로 비운다"],
  ["2025수능", "r2025c", 11, 4, "R2", "정답↔출력 역할 전도 → 관계 뒤집기"],
  ["2025수능", "r2025c", 11, 5, "R2", "역확산 방향 정반대 → 관계 뒤집기"],
  ["2025수능", "r2025d", 15, 5, "R3", "지문 어디에도 없는 주장 → 지문에 없는 말"],
  ["2022수능", "l2022b", 25, 5, "L1", "pat 유지. 정서 오독(L2)은 문서에 병기 — 필드는 단일값 유지"],
];

const CODE = "[RL]\\d|V|0";
const WRAP = new RegExp(
  `([\\[(])\\s*((?:${CODE})(?:\\s*,\\s*(?:${CODE}))*)(?:\\s*[:：\\-–—]\\s*[^)\\]]{1,30}|\\s+[^)\\]]{1,30})?\\s*([\\])])`,
  "g");
const TMPL = new RegExp(`\\s*[—–-]\\s*패턴\\s*:\\s*[^()\\n]{1,30}\\(\\s*(?:${CODE})\\s*\\)`, "g");
const OPEN_TAIL = new RegExp(`\\s*[\\[(]\\s*(?:[RL]\\d|V)\\s*$`);

const raw = fs.readFileSync(SRC, "utf8");
const data = JSON.parse(raw);
const findSet = (yk, sid) => {
  for (const sec of ["reading", "literature"]) {
    const x = (data[yk][sec] || []).find((v) => v.id === sid);
    if (x) return x;
  }
};

let patChanged = 0, tailRemoved = 0, chars = 0;
for (const [yk, sid, qid, num, newPat, why] of DECISION) {
  const s = findSet(yk, sid);
  const q = s?.questions.find((v) => v.id === qid);
  const c = q?.choices.find((v) => v.num === num);
  if (!c) { console.log(`🔴 못 찾음: ${yk} ${sid} Q${qid}#${num}`); continue; }

  const oldPat = c.pat === undefined ? "(없음)" : String(c.pat);
  const a0 = String(c.analysis || "");
  let a = a0, n = 0;
  a = a.replace(TMPL, () => { n++; return ""; });
  a = a.replace(WRAP, (m, _l, codes) => (codes.split(/\s*,\s*/).includes("0") ? m : (n++, "")));
  if (OPEN_TAIL.test(a)) { a = a.replace(OPEN_TAIL, ""); n++; }
  if (n) a = a.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([.,、。」』\])])/g, "$1")
              .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  const patDiff = String(newPat) !== String(c.pat);
  console.log(`${yk} ${sid} Q${qid}#${num}`);
  console.log(`  pat: ${oldPat} → ${newPat === null ? "null" : newPat}${patDiff ? "  (변경)" : "  (유지)"}   ${why}`);
  console.log(`  꼬리 제거 ${n}건 · 글자 ${a0.length} → ${a.length}`);
  console.log(`    후: …${a.slice(-64).replace(/\s+/g, " ")}`);

  if (patDiff) patChanged++;
  tailRemoved += n;
  chars += a0.length - a.length;
  if (APPLY) { c.pat = newPat; c.analysis = a; }
}

console.log(`\n## ${APPLY ? "적용" : "DRY-RUN (쓰지 않음)"}`);
console.log(`  pat 변경 ${patChanged}건 / 6건 · 꼬리 제거 ${tailRemoved}건 · 글자 감소 ${chars}`);

if (APPLY) {
  const bak = path.join(ROOT, "data-source/all_data_204.backup.D85b-pre.json");
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, raw, "utf8");
  console.log(`  백업: ${path.relative(ROOT, bak)}`);
  fs.writeFileSync(SRC, JSON.stringify(data), "utf8");
  console.log(`  쓰기 완료: ${(fs.statSync(SRC).size / 1048576).toFixed(2)}MB`);
} else {
  console.log(`  실제로 쓰려면 --apply 를 붙인다.`);
}
