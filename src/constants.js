// ============================================================
// constants.js
// 패턴 정의(R1~R4 독서, L1~L5 문학), 선지 색상 팔레트, 전역 상수
// ============================================================

// ────────────────────────────────────────────────────────────
// 검수중 (under-review) 세트 — 진입 시 상단 배너로 사용자에게 고지.
//
// 사용:
//   import { isSetUnderReview } from "./constants";
//   {currentSet && isSetUnderReview(yearKey, currentSet.id) && <Banner ... />}
//
// ⚠️ 2026-06-13 yearKey-aware 전환: setId 단독 path → composite "yearKey::setId".
// A/B 공유 setId 한쪽 form 단독 release 정합 path 정합 (충돌-혼합 해소).
// migration: 직전 RELEASED_SETS × all_data yearKey 정합 composite 펼침
//            (regression 0 path — 현 배너 상태 100% 보존).
//            직전 orphan 2건 (r2014f / r2016d) = all_data 부재 path → drop 정합.
//
// allowlist: RELEASED_KEYS 등록 composite = 검수 완료 = 배너 미표시.
// 그 외 모든 (yearKey, setId) 조합 = 검수 중 = 상단 배너 노출.
// 신규 set 정정 종결 시 사용자가 본 list 에 "yearKey::setId" 추가 의무.
// ────────────────────────────────────────────────────────────
export const RELEASED_KEYS = new Set([
  // 2014_6월A (5)
  "2014_6월A::l20146c",
  "2014_6월A::r20146a",
  "2014_6월A::r20146b",
  "2014_6월A::r20146c",
  "2014_6월A::r20146e",
  // 2014_6월B (5)
  "2014_6월B::l20146c",
  "2014_6월B::l20146d",
  "2014_6월B::r20146a",
  "2014_6월B::r20146b",
  "2014_6월B::r20146c",
  // 2014_9월A (3)
  "2014_9월A::r20149c",
  "2014_9월A::r20149d",
  "2014_9월A::r20149e",
  // 2014_9월B (4)
  "2014_9월B::l20149c",
  "2014_9월B::r20149c",
  "2014_9월B::r20149d",
  "2014_9월B::r20149e",
  // 2015_6월A (6)
  "2015_6월A::l20156c",
  "2015_6월A::r20156a",
  "2015_6월A::r20156b",
  "2015_6월A::r20156c",
  "2015_6월A::r20156d",
  "2015_6월A::r20156e",
  // 2015_6월B (3)
  "2015_6월B::r20156b",
  "2015_6월B::r20156c",
  "2015_6월B::r20156e",
  // 2015_9월A (4)
  "2015_9월A::l20159c",
  "2015_9월A::r20159b",
  "2015_9월A::r20159c",
  "2015_9월A::r20159e",
  // 2015_9월B (1)
  "2015_9월B::r20159b",
  // 2015수능A (1)
  "2015수능A::l2015b",
  // 2016_6월A (5)
  "2016_6월A::l20166d",
  "2016_6월A::r20166a",
  "2016_6월A::r20166b",
  "2016_6월A::r20166c",
  "2016_6월A::r20166d",
  // 2016_6월B (5) — l20166a 추가 (사용자 실측 누락 정정 2026-06-13)
  "2016_6월B::l20166a",
  "2016_6월B::r20166a",
  "2016_6월B::r20166b",
  "2016_6월B::r20166c",
  "2016_6월B::r20166d",
  // 2016_9월A (3)
  "2016_9월A::l20169d",
  "2016_9월A::r20169a",
  "2016_9월A::r20169c",
  // 2016_9월B (4)
  "2016_9월B::r20169a",
  "2016_9월B::r20169d",
  "2016_9월B::r20169e",
  "2016_9월B::r20169g",
  // 2016수능A (4)
  "2016수능A::l2016c",
  "2016수능A::l2016d",
  "2016수능A::l2016e",
  "2016수능A::r2016a",
  // 2016수능B (4)
  "2016수능B::l2016aB",
  "2016수능B::l2016bB",
  "2016수능B::r2016bB",
  "2016수능B::r2016cB",
  // 2017_6월 (3)
  "2017_6월::l20176b",
  "2017_6월::l20176d",
  "2017_6월::r20176a",
  // 2018_6월 (1)
  "2018_6월::l20186d",
  // 2019_6월 (1)
  "2019_6월::r20196f",
  // 2019_9월 (4)
  "2019_9월::l20199c",
  "2019_9월::l20199d",
  "2019_9월::r20199a",
  "2019_9월::r20199b",
  // 2019수능 (2)
  "2019수능::l2019a",
  "2019수능::l2019b",
  // 2020_6월 (2)
  "2020_6월::r20206a",
  "2020_6월::r20206c",
  // 2020_9월 (3)
  "2020_9월::r20209a",
  "2020_9월::r20209b",
  "2020_9월::r20209d",
  // 2020수능 (3)
  "2020수능::l2020b",
  "2020수능::l2020c",
  "2020수능::l2020d",
  // 2021_6월 (4)
  "2021_6월::l20216a",
  "2021_6월::l20216c",
  "2021_6월::l20216d",
  "2021_6월::r20216c",
  // 2021_9월 (5) — l20219a batch2 추가 (2026-06-13 육안 사후 release)
  "2021_9월::l20219a",
  "2021_9월::l20219b",
  "2021_9월::l20219c",
  "2021_9월::r20219c",
  "2021_9월::r20219d",
  // 2021수능 (4)
  "2021수능::l2021b",
  "2021수능::l2021c",
  "2021수능::l2021d",
  "2021수능::r2021c",
  // 2022_6월 (4)
  "2022_6월::l20226c",
  "2022_6월::l20226d",
  "2022_6월::r20226b",
  "2022_6월::r20226c",
  // 2022수능 (8) — r2022c 추가 (FREE 회귀 복구 2026-06-13)
  "2022수능::l2022a",
  "2022수능::l2022b",
  "2022수능::l2022c",
  "2022수능::l2022d",
  "2022수능::r2022a",
  "2022수능::r2022b",
  "2022수능::r2022c",
  "2022수능::r2022d",
  // 2023_6월 (4)
  "2023_6월::l20236a",
  "2023_6월::r20236a",
  "2023_6월::r20236b",
  "2023_6월::r20236c",
  // 2023_9월 (3)
  "2023_9월::l20239b",
  "2023_9월::l20239c",
  "2023_9월::l20239d",
  // 2023수능 (8) — r2023a/c/d 추가 (FREE 회귀 복구 2026-06-13)
  "2023수능::l2023a",
  "2023수능::l2023b",
  "2023수능::l2023c",
  "2023수능::l2023d",
  "2023수능::r2023a",
  "2023수능::r2023b",
  "2023수능::r2023c",
  "2023수능::r2023d",
  // 2024_6월 (2)
  "2024_6월::l20246a",
  "2024_6월::l20246b",
  // 2024_9월 (1)
  "2024_9월::l20249d",
  // 2024수능 (8) — r2024a/c/d + l2024a/b/c 추가 (FREE 회귀 복구 2026-06-13)
  "2024수능::l2024a",
  "2024수능::l2024b",
  "2024수능::l2024c",
  "2024수능::l2024d",
  "2024수능::r2024a",
  "2024수능::r2024b",
  "2024수능::r2024c",
  "2024수능::r2024d",
  // 2025_6월 (2)
  "2025_6월::l20256d",
  "2025_6월::r20256b",
  // 2025_9월 (6)
  "2025_9월::l20259a",
  "2025_9월::l20259d",
  "2025_9월::r20259a",
  "2025_9월::r20259b",
  "2025_9월::r20259c",
  "2025_9월::r20259d",
  // 2025수능 (8) — r2025b/c + l2025a/c/d 추가 (FREE 회귀 복구 2026-06-13)
  "2025수능::l2025a",
  "2025수능::l2025b",
  "2025수능::l2025c",
  "2025수능::l2025d",
  "2025수능::r2025a",
  "2025수능::r2025b",
  "2025수능::r2025c",
  "2025수능::r2025d",
  // 2026_6월 (2)
  "2026_6월::l20266b",
  "2026_6월::l20266d",
  // 2026_9월 (5)
  "2026_9월::l20269b",
  "2026_9월::r20269a",
  "2026_9월::r20269b",
  "2026_9월::r20269c",
  "2026_9월::r20269d",
  // 2026수능 (8) — r2026b 추가 (사용자 실측 누락 정정 2026-06-13)
  "2026수능::l2026a",
  "2026수능::l2026b",
  "2026수능::l2026c",
  "2026수능::l2026d",
  "2026수능::r2026a",
  "2026수능::r2026b",
  "2026수능::r2026c",
  "2026수능::r2026d",
  // 2027_6월 (8)
  "2027_6월::l20276a",
  "2027_6월::l20276b",
  "2027_6월::l20276c",
  "2027_6월::l20276d",
  "2027_6월::r20276a",
  "2027_6월::r20276b",
  "2027_6월::r20276c",
  "2027_6월::r20276d",
]);

