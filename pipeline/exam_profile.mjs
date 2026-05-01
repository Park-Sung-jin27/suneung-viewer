/**
 * pipeline/exam_profile.mjs
 *
 * 시험 yearKey 를 받아 시험군 / 버전 / 번호 범위 규칙을 단일 지점에서 판정.
 * step2_extract 의 reading/literature 범위 하드코딩을 대체하기 위한 profile 레이어.
 *
 * [수능 버전 규칙]
 *   2014 ~ 2021 → version: "old"
 *     - Q1~15  : 화법과 작문 / 문법 (선택)
 *     - Q16~34 : 독서 + 문학  (범위만으로 독서/문학 구분 불가)
 *     - range_based_split_allowed: false   ← 번호 범위로 자동 분류 금지
 *
 *   2022 ~ 현재 → version: "new"
 *     - Q1~17  : 독서 (공통)
 *     - Q18~34 : 문학 (공통)
 *     - range_based_split_allowed: true
 *
 * [유의]
 *   - 이 모듈은 텍스트를 수정하지 않는다.
 *   - 기존 hasElectiveSection / getReadingStartQ 는 유지되며,
 *     profile 은 **더 풍부한 메타** 를 제공하는 상위 레이어.
 *
 * 사용:
 *   import { getExamProfile, describeProfile } from "./exam_profile.mjs";
 *   const profile = getExamProfile(yearKey);
 *   if (profile.version === "new") { ... }
 */

// ── 연도 추출 ────────────────────────────────────────────────────────────────
// yearKey 예시:
//   "2026수능", "2026수능_test", "2022_6월", "2022_9월", "2014수능A", "2015_6월B"
function extractYear(yearKey) {
  if (typeof yearKey !== "string") return null;
  // `_` 가 word char 이므로 \b 에 의존하지 않고 비숫자 경계로 매칭
  const m = yearKey.match(/(?:^|\D)(19|20)(\d{2})(?=\D|$)/);
  if (!m) return null;
  const n = parseInt(`${m[1]}${m[2]}`, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

// ── 시험군 추출 ──────────────────────────────────────────────────────────────
function extractFamily(yearKey) {
  if (typeof yearKey !== "string") return "unknown";
  if (/수능/.test(yearKey)) return "suneung";
  if (/_6월/.test(yearKey) || /_9월/.test(yearKey)) return "mock"; // 평가원 모의
  return "unknown";
}

/**
 * @param {string} yearKey
 * @returns {{
 *   exam_family: 'suneung' | 'mock' | 'unknown',
 *   version: 'old' | 'new' | 'unknown',
 *   year: number | null,
 *   raw_year_key: string,
 *   range_based_split_allowed: boolean,
 *   reading_range: [number, number] | null,
 *   literature_range: [number, number] | null,
 *   notes: string[]
 * }}
 */
export function getExamProfile(yearKey) {
  const year = extractYear(yearKey);
  const exam_family = extractFamily(yearKey);
  const notes = [];

  let version = "unknown";
  let range_based_split_allowed = false;
  let reading_range = null;
  let literature_range = null;

  if (exam_family === "suneung" || exam_family === "mock") {
    if (year != null) {
      if (year >= 2014 && year <= 2021) {
        version = "old";
        range_based_split_allowed = false;
        notes.push(
          "old: Q1~15 선택(화작/문법), Q16~34 독서+문학 혼합 — 범위 기반 분류 금지",
        );
      } else if (year >= 2022) {
        version = "new";
        range_based_split_allowed = true;
        reading_range = [1, 17];
        literature_range = [18, 34];
        notes.push("new: reading=Q1~17, literature=Q18~34");
      } else {
        version = "unknown";
        notes.push(
          `연도 ${year} 는 현 profile 범위(2014~) 밖 — 보수적으로 guard 적용`,
        );
      }
    } else {
      notes.push("yearKey 에서 연도 추출 실패 — version=unknown");
    }
  } else {
    notes.push(`exam_family=${exam_family} — 현재 profile 미지원`);
  }

  return {
    exam_family,
    version,
    year,
    raw_year_key: String(yearKey ?? ""),
    range_based_split_allowed,
    reading_range,
    literature_range,
    notes,
  };
}

/**
 * 로그용 요약 문자열.
 */
export function describeProfile(p) {
  const parts = [
    `family=${p.exam_family}`,
    `version=${p.version}`,
    `year=${p.year ?? "?"}`,
    `range_split=${p.range_based_split_allowed}`,
  ];
  if (p.reading_range) parts.push(`reading=${p.reading_range.join("-")}`);
  if (p.literature_range)
    parts.push(`literature=${p.literature_range.join("-")}`);
  return parts.join(" ");
}

/**
 * step2 에서 호출하는 표준 로그 발화기.
 * 필수 로그 라인:
 *   [profile] detected ...
 *   [profile] new suneung reading=1-17 literature=18-34      (version=new)
 *   [profile] old suneung detected: range-based reading/literature split disabled (version=old)
 */
export function logProfile(p) {
  console.log(`[profile] detected ${describeProfile(p)} (key="${p.raw_year_key}")`);
  if (p.exam_family === "suneung" && p.version === "new") {
    console.log(
      `[profile] new suneung reading=${p.reading_range.join("-")} literature=${p.literature_range.join("-")}`,
    );
  } else if (p.exam_family === "suneung" && p.version === "old") {
    console.warn(
      `[profile] old suneung detected: range-based reading/literature split disabled — set-level classification required`,
    );
  } else if (p.version === "unknown") {
    console.warn(
      `[profile] unknown version — range-based split disabled (defensive guard)`,
    );
  }
  for (const n of p.notes) console.log(`[profile] note: ${n}`);
}
