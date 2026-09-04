// set_intake_gate.mjs — 세트 탑재 검사 5종 (발주 D-199 ①)
//
// 왜 만드는가: 2027_9월 l20279b 를 넣던 날, 자동 게이트를 **전부 통과하고**
//   지면 대조에서만 드러난 결함이 넷이었다. 넷 다 학생 화면에 바로 보이는 것들이다.
//     ⑴ 발문의 빈칸 기입란이 소실돼 「학 생 : 에 해당해요.」로 읽혔다
//     ⑵ 지문 여백의 꺾쇠 라벨이 선지 끝에 흘러들어 「…있다.\n[A]\n[B]\n[C]」가 됐다
//     ⑶ 신규 세트라 annotations 가 통째로 없어 [A][B][C] 구간이 화면에 안 그려졌다
//     ⑷ 📌 인용에 원문에 없는 종결 부호·이음표·말줄임이 붙었다
//   여기에 심사관 검사 A 를 고친 A′ 를 더한다(아래).
//
// ★ A′ — 마커 앵커 정합. 원래 검사 A 는 marker 항목의 앵커를 「그 마커가 박힌 문장」과
//   1:1로만 비교해서, 마커 하나가 여러 문장에 걸친 밑줄을 대표하는 경우를 전부
//   밀림으로 셌다(2027_6월 l20276a 8건 오탐). 고친 규칙:
//     앵커가 마커 문장과 달라도 「그 마커 문장에서 시작하는 연속 구간」 안이면 정상.
//     구간 밖이거나 역방향(앵커가 마커 문장보다 앞)이면 FAIL.
//   구간 끝은 다음 마커가 박힌 문장까지 포함한다 — 마커는 문장 중간에서 시작하므로
//   경계 문장은 앞뒤 두 구간에 걸친다(l20276a ㉠ 의 앵커 s26 이 그 경우다).
//
// 사용:
//   node pipeline/set_intake_gate.mjs --year 2027_9월
//   node pipeline/set_intake_gate.mjs "2027_9월::l20279b" "2025_9월::l20259b"
//   node pipeline/set_intake_gate.mjs --live          (RELEASE_KEYS 전수)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractQuotes, quoteResolved } from "./haesol_v2_gate.mjs";
// ★ 프론트 렌더가 쓰는 규칙을 그대로 import 한다. 복사하면 정본이 첫날에 갈라진다
//   (marker_chars.json 에 ㉯~㉲ 가 빠져 게이트가 5개 중 1개만 본 사고와 같은 형태).
import { isDialogueBlock, foldLayoutBreaks, foldIfAnnSafe, RE_NAMED, RE_SCENE }
  from "../src/layoutBreaks.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// --data / --ann 은 회귀 시험용이다. 수리 전 백업이나 fixture 를 물려
//   「고쳐진 결함을 이 게이트가 실제로 잡는가」를 확인한다. 기본은 정본이다.
const argRaw = process.argv.slice(2);
const pick = (k, d) => { const i = argRaw.indexOf(k); return i >= 0 ? argRaw[i + 1] : d; };
const DATA_PATH = pick("--data", path.join(ROOT, "data-source/all_data_204.json"));
const ANN_PATH = pick("--ann", path.join(ROOT, "public/data/annotations.json"));
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const ann = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));
const dl = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const RELEASE = (() => {
  const at = dl.indexOf("const RELEASE_KEYS = new Set([");
  return new Set([...dl.slice(at, dl.indexOf("]);", at)).matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.includes("::")));
})();

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const YEAR = opt("--year");
const LIVE_ONLY = argv.includes("--live");
const KEYS = argv.filter((a) => a.includes("::"));
const IS_REGRESS = [DATA_PATH, ANN_PATH].some((p) => p.includes("backups") || p.includes("fixtures"));
if (IS_REGRESS)
  console.log(`> 회귀 시험 모드 — data=${path.basename(DATA_PATH)} · ann=${path.basename(ANN_PATH)}\n`);

const targets = [];
for (const [yk, v] of Object.entries(data)) for (const sec of ["reading", "literature"]) for (const s of v[sec] || []) {
  const sid = s.setId || s.id, key = `${yk}::${sid}`;
  if (KEYS.length && !KEYS.includes(key)) continue;
  if (YEAR && yk !== YEAR) continue;
  if (LIVE_ONLY && !RELEASE.has(key)) continue;
  if (!KEYS.length && !YEAR && !LIVE_ONLY) continue;
  targets.push({ yk, sid, key, sec, set: s });
}
if (!targets.length) { console.error("검사 대상이 없다 — --year / --live / \"회차::세트\" 중 하나를 주십시오"); process.exit(1); }

