import { supabase } from "./supabase";

// 뷰어 오류 신고 (발주 F-21)
//   Supabase public.issue_reports INSERT.
//   RLS: anon/authenticated insert 허용, select 정책 없음(아무도 못 읽음).
//   비로그인도 신고 가능 — user_id 는 null 로 들어간다.

const COOLDOWN_KEY = "jippi_issue_report_v1";
const WINDOW_MS = 10 * 60 * 1000; // 10분
const WINDOW_MAX = 5; // 10분 5건
export const MAX_BODY = 300;

export const REPORT_TYPES = [
  { value: "no_image", label: "이미지 없음" },
  { value: "bad_analysis", label: "해설 이상" },
  { value: "typo", label: "오탈자" },
  { value: "etc", label: "기타" },
];

function readState() {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    const s = raw ? JSON.parse(raw) : null;
    return {
      done: s?.done && typeof s.done === "object" ? s.done : {},
      recent: Array.isArray(s?.recent) ? s.recent : [],
    };
  } catch {
    return { done: {}, recent: [] }; // 손상·차단 시 신고를 막지 않는다
  }
}

function writeState(s) {
  try {
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(s));
  } catch {
    /* 저장 실패는 무시 — 신고 자체는 이미 성공했다 */
  }
}

export function reportKey(yearKey, setId, questionId) {
  return `${yearKey}::${setId}::${questionId ?? "-"}`;
}

// 신고 가능 여부. 막을 때만 사유 문자열을 돌려준다.
export function checkCooldown(yearKey, setId, questionId, now = Date.now()) {
  const s = readState();
  if (s.done[reportKey(yearKey, setId, questionId)]) {
    return "이 문항은 이미 신고하셨어요. 감사합니다.";
  }
  const recent = s.recent.filter((t) => now - t < WINDOW_MS);
  if (recent.length >= WINDOW_MAX) {
    return "잠시 후 다시 시도해 주세요. (10분에 5건까지)";
  }
  return null;
}

function markSent(yearKey, setId, questionId, now = Date.now()) {
  const s = readState();
  s.done[reportKey(yearKey, setId, questionId)] = now;
  s.recent = [...s.recent.filter((t) => now - t < WINDOW_MS), now];
  writeState(s);
}

// 성공 시 { ok: true }, 실패 시 { ok: false, message }
export async function saveIssueReport({
  user,
  yearKey,
  setId,
  questionId,
  isPro,
  reportType,
  body,
}) {
  const text = String(body ?? "")
    .trim()
    .slice(0, MAX_BODY);
  if (!text) return { ok: false, message: "내용을 한 줄 적어 주세요." };

  const blocked = checkCooldown(yearKey, setId, questionId);
  if (blocked) return { ok: false, message: blocked };

  const row = {
    user_id: user?.id ?? null,
    year_key: yearKey,
    set_id: setId,
    question_id: questionId != null ? String(questionId) : null,
    is_pro: !!isPro,
    report_type: reportType,
    body: text,
    path:
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`.slice(0, 300)
        : null,
  };

  const { error } = await supabase.from("issue_reports").insert(row);
  if (error) {
    console.warn("[saveIssueReport] 실패:", error.message);
    return { ok: false, message: "전송에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }

  markSent(yearKey, setId, questionId);
  notify(row); // 웹훅 실패는 신고 저장을 막지 않는다 (발주 F-21 ②)
  return { ok: true };
}

// Discord 알림은 서버 경유 — 웹훅 URL 은 서버 환경변수라 브라우저에 두지 않는다.
//   (번들에 넣으면 누구나 우리 채널로 스팸을 보낼 수 있다.)
function notify(row) {
  try {
    fetch("/api/report-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* 알림 실패는 삼킨다 */
  }
}
