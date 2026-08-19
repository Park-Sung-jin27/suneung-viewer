// middleware.js — 데이터 자산 1단계 보호 (발주 F-8 · A+E)
//
// 목적: /data/* 정적 JSON(해설·형광펜 매핑)의 자동 수집과 주소창 직접 열람을 막는다.
//   ★ 데이터 로딩 경로(dataLoader.js 등)는 건드리지 않는다. 요청 앞단에서만 판정한다.
//   ★ 실패 시 되돌리기: 이 파일을 삭제하거나 ALLOW_ALL 을 true 로 두면 즉시 원상 복구된다.
//
// 판정 기준 (비로그인 무료 체험을 절대 막지 않기 위해 "허용 우선"으로 설계)
//   허용 : 같은 오리진에서 앱이 보낸 fetch (Sec-Fetch-Site: same-origin | same-site)
//   허용 : Referer 가 우리 호스트인 요청 (구형 브라우저 · Sec-Fetch-* 미지원 대비)
//   차단 : 주소창 직접 진입 (Sec-Fetch-Dest: document → 사람이 URL 을 연 것)
//   차단 : Sec-Fetch-* 도 Referer 도 없는 요청 (curl · wget · 스크래퍼)
//   차단 : 짧은 시간에 과다 요청 (best-effort rate limit)
//
// ※ 로그인 여부는 보지 않는다. JWT 필수화(B안)는 비로그인 체험을 죽이므로 기각됐다.
import { next } from "@vercel/edge";

export const config = {
  // /data 이하 전체 — all_data_204.json · annotations.json · visual_marks.json
  //   · eng-math/*.json 6개 파일이 모두 여기에 포함된다.
  matcher: "/data/:path*",
};

// 비상 스위치: true 로 바꾸면 모든 검사를 건너뛴다 (되돌리기용)
const ALLOW_ALL = false;

// best-effort rate limit — Edge 인스턴스별 메모리라 전역 정확도는 없다.
//   목적은 "대량 자동 수집 완화"이지 정밀 제한이 아니다.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const hits = new Map();

function rateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    if (hits.size > 5000) hits.clear(); // 메모리 방어
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}

function deny(reason) {
  return new Response(
    JSON.stringify({ error: "Not available", reason }),
    {
      status: 403,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

export default function middleware(request) {
  if (ALLOW_ALL) return next();

  const url = new URL(request.url);
  const host = url.host;
  const site = request.headers.get("sec-fetch-site");
  const dest = request.headers.get("sec-fetch-dest");
  const referer = request.headers.get("referer") || "";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

  // ① 주소창 직접 열람 — 사람이 URL 을 붙여넣은 경우
  if (dest === "document") return deny("direct");

  // ② 앱 내부 fetch — 허용 (비로그인 체험 포함)
  if (site === "same-origin" || site === "same-site") {
    return rateLimited(ip) ? deny("rate") : next();
  }

  // ③ Sec-Fetch-* 미지원 브라우저 대비 — Referer 가 우리 호스트면 허용
  if (referer) {
    try {
      if (new URL(referer).host === host) {
        return rateLimited(ip) ? deny("rate") : next();
      }
    } catch {
      /* 파싱 불가 referer 는 아래 차단으로 흐른다 */
    }
    return deny("cross-site");
  }

  // ④ Sec-Fetch-* 도 Referer 도 없음 — curl · wget · 스크래퍼
  return deny("no-context");
}
