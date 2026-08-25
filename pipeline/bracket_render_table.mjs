// bracket_render_table.mjs — 실측 렌더 테이블 (발주 D-107 ①)
//
// ★ 화면에 그려지는 bracket 의 원천은 all_data_204.json 의 set.annotations 가 아니다.
//   src/dataLoader.js:548 _attachAnnotations 가 annotations.json 에 항목이 있으면
//   set.annotations 를 **통째로 덮어쓴다**. 그리고 src/PassagePanel.jsx:745 는
//   visual_marks.json 의 bracket 도 함께 인정한다(둘을 label|from|to 로 dedup).
//
//   따라서 화면 = (annotations.json 우선, 없으면 all_data) ∪ visual_marks.json
//   getBracketInfo(src/PassagePanel.jsx:655)는 sentIds.indexOf 로 **정확 일치**만 본다.
//
// 이 스크립트는 그 경로를 그대로 재현한다. 마커 저장 형태 5종도 함께 센다.
//
// 사용: node pipeline/bracket_render_table.mjs [--md]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (f) => path.join(ROOT, "public/data", f);
const data = JSON.parse(fs.readFileSync(P("all_data_204.json"), "utf8"));
const ann = JSON.parse(fs.readFileSync(P("annotations.json"), "utf8"));
const vmRaw = JSON.parse(fs.readFileSync(P("visual_marks.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

const vmBy = new Map();
for (const m of vmRaw.marks || []) {
  if (!m?.setId) continue;
  const k = `${m.yearKey}::${m.setId}`;
  vmBy.set(k, [...(vmBy.get(k) || []), m]);
}

const rows = [];
const forms = { workTag: [], bracket: [], prefix: [], standalone: [], inline: [] };

for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const setId = s.setId || s.id;
      const live = REL.has(`${yk}::${setId}`);
      const sentIds = (s.sents || []).map((x) => String(x.id));

      // ── 저장 형태 5종 스캔 ────────────────────────────────────────
      for (const x of s.sents || []) {
        const t = String(x.t ?? "");
        const trimmed = t.trim();
        const solo = /^\[([A-F])\]$/.exec(trimmed);
        const row = { yk, sid: setId, live, sentId: x.id };
        if (solo) {
          // workTag 단독은 렌더러가 숨긴다(_isAreaEndMarker). 그 밖의 sentType 은 본문에 그대로 나온다.
          if ((x.sentType || "") === "workTag") forms.workTag.push({ ...row, label: solo[1] });
          else forms.standalone.push({ ...row, label: solo[1], sentType: x.sentType || "body" });
          continue;
        }
        const pre = /^\s*\[([A-F])\]\s/.exec(t);
        if (pre) { forms.prefix.push({ ...row, label: pre[1] }); continue; }
        const inl = t.slice(1).match(/\[([A-F])\]/);
        if (inl) forms.inline.push({ ...row, label: inl[1] });
      }

      // ── 화면이 쓰는 bracket 집합을 재현 ───────────────────────────
      const annList = ann[yk]?.[setId];
      const effAnn = Array.isArray(annList) && annList.length > 0 ? annList : (s.annotations || []);
      const annBr = effAnn
        .filter((a) => a?.type === "bracket" && a.sentFrom && a.sentTo && (!a.target || a.target === "passage"))
        .map((a) => ({ label: a.label, sentFrom: a.sentFrom, sentTo: a.sentTo, src: "ann" }));
      const vmBr = (vmBy.get(`${yk}::${setId}`) || [])
        .filter((m) => m.type === "bracket" && m.target === "sent_range" && m.status !== "broken"
          && Array.isArray(m.sentIds) && m.sentIds.length > 0)
        .map((m) => ({ label: m.label, sentFrom: m.sentIds[0], sentTo: m.sentIds[m.sentIds.length - 1], src: "vm" }));
      const seen = new Set();
      const brackets = [...vmBr, ...annBr].filter((b) => {
        const k = `${b.label}|${b.sentFrom}|${b.sentTo}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      // all_data 쪽 값 (D-104~106 에서 고쳐 온 경로) — 대조용
      const mine = (s.annotations || []).filter((a) => a?.type === "bracket");
      const mineKey = new Set(mine.map((a) => `${a.label}|${a.sentFrom}|${a.sentTo}`));
      if (!brackets.length && !mine.length) continue;

      // ★ 라벨 단위로 판정한다. getBracketInfo 는 brackets 를 순회하다 첫 매치에서 return 하므로,
      //   같은 라벨이 vm·ann 양쪽에 있고 한쪽만 id 가 맞으면 **그 라벨은 화면에 나온다**.
      const byLabel = new Map();
      for (const b of brackets) {
        const f = sentIds.indexOf(String(b.sentFrom));
        const t = sentIds.indexOf(String(b.sentTo));
        const okRange = f >= 0 && t >= 0 && f <= t;
        const e = byLabel.get(b.label) || { cands: [], drawn: null };
        e.cands.push({ ...b, f, t, okRange });
        if (okRange && !e.drawn) e.drawn = { ...b, lines: t - f + 1 };
        byLabel.set(b.label, e);
      }
      for (const a of mine) if (!byLabel.has(a.label)) byLabel.set(a.label, { cands: [], drawn: null });

      for (const [label, e] of byLabel) {
        const shown = e.drawn;
        const mineOne = mine.find((a) => a.label === label);
        const mineRange = mineOne ? `${mineOne.sentFrom} ~ ${mineOne.sentTo}` : null;
        const shownRange = shown ? `${shown.sentFrom} ~ ${shown.sentTo}` : null;
        rows.push({
          yk, sid: setId, live, label,
          src: shown ? shown.src : (e.cands.length ? e.cands.map((c) => c.src).join("+") : "all_data 전용"),
          range: shownRange ?? mineRange ?? "(없음)",
          lines: shown ? shown.lines : null,
          render: shown ? "그려짐" : (e.cands.length ? "🔴 안 그려짐" : "🔴 화면 집합에 없음"),
          mineRange,
          agree: shown ? mineKey.has(`${label}|${shown.sentFrom}|${shown.sentTo}`) : false,
          hasMine: !!mineOne,
          annOverrides: Array.isArray(annList) && annList.length > 0,
        });
      }
    }

const L = (a) => a.filter((x) => x.live).length;
const drawn = rows.filter((r) => r.render === "그려짐");
const notDrawn = rows.filter((r) => r.render === "🔴 안 그려짐");
const orphan = rows.filter((r) => r.render === "🔴 화면 집합에 없음");
// 화면에 나오지만 all_data 에 적어 둔 범위와 다른 것 (= all_data 를 고쳐도 화면은 그대로)
const disagree = rows.filter((r) => r.render === "그려짐" && r.hasMine && !r.agree);

const out = [];
out.push(`# 실측 렌더 테이블 — bracket 전수 (D-107 ①)`);
out.push(``);
out.push(`> 생성: \`node pipeline/bracket_render_table.mjs --md\``);
out.push(`> 화면이 쓰는 bracket 원천을 코드 그대로 재현했다:`);
out.push(`> \`_attachAnnotations\`(src/dataLoader.js:548)가 **annotations.json 에 항목이 있으면**`);
out.push(`> \`set.annotations\` 를 통째로 덮어쓰고, \`renderAll\`(src/PassagePanel.jsx:745)이`);
out.push(`> **visual_marks.json** 의 bracket 을 합친 뒤 \`label|from|to\` 로 dedup 한다.`);
out.push(`> 표시 판정은 \`getBracketInfo\`(src/PassagePanel.jsx:655) — \`sentIds.indexOf\` 정확 일치.`);
out.push(``);
out.push(`## 요약`);
out.push(``);
out.push(`판정 단위는 **라벨**이다(세트×라벨). \`getBracketInfo\` 는 후보를 순회하다 첫 매치에서`);
out.push(`반환하므로, 같은 라벨이 vm·ann 양쪽에 있고 한쪽만 id 가 맞으면 그 라벨은 화면에 나온다.`);
out.push(``);
out.push(`| 항목 | 라벨 | LIVE |`);
out.push(`|---|--:|--:|`);
out.push(`| 전체 | ${rows.length} | ${L(rows)} |`);
out.push(`| 그려짐 | ${drawn.length} | ${L(drawn)} |`);
out.push(`| 🔴 안 그려짐 (후보는 있으나 id 불일치) | ${notDrawn.length} | ${L(notDrawn)} |`);
out.push(`| 🔴 all_data 에만 있어 사장됨 | ${orphan.length} | ${L(orphan)} |`);
out.push(`| 화면엔 나오지만 all_data 값과 범위가 다름 | ${disagree.length} | ${L(disagree)} |`);
out.push(``);
out.push(`## 마커 저장 형태 5종`);
out.push(``);
out.push(`| 형태 | 건수 | LIVE | 화면 |`);
out.push(`|---|--:|--:|---|`);
out.push(`| workTag 단독 \`[X]\` | ${forms.workTag.length} | ${L(forms.workTag)} | 숨김(_isAreaEndMarker) |`);
out.push(`| **비-workTag 단독 문장 \`[X]\`** | **${forms.standalone.length}** | **${L(forms.standalone)}** | **본문에 그대로 노출** |`);
out.push(`| 본문 선두 접두 \`[X] …\` | ${forms.prefix.length} | ${L(forms.prefix)} | 본문에 그대로 노출 |`);
out.push(`| 문장 중간·끝 인라인 \`[X]\` | ${forms.inline.length} | ${L(forms.inline)} | 본문에 그대로 노출 |`);
out.push(`| annotations/visual_marks bracket | ${rows.length - orphan.length} | ${L(rows.filter((r) => r.src !== "all_data 전용"))} | 좌측 대괄호 |`);
out.push(``);
if (forms.standalone.length) {
  out.push(`### 비-workTag 단독 문장 \`[X]\` 전건 — 심사관 스캔의 사각`);
  out.push(``);
  out.push(`| 회차 | 세트 | 노출 | 문장 | 라벨 | sentType |`);
  out.push(`|---|---|---|---|---|---|`);
  for (const x of forms.standalone)
    out.push(`| ${x.yk} | \`${x.sid}\` | ${x.live ? "🔴 LIVE" : "비노출"} | \`${x.sentId}\` | ${x.label} | ${x.sentType} |`);
  out.push(``);
}
const table = (title, arr, note) => {
  if (!arr.length) return;
  out.push(`## ${title}`);
  if (note) out.push(``), out.push(note);
  out.push(``);
  out.push(`| 회차 | 세트 | 노출 | 라벨 | 범위 | 행수 | 원천 | 판정 |`);
  out.push(`|---|---|---|---|---|--:|---|---|`);
  for (const r of arr)
    out.push(`| ${r.yk} | \`${r.sid}\` | ${r.live ? "🔴 LIVE" : "비노출"} | ${r.label} | \`${r.range}\` | ${r.lines ?? "—"} | ${r.src} | ${r.render} |`);
  out.push(``);
};
table("🔴 안 그려짐", notDrawn.filter((r) => r.src !== "all_data 전용"));
table("🔴 all_data 에만 있어 사장된 정박", orphan,
  `annotations.json 에 그 세트 항목이 있으면 all_data 의 \`set.annotations\` 는 통째로 버려진다.`);
table("화면엔 나오지만 all_data 값과 범위가 다른 건", disagree,
  `왼쪽이 **화면에 실제로 나오는 값**이다. all_data 를 고쳐도 화면은 바뀌지 않는다.`);
table("그려짐 — 전건", drawn);

if (process.argv.includes("--md")) console.log(out.join("\n"));
else {
  console.log(out.slice(0, out.indexOf(`## 마커 저장 형태 5종`) + 14).join("\n"));
  console.log(`\n(전체 표는 --md 로)`);
}
