import { clsx } from 'clsx';
import type { AppNotification } from '@rq/shared-types';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n/dict';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon, Skeleton, type IconName } from '../components/ui';
import { ErrorView } from '../components/states/StateViews';
import { formatDay } from './ProfileScreen';

const look: Record<AppNotification['kind'], { icon: IconName; cls: string }> = {
  live: { icon: 'broadcast', cls: 'bg-night text-white' },
  group: { icon: 'users', cls: 'bg-mode-group text-white' },
  rating: { icon: 'trophy', cls: 'bg-warning-50 text-warning-ink' },
  new_tests: { icon: 'sparkle', cls: 'bg-primary-50 text-primary' },
  system: { icon: 'bell', cls: 'bg-track text-ink-2' },
};

export function useAgo() {
  const { t, lang } = useI18n();
  return (iso: string) => {
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return t('time.justNow');
    if (min < 60) return t('time.min', { n: min });
    if (min < 24 * 60) return t('time.hour', { n: Math.floor(min / 60) });
    if (min < 48 * 60) return t('time.yesterday');
    return formatDay(iso, lang);
  };
}

/** 05 · Уведомления */
export function NotificationsScreen() {
  const { t } = useI18n();
  const state = useAsync(() => api().getNotifications());
  const [allRead, setAllRead] = useState(false);
  const ago = useAgo();

  const readAll = async () => { setAllRead(true); await api().readAllNotifications().catch(() => setAllRead(false)); };

  const body = () => {
    if (state.status === 'loading') return <div className="flex flex-col gap-2.5"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
    if (state.status === 'error') return <ErrorView error={state.error} onRetry={state.reload} />;
    const items = state.data.map((n) => ({ ...n, read: n.read || allRead }));
    if (!items.length) {
      return <div className="flex flex-col items-center gap-2 py-16 text-center"><img src="/3d/rq-3d-E02.webp" alt="" className="size-[140px] object-contain" /><p className="text-body font-semibold text-ink-2">{t('notif.empty')}</p></div>;
    }
    const today = new Date().toDateString();
    const groups: [MessageKey, AppNotification[]][] = [
      ['notif.today', items.filter((n) => new Date(n.createdAt).toDateString() === today)],
      ['notif.earlier', items.filter((n) => new Date(n.createdAt).toDateString() !== today)],
    ];
    return groups.filter(([, list]) => list.length).map(([title, list]) => (
      <section key={title} className="flex flex-col gap-2.5">
        <h2 className="text-caption font-bold uppercase tracking-wide text-muted">{t(title)}</h2>
        {list.map((n) => {
          const l = look[n.kind] ?? look.system;
          const inner = (
            <>
              <span className={clsx('grid size-11 shrink-0 place-items-center rounded-control', l.cls)}><Icon name={l.icon} size={22} /></span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-bold">{n.title}</span>
                {n.body && <span className="text-caption text-ink-2">{n.body}</span>}
                <span className="text-micro font-semibold text-muted">{ago(n.createdAt)}</span>
              </span>
              {!n.read && <span aria-label="new" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand" />}
            </>
          );
          const cls = clsx('flex items-start gap-3 rounded-[20px] p-3.5 text-ink', n.read ? 'bg-surface/70' : 'bg-surface shadow-card');
          return n.link ? <Link key={n.id} to={n.link} className={cls}>{inner}</Link> : <div key={n.id} className={cls}>{inner}</div>;
        })}
      </section>
    ));
  };

  const hasUnread = state.status === 'success' && !allRead && state.data.some((n) => !n.read);
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-[18px]" style={{ paddingTop: 'calc(var(--safe-top) + 20px)', paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
      <ScreenHeader back="/" title={t('notif.title')} right={
        <button type="button" onClick={readAll} disabled={!hasUnread} className="h-11 shrink-0 text-[13px] font-bold text-primary disabled:opacity-40">{t('notif.readAll')}</button>
      } />
      {body()}
    </main>
  );
}
