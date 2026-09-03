import assert from "node:assert/strict";
import { createActiveQuestionTimer } from "../src/activeQuestionTimer.js";

const timer = createActiveQuestionTimer();
timer.resume(1000);
assert.equal(timer.elapsed(2500), 1500);
assert.equal(timer.pause(3000), 2000);
assert.equal(timer.elapsed(9000), 2000);
timer.resume(10000);
assert.equal(timer.pause(12500), 4500);

timer.reset({ now: 20000, active: true });
assert.equal(timer.elapsed(21250), 1250);
assert.equal(timer.pause(22000), 2000);

timer.reset();
assert.equal(timer.elapsed(50000), 0);
assert.throws(() => timer.resume(Number.NaN), /ACTIVE_TIMER_NOW/);

console.log("active question timer tests: PASS");
