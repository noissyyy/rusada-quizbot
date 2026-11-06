/** Builds a word-search grid: words go right, down or diagonally down-right; the rest is random letters. */
const ALPHABET = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЫЭЮЯ';
const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1]];

export interface Placed { word: string; cells: number[] }

export function buildGrid(words: string[], size = 8, rnd = Math.random): { grid: string[]; placed: Placed[] } {
  for (let attempt = 0; attempt < 50; attempt++) {
    const grid: (string | null)[] = Array(size * size).fill(null);
    const placed: Placed[] = [];
    let ok = true;
    for (const w of [...words].sort((a, b) => b.length - a.length)) {
      let done = false;
      for (let tries = 0; tries < 200 && !done; tries++) {
        const [dr, dc] = DIRS[Math.floor(rnd() * DIRS.length)]!;
        const r0 = Math.floor(rnd() * (size - dr * (w.length - 1)));
        const c0 = Math.floor(rnd() * (size - dc * (w.length - 1)));
        if (r0 < 0 || c0 < 0) continue;
        const cells = [...w].map((_, i) => (r0 + dr * i) * size + (c0 + dc * i));
        if (cells.every((cell, i) => grid[cell] === null || grid[cell] === w[i])) {
          cells.forEach((cell, i) => { grid[cell] = w[i]!; });
          placed.push({ word: w, cells });
          done = true;
        }
      }
      if (!done) { ok = false; break; }
    }
    if (ok) return { grid: grid.map((ch) => ch ?? ALPHABET[Math.floor(rnd() * ALPHABET.length)]!), placed };
  }
  throw new Error('could not place the words');
}

/** Cells on the straight line from a to b (row, column or diagonal), or null. */
export function lineBetween(a: number, b: number, size = 8): number[] | null {
  const [r1, c1, r2, c2] = [Math.floor(a / size), a % size, Math.floor(b / size), b % size];
  const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
  const len = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1));
  if (!(r1 === r2 || c1 === c2 || Math.abs(r2 - r1) === Math.abs(c2 - c1))) return null;
  return Array.from({ length: len + 1 }, (_, i) => (r1 + dr * i) * size + (c1 + dc * i));
}
