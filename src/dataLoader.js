// dataLoader.js
let _cache = null;
let _annCache = null;
let _vmCache = null;

// ── 발주 F-20 (3단계): 무료/유료 데이터 분리 스위치 ──────────────────
//   false → public/data/all_data_204.json 단일 파일 (현재 동작. 무변화)
//   true  → public/data/free/<yearKey>.json + /api/pro-data (해설·형광펜)
//   ★ 되돌리기: 이 상수를 false 로 되돌리면 즉시 현재 동작으로 복귀한다.
//     all_data_204.json 은 삭제하지 않는다.
//   ★ 4단계 승인 전까지 false 로 배포한다.
export const USE_SPLIT_DATA = true;

async function _load() {
  if (_cache) return _cache;
  const res = await fetch("/data/all_data_204.json");
  if (!res.ok) throw new Error("데이터 로드 실패");
  _cache = await res.json();
  return _cache;
}

// ── split 경로 (USE_SPLIT_DATA=true 일 때만 사용) ────────────────────
//   스키마 계약은 발주문 그대로다. 형식이 어긋나면 여기서 고치지 말고
//   심사관에게 올린다 — 한쪽만 맞추면 그게 곧 장애다.
let _indexCache = null;
const _freeYearCache = {};

async function _loadIndex() {
  if (_indexCache) return _indexCache;
  const res = await fetch("/data/free/index.json");
  if (!res.ok) throw new Error("무료 인덱스 로드 실패");
  _indexCache = await res.json();
  return _indexCache;
}

async function _loadFreeYear(yearKey) {
  if (_freeYearCache[yearKey]) return _freeYearCache[yearKey];
  const res = await fetch(`/data/free/${encodeURIComponent(yearKey)}.json`);
  if (!res.ok) throw new Error(`연도 데이터 없음: ${yearKey}`);
  const yd = await res.json();
  _freeYearCache[yearKey] = yd;
  return yd;
}

