import { Link, useNavigate } from 'react-router-dom';
import { useAccess } from '../../lib/access';
import { useI18n } from '../../lib/i18n';
import { GradientDecor, Icon, toneStyle } from '../ui';

/** True while this person uses the app on the trial. */
export function useTrial() {
  const { access } = useAccess();
  return access?.trial ? access : null;
}

/** Home: how many free tests are left + the way to the subscription. */
export function TrialBanner() {
  const { t } = useI18n();
  const trial = useTrial();
  if (!trial) return null;
  const left = trial.trialTestsLeft;
  return (
    <Link to="/subscribe" style={toneStyle('ink')} className="relative flex items-center gap-3 overflow-hidden rounded-[22px] p-3.5 pl-4 text-white active:scale-[0.99]">
      <GradientDecor sparkles={false} />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/70">{t('trial.badge')}</span>
        <span className="text-[14px] font-bold leading-[18px]">{left > 0 ? t('trial.left', { n: left, t: trial.trialTests }) : t('trial.none')}</span>
        <span aria-hidden className="flex gap-1">
          {Array.from({ length: trial.trialTests }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < trial.trialTests - left ? 'bg-white/25' : 'bg-[#FFC83D]'}`} />
          ))}
        </span>
      </span>
      <span className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3.5 text-[13px] font-bold text-night">{t('trial.cta')}<Icon name="chevronRight" size={16} /></span>
    </Link>
  );
}

const LOCKS = {
  tests: { img: 'H02', title: 'trial.testsTitle', text: 'trial.testsText' },
  live: { img: 'M02', title: 'trial.liveTitle', text: 'trial.liveText' },
  group: { img: 'M03', title: 'trial.groupTitle', text: 'trial.groupText' },
} as const;

/** Full screen shown when a trial limit is reached or a subscriber-only part is opened. */
export function TrialLocked({ reason }: { reason: keyof typeof LOCKS }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const trial = useTrial();
  const l = LOCKS[reason];
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="relative grid size-[150px] place-items-center rounded-full bg-surface shadow-card">
        <img src={`/3d/rq-3d-${l.img}.webp`} alt="" className="size-[110px] object-contain" />
        <span className="absolute -bottom-1 -right-1 grid size-12 place-items-center rounded-full bg-night text-white shadow-raised"><Icon name="lock" size={22} /></span>
      </span>
      <h1 className="font-display text-[24px] font-bold leading-7 tracking-tight">{t(l.title)}</h1>
      <p className="max-w-[300px] text-body text-ink-2">{t(l.text, { t: trial?.trialTests ?? 3 })}</p>
      <div className="mt-2 flex w-full max-w-[320px] flex-col gap-2">
        <Link to="/subscribe" className="flex h-14 items-center justify-center rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{t('trial.see')}</Link>
        <button type="button" onClick={() => nav(-1)} className="h-[52px] rounded-control text-[15px] font-bold text-ink">{t('trial.back')}</button>
      </div>
    </main>
  );
}
