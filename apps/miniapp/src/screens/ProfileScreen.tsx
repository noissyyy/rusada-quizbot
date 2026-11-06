import { clsx } from 'clsx';
import type { HistoryItem, Profile } from '@rq/shared-types';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../data/api';
import { LANG_NAMES, useI18n } from '../lib/i18n';
import { useAsync } from '../lib/useAsync';
import { haptic, setHapticsEnabled } from '../lib/telegram/webapp';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';
import { Screen } from '../components/Screen';
import { topicBg as topicColorBg } from '../components/home/TestRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAccess } from '../lib/access';
import { Avatar, Icon, Skeleton } from '../components/ui';
import { ErrorView } from '../components/states/StateViews';

const topicBg: Record<string, string> = { ...topicColorBg, ink: 'bg-night' };

export function formatDay(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'long' });
}

/** 15 · Профиль */
export function ProfileScreen() {
  const { t, lang } = useI18n();
  const state = useAsync(() => api().getProfile());
  if (state.status === 'loading') return <Screen><div className="flex flex-col items-center gap-3"><Skeleton className="size-[88px] rounded-full" /><Skeleton className="h-7 w-48" /><Skeleton className="h-20 w-full" /><Skeleton className="h-48 w-full" /></div></Screen>;
  if (state.status === 'error') return <ErrorView error={state.error} onRetry={state.reload} />;
  const p = state.data;
  const fullName = [p.user.firstName, p.user.lastName].filter(Boolean).join(' ');
  const since = new Date(p.memberSince).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { month: 'long', year: 'numeric' });
  return (
    <Screen className="flex flex-col gap-5">
      <section className="flex flex-col items-center gap-1.5 text-center">
        <Avatar name={fullName} src={p.user.photoUrl} size={88} className="!ring-4 shadow-raised" />
        <h1 className="mt-2 font-display text-[24px] font-bold tracking-tight">{fullName}</h1>
        <span className="text-caption text-muted">{p.user.username ? `@${p.user.username} · ` : ''}{t('profile.since', { d: since })}</span>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {([[p.tests, 'profile.tests'], [`${p.accuracy}%`, 'profile.accuracy'], [p.points.toLocaleString('ru-RU'), 'profile.points']] as const).map(([v, k]) => (
          <div key={k} className="rounded-[18px] bg-surface px-1.5 py-3 text-center shadow-card">
            <div className="font-display text-[22px] font-extrabold tabular-nums">{v}</div>
            <div className="text-[11px] font-semibold text-muted">{t(k)}</div>
          </div>
        ))}
      </div>

      <LevelRow />
      <AccessRow />
      <Link to="/profile/history" className="flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 text-[15px] font-semibold text-ink shadow-card">
        <span className="grid size-9 place-items-center rounded-sm bg-primary-50 text-primary"><Icon name="clock" size={18} /></span>
        {t('profile.history')}
        <span className="ml-auto text-[14px] font-medium text-muted">{p.history.length}</span>
        <Icon name="chevronRight" size={18} className="text-muted" />
      </Link>

      <Settings p={p} langName={LANG_NAMES[lang]} />
    </Screen>
  );
}

/** 15b · История игр — opened from the profile */
export function HistoryScreen() {
  const { t } = useI18n();
  const state = useAsync(() => api().getProfile());
  if (state.status === 'error') return <ErrorView error={state.error} onRetry={state.reload} />;
  const history = state.status === 'success' ? state.data.history : null;
  return (
    <Screen className="flex flex-col gap-4">
      <ScreenHeader back="/profile" title={t('profile.history')} />
      {history === null ? <Skeleton className="h-64 w-full" /> : history.length === 0 ? (
        <div className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-card">
          <img src="/3d/rq-3d-E02.webp" alt="" className="size-16 object-contain" />
          <p className="text-caption text-ink-2">{t('profile.historyEmpty')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card bg-surface shadow-card">
          {history.map((h, i) => <HistoryRow key={h.id} h={h} last={i === history.length - 1} />)}
        </div>
      )}
    </Screen>
  );
}

function LevelRow() {
  const { t } = useI18n();
  const hub = useAsync(() => api().gamesHub());
  if (hub.status !== 'success') return null;
  const x = hub.data.xp;
  const pct = Math.round(((x.xp - x.levelStart) / Math.max(1, x.levelNext - x.levelStart)) * 100);
  return (
    <Link to="/rating" className="flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 text-ink shadow-card">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary font-display text-[18px] font-extrabold text-white">{x.level}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex justify-between text-[14px] font-bold"><span>{t('xp.level', { n: x.level })}</span><span className="tabular-nums text-muted">{x.xp} / {x.levelNext} XP</span></span>
        <span className="h-1.5 overflow-hidden rounded-full bg-track"><span className="block h-full bg-primary" style={{ width: `${pct}%` }} /></span>
      </span>
      <Icon name="trophy" size={18} className="text-muted" />
    </Link>
  );
}

function AccessRow() {
  const { t, lang } = useI18n();
  const { access } = useAccess();
  if (access?.trial) {
    return (
      <Link to="/subscribe" className="flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 text-[15px] font-semibold text-ink shadow-card">
        <span className="grid size-9 place-items-center rounded-sm bg-warning-50 text-warning-ink"><Icon name="lock" size={18} /></span>
        {t('profile.access')}
        <span className="ml-auto text-[14px] font-medium text-muted">{t('profile.accessTrial', { n: access.trialTestsLeft })}</span>
        <Icon name="chevronRight" size={18} className="text-muted" />
      </Link>
    );
  }
  if (!access || access.reason === 'open' || !access.reason) return null;
  const value = access.reason === 'subscription' && access.subscriptionEndsAt
    ? t('profile.accessSub', { d: new Date(access.subscriptionEndsAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'long' }) })
    : access.reason === 'member' ? t('profile.accessMember') : t('profile.accessStaff');
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 text-[15px] font-semibold shadow-card">
      <span className="grid size-9 place-items-center rounded-sm bg-success-50 text-success-ink"><Icon name="check" size={18} /></span>
      {t('profile.access')}
      <span className="ml-auto text-[14px] font-medium text-muted">{value}</span>
    </div>
  );
}

