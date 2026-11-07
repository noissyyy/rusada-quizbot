import { clsx } from 'clsx';
import type { GameResultOut } from '@rq/shared-types';
import { useEffect, useState } from 'react';
import { api } from '../data/api';
import { MEMORY_PAIRS, shuffle } from '../lib/gameContent';
import { loadPool, takeFresh } from '../lib/fresh';
import { useI18n } from '../lib/i18n';
import { haptic } from '../lib/telegram/webapp';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { GameOver } from '../components/games/GameOver';

const PAIRS = 6;
const PEEK_MS = 3000;
type Mode = 'emoji' | 'uz' | 'antonyms';
const MODES: Mode[] = ['emoji', 'uz', 'antonyms'];
interface Card { id: number; pair: number; face: string; side: 0 | 1 }
type Pools = Record<Mode, [string, string][]>;
const FALLBACK: Pools = { emoji: MEMORY_PAIRS, uz: [], antonyms: [] };

/** 6 pairs this player has not matched yet in this mode; each card shows one side of a pair. */
function deal(pools: Pools, mode: Mode): Card[] {
  const list = pools[mode].length ? pools[mode] : FALLBACK.emoji;
  const chosen = takeFresh(`memory:${mode}`, list, PAIRS, ([a, b]) => `${a}|${b}`);
  return shuffle(chosen.flatMap(([a, b], k) => [{ pair: k, face: a, side: 0 as const }, { pair: k, face: b, side: 1 as const }]))
    .map((c, id) => ({ ...c, id }));
}

/** «Запомни и сопоставь»: see the cards for 3 s, then match each picture with its Russian word. */
export function MemoryScreen() {
  const { t } = useI18n();
  const [pools, setPools] = useState<Pools>(FALLBACK);
  const [mode, setMode] = useState<Mode>('emoji');
  const [cards, setCards] = useState<Card[]>(() => deal(FALLBACK, 'emoji'));
  // the big list arrives a moment later: deal from it while the first cards are still being shown
  useEffect(() => { loadPool<Pools>('memory').then((p) => { setPools(p); setCards(deal(p, 'emoji')); }, () => undefined); }, []);
  const [peek, setPeek] = useState(true);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [t0, setT0] = useState(Date.now());
  const [result, setResult] = useState<GameResultOut | null>(null);
  const [endAt, setEndAt] = useState<number | null>(null);
  const done = matched.length === PAIRS;
  const secs = Math.round(((endAt ?? Date.now()) - t0) / 1000);
  const score = Math.max(10, 100 - Math.max(0, moves - PAIRS) * 5 - Math.floor(secs / 3));

  useEffect(() => { if (!peek) return; const h = setTimeout(() => { setPeek(false); setT0(Date.now()); }, PEEK_MS); return () => clearTimeout(h); }, [peek]);
  useEffect(() => {
    if (!done) return;
    const end = Date.now();
    setEndAt(end);
    const final = Math.max(10, 100 - Math.max(0, moves - PAIRS) * 5 - Math.floor((end - t0) / 3000));
    haptic.success();
    api().gameResult('memory', final).then(setResult, () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const flip = (c: Card) => {
    if (peek || done || open.length === 2 || open.includes(c.id) || matched.includes(c.pair)) return;
    const next = [...open, c.id];
    setOpen(next); haptic.select();
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next.map((id) => cards.find((x) => x.id === id)!);
      if (a!.pair === b!.pair && a!.side !== b!.side) { setTimeout(() => { setMatched((m) => [...m, a!.pair]); setOpen([]); haptic.success(); }, 350); }
      else setTimeout(() => setOpen([]), 900);
    }
  };
  const again = (m: Mode = mode, p: Pools = pools) => { setMode(m); setCards(deal(p, m)); setPeek(true); setOpen([]); setMatched([]); setMoves(0); setResult(null); setEndAt(null); };

  return (
    <Screen className="flex flex-col gap-4">
      <ScreenHeader back="/games" title={t('memory.title')} />
      {done ? (
        <GameOver title={t('memory.done')} score={score} detail={t('memory.doneText', { m: moves, s: secs })} result={result} onAgain={() => again()} img="G10" />
      ) : (
        <>
          <div role="tablist" className="grid grid-cols-3 gap-1 rounded-[14px] bg-track p-1">
            {MODES.map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => again(m)}
                className={clsx('h-9 rounded-[10px] text-[13px] font-bold', mode === m ? 'bg-surface text-ink shadow-card' : 'text-muted')}>{t(`memory.mode.${m}` as const)}</button>
            ))}
          </div>
          <p className="text-center text-[14px] font-semibold text-ink-2">{peek ? t('memory.peek') : t('memory.find', { n: PAIRS - matched.length, m: moves })}</p>
          <div className="grid grid-cols-3 gap-2.5">
            {cards.map((c) => {
              const shown = peek || open.includes(c.id) || matched.includes(c.pair);
              return (
                <button key={c.id} type="button" onClick={() => flip(c)} aria-label={shown ? c.face : t('memory.closed')}
                  className={clsx('grid aspect-[4/5] place-items-center rounded-[18px] px-1 text-center shadow-card transition-all duration-200',
                    matched.includes(c.pair) ? 'bg-success-50 opacity-70' : shown ? 'bg-surface' : 'bg-primary active:scale-95')}>
                  {shown ? <span className={mode === 'emoji' && c.side === 0 ? 'text-[42px] leading-none' : clsx('break-words text-[15px] font-bold leading-5', mode === 'uz' && c.side === 1 ? 'text-primary' : 'text-ink')}>{c.face}</span>
                    : <span className="font-display text-[26px] font-extrabold text-white/80">?</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </Screen>
  );
}