// yearKey-aware 검수중 검사 (composite key lookup).
//   ⚠️ 2026-06-13 sig 정정: isSetUnderReview(setId) → isSetUnderReview(yearKey, setId).
//   yearKey 또는 setId 누락 path → true 안전 default (검수중 path 안 배너 노출).
export function isSetUnderReview(yearKey, setId) {
  if (!yearKey || !setId) return true;
  return !RELEASED_KEYS.has(yearKey + "::" + setId);
}

// 오답 패턴 정의 (R1~R4: 독서, L1~L5: 문학)
export const P = {
  R1: {
    name: "사실 왜곡",
    color: "#c0392b",
    bg: "rgba(192,57,43,0.08)",
    desc: "수치·상태·방향을 정반대나 다른 값으로 서술",
  },
  R2: {
    name: "인과·관계 전도",
    color: "#7d3c98",
    bg: "rgba(125,60,152,0.08)",
    desc: "주체-객체, 원인-결과, 포함관계를 뒤바꿈",
  },
  R3: {
    name: "과잉 추론",
    color: "#1565c0",
    bg: "rgba(21,101,192,0.08)",
    desc: "지문에 없는 내용, 1단계 이상 비약",
  },
  R4: {
    name: "개념 혼합",
    color: "#b7950b",
    bg: "rgba(183,149,11,0.08)",
    desc: "서로 다른 문단의 개념어를 섞어 거짓 문장 구성",
  },
  L1: {
    name: "표현·형식 오독",
    color: "#e74c3c",
    bg: "rgba(231,76,60,0.08)",
    desc: "시어·이미지·수사법·서술 방식을 잘못 파악",
  },
  L2: {
    name: "정서·태도 오독",
    color: "#2980b9",
    bg: "rgba(41,128,185,0.08)",
    desc: "화자·인물의 감정·태도·심리를 반대로 파악",
  },
  L3: {
    name: "주제·의미 과잉",
    color: "#27ae60",
    bg: "rgba(39,174,96,0.08)",
    desc: "작품에 없는 의미 도출, 근거 없는 확대 해석",
  },
  L4: {
    name: "구조·맥락 오류",
    color: "#8e44ad",
    bg: "rgba(142,68,173,0.08)",
    desc: "시점·구성·대비 구조·장면 전환을 잘못 설명",
  },
  L5: {
    name: "보기 대입 오류",
    color: "#d35400",
    bg: "rgba(211,84,0,0.08)",
    desc: "보기 조건을 작품에 잘못 적용하거나 보기 자체를 오독",
  },
  V: {
    name: "어휘",
    color: "#6b7280",
    bg: "rgba(107,114,128,0.08)",
    desc: "어휘 (문맥상 의미 또는 바꿔 쓰기) — 단순 어휘 식별, badge 미표시",
  },
};