const MARK = /[ⓐ-ⓔ㉠-㉿]/;
const RE_LABEL = /\[([A-F])\]/g;
// 줄이 조사로 시작 = 앞에 있어야 할 말이 사라진 자리.
//   ★ 조사 뒤 공백을 필수로 둔다. \s* 로 두면 「가장 적절한 것은?」의 「가」를 조사로
//     읽어 정상 발문을 걸어 버린다(l20279a Q20 오탐). 조사는 앞말에 붙고 뒤는 띄운다.
const 조사 = /^[에은는이가을를와과로도만의]\s+[가-힣]/;

// ── 렌더 정합 A축 (발주 D-200) ────────────────────────────────────────
//   데이터에 개행이 있어도 프론트가 접어 버리면 화면에서는 한 덩어리가 된다.
//   게이트 5종이 전부 데이터 축이라 이걸 아무도 못 봤다 — 대표가 화면을 보고서야
//   드러났다(발문 21 · 보기 155곳).
//
// ★ 판정식을 여기서 다시 쓰지 않는다 — 정본 함수를 부른다. 규칙을 재현하면
//   프론트가 바뀌어도 게이트는 옛 동작을 계속 재고, 이미 고쳐진 것을 경보한다.
//   F-57 이 대화형 판정을 확장했을 때 실제로 그럴 뻔했다(WARN 9 가 그대로 나온다).
// ★ 대화형 판정은 이름 패턴이 아니라 **반복**으로 한다(심사관 확정).
//   ^<짧은 이름> : 을 그대로 받으면 「그가 말했다 : …」 같은 산문이 걸린다.
//   대본·대담은 화자가 되풀이되고 산문의 단발 콜론은 되풀이되지 않는다.
//   LIVE 126블록 음성 시험에서 새로 걸린 9블록이 전부 진짜 대화형이었다(오탐 0).

const findings = [];
const add = (t, axis, level, msg, where) => findings.push({ key: t.key, live: RELEASE.has(t.key), axis, level, msg, where });

