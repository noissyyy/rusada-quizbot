import { clsx } from 'clsx';
import type { GameResultOut } from '@rq/shared-types';
import { useEffect, useState } from 'react';
import { api } from '../data/api';
import { MEMORY_PAIRS, shuffle } from '../lib/gameContent';
import { useI18n } from '../lib/i18n';
import { haptic } from '../lib/telegram/webapp';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { GameOver } from '../components/games/GameOver';

const PAIRS = 6;
const PEEK_MS = 3000;
interface Card { id: number; pair: number; face: string; isWord: boolean }

function deal(): Card[] {
  const chosen = shuffle(MEMORY_PAIRS).slice(0, PAIRS);
  return shuffle(chosen.flatMap(([emoji, word], k) => [{ pair: k, face: emoji, isWord: false }, { pair: k, face: word, isWord: true }]))
    .map((c, id) => ({ ...c, id }));
}

/** «Запомни и сопоставь»: see the cards for 3 s, then match each picture with its Russian word. */
export function MemoryScreen() {
  const { t } = useI18n();
  const [cards, setCards] = useState<Card[]>(deal);
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
      if (a!.pair === b!.pair && a!.isWord !== b!.isWord) { setTimeout(() => { setMatched((m) => [...m, a!.pair]); setOpen([]); haptic.success(); }, 350); }
      else setTimeout(() => setOpen([]), 900);
    }
  };
  const again = () => { setCards(deal()); setPeek(true); setOpen([]); setMatched([]); setMoves(0); setResult(null); setEndAt(null); };

  return (
    <Screen className="flex flex-col gap-4">
      <ScreenHeader back="/games" title={t('memory.title')} />
      {done ? (
        <GameOver title={t('memory.done')} score={score} detail={t('memory.doneText', { m: moves, s: secs })} result={result} onAgain={again} img="G10" />
      ) : (
        <>
          <p className="text-center text-[14px] font-semibold text-ink-2">{peek ? t('memory.peek') : t('memory.find', { n: PAIRS - matched.length, m: moves })}</p>
          <div className="grid grid-cols-3 gap-2.5">
            {cards.map((c) => {
              const shown = peek || open.includes(c.id) || matched.includes(c.pair);
              return (
                <button key={c.id} type="button" onClick={() => flip(c)} aria-label={shown ? c.face : t('memory.closed')}
                  className={clsx('grid aspect-[4/5] place-items-center rounded-[18px] px-1 text-center shadow-card transition-all duration-200',
                    matched.includes(c.pair) ? 'bg-success-50 opacity-70' : shown ? 'bg-surface' : 'bg-primary active:scale-95')}>
                  {shown ? <span className={c.isWord ? 'text-[16px] font-bold leading-5 text-ink' : 'text-[42px] leading-none'}>{c.face}</span>
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

