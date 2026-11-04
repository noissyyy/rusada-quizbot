import type { InProgressAttempt } from '@rq/shared-types';
import { topicClasses } from '../../styles/palette';
import { Card, Icon, ProgressBar } from '../ui';

export function ContinueCard({ attempt, onContinue }: { attempt: InProgressAttempt; onContinue: () => void }) {
  const t = topicClasses[attempt.topicColor];
  return (
    <Card className="p-4">
      <button type="button" onClick={onContinue} className="flex w-full items-center gap-3 text-left">
        <span className={`grid size-12 shrink-0 place-items-center rounded-[14px] ${t.bg} ${t.fg}`}>
          <Icon name="clock" size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-micro font-semibold uppercase tracking-wide text-muted">Продолжить · {attempt.topicTitle}</span>
          <span className="block truncate text-body font-semibold text-ink">{attempt.quizTitle}</span>
          <span className="mt-2 flex items-center gap-2">
            <ProgressBar value={attempt.answered} max={attempt.total} label="Прогресс теста" fillClassName={t.fill} />
            <span className="shrink-0 text-micro font-semibold text-ink-2">{attempt.answered}/{attempt.total}</span>
          </span>
        </span>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white shadow-primary">
          <Icon name="play" size={16} filled />
        </span>
      </button>
    </Card>
  );
}
