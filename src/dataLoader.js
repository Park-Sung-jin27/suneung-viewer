// dataLoader.js
let _cache = null;
let _annCache = null;
let _vmCache = null;

async function _load() {
  if (_cache) return _cache;
  const res = await fetch("/data/all_data_204.json");
  if (!res.ok) throw new Error("데이터 로드 실패");
  _cache = await res.json();
  return _cache;
}

// release 정합 composite key (yearKey::setId) hardcode list — 단일 진실 source.
//   기준: pipeline/release_approval_records/QG-{examKey}-{setId}-release-approval.json
//        파일 존재 사양 — backfill 없이 frontend 단독 명시.
//   set_status.json 의 release_status field 채택 X (lock #1 release_status
//   자동 정정 금지 정합 보장).
//
//   ⚠️ 2026-06-13 yearKey-aware 전환: 직전 setId 단독 Set path → composite path.
//   문제: 2014~2016 A/B 공유 setId (예: r20146a) 한쪽 form 단독 release 사양 NOT
//         path → 양쪽 form 동반노출 안 미준비 form 노출 안 충돌-혼합 8 출시 불가.
//   정정: "yearKey::setId" composite key 단독 path → A/B form 분리 노출 정합.
//   migration 정합: 직전 RELEASE_SET_IDS 안 모든 setId × all_data 안 yearKey 정합
//                   composite 펼침 (regression 0 path — 현 노출 상태 100% 보존).
//                   직전 RSI 안 orphan 7건 (l2020e/r20206b/r20206e/r20216b/r20219b/
//                   r2014f/r2016d) = all_data 안 부재 path → drop 정합 (사용자 노출 0).
//
//   별도 release 추가 시 본 const 직접 정정 path.
const RELEASE_KEYS = new Set([
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
  // 2014_9월A (7) — l20149a/b + r20149a/b 추가 (whole-exam, Code B d70c1cb §7 정합)
  "2014_9월A::l20149a",
  "2014_9월A::l20149b",
  "2014_9월A::r20149a",
  "2014_9월A::r20149b",
  "2014_9월A::r20149c",
  "2014_9월A::r20149d",
  "2014_9월A::r20149e",
  // 2014_9월B (4)
  "2014_9월B::l20149c",
  "2014_9월B::r20149c",
  "2014_9월B::r20149d",
  "2014_9월B::r20149e",
  // 2014수능A (10)
  "2014수능A::l2014a",
  "2014수능A::l2014b",
  "2014수능A::l2014c",
  "2014수능A::l2014d",
  "2014수능A::l2014e",
  "2014수능A::r2014a",
  "2014수능A::r2014b",
  "2014수능A::r2014c",
  "2014수능A::r2014d",
  "2014수능A::r2014e",
  // 2015_6월A (9) — l20156a/b/d 추가 (whole-exam, Code B §7 정합)
  "2015_6월A::l20156a",
  "2015_6월A::l20156b",
  "2015_6월A::l20156c",
  "2015_6월A::l20156d",
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
  // 2015_9월B (2) — r20159a 추가 (whole-exam 완성, Code B 1a3a027 §7 정합)
  "2015_9월B::r20159a",
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
  // 2019수능 (5)
  "2019수능::l2019a",
  "2019수능::l2019b",
  "2019수능::r2019a",
  "2019수능::r2019d",
  "2019수능::r2019e",
  // 2020_6월 (3)
  "2020_6월::r20206a",
  "2020_6월::r20206c",
  "2020_6월::r20206d",
  // 2020_9월 (3)
  "2020_9월::r20209a",
  "2020_9월::r20209b",
  "2020_9월::r20209d",
  // 2020수능 (6)
  "2020수능::l2020a",
  "2020수능::l2020b",
  "2020수능::l2020c",
  "2020수능::l2020d",
  "2020수능::r2020e",
  "2020수능::r2020f",
  // 2021_6월 (4)
  "2021_6월::l20216a",
  "2021_6월::l20216c",
  "2021_6월::l20216d",
  "2021_6월::r20216c",
  // 2021_9월 (6)
  "2021_9월::l20219a",
  "2021_9월::l20219b",
  "2021_9월::l20219c",
  "2021_9월::r20219c",
  "2021_9월::r20219d",
  "2021_9월::r20219e",
  // 2021수능 (7)
  "2021수능::l2021a",
  "2021수능::l2021b",
  "2021수능::l2021c",
  "2021수능::l2021d",
  "2021수능::r2021a",
  "2021수능::r2021b",
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

// yearKey-aware release 검사 (동기 — composite key lookup).
//   ⚠️ 2026-06-13 sig 정정: isReleaseSet(setId) → isReleaseSet(yearKey, setId).
//   yearKey 또는 setId 누락 path → false 안전 default.
export function isReleaseSet(yearKey, setId) {
  if (!yearKey || !setId) return false;
  return RELEASE_KEYS.has(yearKey + "::" + setId);
}

// release 통계 (Landing 등 외부 표기 path 안 동적 산출 단독 source).
//   setCount = composite key 총 수 (A/B 분리 노출 path 안 단위 카드 수).
//   yearKeyCount = release 영역 안 unique yearKey 수.
//   yearRange = {min, max} (yearKey 안 학년도 4자리 정합).
export function getReleaseStats() {
  const yearKeys = new Set();
  const years = [];
  for (const k of RELEASE_KEYS) {
    const sep = k.indexOf("::");
    if (sep < 0) continue;
    const yk = k.slice(0, sep);
    yearKeys.add(yk);
    const m = yk.match(/^(\d{4})/);
    if (m) years.push(parseInt(m[1], 10));
  }
  return {
    setCount: RELEASE_KEYS.size,
    yearKeyCount: yearKeys.size,
    yearRange: years.length
      ? { min: Math.min(...years), max: Math.max(...years) }
      : null,
  };
}

// 비동기 호환 wrapper (기존 호출처 API 보존).
export async function isReleaseSetAsync(yearKey, setId) {
  return isReleaseSet(yearKey, setId);
}

// release set 단독 통과 filter (curried — yearKey 단독 closure path).
//   loadYear / getYearKeys 안 yk 단독 묶음 안 호출 path 정합.
function _statusFilterFor(yearKey) {
  return (s) => {
    const sid = s.setId || s.id;
    return isReleaseSet(yearKey, sid);
  };
}

// annotations.json은 optional — 없어도 앱은 정상 동작
async function _loadAnn() {
  if (_annCache !== null) return _annCache;
  try {
    const res = await fetch("/data/annotations.json");
    if (!res.ok) {
      _annCache = {};
      return _annCache;
    }
    _annCache = await res.json();
  } catch {
    _annCache = {};
  }
  return _annCache;
}

// visual_marks.json optional — 없어도 앱 정상 동작 path.
//   schema: { generated_at, audit_commit, ..., marks: [ {yearKey, setId, type, ...} ] }
//   Phase 2 source — bracket / inline_label 단독 진실 path.
async function _loadVm() {
  if (_vmCache !== null) return _vmCache;
  try {
    const res = await fetch("/data/visual_marks.json");
    if (!res.ok) {
      _vmCache = [];
      return _vmCache;
    }
    const j = await res.json();
    _vmCache = Array.isArray(j?.marks) ? j.marks : [];
  } catch {
    _vmCache = [];
  }
  return _vmCache;
}

// visual_marks 안 set 단위 묶음 안 yearData 안 set.visualMarks 영역 주입.
//   release set 단독 필터 X — bypass path 도 동일하게 visualMarks 영역 노출.
function _attachVisualMarks(yearData, yearKey, allMarks) {
  const byset = {};
  for (const m of allMarks) {
    if (m?.yearKey !== yearKey || !m?.setId) continue;
    (byset[m.setId] ||= []).push(m);
  }
  for (const sec of ["reading", "literature"]) {
    for (const set of yearData[sec] || []) {
      const setId = set.setId || set.id;
      if (!setId) continue;
      set.visualMarks = byset[setId] || [];
    }
  }
}

// annotations를 해당 year의 set.annotations로 주입
//   annotations.json 구조: { [yearKey]: { [setId]: [ {type, sentId, text}, ... ] } }
//   setKey는 all_data_204.json의 set.setId와 일치
function _attachAnnotations(yearData, annYear) {
  if (!annYear || typeof annYear !== "object") return;
  for (const sec of ["reading", "literature"]) {
    for (const set of yearData[sec] || []) {
      const setId = set.setId || set.id;
      if (!setId) continue;
      const list = annYear[setId];
      if (Array.isArray(list) && list.length > 0) {
        set.annotations = list;
      } else if (!set.annotations) {
        set.annotations = [];
      }
    }
  }
}

function _buildSentCs(yearData) {
  for (const sec of ["reading", "literature"]) {
    for (const set of yearData[sec] || []) {
      const sentMap = {};
      for (const s of set.sents) sentMap[s.id] = s;
      for (const q of set.questions) {
        for (const c of q.choices) {
          const key = `q${q.id}_c${c.num}`;
          // cs_ids → sent.cs (문장 전체 하이라이트용, 기존 유지)
          for (const sid of c.cs_ids || []) {
            const s = sentMap[sid];
            if (s) (s.cs ||= []).includes(key) || s.cs.push(key);
          }
          // cs_spans → sent.csSpans (부분 하이라이트용, 신규)
          //   스키마: { sent_id, text } — text는 해당 문장 내부 어구
          //   csSpans: { key: [text1, text2, ...] } — 객체(key 기반), 배열 아님
          for (const span of c.cs_spans || []) {
            const sid = span.sent_id;
            const text = span.text;
            if (!sid || !text) continue;
            const s = sentMap[sid];
            if (!s) continue;
            // cs에도 추가 (스크롤/fallback용 — cs_ids에 없더라도 cs_spans만 있는 경우 대비)
            (s.cs ||= []).includes(key) || s.cs.push(key);
            s.csSpans ||= {};
            const arr = (s.csSpans[key] ||= []);
            if (!arr.includes(text)) arr.push(text); // 중복 push 방지
          }
        }
      }
    }
  }
}

// loadYear(yearKey, options)
//   options.bypassFilter: true 시 release_status filter 우회 — 마스터/검증자 전용.
//     모든 status (verifying / rebuild_required / hidden / out_of_scope) set 반환.
//   cache mutation 0 — yd 원본은 보존하고 spread 후 reading/literature 만 새 배열.
//     bypass 와 비bypass 호출이 교대로 와도 cache 상태에 영향 0.
export async function loadYear(yearKey, options = {}) {
  const { bypassFilter = false } = options;
  const data = await _load();
  if (!data[yearKey]) throw new Error(`연도 데이터 없음: ${yearKey}`);
  const yd = data[yearKey];
  if (!yd._csBuilt) {
    _buildSentCs(yd);
    yd._csBuilt = true;
  }
  if (!yd._annBuilt) {
    const annAll = await _loadAnn();
    _attachAnnotations(yd, annAll[yearKey]);
    yd._annBuilt = true;
  }
  if (!yd._vmBuilt) {
    const vmAll = await _loadVm();
    _attachVisualMarks(yd, yearKey, vmAll);
    yd._vmBuilt = true;
  }
  // 매 호출 시 함수형 filter — bypass 시 원본 그대로, 비bypass 시 release-only.
  // yd._origReading / _origLiterature 백업 불필요 — yd.reading 자체는 mutate 0.
  const filter = _statusFilterFor(yearKey);
  return {
    ...yd,
    reading: bypassFilter
      ? yd.reading || []
      : (yd.reading || []).filter(filter),
    literature: bypassFilter
      ? yd.literature || []
      : (yd.literature || []).filter(filter),
  };
}

// release set 이 1개 이상 있는 yearKey 만 반환 (학생 노출 정합).
//   release set 0 인 year 는 selection UI 에서도 숨김.
//   options.bypassFilter: true 시 전체 yearKey 반환 (마스터/검증자 전용).
export async function getYearKeys(options = {}) {
  const { bypassFilter = false } = options;
  const data = await _load();
  if (bypassFilter) return Object.keys(data);
  const all = Object.keys(data);
  return all.filter((yk) => {
    const yd = data[yk];
    const reading = yd.reading || [];
    const literature = yd.literature || [];
    const filter = _statusFilterFor(yk);
    return reading.some(filter) || literature.some(filter);
  });
}

// 전체 yearKey 반환 (필터 X) — 디버깅·내부용
export async function getAllYearKeys() {
  const data = await _load();
  return Object.keys(data);
}

export function getYearSync(yearKey) {
  return _cache?.[yearKey] ?? null;
}

export async function loadAllData() {
  return await _load();
}

export default {
  loadYear,
  getYearKeys,
  getAllYearKeys,
  getYearSync,
  loadAllData,
  isReleaseSet,
  isReleaseSetAsync,
  getReleaseStats,
};
