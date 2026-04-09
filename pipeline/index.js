import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { extractAnswers } from './step1_answer.js';
import { extractStructure, validateExtraction } from './step2_extract.js';
import { analyzeStructure, postProcess, atomicWrite } from './step3_analysis.js';
import { assignCsIds } from './step4_csids.js';
import { verifyAndFix } from './step5_verify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

// ─── 인수 파싱 ────────────────────────────────────────────────

const examPdfPath   = process.argv[2];
const answerPdfPath = process.argv[3];
const examKey       = process.argv[4];

// ★ 인수 파싱: argv[5]가 섹션 키워드면 section, 숫자면 lastQuestion
// 지원 형식:
//   node index.js 시험지 정답 키                    → lastQuestion 자동감지, section=all
//   node index.js 시험지 정답 키 literature         → lastQuestion 자동감지, section=literature
//   node index.js 시험지 정답 키 34 literature      → lastQuestion=34, section=literature
const SECTIONS = ['reading', 'literature', 'all'];
const arg5 = process.argv[5];
const arg6 = process.argv[6];
const lastQuestionArg = (arg5 && !SECTIONS.includes(arg5)) ? parseInt(arg5) : null;
const section = SECTIONS.includes(arg5) ? arg5 : (SECTIONS.includes(arg6) ? arg6 : 'all');

