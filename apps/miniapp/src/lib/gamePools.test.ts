import { describe, expect, it } from 'vitest';
import grammarRaw from '../../public/games/grammar.json?raw';
import memoryRaw from '../../public/games/memory.json?raw';
import nounsRaw from '../../public/games/nouns.json?raw';
import searchRaw from '../../public/games/search.json?raw';
import { GRAMMAR_MODES } from './gameContent';
import { buildGrid } from './wordGrid';

const RAW: Record<string, string> = { grammar: grammarRaw, memory: memoryRaw, nouns: nounsRaw, search: searchRaw };
const pool = <T,>(name: string): T => JSON.parse(RAW[name]!) as T;

describe('big game pools', () => {
  it('grammar: thousands of words, every answer is one of the mode’s groups, no word twice', () => {
    const g = pool<Record<string, [string, string][]>>('grammar');
    for (const m of GRAMMAR_MODES) {
      const words = g[m.id]!;
      expect(words.length).toBeGreaterThan(m.id === 'pos' ? 3000 : 1500);
      const ids = new Set(m.groups.map((x) => x.id));
      for (const [w, grp] of words) { expect(ids.has(grp), `${m.id}: ${w} → ${grp}`).toBe(true); expect(w).toMatch(/^[а-яё-]+$/); }
      expect(new Set(words.map(([w]) => w)).size).toBe(words.length);
    }
  });

  it('word search: 30+ themes; any 8 words of a theme fit on the 8×8 grid most of the time', () => {
    const themes = pool<{ id: string; words: string[] }[]>('search');
    expect(themes.length).toBeGreaterThanOrEqual(30);
    let fails = 0;
    for (const th of themes) {
      expect(th.words.length).toBeGreaterThanOrEqual(16);
      for (const w of th.words) expect(w).toMatch(/^[А-ЯЁ]{2,8}$/);
      for (let i = 0; i < 20; i++) {
        const pick = [...th.words].sort(() => Math.random() - 0.5).slice(0, 8);
        try { buildGrid(pick); } catch { fails++; }
      }
    }
    expect(fails / (themes.length * 20)).toBeLessThan(0.1); // the rare miss drops one long word
  });

  it('memory: three modes with one right partner per card', () => {
    const m = pool<Record<string, [string, string][]>>('memory');
    for (const mode of ['emoji', 'uz', 'antonyms']) {
      const pairs = m[mode]!;
      expect(pairs.length).toBeGreaterThan(100);
      const faces = pairs.flat();
      expect(new Set(faces).size, mode).toBe(faces.length);
    }
  });

  it('word attack: thousands of plain nouns', () => {
    const n = pool<string[]>('nouns');
    expect(n.length).toBeGreaterThan(3000);
    for (const w of n) expect(w).toMatch(/^[а-я]{3,8}$/);
  });
});
