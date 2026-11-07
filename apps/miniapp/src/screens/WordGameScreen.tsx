import { clsx } from 'clsx';
import type { LetterMark, WordGame, WordStats } from '@rq/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../data/api';
import { useI18n } from '../lib/i18n';
import { getWebApp, haptic } from '../lib/telegram/webapp';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon, Skeleton } from '../components/ui';
import { ErrorView } from '../components/states/StateViews';

const BOT = (import.meta.env.VITE_BOT_USERNAME as string | undefined) ?? 'Rusada_QuizBot';
const ROWS = ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'];
const tile: Record<LetterMark, string> = {
  correct: 'border-success bg-success text-white',
  present: 'border-[#F5B30B] bg-[#F5B30B] text-white',
  absent: 'border-transparent bg-[#8D88A3] text-white',
};
const keyTone: Record<LetterMark, string> = { correct: 'bg-success text-white', present: 'bg-[#F5B30B] text-white', absent: 'bg-[#8D88A3]/70 text-white' };
const emoji: Record<LetterMark, string> = { correct: '🟩', present: '🟨', absent: '⬜' };

/** «So‘z topish»: the daily word (same for everyone) and unlimited practice. */
export function WordGameScreen() {
  const { t } = useI18n();
  const [mode, setMode] = useState<'daily' | 'practice'>('daily');
  const [game, setGame] = useState<WordGame | null>(null);
  const [stats, setStats] = useState<WordStats | null>(null);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const load = useCallback(async (m: 'daily' | 'practice') => {
    setGame(null); setInput(''); setMsg(null); setError(null);
    try {
      const [g, s] = await Promise.all([m === 'daily' ? api().wordDaily() : api().wordPractice(), api().wordStats()]);
      setGame(g); setStats(s);
    } catch (e) { setError(e as Error); }
  }, []);
  useEffect(() => { void load(mode); }, [mode, load]);

  const flash = (text: string) => { setMsg(text); setShake(true); haptic.error(); setTimeout(() => setShake(false), 450); setTimeout(() => setMsg(null), 1800); };

  const press = useCallback(async (key: string) => {
    if (!game || game.status !== 'playing' || busy) return;
    if (key === 'enter') {
      if (input.length < game.length) { flash(t('word.short')); return; }
      setBusy(true);
      try {
        const g = await api().wordGuess(game.id, input);
        setGame(g); setInput('');
        if (g.status === 'won') { haptic.success(); setStats(await api().wordStats()); }
        else if (g.status === 'lost') { haptic.error(); setStats(await api().wordStats()); }
        else haptic.select();
      } catch (e) { flash(e instanceof ApiError && e.status === 422 ? t(e.detail === 'not_a_word' ? 'word.unknown' : 'word.short') : t('error.load')); }
      finally { setBusy(false); }
      return;
    }
    if (key === 'back') { setInput((s) => s.slice(0, -1)); return; }
    if (input.length < game.length) { setInput((s) => s + key); haptic.select(); }
  }, [game, input, busy, t]);

  // a desktop keyboard works too
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') void press('enter');
      else if (e.key === 'Backspace') void press('back');
      else if (/^[а-яё]$/i.test(e.key)) void press(e.key.toLowerCase().replace('ё', 'е'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  if (error) return <ErrorView error={error} onRetry={() => load(mode)} />;

  const keyState: Record<string, LetterMark> = {};
  const rank = { absent: 0, present: 1, correct: 2 };
  for (const g of game?.guesses ?? []) [...g.word].forEach((c, i) => { const m = g.marks[i]!; if (!keyState[c] || rank[m] > rank[keyState[c]!]) keyState[c] = m; });

  const share = () => {
    if (!game) return;
    const score = game.status === 'won' ? `${game.guesses.length}/${game.tries}` : `X/${game.tries}`;
    const text = `Rusada · ${t('word.title')} #${game.number} ${score}\n${game.guesses.map((g) => g.marks.map((m) => emoji[m]).join('')).join('\n')}`;
    const link = `https://t.me/${BOT}?startapp=word`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    const wa = getWebApp();
    if (wa) wa.openTelegramLink(url); else window.open(url, '_blank', 'noopener');
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-3 px-3" style={{ paddingTop: 'calc(var(--safe-top) + 16px)', paddingBottom: 'calc(var(--safe-bottom) + 14px)' }}>
      <div className="px-1.5"><ScreenHeader back="/" title={t('word.title')} /></div>
      <div role="tablist" className="mx-1.5 grid grid-cols-2 gap-1 rounded-[14px] bg-track p-1">
        {(['daily', 'practice'] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={clsx('h-9 rounded-[10px] text-[13px] font-bold', mode === m ? 'bg-surface text-ink shadow-card' : 'text-muted')}>
            {m === 'daily' ? (game?.mode === 'daily' && game.number ? t('word.dailyN', { n: game.number }) : t('word.daily')) : t('word.practice')}
          </button>
        ))}
      </div>
      {stats && stats.streak > 0 && <p className="text-center text-[13px] font-bold text-ink-2">🔥 {t('word.streak', { n: stats.streak })}</p>}

      {!game ? <Skeleton className="mx-auto aspect-[5/6] w-full max-w-[330px]" /> : (
        <div className="relative mx-auto grid w-full max-w-[330px] gap-1.5" aria-label={t('word.title')}>
          {Array.from({ length: game.tries }, (_, r) => {
            const done = game.guesses[r];
            const isCurrent = !done && r === game.guesses.length && game.status === 'playing';
            const letters = done ? done.word : isCurrent ? input : '';
            return (
              <div key={r} className={clsx('grid grid-cols-5 gap-1.5', isCurrent && shake && 'animate-[word-shake_0.4s]')}>
                {Array.from({ length: game.length }, (_, c) => {
                  const ch = letters[c] ?? '';
                  return (
                    <span key={c} className={clsx('grid aspect-square place-items-center rounded-[10px] border-2 font-display text-[26px] font-extrabold uppercase',
                      done ? tile[done.marks[c]!] : ch ? 'border-ink/40 bg-surface text-ink' : 'border-line bg-surface')}>{ch}</span>
                  );
                })}
              </div>
            );
          })}
          {msg && <span role="alert" className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-night px-4 py-2 text-[13px] font-bold text-white shadow-raised">{msg}</span>}
        </div>
      )}

      {game && game.status !== 'playing' ? (
        <section className="mx-1.5 flex flex-col items-center gap-2 rounded-card bg-surface p-4 text-center shadow-card">
          <b className="font-display text-[20px]">{game.status === 'won' ? t('word.won', { n: game.guesses.length }) : t('word.lost')}</b>
          <span className="text-[14px] text-ink-2">{t('word.answer')} <b className="font-display uppercase tracking-[0.12em] text-ink">{game.answer}</b></span>
          {stats && (
            <div className="mt-1 grid w-full grid-cols-4 gap-1.5 text-center">
              {[[stats.played, t('word.played')], [stats.played ? Math.round((100 * stats.won) / stats.played) : 0, t('word.winRate')], [stats.streak, t('word.streakShort')], [stats.bestStreak, t('word.best')]].map(([v, l], i) => (
                <span key={i} className="rounded-[12px] bg-canvas py-2"><b className="block font-display text-[18px] tabular-nums">{v}{i === 1 ? '%' : ''}</b><span className="text-[10px] text-muted">{l}</span></span>
              ))}
            </div>
          )}
          <div className="mt-1 flex w-full gap-2">
            {game.mode === 'daily' && <button type="button" onClick={share} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-control bg-primary-50 text-[14px] font-bold text-primary"><Icon name="share" size={18} />{t('word.share')}</button>}
            <button type="button" onClick={() => (mode === 'practice' ? load('practice') : setMode('practice'))} className="h-12 flex-1 rounded-control bg-primary text-[14px] font-bold text-white shadow-primary">{t('word.more')}</button>
          </div>
          {game.mode === 'daily' && <span className="text-[12px] text-muted">{t('word.nextDaily')}</span>}
        </section>
      ) : (
        <div className="mt-auto flex flex-col gap-1.5" aria-label={t('word.keyboard')}>
          {ROWS.map((row, i) => (
            <div key={row} className="flex justify-center gap-1">
              {i === 2 && <Key wide onPress={() => press('back')} label="⌫" aria={t('word.erase')} />}
              {[...row].map((c) => <Key key={c} onPress={() => press(c)} label={c} tone={keyState[c]} />)}
              {i === 2 && <Key wide onPress={() => press('enter')} label="✓" aria={t('word.check')} primary />}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Key({ label, onPress, tone, wide, primary, aria }: { label: string; onPress: () => void; tone?: LetterMark; wide?: boolean; primary?: boolean; aria?: string }) {
  return (
    <button type="button" aria-label={aria ?? label} onClick={onPress}
      className={clsx('grid h-[50px] place-items-center rounded-[8px] text-[17px] font-bold uppercase shadow-card active:scale-95',
        wide ? 'w-[13%] text-[19px]' : 'w-[7.8%]', primary ? 'bg-primary text-white' : tone ? keyTone[tone] : 'bg-surface text-ink')}>
      {label}
    </button>
  );
}
