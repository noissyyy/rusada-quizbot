import { clsx } from 'clsx';
import type { LiveBoardEntry, LiveState } from '@rq/shared-types';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { getWebApp, haptic } from '../lib/telegram/webapp';
import { ScreenHeader, circleBtn } from '../components/ScreenHeader';
import { Avatar, Badge, GradientDecor, Icon, Skeleton, toneStyle } from '../components/ui';
import { ErrorView, LoadingView } from '../components/states/StateViews';

const BOT = (import.meta.env.VITE_BOT_USERNAME as string | undefined) ?? 'Rusada_QuizBot';
const page = 'mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-[18px]';
const pad = { paddingTop: 'calc(var(--safe-top) + 20px)', paddingBottom: 'calc(var(--safe-bottom) + 120px)' };
const Live = () => <Badge tone="live">LIVE</Badge>;

/** /live — enter a code or pick a live that is on air now. */
export function LiveHubScreen() {
  const { t } = useI18n();
  const nav = useNavigate();
  const list = useAsync(() => api().listLive());
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const join = async (c: string) => {
    setBusy(true); setErr(false);
    try { const s = await api().joinLive(c); haptic.success(); nav(`/live/${s.id}`); } catch { setErr(true); haptic.error(); } finally { setBusy(false); }
  };
  return (
    <main className={page} style={pad}>
      <ScreenHeader back="/" title={t('live.title')} right={<Live />} />
      <section style={toneStyle('ink')} className="relative overflow-hidden rounded-hero p-5 text-white">
        <GradientDecor />
        <img src="/3d/rq-3d-L02.webp" alt="" className="absolute -right-2 top-1 size-[120px] object-contain" />
        <h1 className="relative max-w-[64%] font-display text-[22px] font-bold leading-7">{t('live.enterCode')}</h1>
        <p className="mt-1 max-w-[64%] text-caption text-white/70">{t('live.codeHint')}</p>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.length === 4) void join(code); }}>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={code} aria-label={t('live.code')} aria-invalid={err}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="h-14 min-w-0 flex-1 rounded-control bg-white/12 px-4 text-center font-display text-[28px] font-extrabold tracking-[0.3em] text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-primary"
            placeholder="0000" />
          <button type="submit" disabled={code.length !== 4 || busy} className="h-14 rounded-control bg-primary px-5 text-[16px] font-bold text-white disabled:opacity-40">{t('live.join')}</button>
        </form>
        {err && <p role="alert" className="mt-2 text-caption font-semibold text-[#FFB4BF]">{t('live.notFound')}</p>}
      </section>
      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-title font-bold">{t('live.open')}</h2>
        {list.status === 'loading' && <Skeleton className="h-20" />}
        {list.status === 'success' && list.data.length === 0 && <p className="rounded-[20px] bg-surface p-4 text-caption text-ink-2 shadow-card">{t('live.none')}</p>}
        {list.status === 'success' && list.data.map((l) => (
          <button key={l.id} type="button" onClick={() => void join(l.code)} className="flex items-center gap-3 rounded-[20px] bg-surface p-4 text-left shadow-card">
            <span className="grid size-12 shrink-0 place-items-center rounded-control bg-night text-white"><Icon name="broadcast" size={24} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold">{l.title}</span><span className="text-caption text-muted">{l.hostName ? `${t('live.host', { n: l.hostName })} · ` : ''}{t('live.people', { n: l.participants })}</span></span>
            <Icon name="chevronRight" size={18} className="text-muted" />
          </button>
        ))}
      </section>
    </main>
  );
}

