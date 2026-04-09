/**
 * pipeline/normalize_quality.mjs
 *
 * 일괄 품질 정규화 스크립트 (2025-04-09)
 *
 * 처리 항목:
 *   1. 숫자 pat (0~4) → analysis 키워드 기반 재분류
 *      - ok=true + 숫자 → null
 *      - ok=false + 숫자 → detectPat()로 R1~R4 / L1~L5
 *   2. F_conclusion_mismatch (46건)
 *      - ok=true + 마지막 결론줄에 ❌ → ✅ 교체
 *      - ok=false + 마지막 결론줄에 ✅ → ❌ 교체
 *   3. 이모지 없음 (13건)
 *      - analysis에 ✅/❌ 없음 → ok값 기반 결론줄 append
 *
 * 수정 안 하는 항목:
 *   - F_content_reversed 본문만 반전 116건 (결론 이모지 정상 → false positive)
 *
 * 실행: node pipeline/normalize_quality.mjs [--dry-run]
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');

const PUB_PATH = path.resolve(__dirname, '../public/data/all_data_204.json');
const SRC_PATH = path.resolve(__dirname, '../src/data/all_data_204.json');

// ── pat 분류 함수 ──────────────────────────────────────────────────────────────
function detectPat(analysis, sec) {
  const a = analysis || '';

  // fallback 1: analysis 내 패턴 레이블 직접 검색 (최우선)
  const m = a.match(/\[(R[1-4]|L[1-5]|V)\]/);
  if (m) return m[1];

  // 보기 대입 오류 (오류유형①②③, 보기 근거)
  if (/\[오류유형[①②③]/.test(a) || a.includes('📌 보기 근거'))
    return sec === 'reading' ? 'R4' : 'L5';

  // 팩트/사실 왜곡, 수치·방향·상태 역전 → R1 / L1
  if (/팩트 왜곡|사실 왜곡|의미 왜곡|어휘 의미|문맥적 의미|어휘.*범위|어휘.*오답|정반대|역전된/.test(a))
    return sec === 'reading' ? 'R1' : 'L1';

  // 관계·인과 전도, 논리 왜곡, 순서 역전, 대상 바꿔치기 → R2 / L4
  if (/관계[··]인과|인과 전도|인과관계 왜곡|논리 왜곡|논리.*역전|반박.*지지|반박-지지|대상 바꿔치기|순서 역전|단계.*오대응|반대 상황/.test(a))
    return sec === 'reading' ? 'R2' : 'L4';

  // 과도한 추론 / 지문에 없음 / 근거 부재 → R3 / L3
  if (/과도한 추론|과잉 추론|지문에 없|근거 부재|지문 핵심 미파악|과장 해석|용어 불일치|불완전.*대응/.test(a))
    return sec === 'reading' ? 'R3' : 'L3';

  // 개념 짜깁기 / 개념 혼합 / 개념 혼동 → R4 / L1
  if (/개념 짜깁기|개념 혼합|개념 혼동/.test(a))
    return sec === 'reading' ? 'R4' : 'L1';

  // 심리 오독 / 정서 오독 / 인물 의도 왜곡 → R1 / L2
  if (/심리 오독|정서\s?오독|인물 의도|맥락 오독/.test(a))
    return sec === 'reading' ? 'R1' : 'L2';

  // 표현·형식 오독 (시어, 수사법, 이미지) → L1
  if (/수사법|시어|이미지|표현법|시간 표지|표현 방식/.test(a) && sec === 'literature')
    return 'L1';

  // 구조·맥락 오류, 화자/주체 오독, 공간 맥락 → L4
  if (/구조.*오류|맥락.*오류|장면 전환|서술 방식|화자.*오독|주체 오독|인물 및 행위|인물.*오인|공간.*오독/.test(a) && sec === 'literature')
    return 'L4';

  // 정서·태도 오류 (감정, 정서, 태도) → L2
  if (/정서.*오류|태도 오독|화자의 태도 오독|감정.*오독/.test(a) && sec === 'literature')
    return 'L2';

  // 주제·의미 과잉 → L3
  if (/권면 대상|핵심 의미 왜곡|과도한 의미|주제.*확대/.test(a) && sec === 'literature')
    return 'L3';

  return null;  // 분류 불가 → null 유지
}

// ── 결론줄 이모지 교체 ──────────────────────────────────────────────────────────
function fixConclusionEmoji(analysis, ok) {
  const lines = analysis.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (!l.includes('✅') && !l.includes('❌')) continue;
    if (ok === true && l.includes('❌') && !l.includes('✅')) {
      // ❌로만 끝나는 결론줄 → ✅로 교체
      lines[i] = l
        .replace(/❌[^✅]*\[.*?\]\s*$/, '✅ 지문과 일치하는 적절한 진술')
        .replace(/❌.*$/, '✅ 지문과 일치하는 적절한 진술');
      return lines.join('\n');
    }
    if (ok === false && l.includes('✅') && !l.includes('❌')) {
      // ✅로만 끝나는 결론줄 → ❌로 교체
      lines[i] = l.replace(/✅.*$/, '❌ 지문과 어긋나는 부적절한 진술');
      return lines.join('\n');
    }
    break;  // 첫 번째 이모지 줄만 처리
  }
  return analysis;
}

// ── 이모지 없을 때 결론줄 추가 ────────────────────────────────────────────────
function appendConclusion(analysis, ok) {
  const suffix = ok === true
    ? '\n✅ 지문과 일치하는 적절한 진술'
    : '\n❌ 지문과 어긋나는 부적절한 진술';
  return analysis.trimEnd() + suffix;
}

// ── 메인 ───────────────────────────────────────────────────────────────────────
const raw  = fs.readFileSync(PUB_PATH, 'utf8');
const data = JSON.parse(raw);

const counters = {
  pat_null:          0,  // ok=true + 숫자 pat → null
  pat_classified:    0,  // ok=false + 숫자 pat → 재분류
  pat_unclassified:  0,  // 재분류 불가 → null
  conclusion_fixed:  0,  // 결론 이모지 불일치 수정
  emoji_added:       0,  // 이모지 없어서 추가
};

for (const [yk, yd] of Object.entries(data)) {
  for (const sec of ['reading', 'literature']) {
    for (const set of (yd[sec] || [])) {
      for (const q of set.questions) {
        for (const c of q.choices) {
          const ana = c.analysis || '';

          // ── 1. 숫자 pat 처리 ──────────────────────────────────────────────
          if (typeof c.pat === 'number') {
            if (c.ok === true) {
              if (!DRY) c.pat = null;
              counters.pat_null++;
            } else {
              const detected = detectPat(ana, sec);
              if (detected) {
                if (!DRY) c.pat = detected;
                counters.pat_classified++;
              } else {
                if (!DRY) c.pat = null;
                counters.pat_unclassified++;
                console.warn(`⚠️  분류불가 → null: ${yk} ${set.id} Q${q.id}C${c.num} | ${ana.slice(-80)}`);
              }
            }
            // 숫자 pat 처리 후에도 결론 이모지 체크 계속 진행
          }

          // ── 2. 결론줄 이모지 불일치 수정 ─────────────────────────────────
          const hasOk   = ana.includes('✅');
          const hasFail = ana.includes('❌');

          if (hasOk || hasFail) {
            const mismatch =
              (c.ok === true  && hasFail && !hasOk) ||
              (c.ok === false && hasOk   && !hasFail);
            if (mismatch) {
              if (!DRY) c.analysis = fixConclusionEmoji(ana, c.ok);
              counters.conclusion_fixed++;
            }
          } else if (ana.trim()) {
            // ── 3. 이모지 없음 → 결론줄 추가 ────────────────────────────────
            if (!DRY) c.analysis = appendConclusion(ana, c.ok);
            counters.emoji_added++;
          }
        }
      }
    }
  }
}

// ── 결과 출력 ──────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════');
console.log(' normalize_quality 결과', DRY ? '[DRY-RUN]' : '[실제 적용]');
console.log('══════════════════════════════════════');
console.log(`  숫자 pat → null (ok=true)     : ${counters.pat_null}건`);
console.log(`  숫자 pat → 재분류             : ${counters.pat_classified}건`);
console.log(`  숫자 pat → 분류불가(null)     : ${counters.pat_unclassified}건`);
console.log(`  결론 이모지 불일치 수정       : ${counters.conclusion_fixed}건`);
console.log(`  이모지 없음 → 결론줄 추가    : ${counters.emoji_added}건`);
const total = Object.values(counters).reduce((a,b)=>a+b,0);
console.log(`  ──────────────────────────────`);
console.log(`  총 처리                       : ${total}건`);
console.log('══════════════════════════════════════\n');

if (!DRY) {
  // public/data 저장
  fs.writeFileSync(PUB_PATH, JSON.stringify(data), 'utf8');
  console.log('✅ public/data/all_data_204.json 저장 완료');

  // src/data 동기화 (quality_gate, pipeline 호환)
  fs.writeFileSync(SRC_PATH, JSON.stringify(data), 'utf8');
  console.log('✅ src/data/all_data_204.json 동기화 완료');
}
