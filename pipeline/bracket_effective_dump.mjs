// 화면 유효 브래킷 추출 (발주 F-25)
//
// PassagePanel 의 렌더 규칙을 그대로 재현해, 실제로 화면에 그려지는
// 브래킷 구간(라벨 + 시작/끝 문장)과 그 원천을 뽑는다.
//
//   원천 3종
//     ann     — public/data/annotations.json (연도 키 중첩)
//     alldata — 세트 파일에 실린 set.annotations (annotations.json 엔트리가
//               없을 때만 살아남는다. split 배포에서는 free/<year>.json 이
//               all_data_204.json 을 대신한다)
//     vm      — public/data/visual_marks.json
//
//   렌더 규칙 (src/PassagePanel.jsx)
//     brackets = [...vmBrackets, ...annBrackets]  (label|from|to 중복 제거)
//     getBracketInfo: 문장마다 위 배열의 first-match-wins → vm 이 먼저다
//     같은 라벨이 연속된 문장끼리 하나의 BracketContainer 로 묶인다
//     workTag 의 영역종료 마커 문장은 건너뛴다
//
// 모드 (발주 F-25 3단계 — 렌더 diff 0 증명용)
//   --mode legacy  F-25 이전 규칙: brackets = [...vm, ...ann], all_data 폴백 살아있음
//   --mode single  F-25 이후 규칙: 브래킷 원천 = annotations.json 하나
//   같은 데이터에 두 규칙을 각각 적용해 덤프를 만들고 --diff 로 대조한다.
//   도구가 데이터만 읽으므로, 모드 없이는 코드 변경 전후 차이가 드러나지 않는다.
//
// 사용법
//   node pipeline/bracket_effective_dump.mjs --mode legacy --out before.json
//   node pipeline/bracket_effective_dump.mjs --mode single --out after.json
//   node pipeline/bracket_effective_dump.mjs --diff before.json after.json

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FREE_DIR = path.join(root, "public/data/free");
const ANN_PATH = path.join(root, "public/data/annotations.json");
const VM_PATH = path.join(root, "public/data/visual_marks.json");

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

// PassagePanel 의 RE_AREA_END_MARKER 와 같은 판정
const RE_AREA_END_MARKER = /^\[?[A-Z]\]?\s*(끝|종료)\s*$/;
const isAreaEndMarker = (s) =>
  (s.sentType || "") === "workTag" &&
  RE_AREA_END_MARKER.test((s.t || "").trim());

// visual_marks.json 스키마: { marks: [ { yearKey, setId, type, ... } ] }
//   dataLoader._attachVisualMarks 가 yearKey+setId 로 갈라 set.visualMarks 에 넣고,
//   PassagePanel 이 그중 bracket/sent_range/!broken 만 쓴다.
function vmBracketsFor(vmAll, yearKey, setId) {
  const list = Array.isArray(vmAll?.marks) ? vmAll.marks : [];
  return list
    .filter(
      (m) =>
        m.yearKey === yearKey &&
        m.setId === setId &&
        m.type === "bracket" &&
        m.target === "sent_range" &&
        m.status !== "broken" &&
        Array.isArray(m.sentIds) &&
        m.sentIds.length > 0,
    )
    .map((m) => ({
      label: m.label,
      sentFrom: m.sentIds[0],
      sentTo: m.sentIds[m.sentIds.length - 1],
      _src: "vm",
    }));
}