/** /live/:id — lobby → question → answer accepted → reveal → … → final. Server-driven. */
export function LiveRoomScreen() {
  const { id = '' } = useParams();
  const [state, setState] = useState<LiveState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const lastQ = useRef(-1);

  useEffect(() => {
    let alive = true;
    const accept = (s: LiveState) => {
      if (!alive) return;
      setState(s); setReceivedAt(Date.now());
      if (s.state === 'question' && s.index !== lastQ.current) { lastQ.current = s.index; haptic.tap(); }
    };
    api().getLive(id).then(accept, (e: Error) => alive && setError(e));
    const off = api().subscribeLive(id, accept);
    return () => { alive = false; off(); };
  }, [id, nonce]);

  useEffect(() => { const h = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(h); }, []);
  useEffect(() => {
    const wa = getWebApp();
    if (state && state.state !== 'finished') wa?.enableClosingConfirmation();
    return () => wa?.disableClosingConfirmation();
  }, [state?.state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorView error={error} onRetry={() => { setError(null); setNonce((n) => n + 1); }} />;
  if (!state) return <LoadingView />;
  const left = state.paused ? state.remainingMs : Math.max(0, state.remainingMs - (now - receivedAt));
  const patch = (s: LiveState) => { setState(s); setReceivedAt(Date.now()); };

  switch (state.state) {
    case 'lobby': return <Lobby s={state} onUpdate={patch} />;
    case 'question': return <Question s={state} leftMs={left} onUpdate={patch} />;
    case 'reveal': return <Reveal s={state} sinceMs={now - receivedAt} />;
    default: return <Final s={state} />;
  }
}

/** 17 · Эфир: лобби */
function Lobby({ s, onUpdate }: { s: LiveState; onUpdate: (s: LiveState) => void }) {
  const { t } = useI18n();
  const me = s.players.find((p) => p.me);
  const others = Math.max(0, s.participantsCount - s.players.length);
  const ready = async () => { haptic.tap(); onUpdate(await api().liveReady(s.id)); };
  const invite = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${BOT}?startapp=l_${s.id}`)}&text=${encodeURIComponent(`${s.title} · ${s.code}`)}`;
    const wa = getWebApp(); if (wa) wa.openTelegramLink(url); else window.open(url, '_blank');
  };
  return (
    <main className={page} style={pad}>
      <header className="flex items-center justify-between">
        <Link to="/live" aria-label={t('common.back')} className={circleBtn}><Icon name="chevronRight" size={22} className="rotate-180" /></Link>
        <span className="text-[17px] font-bold">{t('live.title')}</span><Live />
      </header>
      <section style={toneStyle('ink')} className="relative flex flex-col gap-1.5 overflow-hidden rounded-hero p-5 text-white">
        <GradientDecor />
        <img src="/3d/rq-3d-L02.webp" alt="" className="absolute -right-1.5 top-1.5 size-[132px] object-contain" />
        {s.hostName && <span className="text-[12px] font-semibold text-white/72">{t('live.host', { n: s.hostName })}</span>}
        <h1 className="max-w-[64%] font-display text-[24px] font-bold leading-7 tracking-tight">{s.title}</h1>
        <span className="mt-2.5 text-[12px] font-semibold text-white/72">{t('live.code')}</span>
        <div className="flex items-center gap-2.5">
          <span className="font-display text-[30px] font-extrabold tracking-[0.12em]">{s.code}</span>
          <button type="button" aria-label={t('live.copy')} onClick={() => void navigator.clipboard?.writeText(s.code)} className="grid size-9 place-items-center rounded-sm bg-white/14"><Icon name="copy" size={18} /></button>
        </div>
        <div className="mt-2 flex gap-2">
          {[t('live.questions', { n: s.questionsCount }), t('live.perQuestion', { s: s.questionSec })].map((x) => <span key={x} className="inline-flex h-7 items-center rounded-full bg-white/12 px-2.5 text-[12px] font-bold">{x}</span>)}
        </div>
      </section>
      <div role="status" className="flex items-center gap-3.5 rounded-[20px] bg-surface p-4 shadow-card">
        <span aria-hidden className="size-10 shrink-0 animate-spin rounded-full border-4 border-primary-50 border-t-primary" />
        <div><div className="text-[15px] font-bold">{t('live.waitTitle')}</div><div className="text-caption text-muted">{t('live.waitText')}</div></div>
      </div>
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between"><h2 className="font-display text-title font-bold">{t('live.players')}</h2><Badge tone="primary">{t('live.inLobby', { n: s.participantsCount, r: s.readyCount })}</Badge></div>
        <div className="flex flex-wrap gap-2">
          {s.players.map((p) => (
            <span key={p.userId} className="inline-flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-[13px] font-semibold shadow-card">
              <Avatar name={p.name} src={p.photoUrl} size={28} className={p.me ? '!bg-primary !text-white' : ''} />{p.me ? t('live.you') : p.name}
              {p.ready && <Icon name="check" size={14} strokeWidth={2.6} className="text-success" />}
            </span>
          ))}
          {others > 0 && <span className="inline-flex h-9 items-center rounded-full bg-track px-3 text-[13px] font-bold text-ink-2">+{others}</span>}
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[480px] gap-2.5 bg-gradient-to-b from-canvas/0 via-canvas to-canvas px-[18px] pt-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
        <button type="button" aria-label={t('live.invite')} onClick={invite} className="grid size-14 shrink-0 place-items-center rounded-control bg-surface shadow-card"><Icon name="upload" size={22} /></button>
        <button type="button" onClick={ready} disabled={me?.ready} className="h-14 flex-1 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary disabled:bg-primary-50 disabled:text-primary disabled:shadow-none">
          {me?.ready ? t('live.readyDone') : t('live.ready')}
        </button>
      </div>
    </main>
  );
}

function Ring({ leftMs, totalSec }: { leftMs: number; totalSec: number }) {
  const { t } = useI18n();
  const sec = Math.ceil(leftMs / 1000);
  const c = 2 * Math.PI * 23;
  const frac = Math.max(0, Math.min(1, leftMs / (totalSec * 1000)));
  return (
    <div role="timer" aria-label={t('live.secLeft', { s: sec })} className="relative size-[52px] shrink-0">
      <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden className="-rotate-90">
        <circle cx="26" cy="26" r="23" fill="#fff" stroke="var(--color-track)" strokeWidth="5" />
        <circle cx="26" cy="26" r="23" fill="none" stroke={sec <= 5 ? 'var(--color-warning)' : 'var(--color-primary)'} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-[17px] font-extrabold tabular-nums">{sec}</span>
    </div>
  );
}

function LiveHeader({ s, sub, right }: { s: LiveState; sub: string; right?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <header className="flex items-center justify-between gap-3">
      <Live />
      <div className="text-center"><div className="text-[15px] font-bold">{t('quiz.question', { i: s.index + 1, n: s.questionsCount })}</div><div className="text-micro font-semibold text-muted">{sub}</div></div>
      {right ?? <span className="w-[54px]" />}
    </header>
  );
}

/** 06/18 · question, then «Ответ принят» once answered */
function Question({ s, leftMs, onUpdate }: { s: LiveState; leftMs: number; onUpdate: (s: LiveState) => void }) {
  const { t } = useI18n();
  const [sending, setSending] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const q = s.question!;
  const mine = s.myAnswer ?? sending;
  const pick = async (optionId: string) => {
    if (mine || leftMs <= 0 || s.paused) return;
    setSending(optionId); haptic.select();
    try { onUpdate(await api().liveAnswer(s.id, s.index, optionId)); } catch (e) { if (e instanceof ApiError) setRejected(true); setSending(null); }
  };
  return (
    <main className={page} style={pad}>
      <LiveHeader s={s} sub={t('live.people', { n: s.participantsCount })} right={<Ring leftMs={leftMs} totalSec={s.questionSec} />} />
      {s.paused && <div role="status" className="rounded-control bg-warning-50 px-4 py-3 text-caption font-bold text-warning-ink">{t('live.paused')}</div>}
      <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card">
        <span className="self-start rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-bold text-primary">{t('quiz.points', { p: q.points })}</span>
        <h1 className="text-[21px] font-bold leading-7">{q.text}</h1>
      </section>
      <div role="radiogroup" aria-label={q.text} className="flex flex-col gap-2.5">
        {q.options.map((o) => {
          const sel = mine === o.id;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={sel} disabled={Boolean(mine) || leftMs <= 0 || s.paused} onClick={() => void pick(o.id)}
              className={clsx('flex min-h-[58px] items-center gap-3 rounded-[18px] border-2 py-2.5 pl-2.5 pr-3.5 text-left text-[16px] font-semibold',
                sel ? 'border-primary bg-primary-50' : 'border-transparent bg-surface shadow-card', mine && !sel && 'opacity-45')}>
              <span className={clsx('grid size-9 shrink-0 place-items-center rounded-sm font-extrabold', sel ? 'bg-primary text-white' : 'bg-track text-ink-2')}>{o.label}</span>
              <span className="flex-1">{o.text}</span>
              {sel && <Icon name="lock" size={20} className="text-primary" aria-label={t('live.lock')} />}
            </button>
          );
        })}
      </div>
      {mine && (
        <div role="status" className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-4 shadow-card">
          <div className="flex items-center gap-3">
            <span aria-hidden className="size-[34px] shrink-0 animate-spin rounded-full border-4 border-primary-50 border-t-primary" />
            <div><div className="text-[15px] font-bold">{t('live.accepted')}</div><div className="text-caption text-muted">{t('live.acceptedText')}</div></div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track"><div className="h-full bg-primary" style={{ width: `${(100 * s.answeredCount) / Math.max(1, s.participantsCount)}%` }} /></div>
            <span className="text-[12px] font-bold text-ink-2">{t('live.answered', { a: s.answeredCount, n: s.participantsCount })}</span>
          </div>
        </div>
      )}
      {rejected && !mine && <p role="alert" className="text-caption font-semibold text-error-ink">{t('live.timeUpAll')}</p>}
    </main>
  );
}

