/**
 * 기존 데이터에서 어휘 문제(VOCAB_PATTERN) 해당 문항만 골라
 * step3 VOCAB_SYSTEM_PROMPT로 analysis 재생성 후 all_data_204.json에 반영
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DATA_PATH = path.resolve(__dirname, "../public/data/all_data_204.json");

const VOCAB_PATTERN =
  /사전적 의미|문맥상 의미|문맥적 의미|밑줄 친.*의미|ⓐ.*~.*ⓔ|㉠.*~.*㉤/;

const VOCAB_SYSTEM_PROMPT = `너는 수능 국어 어휘·표현 문제 전문 해설 작성자다.
반드시 순수 JSON 배열만 출력하라. 마크다운, 설명 텍스트 없음.

이 문항은 어휘/문맥적 의미 문제다. 각 선지마다 아래 형식으로 analysis를 작성하라.

[analysis 형식]
[문맥 속 의미]
'밑줄 단어'는 이 지문에서 "~하다"는 의미로 쓰임 (사전적 의미와 구별)

[호응 성분]
목적어: ~을/를
부사어: ~하게 / ~으로
주어: ~이/가

[치환 판단]
이 문맥에서 '선지단어'로 바꾸면 → 자연스럽다/어색하다
이유: ~

[결론]
✅ 적절 / ❌ 부적절 — 한 줄 근거

[추가 규칙]
- cs_ids는 반드시 빈 배열 []로 설정
- "지문이 제공되지 않았으나" 같은 문구 절대 금지
- 지문 문장 인용은 호응 성분 확인용으로만 사용
- ok:true 선지: 결론에 ✅ 적절
- ok:false 선지: 결론에 ❌ 부적절
- pat은 ok:true → null, ok:false → R1~R4 또는 L1~L5

출력 형식: [{ qId: 1, num: 1, pat: null, analysis: "..." }, ...]
반드시 qId를 포함해줘.`;

async function callWithRetry(fn, maxRetries = 3, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const retry =
        err.message?.includes("Connection") ||
        err.message?.includes("timeout") ||
        err.status === 529 ||
        err.status === 500;
      if (retry && i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delay));
      } else throw err;
    }
  }
}

async function reanalyzeVocabQuestion(set, question) {
  const userPrompt = `다음 어휘 문제를 분석해줘.

[세트 지문]
${JSON.stringify({ id: set.id, title: set.title, sents: set.sents })}

[문항]
문항 ${question.id}번: ${question.t}
questionType: ${question.questionType}

[선지]
${JSON.stringify(question.choices.map((c) => ({ num: c.num, t: c.t, ok: c.ok })))}

각 선지의 pat과 analysis를 작성해줘.
출력 형식: [{ qId: ${question.id}, num: 1, pat: null, analysis: "..." }, ...]`;

  const response = await callWithRetry(() =>
    client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        system: VOCAB_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
      { headers: { "anthropic-beta": "output-128k-2025-02-19" } },
    ),
  );

  const text = response.content[0].text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "");
  return JSON.parse(text);
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  let totalFixed = 0;

  for (const [yearKey, yd] of Object.entries(data)) {
    for (const section of ["reading", "literature"]) {
      for (const set of yd[section] || []) {
        for (const q of set.questions) {
          if (!VOCAB_PATTERN.test(q.t)) continue;

          console.log(
            `\n[vocab] ${yearKey} ${set.id} Q${q.id}: ${q.t.slice(0, 40)}`,
          );
          try {
            const updatedChoices = await reanalyzeVocabQuestion(set, q);
            for (const updated of updatedChoices) {
              const choice = q.choices.find((c) => c.num === updated.num);
              if (choice) {
                choice.analysis = updated.analysis;
                if (updated.pat !== undefined) choice.pat = updated.pat;
                choice.cs_ids = [];
                totalFixed++;
              }
            }
            // 즉시 저장 (중단 내성)
            fs.writeFileSync(DATA_PATH, JSON.stringify(data), "utf8");
            console.log(`  ✅ Q${q.id} 완료`);
          } catch (err) {
            console.error(`  ❌ Q${q.id} 실패: ${err.message}`);
          }
        }
      }
    }
  }

  console.log(`\n완료: ${totalFixed}개 선지 재생성`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
