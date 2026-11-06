import type { XpInfo } from '@rq/shared-types';
import { useI18n } from '../../lib/i18n';

/** «Lv 3 · 340 XP» chip with progress to the next level. */
export function XpBadge({ xp }: { xp: XpInfo }) {
  const { t } = useI18n();
  const pct = Math.round(((xp.xp - xp.levelStart) / Math.max(1, xp.levelNext - xp.levelStart)) * 100);
  return (
    <span aria-label={t('xp.aria', { l: xp.level, x: xp.xp, n: xp.levelNext })} className="flex h-10 items-center gap-2 rounded-full bg-surface pl-1 pr-3 shadow-card">
      <span className="grid size-8 place-items-center rounded-full bg-primary font-display text-[14px] font-extrabold text-white">{xp.level}</span>
      <span className="flex flex-col">
        <span className="font-display text-[13px] font-extrabold leading-4 tabular-nums">{xp.xp} XP</span>
        <span className="mt-0.5 h-1 w-14 overflow-hidden rounded-full bg-track"><span className="block h-full bg-primary" style={{ width: `${pct}%` }} /></span>
      </span>
    </span>
  );
}
