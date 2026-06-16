// 시험 제목 / 시행일 단일 포맷터 — yearKey 단독 source path.
//   meta.label 안 수기 입력 편차 ("2022학년도 수능" vs "2018_6월" vs
//   "2025 9월 모의" 등) 무력화 path. App.jsx 안 카드/헤더/모달/배너 안
//   formatExamTitle(yearKey) 단독 호출 정합 path.
//
// yearKey 사양 정합:
//   ^(\d{4})(수능|_6월|_9월)([AB]?)$
//     숫자 4자리 = 학년도 (연도키 규칙 정합: 2016_9월=2016학년도 / 2022수능=2022학년도).
//     수능 → "수능" / _6월 → "6월 모의평가" / _9월 → "9월 모의평가"
//     A/B → " (A형)" / " (B형)" / 없으면 ""
//   non-matching path → yearKey 그대로 fallback path.

const RE_EXAM_KEY = /^(\d{4})(수능|_6월|_9월)([AB]?)$/;

const KIND_LABEL = {
  수능: "수능",
  _6월: "6월 모의평가",
  _9월: "9월 모의평가",
};

export function formatExamTitle(yearKey) {
  if (!yearKey || typeof yearKey !== "string") return "";
  const m = yearKey.match(RE_EXAM_KEY);
  if (!m) return yearKey;
  const [, year, kind, form] = m;
  const kindLabel = KIND_LABEL[kind] || kind;
  const formLabel = form ? ` (${form}형)` : "";
  return `${year}학년도 ${kindLabel}${formLabel}`;
}

// 시행일 칩 단일 포맷터:
//   수능 = (학년도-1)년 11월 → 2016수능 → "2015.11"
//   9월  = (학년도-1)년 9월 → 2016_9월 → "2015.09"
//   6월  = 학년도년 6월     → 2022_6월 → "2022.06"
// 출력 형식: "YYYY.MM" (2자리 month / zero-padded).
export function formatExamDate(yearKey) {
  if (!yearKey || typeof yearKey !== "string") return "";
  const m = yearKey.match(RE_EXAM_KEY);
  if (!m) return "";
  const [, yearStr, kind] = m;
  const year = parseInt(yearStr, 10);
  if (kind === "수능") return `${year - 1}.11`;
  if (kind === "_9월") return `${year - 1}.09`;
  if (kind === "_6월") return `${year}.06`;
  return "";
}
