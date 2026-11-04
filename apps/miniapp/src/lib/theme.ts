import { getWebApp } from './telegram/webapp';

export type Theme = 'light' | 'dark';
/** What the user picked in Profile: follow Telegram, or always light / always dark. */
export type ThemePref = 'auto' | Theme;
const CANVAS: Record<Theme, string> = { light: '#F6F5FA', dark: '#0F0D17' };
const KEY = 'rq.theme';

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** Theme of Telegram inside Telegram; of the phone in a plain browser. */
function systemTheme(): Theme {
  const wa = getWebApp();
  if (wa) return wa.colorScheme === 'dark' ? 'dark' : 'light';
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** `?theme=dark|light` (design review) → the Profile choice → Telegram / the phone. */
export function currentTheme(): Theme {
  const forced = new URLSearchParams(location.search).get('theme');
  if (forced === 'dark' || forced === 'light') return forced;
  const pref = getThemePref();
  return pref === 'auto' ? systemTheme() : pref;
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

export function setThemePref(pref: ThemePref) {
  try { if (pref === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref); } catch { /* this session only */ }
  apply(currentTheme());
}

/** Call once on boot: applies the theme and follows Telegram / the phone while the choice is «auto». */
export function initTheme() {
  apply(currentTheme());
  const update = () => apply(currentTheme());
  getWebApp()?.onEvent('themeChanged', update);
  if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', update);
}
