import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { extractAnswers } from './step1_answer.js';
import { extractStructure } from './step2_extract.js';
import { analyzeStructure, postProcess } from './step3_analysis.js';
import { assignCsIds } from './step4_csids.js';
import { verifyAndFix } from './step5_verify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

// ─── 인수 파싱 ────────────────────────────────────────────────

const examPdfPath   = process.argv[2];
const answerPdfPath = process.argv[3];
const examKey       = process.argv[4];
const lastQuestion  = parseInt(process.argv[5]) || 45;
const section       = process.argv[6] || 'all'; // 'reading' | 'literature' | 'all'

if (!examPdfPath || !answerPdfPath || !examKey) {
  console.error('사용법: node pipeline/index.js <시험지PDF> <정답PDF> <시험키> [마지막문항번호] [섹션]');
  console.error('예시: node pipeline/index.js 2023수능.pdf 2023수능_정답.pdf "2023수능" 45 reading');
  console.error('섹션: reading | literature | all (기본값)');
  process.exit(1);
}

if (!['reading', 'literature', 'all'].includes(section)) {
  console.error(`섹션은 "reading", "literature", "all" 중 하나여야 합니다. (받은 값: "${section}")`);
  process.exit(1);
}

// ─── 캐시 유틸 ───────────────────────────────────────────────

const dataDir = path.resolve(__dirname, 'test_data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// 연도 태그: "2023수능" → "2023수능"
const yearTag = examKey;
// section 접미사: 'all'이면 없음, 아니면 "_reading" 등
const secSuffix = section === 'all' ? '' : `_${section}`;

function cachePath(step) {
  return path.join(dataDir, `${step}_${yearTag}${secSuffix}.json`);
}

function saveCache(step, data) {
  const p = cachePath(step);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  💾 저장: ${path.basename(p)}`);
  return p;
}

function loadCache(step) {
  const p = cachePath(step);
  if (fs.existsSync(p)) {
    console.log(`  📂 캐시 로드: ${path.basename(p)}`);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return null;
}

// answer_key는 섹션 무관 — 항상 공용 캐시 사용
function answerKeyPath() {
  return path.join(dataDir, `answer_key_${yearTag}.json`);
}

function banner(step, desc) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  [STEP ${step}] ${desc}`);
  console.log('═'.repeat(60));
}

// ─── 섹션 필터 ───────────────────────────────────────────────

const targetSections  = section === 'all' ? ['reading', 'literature'] : [section];
const skippedSections = ['reading', 'literature'].filter(s => !targetSections.includes(s));

// step2 데이터에서 처리하지 않을 섹션을 빈 배열로 마스킹
function filterSections(data) {
  const out = { ...data };
  for (const s of skippedSections) out[s] = [];
  return out;
}

// ─── step6 머지 (인라인) ─────────────────────────────────────

function mergeSection(step5Data, sec, allDataPath) {
  const allData = JSON.parse(fs.readFileSync(allDataPath, 'utf8'));

  if (!allData[examKey]) {
    console.warn(`⚠️  "${examKey}" 키 없음 — 새로 추가`);
    allData[examKey] = { label: examKey, reading: [], literature: [] };
  }

  const existingSets = allData[examKey][sec] ?? [];
  const newSets = step5Data[sec] ?? [];

  if (newSets.length === 0) {
    console.warn(`⚠️  ${sec} 세트 없음 — 스킵`);
    return;
  }

  let updated = 0, added = 0;
  const merged = newSets.map(ns => {
    const ex = existingSets.find(s => s.id === ns.id);
    if (ex) { updated++; return { ...ex, ...ns }; }
    added++;
    return ns;
  });
  for (const s of existingSets) {
    if (!newSets.find(ns => ns.id === s.id)) {
      console.warn(`  ⚠️  기존 세트 유지 (새 데이터에 없음): ${s.id}`);
      merged.push(s);
    }
  }

  allData[examKey][sec] = merged;
  fs.writeFileSync(allDataPath, JSON.stringify(allData, null, 2), 'utf8');

  let totalC = 0, filledA = 0, filledC = 0;
  for (const s of merged) {
    for (const q of s.questions ?? []) {
      for (const c of q.choices ?? []) {
        totalC++;
        if (c.analysis?.trim()) filledA++;
        if (c.cs_ids?.length > 0) filledC++;
      }
    }
  }
  console.log(`  ✅ ${sec}: 세트 업데이트 ${updated} / 추가 ${added}`);
  console.log(`     선지 ${totalC}개 | analysis ${filledA}/${totalC} | cs_ids ${filledC}/${totalC}`);
}

// ─── step7 검증 (인라인) ─────────────────────────────────────

function validateMerged(allDataPath) {
  const allData = JSON.parse(fs.readFileSync(allDataPath, 'utf8'));
  const exam = allData[examKey];
  const issues = [];

  for (const sec of targetSections) {
    for (const set of exam[sec] ?? []) {
      for (const q of set.questions ?? []) {
        for (const c of q.choices ?? []) {
          if (!c.analysis?.trim())
            issues.push(`[${set.id}] ${q.id}번 선지${c.num}: analysis 없음`);
          if (c.ok === false && c.pat == null)
            issues.push(`[${set.id}] ${q.id}번 선지${c.num}: ok=false인데 pat 없음`);
          if (c.ok === true && c.pat != null)
            issues.push(`[${set.id}] ${q.id}번 선지${c.num}: ok=true인데 pat=${c.pat}`);
        }
      }
    }
  }
  return issues;
}

