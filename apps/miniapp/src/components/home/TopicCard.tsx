import { clsx } from 'clsx';
import type { TopicSummary } from '@rq/shared-types';
import { topicClasses } from '../../styles/palette';
import { TopicIllustration } from '../illustrations/TopicIllustration';
import { ProgressBar } from '../ui';

export function TopicCard({ topic, onOpen, className }: { topic: TopicSummary; onOpen: (t: TopicSummary) => void; className?: string }) {
  const c = topicClasses[topic.color];
  return (
    <button
      type="button"
      onClick={() => onOpen(topic)}
      className={clsx(
        'relative flex flex-col overflow-hidden rounded-card p-4 text-left transition-transform duration-150 active:scale-[0.98]',
        c.bg, className,
      )}
    >
      <TopicIllustration kind={topic.illustration} color={topic.color} size={76} className="-mr-2 -mt-1 self-end" />
      <span className="mt-1 text-body font-bold text-ink">{topic.title}</span>
      <span className="truncate text-micro text-ink-2/70">{topic.testsCount} тестов · {topic.questionsCount} вопр.</span>
      <span className="mt-3 flex items-center gap-2">
        <ProgressBar value={topic.progress} label={`Прогресс: ${topic.title}`} fillClassName={c.fill} trackClassName="bg-white/70" />
        <span className={clsx('text-micro font-bold', c.fg)}>{topic.progress}%</span>
      </span>
    </button>
  );
}
