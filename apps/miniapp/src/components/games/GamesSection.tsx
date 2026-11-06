import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import type { MessageKey } from '../../lib/i18n/dict';

interface GameTile { to: string; img: string; title: MessageKey; text: MessageKey; badge?: string | null }

/** Home: games and practice. New games are added to this list. */
export function GamesSection({ reviewDue }: { reviewDue: number }) {
  const { t } = useI18n();
  const games: GameTile[] = [
    { to: '/games/word', img: 'T07', title: 'games.word', text: 'games.wordText' },
    { to: '/games/stress', img: 'T14', title: 'games.stress', text: 'games.stressText' },
    { to: '/mistakes', img: 'T15', title: 'games.review', text: 'games.reviewText', badge: reviewDue > 0 ? t('games.reviewDue', { n: reviewDue }) : null },
  ];
  return (
    <section className="flex flex-col gap-3" aria-labelledby="games-title">
      <h2 id="games-title" className="font-display text-title font-bold tracking-tight">{t('games.title')}</h2>
      <div className="flex flex-col gap-2.5">
        {games.map((g) => (
          <Link key={g.to} to={g.to} className="flex items-center gap-3.5 rounded-[22px] bg-surface p-3 pr-4 shadow-card active:scale-[0.99]">
            <span className="grid size-14 shrink-0 place-items-center rounded-[16px] bg-canvas"><img src={`/3d/rq-3d-${g.img}.webp`} alt="" className="size-12 object-contain" /></span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[16px] font-bold">{t(g.title)}</span>
              <span className="text-[12px] leading-4 text-muted">{t(g.text)}</span>
            </span>
            {g.badge && <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-[12px] font-bold text-white">{g.badge}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
