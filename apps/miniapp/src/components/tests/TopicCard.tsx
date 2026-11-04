import type { TopicSummary } from '@rq/shared-types';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { topicBg } from '../home/TestRow';

/** Big title, big progress number, 3D object bleeding out of the corner. */
export function TopicCard({ topic }: { topic: TopicSummary }) {
  const { t } = useI18n();
  return (
    <Link to={`/topics/${topic.slug}`} className={`relative flex h-[196px] flex-col justify-between overflow-hidden rounded-card p-4 text-ink transition-transform duration-150 active:scale-[0.98] ${topicBg[topic.color]}`}>
      <span className="relative z-[2]">
        <span className="block text-[16px] font-bold">{topic.title}</span>
        <span className="mt-0.5 block text-micro font-medium text-ink-2">{t('topic.stats', { t: topic.testsCount, q: topic.questionsCount })}</span>
      </span>
      <span className="relative z-[2]">
        <span className="block text-micro font-semibold text-ink-2">{t('topic.progress')}</span>
        <span className="font-display text-[30px] font-extrabold tracking-tight">{topic.progress}%</span>
      </span>
      <img src={topic.illustration} alt="" className="absolute -bottom-2.5 -right-3 z-[1] size-[120px] object-contain" />
    </Link>
  );
}
