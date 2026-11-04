import { clsx } from 'clsx';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { ScreenHeader } from '../components/ScreenHeader';
import { Badge, Skeleton } from '../components/ui';

type Filter = 'all' | 'wrong' | 'unanswered';

export function ReviewScreen() {
  const { sid = '' } = useParams();
  const { t } = useI18n();
  const state = useAsync(() => api().getResult(sid), [sid]);
  const [filter, setFilter] = useState<Filter>('all');
  if (state.status !== 'success') return <div className="mx-auto max-w-[480px] p-5"><Skeleton className="h-80" /></div>;
  const r = state.data;
  const items = r.review.map((x, i) => ({ ...x, n: i + 1 })).filter((x) => filter === 'all' || x.outcome === filter);
  const chips: [Filter, string][] = [['all', t('review.all', { n: r.review.length })], ['wrong', t('review.errors', { n: r.wrong })], ['unanswered', t('review.unanswered', { n: r.unanswered })]];

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-[18px]" style={{ paddingTop: 'calc(var(--safe-top) + 20px)', paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
      <ScreenHeader back={`/result/${sid}`} title={t('review.title')} />
      <div role="tablist" className="no-scrollbar -mx-[18px] flex gap-2 overflow-x-auto px-[18px]">
        {chips.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={clsx('h-[38px] shrink-0 rounded-full border px-4 text-[14px] font-semibold', filter === k ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink')}>{label}</button>
        ))}
      </div>
      {items.map((x) => (
        <article key={x.questionId} className="flex flex-col gap-2.5 rounded-card bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-muted">{t('review.q', { i: x.n })}</span>
            <Badge tone={x.outcome === 'correct' ? 'easy' : x.outcome === 'wrong' ? 'hard' : 'medium'}>{t(`review.badge.${x.outcome}`, { p: x.pointsAwarded })}</Badge>
          </div>
          <h2 className="text-[16px] font-bold leading-[22px]">{x.questionText}</h2>
          {x.outcome === 'wrong' && <p className="text-[14px] font-semibold text-error-ink">✕ {t('review.yours')} {x.chosenText}</p>}
          {x.outcome === 'unanswered' && <p className="text-[14px] font-semibold text-warning-ink">{t('review.timeout')}</p>}
          <p className="text-[14px] font-semibold text-success-ink">✓ {x.outcome === 'correct' ? x.correctText : `${t('review.right')} ${x.correctText}`}</p>
          {x.explanation && <p className="rounded-[14px] bg-canvas px-3 py-2.5 text-caption text-ink-2">{x.explanation}</p>}
        </article>
      ))}
      <Link to="/quiz/q-noun" replace className="mt-auto flex h-14 items-center justify-center rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{t('review.retry')}</Link>
    </div>
  );
}
