import type { TelegramWebApp } from './types';

/**
 * Returns the Telegram WebApp object only when actually running inside Telegram.
 * telegram-web-app.js defines window.Telegram.WebApp even in a plain browser,
 * but initData is empty there — that's our signal.
 */
export function getWebApp(): TelegramWebApp | null {
  const wa = window.Telegram?.WebApp;
  return wa && wa.initData ? wa : null;
}

export const isInTelegram = () => getWebApp() !== null;

/**
 * Raw initData string to send to the backend as `Authorization: tma <initData>`.
 * The backend MUST validate its HMAC — initDataUnsafe is for display only.
 */
export const getInitData = (): string | null => getWebApp()?.initData ?? null;

/** Call once on boot: signal readiness, expand, sync chrome colors with our canvas. */
export function bootstrapTelegram(canvas = '#F6F5FA') {
  const wa = getWebApp();
  if (!wa) return;
  wa.ready();
  wa.expand();
  if (wa.isVersionAtLeast('6.1')) {
    wa.setHeaderColor(canvas);
    wa.setBackgroundColor(canvas);
  }
  if (wa.isVersionAtLeast('7.10')) wa.setBottomBarColor?.(canvas);
  // Prevent swipe-to-close from killing a quiz; screens re-enable where safe.
  if (wa.isVersionAtLeast('7.7')) wa.disableVerticalSwipes?.();
}

let hapticsOn = true;
/** Profile → «Вибрация при ответе». */
export function setHapticsEnabled(on: boolean) { hapticsOn = on; }
const hf = () => (hapticsOn ? getWebApp()?.HapticFeedback : undefined);

export const haptic = {
  tap: () => hf()?.impactOccurred('light'),
  select: () => hf()?.selectionChanged(),
  success: () => hf()?.notificationOccurred('success'),
  error: () => hf()?.notificationOccurred('error'),
};

/** Start parameter from a t.me/<bot>?startapp=… link, or ?start=… from a bot web_app button. */
export function getStartParam(): string | null {
  const fromTg = getWebApp()?.initDataUnsafe.start_param;
  if (fromTg) return fromTg;
  try { return new URLSearchParams(location.search).get('start'); } catch { return null; }
}

/** Route for a start parameter: g_<assignment> → group test, l_<live> → live lobby, t_<test> → test details. */
export function routeForStart(param: string | null): string | null {
  if (param === 'word') return '/games/word';
  if (!param || !/^[gltd]_[A-Za-z0-9]{1,60}$/.test(param)) return null;
  const id = param.slice(2);
  return { g: `/group/${id}`, l: `/live/${id}`, t: `/tests/${id}`, d: `/duel/${id}` }[param[0] as 'g' | 'l' | 't' | 'd'];
}
