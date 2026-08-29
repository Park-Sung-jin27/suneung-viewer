// passage_gap_audit.mjs — 「본문 결손」 축 (발주 D-146 ①)
//
// ★ 왜 만드나
//   D-145 에서 2019수능::r2019b 의 (나) 「오발탄」 시나리오 1,673자가 통째로 없는 것을 찾았다.
//   그런데 release_diag 13축 어디에도 「문항이 참조하는 지문이 실재하는가」를 보는 축이 없었다.
//   ⑨ 마커 고아가 우연히 실마리를 준 것뿐이다. 그 우연을 규칙으로 바꾼다.
//
// 무엇을 보나 — 문항이 참조하는 것이 본문에 실재하는가
//   ⓐ 구획 참조   (가)/(나)/(다)/(라)/(마) 를 묻는데 그 구획 표시가 본문에 없다
//   ⓑ 장면 번호   #68 같은 시나리오 장면 번호를 묻는데 본문에도 <보기>에도 없다
//   ⓒ 구간 라벨   [A]~[F] 를 묻는데 annotations.json 에 정박이 없다  ★ release_diag ④축과 같은 규칙
//
//   원문자 마커(㉠ ⓐ)는 넣지 않는다 — release_diag ⑨축·marker_ref_audit 이 이미 같은 것을 본다.
//   중복 축을 두면 한쪽만 고치는 사고가 난다(발주 ① 「중복되면 통합」).
//
// ★ S-13 준수 — 축을 대장에 올리기 전에 최초 적발분을 실물로 확인했다
//   ⓐ 는 처음에 「참조 태그가 본문에 없으면 결함」으로 짰더니 123세트 중 115세트가 걸렸다.
//      원인 둘 — (1) 태그가 workTag 문장이 아니라 body 문장 선두에 붙는 세트가 있다
//               (2) 애초에 구획 표시 규약을 안 쓰는 세트가 47개다
//      → 문장 선두 태그도 인정 + 규약 미사용 세트는 판정 보류로 돌려 **2건**으로 줄였고,
//        그 2건을 원본 PDF 로 직접 확인했다(아래 ⓐ 주석).
//   ⓑ 는 처음에 <보기> 안 장면 번호까지 세어 l20156b(2015_6월 A/B형)를 오탐했다.
//      그 세트의 #98·#99 는 Q36 <보기>의 시나리오 각색본이라 본문에 없는 게 정상이다.
//      → 세트의 <보기> 전문을 함께 보도록 고쳐 오탐 0.
//
// ★ ⓐ 두 등급을 구분한다 — 「라벨만 없다」와 「본문이 없다」는 전혀 다르다
//   2021_6월::l20216d (LIVE): (가) 라벨이 없지만 전우치전 본문 s1~s17 은 그대로 있다 → 라벨 누락
//   2015수능B::l2015bB       : (나) 유한라산기 산문이 통째로 없다              → 본문 결손
//   프로그램은 둘을 구분하지 못한다. **원본 대조로만 판정한다**(S-01).
//   그래서 ⓐ 는 🔴 가 아니라 ⚠ 로 내고 「원본 대조 필요」를 붙인다.
//
// 진단만 한다. 아무것도 쓰지 않는다.
//
// 사용:
//   node pipeline/passage_gap_audit.mjs              전 데이터 396세트
//   node pipeline/passage_gap_audit.mjs --live       LIVE 세트만
//   node pipeline/passage_gap_audit.mjs --year 2027_9월   회차 단위 (스프린트 게이트 8-7)
//   node pipeline/passage_gap_audit.mjs "2019수능::r2019b" …   지정 세트만

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (f) => path.join(ROOT, "public/data", f);
const data = JSON.parse(fs.readFileSync(P("all_data_204.json"), "utf8"));
const ann = JSON.parse(fs.readFileSync(P("annotations.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

const flat = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const NL = String.fromCharCode(10);
const TAGS = ["(가)", "(나)", "(다)", "(라)", "(마)"];

const argv = process.argv.slice(2);
const LIVE_ONLY = argv.includes("--live");
const picks = argv.filter((x) => x.includes("::"));
// --year 는 스프린트 런북 8-7 이 쓴다. 없으면 전 세트를 훑고도 조용히 통과한 척한다(§13⑳)
const yi = argv.indexOf("--year");
const YEAR = yi >= 0 ? argv[yi + 1] : null;
if (yi >= 0 && !YEAR) { console.error("🔴 --year 뒤에 회차 키가 없다."); process.exit(1); }
if (YEAR && !data[YEAR]) { console.error(`🔴 회차 \`${YEAR}\` 가 데이터에 없다. 오타이거나 아직 안 만든 회차다.`); process.exit(1); }

const rows = [];
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const setId = s.setId || s.id;
      const key = `${yk}::${setId}`;
      const live = REL.has(key);
      if (picks.length) { if (!picks.includes(key)) continue; }
      else if (YEAR) { if (yk !== YEAR) continue; }
      else if (LIVE_ONLY && !live) continue;

      const sents = s.sents || [];
      const body = sents.map((x) => flat(x.t)).join(NL);
      const qs = s.questions || [];
      // 발문 + 선지 = 「참조하는 쪽」 / <보기> = 별도 (보기 안에서 자족하는 참조가 있다)
      const askText = qs.map((q) => flat(q.t) + " " + (q.choices || []).map((c) => flat(c.t)).join(" ")).join(" ");
      const bogiText = qs.map((q) => flat(q.bogi)).join(" ");

      // ⓐ 구획 참조
      const refTags = TAGS.filter((t) => askText.includes(t) || bogiText.includes(t));
      const bodyTags = new Set();
      for (const x of sents) {
        const t = flat(x.t).trim();
        for (const g of TAGS) {
          if (x.sentType === "workTag" && t.includes(g)) bodyTags.add(g);
          else if (t.startsWith(g)) bodyTags.add(g);
        }
      }
      // 규약 미사용 세트(본문에 구획 표시가 하나도 없음)는 이 축으로 판정하지 않는다
      const tagJudged = refTags.length > 0 && bodyTags.size > 0;
      const tagMiss = tagJudged ? refTags.filter((t) => !bodyTags.has(t)) : [];
      const tagSkip = refTags.length > 0 && bodyTags.size === 0;

      // ⓑ 장면 번호 — 본문에도 <보기>에도 없으면 결손
      const scenes = [...new Set(askText.match(/#\d{1,3}/g) || [])];
      const sceneMiss = scenes.filter((x) => !body.includes(x) && !bogiText.includes(x));

      // ⓒ 구간 라벨 — release_diag ④축과 같은 규칙(blank-box 도 정박으로 인정)
      //
      // ★ 「본문 구간」과 「<보기> 빈칸」을 반드시 갈라야 한다 (S-13, 첫 구현 오탐 4건 실증)
      //   「<보기>의 [A]에 들어갈 학생의 말」류는 본문에 꺾쇠가 없는 게 정상이다.
      //   가르지 않고 짰더니 LIVE 4세트(l20259b·r20229c·l20196c·r2020e)를 통째로 오탐했다.
      //   l20196c 는 [A]가 정상 정박돼 있는데 <보기>의 [B] 때문에 걸렸다.
      const labels = new Set();
      for (const q of qs) for (const m of flat(q.t).match(/\[([A-Z])\]/g) || []) labels.add(m.slice(1, -1));
      for (const x of sents) for (const m of flat(x.t).match(/\[([A-Z])\]/g) || []) labels.add(m.slice(1, -1));
      const inSent = new Set();
      for (const x of sents) for (const m of flat(x.t).match(/\[([A-Z])\]/g) || []) inSent.add(m.slice(1, -1));
      const stems = qs.map((q) => flat(q.t));
      const isBogiSlot = (L) => !inSent.has(L) && stems.some((t) =>
        new RegExp(`<\\s*보\\s*기\\s*>[^.?]{0,12}\\[${L}\\]`).test(t)
        || new RegExp(`\\[${L}\\][^.?]{0,10}들어갈`).test(t));
      const list = ann[yk]?.[setId] || [];
      const labMiss = [...labels].filter((L) => !isBogiSlot(L) && !list.some((a2) => a2
        && (a2.type === "bracket" || a2.type === "blank-box")
        && String(a2.label ?? a2.marker ?? "") === L));

      const total = tagMiss.length + sceneMiss.length + labMiss.length;
      if (total || tagSkip) rows.push({ yk, setId, key, live, sents: sents.length, refTags, bodyTags: [...bodyTags], tagMiss, tagSkip, scenes, sceneMiss, labels: [...labels], labMiss, total });
    }

const scanned = picks.length ? `지정 ${picks.length}세트` : YEAR ? `${YEAR} 회차` : LIVE_ONLY ? `LIVE ${REL.size}세트` : "396(전체)";
const hit = rows.filter((r) => r.total);
const skip = rows.filter((r) => !r.total && r.tagSkip);

console.log(`# 본문 결손 축 — 문항이 참조하는 지문이 실재하는가`);
console.log("");
console.log(`> 생성: \`node pipeline/passage_gap_audit.mjs ${argv.join(" ")}\``);
console.log(`> 진단만 한다. **아무것도 쓰지 않는다.** 판정은 원본 대조로만 한다(S-01).`);
console.log("");
console.log("| 항목 | 수 |");
console.log("|---|--:|");
console.log(`| 검사한 세트 | ${scanned} |`);
console.log(`| **결손 보유** | **${hit.length}** (LIVE ${hit.filter((r) => r.live).length}) |`);
console.log(`| 구획 규약 미사용 — 이 축으로 판정 불가 | ${skip.length} |`);
console.log("");

if (hit.length) {
  console.log("## 결손 보유 세트");
  console.log("");
  console.log("| 회차 | 세트 | 노출 | 문장 | ⓐ 구획 | ⓑ 장면번호 | ⓒ 구간라벨 |");
  console.log("|---|---|---|--:|---|---|---|");
  for (const r of hit.sort((a, b) => (b.live - a.live) || (b.total - a.total))) {
    console.log(`| ${r.yk} | \`${r.setId}\` | ${r.live ? "🔴 LIVE" : "—"} | ${r.sents} | `
      + `${r.tagMiss.length ? "⚠ " + r.tagMiss.join("") + " 없음" : "—"} | `
      + `${r.sceneMiss.length ? "🔴 " + r.sceneMiss.length + "개 부재" : "—"} | `
      + `${r.labMiss.length ? "🔴 " + r.labMiss.map((x) => `[${x}]`).join(" ") + " 미정박" : "—"} |`);
  }
  console.log("");
  console.log("### 상세");
  console.log("");
  for (const r of hit.sort((a, b) => (b.live - a.live) || (b.total - a.total))) {
    console.log(`**${r.key}**${r.live ? " 🔴 **LIVE**" : ""} — 문장 ${r.sents}`);
    if (r.tagMiss.length)
      console.log(`- ⚠ 구획 **${r.tagMiss.join(" ")}** 를 묻는데 본문에 그 표시가 없다`
        + ` (본문에 있는 표시: ${r.bodyTags.join(" ") || "없음"})`
        + ` — **원본 대조 필요**: 라벨만 빠진 것인지, 본문이 통째로 없는 것인지는 프로그램이 구분하지 못한다`);
    if (r.sceneMiss.length)
      console.log(`- 🔴 장면 번호 **${r.sceneMiss.join(" ")}** 를 묻는데 본문에도 <보기>에도 없다`
        + ` — 시나리오 지문 결손이 거의 확실하다`);
    if (r.labMiss.length)
      console.log(`- 🔴 구간 **${r.labMiss.map((x) => `[${x}]`).join(" ")}** 미정박 — 화면에 꺾쇠가 안 그려진다`
        + ` (release_diag ④축과 같은 것을 본다)`);
    console.log("");
  }
}

if (skip.length) {
  console.log("## 구획 규약 미사용 — 이 축으로 판정 불가");
  console.log("");
  console.log(`본문에 (가)/(나) 표시가 하나도 없는 세트다. 참조는 하는데 표시 규약을 안 쓴다.`);
  console.log(`**「결함 없음」이 아니라 「이 축이 못 본다」는 뜻이다**(S-15 스코프 명시).`);
  console.log("");
  for (const r of skip.sort((a, b) => (b.live - a.live) || a.yk.localeCompare(b.yk)))
    console.log(`- ${r.live ? "🔴 LIVE " : ""}\`${r.key}\` 참조 ${r.refTags.join("")} · 문장 ${r.sents}`);
  console.log("");
}

console.log("> ⚠ 이 축이 통과시켰다고 본문이 온전하다는 뜻은 아니다 — **참조되는 것**만 본다.");
console.log("> 참조가 없는 구간이 통째로 빠져도 이 축은 못 잡는다.");
console.log("> 원문자 마커(㉠ ⓐ)는 `release_diag` ⑨축·`marker_ref_audit` 이 본다 — 여기서 중복하지 않는다.");
