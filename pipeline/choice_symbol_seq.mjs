// choice_symbol_seq.mjs — 어휘형 문항 전용 축: 기호 순서열 비교 (발주 s ②)
//
// 배경: `문맥상 ⓐ~ⓔ와 바꿔 쓰기에 적절하지 않은 것은?` 유형은 선지가
//   `① ⓐ: 붙잡다` 형태라 본문이 5~10자 → 앵커 방식(choice_source_diff)이 전량 실패한다.
//   하한을 6자로 낮춰도 부족하다.
//
// 대안: 본문 텍스트를 전혀 보지 않고 **기호 시퀀스만** 비교한다.
//   DB  : 선지 ①~⑤에 붙은 기호 순서   예 [ⓐ,ⓑ,ⓒ,ⓓ,ⓔ]
//   PDF : 같은 문항의 선지 기호 순서
//   다르면 치명(순서 밀림 · 누락 · 중복).
//   → 앵커 실패와 무관하게 동작한다.
//
// 읽기 전용. all_data 기록 금지.
// 사용: node pipeline/choice_symbol_seq.mjs --pilot
//       node pipeline/choice_symbol_seq.mjs --all
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public/data/all_data_204.json");
const OUT_PATH = path.join(__dirname, "output/_choice_symbol_seq.json");

const args = process.argv.slice(2);
const PILOT = args.includes("--pilot");
const ALL = args.includes("--all");
// 양성 회귀용: --targets=yk/setId/qId,yk/setId/qId  (§13⑮⑺ — "0건"은 양성 통과 후에만 신뢰)
const TARGETS = (args.find((a) => a.startsWith("--targets=")) || "").split(
  "=",
)[1];
if (!PILOT && !ALL && !TARGETS) {
  console.error("사용: node pipeline/choice_symbol_seq.mjs --pilot | --all");
  process.exit(2);
}

