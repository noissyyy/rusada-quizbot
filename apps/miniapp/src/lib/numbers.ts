/** 118 → 100, 3 549 → 3 000, 10 432 → 10 000: a round number that never overstates the real count. */
export function roundDown(n: number): number {
  if (n < 10) return n;
  const step = n < 100 ? 10 : n < 1000 ? 100 : 1000;
  return Math.floor(n / step) * step;
}

/** 3000 → «3 000» (thin spaces like in Russian/Uzbek). */
export const groupDigits = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ');
