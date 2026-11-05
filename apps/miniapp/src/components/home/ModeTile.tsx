import { clsx } from 'clsx';
import type { QuizMode } from '@rq/shared-types';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { Badge, GradientDecor, Icon, toneStyle, type GradientTone } from '../ui';
import { useTrial } from '../trial/Trial';

const look: Record<QuizMode, { to: string; img: string; tone: GradientTone }> = {
  individual: { to: '/tests', img: '/3d/rq-3d-M01.webp', tone: 'primary' },
  live: { to: '/live', img: '/3d/rq-3d-M02.webp', tone: 'ink' },
  group: { to: '/group', img: '/3d/rq-3d-M03.webp', tone: 'teal' },
};

/** Mode tile in the gradient style; the hint explains what the mode does. */
export function ModeTile({ mode, live = false }: { mode: QuizMode; live?: boolean }) {
  const { t } = useI18n();
  const l = look[mode];
  const locked = !!useTrial() && mode !== 'individual'; // live & group are for subscribers
  return (
    <Link to={locked ? '/subscribe' : l.to} style={toneStyle(l.tone)}
      className="relative flex h-[136px] flex-col justify-between overflow-hidden rounded-[22px] p-3 text-white transition-transform duration-150 active:scale-[0.97]">
      <GradientDecor sparkles={false} />
      {live && !locked && <Badge tone="live" className="absolute left-2.5 top-2.5 z-[2] !h-[18px] !px-1.5 !text-[9px]">LIVE</Badge>}
      {locked && <span aria-label={t('trial.locked')} className="absolute left-2.5 top-2.5 z-[2] grid size-7 place-items-center rounded-full bg-night/60 text-white"><Icon name="lock" size={14} /></span>}
      <img src={l.img} alt="" className="relative -mr-2 -mt-2 size-[68px] self-end object-contain" />
      <span className={clsx('relative flex flex-col')}>
        <span className="text-[14px] font-extrabold uppercase tracking-[0.02em]">{t(`mode.${mode}`)}</span>
        <span className="text-[10px] leading-[13px] text-white/85 [text-wrap:balance]">{t(`mode.${mode}.hint`)}</span>
      </span>
    </Link>
  );
}
