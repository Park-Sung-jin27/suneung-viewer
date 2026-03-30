import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { jsonrepair } from 'jsonrepair';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `너는 수능 국어 전문 해설 작성자다.
반드시 순수 JSON 배열만 출력하라. 마크다운, 설명 텍스트 없음.

[핵심 원칙]
정답 선지 번호가 주어진다. 정답을 확정한 상태에서 각 선지의 ok값과 해설을 작성하라.
정답 선지의 ok값은 questionType에 따라 결정된다:
- questionType: positive → 정답 선지 ok: true, 나머지 ok: false
- questionType: negative → 정답 선지 ok: false, 나머지 ok: true

[ok 필드 규칙]
ok: true = 지문 내용과 사실적으로 일치하는 선지
ok: false = 지문 내용과 사실적으로 일치하지 않는 선지
발문 유형과 무관하게 사실 일치 여부로만 판단

[pat 필드 규칙 - ok:false인 선지만 해당]
1: 팩트 왜곡 — 수치·상태·방향을 정반대나 다른 값으로 서술
2: 관계·인과 전도 — 주체-객체, 원인-결과, 포함관계를 뒤바꿈
3: 과도한 추론 — 지문에 없는 내용, 1단계 이상 비약
4: 개념 짜깁기 — 서로 다른 문단의 개념어를 섞어 거짓 문장
ok:true인 선지는 pat: null

[analysis 작성 규칙]
- 반드시 지문의 실제 문장을 근거로 사용
- 3~5등급 학생도 이해할 수 있게 구체적으로
- 형식:
  ok:true:  '📌 지문 근거: "..."\n🔍 ...\n✅ 지문과 일치하는 적절한 진술'
  ok:false: '📌 지문 근거: "..."\n🔍 ...\n❌ 지문과 어긋나는 부적절한 진술 [패턴명]'

[검증]
작성 후 스스로 확인: 정답 선지의 ok값이 questionType과 일치하는가?
- questionType: positive → 정답 선지 ok: true
- questionType: negative → 정답 선지 ok: false`;

const RETRY_SYSTEM_PROMPT = SYSTEM_PROMPT + `

경고: ok:false인 선지는 반드시 pat을 1/2/3/4 중 하나로 채워야 한다.
pat: null은 ok:true인 선지에만 허용된다.`;

const REANALYSIS_SYSTEM_PROMPT = `너는 수능 국어 전문 해설 작성자다.
반드시 순수 JSON 객체만 출력하라. 마크다운, 설명 텍스트 없음.

주어진 선지 하나에 대해 analysis만 작성해줘.
형식:
  ok:true:  '📌 지문 근거: "..."\n🔍 ...\n✅ 지문과 일치하는 적절한 진술'
  ok:false: '📌 지문 근거: "..."\n🔍 ...\n❌ 지문과 어긋나는 부적절한 진술 [패턴명]'

반드시 지문의 실제 문장을 근거로 사용. 3~5등급 학생도 이해할 수 있게 구체적으로.
출력 형식: { "analysis": "..." }`;

// ─── JSON 파싱 유틸 ───────────────────────────────────────

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

  console.warn('JSON 직접 파싱 실패, 따옴표 수정 시도');
  const fixed = tryParse(fixUnescapedQuotes(text));
  if (fixed) return fixed;

  console.warn('따옴표 수정 실패, 여러 배열 병합 시도');
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

  console.warn('배열 병합 실패, jsonrepair 시도');
  const repaired = jsonrepair(text);
  return JSON.parse(repaired);
}

// ─── 핵심 로직 ────────────────────────────────────────────

function applyChoices(set, updatedChoices) {
  const updatedQuestions = set.questions.map((q) => ({
    ...q,
    choices: q.choices.map((orig) => {
      const updated = updatedChoices.find((c) => c.num === orig.num);
      if (updated) {
        return {
          ...orig,
          ok: updated.ok ?? orig.ok,
          pat: updated.pat ?? orig.pat,
          analysis: updated.analysis ?? orig.analysis,
        };
      }
      return orig;
    }),
  }));
  return { ...set, questions: updatedQuestions };
}

