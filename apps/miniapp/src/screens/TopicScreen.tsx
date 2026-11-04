import { clsx } from 'clsx';
import type { TopicTest } from '@rq/shared-types';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Badge, GradientDecor, ProgressBar, Skeleton, gradient, toneMuted, toneStyle, toneText } from '../components/ui';

export function TopicScreen() {
  const { slug = '' } = useParams();
  const { t } = useI18n();
  const state = useAsync(() => api().getTopic(slug), [slug]);
  const [sub, setSub] = useState<string | null>(null);
  if (state.status !== 'success') return <Screen><Skeleton className="h-[180px] rounded-hero" /></Screen>;
  const { topic, tests } = state.data;
  const chips = topic.subtopics ?? [];
  const shown = sub ? tests.filter((x) => x.subtopicIds?.includes(sub)) : tests;

  return (
    <Screen className="flex flex-col gap-[18px]">
      <ScreenHeader back="/tests" title={topic.title} />
      <section style={toneStyle(topic.color)} className={clsx('relative flex min-h-[180px] flex-col justify-end gap-2.5 overflow-hidden rounded-hero p-5', toneText(topic.color))}>
        <GradientDecor dark={gradient[topic.color].text === 'dark'} />
        <img src={topic.illustration} alt="" className="absolute -right-1.5 -top-1 size-[150px] object-contain" />
        {topic.description && <p className={clsx('relative max-w-[58%] text-[13px] leading-[18px]', toneMuted(topic.color))}>{topic.description}</p>}
        <span className={clsx('relative text-[12px] font-semibold', toneMuted(topic.color))}>{t('topic.stats', { t: topic.testsCount, q: topic.questionsCount })}</span>
        <span className="relative flex items-center gap-2.5">
          <ProgressBar value={topic.progress} label={topic.title} trackClassName="bg-white/35" fillClassName={gradient[topic.color].text === 'dark' ? 'bg-ink' : 'bg-white'} className="!h-2" />
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
