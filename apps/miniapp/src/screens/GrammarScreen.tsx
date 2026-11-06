import { clsx } from 'clsx';
import type { GameResultOut } from '@rq/shared-types';
import { useEffect, useState } from 'react';
import { api } from '../data/api';
import { GRAMMAR_MODES, shuffle, type GrammarMode } from '../lib/gameContent';
import { useI18n } from '../lib/i18n';
import { haptic } from '../lib/telegram/webapp';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { GameOver } from '../components/games/GameOver';

const ROUNDS = 15;

/** «Грамматический пир»: put each word into its group — род or часть речи. */
export function GrammarScreen() {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<GrammarMode | null>(null);
  const [deck, setDeck] = useState<[string, string][]>([]);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [right, setRight] = useState(0);
  const [combo, setCombo] = useState(0);
  const [missed, setMissed] = useState<[string, string][]>([]);
  const [result, setResult] = useState<GameResultOut | null>(null);
  const done = mode !== null && i >= deck.length;
  const groupName = (id: string) => { const g = mode?.groups.find((x) => x.id === id); return g ? (lang === 'ru' ? g.ru : g.uz) : id; };

  useEffect(() => {
    if (!done) return;
    haptic.success();
    api().gameResult('grammar', score).then(setResult, () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const start = (m: GrammarMode) => { setMode(m); setDeck(shuffle(m.words).slice(0, ROUNDS)); setI(0); setScore(0); setRight(0); setCombo(0); setMissed([]); setPick(null); setResult(null); haptic.tap(); };

  const answer = (g: string) => {
    if (pick || done) return;
    const w = deck[i]!;
    setPick(g);
    if (g === w[1]) { setRight((n) => n + 1); setScore((s) => s + 4 + Math.min(combo, 4)); setCombo((c) => c + 1); haptic.success(); }
    else { setCombo(0); setMissed((m) => [...m, w]); haptic.error(); }
    setTimeout(() => { setPick(null); setI((n) => n + 1); }, g === w[1] ? 450 : 1200);
  };

  if (!mode) {
    return (
      <Screen className="flex flex-col gap-4">
        <ScreenHeader back="/games" title={t('grammar.title')} />
        <section className="flex flex-col items-center gap-2 rounded-hero bg-surface p-6 text-center shadow-card">
          <img src="/3d/rq-3d-T10.webp" alt="" className="size-24 object-contain" />
          <h1 className="font-display text-[22px] font-bold">{t('grammar.introTitle')}</h1>
          <p className="max-w-[300px] text-[14px] leading-5 text-ink-2">{t('grammar.introText')}</p>
        </section>
        {GRAMMAR_MODES.map((m) => (
          <button key={m.id} type="button" onClick={() => start(m)} className="flex items-center gap-3 rounded-card bg-surface p-4 text-left shadow-card active:scale-[0.99]">
            <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-primary-50 font-display text-[20px] font-extrabold text-primary">{m.id === 'gender' ? 'Р' : 'Ч'}</span>
            <span className="flex flex-1 flex-col">
              <b className="text-[16px]">{t(m.id === 'gender' ? 'grammar.gender' : 'grammar.pos')}</b>
              <span className="text-[13px] text-ink-2">{m.groups.map((g) => (lang === 'ru' ? g.ru : g.uz)).join(' · ')}</span>
            </span>
          </button>
        ))}
      </Screen>
    );
  }

  return (
    <Screen className="flex flex-col gap-4">
      <ScreenHeader back="/games" title={t('grammar.title')} />
      {done ? (
        <>
          <GameOver title={t('grammar.done')} score={score} detail={t('grammar.doneText', { r: right, n: deck.length })} result={result} onAgain={() => start(mode)} img="T10" />
          {missed.length > 0 && (
            <section className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-card">
              <b className="text-[15px]">{t('grammar.missed')}</b>
              {missed.map(([w, g]) => <span key={w} className="flex justify-between text-[14px]"><b className="font-display">{w}</b><span className="text-ink-2">{groupName(g)}</span></span>)}
            </section>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between text-[13px] font-bold text-muted">
            <span>{i + 1} / {deck.length}</span>
            {combo >= 2 && <span className="rounded-full bg-warning-50 px-2.5 py-1 text-warning-ink">🔥 ×{combo}</span>}
            <span className="font-display text-[18px] font-extrabold text-ink tabular-nums">{score}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-track"><div className="h-full bg-primary transition-[width]" style={{ width: `${(i / deck.length) * 100}%` }} /></div>
          <section className="mt-4 grid min-h-[140px] place-items-center rounded-hero bg-surface p-6 shadow-card">
            <span className="font-display text-[40px] font-extrabold">{deck[i]![0]}</span>
          </section>
          <div className={clsx('grid gap-2.5', mode.groups.length === 4 ? 'grid-cols-2' : 'grid-cols-3')}>
            {mode.groups.map((g) => {
              const isRight = pick !== null && g.id === deck[i]![1];
              const isWrong = pick === g.id && !isRight;
              return (
                <button key={g.id} type="button" onClick={() => answer(g.id)}
                  className={clsx('h-16 rounded-[18px] px-2 text-[15px] font-bold shadow-card transition-colors',
                    isRight ? 'bg-success text-white' : isWrong ? 'bg-error text-white' : 'bg-surface text-ink active:scale-95')}>
                  {lang === 'ru' ? g.ru : g.uz}
                </button>
              );
            })}
          </div>
        </>
      )}
    </Screen>
  );
}
