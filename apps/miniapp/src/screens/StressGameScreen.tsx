import { clsx } from 'clsx';
import type { StressBoard, StressWord } from '@rq/shared-types';
import { useEffect, useRef, useState } from 'react';
import { api } from '../data/api';
import { markSeen, orderFresh } from '../lib/fresh';
import { useI18n } from '../lib/i18n';
import { haptic } from '../lib/telegram/webapp';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Skeleton } from '../components/ui';
import { ErrorView } from '../components/states/StateViews';

const ROUND_MS = 60_000;
const VOWELS = new Set('аеиоуыэюя');
const marked = (w: StressWord) => [...w.word].map((c, i) => (i === w.stress ? c.toUpperCase() : c)).join('');

/** «Urg‘u»: 60 seconds — tap the stressed vowel in as many words as you can. */
export function StressGameScreen() {
  const { t } = useI18n();
  const [words, setWords] = useState<StressWord[] | null>(null);
  const [board, setBoard] = useState<StressBoard | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro');
  const [deck, setDeck] = useState<StressWord[]>([]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [missed, setMissed] = useState<StressWord[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const [left, setLeft] = useState(ROUND_MS);
  const [record, setRecord] = useState(false);
  const endAt = useRef(0);

  useEffect(() => {
    Promise.all([api().stressWords(), api().stressBoard()]).then(([w, b]) => { setWords(w); setBoard(b); }, (e: Error) => setError(e));
  }, []);

  // round clock
  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => {
      const rest = endAt.current - Date.now();
      setLeft(Math.max(0, rest));
      if (rest <= 0) setPhase('done');
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  // save the result once the round ends
  useEffect(() => {
    if (phase !== 'done') return;
    const before = board?.best ?? 0;
    api().stressScore(score, answered).then((b) => { setBoard(b); setRecord(score > before && score > 0); }, () => undefined);
    haptic.success();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = () => {
    if (!words) return;
    setDeck(orderFresh('stress', words, (w) => w.word)); setI(0); setScore(0); setAnswered(0); setMissed([]); setPick(null); setRecord(false);
    endAt.current = Date.now() + ROUND_MS; setLeft(ROUND_MS); setPhase('play'); haptic.tap();
  };

  const tap = (idx: number) => {
    if (pick !== null || phase !== 'play') return;
    const w = deck[i % deck.length]!;
    const ok = idx === w.stress;
    setPick(idx); setAnswered((n) => n + 1);
    markSeen('stress', [w.word], words?.length ?? 0);
    if (ok) { setScore((s) => s + 1); haptic.success(); } else { setMissed((m) => [...m, w]); haptic.error(); }
    setTimeout(() => { setPick(null); setI((n) => n + 1); }, ok ? 300 : 900);
  };

  if (error) return <ErrorView error={error} onRetry={() => location.reload()} />;

  if (phase === 'play') {
    const w = deck[i % deck.length]!;
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-[18px]" style={{ paddingTop: 'calc(var(--safe-top) + 20px)', paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}>
        <header className="flex items-center justify-between">
          <span className="font-display text-[28px] font-extrabold tabular-nums">{score}</span>
          <span className={clsx('rounded-full px-3 py-1.5 font-display text-[18px] font-extrabold tabular-nums', left < 10_000 ? 'bg-error-50 text-error-ink' : 'bg-surface text-ink shadow-card')}>
            0:{String(Math.ceil(left / 1000)).padStart(2, '0')}
          </span>
        </header>
        <div className="h-1.5 overflow-hidden rounded-full bg-track"><div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${(left / ROUND_MS) * 100}%` }} /></div>
        <p className="mt-6 text-center text-[14px] font-semibold text-muted">{t('stress.tap')}</p>
        <div className="flex flex-wrap justify-center gap-1" aria-label={w.word}>
          {[...w.word].map((c, idx) => {
            const vowel = VOWELS.has(c);
            const right = pick !== null && idx === w.stress;
            const wrong = pick === idx && idx !== w.stress;
            return vowel ? (
              <button key={idx} type="button" onClick={() => tap(idx)} aria-label={c}
                className={clsx('grid h-[64px] min-w-[44px] place-items-center rounded-[14px] px-1 font-display text-[36px] font-extrabold uppercase transition-colors',
                  right ? 'bg-success text-white' : wrong ? 'bg-error text-white' : 'bg-primary-50 text-primary active:scale-95')}>{c}</button>
            ) : <span key={idx} className="grid h-[64px] min-w-[26px] place-items-center font-display text-[36px] font-extrabold uppercase text-ink">{c}</span>;
          })}
        </div>
        {pick !== null && pick !== w.stress && <p className="text-center font-display text-[22px] font-bold text-success-ink">{marked(w)}</p>}
      </main>
    );
  }

  return (
    <Screen className="flex flex-col gap-4">
      <ScreenHeader back="/" title={t('stress.title')} />
      {phase === 'done' ? (
        <section className="flex flex-col items-center gap-1 rounded-hero bg-surface p-6 text-center shadow-card">
          <img src="/3d/rq-3d-R01.webp" alt="" className="size-20 object-contain" />
          <span className="font-display text-[52px] font-extrabold leading-none tabular-nums">{score}</span>
          <span className="text-body text-ink-2">{t('stress.result', { n: answered })}</span>
          {record && <span className="mt-1 rounded-full bg-warning-50 px-3 py-1 text-[13px] font-bold text-warning-ink">🏆 {t('stress.record')}</span>}
        </section>
      ) : (
        <section className="flex flex-col items-center gap-2 rounded-hero bg-surface p-6 text-center shadow-card">
          <img src="/3d/rq-3d-G03.webp" alt="" className="size-24 object-contain" />
          <h1 className="font-display text-[22px] font-bold">{t('stress.introTitle')}</h1>
          <p className="max-w-[300px] text-[14px] leading-5 text-ink-2">{t('stress.introText')}</p>
          <p className="mt-1 font-display text-[20px] font-bold tracking-[0.04em]">звон<span className="rounded-[6px] bg-success px-1 text-white">И</span>т · т<span className="rounded-[6px] bg-success px-1 text-white">О</span>рты</p>
        </section>
      )}
      <button type="button" disabled={!words} onClick={start} className="h-14 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary disabled:opacity-50">
        {phase === 'done' ? t('stress.again') : t('stress.start')}
      </button>
      {phase === 'done' && missed.length > 0 && (
        <section className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-card">
          <b className="text-[15px]">{t('stress.missed')}</b>
          <div className="flex flex-wrap gap-1.5">{[...new Map(missed.map((m) => [m.word, m])).values()].map((m) => <span key={m.word} className="rounded-full bg-canvas px-3 py-1.5 font-display text-[15px] font-bold">{marked(m)}</span>)}</div>
        </section>
      )}
      {!board ? <Skeleton className="h-40" /> : (
        <section className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-card">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[[board.best, t('stress.best')], [board.bestWeek, t('stress.bestWeek')], [board.rounds, t('stress.rounds')]].map(([v, l]) => (
              <span key={String(l)} className="rounded-[14px] bg-canvas py-2"><b className="block font-display text-[20px] tabular-nums">{v}</b><span className="text-[11px] text-muted">{l}</span></span>
            ))}
          </div>
          {board.week.length > 0 && <b className="mt-2 text-[15px]">{t('stress.weekBoard')}</b>}
          <ol className="flex flex-col">
            {board.week.map((r) => (
              <li key={r.rank} className={clsx('flex items-center gap-3 rounded-[12px] px-2 py-2 text-[14px]', r.me && 'bg-primary-50 font-bold text-primary')}>
                <span className="w-5 text-center font-bold tabular-nums text-muted">{r.rank}</span>
                <span className="flex-1 truncate">{r.name}</span>
                <span className="font-display font-extrabold tabular-nums">{r.score}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </Screen>
  );
}
