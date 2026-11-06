import { clsx } from 'clsx';
import type { QuestionPublic, ReviewAnswer, ReviewDeck } from '@rq/shared-types';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { haptic } from '../lib/telegram/webapp';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon, Skeleton } from '../components/ui';
import { ErrorView } from '../components/states/StateViews';

const STEPS = ['1', '3', '7', '14'];

/** «Xatolarim»: questions the student got wrong come back after 1, 3, 7 and 14 days until mastered. */
export function MistakesScreen() {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  const state = useAsync(() => api().getReview(all), [all]);
  const [playing, setPlaying] = useState<QuestionPublic[] | null>(null);
  if (state.status === 'error') return <ErrorView error={state.error} onRetry={state.reload} />;
  if (playing) return <ReviewRun questions={playing} onDone={() => { setPlaying(null); setAll(false); state.reload(); }} />;
  const d: ReviewDeck | null = state.status === 'success' ? state.data : null;
  return (
    <Screen className="flex flex-col gap-5">
      <ScreenHeader back="/" title={t('games.review')} />
      {!d ? <Skeleton className="h-48 w-full" /> : (
        <>
          <section className="flex flex-col items-center gap-2 rounded-hero bg-surface p-6 text-center shadow-card">
            <img src="/3d/rq-3d-G04.webp" alt="" className="size-24 object-contain" />
            <span className="font-display text-[44px] font-extrabold leading-none tabular-nums">{d.due}</span>
            <span className="text-body font-semibold text-ink-2">{t('review.dueToday')}</span>
            <div className="mt-2 grid w-full grid-cols-2 gap-2 text-center">
              <span className="rounded-[16px] bg-canvas py-2.5"><b className="block font-display text-[20px] tabular-nums">{d.learning}</b><span className="text-[12px] text-muted">{t('review.learning')}</span></span>
              <span className="rounded-[16px] bg-success-50 py-2.5"><b className="block font-display text-[20px] tabular-nums text-success-ink">{d.mastered}</b><span className="text-[12px] text-success-ink">{t('review.mastered')}</span></span>
            </div>
          </section>
          {d.questions.length > 0 ? (
            <button type="button" onClick={() => { haptic.tap(); setPlaying(d.questions); }} className="h-14 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">
              {all ? t('review.startAll', { n: d.questions.length }) : t('review.start', { n: d.questions.length })}
            </button>
          ) : (
            <p className="rounded-card bg-surface p-4 text-center text-body text-ink-2 shadow-card">{d.learning ? t('review.nothingToday') : t('review.empty')}</p>
          )}
          {!all && d.due === 0 && d.learning > 0 && (
            <button type="button" onClick={() => setAll(true)} className="h-[52px] rounded-control bg-surface text-[15px] font-bold text-primary shadow-card">{t('review.practiceAll')}</button>
          )}
          <section className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-card">
            <b className="text-[15px]">{t('review.howTitle')}</b>
            <p className="text-[13px] leading-[18px] text-ink-2">{t('review.howText')}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px] font-bold">
              <span className="rounded-full bg-error-50 px-2 py-1 text-error-ink">✗</span>
              {STEPS.map((s) => <span key={s} className="flex items-center gap-1.5"><Icon name="chevronRight" size={12} className="text-muted" /><span className="whitespace-nowrap rounded-full bg-primary-50 px-2 py-1 text-primary">{t('review.days', { n: s })}</span></span>)}
              <Icon name="chevronRight" size={12} className="text-muted" /><span className="rounded-full bg-success-50 px-2 py-1 text-success-ink">✓</span>
            </div>
          </section>
        </>
      )}
    </Screen>
  );
}

