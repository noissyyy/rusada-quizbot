import type { QuickStart } from '@rq/shared-types';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { haptic } from '../../lib/telegram/webapp';
import { GradientDecor, toneStyle } from '../ui';

/** One tap starts a test immediately — no intermediate screen. Gradient style (Idea · O). */
export function StartCard({ quick }: { quick: QuickStart }) {
  const { t } = useI18n();
  const meta = t('home.startMeta', { q: quick.questionsCount, m: quick.durationMinutes });
  return (
    <Link to={`/quiz/${quick.quizId}`} onClick={() => haptic.tap()} aria-label={`${t('home.start')}: ${meta}`}
      style={toneStyle('brand')}
      className="relative flex min-h-[150px] items-center gap-3 overflow-hidden rounded-[26px] py-5 pl-[22px] pr-[18px] text-white transition-transform duration-150 active:scale-[0.98]">
      <GradientDecor />
      <span className="relative flex flex-1 flex-col gap-1">
        <span className="font-display text-[27px] font-extrabold uppercase leading-[30px] tracking-[0.01em]">{t('home.start')}</span>
        <span className="text-[13px] font-medium text-white/85">{meta}</span>
      </span>
      <img src="/3d/rq-3d-H01.webp" alt="" className="relative -my-3 -mr-2 size-[116px] shrink-0 object-contain" />
    </Link>
  );
}