async function callAnalyze(set, answerKey, systemPrompt) {
  // 문항별 ok 기대값 사전 계산
  const answerGuide = set.questions.map((q) => {
    const correctNum = answerKey[String(q.id)];
    if (correctNum === undefined) return null;
    return {
      qId: q.id,
      questionType: q.questionType,
      correctNum,
      choiceOkMap: q.choices.reduce((acc, c) => {
        const isCorrect = c.num === correctNum;
        acc[c.num] = q.questionType === 'positive' ? isCorrect : !isCorrect;
        return acc;
      }, {}),
    };
  }).filter(Boolean);

  const userPrompt = `다음 세트를 분석해줘.

[정답 정보 - 반드시 준수]
${answerGuide.map(g =>
  `문항 ${g.qId}번 (${g.questionType}): 정답 선지 = ${g.correctNum}번
  ok값: ${Object.entries(g.choiceOkMap).map(([num, ok]) => `선지${num}→${ok}`).join(', ')}`
).join('\n')}

[세트 데이터]
${JSON.stringify(set)}

위 ok값을 그대로 사용하여 각 선지의 pat과 analysis를 작성해줘.
choices 배열만 JSON으로 반환해줘.
형식: [{ num: 1, ok: true, pat: null, analysis: "..." }, ...]`;

  const response = await client.messages.create(
    {
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    },
    { headers: { 'anthropic-beta': 'output-128k-2025-02-19' } }
  );

  return parseJSON(response.content[0].text);
}

async function reanalyzeSingleChoice(set, question, choice) {
  const userPrompt = `지문 세트: ${JSON.stringify({ id: set.id, title: set.title, sents: set.sents })}
문항: ${JSON.stringify({ id: question.id, t: question.t, questionType: question.questionType })}
선지: { num: ${choice.num}, t: "${choice.t}", ok: ${choice.ok} }

위 선지의 ok 값(${choice.ok})에 맞게 analysis만 작성해줘.
출력: { "analysis": "..." }`;

  const response = await client.messages.create(
    {
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: REANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    },
    { headers: { 'anthropic-beta': 'output-128k-2025-02-19' } }
  );

  const parsed = parseJSON(response.content[0].text);
  return parsed.analysis || '';
}

// ─── 후처리 보정 함수 ─────────────────────────────────────

export async function postProcess(result, answerKey) {
  const correctedSets = { reading: [], literature: [] };
  let totalOkFixed = 0;
  let totalPatFlagged = 0;
  let totalPatNullFixed = 0;

  for (const section of ['reading', 'literature']) {
    for (const set of result[section]) {
      const updatedQuestions = [];

      for (const q of set.questions) {
        const correctNum = answerKey[String(q.id)];
        if (correctNum === undefined) {
          updatedQuestions.push(q);
          continue;
        }

        const updatedChoices = [];
        for (const c of q.choices) {
          let choice = { ...c };
          const isCorrect = c.num === correctNum;

          // 1. ok 강제 보정
          const expectedOk = q.questionType === 'positive' ? isCorrect : !isCorrect;
          const okChanged = choice.ok !== expectedOk;
          if (okChanged) {
            console.warn(`  [postProcess] ok 보정: ${set.id} ${q.id}번 선지${c.num} ${choice.ok} → ${expectedOk}`);
            choice.ok = expectedOk;
            totalOkFixed++;
          }

          // 2. pat 보정
          if (choice.ok === false && choice.pat === null) {
            choice.pat = 0; // 수동 검토 플래그
            totalPatFlagged++;
          }
          if (choice.ok === true && choice.pat !== null) {
            choice.pat = null;
            totalPatNullFixed++;
          }

          // 3. ok가 바뀐 선지 analysis 재생성
          if (okChanged) {
            console.log(`  [postProcess] analysis 재생성: ${set.id} ${q.id}번 선지${c.num}`);
            try {
              choice.analysis = await reanalyzeSingleChoice(set, q, choice);
            } catch (err) {
              console.warn(`  [postProcess] analysis 재생성 실패: ${err.message}`);
            }
          }

          updatedChoices.push(choice);
        }

        updatedQuestions.push({ ...q, choices: updatedChoices });
      }

      correctedSets[section].push({ ...set, questions: updatedQuestions });
    }
  }

  // 4. 보정 완료 후 검증 출력
  console.log('\n' + '='.repeat(50));
  console.log('[postProcess] 보정 완료 요약');
  console.log('='.repeat(50));
  if (totalOkFixed === 0) {
    console.log(`ok 보정 건수:        ✅ ok 불일치: 0건 (정답 주입 정상 작동)`);
  } else {
    console.warn(`ok 보정 건수:        ⚠️ ok 보정 건수: ${totalOkFixed}건 (프롬프트 점검 필요)`);
  }
  console.log(`pat:null→0 플래그:   ${totalPatFlagged}건 (수동 검토 필요)`);
  console.log(`ok:true & pat→null:  ${totalPatNullFixed}건`);

  // ok 불일치 재검증
  let remaining = 0;
  for (const section of ['reading', 'literature']) {
    for (const set of correctedSets[section]) {
      for (const q of set.questions) {
        const correctNum = answerKey[String(q.id)];
        if (correctNum === undefined) continue;
        const correctChoice = q.choices.find(c => c.num === correctNum);
        if (!correctChoice) continue;
        const expectedOk = q.questionType === 'positive' ? true : false;
        if (correctChoice.ok !== expectedOk) remaining++;
      }
    }
  }
  console.log(`ok 불일치 잔여:      ${remaining}건`);
  console.log('='.repeat(50));

  return correctedSets;
}

