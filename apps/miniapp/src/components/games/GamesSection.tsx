import { Link } from 'react-router-dom';
import { GAMES } from '../../lib/games';
import { useI18n } from '../../lib/i18n';
import { GradientDecor, Icon, toneStyle } from '../ui';

/** Home: three game cards and a link to the «O‘yinlar» tab. */
export function GamesSection({ reviewDue }: { reviewDue: number }) {
  const { t } = useI18n();
  const shown = GAMES.filter((g) => g.key !== 'review').slice(0, 2).concat(GAMES.filter((g) => g.key === 'review'));
  return (
    <section className="flex flex-col gap-3" aria-labelledby="games-title">
      <div className="flex items-center justify-between">
        <h2 id="games-title" className="font-display text-title font-bold tracking-tight">{t('games.title')}</h2>
        <Link to="/games" className="flex items-center gap-0.5 text-[14px] font-bold text-primary">{t('games.all')}<Icon name="chevronRight" size={16} /></Link>
      </div>
      <div className="flex flex-col gap-2.5">
        {shown.map((g) => {
          const hot = g.key === 'review' ? reviewDue > 0 : g.key === 'duel';
          const badge = g.key === 'review' ? (reviewDue > 0 ? t('games.reviewDue', { n: reviewDue }) : t('games.badgeDone')) : g.badge ? t(g.badge) : '';
          return (
            <Link key={g.key} to={g.to} style={toneStyle(g.tone)}
              className="relative flex h-[100px] items-center gap-3 overflow-hidden rounded-[24px] pl-2 pr-4 text-white transition-transform duration-150 active:scale-[0.98]">
              <GradientDecor sparkles={false} />
              <img src={`/3d/rq-3d-${g.img}.webp`} alt="" className="relative -my-2 size-[92px] shrink-0 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,.25)]" />
              <span className="relative flex min-w-0 flex-1 flex-col items-start gap-0.5">
                <span className="font-display text-[19px] font-extrabold leading-6 tracking-tight">{t(g.title)}</span>
                <span className="w-full truncate text-[12px] font-medium text-white/85">{t(g.short)}</span>
                {badge && (
                  <span className="mt-1 flex h-6 items-center gap-1 rounded-full bg-night/35 px-2.5 text-[11px] font-extrabold uppercase tracking-[0.04em] backdrop-blur-sm">
                    {hot && <span aria-hidden>🔥</span>}{badge}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
