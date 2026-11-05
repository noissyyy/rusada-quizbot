import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { groupDigits, roundDown } from '../../lib/numbers';
import { haptic } from '../../lib/telegram/webapp';
import { GradientDecor, toneStyle } from '../ui';

/** Leads to the tests section; shows how many questions there are in total (rounded down, never overstated). */
export function StartCard({ total }: { total: number }) {
  const { t } = useI18n();
  const meta = total >= 10 ? t('home.startTotal', { n: groupDigits(roundDown(total)) }) : t('home.startAll');
  return (
    <Link to="/tests" onClick={() => haptic.tap()} aria-label={`${t('home.start')}: ${meta}`}
      style={toneStyle('brand')}
      className="relative flex min-h-[150px] items-center gap-3 overflow-hidden rounded-[26px] py-5 pl-[22px] pr-[18px] text-white transition-transform duration-150 active:scale-[0.98]">
      <GradientDecor />
      <span className="relative flex flex-1 flex-col gap-1">
        <span className="font-display text-[27px] font-extrabold uppercase leading-[30px] tracking-[0.01em]">{t('home.start')}</span>
        <span className="text-[13px] font-medium text-white/85">{meta}</span>
      </span>
      <img src="/3d/rq-3d-H02.webp" alt="" className="relative -my-3 -mr-2 size-[112px] shrink-0 object-contain" />
    </Link>
  );
}
