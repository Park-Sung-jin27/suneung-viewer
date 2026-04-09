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

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const DATA_PATH  = path.resolve(__dirname, '../src/data/all_data_204.json');
const BACKUP_DIR = path.resolve(__dirname, '../pipeline/backups');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TARGET_YEARS = {
  '2025수능': true,
  '2025_9월': true,
  '2026수능': true,
  '2026_6월': true,
  '2023수능': true,
};

const yearArg = process.argv[2];
if (!yearArg) {
  console.error('사용법: node pipeline/reanalyze_positive.mjs <연도키|all>');
  process.exit(1);
}

// ─── 대상 연도 결정 ────────────────────────────────────────────────────────────
const yearsToProcess = yearArg === 'all'
  ? Object.keys(TARGET_YEARS)
  : [yearArg];

// ─── analysis 생성 함수 ───────────────────────────────────────────────────────
async function generateAnalysis(set, q, c) {
  const sents = (set.sents || [])
    .filter(s => ['body','verse','footnote','author'].includes(s.sentType))
    .map(s => `[${s.id}] ${s.t}`)
    .join('\n');

  const bogiText = q.bogi
    ? (typeof q.bogi === 'string' ? q.bogi : q.bogi.description || '')
    : '';

  const prompt = `너는 수능 국어 해설 전문가야. 아래 지문·보기·선지를 읽고 해설을 작성해.

[지문 문장]
${sents}

${bogiText ? `[보기]\n${bogiText}\n` : ''}
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
해설만 출력. 설명 금지.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text.trim();
}

// ─── 반전 감지 함수 ────────────────────────────────────────────────────────────
function isReversed(c) {
  const ana = c.analysis || '';
  const NEG = ['어긋나', '틀리', '왜곡', '오류', '잘못', '부적절', '맞지 않'];
  const POS = ['일치', '적절한', '올바르', '합당'];
  if (c.ok === true  && NEG.some(w => ana.includes(w))) return true;
  if (c.ok === false && POS.some(w => ana.includes(w))) return true;
  if (!ana.trim()) return true;  // 빈 analysis도 재작성 대상
  return false;
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
const raw  = fs.readFileSync(DATA_PATH, 'utf8');
const data = JSON.parse(raw);

// 백업
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
fs.writeFileSync(path.join(BACKUP_DIR, `all_data_204_backup_${ts}.json`), raw);
console.log(`✅ 백업 완료\n`);

let totalFixed = 0;

for (const yearKey of yearsToProcess) {
  if (!data[yearKey]) { console.warn(`⚠️  ${yearKey} 없음, 스킵`); continue; }

  for (const sec of ['reading', 'literature']) {
    for (const set of (data[yearKey][sec] || [])) {
      for (const q of set.questions) {
        if (q.questionType !== 'positive') continue;

        // 반전된 선지가 있는 문제만 처리
        const reversed = q.choices.filter(isReversed);
        if (reversed.length === 0) continue;

        console.log(`[${yearKey}] ${set.id} Q${q.id} — ${reversed.length}개 선지 재작성`);

        for (const c of q.choices) {
          if (!isReversed(c)) {
            console.log(`  [${c.num}] 스킵 (정상)`);
            continue;
          }

          process.stdout.write(`  [${c.num}] ok:${c.ok} 재생성 중...`);
          try {
            const newAnalysis = await generateAnalysis(set, q, c);
            c.analysis = newAnalysis;

            // pat 정리: ok:true면 null
            if (c.ok === true) c.pat = null;

            console.log(' ✅');
            totalFixed++;
          } catch (err) {
            console.log(` ❌ 실패: ${err.message}`);
          }

          // API 과부하 방지
          await new Promise(r => setTimeout(r, 1000));
        }

        // 세트 처리 중간 저장 (중단 대비)
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
      }
    }
  }
}

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
console.log(`\n✅ 완료: ${totalFixed}개 analysis 재작성`);
