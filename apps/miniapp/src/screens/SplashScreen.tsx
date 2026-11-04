import { useEffect } from 'react';
import { RUSADA_PATH, UCHEBNY_PATH } from '../components/brand/wordmarkPaths';
import { useI18n } from '../lib/i18n';
import { haptic } from '../lib/telegram/webapp';

/** Total length of the animation below (ms). App.tsx keeps the splash up this long. */
export const SPLASH_ANIMATION_MS = 3200;

/**
 * «Rusada» is drawn as an outline, then filled; «учебный центр» rises from below
 * into its place in the logo. A light haptic tick when the word fills in (no sound:
 * Telegram and browsers block audio before the first tap).
 */
export function SplashScreen() {
  const { t } = useI18n();
  useEffect(() => {
    const id = setTimeout(() => haptic.tap(), 1500);
    return () => clearTimeout(id);
  }, []);
  return (
    <div role="status" aria-label={t('loading')} className="rq-splash fixed inset-0 grid place-items-center bg-brand text-white">
      <svg viewBox="85 248 470 148" width="300" height="94" role="img" aria-label="Rusada — учебный центр" className="max-w-[78vw]">
        <path className="rq-mark" pathLength={1} fillRule="evenodd" d={RUSADA_PATH} />
        <path className="rq-sub" fill="currentColor" d={UCHEBNY_PATH} />
      </svg>
    </div>
  );
}
