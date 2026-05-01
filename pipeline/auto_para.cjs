/**
 * pipeline/auto_para.cjs
 *
 * Claude API를 사용해 독서 지문의 문단 경계를 자동 감지하여
 * all_data_204.json의 body sents에 para 필드를 부여합니다.
 *
 * 사용법:
 *   node pipeline/auto_para.cjs [yearKey]   ← 특정 연도만
 *   node pipeline/auto_para.cjs             ← 미적용 전체 처리
 *
 * 옵션:
 *   --dry-run   실제 저장 없이 결과만 출력
 *   --skip-done para가 이미 적용된 지문 건너뜀 (기본값 true)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const AnthropicPkg = require("@anthropic-ai/sdk");
const Anthropic = AnthropicPkg.default || AnthropicPkg;
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public", "data", "all_data_204.json");
const SRC = path.join(ROOT, "src", "data", "all_data_204.json");

const yearFilter =
  process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
const DRY_RUN = process.argv.includes("--dry-run");

// ── 문단 경계 감지 프롬프트 ────────────────────────────────────────────────
const SYSTEM = `너는 수능 국어 독서 지문의 문단 구조를 분석하는 전문가야.
주어진 sents 목록을 읽고, 각 문단이 시작하는 sent 번호 목록을 출력하라.

규칙:
- 반드시 첫 번째 sent(s1)는 포함한다.
- 의미 단위(문단)가 바뀌는 지점의 sent 번호를 찾는다.
- 수능 국어 독서 지문은 보통 3~6개 문단으로 나뉜다.
- 순수 JSON 배열(숫자)만 출력. 예: [1, 4, 8, 12]
- 설명, 마크다운 없음.`;

async function detectPara(sents) {
  const sentList = sents
    .map((s) => {
      const num = s.id.match(/s(\d+)$/)?.[1] || "?";
      return `s${num}: ${s.t}`;
    })
    .join("\n");

  const msg = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 256,
    system: SYSTEM,
    messages: [{ role: "user", content: sentList }],
  });

  const raw = msg.content[0]?.text?.trim() || "";
  // JSON 배열 파싱
  const match = raw.match(/\[[\d,\s]+\]/);
  if (!match) throw new Error("파싱 실패: " + raw);
  return JSON.parse(match[0]);
}

function applyPara(set, startNums) {
  const sorted = [...startNums].sort((a, b) => a - b);
  let applied = 0;
  for (const sent of set.sents || []) {
    if (
      ["workTag", "omission", "author", "footnote", "figure", "image"].includes(
        sent.sentType,
      )
    )
      continue;
    const num = parseInt((sent.id.match(/s(\d+)$/) || [])[1] || "-1", 10);
    if (num < 0) continue;
    let paraNum = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (num >= sorted[i]) paraNum = i + 1;
    }
    sent.para = paraNum;
    applied++;
  }
  return applied;
}

async function main() {
  const allData = JSON.parse(fs.readFileSync(PUBLIC, "utf8"));

  // 처리 대상 수집
  const targets = [];
  for (const [yk, yd] of Object.entries(allData)) {
    if (yearFilter && yk !== yearFilter) continue;
    for (const s of yd.reading || []) {
      const body = (s.sents || []).filter(
        (x) =>
          ![
            "workTag",
            "omission",
            "author",
            "footnote",
            "figure",
            "image",
          ].includes(x.sentType || "body"),
      );
      if (body.length === 0) continue;
      const hasPara = body.some((x) => x.para != null);
      if (hasPara) continue; // 이미 적용됨
      targets.push({ yk, set: s, body });
    }
  }

  if (targets.length === 0) {
    console.log("✅ 처리할 지문 없음 (모두 para 적용 완료)");
    return;
  }

  console.log(
    `\n처리 대상: ${targets.length}개 지문${DRY_RUN ? " [DRY-RUN]" : ""}\n`,
  );

  let saved = 0;
  for (const { yk, set, body } of targets) {
    process.stdout.write(`  ${yk}  ${set.id}  (${body.length}sents) → `);
    try {
      const startNums = await detectPara(body);
      process.stdout.write(`[${startNums.join(" ")}] `);

      if (!DRY_RUN) {
        const n = applyPara(set, startNums);
        process.stdout.write(`${n}개 적용\n`);
        saved++;
      } else {
        process.stdout.write("(dry)\n");
      }

      // API rate limit 방지
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      process.stdout.write(`❌ ${e.message}\n`);
    }
  }

  if (!DRY_RUN && saved > 0) {
    fs.writeFileSync(PUBLIC, JSON.stringify(allData, null, 2), "utf8");
    if (fs.existsSync(SRC))
      fs.writeFileSync(SRC, JSON.stringify(allData, null, 2), "utf8");
    console.log(`\n✅ 저장 완료 (${saved}개 지문 업데이트)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
