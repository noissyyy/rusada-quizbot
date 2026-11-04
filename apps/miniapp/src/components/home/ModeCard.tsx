import { clsx } from 'clsx';
import type { QuizMode, QuizModeInfo } from '@rq/shared-types';
import { Badge, Icon, type IconName } from '../ui';

const look: Record<QuizMode, { icon: IconName; tile: string }> = {
  individual: { icon: 'user', tile: 'bg-blue-bg text-blue-fg' },
  live: { icon: 'broadcast', tile: 'bg-pink-bg text-pink-fg' },
  group: { icon: 'users', tile: 'bg-mint-bg text-mint-fg' },
};

export function ModeCard({ info, onSelect }: { info: QuizModeInfo; onSelect: (m: QuizMode) => void }) {
  const l = look[info.mode];
  return (
    <button
      type="button"
      onClick={() => onSelect(info.mode)}
      className="flex w-full items-center gap-3 rounded-card bg-surface p-3.5 text-left shadow-card transition-transform duration-150 active:scale-[0.98]"
    >
      <span className={clsx('grid size-12 shrink-0 place-items-center rounded-[14px]', l.tile)}>
        <Icon name={l.icon} size={24} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-body font-semibold text-ink">{info.title}</span>
          {info.badge && <Badge tone="live">{info.badge}</Badge>}
        </span>
        <span className="block truncate text-caption text-muted">{info.description}</span>
      </span>
      <Icon name="chevronRight" size={20} className="shrink-0 text-muted" />
    </button>
  );
}
