import { beforeEach, expect, it } from 'vitest';
import { freshLeft, takeFresh } from './fresh';

beforeEach(() => localStorage.clear());
const pool = Array.from({ length: 10 }, (_, i) => `w${i}`);
const id = (x: string) => x;

it('never repeats until the whole pool has been played', () => {
  const a = takeFresh('t', pool, 4, id);
  const b = takeFresh('t', pool, 4, id);
  expect(new Set([...a, ...b]).size).toBe(8);
  expect(freshLeft('t', pool, id)).toBe(2);
  const c = takeFresh('t', pool, 4, id); // 2 left + 2 from a new cycle
  expect(c.length).toBe(4);
  expect(c.filter((x) => !a.includes(x) && !b.includes(x)).length).toBe(2);
  expect(new Set(c).size).toBe(4);
});

it('keeps games apart', () => {
  takeFresh('one', pool, 10, id);
  expect(freshLeft('two', pool, id)).toBe(10);
});
