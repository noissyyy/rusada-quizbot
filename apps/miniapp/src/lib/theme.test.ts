import { afterEach, describe, expect, it } from 'vitest';
import { currentTheme, getThemePref, setThemePref } from './theme';

describe('theme preference', () => {
  afterEach(() => setThemePref('auto'));

  it('defaults to following Telegram / the phone', () => {
    expect(getThemePref()).toBe('auto');
  });

  it('applies and remembers an explicit choice', () => {
    setThemePref('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(getThemePref()).toBe('dark');
    expect(currentTheme()).toBe('dark');
    setThemePref('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