function collect(mode) {
  const single = mode === "single";
  const ann = existsSync(ANN_PATH) ? readJson(ANN_PATH) : {};
  const vmAll = existsSync(VM_PATH) ? readJson(VM_PATH) : {};
  const out = [];
  const setSources = [];

  const files = readdirSync(FREE_DIR).filter(
    (f) => f.endsWith(".json") && f !== "index.json",
  );

  for (const f of files) {
    const yearKey = f.replace(/\.json$/, "");
    const year = readJson(path.join(FREE_DIR, f));
    const annYear = ann[yearKey] || {};

    for (const sec of ["reading", "literature"]) {
      for (const set of year[sec] || []) {
        const setId = set.setId || set.id;
        if (!setId || !Array.isArray(set.sents)) continue;

        // _attachAnnotations 재현: annotations.json 엔트리가 있으면 통째로 덮어쓴다
        const fromAnnJson =
          Array.isArray(annYear[setId]) && annYear[setId].length > 0;
        // F-25 ⓑ: single 모드에서는 annotations.json 엔트리가 없는 세트의
        //   통짜 파일 브래킷이 죽는다(다른 타입은 그대로).
        const rawAnn = fromAnnJson ? annYear[setId] : set.annotations || [];
        const annList =
          single && !fromAnnJson
            ? rawAnn.filter((a) => a.type !== "bracket")
            : rawAnn;
        const annSrc = fromAnnJson ? "ann" : "alldata";

        const annBrackets = annList
          .filter((a) => a.type === "bracket" && a.sentFrom && a.sentTo)
          .map((a) => ({
            label: a.label,
            sentFrom: a.sentFrom,
            sentTo: a.sentTo,
            _src: annSrc,
          }));

        // F-25 ⓐ: single 모드에서는 vm 병합분에서 bracket 을 뺀다.
        const vmBr = single ? [] : vmBracketsFor(vmAll, yearKey, setId);
        if (annBrackets.length || vmBr.length) {
          setSources.push({
            yearKey,
            setId,
            annSrc,
            annCount: annBrackets.length,
            vmCount: vmBr.length,
          });
        }

        // 중복 제거 — label|from|to 동일 시 앞선 것(vm)만 남는다
        const bk = (b) => `${b.label}|${b.sentFrom}|${b.sentTo}`;
        // 양쪽에 똑같이 있는 항목은 "중복"으로 분류한다. 원천 단일화 후에도
        //   같은 구간이 남으므로 diff 0 판정에서 안전한 쪽이다.
        const annKeys = new Set(annBrackets.map(bk));
        const vmKeys = new Set(vmBr.map(bk));
        const seen = new Set();
        const brackets = [...vmBr, ...annBrackets]
          .filter((b) => {
            const k = bk(b);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .map((b) =>
            annKeys.has(bk(b)) && vmKeys.has(bk(b))
              ? { ...b, _src: "중복(ann=vm)" }
              : b,
          );
        if (!brackets.length) continue;

        const sentIds = set.sents.map((s) => s.id);
        // 문장별 first-match-wins
        const winner = set.sents.map((s) => {
          if (isAreaEndMarker(s)) return null; // 그룹 계산에서 건너뜀
          const cur = sentIds.indexOf(s.id);
          for (const br of brackets) {
            const from = sentIds.indexOf(br.sentFrom);
            const to = sentIds.indexOf(br.sentTo);
            if (from < 0 || to < 0 || cur < 0) continue;
            if (cur >= from && cur <= to) return br;
          }
          return null;
        });

        // 같은 라벨 연속 → 한 구간
        let i = 0;
        while (i < set.sents.length) {
          const w = winner[i];
          if (w === null) {
            i++;
            continue;
          }
          const label = w.label;
          const start = i;
          let last = i;
          let src = w._src;
          const srcs = new Set([w._src]);
          i++;
          while (i < set.sents.length) {
            const w2 = winner[i];
            if (w2 === null && isAreaEndMarker(set.sents[i])) {
              i++;
              continue;
            }
            if (!w2 || w2.label !== label) break;
            srcs.add(w2._src);
            last = i;
            i++;
          }
          if (srcs.size > 1) src = [...srcs].sort().join("+");
          out.push({
            yearKey,
            setId,
            label,
            from: set.sents[start].id,
            to: set.sents[last].id,
            source: src,
          });
        }
      }
    }
  }

  out.sort((a, b) =>
    `${a.yearKey}|${a.setId}|${a.from}|${a.label}`.localeCompare(
      `${b.yearKey}|${b.setId}|${b.from}|${b.label}`,
    ),
  );
  return { brackets: out, setSources, ann, vmAll };
}

function conflicts({ ann, vmAll }) {
  // 같은 (set,label) 인데 ann 과 vm 의 범위가 다른 것
  const rows = [];
  for (const [yearKey, sets] of Object.entries(ann)) {
    for (const [setId, list] of Object.entries(sets)) {
      if (!Array.isArray(list)) continue;
      const vmBr = vmBracketsFor(vmAll, yearKey, setId);
      for (const a of list) {
        if (a.type !== "bracket" || !a.sentFrom || !a.sentTo) continue;
        const v = vmBr.find((x) => x.label === a.label);
        if (!v) continue;
        if (v.sentFrom !== a.sentFrom || v.sentTo !== a.sentTo) {
          rows.push({
            yearKey,
            setId,
            label: a.label,
            ann: `${a.sentFrom}~${a.sentTo}`,
            vm: `${v.sentFrom}~${v.sentTo}`,
          });
        }
      }
    }
  }
  return rows;
}

const argv = process.argv.slice(2);
if (argv[0] === "--diff") {
  const A = readJson(path.resolve(argv[1])).brackets;
  const B = readJson(path.resolve(argv[2])).brackets;
  const key = (r) => `${r.yearKey}|${r.setId}|${r.label}|${r.from}|${r.to}`;
  const sa = new Set(A.map(key));
  const sb = new Set(B.map(key));
  const onlyA = [...sa].filter((k) => !sb.has(k));
  const onlyB = [...sb].filter((k) => !sa.has(k));
  console.log(`A: ${A.length}구간  B: ${B.length}구간`);
  console.log(`A 에만: ${onlyA.length}  B 에만: ${onlyB.length}`);
  for (const k of onlyA.slice(0, 40)) console.log("  - " + k);
  for (const k of onlyB.slice(0, 40)) console.log("  + " + k);
  console.log(
    onlyA.length === 0 && onlyB.length === 0
      ? "\nDIFF 0 — 렌더 결과 동일"
      : "\nDIFF 있음 — 머지 금지",
  );
  process.exit(onlyA.length || onlyB.length ? 1 : 0);
}

const mode = argv.includes("--mode") ? argv[argv.indexOf("--mode") + 1] : "legacy";
if (mode !== "legacy" && mode !== "single") {
  console.error("--mode 는 legacy 또는 single");
  process.exit(2);
}
const res = collect(mode);
const outPath = path.resolve(
  argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : "bracket-dump.json",
);
writeFileSync(
  outPath,
  JSON.stringify({ brackets: res.brackets }, null, 1),
  "utf8",
);

const bySrc = {};
for (const b of res.brackets) bySrc[b.source] = (bySrc[b.source] || 0) + 1;
const labels = new Set(res.brackets.map((b) => `${b.setId}|${b.label}`));

console.log("모드:", mode);
console.log("화면 유효 브래킷 구간:", res.brackets.length);
console.log("고유 (세트,라벨):", labels.size);
console.log("\n원천별 구간 수");
for (const [k, v] of Object.entries(bySrc).sort((a, b) => b[1] - a[1]))
  console.log("  " + String(v).padStart(4), k);

const ad = res.brackets.filter((b) => b.source.includes("alldata"));
console.log("\nall_data(세트 파일 내장) 원천 구간:", ad.length);
for (const r of ad)
  console.log(`  ${r.yearKey} ${r.setId} [${r.label}] ${r.from}~${r.to}`);

const cf = conflicts(res);
console.log("\nann 과 vm 의 범위가 다른 (세트,라벨):", cf.length);
for (const r of cf)
  console.log(
    `  ${r.yearKey} ${r.setId} [${r.label}]  ann=${r.ann}  vm=${r.vm}`,
  );

console.log("\n덤프 기록:", outPath);
