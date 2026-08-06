export const ENG_MATH_EVENTS = Object.freeze([
  "eng_math_locked_view",
  "eng_math_login_start",
  "eng_math_waitlist_submit",
  "eng_math_waitlist_success",
]);

const EVENT_SET = new Set(ENG_MATH_EVENTS);
const onceKeys = new Set();

function cleanText(value, limit) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, limit);
}

function cleanSubject(value) {
  return value === "math" ? "math" : value === "english" ? "english" : "";
}

function cleanTarget(value) {
  const target = cleanText(value, 64);
  return /^[A-Za-z0-9_-]*$/.test(target) ? target : "";
}

function cleanPath(value) {
  const raw = cleanText(value, 320);
  if (!raw) return "";

  try {
    const url = new URL(raw, "https://eng-math.local");
    if (url.origin !== "https://eng-math.local") return "";
    if (!["/eng-math-beta", "/eng-math/practice"].includes(url.pathname)) {
      return "";
    }
    const sensitiveKeys = new Set([
      "token",
      "paymentkey",
      "orderid",
      "deliverytoken",
      "email",
      "contact",
      "name",
      "phone",
    ]);
    for (const key of [...url.searchParams.keys()]) {
      if (sensitiveKeys.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    return `${url.pathname}${url.search}`.slice(0, 180);
  } catch {
    return "";
  }
}

export function buildEngMathEventBody(event, details = {}) {
  if (!EVENT_SET.has(event)) return null;
  const subject = cleanSubject(details.subject);
  const target = cleanTarget(details.target);
  const path = cleanPath(details.path);

  return {
    event,
    source: subject ? `eng_math_${subject}` : "eng_math_beta",
    target,
    path,
  };
}

export function trackEngMathEvent(event, details = {}) {
  const body = buildEngMathEventBody(event, details);
  if (!body || typeof window === "undefined") return false;

  void fetch("/api/inyeon-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
  return true;
}

export function trackEngMathEventOnce(event, details = {}) {
  const body = buildEngMathEventBody(event, details);
  if (!body) return false;
  const key = `${body.event}:${body.source}:${body.target}:${body.path}`;
  if (onceKeys.has(key)) return false;
  onceKeys.add(key);
  return trackEngMathEvent(event, details);
}
