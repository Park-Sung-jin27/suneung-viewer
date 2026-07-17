// release_gate_v3.mjs — 출시 게이트 강화 (read-only 진단, 데이터 절대 무수정)
// ─────────────────────────────────────────────────────────────────────────────
// 목적: 출시(RELEASE) 영역 해설의 "원문 충실도"를 자동 검사해 r2025b류(지문 없이
//       생성된 환각 해설)가 게이트를 통과한 채 라이브로 나가는 사고를 막는다.
//
// 검사 계층 (FP율 기준):
//   [CRITICAL] C1 결론줄=ok : 해설 마지막 ✅/❌ 결론이 choice.ok 와 일치해야 함.
//                            결론 이모지 없음/반대 = 출시 차단. (오탐 거의 0)
//   [CRITICAL] C2 환각 자백 : 해설에 "지문이 제공되지 않았", "일반적 서술에 근거",
//                            "ground truth" 등 지문 없이 작성됐음을 자백하는 문구.
//                            = 출시 차단. (오탐 거의 0)
//   [WARN]     C3 📌 단편부재: '📌 지문 근거' 인용을 단편 단위로 분해 후 본문에
//                            exact 존재하는지. 부재분 = 사람 검수 대상.
//                            ※ CRITICAL 아님 — 📌이 의역/요약으로 쓰인 set이 있어
//                              substring 만으로는 오탐(독서 ~13%)이 불가피. 진단용.
//   [WARN]     C4 렌더포맷  : 해설 내 **마크다운 볼드** = 뷰어에서 ** 문자 노출 위험.
//
// 사용:
//   node pipeline/release_gate_v3.mjs                 # 라이브만, 요약+CRITICAL+WARN
//   node pipeline/release_gate_v3.mjs --all-sets      # 비노출 포함
//   node pipeline/release_gate_v3.mjs --data=<경로>   # 회귀 테스트용 다른 all_data
//   node pipeline/release_gate_v3.mjs --warn          # WARN 상세까지 전부 출력
// 종료코드: CRITICAL>0 이면 1 (CI/배포 전 게이트로 사용), 아니면 0.
// 데이터는 읽기만 함. RELEASE 정의는 src/dataLoader.js RELEASE_KEYS(yk::setId) 단일 진실.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "fs";

const args = process.argv.slice(2);
const dataPath =
  (args.find((a) => a.startsWith("--data=")) || "").split("=")[1] ||
  "public/data/all_data_204.json";
const allSets = args.includes("--all-sets");
const showWarn = args.includes("--warn");

const d = JSON.parse(fs.readFileSync(dataPath, "utf8"));

