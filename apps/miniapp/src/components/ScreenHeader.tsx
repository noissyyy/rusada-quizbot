import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { Icon } from './ui';
import { useGameRules } from './games/GameRules';

export const circleBtn = 'grid size-11 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-card';

export function ScreenHeader({ back, title, right }: { back: string; title: string; right?: ReactNode }) {
  const { t } = useI18n();
  const rules = useGameRules();
  return (
    <header className="flex items-center justify-between gap-3">
      <Link to={back} aria-label={t('common.back')} className={circleBtn}><Icon name="chevronRight" size={22} className="rotate-180" /></Link>
      <span className="min-w-0 truncate text-[17px] font-bold">{title}</span>
      {right ?? (rules ? <button type="button" onClick={rules} aria-label={t('rules.open')} className={`${circleBtn} font-display text-[19px] font-extrabold text-primary`}>?</button> : <span className="size-11 shrink-0" />)}
    </header>
  );
}
