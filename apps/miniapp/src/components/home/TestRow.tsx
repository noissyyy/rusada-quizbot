import type { TestSummary, TopicColor } from '@rq/shared-types';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { Badge } from '../ui';

export const topicBg: Record<TopicColor, string> = {
  blue: 'bg-topic-blue', violet: 'bg-topic-violet', mint: 'bg-topic-mint',
  peach: 'bg-topic-peach', pink: 'bg-topic-pink', yellow: 'bg-topic-yellow',
};

export function TestRow({ test }: { test: TestSummary }) {
  const { t } = useI18n();
  return (
    <Link to={`/tests/${test.id}`} className="flex items-center gap-3 rounded-[20px] bg-surface py-2.5 pl-2.5 pr-3.5 text-ink shadow-card">
      <span className={`grid size-[58px] shrink-0 place-items-center rounded-control ${topicBg[test.topicColor]}`}>
        <img src={test.illustration} alt="" className="size-[50px] object-contain" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-body font-bold leading-5">{test.title}</span>
        <span className="mt-0.5 block text-[12px] leading-4 text-muted">
          {t('home.testMeta', { topic: test.topicTitle, q: test.questionsCount, m: test.durationMinutes })}
        </span>
      </span>
      <Badge tone={test.difficulty}>{t(`difficulty.${test.difficulty}`)}</Badge>
    </Link>
  );
}
