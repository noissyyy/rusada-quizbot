import { getWebApp } from './telegram/webapp';

export type Theme = 'light' | 'dark';
const CANVAS: Record<Theme, string> = { light: '#F6F5FA', dark: '#0F0D17' };

/** Telegram's theme inside Telegram; the phone's setting in a plain browser. `?theme=dark|light` forces one (design review). */
export function currentTheme(): Theme {
  const forced = new URLSearchParams(location.search).get('theme');
  if (forced === 'dark' || forced === 'light') return forced;
  const wa = getWebApp();
  if (wa) return wa.colorScheme === 'dark' ? 'dark' : 'light';
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CANVAS[theme]);
  const wa = getWebApp();
  if (wa?.isVersionAtLeast('6.1')) {
    wa.setHeaderColor(CANVAS[theme]);
    wa.setBackgroundColor(CANVAS[theme]);
  }
  if (wa?.isVersionAtLeast('7.10')) wa.setBottomBarColor?.(CANVAS[theme]);
}

/** Call once on boot: applies the theme and follows changes (Telegram «Night mode», phone dark mode). */
export function initTheme() {
  const forced = new URLSearchParams(location.search).get('theme');
  apply(currentTheme());
  if (forced) return;
  const update = () => apply(currentTheme());
  getWebApp()?.onEvent('themeChanged', update);
  if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', update);
}
