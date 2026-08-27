// release_diag.mjs — 노출 게이트 진단 8축 + 웨이브 1 채택 3축 (발주 D-124)
//
// D-114 / D-117 에서 손으로 돌리던 축을 한 자리에 모은다. **진단만 한다 — 아무것도 쓰지 않는다.**
//
//   ① 삼충실도    해설 수 · 근거 누락 · ok:false 인데 pat 없음
//   ② 근거정합    cs_spans[].text 가 그 문장 안에 글자 그대로 있는가
//   ③ setId충돌   같은 setId 가 다른 연도에도 있는가 (복합 키 규약 D-113 ①)
//   ④ 구간표시    [A] 류 라벨이 annotations.json 에 정박돼 있는가
//   ⑤ 글자손상    PUA(U+E000~F8FF) · ZWSP(U+200B) · U+FFFD
//   ⑥ 각주        본문 * 과 각주 문장이 짝을 이루는가
//   ⑦ 문항형식    선지 5개 · questionType 기준 정답이 정확히 하나
//   ⑧ 분리게이트   free/·data-pro/ 산출물과의 차이 (여기서는 원천 존재만 본다)
//
//   ⑨ 고아 마커      본문에 있는데 어떤 문항도 안 가리키는 마커
//   ⑩ 발문 마커 소실 조사가 홀로 선 발문 (stem_head_audit 과 같은 규칙)
//   ⑪ 인용부호 소실  ⑩ 중 마커가 아니라 인용부호·상자가 빠진 형태
//
// 사용: node pipeline/release_diag.mjs <yearKey>::<setId> [...]  [--md]

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
const MARK = /[ⓐ-ⓩ㉠-㉾㈀-㈜]/;
const MARK_G = /[ⓐ-ⓩ㉠-㉾㈀-㈜]/g;
const JOSA = ["와", "과", "은", "는", "이", "가", "을", "를", "의", "에", "로", "도", "만"];
const LONE = /\s(와|과|은|는|이|가|을|를|의|에|로)\s/;
const VOCAB = ["와 문맥상", "과 문맥상", "와 바꿔", "과 바꿔", "와 바꾸어", "과 바꾸어",
  "와 문맥적", "과 문맥적", "의 문맥적 의미"];

// setId 는 연도 안에서만 고유하다 (D-113 ①) — 전 연도 색인을 미리 만든다
const bySetId = new Map();
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const id = s.setId || s.id;
      if (!bySetId.has(id)) bySetId.set(id, []);
      bySetId.get(id).push(yk);
    }

const annKeys = new Set();
{
  const walk = (o, pre) => {
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      annKeys.add(k);
      if (v && typeof v === "object") walk(v, k);
    }
  };
  walk(ann, "");
}

const targets = process.argv.slice(2).filter((x) => x.includes("::"));
const out = [];
const say = (x) => out.push(x);