if (!examPdfPath || !answerPdfPath || !examKey) {
  console.error('사용법: node pipeline/index.js <시험지PDF> <정답PDF> <시험키> [섹션|마지막문항] [섹션]');
  console.error('예시1: node pipeline/index.js 시험지.pdf 정답.pdf "2023_6월" literature');
  console.error('예시2: node pipeline/index.js 시험지.pdf 정답.pdf "2023_6월" 34 literature');
  console.error('예시3: node pipeline/index.js 시험지.pdf 정답.pdf "2023수능"              ← 전체, 자동감지');
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

const yearTag = examKey;
// ★ 변경: section 접미사를 캐시명에 포함 (reading/literature 독립)
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

function filterSections(data) {
  const out = { ...data };
  for (const s of skippedSections) out[s] = [];
  return out;
}

// ─── 체크포인트 유틸 ─────────────────────────────────────────
/**
 * 파이프라인 재개 지점 기록/조회
 * 절전·네트워크 끊김 후 재실행 시 완료된 step 이후부터 이어서 진행
 */
function checkpointPath() {
  return path.join(dataDir, `checkpoint_${yearTag}${secSuffix}.json`);
}

function loadCheckpoint() {
  const p = checkpointPath();
  if (fs.existsSync(p)) {
    const cp = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(`  📍 체크포인트 로드: step${cp.lastCompletedStep} 완료 상태 (${cp.timestamp})`);
    return cp;
  }
  return { lastCompletedStep: 0, timestamp: null };
}

function saveCheckpoint(step) {
  const cp = { lastCompletedStep: step, yearTag, section, timestamp: new Date().toISOString() };
  fs.writeFileSync(checkpointPath(), JSON.stringify(cp, null, 2), 'utf8');
  console.log(`  📍 체크포인트 저장: step${step} 완료`);
}

function clearCheckpoint() {
  const p = checkpointPath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// ─── step6 머지 (원자적 쓰기) ────────────────────────────────
/**
 * ★ 원자적 쓰기: .tmp 파일에 먼저 쓰고 완료되면 rename
 * 절전·중단으로 인한 all_data_204.json 손상 방지
 */
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

  // ★ 병합 전 선지 수 검증 (±5 초과 시 경고)
  const existingChoiceCount = existingSets.flatMap(s => s.questions?.flatMap(q => q.choices) || []).length;
  const newChoiceCount = newSets.flatMap(s => s.questions?.flatMap(q => q.choices) || []).length;
  if (existingChoiceCount > 0 && Math.abs(newChoiceCount - existingChoiceCount) > 5) {
    console.warn(`⚠️  선지 수 변동 큼: 기존 ${existingChoiceCount}개 → 새 ${newChoiceCount}개`);
    console.warn(`   강제 진행하려면 --force 플래그를 사용하세요.`);
    if (!process.argv.includes('--force')) {
      throw new Error(`선지 수 변동이 너무 큼 (${existingChoiceCount} → ${newChoiceCount}). --force로 강제 실행 가능.`);
    }
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

  // ★ 원자적 쓰기: .tmp → rename (중단돼도 원본 보존)
  const tmpPath = allDataPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(allData, null, 2), 'utf8');
  fs.renameSync(tmpPath, allDataPath);

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

// ─── step7 검증 ──────────────────────────────────────────────

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

  // ★ DEAD CS_ID 검증
  for (const sec of targetSections) {
    for (const set of exam[sec] ?? []) {
      const sentIds = new Set((set.sents || []).map(s => s.id));
      for (const q of set.questions ?? []) {
        for (const c of q.choices ?? []) {
          for (const csId of (c.cs_ids || [])) {
            if (!sentIds.has(csId)) {
              issues.push(`[${set.id}] Q${q.id}-${c.num}: DEAD cs_id → ${csId}`);
            }
          }
        }
      }
    }
  }

  return issues;
}

// ─── 메인 ────────────────────────────────────────────────────

async function main() {
  const allDataPath = path.resolve(__dirname, '../public/data/all_data_204.json');

  console.log('');
  console.log('🚀 파이프라인 시작');
  console.log(`   시험지  : ${examPdfPath}`);
  console.log(`   정답    : ${answerPdfPath}`);
  console.log(`   시험 키 : ${examKey}`);
  console.log(`   섹션    : ${section}`);

  // ── 체크포인트 로드 ─────────────────────────────────────────
  const checkpoint = loadCheckpoint();
  const skipToStep = checkpoint.lastCompletedStep + 1;
  if (skipToStep > 1) {
    console.log(`\n  ♻️  이전 중단 감지 — step${skipToStep}부터 재개`);
  }

  // ── STEP 1 ──────────────────────────────────────────────────
  let answerKey;
  if (skipToStep <= 1) {
    banner(1, '정답 추출');
    const akPath = answerKeyPath();
    if (fs.existsSync(akPath)) {
      console.log(`  📂 캐시 로드: ${path.basename(akPath)}`);
      answerKey = JSON.parse(fs.readFileSync(akPath, 'utf8'));
    } else {
      answerKey = await extractAnswers(answerPdfPath);
      fs.writeFileSync(akPath, JSON.stringify(answerKey, null, 2), 'utf8');
      console.log(`  💾 저장: ${path.basename(akPath)}`);
    }
    saveCheckpoint(1);
  } else {
    banner(1, '정답 추출 [스킵]');
    answerKey = JSON.parse(fs.readFileSync(answerKeyPath(), 'utf8'));
  }

  // ★ lastQuestion 자동 감지
  const lastQuestion = lastQuestionArg ?? Math.max(...Object.keys(answerKey).map(Number));
  console.log(`  마지막 문항: ${lastQuestion}번 ${lastQuestionArg ? '(수동 지정)' : '(answer_key 자동 감지)'}`);
  console.log(`  정답 ${Object.keys(answerKey).length}문항: ${JSON.stringify(answerKey)}`);

  // ── STEP 2 ──────────────────────────────────────────────────
  let step2Data;
  if (skipToStep <= 2) {
    banner(2, '시험지 구조 추출 (섹션별 독립 캐시)');
    step2Data = await extractStructure(examPdfPath, examKey, lastQuestion, section, dataDir);
    saveCheckpoint(2);
  } else {
    banner(2, '시험지 구조 추출 [스킵]');
    step2Data = { reading: [], literature: [] };
    for (const sec of targetSections) {
      const cp = path.join(dataDir, `step2_${sec}_${yearTag}.json`);
      if (fs.existsSync(cp)) step2Data[sec] = JSON.parse(fs.readFileSync(cp, 'utf8'));
    }
  }

  const step2Filtered = filterSections(step2Data);
  const totalSets = targetSections.reduce((n, s) => n + (step2Filtered[s]?.length ?? 0), 0);
  console.log(`  추출 세트: ${totalSets}개 (${targetSections.join(', ')})`);

  // ── STEP 3 ──────────────────────────────────────────────────
  let step3Data;
  if (skipToStep <= 3) {
    banner(3, '선지 분석 (ok / pat / analysis)');
    let cached = loadCache('step3_result');
    if (!cached) {
      // ★ 부분 캐시 경로 전달 → 세트별 중간 저장 (절전 중단 내성)
      const partialPath = cachePath('step3_partial');
      const raw = await analyzeStructure(step2Filtered, answerKey, partialPath);
      step3Data = await postProcess(raw, answerKey);
      saveCache('step3_result', step3Data);
      if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath);
    } else {
      step3Data = cached;
    }
    saveCheckpoint(3);
  } else {
    banner(3, '선지 분석 [스킵]');
    step3Data = loadCache('step3_result');
  }

  // ── STEP 4 ──────────────────────────────────────────────────
  let step4Data;
  if (skipToStep <= 4) {
    banner(4, 'cs_ids 문장 매핑');
    step4Data = loadCache('step4_result');
    if (!step4Data) {
      step4Data = await assignCsIds(step3Data);
      saveCache('step4_result', step4Data);
    }
    saveCheckpoint(4);
  } else {
    banner(4, 'cs_ids 문장 매핑 [스킵]');
    step4Data = loadCache('step4_result');
  }

  // ── STEP 5 ──────────────────────────────────────────────────
  let step5Data;
  if (skipToStep <= 5) {
    banner(5, '검증 및 보정');
    step5Data = loadCache('step5_result');
    if (!step5Data) {
      const { result, stats } = await verifyAndFix(step4Data, answerKey, { step2Data: step2Filtered });
      step5Data = result;
      saveCache('step5_result', step5Data);
      console.log(`  정답률: ${stats.matched}/${stats.total}`);
      if (stats.needsReview.length > 0) {
        console.warn(`  ⚠️  needsReview: ${stats.needsReview.map(r => `[${r.setId}] ${r.qId}번`).join(', ')}`);
      }
    }
    saveCheckpoint(5);
  } else {
    banner(5, '검증 및 보정 [스킵]');
    step5Data = loadCache('step5_result');
  }

  // ── STEP 6 ──────────────────────────────────────────────────
  banner(6, 'all_data_204.json 머지 (원자적 쓰기)');
  for (const sec of targetSections) {
    mergeSection(step5Data, sec, allDataPath);
  }
  saveCheckpoint(6);

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

  // ── 완료 — 체크포인트 삭제 ──────────────────────────────────
  clearCheckpoint();
  console.log('\n' + '═'.repeat(60));
  console.log(`  ✅ 파이프라인 완료: ${examKey} / ${section}`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('\n❌ 오류:', err.message);
  console.error(err.stack);
  process.exit(1);
});
