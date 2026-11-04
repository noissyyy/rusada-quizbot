import type { InProgressAttempt } from '@rq/shared-types';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { Icon, ProgressBar } from '../ui';

export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export function ContinueCard({ attempt }: { attempt: InProgressAttempt }) {
  const { t } = useI18n();
  return (
    <Link to={`/quiz/${attempt.quizId}`} className="flex items-center gap-3 rounded-card bg-surface p-4 text-ink shadow-card">
      <span className="grid size-12 shrink-0 place-items-center rounded-control bg-primary-50 text-primary"><Icon name="clock" size={24} /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-micro font-bold uppercase tracking-wide text-muted">{t('home.continue', { time: mmss(attempt.remainingSeconds) })}</span>
        <span className="truncate text-[16px] font-bold">{attempt.quizTitle}</span>
        <span className="mt-1 flex items-center gap-2">
          <ProgressBar value={attempt.answered} max={attempt.total} label={attempt.quizTitle} />
          <span className="text-[12px] font-bold text-ink-2">{attempt.answered}/{attempt.total}</span>
        </span>
      </span>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-white shadow-primary"><Icon name="play" size={14} filled strokeWidth={0} /></span>
    </Link>
  );
}
