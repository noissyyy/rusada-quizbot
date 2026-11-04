import { clsx } from 'clsx';
import type { AnswerOutcome, AnswerResult, SessionStart } from '@rq/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../data/api';
import { useI18n } from '../lib/i18n';
import { createTimer, formatClock, isExpired, LOW_TIME_MS, pause, remainingMs, resume, type TestTimer } from '../lib/quiz/timer';
import { getWebApp, haptic } from '../lib/telegram/webapp';
import { Icon, Skeleton } from '../components/ui';
import { circleBtn } from '../components/ScreenHeader';

type Phase = 'loading' | 'answering' | 'submitting' | 'feedback' | 'finishing';

export function QuizScreen() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const assignmentId = params.get('a');
  const nav = useNavigate();
  const { t } = useI18n();

  const [session, setSession] = useState<SessionStart | null>(null);
  const [timer, setTimer] = useState<TestTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [feedbackEnd, setFeedbackEnd] = useState({ at: 0, duration: 1 });
  const [outcomes, setOutcomes] = useState<AnswerOutcome[]>([]);
  const [exitOpen, setExitOpen] = useState(false);
  const finishing = useRef(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  // Start or resume (server creates the session and owns the deadline)
  useEffect(() => {
    let alive = true;
    api().startSession(assignmentId ? { assignmentId } : { quizId: id }).then((s) => {
      if (!alive) return;
      const done = new Map(s.answered.map((a) => [a.questionId, a.outcome]));
      const firstOpen = s.questions.findIndex((q) => !done.has(q.id));
      if (firstOpen === -1 && s.questions.length) {
        // every question already answered in an earlier visit — just close the attempt
        void api().finishSession(s.sessionId, { usedSec: 0, timedOut: false }).then(() => nav(`/result/${s.sessionId}`, { replace: true }));
        return;
      }
      setOutcomes(s.questions.slice(0, firstOpen).map((q) => done.get(q.id) ?? 'unanswered'));
      setIndex(Math.max(0, firstOpen));
      setSession(s);
      setTimer(createTimer(s.remainingSec, Date.now()));
      setPhase('answering');
    }, (e: unknown) => {
      if (!alive) return;
      if (e instanceof ApiError && e.detail === 'already_taken' && assignmentId) { nav(`/group/${assignmentId}/result`, { replace: true }); return; }
      // say why instead of silently bouncing back to the group page
      if (e instanceof ApiError && e.status === 403 && assignmentId) { setLoadError(e.detail === 'closed' ? 'access.closed' : 'access.reasonMember'); return; }
      setLoadError('error.load');
    });
    return () => { alive = false; };
  }, [id, assignmentId, nav]);

  // Display tick
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(h);
  }, []);

  // Ask before Telegram closes the app mid-test
  useEffect(() => {
    const wa = getWebApp();
    wa?.enableClosingConfirmation();
    return () => wa?.disableClosingConfirmation();
  }, []);

  const finish = useCallback(async (timedOut: boolean) => {
    if (finishing.current || !session || !timer) return;
    finishing.current = true;
    setPhase('finishing');
    const usedSec = Math.round((session.durationSec * 1000 - remainingMs(timer, Date.now())) / 1000);
    await api().finishSession(session.sessionId, { usedSec, timedOut });
    nav(timedOut ? `/timeup/${session.sessionId}` : `/result/${session.sessionId}`, { replace: true });
  }, [session, timer, nav]);

  const next = useCallback(() => {
    if (!session) return;
    if (index + 1 >= session.questions.length) { void finish(false); return; }
    setIndex((i) => i + 1);
    setSelected(null);
    setFeedback(null);
    setTimer((tm) => (tm ? resume(tm, Date.now()) : tm));
    setPhase('answering');
  }, [session, index, finish]);

  // Whole-test time is over → finish; unanswered questions score 0 on the server
  useEffect(() => {
    if ((phase === 'answering' || phase === 'feedback') && timer && isExpired(timer, now)) { haptic.error(); void finish(true); }
  }, [phase, timer, now, finish]);

  // The answer stays on screen until «Дальше»; the clock is paused only for the
  // short display window the server grants, then it runs again (as on the server).
  useEffect(() => {
    if (phase === 'feedback' && now >= feedbackEnd.at) setTimer((tm) => (tm ? resume(tm, Date.now()) : tm));
  }, [phase, now, feedbackEnd]);

  async function submit() {
    if (!session || selected === null || phase !== 'answering') return;
    const q = session.questions[index]!;
    setPhase('submitting');
    setTimer((tm) => (tm ? pause(tm, Date.now()) : tm)); // answer display does not cost test time
    const r = await api().submitAnswer(session.sessionId, q.id, selected);
    if (r.outcome === 'correct') haptic.success(); else haptic.error();
    setFeedback(r);
    setOutcomes((o) => [...o, r.outcome]);
    const duration = r.explanation ? session.feedbackExplainMs : session.feedbackMs;
    setFeedbackEnd({ at: Date.now() + duration, duration });
    setPhase('feedback');
  }

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-3 px-[18px] text-center">
        <img src="/3d/rq-3d-E03.webp" alt="" className="size-[150px] object-contain" />
        <p className="max-w-[300px] text-body font-bold">{t(loadError === 'access.closed' || loadError === 'access.reasonMember' ? loadError : 'error.load')}</p>
        <button type="button" onClick={() => nav(-1)} className="h-[52px] rounded-control bg-primary px-6 font-bold text-white">{t('common.back')}</button>
      </div>
    );
  }

  if (!session || !timer) {
    return <div className="mx-auto flex max-w-[480px] flex-col gap-4 px-[18px] pt-5"><Skeleton className="h-11" /><Skeleton className="h-32" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  }

  const q = session.questions[index]!;
  const left = remainingMs(timer, now);
  const paused = timer.runningSince === null;
  const low = !paused && left <= LOW_TIME_MS;
  const inFeedback = phase === 'feedback' && feedback;
  const isLast = index + 1 >= session.questions.length;

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col gap-[18px] bg-canvas px-[18px]" style={{ paddingTop: 'calc(var(--safe-top) + 20px)', paddingBottom: 'calc(var(--safe-bottom) + 120px)' }}>
      <header className="flex items-center justify-between gap-3">
        <button type="button" aria-label={t('quiz.exitAria')} onClick={() => setExitOpen(true)} disabled={phase !== 'answering'} className={clsx(circleBtn, 'disabled:opacity-40')}>
          <Icon name="close" size={20} />
        </button>
        <div className="min-w-0 text-center">
          <div className="text-body font-bold">{t('quiz.question', { i: index + 1, n: session.questions.length })}</div>
          <div className="truncate text-micro font-semibold text-muted">{session.topicTitle} · {session.quizTitle}</div>
        </div>
        <div role="timer" aria-label={paused ? t('quiz.paused', { t: formatClock(left) }) : t('quiz.timeLeft', { t: formatClock(left) })}
          className={clsx('flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-display text-[17px] font-extrabold tabular-nums',
            paused ? 'bg-track text-muted' : low ? 'bg-warning-50 text-warning-ink' : 'bg-surface text-ink shadow-card')}>
          <Icon name={paused ? 'pause' : 'stopwatch'} size={paused ? 14 : 18} className={paused || low ? '' : 'text-primary'} strokeWidth={2.2} />
          {formatClock(left)}
        </div>
      </header>

      <div aria-hidden className="flex gap-1">
        {session.questions.map((qq, i) => (
          <span key={qq.id} className={clsx('h-1.5 flex-1 rounded-full',
            outcomes[i] === 'correct' ? 'bg-success' : outcomes[i] === 'wrong' ? 'bg-error' : outcomes[i] === 'unanswered' ? 'bg-warning' : i === index ? 'bg-primary' : 'bg-track')} />
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card">
        <span className="self-start rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-bold text-primary">{t('quiz.points', { p: q.points })}</span>
        <h1 className="text-[21px] font-bold leading-7">{q.text}</h1>
      </section>

      <div role="radiogroup" aria-label={q.text} className="flex flex-col gap-2.5">
        {q.options.map((o) => {
          const isSel = selected === o.id;
          const isCorrect = inFeedback && feedback.correctOptionId === o.id;
          const isWrongPick = inFeedback && feedback.chosenOptionId === o.id && !isCorrect;
          const dim = inFeedback && !isCorrect && !isWrongPick;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={isSel} disabled={phase !== 'answering'}
              onClick={() => { setSelected(o.id); haptic.select(); }}
              className={clsx('flex min-h-[62px] items-center gap-3 rounded-[18px] border-2 py-2.5 pl-2.5 pr-3.5 text-left text-[16px] font-semibold transition-colors',
                isCorrect ? 'border-success bg-success-50' : isWrongPick ? 'border-error bg-error-50' : isSel ? 'border-primary bg-primary-50' : 'border-transparent bg-surface shadow-card',
                dim && 'opacity-45')}>
              <span className={clsx('grid size-[38px] shrink-0 place-items-center rounded-sm font-extrabold',
                isCorrect ? 'bg-success text-white' : isWrongPick ? 'bg-error text-white' : isSel ? 'bg-primary text-white' : 'bg-track text-ink-2')}>{o.label}</span>
              <span className="flex-1">{o.text}</span>
              {isCorrect && <Icon name="check" size={22} strokeWidth={2.6} className="text-success" aria-label={t('quiz.correct')} />}
              {isWrongPick && <Icon name="x" size={22} strokeWidth={2.6} className="text-error" />}
            </button>
          );
        })}
      </div>

      {(phase === 'answering' || phase === 'submitting') && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] bg-gradient-to-b from-canvas/0 via-canvas to-canvas px-[18px] pt-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
          <button type="button" onClick={submit} disabled={selected === null || phase !== 'answering'}
            className="h-14 w-full rounded-control bg-primary text-[16px] font-bold text-white shadow-primary transition-opacity disabled:opacity-40 disabled:shadow-none">
            {t('quiz.answer')}
          </button>
        </div>
      )}

      {inFeedback && feedback.explanation && (
        <p role="note" className="rounded-[18px] bg-surface px-4 py-3.5 text-[14px] leading-5 text-ink-2 shadow-card">{feedback.explanation}</p>
      )}

      {inFeedback && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] bg-gradient-to-b from-canvas/0 via-canvas to-canvas px-[18px] pt-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
          <button type="button" onClick={next} className="h-14 w-full rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">
            {isLast ? t('quiz.toResult') : t('quiz.next')}
          </button>
        </div>
      )}

      {exitOpen && (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label={t('quiz.exit.stay')} onClick={() => setExitOpen(false)} className="absolute inset-0 bg-ink/45" />
          <section role="alertdialog" aria-labelledby="exit-title" className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[480px] flex-col gap-3.5 rounded-t-hero bg-surface px-5 pt-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
            <span aria-hidden className="mx-auto h-[5px] w-10 rounded-full bg-line" />
            <span className="grid size-14 place-items-center rounded-[20px] bg-warning-50 text-warning-ink"><Icon name="clock" size={28} /></span>
            <h2 id="exit-title" className="font-display text-[24px] font-bold tracking-tight">{t('quiz.exit.title')}</h2>
            <p className="text-body text-ink-2">{t('quiz.exit.text')}</p>
            <button type="button" onClick={() => setExitOpen(false)} className="h-14 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{t('quiz.exit.stay')}</button>
            <button type="button" onClick={() => nav('/', { replace: true })} className="h-[52px] rounded-control bg-canvas text-[16px] font-bold">{t('quiz.exit.leave')}</button>
          </section>
        </div>
      )}
    </div>
  );
}
