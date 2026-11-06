import { describe, expect, it } from 'vitest';
import { SEARCH_THEMES } from './gameContent';
import { buildGrid, lineBetween } from './wordGrid';

describe('word search grid', () => {
  it('places every word of every theme on its cells', () => {
    for (const th of SEARCH_THEMES) {
      const { grid, placed } = buildGrid(th.words);
      expect(placed).toHaveLength(th.words.length);
      for (const p of placed) expect(p.cells.map((c) => grid[c]).join('')).toBe(p.word);
      expect(grid).toHaveLength(64);
    }
  });
  it('accepts straight lines only', () => {
    expect(lineBetween(0, 3)).toEqual([0, 1, 2, 3]);
    expect(lineBetween(0, 27)).toEqual([0, 9, 18, 27]);
    expect(lineBetween(0, 10)).toBeNull();
  });
});