// RELEASE_KEYS (yearKey::setId) 파싱 — setId 충돌(2014~2016 A/B 등) 대응 위해 복합키.
function loadReleaseKeys() {
  const keys = new Set();
  try {
    const src = fs.readFileSync("src/dataLoader.js", "utf8");
    const m = src.match(/RELEASE_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
    if (m) for (const mm of m[1].matchAll(/"([^"]+::[^"]+)"/g)) keys.add(mm[1]);
  } catch {}
  return keys;
}
const RELEASE = loadReleaseKeys();
if (RELEASE.size === 0)
  console.warn("⚠ RELEASE_KEYS 파싱 0건 — dataLoader.js 포맷 확인 필요");

// 인라인 마커 제거(검사 한정, 데이터 비수정): 원형문자·천부호·각괄호 마커는 본문에
// 인라인 저장되지 않을 수 있어, 인용/본문 양쪽에서 동일하게 제거 후 대조한다.
const MARK = /[Ⓐ-ⓩ①-⑳㈀-㉃㉠-㊿㋐-㋾]|\[[^\]]*\]/g;
const stripMark = (s) => (s || "").replace(MARK, "");
// 진단용 정규화(공백·따옴표류만) — exact-fail 후 "공백/따옴표 차이뿐"인지 판별.
const QUO = /[\s"“”‘’「」『』･·．。,、~～]/g;
const norm = (s) => stripMark(s).replace(QUO, "");

// '📌 지문 근거' 줄 추출
function citeLines(ana) {
  const out = [];
  const re = /📌\s*지문\s*근거:\s*([^\n]*)/g;
  let m;
  while ((m = re.exec(ana)) !== null) out.push(m[1]);
  return out;
}
// 인용 줄 → 단편 배열: 따옴표로 다중 인용 분리 + 생략기호(...…⋯)·" / "로 sub-span 분리
function fragments(line) {
  const parts = line.split('"');
  let segs = [];
  for (let i = 1; i < parts.length; i += 2) segs.push(parts[i]);
  if (segs.length === 0) segs = [line];
  const out = [];
  for (const seg of segs)
    for (const sub of seg.split(/\.{2,}|…|⋯|\s\/\s/)) {
      const t = sub.trim();
      if (t) out.push(t);
    }
  return out;
}
function lastConclusion(ana) {
  let last = null;
  for (const ch of ana) {
    if (ch === "✅") last = true;
    else if (ch === "❌") last = false;
  }
  return last; // null = 결론 이모지 없음
}

// C2 환각 자백 표지 (명백한 것만 — 오탐 회피)
const HALLUC = [
  /지문이?\s*제공되지\s*않았/,
  /제공된\s*지문이?\s*없/,
  /일반적\s*서술에\s*근거/,
  /일반적인?\s*내용에\s*근거/,
  /\bground truth\b/i,
];

const C1 = [],
  C2 = [],
  C3 = [],
  C4 = [];
let nSets = 0,
  nChoices = 0,
  nFrag = 0;

for (const yk of Object.keys(d))
  for (const cat of ["reading", "literature"])
    for (const s of d[yk][cat] || []) {
      const live = RELEASE.has(yk + "::" + s.id);
      if (!allSets && !live) continue;
      nSets++;
      const sents = s.sents || [];
      const hayS = stripMark(sents.map((x) => x.t || "").join(" "));
      const hayN = norm(sents.map((x) => x.t || "").join(" "));
      for (const q of s.questions || [])
        for (const c of q.choices || []) {
          nChoices++;
          const ana = c.analysis || "";
          if (typeof ana !== "string" || !ana.trim()) continue;
          const loc = `${yk} ${s.id} ${q.id}-${c.num} ok:${c.ok}`;

          // C1
          const concl = lastConclusion(ana);
          if (concl === null) C1.push(`${loc} | 결론 이모지 없음`);
          else if (concl !== c.ok)
            C1.push(`${loc} | 결론=${concl ? "✅" : "❌"} ↔ ok 불일치`);

          // C2
          for (const re of HALLUC)
            if (re.test(ana)) {
              const mm = ana.match(re);
              C2.push(`${loc} | "${mm ? mm[0] : ""}"`);
              break;
            }

          // C4 (마크다운 볼드)
          if (/\*\*[^*\n]+\*\*/.test(ana)) {
            const mm = ana.match(/\*\*[^*\n]+\*\*/);
            C4.push(`${loc} | ${mm ? mm[0].slice(0, 30) : ""}`);
          }

          // C3 (📌 단편 부재) — WARN
          for (const line of citeLines(ana))
            for (const frag of fragments(line)) {
              const fH = frag.replace(/[^가-힣]/g, "");
              if (fH.length < 6) continue;
              nFrag++;
              if (hayS.includes(stripMark(frag))) continue; // exact PASS
              if (hayN.includes(norm(frag))) continue; // 공백/따옴표뿐 → 통과 처리
              C3.push(`${loc} | ${JSON.stringify(frag.slice(0, 60))}`);
            }
        }
    }

const scope = allSets ? "전체(라이브+비노출)" : "RELEASE(라이브)";
const CRIT = C1.length + C2.length;
console.log(
  `=== release_gate_v3 | scope=${scope} | sets=${nSets} choices=${nChoices} frags=${nFrag} ===`,
);
console.log(`[CRITICAL] C1 결론줄 결함        : ${C1.length}`);
console.log(`[CRITICAL] C2 환각 자백          : ${C2.length}`);
console.log(`[WARN]     C3 📌 단편 부재(검수) : ${C3.length}`);
console.log(`[WARN]     C4 마크다운 볼드(포맷): ${C4.length}`);
console.log(`>>> CRITICAL = ${CRIT}  (출시 차단 ${CRIT > 0 ? "🔴" : "🟢"})`);

console.log("\n--- [CRITICAL] C1 결론줄 ---");
C1.forEach((x) => console.log("  " + x));
console.log("\n--- [CRITICAL] C2 환각 자백 ---");
C2.forEach((x) => console.log("  " + x));

if (showWarn) {
  console.log("\n--- [WARN] C3 📌 단편 부재 (전체) ---");
  C3.forEach((x) => console.log("  " + x));
  console.log("\n--- [WARN] C4 마크다운 볼드 (전체) ---");
  C4.forEach((x) => console.log("  " + x));
} else {
  console.log(
    `\n(WARN 상세 생략 — 전체 보려면 --warn. C3 ${C3.length}건 / C4 ${C4.length}건)`,
  );
}

process.exit(CRIT > 0 ? 1 : 0);
