import { clsx } from 'clsx';
import type { GameResultOut } from '@rq/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../data/api';
import { ATTACK_WORDS, shuffle } from '../lib/gameContent';
import { useI18n } from '../lib/i18n';
import { haptic } from '../lib/telegram/webapp';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { GameOver } from '../components/games/GameOver';

const ROWS = ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'];
const LIVES = 3;
const norm = (w: string) => w.toLowerCase().replace(/ё/g, 'е');

interface Drop { id: number; word: string; x: number; y: number }

/** «Атака слов»: words fall from the sky — type them before they land. */
export function WordAttackScreen() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro');
  const [drops, setDrops] = useState<Drop[]>([]);
  const [input, setInput] = useState('');
  const [lives, setLives] = useState(LIVES);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState<GameResultOut | null>(null);
  const dropsRef = useRef<Drop[]>([]);
  const put = (ds: Drop[]) => { dropsRef.current = ds; setDrops(ds); };
  const g = useRef({ next: 0, id: 0, t0: 0, last: 0, bag: [] as string[] });

  const start = () => {
    g.current = { next: 0, id: 0, t0: Date.now(), last: Date.now(), bag: shuffle(ATTACK_WORDS) };
    put([]); setInput(''); setLives(LIVES); setScore(0); setHits(0); setResult(null); setPhase('play'); haptic.tap();
  };

  // game loop: move words down, spawn new ones, lose a life when one lands
  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => {
      const now = Date.now();
      const s = g.current;
      const dt = (now - s.last) / 1000; s.last = now;
      const age = (now - s.t0) / 1000;
      const speed = 9 + age * 0.25; // % of the field per second
      let landed = 0;
      let next = dropsRef.current.map((d) => ({ ...d, y: d.y + speed * dt })).filter((d) => (d.y >= 100 ? (landed++, false) : true));
      if (now >= s.next) {
        if (!s.bag.length) s.bag = shuffle(ATTACK_WORDS);
        const word = s.bag.pop()!;
        next = [...next, { id: ++s.id, word, x: 6 + Math.random() * 58, y: 0 }];
        s.next = now + Math.max(900, 2600 - age * 25);
      }
      put(next);
      if (landed) { setLives((l) => Math.max(0, l - landed)); haptic.error(); }
    }, 50);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => { if (phase === 'play' && lives <= 0) setPhase('done'); }, [lives, phase]);
  useEffect(() => {
    if (phase !== 'done') return;
    api().gameResult('attack', score).then(setResult, () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const press = useCallback((c: string) => {
    if (phase !== 'play') return;
    if (c === 'back') { setInput((s) => s.slice(0, -1)); return; }
    const typed = input + c;
    const hit = drops.find((d) => d.word === typed);
    if (hit) {
      put(dropsRef.current.filter((d) => d.id !== hit.id));
      setScore((s) => s + hit.word.length); setHits((n) => n + 1); setInput(''); haptic.success();
    } else if (drops.some((d) => d.word.startsWith(typed))) { setInput(typed); haptic.select(); }
    else { setInput(''); setShake(true); haptic.error(); setTimeout(() => setShake(false), 350); }
  }, [phase, input, drops]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') press('back');
      else if (/^[а-яё]$/i.test(e.key)) press(norm(e.key));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  if (phase === 'play') {
    return (
      <main className="mx-auto flex h-dvh max-w-[480px] flex-col gap-2 px-3" style={{ paddingTop: 'calc(var(--safe-top) + 14px)', paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}>
        <header className="flex items-center justify-between px-1.5">
          <span aria-label={t('attack.lives', { n: lives })} className="text-[20px] tracking-[2px]">{'❤️'.repeat(lives)}{'🤍'.repeat(LIVES - lives)}</span>
          <span className="font-display text-[26px] font-extrabold tabular-nums">{score}</span>
        </header>
        <div className="relative flex-1 overflow-hidden rounded-hero bg-gradient-to-b from-primary-50 to-surface shadow-card" aria-live="polite">
          {drops.map((d) => {
            const on = input && d.word.startsWith(input);
            return (
              <span key={d.id} className={clsx('absolute whitespace-nowrap rounded-[12px] px-2.5 py-1 font-display text-[19px] font-extrabold shadow-card', on ? 'bg-primary text-white' : 'bg-surface text-ink')}
                style={{ left: `${d.x}%`, top: `${d.y * 0.9}%` }}>
                {on ? <><span className="text-white/60">{input}</span>{d.word.slice(input.length)}</> : d.word}
              </span>
            );
          })}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-error/70" />
        </div>
        <div className={clsx('grid h-11 place-items-center rounded-[14px] bg-surface font-display text-[22px] font-extrabold uppercase tracking-[0.12em] shadow-card', shake && 'animate-[word-shake_0.35s] text-error')}>
          {input || <span className="text-[13px] font-semibold normal-case tracking-normal text-muted">{t('attack.type')}</span>}
        </div>
        <div className="flex flex-col gap-1.5" aria-label={t('word.keyboard')}>
          {ROWS.map((row, i) => (
            <div key={row} className="flex justify-center gap-1">
              {[...row].map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => press(c)} className="grid h-[48px] w-[7.8%] place-items-center rounded-[8px] bg-surface text-[17px] font-bold uppercase text-ink shadow-card active:scale-95">{c}</button>
              ))}
              {i === 2 && <button type="button" aria-label={t('word.erase')} onClick={() => press('back')} className="grid h-[48px] w-[15%] place-items-center rounded-[8px] bg-surface text-[19px] font-bold shadow-card active:scale-95">⌫</button>}
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <Screen className="flex flex-col gap-4">
      <ScreenHeader back="/games" title={t('attack.title')} />
      {phase === 'done' ? (
        <GameOver title={t('attack.done')} score={score} detail={t('attack.doneText', { n: hits })} result={result} onAgain={start} img="T11" />
      ) : (
        <>
          <section className="flex flex-col items-center gap-2 rounded-hero bg-surface p-6 text-center shadow-card">
            <img src="/3d/rq-3d-T11.webp" alt="" className="size-24 object-contain" />
            <h1 className="font-display text-[22px] font-bold">{t('attack.introTitle')}</h1>
            <p className="max-w-[300px] text-[14px] leading-5 text-ink-2">{t('attack.introText')}</p>
          </section>
          <button type="button" onClick={start} className="h-14 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{t('attack.start')}</button>
        </>
      )}
    </Screen>
  );
}