function BoardRows({ rows, delta }: { rows: LiveBoardEntry[]; delta?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((e) => (
        <div key={e.userId} className={clsx('flex items-center gap-3 rounded-[18px] px-3.5 py-2.5', e.me ? 'bg-primary text-white shadow-primary' : 'bg-surface shadow-card')}>
          <span className={clsx('w-[22px] text-center font-extrabold', e.me ? 'text-white/80' : e.rank === 1 ? 'text-[#8A6100]' : 'text-muted')}>{e.rank}</span>
          <span className="min-w-0 truncate text-[15px] font-bold">{e.name}</span>
          {delta && e.delta > 0 && <span className={clsx('rounded-[10px] px-2 py-0.5 text-[12px] font-bold', e.me ? 'bg-white/20' : 'bg-success-50 text-success-ink')}>↑ {e.delta}</span>}
          <span className="ml-auto font-extrabold tabular-nums">{e.points.toLocaleString('ru-RU')}</span>
        </div>
      ))}
    </div>
  );
}

function withMe(s: LiveState) {
  const top = s.leaderboard.slice(0, 4);
  return s.meEntry && !top.some((e) => e.me) ? [...top, s.meEntry] : top;
}

/** 19 · Эфир: результат вопроса */
function Reveal({ s, sinceMs }: { s: LiveState; sinceMs: number }) {
  const { t } = useI18n();
  const r = s.reveal!;
  const ok = r.myOutcome === 'correct';
  const none = r.myOutcome === 'unanswered';
  const left = Math.max(0, s.revealMs - sinceMs);
  const last = s.index + 1 >= s.questionsCount;
  useEffect(() => { if (ok) haptic.success(); else haptic.error(); }, [s.index]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <main className={page} style={pad}>
      <LiveHeader s={s} sub={t('live.timeUpAll')} />
      <section role="status" className="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
        <div className="flex items-center gap-3">
          <span className={clsx('grid size-[52px] shrink-0 place-items-center rounded-[18px] text-white', ok ? 'bg-success' : none ? 'bg-warning' : 'bg-error')}>
            <Icon name={ok ? 'check' : none ? 'hourglass' : 'x'} size={26} strokeWidth={2.6} />
          </span>
          <div><div className="font-display text-[22px] font-extrabold">{ok ? t('quiz.correct') : none ? t('live.noAnswer') : t('quiz.wrong')}</div><div className="text-caption text-muted">{t('live.rightCount', { a: r.correctCount, n: s.participantsCount })}</div></div>
          <span className={clsx('ml-auto rounded-full px-3 py-1.5 text-[15px] font-extrabold', ok ? 'bg-success-50 text-success-ink' : 'bg-track text-muted')}>+{r.myPoints}</span>
        </div>
        <div className="text-[14px] text-muted">{t('quiz.correctAnswer')} <b className="text-ink">{r.correctText}</b></div>
        {r.explanation && <div className="rounded-control bg-canvas px-3.5 py-3 text-[14px] leading-5 text-ink-2">{r.explanation}</div>}
      </section>
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between"><h2 className="font-display text-title font-bold">{t('live.board')}</h2><span className="text-micro font-semibold text-muted">{t('live.afterQ', { n: s.index + 1 })}</span></div>
        <BoardRows rows={withMe(s)} delta />
      </section>
      {!last && (
        <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[480px] flex-col items-center gap-2 px-[18px]" style={{ paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
          <div role="progressbar" aria-label={t('live.nextIn', { s: Math.ceil(left / 1000) })} aria-valuemin={0} aria-valuemax={s.revealMs} aria-valuenow={s.revealMs - left} className="h-1 w-full overflow-hidden rounded-full bg-track">
            <div className="h-full bg-primary" style={{ width: `${(100 * (s.revealMs - left)) / s.revealMs}%` }} />
          </div>
          <span className="text-caption font-semibold text-muted">{t('live.nextIn', { s: Math.ceil(left / 1000) })}</span>
        </div>
      )}
    </main>
  );
}

