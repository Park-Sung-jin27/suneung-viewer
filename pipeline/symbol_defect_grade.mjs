// symbol_defect_grade.mjs — 기호 결함 등급 판정축 D1/D2/D3 (발주 t ①)
//
// 배경: "PDF와 기호가 다르다"만으로 해설 폐기를 추정하면 살릴 해설을 버린다.
//   실증(심사관) — l2021d Q44는 선지·본문·cs_ids·해설이 전부 ⑦~⑪로 **일관**해
//   뷰어 하이라이트까지 정상이다. 원문(㉠~㉤)과만 다르므로 기호 매핑 치환으로 끝난다.
//   r2023c Q13은 선지에서 ⓐ만 소실됐을 뿐 해설은 ⓐ를 정확히 논증한다.
//   → 결함은 등급이 다르며, 등급이 다르면 처방이 다르다.
//
// 판정축(3자 정합: 선지기호 ↔ 본문 sents 기호 ↔ 해설 📌/🔍 인용기호)
//   D1 내부정합 파괴 : 3자 중 하나라도 어긋남        → 트랙B · 해설 재생성
//   D2 전역 치환     : 3자 정합 유지 + PDF와만 상이  → 트랙A급 · 일괄 치환 · 해설 보존
//   D3 마커 소실     : 발문·본문엔 있고 선지에만 부재 → 트랙A급 · 마커 복원 · 해설 보존
//   D0 미상          : 기계 판별 불가(개수 보고 필수)
//
// 읽기 전용. all_data 기록 금지.
// 사용: node pipeline/symbol_defect_grade.mjs --regress   (양성 회귀 3건)
//       node pipeline/symbol_defect_grade.mjs --all
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process"; // 발주 u ② 위치축(PDF 원문 대조)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public/data/all_data_204.json");
const DIFF_PATH = path.join(
  __dirname,
  "output/_choice_symbol_diff_expanded.json",
);
const OUT_PATH = path.join(__dirname, "output/_symbol_defect_grades.json");

const args = process.argv.slice(2);
const REGRESS = args.includes("--regress");
const ALL = args.includes("--all");
if (!REGRESS && !ALL) {
  console.error(
    "사용: node pipeline/symbol_defect_grade.mjs --regress | --all",
  );
  process.exit(2);
}

const SYM_ALL = /[㉠-㉭ⓐ-ⓩⒶ-Ⓩ⑥-⑳]/g; // ①-⑤는 선지번호라 제외
const uniq = (a) => [...new Set(a)];
const symsOf = (s) => {
  SYM_ALL.lastIndex = 0;
  return uniq(String(s || "").match(SYM_ALL) || []);
};

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const diff = JSON.parse(fs.readFileSync(DIFF_PATH, "utf8"));

// [발주 u ②] D2 위치축 — "본문에 그 기호가 있는가(집합)"만 보면, 본문 자체가 밀려 있어도
//   3자 정합이 유지돼 D2로 나온다. 그대로 치환하면 잘못된 문장을 근거로 든 해설이 살아남는다.
//   → 최종 D2 문항은 마커가 **같은 문장**에 붙어 있는지까지 확인한다.
//   2014수능A·B는 PDF 텍스트레이어 부재 → 판정불가 고정.
const NO_TEXT_LAYER = new Set(["2014수능A", "2014수능B"]);
const _pdfCache = {};
function pdfRaw(yk) {
  if (yk in _pdfCache) return _pdfCache[yk];
  let out = null;
  for (const dir of [`_done/${yk}`, `_done/${yk}A`, `_done/${yk}B`]) {
    const d = path.join(ROOT, dir);
    if (!fs.existsSync(d)) continue;
    const hit = fs.readdirSync(d).find((x) => x.endsWith("시험지.pdf"));
    if (!hit) continue;
    try {
      out = execSync(`pdftotext -raw -enc UTF-8 "${path.join(d, hit)}" -`, {
        maxBuffer: 2e8,
      }).toString();
    } catch {
      out = null;
    }
    break;
  }
  return (_pdfCache[yk] = out);
}
const posNorm = (s) =>
  String(s || "")
    .replace(/[“”„‟＂]/g, '"')
    .replace(/[‘’‚‛＇]/g, "'")
    .replace(/\s+/g, "");

