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

// release 정합 90 set hardcode list — 단일 진실 source.
//   기준: pipeline/release_approval_records/QG-{examKey}-{setId}-release-approval.json
//        파일 존재 사양 — backfill 없이 frontend 단독 명시.
//   set_status.json 의 release_status field 채택 X (lock #1 release_status
//   자동 정정 금지 정합 보장).
//   ⚠️ setId는 yearKey 미포함 — 2014~2016 A/B 시험 중복 setId 주의:
//        같은 setId가 가형(A)/나형(B) 양쪽에 존재하면 양쪽 모두 release.
//        양쪽 모두 4기준 PASS 확인 시에만 추가. 미확인 15개 holdback (하단 주석).
//   l2025b (2025수능 literature) — 2026-05-21 release 추가
//     (sentType=undefined 30건 accepted 별도 회기 path / approval aed7e10).
//   2021수능 (LEGACY 1/8) — 2026-05-21 release 추가 (Code B caf0b00).
//     7 sets (reading 3 + literature 4) — r2021d 부재 path 정합 (의도).
//   2020수능 (LEGACY 2/8) — 2026-05-21 release 추가 (Code B f712c3e).
//     7 sets (reading 2 + literature 5) — r2020a~d 부재 path 정합 (의도).
//     l2020e ↔ l2020d sentId 공유 사실 — 별도 회기 구조 정정 path.
//   2017수능 (LEGACY 3/8) — 2026-05-21 release 추가 (Code B 8b0fbd1).
//     3 sets (reading 2 + literature 1) — r2017b / l2017a 보류 사양
//     (별도 회기 정정 path). r2017d / l2017b duplicate 사양 안 삭제 path.
//     r2017c Q42 critical 결함: ch[1~5] 5건 모두 ok=false (ok:true=0) —
//     2026-05-24 raw 확인 완료. questionType=negative → ok:true 4건 필요.
//     다음 회기 즉시 정정 path (ch[2~5] ok=false→true + pat/근거 확인).
//   LEGACY T1/T2 33 sets (2014~2021 6월/9월+수능) — 2026-05-24 release 추가 (Code B 61c6fdb).
//     A/B 중복 setId 15개 holdback (가형·나형 양쪽 4기준 미확인):
//       r20146d/l20146a/l20146c, r20149a/b/d/e,
//       r20156b/c/e, l2014a, r2015a, r20166a/b/c
//   별도 release 추가 시 본 const 직접 정정 path.
const RELEASE_SET_IDS = new Set([
  // 2027_6월 (2026-06-08 release 추가 — 대표 결정: R3/V 22건 근거 보강 완결 후 전환.
  //   해설 3단 서술 신기준 + 전수 원문 대조 + quality_gate CRITICAL 0 충족.)
  "r20276a", "r20276b", "r20276c", "r20276d",
  "l20276a", "l20276b", "l20276c", "l20276d",
  // 2017수능 (LEGACY 3/8 — 2026-05-21 release 추가)
  // r2017b 보류 (C3=10, analysis 누락 별도 회기).
  // l2017a 보류 (C1+C4=9, cs_ids 누락 별도 회기).
  // r2017d / l2017b 삭제 (duplicate 사양 정합 — Code B 8b0fbd1).
  // 2020수능 (LEGACY 2/8 — 2026-05-21 release 추가)
  "r2020e", "r2020f",
  "l2020a", "l2020b", "l2020c", "l2020d", "l2020e",
  // V9_NEEDS_HUMAN warning 4건 (l2020a/b/d/e) + l2020d V7a warning accepted —
  // 별도 회기 정정 path.
  // r2020a~d 부재 = 의도적 scope (r2020e/f 2 sets 단독 path).
  // l2020e ↔ l2020d sentId 공유 사실 (별도 회기 구조 정정 path).
  // 2021수능 (LEGACY 1/8 — 2026-05-21 release 추가)
  "r2021a", "r2021b", "r2021c",
  "l2021a", "l2021b", "l2021c", "l2021d",
  // V9_NEEDS_HUMAN warning 3건 (l2021a/c/d) + V7a warning 1건 (l2021c)
  // accepted — 별도 회기 정정 path.
  // r2021d 부재 = 2021수능 reading 3 sets 단독 path 정합 (의도 path).
  // LEGACY T1/T2 (2014~2021 6월/9월+수능) — 2026-05-24 release 추가 (Code B 61c6fdb)
  // 33 sets: A/B 중복 없는 고유 setId만 포함.
  // 2014_9월B (T1_CLEAN)
  // 2015_9월A (T1_CLEAN)
  "l20159c",
  // 2016_6월A (T1_CLEAN — l20166d는 2016_6월B에 없음)
  "l20166d",
  // 2016수능B (T1_CLEAN)
  // 2017_6월 (T1_CLEAN)
  "l20176b",
  // 2017_9월 (T1_CLEAN)
  // 2018수능 (T1_CLEAN)
  // 2019_9월 (T1_CLEAN)
  "r20199b",
  // 2019수능 (T1+T2 — r2019d는 r2019c 구조 정정 후 canonical, Code B a62c683)
  "r2019a", "r2019d", "r2019e",
  "l2019a", "l2019b",
  // 2020_6월 (T1+T2_WARN)
  "r20206a", "r20206b", "r20206d", "r20206e",
  // 2020_9월 (T1+T2_WARN)
  // 2021_6월 (T1+T2_WARN)
  "r20216b", "r20216c",
  "l20216a", "l20216c", "l20216d",
  // 2021_9월 (T1+T2_WARN)
  "r20219b", "r20219c", "r20219d", "r20219e",
  "l20219a", "l20219b", "l20219c",
  // 2022수능
  "r2022a", "r2022b", "r2022d",
  "l2022a", "l2022b", "l2022c", "l2022d",
  // 2023수능
  "r2023b",   "l2023a", "l2023b", "l2023c", "l2023d",
  // 2024수능
  "r2024b",   "l2024d",
  // 2025수능 (l2025b 추가 — 2026-05-21 release)
  "r2025a", "r2025d",
  "l2025b",   // 2026수능
  "r2026a", "r2026c", "r2026d",
  "l2026a", "l2026b", "l2026c", "l2026d",
  // ── LEGACY 수능 2014~2021 (55 set) ──
  // 2014수능A 전체 — 2026-06-11 재출시 (재구축+해설+형광펜 완료 / 검수중 배너 유지: RELEASED_SETS 미추가)
  "r2014a", "r2014b", "r2014c", "r2014d", "r2014e",
  "l2014a", "l2014b", "l2014e", "l2014c", "l2014d",
  "l2015b",
  "l2016c",
  "l2016d",
  "l2016e",
  "l2019a",
  "l2019b",
  "l2020b",
  "l2020c",
  "l2020d",
  "l2021b",
  "l2021c",
  "l2021d",
  "r2014f",
  "r2016a",
  "r2016d",
  "r2021c",
  // ── 수능 B형 (2014~2016) ──
  // 2014수능B l2014aB/bB — 2026-06-10 격리 (본문 비어있음/OCR 오염, 재구축 후 재출시)
  "l2016aB",
  "l2016bB",
  "r2016bB",
  "r2016cB",
  // ── 모의평가 22~26 (78 set) ──
  "r20269a", "r20269b", "r20269c", "r20269d",
  "l20269b",   "l20266b", "l20266d",
  "r20259a", "r20259b", "r20259c", "r20259d",
  "l20259a", "l20259d",
  "r20256b",   "l20256d",
  "l20249d",
  "l20246a", "l20246b",   "l20239b", "l20239c", "l20239d",
  "r20236a", "r20236b", "r20236c",   "l20236a",   "r20226b", "r20226c",   "l20226c", "l20226d",
]);

// setId 단위 release 검사 (동기 — hardcode set lookup).
export function isReleaseSet(setId) {
  if (!setId) return false;
  return RELEASE_SET_IDS.has(setId);
}

// 비동기 호환 wrapper (기존 호출처 API 보존)
export async function isReleaseSetAsync(setId) {
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