const SYM_CLASS = "㉠-㉭ⓐ-ⓩ①-⑳Ⓐ-Ⓩ";
const HAS_SYM = new RegExp(`[${SYM_CLASS}]`);
// 원숫자 ①~⑤ = 선지 번호. 기호로 오인하면 시퀀스가 오염된다.
const CNUM = { "①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5 };
// 선지 내부 마커 — ⓐ-ⓩ · ㉠-㉭ · Ⓐ-Ⓩ · ⑥-⑳
//   ★ ①-⑤(U+2460~2464)만 제외한다. 그건 선지 번호라 마커로 오인하면 시퀀스가 오염된다.
//   ⑥ 이상은 선지 번호로 쓰이지 않으므로 마커로 취급해야 한다 — 전체를 제외하면
//   DB가 ⑦⑧⑨⑩⑪을 마커로 쓴 문항(2021수능 l2021d Q44)이 통째로 안 보인다(실증).
const MARK = /[㉠-㉭ⓐ-ⓩⒶ-Ⓩ⑥-⑳]/g;

const NO_TEXT_LAYER = new Set(["2014수능A", "2014수능B"]);

function pdfText(yk) {
  for (const dir of [`_done/${yk}`, `_done/${yk}A`, `_done/${yk}B`]) {
    const d = path.join(ROOT, dir);
    if (!fs.existsSync(d)) continue;
    const hit = fs.readdirSync(d).find((x) => x.endsWith("시험지.pdf"));
    if (!hit) continue;
    try {
      return execSync(`pdftotext -raw -enc UTF-8 "${path.join(d, hit)}" -`, {
        maxBuffer: 2e8,
      }).toString();
    } catch {
      return null;
    }
  }
  return null;
}

// PDF 전문에서 "N. 발문…" 이후 ①~⑤ 각 선지의 첫 마커를 순서대로 뽑는다.
//   문항 시작은 줄머리의 "N." 로 잡고, 다음 문항 시작 전까지를 구간으로 본다.
function pdfSeqForQuestion(rawText, qId) {
  const lines = rawText.split("\n");
  const startRe = new RegExp(`^\\s*${qId}\\s*[.．]`);
  let start = -1;
  for (let i = 0; i < lines.length; i++)
    if (startRe.test(lines[i])) {
      start = i;
      break;
    }
  if (start < 0) return null;
  const nextRe = new RegExp(`^\\s*${+qId + 1}\\s*[.．]`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++)
    if (nextRe.test(lines[i])) {
      end = i;
      break;
    }
  const block = lines.slice(start, end).join("\n");
  // ①~⑤ 를 경계로 잘라 각 선지의 첫 마커를 취한다.
  const seq = [];
  for (const n of ["①", "②", "③", "④", "⑤"]) {
    const at = block.indexOf(n);
    if (at < 0) {
      seq.push(null);
      continue;
    }
    // 다음 번호까지
    let stop = block.length;
    for (const m of ["①", "②", "③", "④", "⑤"]) {
      const p = block.indexOf(m, at + 1);
      if (p > at && p < stop) stop = p;
    }
    const seg = block.slice(at + 1, stop);
    MARK.lastIndex = 0;
    const hit = seg.match(MARK);
    seq.push(hit ? hit[0] : null);
  }
  return seq;
}

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const PILOT_TARGETS = [
  ["2026수능", "r2026b", 9],
  ["2025수능", "r2025d", 17],
  ["2024수능", "r2024c", 11],
];

const findings = [];
let scanned = 0,
  matched = 0,
  pdfFail = 0,
  mismatch = 0;

function handleYear(yk, only) {
  if (NO_TEXT_LAYER.has(yk)) return;
  const raw = pdfText(yk);
  if (!raw) return;
  for (const sec of ["reading", "literature"])
    for (const set of data[yk][sec] || [])
      for (const q of set.questions || []) {
        if (only && !only.some((o) => o[1] === set.id && o[2] === +q.id))
          continue;
        // 선지에 마커가 있는 문항만(어휘형 포함, 발문 조건 없음)
        const dbSeq = (q.choices || []).map((c) => {
          MARK.lastIndex = 0;
          const m = (c.t || "").match(MARK);
          return m ? m[0] : null;
        });
        if (!dbSeq.some(Boolean)) continue;
        scanned++;
        const pdfSeq = pdfSeqForQuestion(raw, q.id);
        if (!pdfSeq) {
          pdfFail++;
          continue;
        }
        matched++;
        const diffs = [];
        for (let i = 0; i < Math.max(dbSeq.length, pdfSeq.length); i++)
          if ((dbSeq[i] || null) !== (pdfSeq[i] || null))
            diffs.push({ 선지: i + 1, db: dbSeq[i], pdf: pdfSeq[i] });
        if (diffs.length) {
          mismatch++;
          findings.push({
            yearKey: yk,
            setId: set.id,
            qId: q.id,
            발문: (q.t || "").slice(0, 46),
            db_seq: dbSeq,
            pdf_seq: pdfSeq,
            diffs,
          });
        }
      }
}

if (TARGETS) {
  const t = TARGETS.split(",").map((x) => {
    const [yk, sid, qid] = x.split("/");
    return [yk, sid, +qid];
  });
  for (const yk of [...new Set(t.map((x) => x[0]))]) handleYear(yk, t);
} else if (PILOT)
  for (const [yk] of PILOT_TARGETS) handleYear(yk, PILOT_TARGETS);
else for (const yk of Object.keys(data)) handleYear(yk, null);

const summary = {
  scope: PILOT ? "pilot(3문항)" : "all",
  대상_문항: scanned,
  대조_성공: matched,
  PDF_구간_실패: pdfFail,
  시퀀스_불일치: mismatch,
};
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(
  OUT_PATH,
  JSON.stringify({ summary, findings }, null, 2),
  "utf8",
);
console.log(JSON.stringify(summary, null, 2));
for (const f of findings) {
  console.log(`\n${f.yearKey} ${f.setId} Q${f.qId} — ${f.발문}`);
  console.log(`   DB : [${f.db_seq.join(",")}]`);
  console.log(`   PDF: [${f.pdf_seq.join(",")}]`);
  for (const d of f.diffs)
    console.log(`   ★선지${d.선지}: DB "${d.db}" → PDF "${d.pdf}"`);
}
console.log(`\n📄 ${path.relative(ROOT, OUT_PATH)}`);
