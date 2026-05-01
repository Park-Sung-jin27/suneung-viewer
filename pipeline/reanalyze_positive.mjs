/**
 * reanalyze_positive.mjs
 *
 * ok flip된 positive 문제들의 analysis만 Claude API로 재생성.
 * 대상: questionType='positive'이고 analysis 내용이 반전된 세트
 *
 * 실행:
 *   node pipeline/reanalyze_positive.mjs 2025수능
 *   node pipeline/reanalyze_positive.mjs 2025_9월
 *   node pipeline/reanalyze_positive.mjs all   ← 전체 대상 연도
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
const REPORT_PATH = path.resolve(__dirname, "reanalyze_positive_report.json");
const MAX_RETRY = 2;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TARGET_YEARS = {
  "2025수능": true,
  "2025_9월": true,
  "2026수능": true,
  "2026_6월": true,
  "2023수능": true,
};

const yearArg = process.argv[2];
if (!yearArg) {
  console.error(
    "사용법: node pipeline/reanalyze_positive.mjs <연도키|all|--scope=모의고사전체|--scope=suneung5>",
  );
  process.exit(1);
}

// --scope 지원: 2022~2026 범위 내 6월/9월 모의고사 10개 또는 수능 5개
const SCOPE_PRESETS = {
  모의고사전체: [
    "2022_6월", "2022_9월",
    "2023_6월", "2023_9월",
    "2024_6월", "2024_9월",
    "2025_6월", "2025_9월",
    "2026_6월", "2026_9월",
  ],
  suneung5: ["2022수능", "2023수능", "2024수능", "2025수능", "2026수능"],
};

// ─── 대상 연도 결정 ────────────────────────────────────────────────────────────
const scopeMatch = yearArg.match(/^--scope=(.+)$/);
const yearsToProcess = scopeMatch
  ? SCOPE_PRESETS[scopeMatch[1]] || [scopeMatch[1]]
  : yearArg === "all"
    ? Object.keys(TARGET_YEARS)
    : [yearArg];

// ─── analysis 생성 함수 ───────────────────────────────────────────────────────
async function generateAnalysis(set, q, c) {
  const sents = (set.sents || [])
    .filter((s) => ["body", "verse", "footnote", "author"].includes(s.sentType))
    .map((s) => `[${s.id}] ${s.t}`)
    .join("\n");

  const bogiText = q.bogi
    ? typeof q.bogi === "string"
      ? q.bogi
      : q.bogi.description || ""
    : "";

  const prompt = `너는 수능 국어 해설 전문가야. 아래 지문·보기·선지를 읽고 해설을 작성해.

[지문 문장]
${sents}

${bogiText ? `[보기]\n${bogiText}\n` : ""}
[문제] Q${q.id}: ${q.t}
[선지 ${c.num}번] ${c.t}
[정오] ok:${c.ok} (ok:true=지문과 사실 일치, ok:false=불일치)
[questionType] positive (ok:true인 선지가 정답)

[해설 포맷 규칙]
ok:true:
"📌 지문 근거: \\"...\\"
🔍 ...
✅ 지문과 일치하는 적절한 진술"

ok:false:
"📌 지문 근거: \\"...\\"
🔍 ...
❌ 지문과 어긋나는 부적절한 진술 [패턴]"

보기 있으면:
"📌 보기 근거: \\"...\\"
📌 지문 근거: \\"...\\"
🔍 ...
✅/❌ ... [L5]"

패턴: L1(표현오독) L2(정서오독) L3(주제과잉) L4(구조오류) L5(보기대입오류)
ok:true이면 패턴 없음.

[ok:true 해설 필수 규칙]
ok:true 해설에서는 부정 판정 표현을 절대 사용하지 말 것.
금지 표현: 어긋나다, 왜곡, 잘못, 부적절, 맞지 않다, 일치하지 않다
정답 해설은 지문 근거 + 직접 일치 + 왜 맞는지만 기술.

반드시 ✅ 또는 ❌ 이모지로 결론을 마무리할 것.
이모지 없이 끝나는 응답은 무효.

해설만 출력. 설명 금지.`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].text.trim();
}

// ─── 반전 감지 함수 (결론 이모지 ✅/❌ 기준) ────────────────────────────────
// 해설 본문(📌 인용, 🔍 설명)에는 "왜곡/잘못/부적절" 등이 개념/서술로 등장할 수 있음.
// 따라서 최종 결론 마커(✅/❌)와 ok 값의 일치만 검사한다.
function isReversed(c) {
  const ana = c.analysis || "";
  if (!ana.trim()) return true;
  // 결론부: 마지막 ✅ 또는 ❌ 이모지부터 끝까지
  const lastPos = Math.max(ana.lastIndexOf("✅"), ana.lastIndexOf("❌"));
  if (lastPos < 0) return true; // 결론 이모지 없으면 반전 대상
  const conclusion = ana.slice(lastPos);
  const hasPos = conclusion.startsWith("✅");
  const hasNeg = conclusion.startsWith("❌");
  if (c.ok === true && hasNeg) return true;
  if (c.ok === false && hasPos) return true;
  return false;
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
const raw = fs.readFileSync(DATA_PATH, "utf8");
const data = JSON.parse(raw);

// 백업
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
fs.writeFileSync(path.join(BACKUP_DIR, `all_data_204_backup_${ts}.json`), raw);
console.log(`✅ 백업 완료\n`);

let totalFixed = 0;
// 결과 분류: improved / retryable / needs_human
const results = { improved: [], retryable: [], needs_human: [] };

for (const yearKey of yearsToProcess) {
  if (!data[yearKey]) {
    console.warn(`⚠️  ${yearKey} 없음, 스킵`);
    continue;
  }

  for (const sec of ["reading", "literature"]) {
    for (const set of data[yearKey][sec] || []) {
      for (const q of set.questions) {
        if (q.questionType !== "positive") continue;

        // 반전된 선지가 있는 문제만 처리
        const reversed = q.choices.filter(isReversed);
        if (reversed.length === 0) continue;

        console.log(
          `[${yearKey}] ${set.id} Q${q.id} — ${reversed.length}개 선지 재작성`,
        );

        for (const c of q.choices) {
          if (!isReversed(c)) {
            console.log(`  [${c.num}] 스킵 (정상)`);
            continue;
          }

          const loc = `${yearKey} ${set.id} Q${q.id}-${c.num}`;
          process.stdout.write(`  [${c.num}] ok:${c.ok} 재생성 중...`);

          let success = false;
          let lastErr = null;
          for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
            try {
              const newAnalysis = await generateAnalysis(set, q, c);
              c.analysis = newAnalysis;
              if (c.ok === true) c.pat = null;

              if (!isReversed(c)) {
                results.improved.push(loc);
                console.log(` ✅ (attempt ${attempt})`);
                success = true;
                totalFixed++;
                break;
              }
              // 여전히 반전 — 재시도
              if (attempt < MAX_RETRY) {
                process.stdout.write(` ⟳retry${attempt}`);
                await new Promise((r) => setTimeout(r, 500));
              }
            } catch (err) {
              lastErr = err;
              if (attempt < MAX_RETRY) {
                process.stdout.write(` ⟳err${attempt}`);
                await new Promise((r) => setTimeout(r, 1000));
              }
            }
          }

          if (!success) {
            if (lastErr) {
              results.needs_human.push(`${loc} — API 실패: ${lastErr.message}`);
              console.log(` 🔴 needs_human (API 실패)`);
            } else {
              // MAX_RETRY 초과 — retryable이었으나 needs_human으로 이동
              results.needs_human.push(
                `${loc} — 재시도 ${MAX_RETRY}회 초과 (여전히 반전)`,
              );
              console.log(` 🔴 needs_human (재시도 초과)`);
            }
            totalFixed++;
          }

          // API 과부하 방지
          await new Promise((r) => setTimeout(r, 1000));
        }

        // 세트 처리 중간 저장 (중단 대비)
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
      }
    }
  }
}

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
console.log(`\n✅ 완료: ${totalFixed}개 analysis 재작성`);

// 결과 분류 리포트
console.log(`\n=== 결과 분류 ===`);
console.log(`  ✅ improved:    ${results.improved.length}건`);
console.log(
  `  ⟳  retryable:   ${results.retryable.length}건 (재시도 성공 가능)`,
);
console.log(
  `  🔴 needs_human: ${results.needs_human.length}건 (MAX_RETRY 초과 또는 API 실패)`,
);

if (results.needs_human.length > 0) {
  console.log(`\n[ 🔴 needs_human 상세 — 프롬프트 개선 패턴 추출 대상 ]`);
  for (const loc of results.needs_human.slice(0, 30)) console.log(`  ${loc}`);
  if (results.needs_human.length > 30)
    console.log(`  ... 외 ${results.needs_human.length - 30}건`);
}

// 결과 JSON 저장
fs.writeFileSync(
  REPORT_PATH,
  JSON.stringify(
    { timestamp: new Date().toISOString(), totalFixed, ...results },
    null,
    2,
  ),
);
console.log(`\n📄 리포트 저장: ${REPORT_PATH}`);
