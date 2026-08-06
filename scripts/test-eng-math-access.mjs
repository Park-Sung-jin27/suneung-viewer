import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  engMathAuthUrl,
  normalizeEngMathReturnTo,
  resolveEngMathPackAccess,
} from "../src/engMathAccess.js";
import {
  buildEngMathEventBody,
  ENG_MATH_EVENTS,
} from "../src/engMathTracking.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, `file:///${root.replaceAll("\\", "/")}/`), "utf8");

assert.equal(normalizeEngMathReturnTo("/eng-math-beta"), "/eng-math-beta");
assert.equal(
  normalizeEngMathReturnTo(
    "/eng-math/practice?subject=math&mode=session&pack=math-01",
  ),
  "/eng-math/practice?subject=math&mode=session&pack=math-01",
);
for (const unsafeReturn of [
  "//outside.example/eng-math-beta",
  "https://outside.example/eng-math-beta",
  "/payment",
  "/viewer?year=2026",
  "javascript:alert(1)",
]) {
  assert.equal(normalizeEngMathReturnTo(unsafeReturn), "");
}
assert.equal(
  engMathAuthUrl("/eng-math/practice?subject=english&mode=catalog"),
  "/auth?returnTo=%2Feng-math%2Fpractice%3Fsubject%3Denglish%26mode%3Dcatalog",
);
assert.equal(engMathAuthUrl("https://outside.example"), "/auth?returnTo=%2Feng-math-beta");

assert.equal(resolveEngMathPackAccess("free"), "free");
for (const value of ["locked", "pro", "paid", true, null, undefined]) {
  assert.equal(resolveEngMathPackAccess(value), "locked");
}

const eventBody = buildEngMathEventBody("eng_math_locked_view", {
  subject: "english",
  target: "english-2026_09-01",
  email: "must-not-be-sent@example.com",
  contact: "010-0000-0000",
  path: "/eng-math/practice?subject=english&pack=english-2026_09-01&email=must-not-be-sent%40example.com&paymentKey=secret",
});
assert.deepEqual(eventBody, {
  event: "eng_math_locked_view",
  source: "eng_math_english",
  target: "english-2026_09-01",
  path: "/eng-math/practice?subject=english&pack=english-2026_09-01",
});
assert.equal(JSON.stringify(eventBody).includes("must-not-be-sent"), false);
assert.equal(
  buildEngMathEventBody("eng_math_login_start", {
    target: "student@example.com",
    path: "/eng-math-beta",
  }).target,
  "",
);
assert.equal(buildEngMathEventBody("payment_start", {}), null);

const growthStoreSource = readSource("api/_growthStore.js");
for (const event of ENG_MATH_EVENTS) {
  assert.match(growthStoreSource, new RegExp(`"${event}"`));
}

const appSource = readSource("src/App.jsx");
assert.match(
  appSource,
  /<EngMathProductHome user=\{user\} onLogout=\{handleEngMathLogout\} \/>/,
);
assert.match(appSource, /<EngMathPractice user=\{user\} \/>/);
assert.match(appSource, /ENG_MATH_AUTH_RETURN_KEY/);
assert.doesNotMatch(appSource, /<EngMathPractice[^>]*isPro/);

const practiceSource = readSource("src/EngMathPractice.jsx");
assert.match(practiceSource, /resolveEngMathPackAccess/);
assert.match(practiceSource, /<EngMathLockedAccess/);
assert.doesNotMatch(practiceSource, /<EngMathLockedAccess[^>]*isPro/);

const lockedAccessSource = readSource("src/EngMathLockedAccess.jsx");
assert.match(lockedAccessSource, /판매 준비 중/);
assert.match(lockedAccessSource, /로그인만으로 잠금이\s*해제되지는 않습니다/);
assert.match(lockedAccessSource, /\/api\/waitlist/);
assert.doesNotMatch(lockedAccessSource, /\/payment/);

const homeSource = readSource("src/EngMathProductHome.jsx");
assert.match(homeSource, /출시 알림만 신청/);
assert.match(homeSource, /로그인만으로 잠금이 해제되지는 않습니다/);

console.log(
  `ENG_MATH_ACCESS: pass events=${ENG_MATH_EVENTS.length} access=free-only authReturn=eng-math-only`,
);
