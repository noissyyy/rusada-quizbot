import { clsx } from 'clsx';
import type { Duel, DuelStart } from '@rq/shared-types';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { getWebApp, haptic } from '../lib/telegram/webapp';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar, GradientDecor, Icon, Skeleton, toneStyle } from '../components/ui';
import { ErrorView } from '../components/states/StateViews';

const secs = (ms: number | null) => (ms == null ? '—' : `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`);

function shareDuel(d: Duel, text: string) {
  const url = `https://t.me/share/url?url=${encodeURIComponent(d.link)}&text=${encodeURIComponent(text)}`;
  const wa = getWebApp();
  if (wa) wa.openTelegramLink(url); else window.open(url, '_blank', 'noopener');
}

type T = ReturnType<typeof useI18n>['t'];
const OUTCOME = { win: 'duel.win', lose: 'duel.lose', draw: 'duel.draw' } as const;

function statusOf(d: Duel, t: T) {
  if (d.outcome) return { text: t(OUTCOME[d.outcome]), tone: d.outcome === 'win' ? 'bg-success-50 text-success-ink' : d.outcome === 'lose' ? 'bg-error-50 text-error-ink' : 'bg-track text-ink-2' };
  if (d.expired) return { text: t('duel.expired'), tone: 'bg-track text-muted' };
  if (!d.me?.finished) return { text: t('duel.yourTurn'), tone: 'bg-brand text-white' };
  if (!d.rival) return { text: t('duel.noRival'), tone: 'bg-warning-50 text-warning-ink' };
  return { text: t('duel.waiting'), tone: 'bg-warning-50 text-warning-ink' };
}

