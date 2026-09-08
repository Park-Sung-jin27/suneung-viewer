// Private server bundle only. Never write into public/ or dist/.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'data-eng-math-master');
const mathDir = '평가원_수학영어_확장/08_math_data';
const read = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const values = (data) => Object.values(data.items ?? {});
const assets = {};
mkdirSync(path.join(output, 'assets'), { recursive: true });
function asset(relative, alt, expectedHash) {
  if (!relative) return null;
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root) || !relative.endsWith('.png') || !existsSync(absolute)) return null;
  const bytes = readFileSync(absolute);
  const id = createHash('sha256').update(bytes).digest('hex');
  if (expectedHash && expectedHash !== id) throw new Error(`Master asset hash mismatch: ${relative}`);
  const filename = `assets/${id}.png`;
  copyFileSync(absolute, path.join(output, filename));
  assets[id] = filename;
  return { id, alt: alt || '원문 이미지' };
}
const englishDb = read('english/data/english_exam_db_v2_1.json');
const english = new Map(englishDb.questions.map(q => [q.id, q]));
const englishReviews = new Map(values(read('평가원_수학영어_확장/10_eng_explain/eng_explain_2026csat.json')).map(q => [q.id, q]));
for (const filename of readdirSync(path.join(root, 'english/data/candidates')).sort()) {
  // Review-only exports and source manifests are deliberately never packaged.
  if (!/^english_\d{4}_(?:06|09|csat)_merged\.json$/.test(filename)) continue;
  const candidate = read(`english/data/candidates/${filename}`);
  for (const q of candidate.questions ?? []) {
    if (!english.has(q.id)) throw new Error(`Unknown English candidate ${q.id}`);
    english.set(q.id, q);
    if (q.review) englishReviews.set(q.id, q.review);
  }
}
const patch = read('english/data/candidates/english_2026_csat_q18_source_review_patch_v1.json');
// The canonical source patch is already validated by check:eng-math-public.
const patchItem = patch.item ?? patch.items?.['2026_csat_18'];
if (patchItem?.rawText) {
  english.set(patchItem.id, { ...english.get(patchItem.id), ...patchItem });
  if (patchItem.review) englishReviews.set(patchItem.id, patchItem.review);
}
const mathDb = read(`${mathDir}/math_exam_db_v2_0.json`);
const mathReviews = new Map();
for (const filename of readdirSync(path.join(root, mathDir)).sort()) {
  if (!/^math_.*verified_solutions_v1\.json$/.test(filename)) continue;
  for (const item of values(read(`${mathDir}/${filename}`))) {
    if (item.status === 'verified_internal_candidate') mathReviews.set(item.id, item);
  }
}
const figures = read(`${mathDir}/math_required_figures_v1.json`).items;
const questions = [];
function displayRaw(text) {
  // Remove only the known PDF copyright/page footer; preserve the source file.
  return String(text || '')
    .replace(/^㢨ٻⱬ㥐㫴[^\n]*$/gm, '')
    .replace(/\n-- \d+ of \d+ --(?:\s*\d+)*\s*$/, '').trim();
}
// Visually checked against the official 2027 September English PDF, pages 5–6.
// Tabs elsewhere include question indentation and choice spacing: never replace all tabs.
const verifiedBlankAnchors = {
  '2027_09_31': 'death. \twas not merely',
  '2027_09_32': 'adults are \t,',
  '2027_09_33': 'solution, proposed by Balzac, is to \t.',
  '2027_09_34': 'joke \t. [3점]',
};
function blankSpans(q, text) {
  const anchor = verifiedBlankAnchors[q.id];
  if (!anchor) return [];
  const start = text.indexOf(anchor);
  if (start < 0 || start !== text.lastIndexOf(anchor)) throw new Error(`Blank anchor changed: ${q.id}`);
  return [{ start: start + anchor.indexOf('\t'), length: 1, width: q.qid === 31 ? 'short' : 'long' }];
}
for (const q of english.values()) {
  const rawText = displayRaw(q.rawText);
  const review = englishReviews.get(q.id);
  const usableReview = review?.status === 'ready' && String(review.answer) === String(q.answer) ? review : null;
  const image = asset(q.figure?.assetPath, q.figure?.alt, q.figure?.sha256);
  const fallbackImage = image || asset(`english/assets/${q.examId.replaceAll('_', '-')}/q${q.qid}-figure.png`, '원문 도표');
  questions.push({
    id: `english--${q.id}`, subject: 'english', examId: q.examId,
    examLabel: `${q.schoolYear}학년도 ${q.session} 영어`, number: q.qid, track: '',
    title: q.type || '영어', prompt: q.stem, rawText, sharedPassage: displayRaw(q.sharedPassage),
    blankSpans: blankSpans(q, rawText),
    choices: [], answer: q.answer, review: usableReview,
    reviewStatus: usableReview ? 'registered' : 'pending',
    images: fallbackImage ? [fallbackImage] : [],
    warning: '내부 열람용 추출 원문입니다. 표·밑줄·문항 경계 등은 원본과의 추가 대조가 필요할 수 있습니다. 학생 배포용 완성본을 뜻하지 않습니다.',
  });
}
for (const q of mathDb.questions) {
  const review = mathReviews.get(q.id);
  if (review && String(review.answer) !== String(q.answer)) throw new Error(`Master answer mismatch ${q.id}`);
  const figure = figures[q.id];
  const image = asset(figure?.assetPath, figure?.figureAlt, figure?.assetSha256);
  questions.push({
    id: `math--${q.id}`, subject: 'math', examId: q.examKey,
    examLabel: `${q.schoolYear}학년도 ${q.session} 수학`, number: q.qid, track: q.track,
    title: q.meta?.unit || '수학', prompt: q.problem_latex || '',
    choices: q.choices.map(c => ({ mark: c.mark, text: c.latex })),
    answer: q.answer, answerMark: q.answerType === 'choice' ? ['','①','②','③','④','⑤'][q.answer] : null,
    review: review ?? null, reviewStatus: review ? 'registered' : 'pending',
    images: image ? [image] : [], figureDescription: q.hasFigure ? q.figureDesc : '',
    warning: q.hasFigure && !image ? '원본 그림이 아직 연결되지 않은 문항입니다. 아래 그림 설명은 원본을 대신하지 않습니다.' : '내부 열람 자료입니다. 해설 등록과 학생 배포 승인은 별개입니다.',
  });
}
const latestMath = read(`${mathDir}/math_2027_09_registered_solutions_v1.json`);
for (const q of latestMath.items) {
  const image = asset(`${mathDir}/assets/source_pages/2027_09/page-${String(q.page).padStart(2, '0')}.png`, `수학 원문 ${q.page}쪽 · ${q.qid}번을 확인하세요`);
  if (!image) throw new Error(`Missing registered math source page ${q.page}`);
  questions.push({ id: `math--${q.id}`, subject: 'math', examId: 'math_2027_09', examLabel: latestMath.metadata.exam,
    number: q.qid, track: q.track, title: q.concepts.join(' · '), prompt: '아래 원문 페이지에서 해당 문항 번호를 확인하세요.',
    choices: [], answer: q.answer, answerMark: q.answerMark, review: q, reviewStatus: 'registered', images: [image],
    warning: '원문 한 페이지를 그대로 표시하므로 다른 문항도 함께 보일 수 있습니다. 선택한 문항의 해설만 아래에 표시합니다.' });
}
if (new Set(questions.map(q => q.id)).size !== questions.length) throw new Error('Duplicate master question');
const catalog = questions.map(({ id, subject, examId, examLabel, number, track, title, reviewStatus }) => ({ id, subject, examId, examLabel, number, track, title, reviewStatus }));
for (const q of questions) writeFileSync(path.join(output, `${q.id}.json`), JSON.stringify(q));
writeFileSync(path.join(output, 'catalog.json'), JSON.stringify({ questions: catalog }));
writeFileSync(path.join(output, 'assets.json'), JSON.stringify(assets));
console.log(`ENG_MATH_MASTER_BUNDLE: english=${catalog.filter(q=>q.subject==='english').length} math=${catalog.filter(q=>q.subject==='math').length} registered=${catalog.filter(q=>q.reviewStatus==='registered').length} assets=${Object.keys(assets).length}; private only`);
