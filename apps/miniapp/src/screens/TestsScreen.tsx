import { clsx } from 'clsx';
import type { Difficulty } from '@rq/shared-types';
import { useMemo, useState } from 'react';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { Screen } from '../components/Screen';
import { Icon, Skeleton } from '../components/ui';
import { TopicCard } from '../components/tests/TopicCard';

const FILTERS: (Difficulty | 'all')[] = ['all', 'easy', 'medium', 'hard'];

export function TestsScreen() {
  const { t } = useI18n();
  const state = useAsync(() => api().getTopics());
  const [q, setQ] = useState('');
  const [f, setF] = useState<Difficulty | 'all'>('all');

  const topics = useMemo(() => {
    if (state.status !== 'success') return [];
    const needle = q.trim().toLowerCase();
    return state.data.filter((tp) => (f === 'all' || tp.difficulties.includes(f)) && (!needle || tp.title.toLowerCase().includes(needle)));
  }, [state, q, f]);

  return (
    <Screen className="flex flex-col gap-[18px]">
      <h1 className="font-display text-[30px] font-bold leading-9 tracking-tight">{t('tests.title')}</h1>
      <label htmlFor="tests-search" className="flex h-[52px] items-center gap-2.5 rounded-control bg-surface px-4 text-muted shadow-card focus-within:ring-2 focus-within:ring-primary">
        <Icon name="search" size={20} />
        <input id="tests-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('tests.search')}
          className="min-w-0 flex-1 bg-transparent text-body font-medium text-ink outline-none placeholder:text-muted" />
      </label>

      <div role="tablist" aria-label="Difficulty" className="no-scrollbar -mx-[18px] flex gap-[18px] overflow-x-auto px-[18px]">
        {FILTERS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={f === k} onClick={() => setF(k)}
            className={clsx('shrink-0 font-display text-[26px] font-extrabold tracking-tight transition-colors', f === k ? 'text-ink' : 'text-[#C9C4D8]')}>
            {t(`tests.filter.${k}`)}
          </button>
        ))}
      </div>

      {state.status === 'loading' && <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[196px]" />)}</div>}
      {state.status === 'success' && topics.length > 0 && <div className="grid grid-cols-2 gap-3">{topics.map((tp) => <TopicCard key={tp.id} topic={tp} />)}</div>}
      {state.status === 'success' && topics.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <img src="/3d/rq-3d-E01.webp" alt="" className="size-[150px] object-contain" />
          <p className="font-display text-[22px] font-bold">{t('tests.empty')}</p>
          <p className="max-w-[280px] text-body text-ink-2">{t('tests.emptyHint')}</p>
        </div>
      )}
    </Screen>
  );
}