async function analyzeSet(set, answerKey) {
  return callAnalyze(set, answerKey, SYSTEM_PROMPT);
}

export async function retrySet(set, answerKey) {
  console.log(`[step3:retry] 재분석 중: ${set.id} (${set.range})`);
  const updatedChoices = await callAnalyze(set, answerKey, RETRY_SYSTEM_PROMPT);
  return applyChoices(set, updatedChoices);
}

export async function analyzeStructure(structureData, answerKey) {
  const result = { reading: [], literature: [] };

  for (const section of ['reading', 'literature']) {
    for (const set of structureData[section]) {
      console.log(`[step3] 분석 중: ${set.id} (${set.range})`);
      const updatedChoices = await analyzeSet(set, answerKey);
      result[section].push(applyChoices(set, updatedChoices));
    }
  }

  return result;
}

// ─── 커맨드라인 ───────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const structurePath = process.argv[2];
  const answerKeyPath = process.argv[3];
  const retryFlag = process.argv.indexOf('--retry');
  const retryId = retryFlag !== -1 ? process.argv[retryFlag + 1] : null;

  if (!structurePath || !answerKeyPath) {
    console.error('사용법: node pipeline/step3_analysis.js [step2결과JSON경로] [정답키JSON경로] [--retry setId]');
    process.exit(1);
  }

  const structurePath_abs = path.resolve(structurePath);
  const structureData = JSON.parse(fs.readFileSync(structurePath_abs, 'utf8'));
  const answerKey = JSON.parse(fs.readFileSync(path.resolve(answerKeyPath), 'utf8'));

  if (retryId) {
    const step3Path = path.resolve(path.dirname(structurePath_abs), 'step3_result_2022.json');
    if (!fs.existsSync(step3Path)) {
      console.error(`step3 결과 파일 없음: ${step3Path}`);
      process.exit(1);
    }
    const step3Data = JSON.parse(fs.readFileSync(step3Path, 'utf8'));
    const allSets = [...step3Data.reading, ...step3Data.literature];
    const targetSet = allSets.find(s => s.id === retryId);
    if (!targetSet) {
      console.error(`세트 ID를 찾을 수 없음: ${retryId}`);
      console.error(`사용 가능한 ID: ${allSets.map(s => s.id).join(', ')}`);
      process.exit(1);
    }

    retrySet(targetSet, answerKey)
      .then((updated) => {
        for (const section of ['reading', 'literature']) {
          const idx = step3Data[section].findIndex(s => s.id === retryId);
          if (idx !== -1) { step3Data[section][idx] = updated; break; }
        }
        fs.writeFileSync(step3Path, JSON.stringify(step3Data, null, 2), 'utf8');
        console.log(`\n✅ ${retryId} 재분석 완료 → ${step3Path} 업데이트`);
        console.log(JSON.stringify(updated.questions.map(q => ({
          qId: q.id,
          choices: q.choices.map(c => ({ num: c.num, ok: c.ok, pat: c.pat }))
        })), null, 2));
      })
      .catch((err) => { console.error('오류:', err.message); process.exit(1); });

  } else {
    // 전체 분석 → postProcess → 저장
    analyzeStructure(structureData, answerKey)
      .then(async (raw) => {
        console.log('\n[step3] 후처리 보정 시작...');
        const corrected = await postProcess(raw, answerKey);
        const outPath = path.resolve(path.dirname(structurePath_abs), 'step3_result_2022.json');
        fs.writeFileSync(outPath, JSON.stringify(corrected, null, 2), 'utf8');
        console.log(`\n✅ 저장 완료: ${outPath}`);
      })
      .catch((err) => { console.error('오류:', err.message); process.exit(1); });
  }
}