// 본문에서 각 마커 직후 15자를 뽑아 PDF의 같은 마커 직후와 대조.
//   ★ 반드시 매핑(fwdMap: DB기호→PDF기호)을 적용해 검색한다.
//     D2는 정의상 DB기호 ≠ PDF기호이므로, DB기호 그대로 PDF를 찾으면 전건 "상이"가 된다
//     (l2021d Q44 실증: ⑦"수수알이…"를 PDF에서 찾으니 당연히 없음 → 도구 결함성 승격).
//     본문 마커 ⑦은 PDF의 ㉠에 대응하므로 ㉠+본문텍스트로 조회해야 위치가 검증된다.
function checkPosition(yk, set, fwdMap) {
  if (NO_TEXT_LAYER.has(yk))
    return { 위치정합: "판정불가", 사유: "PDF 텍스트레이어 부재" };
  const raw = pdfRaw(yk);
  if (!raw) return { 위치정합: "판정불가", 사유: "PDF 없음" };
  const pdfN = posNorm(raw);
  const bodyN = posNorm((set.sents || []).map((s) => s.t).join(""));
  const mismatched = [];
  let checked = 0;
  const seen = new Set();
  const re = new RegExp(`([㉠-㉭ⓐ-ⓩⒶ-Ⓩ⑥-⑳])`, "g");
  let m;
  while ((m = re.exec(bodyN))) {
    const sym = m[1];
    if (seen.has(sym)) continue;
    seen.add(sym);
    const after = bodyN.slice(m.index + 1, m.index + 16);
    if (after.length < 8) continue;
    checked++;
    // DB기호 → PDF기호 변환(매핑 없으면 동일 기호로 간주)
    const mapped = (fwdMap && fwdMap.get(sym)) || sym;
    const at = pdfN.indexOf(mapped + after.slice(0, 12));
    if (at < 0) mismatched.push(`${sym}→${mapped}"${after.slice(0, 12)}"`);
  }
  if (!checked) return { 위치정합: "판정불가", 사유: "본문 마커 앵커 부족" };
  return mismatched.length
    ? {
        위치정합: "상이",
        사유: `PDF에 동일 위치 없음: ${mismatched.join(" ")}`,
      }
    : { 위치정합: "일치", 사유: `마커 ${checked}종 위치 확인` };
}

function findQ(yk, setId, qId) {
  for (const sec of ["reading", "literature"])
    for (const s of (data[yk] || {})[sec] || [])
      if (s.id === setId) {
        const q = (s.questions || []).find((x) => String(x.id) === String(qId));
        if (q) return { set: s, q };
      }
  return null;
}

