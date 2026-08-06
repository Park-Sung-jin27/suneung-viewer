export const ENG_MATH_AUTH_RETURN_KEY = "eng_math_auth_return_v1";

const ENG_MATH_RETURN_PATHS = new Set([
  "/eng-math-beta",
  "/eng-math/practice",
]);

export function normalizeEngMathReturnTo(value) {
  if (typeof value !== "string") return "";
  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "";

  try {
    const url = new URL(candidate, "https://eng-math.local");
    if (url.origin !== "https://eng-math.local") return "";
    if (!ENG_MATH_RETURN_PATHS.has(url.pathname)) return "";
    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

export function engMathAuthUrl(returnTo = "/eng-math-beta") {
  const safeReturnTo =
    normalizeEngMathReturnTo(returnTo) || "/eng-math-beta";
  return `/auth?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function resolveEngMathPackAccess(value) {
  return value === "free" ? "free" : "locked";
}