// 미분류 패턴 (자동 분류 실패)
export const P0 = {
  name: "미분류",
  color: "#888",
  bg: "rgba(136,136,136,0.08)",
  desc: "자동 분류 실패 — 수동 검토 필요",
};

// V: 어휘 문제 (패턴 분류 제외, 오답률만 측정)
export const VOCAB_PAT = {
  name: "어휘",
  color: "#546e7a",
  bg: "rgba(84,110,122,0.08)",
  desc: "어휘의 문맥적 의미 파악 문제 — 오답 패턴 분류 제외",
};

// 선지번호별 형광펜 색상 팔레트 (1~5번)
export const CC = {
  1: { bg: "rgba(59,130,246,0.18)", border: "#3b82f6", text: "#1d4ed8" },
  2: { bg: "rgba(34,197,94,0.18)", border: "#22c55e", text: "#15803d" },
  3: { bg: "rgba(234,179,8,0.22)", border: "#eab308", text: "#854d0e" },
  4: { bg: "rgba(239,68,68,0.18)", border: "#ef4444", text: "#b91c1c" },
  5: { bg: "rgba(168,85,247,0.18)", border: "#a855f7", text: "#7e22ce" },
};

export const MODE = {
  STUDY: "study", // 풀이 모드
  VIEW: "view", // 보기 모드
};