for (const t of targets) {
  const { set } = t;
  const sents = set.sents || [];
  const ids = sents.map((s) => String(s.id));
  const txt = (id) => String((sents.find((s) => String(s.id) === String(id)) || {}).t || "");
  const list = (ann[t.yk] || {})[t.sid] || [];

  // ── ⑴ 발문 빈칸 소실 ──────────────────────────────────────────────────
  for (const q of set.questions || []) {
    const T = String(q.t || "");
    if (T.includes("_")) continue;                       // 빈칸 표기가 이미 있다
    for (const line of T.split("\n")) {
      const L = line.trim();
      if (!L) continue;
      // ① 줄이 조사로 시작한다 — 앞에 있어야 할 말이 없다
      if (조사.test(L)) { add(t, "⑴빈칸소실", "FAIL", `발문 줄이 조사로 시작한다 — 빈칸 기입란이 소실된 자리다: ${JSON.stringify(L.slice(0, 30))}`, `Q${q.id}`); continue; }
      // ② 「… : 에 해당해요」 — 콜론 뒤가 곧바로 조사다
      const m = L.match(/[:：]\s*([에은는이가을를와과로])\s*[가-힣]/);
      if (m) add(t, "⑴빈칸소실", "FAIL", `콜론 뒤가 곧바로 조사 「${m[1]}」다 — 채워 넣을 자리가 비어 있다: ${JSON.stringify(L.slice(0, 34))}`, `Q${q.id}`);
    }
  }

  // ── ⑵ 선지에 구간 라벨 혼입 ───────────────────────────────────────────
  for (const q of set.questions || []) for (const c of q.choices || []) {
    for (const line of String(c.t || "").split("\n")) {
      const L = line.trim();
      if (/^\[[A-F]\]$/.test(L))
        add(t, "⑵라벨혼입", "FAIL", `선지 본문에 구간 라벨 ${L} 이 단독 줄로 들어 있다 — 지문 여백 라벨이 흘러든 것이다`, `Q${q.id}#${c.num}`);
    }
  }

  // ── ⑶ 구간 라벨을 참조하는데 bracket 이 없다 ──────────────────────────
  const refLabels = new Set();
  for (const q of set.questions || []) {
    let s = String(q.t || "");
    for (const c of q.choices || []) s += "\n" + String(c.t || "");
    for (const m of s.matchAll(RE_LABEL)) refLabels.add(m[1]);
  }
  const haveBr = new Set(list.filter((a) => a.type === "bracket").map((a) => a.label));
  if (refLabels.size && !haveBr.size)
    add(t, "⑶구간부재", "FAIL", `문항이 [${[...refLabels].join("][")}] 를 참조하는데 이 세트의 annotations 에 bracket 이 하나도 없다 — 신규 세트에 구간 표시가 안 만들어졌다`, "");
  else for (const L of refLabels) if (!haveBr.has(L))
    add(t, "⑶구간부재", "FAIL", `[${L}] 를 참조하는데 bracket 이 없다`, "");
  // ★ 같은 축에 「마커는 있는데 주석이 통째로 없다」를 합산한다(심사관 승인).
  //   구간 라벨 부재와 주석 전무는 원인이 달라도 결과가 같다 — 화면에 표시가
  //   아예 안 그려진다. 따로 세면 한 결함이 두 수치로 흩어진다. 사유는 나눠 적는다.
  //   지면 표본 6건 전건에서 마커 어구에 밑줄이 실재했다(PDF 벡터 좌표 판독,
  //   음성 대조 10/10) — 주석이 없는 것은 조판 관례가 아니라 누락이다.
  {
    const mk = new Set((sents || []).flatMap((x) => String(x.t).match(/[ⓐ-ⓔ㉠-㉤]/g) || []));
    if (mk.size && !list.length)
      add(t, "⑶구간부재", "FAIL",
        `본문에 마커 ${[...mk].join("")} 가 있는데 이 세트의 annotations 가 통째로 비어 있다 — 밑줄·구간·박스가 하나도 안 그려진다`,
        "");
  }
  for (const a of list.filter((x) => x.type === "bracket")) {
    if (!ids.includes(String(a.sentFrom)) || !ids.includes(String(a.sentTo)))
      add(t, "⑶구간부재", "FAIL", `[${a.label}] 의 정박 ${a.sentFrom}~${a.sentTo} 가 본문에 없다`, "");
    else if (ids.indexOf(String(a.sentTo)) < ids.indexOf(String(a.sentFrom)))
      add(t, "⑶구간부재", "FAIL", `[${a.label}] 의 끝이 시작보다 앞이다`, "");
  }

  // ── ⑷ 📌 인용 변형 ────────────────────────────────────────────────────
  for (const q of set.questions || []) {
    const ctx = { sents, bogi: q.bogi || "", qt: q.t, choices: q.choices || [] };
    for (const c of q.choices || []) {
      for (const quote of extractQuotes(c.analysis)) {
        const at = `Q${q.id}#${c.num}`;
        const short = JSON.stringify(quote.slice(0, 44));
        // ★ 말줄임표가 있다고 곧바로 위반이 아니다 — 원문 자체의 문장부호일 수 있다.
        //   2027_6월 l20276a 의 「또 누굴 데려갈라고…….」가 그렇다(원문 그대로다).
        //   위반은 **원문에 없는 자리에 넣어 가운데를 덜어낸** 경우다. 그 둘은
        //   quoteResolved 의 해소 경로로 갈린다 — 원문에 그대로 있으면 sents~·marker~
        //   로 풀리고, 덜어낸 것은 ellipsis 관용 경로로만 풀린다.
        //   📌 는 형광펜 정박의 근거라 연속 원문이어야 하므로 ellipsis 는 통과시키지 않는다.
        const how = quoteResolved(quote, ctx);
        if (how === "ellipsis") { add(t, "⑷인용변형", "FAIL", `📌 인용이 가운데를 말줄임으로 덜어냈다 — 연속 원문이어야 한다: ${short}`, at); continue; }
        if (how) continue;                                   // 원문 그대로 — 정상
        if (/\s[~～∼]\s/.test(quote)) { add(t, "⑷인용변형", "FAIL", `📌 인용이 두 구간을 「~」로 이었다 — 연속 원문이어야 한다: ${short}`, at); continue; }
        if (/…|\.{2,}/.test(quote)) { add(t, "⑷인용변형", "FAIL", `📌 인용에 말줄임 생략이 있다 — 가운데를 덜어내면 연속 원문이 아니다: ${short}`, at); continue; }
        // 끝 1~2자를 떼면 해소되는가 → 원문에 없는 종결 부호를 붙인 것이다
        let fixed = null;
        for (const n of [1, 2]) if (quoteResolved(quote.slice(0, -n), ctx)) { fixed = quote.slice(-n); break; }
        if (fixed) { add(t, "⑷인용변형", "FAIL", `📌 인용 끝에 원문에 없는 ${JSON.stringify(fixed)} 를 붙였다: ${short}`, at); continue; }
        add(t, "⑷인용변형", "WARN", `📌 인용이 해소되지 않는다 — 변형 유형을 특정하지 못했다(조판 줄 분할 등 검출기 한계일 수 있다): ${short}`, at);
      }
    }
  }

  // ── A′ 마커 앵커 정합 ─────────────────────────────────────────────────
  //   마커가 본문에 박힌 문장을 찾고, 그 마커의 허용 구간을 정한다.
  const markerSent = new Map();          // 마커 → 본문 문장 index
  for (let i = 0; i < sents.length; i++)
    for (const ch of String(sents[i].t || "")) if (MARK.test(ch) && !markerSent.has(ch)) markerSent.set(ch, i);
  const order = [...markerSent.entries()].sort((a, b) => a[1] - b[1]);
  const rangeEnd = new Map();
  order.forEach(([ch], n) => rangeEnd.set(ch, n + 1 < order.length ? order[n + 1][1] : sents.length - 1));

  for (const a of list) {
    if (!a.marker || !a.sentId) continue;
    const mi = markerSent.get(a.marker);
    if (mi == null) { add(t, "A′앵커", "FAIL", `밑줄이 마커 ${a.marker} 를 달고 있는데 그 마커가 본문에 없다`, String(a.sentId)); continue; }
    const ai = ids.indexOf(String(a.sentId));
    if (ai < 0) { add(t, "A′앵커", "FAIL", `${a.marker} 항목의 앵커 ${a.sentId} 가 본문에 없다`, ""); continue; }
    if (ai === mi) continue;                                   // 마커 문장 그 자체
    if (ai < mi) { add(t, "A′앵커", "FAIL", `${a.marker} 항목의 앵커가 마커 문장보다 **앞**이다 (앵커 ${a.sentId} · 마커 ${ids[mi]}) — 다문장 밑줄로 설명되지 않는다`, ""); continue; }
    if (ai > rangeEnd.get(a.marker))
      add(t, "A′앵커", "FAIL", `${a.marker} 항목의 앵커 ${a.sentId} 가 그 마커 구간(${ids[mi]}~${ids[rangeEnd.get(a.marker)]}) 밖이다`, "");
  }

  // ── A축 렌더 정합 ─────────────────────────────────────────────────────
  //   데이터에 개행이 있어도 프론트가 접으면 화면에서는 한 덩어리가 된다.
  //   게이트 5종이 전부 데이터 축이라 이걸 아무도 못 봤다 — 대표가 화면을 보고서야
  //   드러났다(발문 21 · 보기 155곳).
  //   ★ 접히는지 여부는 프론트 함수에 직접 물어본다. 조건을 베껴 쓰면 프론트가
  //     바뀔 때 게이트만 옛 동작을 재고, 이미 고쳐진 것을 계속 경보한다.
  for (const q of set.questions || []) {
    // 프론트는 보기에 foldIfAnnSafe 를 쓴다 — 주석이 깨지면 접기를 포기한다.
    //   발문은 주석 대상이 아니라 foldLayoutBreaks 를 그대로 쓴다.
    const anns = list.filter((a) => a.type !== "bracket");
    const bogi = typeof q.bogi === "string" ? q.bogi
      : (q.bogi && typeof q.bogi.text === "string" ? q.bogi.text : "");
    const cases = [
      ["발문", String(q.t || ""), (x) => foldLayoutBreaks(x)],
      ["보기", bogi, (x) => foldIfAnnSafe(x, anns)],
    ];
    for (const [field, txt, fold] of cases) {
      if (!txt.includes("\n")) continue;              // 개행 0 은 B축이 본다
      const lines = txt.split("\n");
      if (!isDialogueBlock(lines)) continue;
      // ★ 접힌 줄 수를 세면 안 된다 — 대화형 블록에도 조판 줄바꿈이 섞여 있고
      //   그건 접히는 것이 정상이다. 「한 줄이라도 접히면 WARN」으로 재면 조판 줄이
      //   하나라도 있는 블록이 전부 걸린다(실측 3건이 전부 그 과경보였다).
      //   봐야 할 것은 **의미 경계 줄(화자·씬)이 줄머리를 잃었는가** 하나다.
      //   뒤에 조판 줄이 붙어 길어지는 것은 손실이 아니므로 줄머리로 대조한다.
      const out = fold(txt).split("\n").map((x) => x.trim());
      const lost = lines.filter((l, i) => i > 0
        && (RE_NAMED.test(l) || RE_SCENE.test(l))
        && !out.some((o) => o.startsWith(l.trim().slice(0, 14))));
      if (!lost.length) continue;                      // 프론트가 다 살린다
      add(t, "A축렌더", "WARN",
        `대화형인데 화자·씬 표기 ${lost.length}줄이 화면에서 접힌다 — 화자 구분이 사라진다: ` +
        lost.slice(0, 3).map((l) => JSON.stringify(l.trim().slice(0, 32))).join(" · "),
        `Q${q.id} ${field}`);
    }
  }

  // ── B축 개행 소실 ─────────────────────────────────────────────────────
  //   A축은 개행이 있어야 검사에 든다. 개행이 0 인 열화본은 검사조차 못 받는다 —
  //   그 사각지대에 LIVE 결함이 있었다(2015_6월B l20156b Q36, 대본이 한 덩어리).
  //   프론트를 고쳐도 안 된다. 데이터에 줄 구분이 없으므로 추출 소실이고 복원 대상이다.
  //
  // ★ " / " 앵커가 정밀도의 핵심이다. 개행이 사라진 자리에 조판 구분자가 남는데,
  //   그 앵커를 빼면 표 라벨 콜론(2022_6월 r20226b Q4 「[도식: … 학습 항목: …」)과
  //   씬 언급(2022_9월 l20229b Q26 「S#18과 S#24에 대한…」)이 오탐으로 들어온다.
  //   ⓑ 의 마침표와 ⓐ 의 " / " 가 각각 그 둘을 걸러낸다.
  for (const q of set.questions || []) {
    const bogi = typeof q.bogi === "string" ? q.bogi
      : (q.bogi && typeof q.bogi.text === "string" ? q.bogi.text : "");
    for (const [field, txt] of [["발문", String(q.t || "")], ["보기", bogi]]) {
      if (!txt || txt.includes("\n")) continue;         // 개행이 있으면 A축 소관
      const sp = [...txt.matchAll(/(?:^|\s\/\s)([가-힣A-Za-z0-9()·]{1,12})\s*[:：]/g)];
      const scenes = (txt.match(/(?:^|\s\/\s)S#\s*\d+\./g) || []).length;
      const speakers = new Set(sp.map((m) => m[1].trim()));
      const isDialog = (sp.length >= 3 && speakers.size >= 2) || scenes >= 2;
      if (!isDialog) continue;
      add(t, "B축개행소실", "WARN",
        `조판 개행이 소실된 대본 — 화자 구분이 없다 (화자 ${speakers.size}명 · 발화 ${sp.length}회` +
        (scenes ? ` · 씬 ${scenes}개` : "") + ")",
        `Q${q.id} ${field}`);
    }
  }
  // ── C 중복 등재 ───────────────────────────────────────────────────────
  const seen = new Map();
  for (const a of list) {
    if (!a.text || !a.sentId) continue;
    const k = `${a.type}|${a.sentId}|${a.text}`;
    if (seen.has(k)) add(t, "C중복등재", "FAIL", `같은 항목이 두 번 등재됐다: ${a.type} ${a.sentId} ${JSON.stringify(a.text.slice(0, 26))}`, "");
    else seen.set(k, true);
  }
}

// ── 출력 ────────────────────────────────────────────────────────────────
const AX = ["⑴빈칸소실", "⑵라벨혼입", "⑶구간부재", "⑷인용변형", "A′앵커", "C중복등재", "A축렌더", "B축개행소실"];
console.log("# 세트 탑재 검사 (D-199)");
console.log("");
console.log(`- 대상 ${targets.length}세트 (LIVE ${targets.filter((t) => RELEASE.has(t.key)).length})`);
console.log("");
console.log("| 축 | FAIL | WARN |");
console.log("|---|--:|--:|");
for (const ax of AX) {
  const f = findings.filter((x) => x.axis === ax);
  console.log(`| ${ax} | ${f.filter((x) => x.level === "FAIL").length} | ${f.filter((x) => x.level === "WARN").length} |`);
}
console.log("");
const fails = findings.filter((x) => x.level === "FAIL");
if (findings.length) {
  console.log("## 상세");
  console.log("");
  const bySet = {};
  for (const f of findings) (bySet[f.key] ||= []).push(f);
  for (const [key, fs2] of Object.entries(bySet)) {
    console.log(`### ${fs2[0].live ? "🔴LIVE" : "비노출"} \`${key}\``);
    for (const f of fs2) console.log(`- ${f.level === "FAIL" ? "🔴" : "🟡"} **${f.axis}**${f.where ? ` \`${f.where}\`` : ""} — ${f.msg}`);
    console.log("");
  }
}
console.log(fails.length ? `## 🔴 FAIL ${fails.length}건 (LIVE ${fails.filter((x) => x.live).length})` : "## ✅ FAIL 0건");
process.exit(fails.length ? 1 : 0);
