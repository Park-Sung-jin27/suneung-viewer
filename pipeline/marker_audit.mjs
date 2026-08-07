// marker_audit.mjs — 마커 무결성 4축 통합 감사
//
// [축 정의]  (발주 bx③ 교정 반영본)
//   축 A  커버리지 결손 : 발문이 범위로 선언한 마커 중 선지가 다루지 않은 것이 있다
//                         단, 어휘 대체 문항("문맥상 … 의미/바꿔 쓰기")은 제외
//   축 B  계열 불일치   : 해설이 쓰는 마커 계열이 허용 집합(본문∪발문∪보기∪선지) 밖이다
//   축 C  번호 충돌     : 보기가 마커로 쓰는 원숫자가 그 문항의 선지 번호와 겹친다
//   축 D  역할 충돌     : 한 마커가 서로 다른 두 문항에서 보기 정의·본문 정박으로 이중 사용된다
//
// [양성 회귀]  `node pipeline/marker_audit.mjs --regress`
//   pipeline/fixtures/ 의 픽스처를 읽어 각 축이 기지 결함을 잡는지 검사한다.
//   하나라도 못 잡으면 종료 코드 1. 검사기를 수정하면 반드시 먼저 통과시킬 것(§13⑮(7)).
//   "0건"은 회귀 통과 후에만 유효하다. git 이력을 뒤질 필요 없이 픽스처로 고정돼 있다.
//     축 A : l20266a Q18 (현행) · l20196b Q31 (a458ea4~1)
//     축 B : r2023d Q16 (현행)
//     축 C·D : r2020e Q17·Q19 (55e1776~1)
//
// [현재 기준선]  LIVE(RELEASE_KEYS) 전수, 2026-08-07 시점
//   축 A = 1 · 축 B = 21 · 축 C = 0 · 축 D = 0
//   축 A 잔여 1 = l20266a Q18 (선지 마커 2건 오기 + 본문 정박 3건 불일치, 미처리)
//
// ⚠ 이력: 심사관 원안(축 A 코드 + 축 B·C·D 정의)이 전달 유실되어, 위 회귀 케이스로부터
//    성격을 역추론해 독립 구현했다. 판정식을 전달받지 않은 상태의 독립 매처(§13⑱(2)).
//    1차 구현의 famOf 가 ㉠ 을 U+3220(㈠)으로 잘못 적어 축 B 가 전 코퍼스를 오판했고,
//    축 A 도 "본문 미정박"으로 역추론해 회귀 케이스를 놓쳤다 — 둘 다 회귀 선행으로 발견.
//
// 읽기 전용. 데이터 기록 없음.
//   사용: node pipeline/marker_audit.mjs [--data=<path>] [--all]
//         기본은 LIVE(RELEASE_KEYS) 전수. --all 이면 비노출 포함.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { expandMarkerRanges } from "./marker_range.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const DATA = (argv.find((a) => a.startsWith("--data=")) || "").split("=")[1]
  || path.join(ROOT, "public/data/all_data_204.json");
const ALL = argv.includes("--all");
const ONLY = (argv.find((a) => a.startsWith("--only=")) || "").split("=")[1] || "";

// ── 양성 회귀 모드: 픽스처를 자기 자신에게 먹여 각 축이 기지 결함을 잡는지 확인 ──
if (argv.includes("--regress")) {
  const { execFileSync } = await import("child_process");
  const dir = path.join(__dirnameSafe(), "fixtures");
  // 이 감사의 픽스처만 — fixtures/ 에는 다른 도구의 픽스처도 함께 있다
  const files = fs.readdirSync(dir).filter((f) => /^axis[A-D]+_.*\.json$/.test(f)).sort();
  if (!files.length) { console.error("★ 픽스처 0건 — 회귀 불가"); process.exit(1); }
  let fail = 0;
  console.log(`양성 회귀 — 픽스처 ${files.length}건 (${dir})\n`);
  for (const f of files) {
    const fx = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const axes = (f.match(/^axis([A-D]+)_/) || [, ""])[1].split("");
    for (const ax of axes) {
      const out = execFileSync(process.execPath,
        [fileURLToPath(import.meta.url), `--data=${path.join(dir, f)}`, `--only=${ax}`, "--all"],
        { encoding: "utf8" });
      const n = (out.match(/^\s*[🔴⚪]/gm) || []).length;
      const ok = n > 0;
      if (!ok) fail++;
      console.log(`  ${ok ? "✅" : "🔴 실패"}  축 ${ax}  ${f}  검출 ${n}건`);
      if (!ok) console.log(`        기대: ${fx._comment}`);
    }
  }
  console.log(`\n${fail ? `★ 회귀 실패 ${fail}건 — 검사기가 기지 결함을 못 잡습니다. "0건"을 신뢰하지 마십시오.` : "회귀 전건 통과 — 이후의 0건 판정은 유효합니다."}`);
  process.exit(fail ? 1 : 0);
}
function __dirnameSafe() { return path.dirname(fileURLToPath(import.meta.url)); }

