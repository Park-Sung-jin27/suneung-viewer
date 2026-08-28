// choice_contamination_audit.mjs — 「선지 오염」 축 (발주 D-149 ③ · D-148 ①②)
//
// ★ 왜 만드나
//   2020_6월::l20206a Q24 의 선지 ①~④ 가 **같은 시험지 16번(박경리 토지) 문항의 선지**였다.
//   심사관 원본 대조로 확정됐다. 즉 추출 단계에서 다른 문항의 선지가 통째로 들어왔다.
//   학생은 자기가 읽은 지문과 무관한 선지를 풀게 된다 — 정답이 성립하지 않는다.
//
// 무엇을 보나
//   ⓐ 문항 간 선지 겹침   서로 다른 문항이 같은 선지 문장을 공유한다
//   ⓑ 세트 간 선지 겹침   서로 다른 세트가 같은 선지 문장을 공유한다
//   겹침 개수로 등급을 나눈다 — 3개 이상이면 문항 하나가 통째로 옮겨온 것에 가깝다.
//
// ★ 오탐을 줄이는 장치
//   · 짧은 선지(공백 제외 12자 미만)는 우연히 같을 수 있어 세지 않는다
//   · 같은 회차의 A형·B형(2014~2016)은 **같은 문항을 공유하는 것이 정상**이라 따로 표시한다
//     (setId 가 같거나 yearKey 가 A/B 짝인 경우)
//
// 진단만 한다. 아무것도 쓰지 않는다.
//
// 사용:
//   node pipeline/choice_contamination_audit.mjs            전 396세트
//   node pipeline/choice_contamination_audit.mjs --live     LIVE 만
//   node pipeline/choice_contamination_audit.mjs --year 2020_6월

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

const argv = process.argv.slice(2);
const LIVE_ONLY = argv.includes("--live");
const yi = argv.indexOf("--year");
const YEAR = yi >= 0 ? argv[yi + 1] : null;

// A/B 형 짝 — 같은 시행이라 문항 공유가 정상이다
const formBase = (yk) => yk.replace(/[AB]$/, "");

const norm = (t) => String(t).replace(/\s+/g, "").replace(/[.,·'"''""()\[\]]/g, "");
const bucket = new Map();   // 정규화 선지 → [{key, yk, setId, qId, num, live}]
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const setId = s.setId || s.id;
      const key = `${yk}::${setId}`;
      const live = REL.has(key);
      for (const q of s.questions || [])
        for (const c of q.choices || []) {
          const n = norm(c.t);
          if (n.length < 12) continue;              // 짧은 선지는 우연 일치가 있다
          if (!bucket.has(n)) bucket.set(n, []);
          bucket.get(n).push({ key, yk, setId, qId: q.id, num: c.num, live, t: String(c.t) });
        }
    }

// 문항 쌍 단위로 겹침을 모은다
const pairs = new Map();    // "A|B" → [선지 텍스트…]
for (const [n, locs] of bucket) {
  if (locs.length < 2) continue;
  const spots = [...new Set(locs.map((l) => `${l.key}|Q${l.qId}`))];
  if (spots.length < 2) continue;                   // 같은 문항 안 중복은 별개 문제다
  for (let i = 0; i < spots.length; i++)
    for (let j = i + 1; j < spots.length; j++) {
      const id = [spots[i], spots[j]].sort().join("  ↔  ");
      if (!pairs.has(id)) pairs.set(id, []);
      pairs.get(id).push(locs.find((l) => `${l.key}|Q${l.qId}` === spots[i]).t);
    }
}

const rows = [];
for (const [id, texts] of pairs) {
  const [a, b] = id.split("  ↔  ");
  const [ka, qa] = a.split("|"), [kb, qb] = b.split("|");
  const [yka] = ka.split("::"), [ykb] = kb.split("::");
  const live = REL.has(ka) || REL.has(kb);
  const sameForm = formBase(yka) === formBase(ykb) && yka !== ykb;   // A형↔B형
  if (LIVE_ONLY && !live) continue;
  if (YEAR && yka !== YEAR && ykb !== YEAR) continue;
  rows.push({ a: ka, qa, b: kb, qb, n: texts.length, live, sameForm, texts });
}
rows.sort((x, y) => (y.live - x.live) || (y.n - x.n));

const real = rows.filter((r) => !r.sameForm);
const forms = rows.filter((r) => r.sameForm);
const heavy = real.filter((r) => r.n >= 3);

console.log("# 선지 오염 축 — 다른 문항의 선지가 섞여 들어왔는가");
console.log("");
console.log(`> 생성: \`node pipeline/choice_contamination_audit.mjs ${argv.join(" ")}\``);
console.log("> 진단만 한다. **아무것도 쓰지 않는다.** 판정은 원본 대조로만 한다(S-01).");
console.log("");
console.log("| 항목 | 수 |");
console.log("|---|--:|");
console.log(`| 검사 범위 | ${YEAR || (LIVE_ONLY ? `LIVE ${REL.size}세트` : "전체 396세트")} |`);
console.log(`| 🔴 **선지 3개 이상 겹침** | **${heavy.length}쌍** (LIVE ${heavy.filter((r) => r.live).length}) |`);
console.log(`| ⚠ 1~2개 겹침 | ${real.length - heavy.length}쌍 (LIVE ${real.filter((r) => r.n < 3 && r.live).length}) |`);
console.log(`| — A형↔B형 공유 (정상) | ${forms.length}쌍 |`);
console.log("");

const show = (title, list, note) => {
  if (!list.length) return;
  console.log(`## ${title}`);
  console.log("");
  if (note) { console.log(note); console.log(""); }
  console.log("| 문항 A | 문항 B | 겹침 | 노출 |");
  console.log("|---|---|--:|---|");
  for (const r of list)
    console.log(`| \`${r.a}\` ${r.qa} | \`${r.b}\` ${r.qb} | **${r.n}** | ${r.live ? "🔴 LIVE" : "—"} |`);
  console.log("");
};
show("🔴 선지 3개 이상 겹침 — 문항이 통째로 옮겨온 것에 가깝다", heavy);
show("⚠ 1~2개 겹침 — 우연일 수 있다. 원본 대조 필요", real.filter((r) => r.n < 3));

if (heavy.length) {
  console.log("### 겹친 선지 원문");
  console.log("");
  for (const r of heavy) {
    console.log(`**\`${r.a}\` ${r.qa} ↔ \`${r.b}\` ${r.qb}** — ${r.n}개`);
    r.texts.forEach((t) => console.log(`- ${t.replace(/\s+/g, " ").slice(0, 90)}`));
    console.log("");
  }
}

if (forms.length) {
  console.log("## A형↔B형 공유 — 같은 시행이라 정상");
  console.log("");
  for (const r of forms.slice(0, 40))
    console.log(`- \`${r.a}\` ${r.qa} ↔ \`${r.b}\` ${r.qb} — ${r.n}개${r.live ? " (LIVE)" : ""}`);
  if (forms.length > 40) console.log(`- … 외 ${forms.length - 40}쌍`);
  console.log("");
}

if (!real.length) console.log("✅ A/B형 공유를 뺀 선지 오염 없음");
console.log("> ⚠ 공백 제외 12자 미만 선지는 우연 일치가 많아 세지 않았다 — 짧은 선지 오염은 못 잡는다.");
