import { clsx } from 'clsx';
import type { QuizMode } from '@rq/shared-types';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { Badge } from '../ui';

const look: Record<QuizMode, { to: string; img: string; bg: string }> = {
  individual: { to: '/tests', img: '/3d/rq-3d-M01.webp', bg: 'bg-mode-individual shadow-[0_8px_18px_rgba(106,61,240,.25)]' },
  live: { to: '/live', img: '/3d/rq-3d-M02.webp', bg: 'bg-mode-live shadow-[0_8px_18px_rgba(26,21,48,.25)]' },
  group: { to: '/group', img: '/3d/rq-3d-M03.webp', bg: 'bg-mode-group shadow-[0_8px_18px_rgba(11,125,120,.25)]' },
};

/** Mode tile: the hint explains what the mode does, not its current state. */
export function ModeTile({ mode, live = false }: { mode: QuizMode; live?: boolean }) {
  const { t } = useI18n();
  const l = look[mode];
  return (
    <Link to={l.to} className={clsx('relative flex flex-col items-center gap-0.5 rounded-[22px] px-2 pb-3.5 pt-2.5 text-center text-white transition-transform duration-150 active:scale-[0.97]', l.bg)}>
      {live && <Badge tone="live" className="absolute right-2 top-2 !h-[18px] !px-1.5 !text-[9px]">LIVE</Badge>}
      <img src={l.img} alt="" className="size-[72px] object-contain" />
      <span className="text-[14px] font-bold">{t(`mode.${mode}`)}</span>
      <span className="text-micro text-white/85 [text-wrap:balance]">{t(`mode.${mode}.hint`)}</span>
    </Link>
  );
}