const D = JSON.parse(fs.readFileSync(DATA, "utf8"));
const dl = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const RK = new Set([...dl.match(/const RELEASE_KEYS = new Set\(\[([\s\S]*?)\]\)/)[1]
  .matchAll(/"([^"]+)"/g)].map((m) => m[1]));

const NUMS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
const MARKER = /[㉠-㉯ⓐ-ⓩⒶ-Ⓩ①-⑳]/g;
// ⚠ 경계값 실측(§13⑮(7)): ㉠ = U+3260 (원 한글). U+3220 은 ㈠(괄호한글 숫자)로 다른 문자다.
//   1차 구현은 0x3220 으로 적어 전 코퍼스가 "?" 계열이 되어 축 B 가 79건 오탐을 냈다.
const famOf = (c) => { const v = c.codePointAt(0);
  if (v >= 0x3260 && v <= 0x326f) return "㉠";   // ㉠-㉯ 원 한글 자모
  if (v >= 0x3270 && v <= 0x327f) return "㉰";   // ㉰-㉿ 원 한글 음절
  if (v >= 0x24d0 && v <= 0x24e9) return "ⓐ";
  if (v >= 0x24b6 && v <= 0x24cf) return "Ⓐ";
  if (v >= 0x2460 && v <= 0x2473) return "①";
  return "?"; };
const flat = (v) => { const a = []; (function w(x) {
  if (typeof x === "string") a.push(x);
  else if (Array.isArray(x)) x.forEach(w);
  else if (x && typeof x === "object") Object.values(x).forEach(w);
})(v); return a.join(" "); };
const mk = (s) => [...new Set(String(s || "").match(MARKER) || [])];

const F = { A: [], B: [], C: [], D: [] };
for (const yk of Object.keys(D)) for (const g of ["reading", "literature"]) for (const s of (D[yk] || {})[g] || []) {
  const live = RK.has(`${yk}::${s.id}`);
  if (!ALL && !live) continue;

  const bodyMk = new Set();
  for (const sn of s.sents || []) for (const m of mk(sn.t)) bodyMk.add(m);
  const bodyFam = new Set([...bodyMk].map(famOf));
  const owner = new Map();                       // 축 D: 마커 → 그 마커를 "정의"하는 문항들

  for (const q of s.questions || []) {
    const n = (q.choices || []).length;
    const stem = String(q.t || ""), bogi = flat(q.bogi);
    const ref = new Set([...expandMarkerRanges(stem), ...expandMarkerRanges(bogi), ...mk(stem), ...mk(bogi)]);
    const loc = `${yk}|${s.id} Q${q.id}`;

    // ── 축 A : 발문 범위가 선언한 마커 중 선지가 다루지 않은 것 (커버리지 결손) ──
    //   회귀 l20266a Q18 실측으로 정의 확정: 발문 ㉠~㉤(5) vs 선지 ㉠㉣㉤(3) → ㉡㉢ 결손.
    //   (1차 역추론 "본문 미정박"은 이 케이스를 못 잡아 폐기 — 본문에는 ㉡㉢이 실재했다.)
    //   [발주 bx③] 허용 제외: 어휘 대체 문항은 선지가 마커를 안 쓰는 것이 정상 형식이다.
    {
      const vocabForm = /문맥상/.test(stem) && /(의미|바꿔\s*쓰기)/.test(stem);
      const declared = vocabForm ? new Set() : expandMarkerRanges(stem);
      if (declared.size >= 2) {
        const inChoices = new Set();
        for (const c of q.choices || []) for (const m of mk(c.t)) inChoices.add(m);
        const miss = [...declared].filter((m) => !inChoices.has(m));
        if (miss.length) F.A.push({ loc, live,
          detail: `발문선언=[${[...declared].join("")}] 선지사용=[${[...inChoices].join("")}] ★미다룸=[${miss.join("")}]` });
      }
    }
    // ── 축 B : 해설 마커 계열 ≠ 본문 마커 계열 ───────────────────────────
    //   [발주 bx③] 허용 집합 = 본문 ∪ 발문 ∪ 보기 ∪ 선지 (문항이 실제로 쓰는 계열 전부)
    const okFam = new Set(bodyFam);
    for (const m of [...mk(stem), ...mk(bogi)]) okFam.add(famOf(m));
    for (const c of q.choices || []) for (const m of mk(c.t)) okFam.add(famOf(m));
    for (const c of q.choices || []) {
      const am = mk(c.analysis).filter((m) => { const i = NUMS.indexOf(m); return !(i >= 0 && i < n); });
      if (!am.length || !okFam.size) continue;
      const badFam = [...new Set(am.map(famOf))].filter((f) => !okFam.has(f));
      if (badFam.length) F.B.push({ loc: `${loc}-${c.num}`, live,
        detail: `해설계열=[${[...new Set(am.map(famOf))].join("")}] 허용=[${[...okFam].join("")}] 이질=[${badFam.join("")}] 기호=[${am.join("")}]` });
    }
    // ── 축 C : 보기·선지가 마커로 쓰는 원숫자가 선지 번호와 충돌 ─────────
    {
      const bogiNum = mk(bogi).filter((m) => { const i = NUMS.indexOf(m); return i >= 0 && i < n; });
      // 보기가 원숫자를 "정의"로 쓰면(= 그 뒤에 설명이 붙음) 선지 번호와 충돌한다
      const clash = bogiNum.filter((m) => new RegExp(`${m}\\s*\\S`).test(bogi));
      if (clash.length) F.C.push({ loc, live, detail: `선지 ${n}개인데 보기가 마커로 사용=[${clash.join("")}]` });
    }
    // ── 축 D 준비 : 이 문항이 "정의"하는 마커 (보기 안에서 정의된 것) ────
    for (const m of mk(bogi)) {
      if (!owner.has(m)) owner.set(m, new Set());
      owner.get(m).add(`Q${q.id}:보기`);
    }
    for (const m of ref) if (bodyMk.has(m)) {
      if (!owner.has(m)) owner.set(m, new Set());
      owner.get(m).add(`Q${q.id}:본문`);
    }
  }
  // ── 축 D : 한 마커가 세트 안에서 보기 정의와 본문 정박을 동시에 가진다 ──
  //   [발주 bx③] "서로 다른 두 문항"에서 정의·정박될 때만 충돌. 같은 문항 내 재인용은 정상.
  for (const [m, who] of owner) {
    const kinds = new Set([...who].map((x) => x.split(":")[1]));
    const qs = new Set([...who].map((x) => x.split(":")[0]));
    if (kinds.size > 1 && qs.size > 1) F.D.push({ loc: `${yk}|${s.id}`, live,
      detail: `마커 ${m} 이 ${[...who].join(" / ")} 로 문항 간 이중 사용` });
  }
}

// ── 출력 ────────────────────────────────────────────────────────────────
const NAME = { A: "정박 결손(발문 참조 마커가 본문에 없음)", B: "계열 불일치(해설 마커 계열 ≠ 본문 계열)",
               C: "번호 충돌(보기 마커가 선지 번호와 겹침)", D: "역할 충돌(한 마커가 보기 정의+본문 정박 이중)" };
console.log(`데이터: ${DATA}`);
console.log(`스코프: ${ALL ? "전수" : "LIVE(RELEASE_KEYS)"}  /  RELEASE_KEYS ${RK.size}키\n`);
for (const k of ["A", "B", "C", "D"]) {
  if (ONLY && ONLY !== k) continue;
  const rows = F[k];
  console.log(`═══ 축 ${k} — ${NAME[k]} : ${rows.length}건 [LIVE ${rows.filter((r) => r.live).length}] ═══`);
  for (const r of rows) console.log(`  ${r.live ? "🔴" : "⚪"} ${r.loc}  ${r.detail}`);
  console.log("");
}
