import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import type { MessageKey } from '../../lib/i18n/dict';
import { GradientDecor, toneStyle, type GradientTone } from '../ui';

interface GameCard { to: string; img: string; tone: GradientTone; title: MessageKey; text: MessageKey; badge: string; hot?: boolean }

/** Home: games and practice — slim gradient cards with a big 3D icon and a pill. New games are added to this list. */
export function GamesSection({ reviewDue }: { reviewDue: number }) {
  const { t } = useI18n();
  const games: GameCard[] = [
    { to: '/games/duel', img: 'M02', tone: 'primary', title: 'games.duel', text: 'games.duelShort', badge: t('games.badgeNew'), hot: true },
    { to: '/games/word', img: 'T07', tone: 'teal', title: 'games.word', text: 'games.wordShort', badge: t('games.badgeDaily') },
    { to: '/games/stress', img: 'T14', tone: 'peach', title: 'games.stress', text: 'games.stressShort', badge: t('games.badge60') },
    { to: '/mistakes', img: 'T15', tone: 'pink', title: 'games.review', text: 'games.reviewShort',
      badge: reviewDue > 0 ? t('games.reviewDue', { n: reviewDue }) : t('games.badgeDone'), hot: reviewDue > 0 },
  ];
  return (
    <section className="flex flex-col gap-3" aria-labelledby="games-title">
      <h2 id="games-title" className="font-display text-title font-bold tracking-tight">{t('games.title')}</h2>
      <div className="flex flex-col gap-2.5">
        {games.map((g) => (
          <Link key={g.to} to={g.to} style={toneStyle(g.tone)}
            className="relative flex h-[100px] items-center gap-3 overflow-hidden rounded-[24px] pl-2 pr-4 text-white transition-transform duration-150 active:scale-[0.98]">
            <GradientDecor sparkles={false} />
            <img src={`/3d/rq-3d-${g.img}.webp`} alt="" className="relative -my-2 size-[92px] shrink-0 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,.25)]" />
            <span className="relative flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span className="font-display text-[19px] font-extrabold leading-6 tracking-tight">{t(g.title)}</span>
              <span className="w-full truncate text-[12px] font-medium text-white/85">{t(g.text)}</span>
              <span className="mt-1 flex h-6 items-center gap-1 rounded-full bg-night/35 px-2.5 text-[11px] font-extrabold uppercase tracking-[0.04em] backdrop-blur-sm">
                {g.hot && <span aria-hidden>🔥</span>}{g.badge}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
