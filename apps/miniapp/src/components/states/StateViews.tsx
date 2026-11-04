import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, OfflineError } from '../../data/api';
import { useI18n } from '../../lib/i18n';
import { Skeleton } from '../ui';

const page = 'mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-2.5 px-[18px] text-center';

/** 21 · Нет соединения */
export function OfflineView({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className={page} style={{ paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
      <img src="/3d/rq-3d-E03.webp" alt="" className="size-[170px] object-contain" />
      <h1 className="mt-2 font-display text-[26px] font-extrabold tracking-tight">{t('offline.title')}</h1>
      <p className="max-w-[300px] text-body text-ink-2">{t('offline.text')}</p>
      <p className="max-w-[300px] text-caption text-muted">{t('offline.note')}</p>
      <div className="mt-4 flex w-full flex-col gap-2.5">
        <button type="button" onClick={onRetry} className="h-14 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{t('error.retry')}</button>
        <Link to="/" replace className="flex h-[52px] items-center justify-center rounded-control text-[15px] font-bold text-ink">{t('access.home')}</Link>
      </div>
    </div>
  );
}

/** Generic failure; switches to the offline design when the network is the cause. */
export function ErrorView({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useI18n();
  if (error instanceof OfflineError || !navigator.onLine) return <OfflineView onRetry={onRetry} />;
  return (
    <div role="alert" className={page}>
      <img src="/3d/rq-3d-E03.webp" alt="" className="size-[150px] object-contain" />
      <h1 className="font-display text-title font-bold">{t('error.load')}</h1>
      {!(error instanceof ApiError) && <p className="text-caption text-muted">{error.message}</p>}
      <button type="button" onClick={onRetry} className="mt-3 h-[52px] rounded-control bg-primary px-6 font-bold text-white shadow-primary">{t('error.retry')}</button>
    </div>
  );
}

/** 22 · Загрузка — skeleton column */
export function LoadingView({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div aria-busy="true" aria-label={t('loading')} className="mx-auto flex max-w-[480px] flex-col gap-4 px-[18px]" style={{ paddingTop: 'calc(var(--safe-top) + 20px)' }}>
      {children ?? (<><Skeleton className="h-11 w-40" /><Skeleton className="h-36 rounded-hero" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></>)}
    </div>
  );
}
