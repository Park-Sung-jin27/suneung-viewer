/**
 * reanalyze_positive.mjs
 *
 * 부실·반전·빈 해설을 Claude API로 재생성.
 * 대상: analysis가 비어있거나, 150자 미만이거나, ok와 반전된 선지
 *
 * 실행:
 *   node pipeline/reanalyze_positive.mjs 2025수능
 *   node pipeline/reanalyze_positive.mjs all   ← 전체 연도
 *   node pipeline/reanalyze_positive.mjs all --dry-run  ← 대상만 출력
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const DATA_PATH = path.resolve(__dirname, "../public/data/all_data_204.json");
const BACKUP_DIR = path.resolve(__dirname, "../pipeline/backups");
const MIN_LENGTH = 150;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const yearArg = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!yearArg) {
  console.error(
    "사용법: node pipeline/reanalyze_positive.mjs <연도키|all> [--dry-run]",
  );
  process.exit(1);
}

// ─── 대상 연도 결정 ────────────────────────────────────────────────────────────
const raw = fs.readFileSync(DATA_PATH, "utf8");
const data = JSON.parse(raw);

const allYears = Object.keys(data);
const yearsToProcess = yearArg === "all" ? allYears : [yearArg];

// ─── 재작성 필요 여부 판단 ─────────────────────────────────────────────────────
function needsRewrite(c) {
  const ana = c.analysis || "";

  // 1. 빈 해설
  if (!ana.trim()) return true;

  // 2. 부실 해설 (150자 미만)
  if (ana.length < MIN_LENGTH) return true;

  // 3. ok:true인데 부정 표현
  const NEG = ["어긋나", "틀리", "왜곡", "오류", "잘못", "부적절", "맞지 않"];
  if (c.ok === true && NEG.some((w) => ana.includes(w))) return true;

  // 4. ok:false인데 긍정 표현
  const POS = ["일치하는 적절한"];
  if (c.ok === false && POS.some((w) => ana.includes(w))) return true;

  // 5. AI 잔재 (영어, AI 사고 과정 노출)
  if (/[a-zA-Z]{10,}/.test(ana)) return true;
  if (ana.includes("지문이 제공되지 않았으나")) return true;

  return false;
}

// ─── analysis 생성 함수 ───────────────────────────────────────────────────────
async function generateAnalysis(set, q, c) {
  const sec = set.id.startsWith("l") ? "literature" : "reading";

  const sents = (set.sents || [])
    .filter((s) => ["body", "verse", "footnote", "author"].includes(s.sentType))
    .map((s) => `[${s.id}] ${s.t}`)
    .join("\n");

  const bogiText = q.bogi
    ? typeof q.bogi === "string"
      ? q.bogi
      : q.bogi.description || ""
    : "";

  const patGuide =
    sec === "reading"
      ? "R1(사실왜곡) R2(인과전도) R3(과잉추론) R4(개념혼합)"
      : "L1(표현오독) L2(정서오독) L3(주제과잉) L4(구조오류) L5(보기대입오류)";

  const prompt = `너는 수능 국어 해설 전문가야. 3~4등급 학생이 이해할 수 있게 해설을 작성해.

[지문 문장]
${sents}

${bogiText ? `[보기]\n${bogiText}\n` : ""}[문제] Q${q.id}: ${q.t}
[선지 ${c.num}번] ${c.t}
[정오] ok:${c.ok} / pat:${c.pat || "null"}
[questionType] ${q.questionType}

[해설 4단계 원칙 — 반드시 준수]

1단계: 선지 조건 분해
선지가 복합 조건(A하며 B를 C)이면 조건을 분리해서 각각 검증하라.

2단계: 작품별 개별 검증 (문학 복수 작품 문항 필수)
가/나/다 각 작품에서 선지 조건이 성립하는지 개별 확인하라.
공통점 문항은 모든 작품에서 동시에 성립해야 정답.
일부 작품에만 해당하면 어느 작품에 해당하고 어느 작품에 없는지 명시하라.

3단계: 혼동 포인트 명시
단순히 '없다'가 아니라 '~처럼 보이지만 실제로는 ~이다'를 설명하라.

4단계: 결론 한 줄
어떤 조건이 왜 불충족인지 한 줄로 마무리하라.

[해설 포맷]
ok:true:
"📌 지문 근거: \\"...\\"
🔍 ...
✅ 지문과 일치하는 적절한 진술"

ok:false:
"📌 지문 근거: \\"...\\"
🔍 ...
❌ 지문과 어긋나는 부적절한 진술 [패턴명]"

보기 있으면:
"📌 보기 근거: \\"...\\"
📌 지문 근거: \\"...\\"
🔍 ...
✅/❌ ... [패턴명]"

패턴: ${patGuide}
ok:true이면 패턴 없음.
해설만 출력. 설명·마크다운 금지.
최소 150자 이상 작성.`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].text.trim();
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

// 백업 (dry-run이 아닐 때만)
if (!dryRun) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.writeFileSync(
    path.join(BACKUP_DIR, `all_data_204_backup_${ts}.json`),
    raw,
  );
  console.log(`✅ 백업 완료\n`);
}

let totalTarget = 0;
let totalFixed = 0;

for (const yearKey of yearsToProcess) {
  if (!data[yearKey]) {
    console.warn(`⚠️  ${yearKey} 없음, 스킵`);
    continue;
  }

  for (const sec of ["reading", "literature"]) {
    for (const set of data[yearKey][sec] || []) {
      for (const q of set.questions) {
        const targets = q.choices.filter(needsRewrite);
        if (targets.length === 0) continue;

        totalTarget += targets.length;
        console.log(
          `[${yearKey}] ${set.id} Q${q.id} — ${targets.length}개 재작성 대상`,
        );

        if (dryRun) {
          targets.forEach((c) =>
            console.log(
              `  [${c.num}] ok:${c.ok} pat:${c.pat} len:${(c.analysis || "").length}자`,
            ),
          );
          continue;
        }

        for (const c of q.choices) {
          if (!needsRewrite(c)) continue;

          process.stdout.write(`  [${c.num}] ok:${c.ok} 재생성 중...`);
          try {
            c.analysis = await generateAnalysis(set, q, c);
            if (c.ok === true) c.pat = null;
            console.log(` ✅ (${c.analysis.length}자)`);
            totalFixed++;
          } catch (err) {
            console.log(` ❌ 실패: ${err.message}`);
          }

          await new Promise((r) => setTimeout(r, 1000));
        }

        // 중간 저장 (중단 대비)
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
      }
    }
  }
}

if (dryRun) {
  console.log(`\n총 재작성 대상: ${totalTarget}건 (dry-run — 실제 저장 없음)`);
} else {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  console.log(`\n✅ 완료: ${totalFixed}/${totalTarget}개 analysis 재작성`);
}
