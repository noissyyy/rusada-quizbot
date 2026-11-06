import { clsx } from 'clsx';
import type { LastWordMatch } from '@rq/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../data/api';
import { useI18n } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n/dict';
import { getWebApp, haptic } from '../lib/telegram/webapp';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon, Skeleton } from '../components/ui';
import { ErrorView } from '../components/states/StateViews';

const ROWS = ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'];
const ERR: Record<string, MessageKey> = { not_word: 'lastword.err.word', not_noun: 'lastword.err.noun', wrong_letter: 'lastword.err.letter', used: 'lastword.err.used' };
const POLL_MS = 3000;

export function shareMatch(m: LastWordMatch, text: string) {
  const url = `https://t.me/share/url?url=${encodeURIComponent(m.link)}&text=${encodeURIComponent(text)}`;
  const wa = getWebApp();
  if (wa) wa.openTelegramLink(url); else window.open(url, '_blank', 'noopener');
}

/** «Oxirgi harf» with a friend: turn by turn through the server, the other side is refreshed every few seconds. */
export function LastWordMatchScreen() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const nav = useNavigate();
  const [m, setM] = useState<LastWordMatch | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const list = useRef<HTMLOListElement>(null);
  const live = m && (m.status === 'playing' || m.status === 'waiting');
  const canMove = !!m && live && m.myTurn && (m.role === 'creator' || m.role === 'opponent' || m.role === 'new');

  const apply = useCallback((x: LastWordMatch) => {
    setM((old) => {
      if (!old || old.need !== x.need || old.myTurn !== x.myTurn) setInput(x.myTurn && x.need ? x.need : '');
      if (old && !old.myTurn && x.myTurn) haptic.success();
      return x;
    });
  }, []);

  useEffect(() => { api().match(id).then(apply, (e: Error) => setError(e)); }, [id, apply]);
  // the rival's moves arrive by polling while it is not our turn
  useEffect(() => {
    if (!live || m?.myTurn) return;
    const h = setInterval(() => { api().match(id).then(apply, () => undefined); }, POLL_MS);
    return () => clearInterval(h);
  }, [id, live, m?.myTurn, apply]);
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(h); }, []);
  useEffect(() => { list.current?.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [m?.words.length]);

  const send = useCallback(async () => {
    if (!m || busy || input.length < 2) return;
    setBusy(true); setMsg(null);
    try { apply(await api().matchMove(m.id, input)); haptic.success(); }
    catch (e) {
      haptic.error();
      const d = e instanceof ApiError ? e.detail : '';
      if (d === 'not_your_turn' || d === 'match_over' || d === 'match_full') { api().match(m.id).then(apply, () => undefined); }
      else setMsg(ERR[d] ? t(ERR[d]!, { l: (m.need ?? '').toUpperCase() }) : t('error.load'));
    } finally { setBusy(false); }
  }, [m, busy, input, apply, t]);

  const press = useCallback((c: string) => {
    if (!canMove) return;
    if (c === 'enter') { void send(); return; }
    if (c === 'back') { setInput((s) => (s.length > 1 ? s.slice(0, -1) : s)); return; }
    setInput((s) => (s.length < 20 ? s + c : s)); haptic.select();
  }, [canMove, send]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') press('enter');
      else if (e.key === 'Backspace') press('back');
      else if (/^[а-яё]$/i.test(e.key)) press(e.key.toLowerCase().replace('ё', 'е'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  if (error) return <ErrorView error={error} onRetry={() => location.reload()} />;
  if (!m) return <Screen className="flex flex-col gap-4"><ScreenHeader back="/games/lastword" title={t('lastword.title')} /><Skeleton className="h-96" /></Screen>;

  const left = Math.max(0, new Date(m.moveDeadline).getTime() - now);
  const hours = Math.floor(left / 3600_000), mins = Math.floor((left % 3600_000) / 60_000);
  const resign = async () => { setBusy(true); try { apply(await api().matchResign(m.id)); } catch { /* shown on next poll */ } finally { setBusy(false); } };
  const again = async () => { try { const x = await api().matchCreate(); nav(`/games/lastword/${x.id}`, { replace: true }); } catch { setMsg(t('error.load')); } };

  const banner = (() => {
    if (m.status === 'won' || m.status === 'lost') return null;
    if (m.role === 'full') return t('lastword.f.full');
    if (m.role === 'new') return m.myTurn ? t('lastword.f.invited', { n: m.rival ?? '' }) : t('lastword.f.creatorFirst');
    if (m.status === 'waiting') return t('lastword.f.waitingFriend');
    return m.myTurn ? t('lastword.f.yourTurn', { h: hours, m: mins }) : t('lastword.f.theirTurn', { n: m.rival ?? '' });
  })();

  return (
    <main className="mx-auto flex h-dvh max-w-[480px] flex-col gap-2 px-3" style={{ paddingTop: 'calc(var(--safe-top) + 14px)', paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}>
      <header className="flex items-center justify-between gap-2 px-1.5">
        <Link to="/games/lastword" aria-label={t('common.back')} className="grid size-10 place-items-center rounded-full bg-surface shadow-card"><Icon name="chevronRight" size={20} className="rotate-180" /></Link>
        <span className="min-w-0 truncate text-center font-display text-[15px] font-bold">{t('lastword.f.vs', { n: m.rival ?? '…' })}</span>
        {live && (m.role === 'creator' || m.role === 'opponent')
          ? <button type="button" disabled={busy} onClick={resign} className="h-9 shrink-0 rounded-full bg-surface px-3.5 text-[13px] font-bold text-ink-2 shadow-card">{t('lastword.giveUp')}</button>
          : <span className="w-10" />}
      </header>

      {banner && (
        <p role="status" className={clsx('rounded-[14px] px-3.5 py-2.5 text-center text-[13px] font-bold', m.myTurn ? 'bg-primary text-white' : 'bg-warning-50 text-warning-ink')}>{banner}</p>
      )}

      <ol ref={list} className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-hero bg-surface p-3 shadow-card" aria-live="polite">
        {m.words.map((w, i) => {
          const lastOne = i === m.words.length - 1 && live;
          const word = <>{w.word.slice(0, -1)}<span className={lastOne ? 'rounded-[6px] bg-warning px-0.5 text-white' : ''}>{w.word.slice(-1)}</span></>;
          return w.by === 'start'
            ? <li key={i} className="self-center rounded-full bg-canvas px-3.5 py-1.5 font-display text-[16px] font-bold text-ink-2">{t('lastword.f.start')} · {word}</li>
            : <li key={i} className={clsx('max-w-[75%] rounded-[18px] px-3.5 py-2 font-display text-[19px] font-bold', w.by === 'rival' ? 'self-start rounded-bl-[6px] bg-canvas text-ink' : 'self-end rounded-br-[6px] bg-primary text-white')}>{word}</li>;
        })}
      </ol>

      {m.status === 'won' || m.status === 'lost' ? (
        <section className="flex flex-col items-center gap-2 rounded-card bg-surface p-4 text-center shadow-card">
          <img src={`/3d/rq-3d-${m.status === 'won' ? 'R01' : 'G09'}.webp`} alt="" className="size-16 object-contain" />
          <b className="font-display text-[20px]">{m.status === 'won' ? t('lastword.f.won') : t('lastword.f.lost')}</b>
          <span className="text-[13px] text-ink-2">{t(m.endReason === 'timeout' ? 'lastword.f.byTimeout' : 'lastword.f.byResign')} · {t('lastword.doneText', { n: m.myWords })}</span>
          <button type="button" onClick={again} className="mt-1 h-12 w-full rounded-control bg-primary text-[15px] font-bold text-white shadow-primary">{t('lastword.f.again')}</button>
        </section>
      ) : m.status === 'waiting' || (m.role === 'creator' && !m.rival) ? (
        <button type="button" onClick={() => shareMatch(m, t('lastword.f.shareText'))} className="flex h-14 items-center justify-center gap-2 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">
          <Icon name="share" size={20} />{t('lastword.f.invite')}
        </button>
      ) : null}

      {msg && <p role="alert" className="text-center text-[13px] font-bold text-error-ink">{msg}</p>}
      {canMove && (
        <>
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
        </>
      )}
    </main>
  );
}
