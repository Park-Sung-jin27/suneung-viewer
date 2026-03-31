import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { jsonrepair } from 'jsonrepair';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `너는 수능 국어 선지와 지문 문장을 매칭하는 전문가다.
반드시 순수 JSON만 출력하라. 마크다운, 설명 텍스트 없음.

[cs_ids 규칙]
- 각 선지의 ok/analysis 근거가 되는 지문 문장 ID를 찾아라
- ok:true인 선지: 선지 내용이 직접 근거하는 문장 ID
- ok:false인 선지: 선지가 왜곡/전도/추론한 원래 문장 ID
- 근거 문장이 여러 개면 모두 포함
- 지문에 근거가 없는 선지(pat:3 과도한 추론)는 빈 배열 []
- 반드시 실제 존재하는 sent.id만 사용할 것

출력 형식:
[{ "questionId": 1, "num": 1, "cs_ids": ["r2022a_s3", "r2022a_s4"] }, ...]`;

async function callWithRetry(fn, maxRetries = 3, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.message?.includes('Connection') ||
                          err.message?.includes('timeout') ||
                          err.status === 529 ||
                          err.status === 500;
      if (isRetryable && i < maxRetries - 1) {
        console.warn(`  ⚠️ API 오류 (${i+1}/${maxRetries}): ${err.message}`);
        console.warn(`  ${delay/1000}초 후 재시도...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

function stripMarkdown(text) {
  return text.trim().replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '');
}

function fixUnescapedQuotes(jsonStr) {
  const result = [];
  let inString = false;
  let i = 0;
  while (i < jsonStr.length) {
    const ch = jsonStr[i];
    if (ch === '\\' && inString) {
      result.push(ch, jsonStr[i + 1] || '');
      i += 2;
      continue;
    }
    if (ch === '"') {
      if (!inString) {
        inString = true;
        result.push(ch);
      } else {
        let j = i + 1;
        while (j < jsonStr.length && ' \n\r\t'.includes(jsonStr[j])) j++;
        const next = jsonStr[j];
        if (next === ':' || next === ',' || next === '}' || next === ']' || j >= jsonStr.length) {
          inString = false;
          result.push(ch);
        } else {
          result.push('\\"');
        }
      }
    } else {
      result.push(ch);
    }
    i++;
  }
  return result.join('');
}

function tryParse(text) {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
      return parsed.flat();
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseJSON(raw) {
  const text = stripMarkdown(raw);

  const direct = tryParse(text);
  if (direct) return direct;

  const fixed = tryParse(fixUnescapedQuotes(text));
  if (fixed) return fixed;

  // 여러 배열 병합
  const arrays = [];
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '[') { if (depth === 0) start = i; depth++; }
    else if (text[i] === ']') {
      depth--;
      if (depth === 0 && start !== -1) {
        const chunk = text.slice(start, i + 1);
        const parsed = tryParse(chunk) || tryParse(fixUnescapedQuotes(chunk));
        if (parsed) arrays.push(...parsed);
        start = -1;
      }
    }
  }
  if (arrays.length > 0) return arrays;

  const repaired = jsonrepair(text);
  return JSON.parse(repaired);
}

async function matchCsIds(set) {
  const sentIds = new Set(set.sents.map(s => s.id));

  const userPrompt = `다음 세트에서 각 선지의 cs_ids를 찾아줘.

지문 문장 목록:
${JSON.stringify(set.sents.map(s => ({ id: s.id, t: s.t })))}

선지 목록:
${JSON.stringify(set.questions.flatMap(q =>
    q.choices.map(c => ({
      questionId: q.id,
      num: c.num,
      t: c.t,
      ok: c.ok,
      pat: c.pat,
      analysis: c.analysis
    }))
  ))}

각 선지의 cs_ids 배열만 반환해줘.
형식: [{ "questionId": 1, "num": 1, "cs_ids": [...] }, ...]`;

  const response = await callWithRetry(() => client.messages.create(
    {
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    },
    { headers: { 'anthropic-beta': 'output-128k-2025-02-19' } }
  ));

  const matches = parseJSON(response.content[0].text);

  // 존재하지 않는 sentId 제거 + 통계
  let totalMatched = 0;
  let invalidRemoved = 0;

  const cleaned = matches.map(m => {
    const validIds = (m.cs_ids || []).filter(id => {
      if (sentIds.has(id)) return true;
      invalidRemoved++;
      return false;
    });
    totalMatched += validIds.length;
    return { ...m, cs_ids: validIds };
  });

  console.log(`  매칭: ${totalMatched}개 cs_ids, 무효 ID 제거: ${invalidRemoved}개`);
  return cleaned;
}

export async function assignCsIds(step3Data) {
  const result = { reading: [], literature: [] };

  for (const section of ['reading', 'literature']) {
    for (const set of step3Data[section]) {
      console.log(`[step4] cs_ids 매칭 중: ${set.id} (${set.range})`);

      const matches = await matchCsIds(set);

      // matches를 questionId + num 기준으로 빠르게 조회
      const matchMap = new Map();
      for (const m of matches) {
        matchMap.set(`${m.questionId}_${m.num}`, m.cs_ids);
      }

      const updatedQuestions = set.questions.map(q => ({
        ...q,
        choices: q.choices.map(c => {
          const cs_ids = matchMap.get(`${q.id}_${c.num}`);
          return cs_ids !== undefined ? { ...c, cs_ids } : c;
        }),
      }));

      result[section].push({ ...set, questions: updatedQuestions });
    }
  }

  return result;
}

// 커맨드라인
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error('사용법: node pipeline/step4_csids.js [step3결과JSON경로]');
    process.exit(1);
  }

  const inputPath_abs = path.resolve(inputPath);
  const step3Data = JSON.parse(fs.readFileSync(inputPath_abs, 'utf8'));

  assignCsIds(step3Data)
    .then((result) => {
      const outPath = path.resolve(
        path.dirname(inputPath_abs),
        path.basename(inputPath_abs).replace('step3_', 'step4_')
      );
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
      console.log(`\n✅ 저장 완료: ${outPath}`);
    })
    .catch((err) => {
      console.error('오류:', err.message);
      process.exit(1);
    });
}
