import type { TestSummary, TopicColor } from '@rq/shared-types';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { Badge } from '../ui';

export const topicBg: Record<TopicColor, string> = {
  blue: 'bg-topic-blue',
  violet: 'bg-topic-violet',
  mint: 'bg-topic-mint',
  peach: 'bg-topic-peach',
  pink: 'bg-topic-pink',
  yellow: 'bg-topic-yellow',
  sky: 'bg-topic-sky',
  indigo: 'bg-topic-indigo',
  lavender: 'bg-topic-lavender',
  plum: 'bg-topic-plum',
  rose: 'bg-topic-rose',
  coral: 'bg-topic-coral',
  orange: 'bg-topic-orange',
  sand: 'bg-topic-sand',
  lime: 'bg-topic-lime',
  green: 'bg-topic-green',
  teal: 'bg-topic-teal',
  olive: 'bg-topic-olive',
  slate: 'bg-topic-slate',
  gray: 'bg-topic-gray',
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
