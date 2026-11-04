import { clsx } from 'clsx';
import type { TopicSummary, TopicTest } from '@rq/shared-types';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Badge, ProgressBar, Skeleton } from '../components/ui';
import { topicBg } from '../components/home/TestRow';
import { BookCover } from '../components/books/BookCover';

export function TopicScreen() {
  const { slug = '' } = useParams();
  const { t } = useI18n();
  const state = useAsync(() => api().getTopic(slug), [slug]);
  const [sub, setSub] = useState<string | null>(null);
  if (state.status !== 'success') return <Screen><Skeleton className="h-[180px] rounded-hero" /></Screen>;
  const { topic, tests } = state.data;
  if (topic.layout === 'works') return <WorksShelf topic={topic} tests={tests} />;
  const chips = topic.subtopics ?? [];
  const shown = sub ? tests.filter((x) => x.subtopicIds?.includes(sub)) : tests;

  return (
    <Screen className="flex flex-col gap-[18px]">
      <ScreenHeader back="/tests" title={topic.title} />
      <section className={`relative flex min-h-[180px] flex-col justify-end gap-2.5 overflow-hidden rounded-hero p-5 ${topicBg[topic.color]}`}>
        <img src={topic.illustration} alt="" className="absolute -right-1.5 -top-1 size-[150px] object-contain" />
        {topic.description && <p className="relative max-w-[58%] text-[13px] leading-[18px] text-ink-2">{topic.description}</p>}
        <span className="relative text-[12px] font-semibold text-ink-2">{t('topic.stats', { t: topic.testsCount, q: topic.questionsCount })}</span>
        <span className="relative flex items-center gap-2.5">
          <ProgressBar value={topic.progress} label={topic.title} trackClassName="bg-white/75" className="!h-2" />
          <span className="font-display text-[24px] font-extrabold tracking-tight">{topic.progress}%</span>
        </span>
      </section>
      {chips.length > 1 && (
        <div role="tablist" aria-label={t('topic.subAll')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {[{ id: null as string | null, title: t('topic.subAll') }, ...chips].map((c) => (
            <button key={c.id ?? 'all'} type="button" role="tab" aria-selected={sub === c.id} onClick={() => setSub(c.id)}
              className={clsx('h-[38px] shrink-0 whitespace-nowrap rounded-full border px-4 text-[14px] font-semibold',
                sub === c.id ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink')}>
              {c.title}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2.5">{shown.map((test) => <TestCard key={test.id} test={test} />)}</div>
    </Screen>
  );
}

/** «Обязательные произведения»: the section is a shelf of works; each opens its own tests. */
function WorksShelf({ topic, tests }: { topic: TopicSummary; tests: TopicTest[] }) {
  const { t } = useI18n();
  const works = topic.works ?? [];
  const known = new Set(works.map((w) => w.id));
  const loose = tests.filter((x) => !x.workId || !known.has(x.workId));
  return (
    <Screen className="flex flex-col gap-[18px]">
      <ScreenHeader back="/tests" title={topic.title} />
      {topic.description && <p className="text-[14px] leading-5 text-ink-2">{topic.description}</p>}
      <section aria-label={t('works.title')} className="grid grid-cols-2 gap-x-3 gap-y-5">
        {works.map((w) => (
          <Link key={w.id} to={`/topics/${topic.slug}/works/${w.id}`} className={clsx('flex flex-col gap-2 active:scale-[0.98]', !w.testsCount && 'opacity-60')}>
            <BookCover book={w} />
            <span className="flex flex-col">
              <span className="line-clamp-2 text-[15px] font-bold leading-[19px]">{w.title}</span>
              <span className="truncate text-[12px] font-semibold text-muted">{w.author}</span>
              <span className={clsx('mt-1 self-start rounded-full px-2 py-0.5 text-[11px] font-bold', w.testsCount ? 'bg-primary-50 text-primary' : 'bg-track text-muted')}>
                {w.testsCount ? t('works.tests', { n: w.testsCount }) : t('works.noTests')}
              </span>
            </span>
          </Link>
        ))}
      </section>
      {loose.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-title font-bold tracking-tight">{t('works.other')}</h2>
          {loose.map((test) => <TestCard key={test.id} test={test} />)}
        </section>
      )}
    </Screen>
  );
}

/** One work: its cover, author and tests. */
export function WorkScreen() {
  const { slug = '', workId = '' } = useParams();
  const { t } = useI18n();
  const state = useAsync(() => api().getTopic(slug), [slug]);
  if (state.status !== 'success') return <Screen><Skeleton className="h-[220px] rounded-hero" /></Screen>;
  const { topic, tests } = state.data;
  const work = topic.works?.find((w) => w.id === workId);
  const mine = tests.filter((x) => x.workId === workId);
  return (
    <Screen className="flex flex-col gap-[18px]">
      <ScreenHeader back={`/topics/${slug}`} title={topic.title} />
      {work && (
        <section className={`flex items-end gap-4 rounded-hero p-4 ${topicBg[topic.color]}`}>
          <BookCover book={work} className="w-[104px] shrink-0" />
          <span className="flex min-w-0 flex-col gap-1 pb-1">
            <span className="text-[13px] font-semibold text-ink-2">{work.author}</span>
            <h1 className="font-display text-[22px] font-bold leading-[26px] tracking-tight">{work.title}</h1>
            <span className="text-[12px] font-bold text-ink-2">{t('works.tests', { n: mine.length })}</span>
          </span>
        </section>
      )}
      {mine.length ? <div className="flex flex-col gap-2.5">{mine.map((test) => <TestCard key={test.id} test={test} />)}</div>
        : <p className="rounded-card bg-surface p-5 text-center text-body text-ink-2 shadow-card">{t('works.empty')}</p>}
    </Screen>
  );
}

function TestCard({ test }: { test: TopicTest }) {
  const { t } = useI18n();
  const s = test.status;
  return (
    <Link to={`/tests/${test.id}`} className="flex flex-col gap-2.5 rounded-card bg-surface p-4 text-ink shadow-card">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[16px] font-bold">{test.title}</span>
        <Badge tone={test.difficulty}>{t(`difficulty.${test.difficulty}`)}</Badge>
      </span>
      <span className="text-[12px] font-medium text-muted">{t('test.meta', { q: test.questionsCount, m: test.durationMinutes, p: test.maxPoints })}</span>
      {s.kind === 'in_progress' && (
        <span className="flex items-center gap-2"><ProgressBar value={s.answered} max={test.questionsCount} label={test.title} />
          <span className="shrink-0 text-[12px] font-bold text-primary">{t('status.inProgress', { a: s.answered, n: test.questionsCount })}</span></span>
      )}
      {s.kind === 'done' && (
        <span className="flex items-center justify-between text-[12px] font-bold">
          <span className="text-success-ink">{t('status.done', { p: s.bestPercent })}</span><span className="text-primary">{t('status.retry')}</span>
        </span>
      )}
      {s.kind === 'new' && <span className="text-[12px] font-bold text-muted">{t('status.new')}</span>}
    </Link>
  );
}