function HistoryRow({ h, last }: { h: HistoryItem; last: boolean }) {
  const { t, lang } = useI18n();
  const sub = h.kind === 'live' ? t('profile.liveSub', { r: h.rank ?? '—', n: h.participants ?? '—' }) : `${h.subtitle} · ${formatDay(h.at, lang)}`;
  const body = (
    <>
      <span className={clsx('size-[38px] shrink-0 rounded-sm', topicBg[h.color] ?? 'bg-track')} />
      <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-semibold">{h.title}</div><div className="truncate text-[12px] text-muted">{sub}</div></div>
      <span className="font-extrabold tabular-nums">{h.points}{h.maxPoints ? <span className="font-semibold text-muted">/{h.maxPoints}</span> : null}</span>
    </>
  );
  const cls = clsx('flex items-center gap-3 px-4 py-3.5 text-ink', !last && 'border-b border-line');
  return h.kind === 'live' ? <div className={cls}>{body}</div> : <Link to={`/result/${h.id}`} className={cls}>{body}</Link>;
}

function Settings({ p, langName }: { p: Profile; langName: string }) {
  const { t } = useI18n();
  const [notify, setNotify] = useState(p.notifyLive);
  const [haptics, setHaptics] = useState(p.haptics);
  const [about, setAbout] = useState(false);
  useEffect(() => { setHapticsEnabled(haptics); }, [haptics]);
  const save = (patch: { notifyLive?: boolean; haptics?: boolean }) => { void api().updateSettings(patch).catch(() => undefined); };
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-display text-title font-bold">{t('profile.settings')}</h2>
      <div className="overflow-hidden rounded-card bg-surface shadow-card">
        <Toggle icon="bell" tone="bg-primary-50 text-primary" label={t('profile.notify')} checked={notify} onChange={(v) => { setNotify(v); save({ notifyLive: v }); }} />
        <Toggle icon="sparkle" tone="bg-success-50 text-success-ink" label={t('profile.haptics')} checked={haptics} onChange={(v) => { setHaptics(v); save({ haptics: v }); }} />
        <ThemeRow />
        <SettingLink to="/language" icon="globe" tone="bg-topic-blue text-[#2F6FD0]" label={t('profile.lang')} value={langName} />
        <button type="button" onClick={() => setAbout((x) => !x)} aria-expanded={about} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-semibold">
          <span className="grid size-9 place-items-center rounded-sm bg-topic-pink text-[#B42C50]"><Icon name="question" size={18} /></span>
          {t('profile.about')}
          <Icon name="chevronRight" size={18} className={clsx('ml-auto text-muted transition-transform', about && 'rotate-90')} />
        </button>
        {about && <p className="px-4 pb-4 text-caption leading-5 text-ink-2">{t('profile.aboutText')}</p>}
      </div>
    </section>
  );
}

function ThemeRow() {
  const { t } = useI18n();
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  const pick = (p: ThemePref) => { setPref(p); setThemePref(p); haptic.select(); };
  return (
    <div className="flex flex-col gap-2.5 border-b border-line px-4 py-3.5">
      <span className="flex items-center gap-3 text-[15px] font-semibold">
        <span className="grid size-9 place-items-center rounded-sm bg-topic-indigo text-primary"><Icon name="moon" size={18} /></span>
        {t('profile.theme')}
      </span>
      <div role="radiogroup" aria-label={t('profile.theme')} className="grid grid-cols-3 gap-1 rounded-[14px] bg-track p-1">
        {(['auto', 'light', 'dark'] as const).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={pref === p} onClick={() => pick(p)}
            className={clsx('h-9 rounded-[10px] text-[13px] font-bold transition-colors', pref === p ? 'bg-surface text-ink shadow-card' : 'text-muted')}>
            {t(p === 'auto' ? 'profile.themeAuto' : p === 'light' ? 'profile.themeLight' : 'profile.themeDark')}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ icon, tone, label, checked, onChange }: { icon: 'bell' | 'sparkle'; tone: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 border-b border-line px-4 py-3.5 text-[15px] font-semibold">
      <span className={clsx('grid size-9 place-items-center rounded-sm', tone)}><Icon name={icon} size={18} /></span>
      <span className="flex-1">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-[22px] accent-primary" />
    </label>
  );
}

function SettingLink({ to, icon, tone, label, value }: { to: string; icon: 'globe'; tone: string; label: string; value: ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-3 border-b border-line px-4 py-3.5 text-[15px] font-semibold text-ink">
      <span className={clsx('grid size-9 place-items-center rounded-sm', tone)}><Icon name={icon} size={18} /></span>
      {label}
      <span className="ml-auto text-[14px] font-medium text-muted">{value}</span>
      <Icon name="chevronRight" size={18} className="text-muted" />
    </Link>
  );
}
