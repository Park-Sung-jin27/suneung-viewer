// extractor_corpus_check.mjs — 추출기 회귀 코퍼스 (발주 ce[2])
//
// 목적: 추출기를 고칠 때마다 예시문항 1종이 아니라 _done/ 전 조판으로 A/B 를 한다.
//   pdf_text_extractor.parseQuestionBlocks 를 시험지 PDF 전량에 돌려
//   "세트(yearKey)별 정상 5선지 문항 수"를 기준선과 대조한다.
//   기준선 대비 악화가 1건이라도 있으면 종료 코드 1.
//
//   왜 필요한가: ca·cd 두 번 연속으로, 픽스처는 통과했는데 실전 조판에서
//   다른 문항이 깨졌다(ca: 4문항 / cd 1차: Q31). 픽스처만으로는 안전이 보장되지 않는다.
//
// 사용:
//   node pipeline/extractor_corpus_check.mjs --update   기준선 재생성(승인 후에만)
//   node pipeline/extractor_corpus_check.mjs            기준선 대조 (CI/회귀용)
//   node pipeline/extractor_corpus_check.mjs --limit=5  일부만 (개발 중 빠른 확인)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractPdfText, parseQuestionBlocks } from "./pdf_text_extractor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DONE = path.join(ROOT, "_done");
const BASELINE = path.join(HERE, "extractor_corpus_baseline.json");

const argv = process.argv.slice(2);
const UPDATE = argv.includes("--update");
const LIMIT = Number((argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);

// 공통 범위: 2022학년도~ 는 1~34, 그 이전은 16~34 (선택 분리 이전 구조 차이)
//   범위 판정을 데이터에 의존하지 않도록 상한만 34 로 고정하고 하한은 1 로 둔다.
//   (선택과목 35~45 는 조판이 달라 기준선 노이즈가 크다)
const inScope = (id) => id >= 1 && id <= 34;

function listExams() {
  if (!fs.existsSync(DONE)) return [];
  const out = [];
  for (const yk of fs.readdirSync(DONE).sort()) {
    const p = path.join(DONE, yk, `${yk}_시험지.pdf`);
    if (fs.existsSync(p)) out.push({ yk, pdf: p });
  }
  return LIMIT ? out.slice(0, LIMIT) : out;
}

async function measure() {
  const rows = {};
  const exams = listExams();
  for (let i = 0; i < exams.length; i++) {
    const { yk, pdf } = exams[i];
    process.stderr.write(`\r  측정 ${i + 1}/${exams.length}  ${yk}          `);
    try {
      // sanity 는 여기서 우회한다 — 기준선은 "현행 리더로 뽑은 값" 자체가 기준이며,
      // 일부 구형 시험지는 스캔본이라 임계를 넘을 수 있다(추출기 결함이 아님).
      const { fullText, sanity } = await extractPdfText(pdf, { skipSanity: true });
      const blocks = parseQuestionBlocks(fullText).filter((b) => inScope(b.id));
      const ok5 = blocks.filter((b) => b.choices.length === 5).length;
      const bad = blocks.filter((b) => b.choices.length !== 5)
        .map((b) => `${b.id}:${b.choices.length}`);
      rows[yk] = { blocks: blocks.length, ok5, bad, permille: sanity.permille };
    } catch (e) {
      rows[yk] = { error: String(e.message).slice(0, 120) };
    }
  }
  process.stderr.write("\r" + " ".repeat(48) + "\r");
  return rows;
}

const now = await measure();
const totals = (r) => Object.values(r).reduce(
  (a, v) => ({ ok5: a.ok5 + (v.ok5 || 0), blocks: a.blocks + (v.blocks || 0), err: a.err + (v.error ? 1 : 0) }),
  { ok5: 0, blocks: 0, err: 0 });

if (UPDATE) {
  fs.writeFileSync(BASELINE, Buffer.from(JSON.stringify({ _note:
    "추출기 회귀 기준선. 세트별 '정상 5선지 문항 수'. --update 는 심사관 승인 후에만.",
    generatedBy: "extractor_corpus_check.mjs --update", sets: Object.keys(now).length,
    ...totals(now), rows: now }, null, 1), "utf8"));
  const t = totals(now);
  console.log(`기준선 재생성 → ${path.relative(ROOT, BASELINE)}`);
  console.log(`  시험지 ${Object.keys(now).length}종 · 정상5선지 ${t.ok5}/${t.blocks} · 추출오류 ${t.err}`);
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) {
  console.error("★ 기준선 없음 — 먼저 --update 로 생성하십시오.");
  process.exit(1);
}
const base = JSON.parse(fs.readFileSync(BASELINE, "utf8")).rows;
const t0 = totals(base), t1 = totals(now);
console.log(`추출기 코퍼스 회귀 — 시험지 ${Object.keys(now).length}종\n`);
console.log(`  기준선 정상5선지 ${t0.ok5}/${t0.blocks}   현재 ${t1.ok5}/${t1.blocks}   차 ${t1.ok5 - t0.ok5 >= 0 ? "+" : ""}${t1.ok5 - t0.ok5}`);

let worse = 0, better = 0;
for (const yk of Object.keys(base)) {
  const b = base[yk], n = now[yk];
  if (!n) { console.log(`  🔴 ${yk}  기준선에 있으나 현재 측정 불가`); worse++; continue; }
  if (b.error || n.error) {
    if (!b.error && n.error) { console.log(`  🔴 ${yk}  신규 추출 오류: ${n.error}`); worse++; }
    continue;
  }
  if (n.ok5 < b.ok5) {
    worse++;
    const gone = (n.bad || []).filter((x) => !(b.bad || []).includes(x));
    console.log(`  🔴 ${yk}  정상5선지 ${b.ok5} → ${n.ok5}  (블록 ${b.blocks}→${n.blocks})  신규이상 [${gone.join(" ")}]`);
  } else if (n.ok5 > b.ok5) {
    better++;
    console.log(`  ✅ ${yk}  정상5선지 ${b.ok5} → ${n.ok5}`);
  }
}
console.log(`\n  악화 ${worse}세트 · 개선 ${better}세트`);
if (worse) {
  console.log(`★ 악화가 있습니다 — 추출기 변경을 재검토하십시오. 개선이 있어도 악화가 0이어야 통과입니다.`);
  process.exit(1);
}
console.log(`통과 — 기준선 대비 악화 0.`);
