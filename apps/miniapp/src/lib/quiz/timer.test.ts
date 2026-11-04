import { describe, expect, it } from 'vitest';
import { createTimer, formatClock, isExpired, pause, remainingMs, resume } from './timer';

describe('test timer', () => {
  it('counts down from the whole-test duration', () => {
    const t = createTimer(120, 1000);
    expect(remainingMs(t, 1000)).toBe(120_000);
    expect(remainingMs(t, 31_000)).toBe(90_000);
  });

  it('does not lose time while paused (answer feedback)', () => {
    let t = createTimer(120, 0);
    t = pause(t, 10_000);                 // 110 s left, feedback starts
    expect(remainingMs(t, 15_000)).toBe(110_000); // 5 s of feedback cost nothing
    t = resume(t, 15_000);
    expect(remainingMs(t, 25_000)).toBe(100_000);
  });

  it('pause/resume are idempotent', () => {
    let t = createTimer(60, 0);
    t = pause(pause(t, 1000), 2000);
    expect(remainingMs(t, 9999)).toBe(59_000);
    t = resume(resume(t, 3000), 4000);
    expect(remainingMs(t, 4000)).toBe(58_000);
  });

  it('expires at zero and never goes negative', () => {
    const t = createTimer(2, 0);
    expect(isExpired(t, 1999)).toBe(false);
    expect(isExpired(t, 2000)).toBe(true);
    expect(remainingMs(t, 5000)).toBe(0);
  });

  it('formats m:ss rounding up', () => {
    expect(formatClock(112_000)).toBe('1:52');
    expect(formatClock(500)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
  });
});
