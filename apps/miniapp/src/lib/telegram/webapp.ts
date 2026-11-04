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

export const haptic = {
  tap: () => getWebApp()?.HapticFeedback.impactOccurred('light'),
  select: () => getWebApp()?.HapticFeedback.selectionChanged(),
  success: () => getWebApp()?.HapticFeedback.notificationOccurred('success'),
  error: () => getWebApp()?.HapticFeedback.notificationOccurred('error'),
};
