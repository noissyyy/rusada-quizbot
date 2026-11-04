import { clsx } from 'clsx';
import type { GroupBoardEntry } from '@rq/shared-types';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { getWebApp, haptic } from '../lib/telegram/webapp';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar, Icon } from '../components/ui';
import { ErrorView, LoadingView } from '../components/states/StateViews';

const page = 'mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-[18px]';
const pad = { paddingTop: 'calc(var(--safe-top) + 20px)', paddingBottom: 'calc(var(--safe-bottom) + 130px)' };

function useDeadline() {
  const { lang } = useI18n();
  return (iso: string | null) => (iso ? new Date(iso).toLocaleString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—');
}

function Board({ rows }: { rows: GroupBoardEntry[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((e) => (
        <li key={`${e.rank}-${e.name}`} aria-current={e.me || undefined}
          className={clsx('flex items-center gap-3 rounded-[18px] px-3.5 py-2.5', e.me ? 'bg-primary text-white shadow-primary' : 'bg-surface shadow-card')}>
          <span className={clsx('w-[22px] text-center font-extrabold', e.me ? 'text-white/80' : e.rank === 1 ? 'text-[#8A6100]' : 'text-muted')}>{e.rank}</span>
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{e.name}</span>
          <span className="font-extrabold tabular-nums">{e.points.toLocaleString('ru-RU')}</span>
        </li>
      ))}
    </ol>
  );
}

/** 16 · Тест в группе (opened from the bot's message in a Telegram group) */
export function GroupJoinScreen() {
  const { aid = '' } = useParams();
  const { t } = useI18n();
  const deadline = useDeadline();
  const nav = useNavigate();
  const state = useAsync(() => api().getGroupAssignment(aid), [aid]);
  if (state.status === 'loading') return <LoadingView />;
  if (state.status === 'error') return <ErrorView error={state.error} onRetry={state.reload} />;
  const g = state.data;
  if (g.access !== 'ok' && !g.mySessionId) return <AccessErrorView group={g.groupTitle} link={g.groupLink} reason={g.access === 'closed' ? 'closed' : 'member'} />;
  const done = g.myStatus === 'finished' || g.myStatus === 'timed_out';

  return (
    <main className={page} style={pad}>
      <ScreenHeader back="/" title={t('group.title')} />
      <section className="relative overflow-hidden rounded-hero bg-mode-group p-5 text-white shadow-[0_8px_18px_rgba(11,125,120,.25)]">
        <img src="/3d/rq-3d-M03.webp" alt="" className="absolute -right-2 top-2 size-[120px] object-contain" />
        <span className="text-[12px] font-semibold text-white/75">{g.groupTitle}</span>
        <h1 className="mt-1 max-w-[64%] font-display text-[24px] font-bold leading-7 tracking-tight">{g.quizTitle}</h1>
        {g.authorName && <span className="mt-2 block text-[12px] font-semibold text-white/75">{t('group.sentBy', { n: g.authorName })}</span>}
        <div className="mt-3 flex flex-wrap gap-2">
          {[t('live.questions', { n: g.questionsCount }), t('group.minutes', { m: g.durationMinutes }), t('group.until', { d: deadline(g.closesAt) })].map((x) => (
            <span key={x} className="inline-flex h-7 items-center rounded-full bg-white/15 px-2.5 text-[12px] font-bold">{x}</span>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 rounded-[20px] bg-surface p-4 shadow-card">
        <span className="flex -space-x-2">{g.previewNames.map((n) => <Avatar key={n} name={n} size={34} />)}</span>
        <span><span className="block font-display text-[18px] font-extrabold">{t('group.passed', { a: g.passed, n: g.members })}</span><span className="text-caption text-muted">{t('group.passedLabel')}</span></span>
      </div>

      {g.leaderboard.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between"><h2 className="font-display text-title font-bold">{t('group.board')}</h2><span className="text-micro font-semibold text-muted">{t('group.boardNote')}</span></div>
          <Board rows={g.leaderboard} />
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[480px] flex-col gap-2 bg-gradient-to-b from-canvas/0 via-canvas to-canvas px-[18px] pt-4 text-center" style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}>
        {done ? (
          <button type="button" onClick={() => nav(`/group/${aid}/result`)} className="h-14 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{t('group.showResult')}</button>
        ) : (
          <button type="button" onClick={() => { haptic.tap(); nav(`/quiz/${g.quizId}?a=${aid}`); }} className="h-14 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{t('group.start')}</button>
        )}
        <span className="text-micro font-semibold text-muted">{done ? t('group.done') : t('group.once')}</span>
      </div>
    </main>
  );
}

/** 16b · Результат в группе */
export function GroupResultScreen() {
  const { aid = '' } = useParams();
  const { t } = useI18n();
  const deadline = useDeadline();
  const state = useAsync(() => api().getGroupResult(aid), [aid]);
  const [sent, setSent] = useState(false);
  if (state.status === 'loading') return <LoadingView />;
  if (state.status === 'error') return <ErrorView error={state.error} onRetry={state.reload} />;
  const r = state.data;
  const send = async () => { haptic.tap(); await api().shareGroupResult(aid); setSent(true); haptic.success(); };
  return (
    <main className={page} style={{ ...pad, paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
      <ScreenHeader back="/" title={t('group.resultTitle')} />
      <section className="flex flex-col items-center gap-1 text-center">
        <img src="/3d/rq-3d-M03.webp" alt="" className="size-[130px] object-contain" />
        <span className="text-caption font-semibold text-muted">{r.groupTitle} · {r.quizTitle}</span>
        <h1 className="font-display text-[40px] font-extrabold leading-none tracking-tight">{t('group.place', { r: r.rank })}</h1>
        <span className="text-[14px] text-muted">{t('group.placeLine', { n: r.passed, p: r.points.toLocaleString('ru-RU') })}</span>
      </section>
      {r.closesAt && <p className="rounded-[20px] bg-topic-mint px-4 py-3.5 text-[14px] leading-5 text-ink-2">{t('group.openUntil', { d: deadline(r.closesAt), n: r.remainingMembers })}</p>}
      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-title font-bold">{t('group.board')}</h2>
        <Board rows={r.leaderboard} />
      </section>
      <div className="mt-auto flex flex-col gap-2.5">
        <button type="button" onClick={send} disabled={sent} className="flex h-14 items-center justify-center gap-2 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary disabled:opacity-60"><Icon name={sent ? 'check' : 'send'} size={20} />{sent ? t('group.sent') : t('group.sendToChat')}</button>
        <Link to={`/result/${r.sessionId}/review`} className="flex h-[52px] items-center justify-center rounded-control bg-surface text-[15px] font-bold text-ink shadow-card">{t('result.review')}</Link>
      </div>
    </main>
  );
}

/** 23 · Тест недоступен */
export function AccessErrorView({ group, link, reason }: { group: string; link: string | null; reason: 'member' | 'closed' }) {
  const { t } = useI18n();
  const open = () => { if (!link) return; const wa = getWebApp(); if (wa) wa.openTelegramLink(link); else window.open(link, '_blank'); };
  return (
    <main role="alert" className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-2.5 px-[18px] text-center" style={{ paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
      <img src="/3d/rq-3d-E01.webp" alt="" className="size-[170px] object-contain" />
      <h1 className="mt-2 font-display text-[26px] font-extrabold tracking-tight">{t('access.title')}</h1>
      <p className="max-w-[300px] text-body text-ink-2">{reason === 'member' ? t('access.notMember', { g: group }) : t('access.closed')}</p>
      <div className="mt-2.5 flex w-full flex-col gap-2 text-left">
        {reason === 'member' && <div className="flex items-center gap-2.5 rounded-control bg-surface px-3.5 py-3 text-[13px] text-ink-2"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-error-50 font-extrabold text-error-ink">!</span>{t('access.reasonMember')}</div>}
        <div className="flex items-center gap-2.5 rounded-control bg-surface px-3.5 py-3 text-[13px] text-muted"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-track"><Icon name="clock" size={15} /></span>{t('access.reasonOther')}</div>
      </div>
      <div className="mt-4 flex w-full flex-col gap-2.5">
        {reason === 'member' && link && <button type="button" onClick={open} className="h-14 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{t('access.openGroup')}</button>}
        <Link to="/" replace className="flex h-[52px] items-center justify-center rounded-control text-[15px] font-bold text-ink">{t('access.home')}</Link>
      </div>
    </main>
  );
}

/** «Группа» tile on Home: explains how group tests arrive. */
export function GroupHubScreen() {
  const { t } = useI18n();
  return (
    <main className={page} style={pad}>
      <ScreenHeader back="/" title={t('mode.group')} />
      <section className="flex flex-col items-center gap-2 rounded-hero bg-surface p-6 text-center shadow-card">
        <img src="/3d/rq-3d-M03.webp" alt="" className="size-[140px] object-contain" />
        <h1 className="font-display text-title font-bold">{t('mode.group.hint')}</h1>
        <p className="text-caption leading-5 text-ink-2">{t('group.hubText')}</p>
      </section>
    </main>
  );
}
