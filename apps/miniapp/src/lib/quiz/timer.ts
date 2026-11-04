/**
 * One countdown for the whole test, with pause support (paused while the
 * answer and explanation are shown). Pure functions — time is passed in, so
 * the logic is testable and the server can mirror it exactly.
 * In production the server stores the deadline; this is the client's display copy.
 */
export interface TestTimer {
  remainingMs: number;
  /** epoch ms when the timer last started running; null while paused */
  runningSince: number | null;
}

export const createTimer = (durationSec: number, now: number): TestTimer => ({ remainingMs: durationSec * 1000, runningSince: now });

export function remainingMs(t: TestTimer, now: number): number {
  return t.runningSince === null ? t.remainingMs : Math.max(0, t.remainingMs - (now - t.runningSince));
}

export function pause(t: TestTimer, now: number): TestTimer {
  return t.runningSince === null ? t : { remainingMs: remainingMs(t, now), runningSince: null };
}

export function resume(t: TestTimer, now: number): TestTimer {
  return t.runningSince !== null ? t : { ...t, runningSince: now };
}

export const isExpired = (t: TestTimer, now: number) => remainingMs(t, now) <= 0;

/** m:ss, rounded up so the display never shows 0:00 while time is left */
export function formatClock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Feedback interval: 5 s with an explanation, 3 s without (admin-configurable later). */
export const feedbackMs = (hasExplanation: boolean) => (hasExplanation ? 5000 : 3000);
export const LOW_TIME_MS = 30_000;