// ─── 메인 ────────────────────────────────────────────────────

async function main() {
  const allDataPath = path.resolve(__dirname, '../src/data/all_data_204.json');

  console.log('');
  console.log('🚀 파이프라인 시작');
  console.log(`   시험지  : ${examPdfPath}`);
  console.log(`   정답    : ${answerPdfPath}`);
  console.log(`   시험 키 : ${examKey}`);
  console.log(`   마지막 문항: ${lastQuestion}번`);
  console.log(`   섹션    : ${section}`);

  // ── STEP 1 ──────────────────────────────────────────────────
  banner(1, '정답 추출');
  let answerKey;
  const akPath = answerKeyPath();
  if (fs.existsSync(akPath)) {
    console.log(`  📂 캐시 로드: ${path.basename(akPath)}`);
    answerKey = JSON.parse(fs.readFileSync(akPath, 'utf8'));
  } else {
    answerKey = await extractAnswers(answerPdfPath);
    for (const k of Object.keys(answerKey)) {
      if (parseInt(k) > lastQuestion) delete answerKey[k];
    }
    fs.writeFileSync(akPath, JSON.stringify(answerKey, null, 2), 'utf8');
    console.log(`  💾 저장: ${path.basename(akPath)}`);
  }
  console.log(`  정답 ${Object.keys(answerKey).length}문항: ${JSON.stringify(answerKey)}`);

  // ── STEP 2 ──────────────────────────────────────────────────
  banner(2, '시험지 구조 추출');
  // step2는 섹션과 무관하게 항상 전체를 추출 (공용 캐시)
  const step2CachePath = path.join(dataDir, `step2_result_${yearTag}.json`);
  let step2Data;
  if (fs.existsSync(step2CachePath)) {
    console.log(`  📂 캐시 로드: ${path.basename(step2CachePath)}`);
    step2Data = JSON.parse(fs.readFileSync(step2CachePath, 'utf8'));
  } else {
    step2Data = await extractStructure(examPdfPath, examKey, lastQuestion);
    fs.writeFileSync(step2CachePath, JSON.stringify(step2Data, null, 2), 'utf8');
    console.log(`  💾 저장: ${path.basename(step2CachePath)}`);
  }
  const step2Filtered = filterSections(step2Data);
  const totalSets = targetSections.reduce((n, s) => n + (step2Filtered[s]?.length ?? 0), 0);
  console.log(`  추출 세트: ${totalSets}개 (${targetSections.join(', ')})`);

  // ── STEP 3 ──────────────────────────────────────────────────
  banner(3, '선지 분석 (ok / pat / analysis)');
  let step3Data = loadCache('step3_result');
  if (!step3Data) {
    const raw = await analyzeStructure(step2Filtered, answerKey);
    step3Data = await postProcess(raw, answerKey);
    saveCache('step3_result', step3Data);
  }

  // ── STEP 4 ──────────────────────────────────────────────────
  banner(4, 'cs_ids 문장 매핑');
  let step4Data = loadCache('step4_result');
  if (!step4Data) {
    step4Data = await assignCsIds(step3Data);
    saveCache('step4_result', step4Data);
  }

  // ── STEP 5 ──────────────────────────────────────────────────
  banner(5, '검증 및 보정');
  let step5Data = loadCache('step5_result');
  if (!step5Data) {
    const { result, stats } = await verifyAndFix(step4Data, answerKey, { step2Data: step2Filtered });
    step5Data = result;
    saveCache('step5_result', step5Data);
    console.log(`  정답률: ${stats.matched}/${stats.total}`);
    if (stats.needsReview.length > 0) {
      console.warn(`  ⚠️  needsReview: ${stats.needsReview.map(r => `[${r.setId}] ${r.qId}번`).join(', ')}`);
    }
  }

  // ── STEP 6 ──────────────────────────────────────────────────
  banner(6, 'all_data_204.json 머지');
  for (const sec of targetSections) {
    mergeSection(step5Data, sec, allDataPath);
  }

  // ── STEP 7 ──────────────────────────────────────────────────
  banner(7, '최종 검증 및 빌드');
  const issues = validateMerged(allDataPath);
  if (issues.length > 0) {
    console.error(`\n❌ 검증 실패 (${issues.length}건):`);
    issues.slice(0, 20).forEach(i => console.error('  ' + i));
    if (issues.length > 20) console.error(`  ... 외 ${issues.length - 20}건`);
    process.exit(1);
  }
  console.log('  ✅ 검증 통과');

  console.log('\n  빌드 중...');
  try {
    execSync('npm run build', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
  } catch {
    console.error('  ❌ 빌드 실패');
    process.exit(1);
  }

  // ── 완료 ────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(`  ✅ 파이프라인 완료: ${examKey} / ${section}`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('\n❌ 오류:', err.message);
  console.error(err.stack);
  process.exit(1);
});
