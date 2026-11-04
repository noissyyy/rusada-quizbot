import { clsx } from 'clsx';
import type { TopicSummary } from '@rq/shared-types';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { GradientDecor, gradient, toneMuted, toneStyle, toneText } from '../ui';

/** Section card in the gradient style: title, stats, progress, our 3D object in the corner. */
export function TopicCard({ topic }: { topic: TopicSummary }) {
  const { t } = useI18n();
  const tone = topic.color;
  return (
    <Link to={`/topics/${topic.slug}`} style={toneStyle(tone)}
      className={clsx('relative flex h-[196px] flex-col justify-between overflow-hidden rounded-card p-4 transition-transform duration-150 active:scale-[0.98]', toneText(tone))}>
      <GradientDecor dark={gradient[tone].text === 'dark'} />
      <span className="relative z-[2]">
        <span className="block text-[16px] font-extrabold">{topic.title}</span>
        <span className={clsx('mt-0.5 block text-micro font-medium', toneMuted(tone))}>{t('topic.stats', { t: topic.testsCount, q: topic.questionsCount })}</span>
      </span>
      <span className="relative z-[2]">
        <span className={clsx('block text-micro font-semibold', toneMuted(tone))}>{t('topic.progress')}</span>
        <span className="font-display text-[30px] font-extrabold tracking-tight">{topic.progress}%</span>
      </span>
      <img src={topic.illustration} alt="" className="absolute -bottom-2.5 -right-3 z-[1] size-[120px] object-contain" />
    </Link>
  );
}
