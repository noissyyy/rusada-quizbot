import { clsx } from 'clsx';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../data/api';
import { GAMES, type GameInfo } from '../lib/games';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { Screen } from '../components/Screen';
import { GradientDecor, Icon, Skeleton, toneStyle } from '../components/ui';
import { XpBadge } from '../components/games/XpBadge';

/** «O‘yinlar» tab: featured banners, popular this week, solo games, with a friend, practice. */
export function GamesHubScreen() {
  const { t } = useI18n();
  const hub = useAsync(() => api().gamesHub());
  const plays = hub.status === 'success' ? hub.data.plays : {};
  const popular = [...GAMES].sort((a, b) => (plays[b.key] ?? 0) - (plays[a.key] ?? 0)).slice(0, 4);
  const sections: [MessageKeyOf, MessageKeyOf, GameInfo['kind']][] = [
    ['games.solo', 'games.soloSub', 'solo'], ['games.friend', 'games.friendSub', 'friend'], ['games.practice', 'games.practiceSub', 'practice'],
  ];
  return (
    <Screen className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-display font-bold tracking-tight">{t('nav.games')}</h1>
        <div className="flex items-center gap-2">
          <Link to="/rating" aria-label={t('nav.rating')} className="grid size-10 place-items-center rounded-full bg-surface text-ink shadow-card"><Icon name="trophy" size={20} /></Link>
          {hub.status === 'success' ? <XpBadge xp={hub.data.xp} /> : <Skeleton className="h-10 w-24 rounded-full" />}
        </div>
      </header>

      <Carousel games={GAMES.filter((g) => g.kind !== 'practice')} reviewDue={hub.status === 'success' ? hub.data.reviewDue : 0} />

      <section className="flex flex-col gap-3">
        <div><h2 className="font-display text-title font-bold tracking-tight">{t('games.popular')}</h2><p className="text-caption text-muted">{t('games.popularSub')}</p></div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {popular.map((g) => (
            <Link key={g.key} to={g.to} className="flex w-[150px] shrink-0 flex-col gap-2">
              <span style={toneStyle(g.tone)} className="relative grid aspect-square place-items-center overflow-hidden rounded-[24px]">
                <GradientDecor sparkles={false} />
                <img src={`/3d/rq-3d-${g.img}.webp`} alt="" className="relative size-[110px] object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,.25)]" />
              </span>
              <span className="text-[15px] font-bold leading-5">{t(g.title)}</span>
              <span className="-mt-1.5 text-[12px] text-muted">{t('games.playsWeek', { n: plays[g.key] ?? 0 })}</span>
            </Link>
          ))}
        </div>
      </section>

      {sections.map(([title, sub, kind]) => {
        const list = GAMES.filter((g) => g.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="flex flex-col gap-1 rounded-card bg-surface p-4 shadow-card">
            <h2 className="font-display text-title font-bold tracking-tight">{t(title)}</h2>
            <p className="mb-1 text-caption text-muted">{t(sub)}</p>
            {list.map((g, i) => (
              <Link key={g.key} to={g.to} className={clsx('flex items-center gap-3.5 py-3', i > 0 && 'border-t border-line')}>
                <span style={toneStyle(g.tone)} className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-[18px]">
                  <img src={`/3d/rq-3d-${g.img}.webp`} alt="" className="relative size-14 object-contain" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[16px] font-bold">{t(g.title)}</span>
                  <span className="text-[12px] leading-4 text-muted">{t(g.long)}</span>
                </span>
                <span className="shrink-0 rounded-full bg-primary-50 px-3 py-1.5 text-[12px] font-bold text-primary">{t('games.play')}</span>
              </Link>
            ))}
          </section>
        );
      })}
    </Screen>
  );
}

type MessageKeyOf = Parameters<ReturnType<typeof useI18n>['t']>[0];

function Carousel({ games, reviewDue }: { games: GameInfo[]; reviewDue: number }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  void reviewDue;
  return (
    <section aria-label={t('games.featured')} className="flex flex-col gap-2.5">
      <div ref={box} onScroll={(e) => { const el = e.currentTarget; setActive(Math.round(el.scrollLeft / el.clientWidth)); }}
        className="-mx-4 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
        {games.map((g) => (
          <div key={g.key} className="w-full shrink-0 snap-center px-4">
            <div style={toneStyle(g.tone)} className="relative flex h-[200px] flex-col justify-end overflow-hidden rounded-hero p-5 text-white">
              <GradientDecor />
              <img src={`/3d/rq-3d-${g.img}.webp`} alt="" className="absolute -right-3 -top-3 size-[150px] object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,.3)]" />
              {g.badge && <span className="absolute left-5 top-5 rounded-full bg-night/35 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.04em]">{t(g.badge)}</span>}
              <span className="relative max-w-[62%] font-display text-[24px] font-extrabold leading-7 tracking-tight">{t(g.title)}</span>
              <span className="relative mt-1 max-w-[70%] text-[13px] leading-[18px] text-white/85">{t(g.long)}</span>
              <Link to={g.to} className="relative mt-3 inline-flex h-10 items-center gap-1 self-start rounded-full bg-white px-4 text-[14px] font-bold text-night">{t('games.play')}<Icon name="chevronRight" size={16} /></Link>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5" aria-hidden>
        {games.map((g, i) => <span key={g.key} className={clsx('h-1.5 rounded-full transition-all', i === active ? 'w-6 bg-primary' : 'w-1.5 bg-line')} />)}
      </div>
    </section>
  );
}
