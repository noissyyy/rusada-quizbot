import type { QuickStart } from '@rq/shared-types';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { haptic } from '../../lib/telegram/webapp';
import { Icon } from '../ui';

/** One tap starts a test immediately — no intermediate screen. */
export function StartCard({ quick }: { quick: QuickStart }) {
  const { t } = useI18n();
  const meta = t('home.startMeta', { q: quick.questionsCount, m: quick.durationMinutes });
  return (
    <Link to={`/quiz/${quick.quizId}`} onClick={() => haptic.tap()} aria-label={`${t('home.start')}: ${meta}`}
      className="relative flex min-h-[140px] items-center gap-4 overflow-hidden rounded-hero bg-brand p-[22px] text-white shadow-brand transition-transform duration-150 active:scale-[0.98]">
      <span aria-hidden className="absolute -bottom-[110px] -right-[70px] size-[220px] rounded-full bg-brand-dark" />
      <span className="relative z-[2] grid size-16 shrink-0 place-items-center rounded-full bg-white text-brand shadow-[0_8px_18px_rgba(0,0,0,.16)]">
        <Icon name="play" size={24} filled strokeWidth={0} />
      </span>
      <span className="relative z-[2] flex flex-col gap-1">
        <span className="font-display text-[28px] font-extrabold leading-[30px] tracking-tight">{t('home.start')}</span>
        <span className="text-[14px] font-semibold text-white/90">{meta}</span>
      </span>
      <img src="/3d/rq-3d-H01.webp" alt="" className="absolute -bottom-1.5 -right-[18px] z-[1] size-[132px] object-contain" />
    </Link>
  );
}