for (const key of targets) {
  const [yk, setId] = key.split("::");
  let set = null, sec = null;
  for (const s2 of ["reading", "literature"]) {
    const f = (data[yk]?.[s2] || []).find((x) => (x.setId || x.id) === setId);
    if (f) { set = f; sec = s2; break; }
  }
  say(``);
  say(`## ${yk}::${setId}`);
  say(``);
  if (!set) { say(`🔴 **세트가 없다** — \`${yk}\` 안에 \`${setId}\` 가 존재하지 않는다. 판정 불가.`); continue; }

  const live = REL.has(key);
  const qs = set.questions || [];
  const sents = set.sents || [];
  const byId = new Map(sents.map((x) => [String(x.id), flat(x.t)]));
  const rows = [];
  const detail = [];

  // ① 삼충실도
  {
    let noAna = 0, noEv = 0, noPat = 0, ch = 0, vocabSkip = 0;
    for (const q of qs) for (const c of q.choices || []) {
      ch++;
      if (!flat(c.analysis).trim()) noAna++;
      // 어휘 문항(pat V)의 오답 선지는 근거를 달지 않는 것이 기존 규칙이다 (D-125 ⓪ 판정).
      //   「ⓐ와 문맥상 의미가 가장 가까운 것은?」 류에서 오답은 지문이 아니라 선지 문장 자체를
      //   따지므로 가리킬 지문 문장이 없다. 결함으로 세지 않고 아래에 건수만 남긴다.
      const noEvidence = !(c.cs_ids || []).length && !(c.cs_spans || []).length;
      const vocabExempt = noEvidence && c.ok === false && flat(c.pat).trim() === "V";
      if (vocabExempt) vocabSkip++;
      else if (noEvidence) noEv++;
      if (c.ok === false && !flat(c.pat).trim()) noPat++;
    }
    const bad = noAna + noEv + noPat;
    rows.push(["① 삼충실도", bad ? `🔴 ${bad}` : "✅ 0", `선지 ${ch} · 해설누락 ${noAna} · 근거누락 ${noEv} · pat누락 ${noPat}` + (vocabSkip ? ` · 어휘 오답 제외 ${vocabSkip}` : "")]);
    if (noEv) {
      const list = [];
      for (const q of qs) for (const c of q.choices || [])
        if (!(c.cs_ids || []).length && !(c.cs_spans || []).length
          && !(c.ok === false && flat(c.pat).trim() === "V")) list.push(`Q${q.id}#${c.num}`);
      detail.push(`- **근거 누락 ${noEv}건**: ${list.join(", ")}`);
    }
    if (noPat) {
      const list = [];
      for (const q of qs) for (const c of q.choices || [])
        if (c.ok === false && !flat(c.pat).trim()) list.push(`Q${q.id}#${c.num}`);
      detail.push(`- **pat 누락 ${noPat}건**: ${list.join(", ")}`);
    }
    if (noAna) {
      const list = [];
      for (const q of qs) for (const c of q.choices || [])
        if (!flat(c.analysis).trim()) list.push(`Q${q.id}#${c.num}`);
      detail.push(`- **해설 누락 ${noAna}건**: ${list.join(", ")}`);
    }
  }

  // ② 근거정합
  {
    let n = 0, bad = 0;
    const miss = [];
    for (const q of qs) for (const c of q.choices || []) for (const sp of c.cs_spans || []) {
      n++;
      const t = byId.get(String(sp.sent_id));
      if (t == null) { bad++; miss.push(`Q${q.id}#${c.num} 없는 문장 ${sp.sent_id}`); continue; }
      if (!t.includes(flat(sp.text))) { bad++; miss.push(`Q${q.id}#${c.num} ${sp.sent_id} ${JSON.stringify(flat(sp.text).slice(0, 30))}`); }
    }
    let idBad = 0;
    const idMiss = [];
    for (const q of qs) for (const c of q.choices || []) for (const id of c.cs_ids || [])
      if (!byId.has(String(id))) { idBad++; idMiss.push(`Q${q.id}#${c.num} ${id}`); }
    rows.push(["② 근거정합", bad + idBad ? `🔴 ${bad + idBad}` : "✅ 0", `cs_spans ${n}건 · 어긋남 ${bad} · 없는 cs_id ${idBad}`]);
    if (miss.length) detail.push(`- **cs_span 불일치**: ${miss.slice(0, 8).join(" / ")}`);
    if (idMiss.length) detail.push(`- **없는 cs_id**: ${idMiss.slice(0, 8).join(" / ")}`);
  }

  // ③ setId 충돌
  {
    const yks = bySetId.get(setId) || [];
    rows.push(["③ setId충돌", yks.length > 1 ? `⚠ ${yks.length}` : "✅ 1", yks.length > 1 ? `같은 setId 가 ${yks.join(", ")} 에 있다 — 복합 키 필수` : `이 연도에만 있다`]);
  }

  // ④ 구간표시 — annotations.json 의 bracket 정박을 실제로 찾는다
  {
    const labels = new Set();
    for (const q of qs) for (const m of flat(q.t).match(/\[([A-Z])\]/g) || []) labels.add(m.slice(1, -1));
    for (const x of sents) for (const m of flat(x.t).match(/\[([A-Z])\]/g) || []) labels.add(m.slice(1, -1));
    const list = (ann[yk]?.[setId]) || [];
    const anchored = [], orphanL = [];
    for (const L of labels) {
      // [A] 는 본문 구간(bracket)일 수도, <보기> 빈칸(blank-box)일 수도 있다.
      // l20256a Q20 처럼 「<보기>의 [A]에 들어갈 말」이면 본문에 꺾쇠가 없는 게 정상이다.
      const hit = list.find((a2) => a2 && (a2.type === "bracket" || a2.type === "blank-box")
        && String(a2.label ?? a2.marker ?? "") === L);
      (hit ? anchored : orphanL).push(hit && hit.type === "blank-box" ? `${L}(보기빈칸)` : L);
    }
    const kinds = {};
    for (const a2 of list) kinds[a2?.type ?? "?"] = (kinds[a2?.type ?? "?"] || 0) + 1;
    rows.push(["④ 구간표시", labels.size === 0 ? "— 없음" : orphanL.length ? `🔴 ${orphanL.length}` : `✅ ${anchored.length}`,
      labels.size === 0
        ? `[A] 류 라벨을 쓰지 않는다 · ann 항목 ${list.length}(${Object.entries(kinds).map(([k2, v2]) => `${k2}:${v2}`).join(" ") || "없음"})`
        : `라벨 ${[...labels].map((x) => `[${x}]`).join(" ")} · 정박 ${anchored.length} · 미정박 ${orphanL.map((x) => `[${x}]`).join(" ") || "없음"} · ann 항목 ${list.length}`]);
    if (orphanL.length) detail.push(`- **구간 미정박** ${orphanL.map((x) => `[${x}]`).join(" ")} — annotations.json 에 bracket 이 없다. 화면에 꺾쇠가 안 그려진다`);
  }
  // ⑤ 글자손상
  {
    const scan = (t) => ({
      pua: (t.match(/[-]/g) || []).length,
      zwsp: (t.match(/[​‌‍﻿]/g) || []).length,
      repl: (t.match(/�/g) || []).length,
    });
    let pua = 0, zwsp = 0, repl = 0;
    const hit = [];
    const push = (tag, t) => { const r = scan(t); pua += r.pua; zwsp += r.zwsp; repl += r.repl; if (r.pua || r.zwsp || r.repl) hit.push(tag); };
    for (const x of sents) push(String(x.id), flat(x.t));
    for (const q of qs) {
      push(`Q${q.id}발문`, flat(q.t)); push(`Q${q.id}bogi`, flat(q.bogi));
      for (const c of q.choices || []) { push(`Q${q.id}#${c.num}`, flat(c.t)); push(`Q${q.id}#${c.num}해설`, flat(c.analysis)); }
    }
    const bad = pua + zwsp + repl;
    rows.push(["⑤ 글자손상", bad ? `🔴 ${bad}` : "✅ 0", `PUA ${pua} · ZWSP ${zwsp} · U+FFFD ${repl}`]);
    if (bad) detail.push(`- **손상 위치**: ${[...new Set(hit)].slice(0, 10).join(", ")}`);
  }

  // ⑥ 각주
  {
    const starBody = sents.filter((x) => /(?<!\*)\*(?!\*)/.test(flat(x.t)) && !/^\s*\*/.test(flat(x.t))).map((x) => String(x.id));
    const notes = sents.filter((x) => /^\s*\*/.test(flat(x.t))).map((x) => String(x.id));
    const ok = starBody.length === 0 ? notes.length === 0 : notes.length > 0;
    rows.push(["⑥ 각주", starBody.length === 0 && notes.length === 0 ? "— 없음" : ok ? "✅ 짝" : `🔴 불일치`,
      `본문 * ${starBody.length}곳 · 각주문장 ${notes.length}개`]);
    if (!ok) detail.push(`- **각주 짝 불일치**: 본문 * ${starBody.join(",") || "없음"} / 각주 ${notes.join(",") || "없음"}`);
  }

  // ⑦ 문항형식
  {
    let notFive = 0, ansBad = 0;
    const bad = [];
    for (const q of qs) {
      const cs = q.choices || [];
      if (cs.length !== 5) { notFive++; bad.push(`Q${q.id} 선지 ${cs.length}개`); }
      const neg = flat(q.questionType).includes("negative") || /적절하지 않은|아닌 것|없는 것/.test(flat(q.t));
      const want = neg ? false : true;
      const n = cs.filter((c) => c.ok === want).length;
      if (n !== 1) { ansBad++; bad.push(`Q${q.id} 정답 후보 ${n}개 (${neg ? "부정형" : "긍정형"})`); }
    }
    rows.push(["⑦ 문항형식", notFive + ansBad ? `🔴 ${notFive + ansBad}` : "✅ 0", `문항 ${qs.length} · 5지 아님 ${notFive} · 정답 특정 실패 ${ansBad}`]);
    if (bad.length) detail.push(`- **문항 형식**: ${bad.join(" / ")}`);
  }

  // ⑧ 분리게이트 — 원천 존재만 본다
  rows.push(["⑧ 분리게이트", "— 확인", `sents ${sents.length} · questions ${qs.length} · 섹션 ${sec}`]);

  // ⑨ 고아 마커
  {
    const inBody = new Set();
    for (const x of sents) for (const m of flat(x.t).match(MARK_G) || []) inBody.add(m);
    const inQ = new Set();
    for (const q of qs) {
      const joined = [flat(q.t), flat(q.bogi), ...(q.choices || []).flatMap((c) => [flat(c.t), flat(c.analysis)])].join(" ");
      for (const m of joined.match(MARK_G) || []) inQ.add(m);
      for (const r of joined.matchAll(/([①-⓿㈀-㋿])\s*[~～〜–—-]\s*([①-⓿㈀-㋿])/g)) {
        const [a0, b0] = [r[1].codePointAt(0), r[2].codePointAt(0)];
        if (b0 <= a0 || b0 - a0 > 12) continue;
        for (let c = a0; c <= b0; c++) inQ.add(String.fromCodePoint(c));
      }
    }
    const orph = [...inBody].filter((m) => !inQ.has(m)).sort();
    const rev = [...inQ].filter((m) => !inBody.has(m)).sort();
    rows.push(["⑨ 마커 고아", orph.length ? `🔴 ${orph.length}` : "✅ 0", `본문 ${inBody.size} · 문항 ${inQ.size} · 고아 ${orph.join("") || "없음"} · 역고아 ${rev.join("") || "없음"}`]);
    if (orph.length) detail.push(`- **고아 마커** ${orph.join("")} — 원본 대조 필요`);
    if (rev.length) detail.push(`- 역고아 ${rev.join("")} — 대개 <보기> 안 마커라 정상일 수 있다`);
  }

  // ⑩⑪ 발문 마커·인용부호 소실
  {
    const hits = [];
    for (const q of qs) {
      const t = flat(q.t).trim();
      if (!t || MARK.test(t[0])) continue;
      const bare = JOSA.includes(t[0]) && t[1] === " ";
      const mid = !bare && LONE.test(t);
      const vocab = MARK.test(t) ? null : VOCAB.find((x) => t.includes(x));
      if (!bare && !mid && !vocab) continue;
      hits.push({ qid: q.id, t: t.slice(0, 40), kind: bare ? "선두 조사" : mid ? "중간 조사" : "어휘 어미" });
    }
    const head = hits.filter((h) => h.kind !== "중간 조사");
    const quote = hits.filter((h) => h.kind === "중간 조사");
    rows.push(["⑩ 발문 마커소실", head.length ? `🔴 ${head.length}` : "✅ 0", head.map((h) => `Q${h.qid}`).join(", ") || "없음"]);
    rows.push(["⑪ 인용부호 소실", quote.length ? `⚠ ${quote.length}` : "✅ 0", quote.map((h) => `Q${h.qid}`).join(", ") || "없음"]);
    for (const h of hits) detail.push(`- **${h.kind}** Q${h.qid}: \`${h.t}\``);
  }

  say(`> 노출 ${live ? "🔴 LIVE" : "미노출"} · ${sec} · 문항 ${qs.map((q) => q.id).join(",")}`);
  say(``);
  say(`| 축 | 판정 | 내용 |`);
  say(`|---|---|---|`);
  for (const [a, b, c] of rows) say(`| ${a} | ${b} | ${c} |`);
  if (detail.length) { say(``); say(`**결함 상세**`); say(``); for (const d of detail) say(d); }
}

console.log(out.join("\n"));
