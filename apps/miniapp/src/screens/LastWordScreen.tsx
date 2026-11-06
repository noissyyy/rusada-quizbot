import { clsx } from 'clsx';
import type { GameResultOut, LastWordMatch } from '@rq/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../data/api';
import { useI18n } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n/dict';
import { haptic } from '../lib/telegram/webapp';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { GameOver } from '../components/games/GameOver';

const TURN_MS = 30_000;
const ROWS = ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'];
const ERR: Record<string, MessageKey> = { not_word: 'lastword.err.word', not_noun: 'lastword.err.noun', wrong_letter: 'lastword.err.letter', used: 'lastword.err.used' };
interface Move { who: 'bot' | 'me'; word: string }

/** «Последнее слово»: a chain of nouns with the bot — each starts with the last letter of the previous one. */
export function LastWordScreen() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro');
  const [chain, setChain] = useState<Move[]>([]);
  const [need, setNeed] = useState('');
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(TURN_MS);
  const [won, setWon] = useState(false);
  const [result, setResult] = useState<GameResultOut | null>(null);
  const endAt = useRef(0);
  const nav = useNavigate();
  const [matches, setMatches] = useState<LastWordMatch[] | null>(null);
  useEffect(() => { api().matches().then(setMatches, () => setMatches([])); }, []);
  const withFriend = async () => {
    setBusy(true); setMsg(null);
    try { const x = await api().matchCreate(); haptic.tap(); nav(`/games/lastword/${x.id}`); }
    catch { setMsg(t('error.load')); } finally { setBusy(false); }
  };
  const list = useRef<HTMLOListElement>(null);
  const mine = chain.filter((m) => m.who === 'me').length;
  const score = mine * 5 + (won ? 20 : 0);

  const turn = (n: string) => { setNeed(n); setInput(n); endAt.current = Date.now() + TURN_MS; setLeft(TURN_MS); };

  const start = async () => {
    setBusy(true); setResult(null); setWon(false); setMsg(null);
    try {
      const s = await api().lastWordStart();
      setChain([{ who: 'bot', word: s.bot! }]); turn(s.need!); setPhase('play'); haptic.tap();
    } catch { setMsg(t('error.load')); } finally { setBusy(false); }
  };

  const finish = (win: boolean) => { setWon(win); setPhase('done'); if (win) haptic.success(); else haptic.error(); };

  useEffect(() => {
    if (phase !== 'play' || busy) return;
    const id = setInterval(() => { const r = endAt.current - Date.now(); setLeft(Math.max(0, r)); if (r <= 0) finish(false); }, 200);
    return () => clearInterval(id);
  }, [phase, busy]);

  useEffect(() => {
    if (phase !== 'done') return;
    api().gameResult('lastword', score).then(setResult, () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => { list.current?.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [chain]);

  const send = useCallback(async () => {
    if (busy || input.length < 2) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api().lastWordTurn(input, chain.map((m) => m.word));
      if (!r.ok) { setMsg(t(ERR[r.error ?? 'not_word'] ?? 'lastword.err.word', { l: (r.need ?? need).toUpperCase() })); haptic.error(); return; }
      const next: Move[] = [...chain, { who: 'me', word: r.word }];
      if (r.botGaveUp || !r.bot) { setChain(next); finish(true); return; }
      setChain([...next, { who: 'bot', word: r.bot }]); turn(r.need!); haptic.success();
    } catch { setMsg(t('error.load')); } finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, input, chain, need, t]);

  const press = useCallback((c: string) => {
    if (phase !== 'play') return;
    if (c === 'enter') { void send(); return; }
    if (c === 'back') { setInput((s) => (s.length > 1 ? s.slice(0, -1) : s)); return; }
    setInput((s) => (s.length < 20 ? s + c : s)); haptic.select();
  }, [phase, send]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') press('enter');
      else if (e.key === 'Backspace') press('back');
      else if (/^[а-яё]$/i.test(e.key)) press(e.key.toLowerCase().replace('ё', 'е'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  if (phase === 'play') {
    return (
      <main className="mx-auto flex h-dvh max-w-[480px] flex-col gap-2 px-3" style={{ paddingTop: 'calc(var(--safe-top) + 14px)', paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}>
        <header className="flex items-center justify-between gap-2 px-1.5">
          <button type="button" onClick={() => finish(false)} className="h-9 rounded-full bg-surface px-3.5 text-[13px] font-bold text-ink-2 shadow-card">{t('lastword.giveUp')}</button>
          <span className="font-display text-[15px] font-bold text-ink-2">{t('lastword.words', { n: mine })}</span>
          <span className={clsx('rounded-full px-3 py-1.5 font-display text-[16px] font-extrabold tabular-nums', left < 10_000 ? 'bg-error-50 text-error-ink' : 'bg-surface text-ink shadow-card')}>0:{String(Math.ceil(left / 1000)).padStart(2, '0')}</span>
        </header>
        <ol ref={list} className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-hero bg-surface p-3 shadow-card" aria-live="polite">
          {chain.map((m, i) => (
            <li key={i} className={clsx('max-w-[75%] rounded-[18px] px-3.5 py-2 font-display text-[19px] font-bold', m.who === 'bot' ? 'self-start rounded-bl-[6px] bg-canvas text-ink' : 'self-end rounded-br-[6px] bg-primary text-white')}>
              {m.word.slice(0, -1)}<span className={m.who === 'bot' && i === chain.length - 1 ? 'rounded-[6px] bg-warning px-0.5 text-white' : ''}>{m.word.slice(-1)}</span>
            </li>
          ))}
          {busy && <li className="self-start rounded-[18px] bg-canvas px-3.5 py-2 text-[19px] text-muted">…</li>}
        </ol>
        {msg && <p role="alert" className="text-center text-[13px] font-bold text-error-ink">{msg}</p>}
        <div className="flex h-12 items-center gap-2 rounded-[14px] bg-surface pl-4 pr-1 shadow-card">
          <span className="flex-1 font-display text-[22px] font-extrabold uppercase tracking-[0.08em]">{input}<span className="animate-pulse text-primary">|</span></span>
          <button type="button" disabled={busy || input.length < 2} onClick={() => void send()} className="h-10 rounded-[10px] bg-primary px-4 text-[14px] font-bold text-white disabled:opacity-50">{t('lastword.send')}</button>
        </div>
        <div className="flex flex-col gap-1.5" aria-label={t('word.keyboard')}>
          {ROWS.map((row, i) => (
            <div key={row} className="flex justify-center gap-1">
              {[...row].map((c) => <button key={c} type="button" aria-label={c} onClick={() => press(c)} className="grid h-[46px] w-[7.8%] place-items-center rounded-[8px] bg-surface text-[17px] font-bold uppercase text-ink shadow-card active:scale-95">{c}</button>)}
              {i === 2 && <button type="button" aria-label={t('word.erase')} onClick={() => press('back')} className="grid h-[46px] w-[15%] place-items-center rounded-[8px] bg-surface text-[19px] font-bold shadow-card active:scale-95">⌫</button>}
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <Screen className="flex flex-col gap-4">
      <ScreenHeader back="/games" title={t('lastword.title')} />
      {phase === 'done' ? (
        <GameOver title={won ? t('lastword.won') : t('lastword.lost')} score={score} detail={t('lastword.doneText', { n: mine })} result={result} onAgain={() => void start()} img={won ? 'R01' : 'G09'} />
      ) : (
        <>
          <section className="flex flex-col items-center gap-2 rounded-hero bg-surface p-6 text-center shadow-card">
            <img src="/3d/rq-3d-G09.webp" alt="" className="size-24 object-contain" />
            <h1 className="font-display text-[22px] font-bold">{t('lastword.introTitle')}</h1>
            <p className="max-w-[300px] text-[14px] leading-5 text-ink-2">{t('lastword.introText')}</p>
            <p className="mt-1 font-display text-[18px] font-bold">кошк<span className="rounded-[6px] bg-warning px-0.5 text-white">а</span> → <span className="rounded-[6px] bg-warning px-0.5 text-white">а</span>рбуз → <span className="rounded-[6px] bg-warning px-0.5 text-white">з</span>онт</p>
          </section>
          {msg && <p role="alert" className="text-center text-[13px] font-bold text-error-ink">{msg}</p>}
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" disabled={busy} onClick={() => void start()} className="flex h-[88px] flex-col items-center justify-center gap-1 rounded-[22px] bg-primary text-white shadow-primary disabled:opacity-50">
              <span aria-hidden className="text-[26px] leading-none">🤖</span><span className="text-[15px] font-bold">{t('lastword.withBot')}</span>
            </button>
            <button type="button" disabled={busy} onClick={() => void withFriend()} className="flex h-[88px] flex-col items-center justify-center gap-1 rounded-[22px] bg-surface text-primary shadow-card disabled:opacity-50">
              <span aria-hidden className="text-[26px] leading-none">👥</span><span className="text-[15px] font-bold">{t('lastword.withFriend')}</span>
            </button>
          </div>
          {matches && matches.length > 0 && (
            <section className="flex flex-col gap-2">
              <b className="text-[15px]">{t('lastword.f.mine')}</b>
              {matches.map((x) => {
                const st = x.status === 'won' ? ['lastword.f.st.won', 'bg-success-50 text-success-ink'] : x.status === 'lost' ? ['lastword.f.st.lost', 'bg-error-50 text-error-ink']
                  : x.status === 'waiting' ? ['lastword.f.st.waiting', 'bg-warning-50 text-warning-ink'] : x.myTurn ? ['lastword.f.st.my', 'bg-primary text-white'] : ['lastword.f.st.their', 'bg-track text-ink-2'];
                const last = x.words[x.words.length - 1]?.word ?? '';
                return (
                  <Link key={x.id} to={`/games/lastword/${x.id}`} className="flex items-center gap-3 rounded-[20px] bg-surface p-3.5 shadow-card">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="truncate text-[15px]">{x.rival ?? t('lastword.f.st.waiting')}</b>
                      <span className="truncate text-[12px] text-muted">{x.words.length - 1} · …{last}</span>
                    </span>
                    <span className={clsx('shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold', st[1])}>{t(st[0] as MessageKey)}</span>
                  </Link>
                );
              })}
            </section>
          )}
        </>
      )}
    </Screen>
  );
}
