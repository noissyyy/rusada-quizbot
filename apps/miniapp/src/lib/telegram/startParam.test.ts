import { describe, expect, it } from 'vitest';
import { routeForStart } from './webapp';

describe('Telegram start links', () => {
  it('open the right screen', () => {
    expect(routeForStart('d_abc123')).toBe('/duel/abc123');
    expect(routeForStart('word')).toBe('/games/word');
    expect(routeForStart('w_abc123')).toBe('/games/lastword/abc123');
    expect(routeForStart('g_x1')).toBe('/group/x1');
    expect(routeForStart('d_../evil')).toBeNull();
  });
});
