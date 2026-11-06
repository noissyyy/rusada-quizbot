import { clsx } from 'clsx';
import type { GameResultOut } from '@rq/shared-types';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../data/api';
import { SEARCH_THEMES, type SearchTheme } from '../lib/gameContent';
import { useI18n } from '../lib/i18n';
import { haptic } from '../lib/telegram/webapp';
import { buildGrid, lineBetween } from '../lib/wordGrid';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { GameOver } from '../components/games/GameOver';

const COLORS = ['bg-[#5BD68A]', 'bg-[#FFC83D]', 'bg-[#8B6BFF]', 'bg-[#FF8A80]', 'bg-[#5CC8F0]', 'bg-[#FF9A2E]', 'bg-[#E8457A]', 'bg-[#14A898]'];

/** «Искатель слов»: tap the first and the last letter of a hidden word. */
export function WordSearchScreen() {
  const { t, lang } = useI18n();
  const [theme, setTheme] = useState<SearchTheme | null>(null);
  if (!theme) {
    return (
      <Screen className="flex flex-col gap-4">
        <ScreenHeader back="/games" title={t('search.title')} />
        <p className="text-[14px] text-ink-2">{t('search.pick')}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {SEARCH_THEMES.map((th) => (
            <button key={th.id} type="button" onClick={() => { haptic.tap(); setTheme(th); }} className="flex h-16 items-center justify-center rounded-[18px] bg-surface px-3 text-center text-[15px] font-bold shadow-card active:scale-[0.98]">
              {lang === 'ru' ? th.title.ru : th.title.uz}
            </button>
          ))}
        </div>
      </Screen>
    );
  }
  return <SearchRound key={theme.id + Math.random()} theme={theme} onBack={() => setTheme(null)} />;
}

function SearchRound({ theme, onBack }: { theme: SearchTheme; onBack: () => void }) {
  const { t, lang } = useI18n();
  const [seed, setSeed] = useState(0);
  const { grid, placed } = useMemo(() => buildGrid(theme.words), [theme, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [found, setFound] = useState<string[]>([]);
  const [start, setStart] = useState<number | null>(null);
  const [miss, setMiss] = useState<number[] | null>(null);
  const [t0, setT0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<GameResultOut | null>(null);
  const done = found.length === placed.length;
  useEffect(() => { if (done) return; const h = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(h); }, [done]);
  const secs = Math.round((now - t0) / 1000);
  const score = found.length * 10 + (done ? Math.max(0, Math.round((180 - secs) / 6)) : 0);

  useEffect(() => {
    if (!done) return;
    haptic.success();
    api().gameResult('wordsearch', score).then(setResult, () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const cellColor = (i: number) => {
    const k = placed.findIndex((p) => found.includes(p.word) && p.cells.includes(i));
    return k >= 0 ? COLORS[found.indexOf(placed[k]!.word) % COLORS.length] : null;
  };
  const tap = (i: number) => {
    if (done) return;
    if (start === null) { setStart(i); haptic.select(); return; }
    const line = lineBetween(start, i);
    setStart(null);
    const hit = line && placed.find((p) => !found.includes(p.word) && (p.cells.join() === line.join() || p.cells.join() === [...line].reverse().join()));
    if (hit) { setFound((f) => [...f, hit.word]); haptic.success(); }
    else { setMiss(line ?? [start, i]); haptic.error(); setTimeout(() => setMiss(null), 450); }
  };
  const again = () => { setSeed((s) => s + 1); setFound([]); setResult(null); setT0(Date.now()); setNow(Date.now()); };

  return (
    <Screen className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-[14px] font-bold text-primary">← {t('search.themes')}</button>
        <span className="font-display text-[16px] font-bold">{lang === 'ru' ? theme.title.ru : theme.title.uz}</span>
        <span className="rounded-full bg-surface px-3 py-1 font-display text-[14px] font-bold tabular-nums shadow-card">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
      </header>
      {done ? (
        <GameOver title={t('search.done')} score={score} detail={t('search.doneText', { s: secs })} result={result} onAgain={again} img="T12" />
      ) : (
        <>
          <div className="grid select-none grid-cols-8 gap-1 rounded-[20px] bg-surface p-2 shadow-card">
            {grid.map((ch, i) => {
              const c = cellColor(i);
              return (
                <button key={i} type="button" onClick={() => tap(i)} aria-label={ch}
                  className={clsx('grid aspect-square place-items-center rounded-[8px] font-display text-[18px] font-extrabold transition-colors',
                    c ? `${c} text-white` : miss?.includes(i) ? 'bg-error-50 text-error-ink' : start === i ? 'bg-primary text-white' : 'bg-canvas text-ink')}>{ch}</button>
              );
            })}
          </div>
          <p className="text-center text-[12px] text-muted">{t('search.howTo')}</p>
          <div className="flex flex-wrap gap-1.5">
            {placed.map((p) => (
              <span key={p.word} className={clsx('rounded-full px-3 py-1.5 text-[13px] font-bold', found.includes(p.word) ? 'bg-success-50 text-success-ink line-through' : 'bg-surface text-ink shadow-card')}>{p.word}</span>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
