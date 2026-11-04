import { useI18n } from '../lib/i18n';

/** Shown while the app boots (Telegram init + first data). Purely visual. */
export function SplashScreen() {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t('loading')}
      className="fixed inset-0 overflow-hidden text-white"
      style={{ background: 'radial-gradient(120% 80% at 50% 38%, #EE3350 0%, #DF1D38 45%, #B8122C 100%)' }}>
      <div className="relative mx-auto h-full max-w-[480px]">
        <span aria-hidden className="absolute left-1/2 top-[250px] size-[300px] -translate-x-1/2 rounded-full bg-white/[0.08]" />
        <span aria-hidden className="absolute left-1/2 top-[210px] size-[380px] -translate-x-1/2 rounded-full border border-white/[0.12]" />
        <img src="/3d/rq-3d-T05.webp" alt="" className="absolute left-[22px] top-[210px] size-[92px] -rotate-12 object-contain" />
        <img src="/3d/rq-3d-T06.webp" alt="" className="absolute right-5 top-[190px] size-24 rotate-[10deg] object-contain" />
        <img src="/3d/rq-3d-T04.webp" alt="" className="absolute right-9 top-[470px] size-[78px] -rotate-[8deg] object-contain" />
        <img src="/3d/rq-3d-T02.webp" alt="" className="absolute left-[34px] top-[480px] size-[74px] rotate-[8deg] object-contain" />
        <img src="/3d/rq-3d-H01.webp" alt="" className="absolute left-1/2 top-[280px] size-[230px] -translate-x-1/2 object-contain" />
        <div className="absolute inset-x-0 flex flex-col items-center gap-1.5" style={{ top: 'calc(var(--safe-top) + 92px)' }}>
          <img src="/brand/rusada-uc-wordmark-white.svg" alt="Rusada — учебный центр" className="h-[84px] w-[250px] object-contain" />
          <span className="pl-[.32em] text-micro font-extrabold uppercase tracking-[.32em] text-white/85">QuizBot</span>
        </div>
        <div className="absolute inset-x-0 flex flex-col items-center gap-4" style={{ bottom: 'calc(var(--safe-bottom) + 70px)' }}>
          <span className="font-display text-[22px] font-bold tracking-tight">{t('splash.tagline')}</span>
          <span className="h-1 w-40 overflow-hidden rounded-full bg-white/25"><span className="block h-full w-3/5 animate-pulse rounded-full bg-white" /></span>
        </div>
      </div>
    </div>
  );
}
