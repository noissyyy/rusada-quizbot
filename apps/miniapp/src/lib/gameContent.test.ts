import { describe, expect, it } from 'vitest';
import { GRAMMAR_MODES, MORPH_WORDS } from './gameContent';

describe('game content', () => {
  it('every morpheme word has exactly one root and at least two parts', () => {
    for (const w of MORPH_WORDS) {
      expect(w.length).toBeGreaterThan(1);
      expect(w.filter(([, k]) => k === 'r')).toHaveLength(1);
    }
  });
  it('grammar words point at existing groups and are not repeated', () => {
    for (const m of GRAMMAR_MODES) {
      const ids = new Set(m.groups.map((g) => g.id));
      for (const [, g] of m.words) expect(ids.has(g)).toBe(true);
      expect(new Set(m.words.map(([w]) => w)).size).toBe(m.words.length);
    }
  });
});