/** Duel hub: create a duel (any section or one), share it, see my duels. */
export function DuelHubScreen() {
  const { t } = useI18n();
  const nav = useNavigate();
  const topics = useAsync(() => api().getTopics());
  const duels = useAsync(() => api().duels());
  const [topic, setTopic] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const create = async () => {
    setBusy(true); setErr(null);
    try { const d = await api().duelCreate(topic); haptic.success(); nav(`/duel/${d.id}`); }
    catch (e) { setErr(e instanceof ApiError && e.detail === 'not_enough_questions' ? t('duel.fewQuestions') : t('error.load')); }
    finally { setBusy(false); }
  };
  return (
    <Screen className="flex flex-col gap-4">
      <ScreenHeader back="/" title={t('duel.title')} />
      <section style={toneStyle('ink')} className="relative overflow-hidden rounded-hero p-5 text-white">
        <GradientDecor />
        <img src="/3d/rq-3d-G01.webp" alt="" className="absolute -right-2 -top-1 size-[110px] object-contain" />
        <h1 className="max-w-[70%] font-display text-[22px] font-bold leading-7">{t('duel.heroTitle')}</h1>
        <p className="mt-1 max-w-[72%] text-[13px] leading-[18px] text-white/80">{t('duel.heroText')}</p>
      </section>
      <section className="flex flex-col gap-2.5">
        <b className="text-[15px]">{t('duel.pickTopic')}</b>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {[{ id: null as string | null, title: t('duel.mixed') }, ...(topics.status === 'success' ? topics.data.filter((x) => x.testsCount > 0) : [])].map((x) => (
            <button key={x.id ?? 'mix'} type="button" aria-pressed={topic === x.id} onClick={() => setTopic(x.id)}
              className={clsx('h-[38px] shrink-0 whitespace-nowrap rounded-full border px-4 text-[14px] font-semibold', topic === x.id ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink')}>{x.title}</button>
          ))}
        </div>
        {err && <p role="alert" className="text-[13px] font-semibold text-error-ink">{err}</p>}
        <button type="button" disabled={busy} onClick={create} className="h-14 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary disabled:opacity-60">{busy ? t('duel.creating') : t('duel.create')}</button>
      </section>
      <section className="flex flex-col gap-2.5">
        <b className="text-[15px]">{t('duel.mine')}</b>
        {duels.status === 'loading' && <Skeleton className="h-24" />}
        {duels.status === 'success' && duels.data.length === 0 && <p className="rounded-card bg-surface p-4 text-center text-[14px] text-muted shadow-card">{t('duel.none')}</p>}
        {duels.status === 'success' && duels.data.map((d) => {
          const st = statusOf(d, t);
          return (
            <Link key={d.id} to={`/duel/${d.id}`} className="flex items-center gap-3 rounded-[20px] bg-surface p-3.5 shadow-card">
              <Avatar name={d.rival?.name ?? '?'} size={42} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-bold">{d.rival?.name ?? t('duel.noRivalYet')}</span>
                <span className="truncate text-[12px] text-muted">{d.topicTitle ?? t('duel.mixed')} · {t('duel.qN', { n: d.questionsCount })}{d.me?.correct != null && d.rival?.correct != null ? ` · ${d.me.correct}:${d.rival.correct}` : ''}</span>
              </span>
              <span className={clsx('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold', st.tone)}>{st.text}</span>
            </Link>
          );
        })}
      </section>
    </Screen>
  );
}

/** One duel: intro → play → result. Opened from the hub or a shared Telegram link (?startapp=d_<id>). */
export function DuelScreen() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const [duel, setDuel] = useState<Duel | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [run, setRun] = useState<DuelStart | null>(null);
  const load = () => api().duel(id).then(setDuel, (e: Error) => setError(e));
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorView error={error} onRetry={load} />;
  if (!duel) return <Screen><Skeleton className="h-64" /></Screen>;
  if (run) return <DuelRun duelId={duel.id} start={run} onDone={(d) => { setRun(null); setDuel(d); }} />;

  const start = async () => {
    try { setRun(await api().duelStart(duel.id)); haptic.tap(); }
    catch (e) { if (e instanceof ApiError && e.status === 409) void load(); else setError(e as Error); }
  };
  const shareText = t('duel.shareText', { n: duel.questionsCount });
  const finished = duel.me?.finished;

  return (
    <Screen className="flex flex-col gap-4">
      <ScreenHeader back="/games/duel" title={t('duel.title')} />
      <section style={toneStyle('ink')} className="relative overflow-hidden rounded-hero p-5 text-white">
        <GradientDecor />
        <div className="relative flex items-center justify-between gap-2">
          <Side name={duel.me?.name ?? t('duel.you')} correct={finished ? duel.me?.correct ?? null : null} time={finished ? duel.me?.timeMs ?? null : null} />
          <span className="font-display text-[26px] font-extrabold text-white/60">VS</span>
          <Side name={duel.rival?.name ?? '?'} correct={duel.rival?.correct ?? null} time={duel.rival?.timeMs ?? null} waiting={!duel.rival || !duel.rival.finished} />
        </div>
        <p className="relative mt-3 text-center text-[12px] text-white/70">{duel.topicTitle ?? t('duel.mixed')} · {t('duel.qN', { n: duel.questionsCount })}</p>
      </section>

      {duel.outcome ? (
        <section className="flex flex-col items-center gap-1 rounded-card bg-surface p-5 text-center shadow-card">
          <img src={duel.outcome === 'win' ? '/3d/rq-3d-R01.webp' : duel.outcome === 'draw' ? '/3d/rq-3d-R02.webp' : '/3d/rq-3d-R03.webp'} alt="" className="size-20 object-contain" />
          <b className="font-display text-[24px]">{t(OUTCOME[duel.outcome])}</b>
          <span className="text-[13px] text-muted">{t('duel.rule')}</span>
        </section>
      ) : duel.role === 'full' ? (
        <p className="rounded-card bg-surface p-5 text-center text-body text-ink-2 shadow-card">{t('duel.full')}</p>
      ) : duel.expired ? (
        <p className="rounded-card bg-surface p-5 text-center text-body text-ink-2 shadow-card">{t('duel.expiredText')}</p>
      ) : finished ? (
        <p className="rounded-card bg-surface p-5 text-center text-body text-ink-2 shadow-card">{duel.rival ? t('duel.waitText', { n: duel.rival.name }) : t('duel.noRivalText')}</p>
      ) : (
        <p className="rounded-card bg-surface p-5 text-center text-body text-ink-2 shadow-card">
          {duel.role === 'new' ? t('duel.invited', { n: duel.rival?.name ?? '' }) : t('duel.readyText')}
        </p>
      )}

      {!finished && !duel.expired && duel.role !== 'full' && (
        <button type="button" onClick={start} className="h-14 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{duel.role === 'new' ? t('duel.accept') : t('duel.play')}</button>
      )}
      {duel.role === 'creator' && !duel.rival && !duel.expired && (
        <button type="button" onClick={() => shareDuel(duel, shareText)} className="flex h-[52px] items-center justify-center gap-2 rounded-control bg-primary-50 text-[15px] font-bold text-primary"><Icon name="share" size={18} />{t('duel.send')}</button>
      )}
      {duel.outcome && <Link to="/games/duel" className="flex h-[52px] items-center justify-center rounded-control bg-surface text-[15px] font-bold text-ink shadow-card">{t('duel.again')}</Link>}
    </Screen>
  );
}

function Side({ name, correct, time, waiting }: { name: string; correct: number | null; time: number | null; waiting?: boolean }) {
  return (
    <div className="flex w-[40%] flex-col items-center gap-1.5 text-center">
      <Avatar name={name} size={52} />
      <span className="w-full truncate text-[13px] font-bold">{name}</span>
      <span className="font-display text-[28px] font-extrabold leading-none tabular-nums">{correct ?? (waiting ? '…' : '?')}</span>
      <span className="text-[11px] text-white/60">{secs(time)}</span>
    </div>
  );
}

function DuelRun({ duelId, start, onDone }: { duelId: string; start: DuelStart; onDone: (d: Duel) => void }) {
  const { t } = useI18n();
  const qs = start.questions;
  const first = qs.findIndex((_, i) => !start.answered[String(i)]);
  const [i, setI] = useState(first === -1 ? qs.length - 1 : first);
  const [res, setRes] = useState<{ chosen: string; correct: boolean; correctOptionId: string } | null>(null);
  const [score, setScore] = useState(Object.values(start.answered).filter((a) => a.correct).length);
  const [now, setNow] = useState(Date.now());
  const t0 = useRef(Date.now());
  const [finishing, setFinishing] = useState(false);
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(h); }, []);
  const q = qs[i]!;

  const pick = async (optionId: string) => {
    if (res) return;
    const r = await api().duelAnswer(duelId, i, optionId);
    setRes({ chosen: optionId, ...r });
    if (r.correct) { setScore((s) => s + 1); haptic.success(); } else haptic.error();
  };
  const next = async () => {
    if (i + 1 < qs.length) { setI(i + 1); setRes(null); return; }
    setFinishing(true);
    onDone(await api().duelFinish(duelId));
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-[18px]" style={{ paddingTop: 'calc(var(--safe-top) + 20px)', paddingBottom: 'calc(var(--safe-bottom) + 110px)' }}>
      <header className="flex items-center justify-between">
        <span className="rounded-full bg-surface px-3 py-1.5 font-display text-[16px] font-extrabold tabular-nums shadow-card">⚔️ {score}</span>
        <span className="text-body font-bold">{t('review.progress', { i: i + 1, n: qs.length })}</span>
        <span className="rounded-full bg-surface px-3 py-1.5 font-display text-[16px] font-extrabold tabular-nums shadow-card">{secs(now - t0.current)}</span>
      </header>
      <div aria-hidden className="flex gap-1">{qs.map((x, k) => <span key={x.id} className={clsx('h-1.5 flex-1 rounded-full', k < i ? 'bg-primary/40' : k === i ? 'bg-primary' : 'bg-track')} />)}</div>
      <section className="rounded-card bg-surface p-5 shadow-card"><h1 className="text-[20px] font-bold leading-7">{q.text}</h1></section>
      <div role="radiogroup" aria-label={q.text} className="flex flex-col gap-2.5">
        {q.options.map((o) => {
          const ok = res && res.correctOptionId === o.id;
          const bad = res && res.chosen === o.id && !res.correct;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={res?.chosen === o.id} disabled={!!res} onClick={() => pick(o.id)}
              className={clsx('flex min-h-[58px] items-center gap-3 rounded-[18px] border-2 py-2 pl-2.5 pr-3.5 text-left text-[16px] font-semibold',
                ok ? 'border-success bg-success-50' : bad ? 'border-error bg-error-50' : 'border-transparent bg-surface shadow-card', res && !ok && !bad && 'opacity-45')}>
              <span className={clsx('grid size-[36px] shrink-0 place-items-center rounded-sm font-extrabold', ok ? 'bg-success text-white' : bad ? 'bg-error text-white' : 'bg-track text-ink-2')}>{o.label}</span>
              <span className="flex-1">{o.text}</span>
            </button>
          );
        })}
      </div>
      {res && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] bg-gradient-to-b from-canvas/0 via-canvas to-canvas px-[18px] pt-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}>
          <button type="button" disabled={finishing} onClick={next} className="h-14 w-full rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{i + 1 < qs.length ? t('quiz.next') : t('duel.finish')}</button>
        </div>
      )}
    </div>
  );
}
