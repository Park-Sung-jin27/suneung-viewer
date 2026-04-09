import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── 커맨드라인 인수 ─────────────────────────────────────────

const step5Path = process.argv[2];
const examKey   = process.argv[3];
const section   = process.argv[4]; // 'reading' | 'literature'

if (!step5Path || !examKey || !section) {
  console.error('사용법: node pipeline/step6_merge.js <step5결과JSON> <시험키> <섹션>');
  console.error('예시: node pipeline/step6_merge.js pipeline/test_data/step5_result_2022.json "2022수능" reading');
  process.exit(1);
}

if (section !== 'reading' && section !== 'literature') {
  console.error('섹션은 "reading" 또는 "literature" 이어야 합니다.');
  process.exit(1);
}

// ─── 파일 로드 ───────────────────────────────────────────────

const step5Abs   = path.resolve(step5Path);
const allDataPath = path.resolve(__dirname, '../public/data/all_data_204.json');

const step5Data = JSON.parse(fs.readFileSync(step5Abs, 'utf8'));
const allData   = JSON.parse(fs.readFileSync(allDataPath, 'utf8'));

if (!allData[examKey]) {
  console.error(`시험 키를 찾을 수 없음: "${examKey}"`);
  console.error('사용 가능한 키:', Object.keys(allData).join(', '));
  process.exit(1);
}

if (!step5Data[section]) {
  console.error(`step5 결과에 섹션 없음: "${section}"`);
  process.exit(1);
}

// ─── 세트 단위 머지 ──────────────────────────────────────────

const existingSets = allData[examKey][section] ?? [];
const newSets      = step5Data[section];

let updatedCount = 0;
let addedCount   = 0;

const mergedSets = newSets.map(newSet => {
  const existing = existingSets.find(s => s.id === newSet.id);
  if (existing) {
    updatedCount++;

    // 선지 단위 병합: cs_ids는 기존 값 우선, 비어있을 때만 새 값으로 채움
    const mergedQuestions = newSet.questions.map(newQ => {
      const existingQ = existing.questions.find(q => q.id === newQ.id);
      if (!existingQ) return newQ;

      const mergedChoices = newQ.choices.map(newC => {
        const existingC = existingQ.choices.find(c => c.num === newC.num);
        if (!existingC) return newC;

        return {
          ...newC,
          // cs_ids: 기존에 있으면 유지, 비어있을 때만 새 값 사용
          cs_ids: (existingC.cs_ids && existingC.cs_ids.length > 0)
            ? existingC.cs_ids
            : (newC.cs_ids || []),
        };
      });

      return { ...newQ, choices: mergedChoices };
    });

    // existing의 추가 필드(tag, hasFig, annotations 등) 보존
    return { ...existing, ...newSet, questions: mergedQuestions };
  } else {
    addedCount++;
    return newSet;
  }
});

// step5에 없는 기존 세트는 그대로 유지
for (const s of existingSets) {
  if (!newSets.find(ns => ns.id === s.id)) {
    console.warn(`⚠️  기존 세트 유지 (step5에 없음): ${s.id}`);
    mergedSets.push(s);
  }
}

// ─── 통계 출력 ───────────────────────────────────────────────

let totalChoices   = 0;
let filledAnalysis = 0;
let filledCsIds    = 0;

for (const set of mergedSets) {
  for (const q of set.questions ?? []) {
    for (const c of q.choices ?? []) {
      totalChoices++;
      if (c.analysis && c.analysis.trim()) filledAnalysis++;
      if (Array.isArray(c.cs_ids) && c.cs_ids.length > 0) filledCsIds++;
    }
  }
}

// ─── 저장 ────────────────────────────────────────────────────

allData[examKey][section] = mergedSets;

fs.writeFileSync(allDataPath, JSON.stringify(allData, null, 2), 'utf8');

console.log(`✅ 머지 완료: ${examKey} / ${section}`);
console.log(`   세트: 업데이트 ${updatedCount}개, 추가 ${addedCount}개`);
console.log(`   선지 합계: ${totalChoices}개`);
console.log(`   analysis 채움: ${filledAnalysis}/${totalChoices}`);
console.log(`   cs_ids 채움:   ${filledCsIds}/${totalChoices}`);
console.log(`   저장: ${allDataPath}`);