// 유료 조각을 free 트리에 얹는다. 401/402 는 정상 흐름이다(미로그인·이용권 없음).
//   ★ 실패해도 무료 열람은 그대로 진행한다. 오류로 처리하지 않는다.
async function _mergePro(yd, yearKey, setId, accessToken) {
  if (!accessToken) return false;
  try {
    const res = await fetch(
      `/api/pro-data?year=${encodeURIComponent(yearKey)}&set=${encodeURIComponent(setId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return false; // 401·402·404 모두 pro 없이 렌더
    const pro = await res.json();
    for (const section of ["reading", "literature"]) {
      const set = (yd[section] ?? []).find((s) => (s.setId ?? s.id) === setId);
      if (!set) continue;
      if (pro.vocab !== undefined) set.vocab = pro.vocab;
      for (const q of set.questions ?? []) {
        const qPro = pro.questions?.[String(q.id)];
        if (!qPro) continue;
        for (const c of q.choices ?? []) {
          const cPro = qPro.choices?.[String(c.num)];
          if (!cPro) continue;
          if (cPro.analysis !== undefined) c.analysis = cPro.analysis;
          if (cPro.cs_ids !== undefined) c.cs_ids = cPro.cs_ids;
          if (cPro.cs_spans !== undefined) c.cs_spans = cPro.cs_spans;
          if (cPro.pat !== undefined) c.pat = cPro.pat;
        }
      }
      // pro 가 얹혔으므로 형광펜 역참조를 다시 만든다.
      delete yd._csBuilt;
      return true;
    }
  } catch (e) {
    console.warn("[pro-data] 병합 실패:", e?.message);
  }
  return false;
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
//
// ★ 공개 승격 4관문 — 이 목록에 세트를 추가하기 전 통과 (발주 eg · 2026-08-13)
//   정본은 AGENTS.md 의 release_ready 4기준 절 안 공개 승격 4관문 문단이다.
//   (release_ready 4기준 = 데이터 무결 / 공개 승격 4관문 = 공개 절차. 별개다.)
//   요약: 1) 관문 --scope=release CRITICAL 0   2) 정답표 대조 0
//         3) 해설 반전 축 2종 0               4) 세트당 1문항 사람 통독
//   3)의 미처리 건수는 목록으로 적지 말고 node pipeline/quality_gate.mjs 를
//   인자 없이 실행해(전수 353세트) 두 축이 0건인지 확인한다.
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
  // 2014수능A / 2014수능B — 전량 격리 (하단 주석 참조)
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
  // 2015_6월B (6) — l20156a/b + r20156f 추가 (whole-exam, Code B §7 정합)
  "2015_6월B::l20156a",
  "2015_6월B::l20156b",
  "2015_6월B::r20156b",
  "2015_6월B::r20156c",
  "2015_6월B::r20156e",
  "2015_6월B::r20156f",
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
  // 2019_6월 (7) — release-prep 3세트 감사·정정(r20196b·e/l20196a) + 신규 3세트(l20196b·c·d) 등재 QG-2019_6월
  "2019_6월::r20196b",
  "2019_6월::r20196e",
  "2019_6월::r20196f",
  "2019_6월::l20196a",
  "2019_6월::l20196b",
  "2019_6월::l20196c",
  "2019_6월::l20196d",
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
  "2022_6월::r20226a",
  "2022_6월::r20226d",
  // 2022_9월 (6) — Phase 1 clean 출시: 3충실도 0·release_ready·setId충돌 0 QG-Phase1-2022_9월
  "2022_9월::l20229a",
  "2022_9월::l20229b",
  "2022_9월::r20229a",
  "2022_9월::r20229b",
  "2022_9월::r20229c",
  "2022_9월::r20229d",
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
  "2023_9월::l20239a",
  "2023_9월::r20239a",
  "2023_9월::r20239b",
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
  "2024_6월::l20246c",
  "2024_6월::l20246d",
  "2024_6월::r20246a",
  "2024_6월::r20246b",
  "2024_6월::r20246d",
  // 2024_9월 (1)
  "2024_9월::l20249d",
  "2024_9월::l20249b",
  "2024_9월::r20249c",
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
  "2025_6월::l20256b",
  "2025_6월::l20256c",
  "2025_6월::r20256a",
  "2025_6월::r20256d",
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

  // ── 비노출 무결세트 출시 (2026-07-21, 3게이트 전수 통과) ──
  // 2014_6월B (+2)
  "2014_6월B::l20146a",
  "2014_6월B::r20146d",
  // 2015_9월A (+1)
  "2015_9월A::r20159a",
  // 2015수능A (+1)
  "2015수능A::l2015d",
  // 2016_9월A (+1)
  "2016_9월A::l20169a",
  // 2016수능A (+2)
  "2016수능A::l2016f",
  "2016수능A::r2016c",
  // 2016수능B (+3)
  "2016수능B::l2016cB",
  "2016수능B::l2016dB",
  "2016수능B::r2016eB",
  // 2020수능 (+1)
  "2020수능::r2020g",
  // 2023_6월 (+1)
  "2023_6월::l20236c",
  // 2025_9월 (+2)
  "2025_9월::l20259b",
  "2025_9월::l20259c",
  // 2026_6월 (+3)
  "2026_6월::l20266a",
  "2026_6월::r20266c",
  "2026_6월::r20266d",
  // 2026_9월 (+1)
  "2026_9월::l20269a",
  // -- 2014수능A/B LIVE 18세트 일괄 격리 (2026-07-22) --
  //   사유 1) 동일 전사 공정 산물 = 계통 결함 (r2014e, r2014eB, r2014a 3세트 연속 확인)
  //        2) 시험지가 image-only -> passage_fidelity 원천 무효 = 무결을 입증할 수단이 없음
  //           (결함이 아직 안 나왔다 != 무결하다)
  //        3) 문단 누락은 sent 수로 안 드러나 release_ready 5번 기준도 사각
  //   재등록 = legacy 판독으로 문장 단위 무결 확인한 세트만 개별 복귀.
  //   손상 세트(r2014a 문단 누락 등)는 전문 재전사 후 복귀.
  //   2014_6월/2014_9월은 text-layer 정상 -> 격리 대상 아님 (자동 게이트 보증).

  // 2018수능 (7) — 완결 등록 2026-07-22. r2018c 마커 ⓐ~ⓔ 삽입(d2fc2ad) +
  //   Q42 해설 5선지 정비(003fd40) 후 quality_gate CRITICAL 0. 3충실도 게이트 전수 통과.
  //   표본 5선지 검수 + 본문 첫화면 육안 전수 7/7 정상(§13⑰).
  "2018수능::r2018a",
  "2018수능::r2018b",
  "2018수능::r2018c",
  "2018수능::l2018a",
  "2018수능::l2018b",
  "2018수능::l2018c",
  "2018수능::l2018d",
  // ── 웨이브 1 배치 1 (발주 F-29, 2026-08-21) ──
  //   근거: QG CRITICAL 0 + 정답표 대조 통과 + 심사관 gate3 화면 실측 통과.
  //   데이터 엔지니어의 release_approval_records 3건과 대응한다.
  "2026_6월::r20266a",
  "2026_9월::l20269c",
  "2026_9월::l20269d",
  // ── 웨이브 1 배치 1 마감 (발주 F-30, 2026-08-21) ──
  //   근거: QG CRITICAL 0 (l20266c 잔여 1건은 게이트 오탐 — 승인 기록에 판정
  //   명기) + 정답표 대조 통과 + 심사관 gate3 화면 실측 통과 + 대표 승인.
  "2026_6월::l20266c",
  "2026_6월::r20266b",
  // ── 웨이브 1 배치 2 (발주 F-31, 2026-08-21) ──
  //   근거: QG CRITICAL 0 + 정답표 대조 통과 + 심사관 gate3 화면 실측 통과
  //   + 대표 승인.
  //   ※ r20249b · r20249d 는 별도 승인 대기라 이번에 넣지 않는다.
  "2024_9월::r20249a",
  "2024_9월::l20249a",
  "2024_9월::l20249c",
  // ── 웨이브 1 배치 2 추가 (발주 F-32, 2026-08-21) ──
  //   근거: QG CRITICAL 0 + 정답표 대조 + 근거 5건 적용 + 발문 원본 복원
  //   + 심사관 gate3 실측 + 대표 승인.
  //   ※ r20249b 는 해설 재작성 중이라 넣지 않는다.
  "2024_9월::r20249d",
  // ── 웨이브 1 종결 (발주 F-33, 2026-08-21) ──
  //   근거: Q5 문항 손상 원본 복원 + 해설 2건 재작성(심사관 전문 검증)
  //   + 정답표 일치 + QG clean + 심사관 gate3 실측 + 대표 승인.
  //   이로써 2024_9월 이 8세트 전량으로 완성된다.
  "2024_9월::r20249b",
  // ── 웨이브 2 배치 1 (발주 F-34, 2026-08-21) ──
  //   근거: 진단 11축 결함 0 + 정답표 4/4 + 심사관 gate3 실측([A]~[E]
  //   5구간 렌더 확인) + 대표 승인.
  "2023_6월::l20236d",
  // ── 웨이브 2 배치 2 (발주 F-35, 2026-08-21) ──
  //   근거: QG CRITICAL 0 + 정답표 대조 + 심사관 gate3 실측 + 대표 승인.
  //   2025_6월 · 2023_9월 이 각각 8세트 전량으로 완성된다.
  //   ※ r20246c · l20236b 는 다음 승인 대기라 넣지 않는다.
  "2025_6월::r20256c",
  "2025_6월::l20256a",
  "2023_9월::r20239c",
  "2023_9월::r20239d",
  "2023_6월::r20236d",
  // ── 웨이브 2 종결 (발주 F-37, 2026-08-21) ──
  //   근거: QG CRITICAL 0 + 정답표 대조 + 심사관 gate3 실측 + 대표 승인.
  //   r20246c: F-36 크래시 해소 후 Q11 그래프 육안 대조(화산형 · ⓒ 최고 · ⓓ 최저)
  //   l20236b: Q22#4 근거 3작품 반영 확인
  //   2024_6월 · 2023_6월 이 각각 8세트 전량으로 완성된다.
  "2024_6월::r20246c",
  "2023_6월::l20236b",
  // ── 웨이브 3 배치 A (발주 F-39, 2026-08-28) ──
  //   근거: QG · 진단 11축 결함 0 + 정답표 일치 + 심사관 gate3 실측 + 대표 승인.
  //   l20226a(무사와 악사)는 블로그 인용 세트다 — 글 발행 전 노출이 선행돼야 한다.
  "2021_6월::l20216b",
  "2022_6월::l20226a",
  "2022_9월::l20229c",
  // -- 웨이브 3 배치 A 잔여 (발주 F-40, 2026-08-28) --
  //   전제: D-132 승격 기록(f133ac1) push 후 반영 -- 4관문 순서.
  //   l20219d 는 D-133(3d61ed2) 결론줄 수리·마커 해소 후 F-41 로 합류했다.
  "2021_6월::r20216a",
  "2021_6월::r20216d",
  "2021_9월::l20219d",
  "2022_6월::l20226b",
  "2022_9월::l20229d",
  // -- 웨이브 3 배치 B (발주 F-42, 2026-08-28) --
  //   전제: 승격 기록 140건 push 확인 -- 4관문 순서. l20209a 보류 해제 판정 완료.
  //   RELEASED_KEYS 에는 넣지 않는다 -- 배치 B 첫 노출이고 r2019b 가 대규모
  //   수리 세트라 「검수 중」 배너를 남긴다(배너는 열람을 막지 않는다).
  "2019수능::r2019b",
  "2019수능::l2019c",
  "2020_9월::l20209a",
  "2020_9월::l20209b",
  "2020_9월::l20209c",
  "2020_9월::l20209d",
  // -- 웨이브 3 배치 C (발주 F-45, 2026-08-28) --
  //   전제: D-175 승격 기록 143건 push 확인(2019_9월 3건 포함) -- 4관문 순서.
  //   RELEASED_KEYS 는 무변경 -- 「검수 중」 배너 유지.
  //   r20199c 는 D-177(pat L5→R1 · 결론줄 라벨) + D-178(build_split C_PRO 에
  //   _pat_error 추가, A안) 로 차단이 풀려 합류했다. 심사관 검증 완료.
  //   suggested_pat R2 는 무효 — R1 이 심사관 판정 확정값이다.
  "2019_9월::l20199a",
  "2019_9월::l20199e",
  "2019_9월::r20199c",
]);

// yearKey-aware release 검사 (동기 — composite key lookup).
//   ⚠️ 2026-06-13 sig 정정: isReleaseSet(setId) → isReleaseSet(yearKey, setId).
//   yearKey 또는 setId 누락 path → false 안전 default.
export function isReleaseSet(yearKey, setId) {
  if (!yearKey || !setId) return false;
  return RELEASE_KEYS.has(yearKey + "::" + setId);
}

// daily MVP: 출시 세트 목록 — TodayPanel "다음 미완료 세트" 판정용.
//   정렬(대표 확정): 최신 수능 우선 → 수능 → 9월 → 6월, 각 학년도 내림차순.
//   추천 알고리즘 X = 결정적 정렬만. (예: 2026수능 → 2025수능 → … → 모의)
export function getReleasedSetList() {
  const typeRank = (yk) =>
    yk.includes("수능")
      ? 3
      : yk.includes("9월")
        ? 2
        : yk.includes("6월")
          ? 1
          : 0;
  const yearOf = (yk) => {
    const m = yk.match(/^(\d{4})/);
    return m ? Number(m[1]) : 0;
  };
  const out = [];
  for (const k of RELEASE_KEYS) {
    const idx = k.indexOf("::");
    if (idx < 0) continue;
    out.push({ yearKey: k.slice(0, idx), setId: k.slice(idx + 2) });
  }
  return out.sort((a, b) => {
    const tr = typeRank(b.yearKey) - typeRank(a.yearKey);
    if (tr !== 0) return tr;
    return yearOf(b.yearKey) - yearOf(a.yearKey);
  });
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
      } else {
        // 발주 F-25 ⓑ: annotations.json 엔트리가 없는 세트에서만 살아남던
        //   통짜 파일(all_data → free/<year>.json) 내장 브래킷을 제거한다.
        //   브래킷 원천은 annotations.json 하나다.
        //   ★ box·underline·marker 등 다른 타입은 그대로 둔다(스코프는 bracket).
        //   ★ 되돌리기: 이 else 분기를 지우면 원복된다.
        set.annotations = set.annotations.filter((a) => a?.type !== "bracket");
      }
    }
  }
}

function _buildSentCs(yearData) {
  for (const sec of ["reading", "literature"]) {
    for (const set of yearData[sec] || []) {
      const sentMap = {};
      // [발주 fp-B] 정적 cs 필드 무시 — 형광펜 소스를 cs_ids · cs_spans 로 단일화한다.
      //   all_data_204.json 의 sents[].cs 에는 구세대 일괄 부여 잔재가 남아 있어
      //   한 문장에 그 문항의 선지 키가 통째로 들어간다(l2026bs2 = q22_c1~q24_c5 15개).
      //   그 결과 어느 선지를 눌러도 (가) 18행이 켜졌다. cs_ids 를 8→2 로 줄여도 그대로였다.
      //   ★ 원본 데이터는 수정하지 않는다. 로딩 시점에만 비운다.
      //   ★ 롤백: 이 한 줄(s.cs = [])을 제거하면 즉시 원복된다.
      for (const s of set.sents) (s.cs = []), (sentMap[s.id] = s);
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
// 발주 F-20 커밋1: 세트 단위 lazy pro 병합.
//   pro 를 "연도 1회"가 아니라 "세트 이동마다" 받는다. 성공 시 형광펜 역참조를
//   다시 만들고 true 를 돌려준다(호출부가 리렌더 트리거에 쓴다).
//   ★ 플래그 false 면 아무 것도 하지 않는다 — 동작 무변화.
export async function attachProToSet(yearData, yearKey, setId, accessToken) {
  if (!USE_SPLIT_DATA) return false;
  if (!yearData || !yearKey || !setId || !accessToken) return false;
  const merged = await _mergePro(yearData, yearKey, setId, accessToken);
  if (!merged) return false;
  _buildSentCs(yearData);
  yearData._csBuilt = true;
  return true;
}

export async function loadYear(yearKey, options = {}) {
  const { bypassFilter = false, setId = null, accessToken = null } = options;
  // 발주 F-22: 마스터·검증자(bypassFilter)는 비노출 세트까지 봐야 한다.
  //   free/ 에는 LIVE 세트만 담기므로 split 경로로는 구조적으로 볼 수 없다
  //   (예: 2016_6월B 문학 — free 1세트 / 통짜 5세트).
  //   bypassFilter 일 때만 통짜 파일로 폴백한다. 일반 사용자 경로는 무접촉이고,
  //   통짜 파일에는 해설·형광펜이 이미 들어 있으므로 pro 병합도 불필요하다.
  const useSplit = USE_SPLIT_DATA && !bypassFilter;
  // 발주 F-20: split 경로에서는 무료 트리를 먼저 얹고, 세트 단위로 유료 조각을
  //   덧댄다. 플래그 false 면 아래 한 줄은 실행되지 않으므로 동작이 동일하다.
  const data = useSplit
    ? { [yearKey]: await _loadFreeYear(yearKey) }
    : await _load();
  if (!data[yearKey]) throw new Error(`연도 데이터 없음: ${yearKey}`);
  const yd = data[yearKey];
  if (useSplit && setId) {
    await _mergePro(yd, yearKey, setId, accessToken);
  }
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
  // 발주 F-20: split 경로에서는 인덱스만으로 목록을 만든다(연도 파일 미수신).
  // 발주 F-22: bypassFilter(마스터·검증자)는 index 에 없는 비노출 연도까지
  //   봐야 하므로 아래 split 분기를 타지 않고 통짜 파일 경로로 내려간다.
  if (USE_SPLIT_DATA && !bypassFilter) {
    const idx = await _loadIndex();
    const years = idx.years ?? [];
    return years
      .filter((y) =>
        (y.sets ?? []).some((s) => isReleaseSet(y.yearKey, s.id)),
      )
      .map((y) => y.yearKey);
  }
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

/**
 * 세트 → 영역(독서/문학) 단일 조회 (발주 fg-1B · B-1)
 *
 * 소스는 reading[] / literature[] 배열 소속이다. App.jsx:1280-1281 의 _sec 와 같은 기준이며
 * 같은 결과를 낸다. 영역을 판별해야 하는 모든 지점은 이 함수를 쓴다.
 *
 * ★ setId 접두(r/l)로 판별하지 않는다. 접두와 배열이 어긋난 세트가 6건 있다(발주 fg-1 실측):
 *     reading  에 있는데 l 접두 — l20169a(LIVE) · l2015aB · l2016a
 *     literature 에 있는데 r 접두 — r20169g(LIVE) · r2016fB · r2019b
 *   setId 는 기존 답변·오답노트·통계 연결 보존을 위해 개명하지 않는다(영구 금지).
 *
 * ★ setId 는 회차 간 충돌한다(예: l20146a 가 2014_6월A·B 양쪽에 존재). yearKey 를 반드시 함께 넘긴다.
 *
 * @returns {"reading"|"literature"|null} 못 찾으면 null.
 *   ★ 호출부는 접두사 판별로 폴백하지 말 것. 미분류로 집계한다(발주 fg-1B · B-3).
 */
export function sectionOfSet(yearKey, setId, data = _cache) {
  const yd = data?.[yearKey];
  if (!yd || !setId) return null;
  if ((yd.reading ?? []).some((s) => s.id === setId)) return "reading";
  if ((yd.literature ?? []).some((s) => s.id === setId)) return "literature";
  return null;
}

export async function loadAllData() {
  return await _load();
}

export default {
  loadYear,
  getYearKeys,
  getAllYearKeys,
  getYearSync,
  sectionOfSet,
  loadAllData,
  isReleaseSet,
  isReleaseSetAsync,
  getReleaseStats,
};
