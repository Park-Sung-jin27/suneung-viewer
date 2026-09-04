// api/master-data.js — 마스터 검수용 원본 조회 (발주 F-60 ⓑ)
//
//   GET /api/master-data?list=1        → { yearKeys: [...] }        회차 목록만
//   GET /api/master-data?year=<yearKey> → { yearKey, ...yearData }   그 회차만
//   GET /api/master-data?set=<setId>    → { matches: [...] }         그 세트만
//   Authorization: Bearer <supabase access_token>
//
//   ★ 비노출 세트는 이 경로로만 나간다. free/ 에도 data-pro/ 에도 없다
//     (build_split 이 LIVE 만 만든다).
//
//   🔴 전량 반환 금지(발주 ⓑ). 회차 하나 · 세트 하나 · 키 목록만 준다.
//     통짜 10.4MB 를 서빙하지 않는다 — 그게 이 발주가 없애려는 것이다.
//
//   ★ 인증은 로그인 + isAllowlisted(email) 두 겹이다. 로그인만으로는 부족하다 —
//     이 경로로 나가는 것이 「학생에게 아직 공개하지 않은 지문」이다.
//     정본은 src/constants.js 의 MASTER_ALLOWLIST 하나다. 복제하지 않는다.

import { loadSource, authenticate, isSafeSegment } from "./_sourceData.js";
import { isAllowlisted } from "../src/constants.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  // 검수용 비공개 자산이다. 색인되지 않게 한다.
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
    // 마스터가 아니면 존재 여부도 알리지 않는다.
    if (!isAllowlisted(auth.user.email)) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const source = loadSource();
    if (!source) return res.status(500).json({ ok: false, error: "SOURCE_MISSING" });

    // ① 회차 목록 — 데이터가 아니라 키 목록이다.
    if (req.query?.list) {
      return res.status(200).json({ ok: true, yearKeys: Object.keys(source) });
    }

    // ② 회차 하나
    const year = req.query?.year;
    if (year !== undefined) {
      if (!isSafeSegment(year)) {
        return res.status(400).json({ ok: false, error: "INVALID_TARGET" });
      }
      const yearData = source[year];
      if (!yearData) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(200).json({ ok: true, yearKey: year, ...yearData });
    }

    // ③ 세트 하나 — /audit/:setId 는 회차를 모른 채 들어온다.
    //   setId 는 회차 간 충돌하므로(2014~2016 A/B형) 여러 건이 나올 수 있다.
    //   판정은 화면이 한다. 여기서는 일치하는 것만 돌려준다.
    const setId = req.query?.set;
    if (setId !== undefined) {
      if (!isSafeSegment(setId)) {
        return res.status(400).json({ ok: false, error: "INVALID_TARGET" });
      }
      const matches = [];
      for (const [yearKey, yearData] of Object.entries(source)) {
        for (const area of ["reading", "literature"]) {
          const found = (yearData[area] ?? []).find((s) => s.id === setId);
          if (found) matches.push({ yearKey, area, set: found });
        }
      }
      return res.status(200).json({ ok: true, matches });
    }

    return res.status(400).json({ ok: false, error: "MISSING_TARGET" });
  } catch (e) {
    console.error("[/api/master-data]", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
