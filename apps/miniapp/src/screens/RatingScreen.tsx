import { clsx } from 'clsx';
import type { RatingEntry, RatingKind, RatingPeriod } from '@rq/shared-types';
import { useState } from 'react';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { haptic } from '../lib/telegram/webapp';
import { Screen } from '../components/Screen';
import { Avatar, Skeleton } from '../components/ui';
import { ErrorView } from '../components/states/StateViews';

const KINDS: RatingKind[] = ['individual', 'live', 'group'];
const PERIODS: RatingPeriod[] = ['week', 'month', 'all'];
const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/,/g, ' ');

/** 14 · Рейтинг — three separate ratings that are never mixed. */
export function RatingScreen() {
  const { t } = useI18n();
  const [kind, setKind] = useState<RatingKind>('individual');
  const [period, setPeriod] = useState<RatingPeriod>('week');
  const state = useAsync(() => api().getRating(kind, period), [kind, period]);

  return (
    <Screen className="flex flex-col gap-4">
      <h1 className="font-display text-[30px] font-bold leading-9 tracking-tight">{t('rating.title')}</h1>
      <div role="tablist" aria-label={t('rating.kind')} className="grid grid-cols-3 rounded-control bg-track p-1">
        {KINDS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => { setKind(k); haptic.select(); }}
            className={clsx('h-10 rounded-sm text-[13px] font-bold', kind === k ? 'bg-surface text-ink shadow-card' : 'text-muted')}>
            {t(`rating.${k}`)}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}
            className={clsx('h-9 rounded-full border px-3.5 text-[14px] font-semibold', period === p ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink')}>
            {t(`rating.${p}`)}
          </button>
        ))}
      </div>

      {state.status === 'loading' && <div className="flex flex-col gap-2"><Skeleton className="h-44" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
      {state.status === 'error' && <ErrorView error={state.error} onRetry={state.reload} />}
      {state.status === 'success' && <Board entries={state.data.entries} me={state.data.me} />}
    </Screen>
  );
}

function Board({ entries, me }: { entries: RatingEntry[]; me: RatingEntry | null }) {
  const { t } = useI18n();
  if (!entries.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <img src="/3d/rq-3d-L01.webp" alt="" className="size-[140px] object-contain" />
        <p className="max-w-[300px] text-body text-ink-2">{t('rating.empty')}</p>
      </div>
    );
  }
  const podium = [entries[1], entries[0], entries[2]];
  const rest = entries.slice(3);
  const meOutside = me && !entries.some((e) => e.me) ? me : null;
  const looks = [
    { h: 'h-[74px]', bar: 'bg-[#B9C6E4]', ring: 'ring-surface', av: 52, n: 'text-[24px]' },
    { h: 'h-[104px]', bar: 'bg-[#F5B70B]', ring: 'ring-[#F5B70B]', av: 64, n: 'text-[28px]' },
    { h: 'h-[58px]', bar: 'bg-[#E9A37A]', ring: 'ring-surface', av: 52, n: 'text-[24px]' },
  ];
  return (
    <>
      <section aria-label={t('rating.top3')} className="mt-1.5 grid grid-cols-[1fr_1.15fr_1fr] items-end gap-2 text-center">
        {podium.map((e, i) => e ? (
          <div key={e.userId} className="flex min-w-0 flex-col items-center gap-1.5">
            <Avatar name={e.name} src={e.photoUrl} size={looks[i]!.av} className={clsx('ring-[3px]', looks[i]!.ring)} />
            <span className="w-full truncate text-[13px] font-bold">{e.name}{e.me ? ` ${t('rating.you')}` : ''}</span>
            <span className="text-[12px] font-semibold text-muted tabular-nums">{fmt(e.points)}</span>
            <div className={clsx('flex w-full justify-center rounded-[18px_18px_8px_8px] pt-2 font-display font-extrabold text-white', looks[i]!.h, looks[i]!.bar, looks[i]!.n)}>{e.rank}</div>
          </div>
        ) : <div key={i} />)}
      </section>
      <ol className="flex flex-col gap-2">
        {[...rest, ...(meOutside ? [meOutside] : [])].map((e) => <Row key={e.userId} e={e} />)}
      </ol>
    </>
  );
}

function Row({ e }: { e: RatingEntry }) {
  const { t } = useI18n();
  return (
    <li aria-current={e.me || undefined}
      className={clsx('flex items-center gap-3 rounded-[18px] px-3.5 py-2.5', e.me ? 'bg-primary text-white shadow-primary' : 'bg-surface shadow-card')}>
      <span className={clsx('w-[22px] text-center font-extrabold tabular-nums', e.me ? 'text-white/80' : 'text-muted')}>{e.rank}</span>
      <Avatar name={e.name} src={e.photoUrl} size={38} className={e.me ? '!bg-surface' : ''} />
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{e.name}{e.me ? ` ${t('rating.you')}` : ''}</span>
      <span className="font-extrabold tabular-nums">{fmt(e.points)}</span>
    </li>
  );
}
