import { clsx } from 'clsx';
import type { GameResultOut } from '@rq/shared-types';
import { useEffect, useState } from 'react';
import { api } from '../data/api';
import { MORPH_WORDS, shuffle, type MorphKind } from '../lib/gameContent';
import { useI18n } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n/dict';
import { haptic } from '../lib/telegram/webapp';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { GameOver } from '../components/games/GameOver';

const ROUNDS = 8;
type Word = [string, MorphKind][];
const KIND: Record<MorphKind, { cls: string; label: MessageKey }> = {
  p: { cls: 'bg-[#E9E4FF] text-[#5B3FD6]', label: 'morph.p' },
  r: { cls: 'bg-[#FFE6E9] text-[#C8213B]', label: 'morph.r' },
  s: { cls: 'bg-[#DDF5EC] text-[#11805A]', label: 'morph.s' },
  e: { cls: 'bg-[#FFF1D6] text-[#B26A00]', label: 'morph.e' },
};

/** «Мастерская слов»: build the word from its shuffled morphemes, then find the root. */
export function MorphScreen() {
  const { t } = useI18n();
  const [deck, setDeck] = useState<Word[]>(() => shuffle(MORPH_WORDS).slice(0, ROUNDS));
  const [i, setI] = useState(0);
  const [pool, setPool] = useState<number[]>([]);
  const [built, setBuilt] = useState<number[]>([]);
  const [stage, setStage] = useState<'build' | 'root' | 'shown'>('build');
  const [bad, setBad] = useState<number | null>(null);
  const [slips, setSlips] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<GameResultOut | null>(null);
  const word = deck[i];
  const done = i >= deck.length;

  useEffect(() => {
    if (!word) return;
    let order = shuffle(word.map((_, k) => k));
    if (word.length > 1 && order.every((v, k) => v === k)) order = [...order.slice(1), order[0]!];
    setPool(order); setBuilt([]); setStage('build'); setSlips(0); setBad(null);
  }, [word]);

  useEffect(() => {
    if (!done) return;
    haptic.success();
    api().gameResult('morph', score).then(setResult, () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const wrong = (k: number) => { setBad(k); setSlips((n) => n + 1); haptic.error(); setTimeout(() => setBad(null), 450); };

  const take = (k: number) => {
    if (!word || stage !== 'build') return;
    const need = built.length;
    // the same text twice in one word is interchangeable
    if (word[k]![0] !== word[need]![0]) { wrong(k); return; }
    haptic.select();
    const nb = [...built, need];
    setBuilt(nb); setPool((p) => p.filter((x) => x !== k));
    if (nb.length === word.length) setStage('root');
  };

  const pickRoot = (k: number) => {
    if (!word || stage !== 'root') return;
    if (word[k]![1] !== 'r') { wrong(k); return; }
    haptic.success();
    setScore((s) => s + Math.max(2, 10 - slips * 2));
    setStage('shown');
  };

  const again = () => { setDeck(shuffle(MORPH_WORDS).slice(0, ROUNDS)); setI(0); setScore(0); setResult(null); };

  return (
    <Screen className="flex flex-col gap-4">
      <ScreenHeader back="/games" title={t('morph.title')} />
      {done || !word ? (
        <GameOver title={t('morph.done')} score={score} detail={t('morph.doneText', { n: deck.length })} result={result} onAgain={again} img="T12" />
      ) : (
        <>
          <div className="flex items-center justify-between text-[13px] font-bold text-muted">
            <span>{t('morph.round', { n: i + 1, t: deck.length })}</span>
            <span className="font-display text-[18px] font-extrabold text-ink tabular-nums">{score}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-track"><div className="h-full bg-primary transition-[width]" style={{ width: `${(i / deck.length) * 100}%` }} /></div>

          <p className="mt-2 text-center text-[14px] font-semibold text-ink-2">
            {stage === 'build' ? t('morph.build') : stage === 'root' ? t('morph.findRoot') : t('morph.parts')}
          </p>

          <div className="flex min-h-[86px] flex-wrap items-end justify-center gap-1 rounded-card bg-surface p-4 shadow-card" aria-live="polite">
            {built.length === 0 && <span className="self-center text-[14px] text-muted">{t('morph.empty')}</span>}
            {built.map((k) => {
              const [text, kind] = word[k]!;
              const show = stage === 'shown';
              return (
                <button key={k} type="button" onClick={() => pickRoot(k)} disabled={stage !== 'root'}
                  className={clsx('flex flex-col items-center gap-1 rounded-[12px] px-2 py-1.5 transition-colors',
                    show ? KIND[kind].cls : bad === k ? 'bg-error text-white' : stage === 'root' ? 'bg-primary-50 text-ink active:scale-95' : 'text-ink')}>
                  <span className="font-display text-[30px] font-extrabold leading-none">{text}</span>
                  {show && <span className="text-[10px] font-bold uppercase tracking-wide">{t(KIND[kind].label)}</span>}
                </button>
              );
            })}
          </div>

          {stage === 'build' && (
            <div className="flex flex-wrap justify-center gap-2">
              {pool.map((k) => (
                <button key={k} type="button" onClick={() => take(k)}
                  className={clsx('h-14 min-w-[56px] rounded-[16px] px-4 font-display text-[24px] font-extrabold shadow-card transition-colors active:scale-95',
                    bad === k ? 'bg-error text-white' : 'bg-surface text-ink')}>{word[k]![0]}</button>
              ))}
            </div>
          )}

          {stage === 'shown' && (
            <>
              <div className="flex flex-wrap justify-center gap-1.5">
                {(['p', 'r', 's', 'e'] as const).filter((k) => word.some((m) => m[1] === k)).map((k) => (
                  <span key={k} className={clsx('rounded-full px-2.5 py-1 text-[12px] font-bold', KIND[k].cls)}>{t(KIND[k].label)}</span>
                ))}
              </div>
              <button type="button" onClick={() => setI((n) => n + 1)} className="h-14 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">
                {i + 1 < deck.length ? t('morph.next') : t('morph.finish')}
              </button>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