// 문항 단위 등급 판정 — 같은 문항의 선지들은 같은 원인을 공유한다.
function grade(yk, setId, qId, pairs = []) {
  const hit = findQ(yk, setId, qId);
  if (!hit) return { grade: "D0", reason: "문항 없음" };
  const { set, q } = hit;

  const bodySyms = symsOf((set.sents || []).map((s) => s.t).join("\n"));
  const qSyms = symsOf(q.t);
  const choiceSyms = uniq((q.choices || []).flatMap((c) => symsOf(c.t)));
  const anaSyms = uniq((q.choices || []).flatMap((c) => symsOf(c.analysis)));

  // D3: 발문·본문엔 기호가 있는데 선지엔 전무 → 마커 소실
  const refSyms = uniq([...qSyms, ...bodySyms]);
  if (refSyms.length && choiceSyms.length === 0)
    return {
      grade: "D3",
      reason: "선지에 마커 전무(발문·본문엔 존재) — 마커 복원, 해설 보존",
      bodySyms,
      qSyms,
      choiceSyms,
      anaSyms,
    };

  // [매핑 정합성 검사 = 함수성(well-definedness) + 단사성(injectivity)] (발주 v ②)
  //   함수성 위반 = 한 DB기호가 서로 다른 PDF기호로 감(㉠→{㉠,㉡}) — 같은 기호가 여러 대상을 가리킴.
  //   단사성 위반 = 서로 다른 DB기호가 같은 PDF기호로 몰림({㉠,㉡}→㉡) — 두 기호가 한 대상을 가리킴.
  // [D2 정의의 구조적 함의] (발주 v ③) — 항등쌍을 매핑에 포함하므로 D2 성립 조건은 사실상
  //   "항등쌍 0 + 전단사", 즉 **계열 통째 치환**뿐이다. 이는 의도된 정의다.
  //   부분적으로만 기호가 다르면 그 순간 항등쌍과 충돌해 전역 치환이 아니므로 D1이다.
  // [D1 vs D2] 집합 포함관계로는 갈리지 않는다 — 본문에 두 계열이 공존하면
  //   뒤섞인 선지도 "선지 ⊆ 본문"을 통과한다(l20269c Q32 실증: D1인데 D2로 오판).
  //   판별식은 **DB→PDF 매핑의 일관성(단사성)**이다.
  //     D2 = 전역 치환: 각 DB 기호가 정확히 하나의 PDF 기호로 대응하고 역도 성립
  //          (⑦→㉠, ⑧→㉡ … 위치 보존 전단사) + 본문·해설도 같은 DB 계열 사용
  //     D1 = 뒤섞임: 한 DB 기호가 서로 다른 PDF 기호로 가거나(충돌),
  //          두 DB 기호가 같은 PDF 기호로 몰림 → 지시 대상이 어긋난 것
  //   ★ [발주 u ①] 매핑은 diff쌍뿐 아니라 **항등쌍(DB기호==PDF기호)까지 전부** 넣는다.
  //     항등쌍도 "이 DB기호는 이 PDF기호를 가리킨다"는 지시 관계이므로 단사성의 일부다.
  //     빼면 충돌이 안 보여 D2로 오판한다(r20259b Q5: 항등쌍 ㉡→㉡ 포함 시에만 ㉡ 수렴 충돌 노출).
  const fwd = new Map(); // db → set(pdf)
  const rev = new Map(); // pdf → set(db)
  for (const d of pairs) {
    const db = d.db[0],
      pdf = d.pdf[0];
    if (!fwd.has(db)) fwd.set(db, new Set());
    if (!rev.has(pdf)) rev.set(pdf, new Set());
    fwd.get(db).add(pdf);
    rev.get(pdf).add(db);
  }
  const fwdConflict = [...fwd.entries()].filter(([, v]) => v.size > 1);
  const revConflict = [...rev.entries()].filter(([, v]) => v.size > 1);
  const notInBody = choiceSyms.filter((s) => !bodySyms.includes(s));
  const anaNotInBody = anaSyms.filter((s) => !bodySyms.includes(s));

  if (fwdConflict.length || revConflict.length) {
    const c = [
      ...fwdConflict.map(([k, v]) => `${k}→{${[...v].join(",")}}`),
      ...revConflict.map(([k, v]) => `{${[...v].join(",")}}→${k}`),
    ];
    const 위반유형 =
      fwdConflict.length && revConflict.length
        ? "양쪽"
        : fwdConflict.length
          ? "함수성"
          : "단사성";
    return {
      grade: "D1",
      위반유형,
      reason: `매핑 정합성 위반(${위반유형}) — ${c.join(" ")} : 지시 대상 어긋남, 해설 재생성`,
      bodySyms,
      qSyms,
      choiceSyms,
      anaSyms,
    };
  }
  if (notInBody.length || anaNotInBody.length) {
    return {
      grade: "D1",
      reason: `내부정합 파괴 — 선지⊄본문 [${notInBody.join(",") || "-"}] / 해설⊄본문 [${anaNotInBody.join(",") || "-"}]`,
      bodySyms,
      qSyms,
      choiceSyms,
      anaSyms,
    };
  }
  return {
    grade: "D2",
    fwdMap: new Map([...fwd.entries()].map(([k, v]) => [k, [...v][0]])),
    reason: `전역 치환(일관 매핑 ${[...fwd.entries()].map(([k, v]) => k + "→" + [...v][0]).join(" ")}) — 해설 보존`,
    bodySyms,
    qSyms,
    choiceSyms,
    anaSyms,
  };
}

// 대상: 치명(계열상이·기호상이) 보유 문항
const targets = {};
for (const f of diff.findings || []) {
  if (!f.diffs.some((d) => d.sev !== "조사만")) continue;
  const k = `${f.set}|${f.yearKey}|${f.setId}|${f.qId}`;
  targets[k] = targets[k] || {
    set: f.set,
    yk: f.yearKey,
    setId: f.setId,
    qId: f.qId,
    선지: new Set(),
    치명곳: 0,
    pairs: [], // ★ 매핑 충돌 판정 입력 — 빠지면 전건 D2로 오판(해설 보존 방향 = 위험)
  };
  targets[k].선지.add(f.num);
  const fatal = f.diffs.filter((d) => d.sev !== "조사만");
  targets[k].치명곳 += fatal.length;
}

// [발주 u ①] 문항의 **전 선지 매핑**(항등쌍 포함)을 q_symbol_maps에서 구성한다.
//   diff쌍만 쓰던 이전 방식은 항등쌍을 빠뜨려 충돌을 못 봤다(r20259b Q5 → D2 오판).
//   --regress 와 --all 이 동일 입력을 쓰도록 단일 함수로 통일한다.
function allPairs(set, yk, sid, qid) {
  const maps = diff.q_symbol_maps || {};
  const rows =
    maps[`${set}|${yk}|${sid}|${qid}`] ||
    maps[`A|${yk}|${sid}|${qid}`] ||
    maps[`B|${yk}|${sid}|${qid}`] ||
    [];
  const out = [];
  for (const r of rows) {
    const n = Math.min((r.db || []).length, (r.pdf || []).length);
    for (let i = 0; i < n; i++) out.push({ db: r.db[i], pdf: r.pdf[i] });
  }
  return out;
}