function ReviewRun({ questions, onDone }: { questions: QuestionPublic[]; onDone: () => void }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [res, setRes] = useState<ReviewAnswer | null>(null);
  const [score, setScore] = useState({ ok: 0, mastered: 0 });
  const [finished, setFinished] = useState(false);
  const q = questions[i]!;

  const pick = async (optionId: string) => {
    if (chosen) return;
    setChosen(optionId);
    try {
      const r = await api().answerReview(q.id, optionId);
      if (r.correct) haptic.success(); else haptic.error();
      setRes(r);
      setScore((s) => ({ ok: s.ok + (r.correct ? 1 : 0), mastered: s.mastered + (r.mastered ? 1 : 0) }));
    } catch { setChosen(null); }
  };
  const next = () => {
    if (i + 1 >= questions.length) { setFinished(true); return; }
    setI(i + 1); setChosen(null); setRes(null);
  };

  if (finished) {
    return (
      <Screen className="flex flex-col items-center justify-center gap-4 text-center">
        <img src="/3d/rq-3d-R02.webp" alt="" className="size-32 object-contain" />
        <h1 className="font-display text-[26px] font-bold">{t('review.doneTitle')}</h1>
        <p className="text-body text-ink-2">{t('review.doneText', { ok: score.ok, n: questions.length })}</p>
        {score.mastered > 0 && <p className="rounded-full bg-success-50 px-3 py-1.5 text-[13px] font-bold text-success-ink">{t('review.doneMastered', { n: score.mastered })}</p>}
        <button type="button" onClick={onDone} className="mt-2 h-14 w-full max-w-[320px] rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{t('review.back')}</button>
        <Link to="/" className="text-[15px] font-bold text-ink">{t('access.home')}</Link>
      </Screen>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-[18px]" style={{ paddingTop: 'calc(var(--safe-top) + 20px)', paddingBottom: 'calc(var(--safe-bottom) + 110px)' }}>
      <header className="flex items-center justify-between">
        <button type="button" aria-label={t('review.back')} onClick={onDone} className="grid size-11 place-items-center rounded-full bg-surface shadow-card"><Icon name="close" size={20} /></button>
        <span className="text-body font-bold">{t('review.progress', { i: i + 1, n: questions.length })}</span>
        <span className="w-11" />
      </header>
      <div aria-hidden className="flex gap-1">{questions.map((x, k) => <span key={x.id} className={clsx('h-1.5 flex-1 rounded-full', k < i ? 'bg-primary/40' : k === i ? 'bg-primary' : 'bg-track')} />)}</div>
      <section className="rounded-card bg-surface p-5 shadow-card"><h1 className="text-[20px] font-bold leading-7">{q.text}</h1></section>
      <div role="radiogroup" aria-label={q.text} className="flex flex-col gap-2.5">
        {q.options.map((o) => {
          const isCorrect = res && res.correctOptionId === o.id;
          const isWrong = res && chosen === o.id && !res.correct;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={chosen === o.id} disabled={!!chosen} onClick={() => pick(o.id)}
              className={clsx('flex min-h-[58px] items-center gap-3 rounded-[18px] border-2 py-2 pl-2.5 pr-3.5 text-left text-[16px] font-semibold',
                isCorrect ? 'border-success bg-success-50' : isWrong ? 'border-error bg-error-50' : 'border-transparent bg-surface shadow-card', res && !isCorrect && !isWrong && 'opacity-45')}>
              <span className={clsx('grid size-[36px] shrink-0 place-items-center rounded-sm font-extrabold', isCorrect ? 'bg-success text-white' : isWrong ? 'bg-error text-white' : 'bg-track text-ink-2')}>{o.label}</span>
              <span className="flex-1">{o.text}</span>
              {isCorrect && <Icon name="check" size={20} className="text-success" />}
            </button>
          );
        })}
      </div>
      {res?.explanation && <p className="rounded-[18px] bg-surface px-4 py-3 text-[14px] leading-5 text-ink-2 shadow-card">{res.explanation}</p>}
      {res && (
        <p className={clsx('text-center text-[13px] font-bold', res.correct ? 'text-success-ink' : 'text-error-ink')}>
          {res.mastered ? t('review.nowMastered') : res.correct ? t('review.nextIn', { d: new Date(res.nextDueAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) }) : t('review.again')}
        </p>
      )}
      {res && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] bg-gradient-to-b from-canvas/0 via-canvas to-canvas px-[18px] pt-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}>
          <button type="button" onClick={next} className="h-14 w-full rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{i + 1 >= questions.length ? t('review.finish') : t('quiz.next')}</button>
        </div>
      )}
    </div>
  );
}