// 연도 메타정보
export const YEAR_INFO = [
  // ── 수능 ──
  {
    key: "2026수능",
    label: "2026학년도 수능",
    tag: "2025.11",
    badge: "최신",
    color: "#c0392b",
  },
  {
    key: "2025수능",
    label: "2025학년도 수능",
    tag: "2024.11",
    badge: "",
    color: "#2980b9",
  },
  {
    key: "2024수능",
    label: "2024학년도 수능",
    tag: "2023.11",
    badge: "",
    color: "#8e44ad",
  },
  {
    key: "2023수능",
    label: "2023학년도 수능",
    tag: "2022.11",
    badge: "",
    color: "#d35400",
  },
  {
    key: "2022수능",
    label: "2022학년도 수능",
    tag: "2021.11",
    badge: "",
    color: "#2c3e50",
  },
  // ── 9월 모의 ──
  {
    key: "2025_9월",
    label: "2025학년도 9월 모의",
    tag: "2024.09",
    badge: "",
    color: "#27ae60",
  },
  {
    key: "2024_9월",
    label: "2024학년도 9월 모의",
    tag: "2023.09",
    badge: "",
    color: "#d35400",
  },
  {
    key: "2023_9월",
    label: "2023학년도 9월 모의",
    tag: "2022.09",
    badge: "",
    color: "#1abc9c",
  },
  // ── 6월 모의 ──
  {
    key: "2024_6월",
    label: "2024학년도 6월 모의",
    tag: "2023.06",
    badge: "",
    color: "#e67e22",
  },
  {
    key: "2023_6월",
    label: "2023학년도 6월 모의",
    tag: "2022.06",
    badge: "",
    color: "#3498db",
  },
  {
    key: "2022_6월",
    label: "2022학년도 6월 모의",
    tag: "2021.06",
    badge: "",
    color: "#2ecc71",
  },
  // ── LEGACY 수능 ──
  {
    key: "2021수능",
    label: "2021학년도 수능",
    tag: "2020.12",
    badge: "",
    color: "#16a085",
  },
  {
    key: "2020수능",
    label: "2020학년도 수능",
    tag: "2019.11",
    badge: "",
    color: "#e74c3c",
  },
  {
    key: "2019수능",
    label: "2019학년도 수능",
    tag: "2018.11",
    badge: "",
    color: "#3498db",
  },
  {
    key: "2018수능",
    label: "2018학년도 수능",
    tag: "2017.11",
    badge: "",
    color: "#9b59b6",
  },
  {
    key: "2017수능",
    label: "2017학년도 수능",
    tag: "2016.11",
    badge: "",
    color: "#f39c12",
  },
  {
    key: "2016수능A",
    label: "2016학년도 수능 A형",
    tag: "2015.11",
    badge: "",
    color: "#1abc9c",
  },
  {
    key: "2016수능B",
    label: "2016학년도 수능 B형",
    tag: "2015.11",
    badge: "",
    color: "#1abc9c",
  },
  {
    key: "2015수능A",
    label: "2015학년도 수능 A형",
    tag: "2014.11",
    badge: "",
    color: "#e67e22",
  },
  {
    key: "2015수능B",
    label: "2015학년도 수능 B형",
    tag: "2014.11",
    badge: "",
    color: "#e67e22",
  },
  {
    key: "2014수능A",
    label: "2014학년도 수능 A형",
    tag: "2013.11",
    badge: "",
    color: "#7f8c8d",
  },
  {
    key: "2014수능B",
    label: "2014학년도 수능 B형",
    tag: "2013.11",
    badge: "",
    color: "#7f8c8d",
  },
  // ── 추가 모의평가 ──
  {
    key: "2026_9월",
    label: "2026학년도 9월 모의",
    tag: "2025.09",
    badge: "",
    color: "#c0392b",
  },
  {
    key: "2026_6월",
    label: "2026학년도 6월 모의",
    tag: "2025.06",
    badge: "",
    color: "#c0392b",
  },
  {
    key: "2025_6월",
    label: "2025학년도 6월 모의",
    tag: "2024.06",
    badge: "",
    color: "#2980b9",
  },
  {
    key: "2022_9월",
    label: "2022학년도 9월 모의",
    tag: "2021.09",
    badge: "",
    color: "#2c3e50",
  },
];

