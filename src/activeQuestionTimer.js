function validNow(now) {
  if (!Number.isFinite(now)) throw new Error("ACTIVE_TIMER_NOW");
  return now;
}

export function createActiveQuestionTimer() {
  let elapsedMs = 0;
  let activeSince = null;

  return {
    resume(now = Date.now()) {
      const current = validNow(now);
      if (activeSince === null) activeSince = current;
    },
    pause(now = Date.now()) {
      const current = validNow(now);
      if (activeSince !== null) {
        elapsedMs += Math.max(0, current - activeSince);
        activeSince = null;
      }
      return elapsedMs;
    },
    reset({ now = Date.now(), active = false } = {}) {
      elapsedMs = 0;
      activeSince = active ? validNow(now) : null;
    },
    elapsed(now = Date.now()) {
      const current = validNow(now);
      return (
        elapsedMs +
        (activeSince === null ? 0 : Math.max(0, current - activeSince))
      );
    },
  };
}