const REG = [
  ["2021수능", "l2021d", 44, "D2"],
  ["2023수능", "r2023c", 13, "D3"],
  ["2026_9월", "l20269c", 32, "D1"],
  ["2025_9월", "r20259b", 5, "D1"], // 발주 u ① 반례 — 항등쌍 포함 시에만 D1
];

if (REGRESS) {
  console.log(`=== 양성 회귀 (기지 정답 ${REG.length}건) ===`);
  let pass = 0;
  for (const [yk, sid, qid, want] of REG) {
    const g = grade(yk, sid, qid, allPairs(null, yk, sid, qid));
    const ok = g.grade === want;
    if (ok) pass++;
    console.log(
      `  ${yk} ${sid} Q${qid}: 기대 ${want} / 판정 ${g.grade}  ${ok ? "✅" : "★불일치★"}`,
    );
    console.log(`     ${g.reason}`);
    console.log(
      `     본문[${(g.bodySyms || []).join(",")}] 발문[${(g.qSyms || []).join(",")}] 선지[${(g.choiceSyms || []).join(",")}] 해설[${(g.anaSyms || []).join(",")}]`,
    );
  }
  console.log(
    `\n  → ${pass}/${REG.length} ${pass === REG.length ? "✅ 통과 — 전수 가능" : "★미통과 — 전수 금지★"}`,
  );
  process.exit(pass === REG.length ? 0 : 1);
}

const rows = [];
const dist = { A: {}, B: {} };
const posEscalated = []; // 위치 상이로 D2→D1 승격된 문항(발주 u ②)
for (const t of Object.values(targets)) {
  const g = grade(t.yk, t.setId, t.qId, allPairs(t.set, t.yk, t.setId, t.qId));
  let 위치 = null;
  let finalGrade = g.grade;
  if (g.grade === "D2") {
    // [발주 u ②] 최종 D2만 위치축 검사 — '상이'면 D1로 승격(자동 진행 금지 대상).
    const hit = findQ(t.yk, t.setId, t.qId);
    위치 = hit
      ? checkPosition(t.yk, hit.set, g.fwdMap)
      : { 위치정합: "판정불가", 사유: "문항 없음" };
    if (위치.위치정합 === "상이") {
      finalGrade = "D1";
      posEscalated.push({
        문항: `${t.yk} ${t.setId} Q${t.qId}`,
        이전등급: "D2",
        신등급: "D1",
        사유: 위치.사유,
      });
    }
  }
  rows.push({
    set: t.set,
    yearKey: t.yk,
    setId: t.setId,
    qId: t.qId,
    선지수: t.선지.size,
    치명곳: t.치명곳,
    grade: finalGrade,
    위반유형: g.위반유형 || null,
    grade_before_position: g.grade,
    reason: g.reason,
    위치정합: 위치 ? 위치.위치정합 : null,
    위치사유: 위치 ? 위치.사유 : null,
    본문기호: g.bodySyms,
    선지기호: g.choiceSyms,
    해설기호: g.anaSyms,
  });
  dist[t.set][finalGrade] = (dist[t.set][finalGrade] || 0) + 1;
}
rows.sort((a, b) => (a.set + a.grade).localeCompare(b.set + b.grade));

const preserved = rows.filter((r) => r.grade === "D2" || r.grade === "D3");
const summary = {
  대상_문항: rows.length,
  set_A_분포: dist.A,
  set_B_분포: dist.B,
  해설보존대상_문항: preserved.length,
  해설보존대상_선지: preserved.reduce((a, r) => a + r.선지수, 0),
  위치축_D2에서_D1승격: posEscalated,
  재생성대상_D1_문항: rows.filter((r) => r.grade === "D1").length,
  재생성대상_D1_선지: rows
    .filter((r) => r.grade === "D1")
    .reduce((a, r) => a + r.선지수, 0),
  미상_D0: rows.filter((r) => r.grade === "D0").length,
};
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify({ summary, rows }, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
console.log("\nset 문항                              선지 치명 등급");
for (const r of rows)
  console.log(
    `${r.set}   ${(r.yearKey + " " + r.setId + " Q" + r.qId).padEnd(30)} ${String(r.선지수).padStart(3)} ${String(r.치명곳).padStart(4)}  ${r.grade}`,
  );
console.log(`\n📄 ${path.relative(ROOT, OUT_PATH)}`);