/** 19b · Эфир завершён */
function Final({ s }: { s: LiveState }) {
  const { t } = useI18n();
  const f = s.final;
  const share = () => {
    const text = f ? `${s.title}: ${t('live.place', { r: f.rank, n: f.total })} · ${f.points}` : s.title;
    const url = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${BOT}`)}&text=${encodeURIComponent(text)}`;
    const wa = getWebApp(); if (wa) wa.openTelegramLink(url); else window.open(url, '_blank');
  };
  return (
    <main className={page} style={{ ...pad, paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
      <ScreenHeader back="/" title={t('live.finished')} />
      <section className="flex flex-col items-center gap-1 text-center">
        <img src="/3d/rq-3d-L01.webp" alt="" className="size-[150px] object-contain" />
        <span className="text-caption font-semibold text-muted">{t('live.finished')} · {s.title}</span>
        {f ? (
          <>
            <h1 className="font-display text-[34px] font-extrabold tracking-tight">{t('live.place', { r: f.rank, n: f.total })}</h1>
            <span className="text-[14px] text-muted">{t('live.finalLine', { p: f.points.toLocaleString('ru-RU'), c: f.correct, q: s.questionsCount })}</span>
          </>
        ) : <h1 className="font-display text-[28px] font-extrabold">{t('live.finished')}</h1>}
      </section>
      <BoardRows rows={withMe(s)} />
      <div className="mt-auto flex flex-col gap-2.5">
        <button type="button" onClick={share} className="flex h-14 items-center justify-center gap-2 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary"><Icon name="share" size={20} />{t('result.share')}</button>
        <Link to="/" replace className="flex h-[52px] items-center justify-center rounded-control bg-surface text-[15px] font-bold text-ink shadow-card">{t('result.home')}</Link>
      </div>
    </main>
  );
}
