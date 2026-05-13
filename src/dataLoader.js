// dataLoader.js
let _cache = null;
let _annCache = null;
let _statusCache = null;

async function _load() {
  if (_cache) return _cache;
  const res = await fetch("/data/all_data_204.json");
  if (!res.ok) throw new Error("데이터 로드 실패");
  _cache = await res.json();
  return _cache;
}

// pipeline/set_status.json — release_status 필터링 단일 진실
//   구조: { [setId]: { setId, yearKey, release_status, ... } }
//   release_status === "release" 외 (verifying / hidden / rebuild_required / out_of_scope)
//   는 학생 노출 차단.
//   파일 fetch 실패 시 _statusCache = {} → 모든 set이 release 아님으로 평가 → 전수 차단
//   (안전한 default — Gate 1 전 일시 모드).
async function _loadStatus() {
  if (_statusCache !== null) return _statusCache;
  try {
    const res = await fetch("/pipeline/set_status.json");
    if (!res.ok) {
      _statusCache = {};
      return _statusCache;
    }
    _statusCache = await res.json();
  } catch {
    _statusCache = {};
  }
  return _statusCache;
}

// setId 단위 release 검사 (동기 — set_status 사전 로드 필요)
//   _statusCache 미로드 시 false (안전 default).
//   미등록 setId 도 false (등록되지 않은 set은 노출 0).
export function isReleaseSet(setId) {
  if (!_statusCache || !setId) return false;
  const entry = _statusCache[setId];
  return entry?.release_status === "release";
}

// 비동기 release 검사 — _statusCache 자동 로드 후 판정
export async function isReleaseSetAsync(setId) {
  await _loadStatus();
  return isReleaseSet(setId);
}

// release set만 통과시키는 filter (set 객체 → boolean)
function _statusFilterFn(s) {
  const sid = s.setId || s.id;
  return isReleaseSet(sid);
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
  await _loadStatus(); // release_status 매핑 사전 로드
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
  // 매 호출 시 함수형 filter — bypass 시 원본 그대로, 비bypass 시 release-only.
  // yd._origReading / _origLiterature 백업 불필요 — yd.reading 자체는 mutate 0.
  return {
    ...yd,
    reading: bypassFilter
      ? yd.reading || []
      : (yd.reading || []).filter(_statusFilterFn),
    literature: bypassFilter
      ? yd.literature || []
      : (yd.literature || []).filter(_statusFilterFn),
  };
}

// release set 이 1개 이상 있는 yearKey 만 반환 (학생 노출 정합).
//   release set 0 인 year 는 selection UI 에서도 숨김.
//   options.bypassFilter: true 시 전체 yearKey 반환 (마스터/검증자 전용).
export async function getYearKeys(options = {}) {
  const { bypassFilter = false } = options;
  const data = await _load();
  if (bypassFilter) return Object.keys(data);
  await _loadStatus();
  const all = Object.keys(data);
  return all.filter((yk) => {
    const yd = data[yk];
    const reading = yd.reading || [];
    const literature = yd.literature || [];
    return (
      reading.some(_statusFilterFn) || literature.some(_statusFilterFn)
    );
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
};