// 수능 국어 등급컷 (화법과 작문 선택 기준, 원점수 100점 만점 역산치)
// ※ 2022학년도 이후 국어 공식 등급은 표준점수 기반이며,
//    아래 원점수는 입시기관 역산 참고치로 실제와 다를 수 있습니다.
// ※ 이 앱은 공통 34문항(독서+문학)만 포함 — 선택과목 미포함
//
// verified: true  → 평가원 확정 채점 결과 기반
// verified: false → 입시기관(EBSi·메가·종로 등) 추정치 기반
//
// cuts 배열: [1등급컷, 2등급컷, 3등급컷, 4등급컷, 5등급컷, 6등급컷, 7등급컷]
// 각 값은 해당 등급에 진입하기 위한 최저 원점수 (100점 만점 기준 %)로 사용
export const GRADE_CUTS = {
  "2026수능": {
    cuts: [89, 81, 71, 61, 48, 36, 26],
    verified: true,
    source: "평가원 확정 채점 결과",
  },
  "2025수능": {
    cuts: [95, 87, 77, 65, 52, 39, 27],
    verified: false,
    source: "입시기관 추정치",
  },
  "2025_9월": null,
  "2024수능": {
    cuts: [87, 79, 71, 61, 48, 36, 25],
    verified: false,
    source: "EBSi 가채점 기반",
  },
  "2023수능": {
    cuts: [93, 85, 75, 63, 50, 37, 25],
    verified: false,
    source: "입시기관 추정치 (미검증)",
  },
  "2022수능": {
    cuts: [89, 81, 71, 59, 46, 34, 23],
    verified: false,
    source: "입시기관 추정치 (미검증)",
  },
  "2022_6월": null,
};

// 등급 추정 헬퍼 함수
// correct: 맞은 문항 수, total: 전체 문항 수, yearKey: '2026수능' 등
// 반환값: { grade: 1~9, pct: 정답률 %, cutUsed: 해당 등급컷, verified, source }
//         데이터 없으면 null 반환
export function estimateGrade(correct, total, yearKey) {
  const data = GRADE_CUTS[yearKey];
  if (!data || total === 0) return null;

  const pct = (correct / total) * 100;
  const cuts = data.cuts;

  let grade = 8;
  for (let i = 0; i < cuts.length; i++) {
    if (pct >= cuts[i]) {
      grade = i + 1;
      break;
    }
  }

  return {
    grade,
    pct: Math.round(pct),
    cutUsed: cuts[grade - 1] ?? null,
    verified: data.verified,
    source: data.source,
  };
}

// 베타 사전 신청 Tally form (Landing 메인 CTA 통합 통로)
//   학원 WaitlistForm 은 자체 supabase.from("waitlist") — 본 URL 무관.
//   /auth 직접 접근 시 Google OAuth 정상 (마스터/검증자 통로 보존).
export const TALLY_URL = "https://tally.so/r/81jOpo";

// 마스터 / 검증자 이메일 allowlist — frontend 단독 filter 우회 통로.
//   release_status filter 우회 → 모든 status (verifying / rebuild_required /
//   hidden / out_of_scope) set 진입 허용.
//   학생 path 영향 0 (release === "release" 단독 유지).
//   ※ Supabase RLS 우회 X — frontend 표시 영역만.
//   ※ 별도 검증자 추가 시 본 const 직접 정정.
export const MASTER_ALLOWLIST = ["downfall121@gmail.com"];

export function isAllowlisted(email) {
  if (!email) return false;
  return MASTER_ALLOWLIST.includes(email.toLowerCase().trim());
}

// 선지 기호 이미지 매핑 ([[sym:box]] 등 치환용)
export const SYMBOLS = {
  box: "/images/sym_box.png",
  numbered: "/images/sym_numbered.png",
  check: "/images/sym_check.png",
  wavy: "/images/sym_wavy.png",
};

// ── figure sent 이미지 매핑 ─────────────────────────────────
//   PassagePanel은 sentType === "figure"인 sent 렌더링 시 이 맵을 조회.
//   있으면 <img> + alt caption, 없으면 원문(placeholder)을 그대로 <Lines>로 노출.
//
//   Code B가 all_data_204.json의 figure sent에 url/alt 필드를 추가하면
//   이 맵은 단계적으로 제거 가능. (단기 해결책)
//
export const FIGURE_IMAGE_MAP = {
  r2022as2: {
    url: "/images/2022_r2022a_photo.png",
    alt: "제2차 세계 대전 당시 폐허가 된 런던 건물 안에서 사람들이 책을 보고 있는 사진",
  },
  r2023ds17: {
    url: "/images/2023_r2023d_lgraph.png",
    alt: "L-그래프의 가로축 X와 세로축 Y, 편차, 기울기를 표시",
  },
  r2021cs24: {
    url: "/images/2021_r2021c_sent24_scene.png",
    alt: "3D 애니메이션 제작을 위한 장면 구상 및 스케치",
  },
};
