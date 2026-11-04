import { Link, useParams } from 'react-router-dom';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { mmss } from '../components/home/ContinueCard';
import { circleBtn } from '../components/ScreenHeader';
import { Icon, Skeleton, type IconName } from '../components/ui';

export function ResultScreen() {
  const { sid = '' } = useParams();
  const { t } = useI18n();
  const state = useAsync(() => api().getResult(sid), [sid]);
  if (state.status !== 'success') return <div className="mx-auto max-w-[480px] p-5"><Skeleton className="h-80" /></div>;
  const r = state.data;
  const accuracy = Math.round((r.correct / r.review.length) * 100);
  const [titleKey, img] = accuracy >= 75 ? ['result.great', 'R01'] as const : accuracy >= 40 ? ['result.good', 'R02'] as const : ['result.low', 'R03'] as const;
  const stats: [IconName, string, string | number, string][] = [
    ['check', 'bg-success-50 text-success', r.correct, t('result.correct')],
    ['x', 'bg-error-50 text-error', r.wrong, t('result.wrong')],
    ['hourglass', 'bg-warning-50 text-warning-ink', r.unanswered, t('result.unanswered')],
    ['clock', 'bg-primary-50 text-primary', mmss(r.usedSec), t('result.time')],
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-[18px] px-[18px]" style={{ paddingTop: 'calc(var(--safe-top) + 20px)', paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
      <header className="flex items-center justify-between">
        <Link to="/" replace aria-label={t('result.close')} className={circleBtn}><Icon name="close" size={20} /></Link>
        <span className="text-[17px] font-bold">{t('result.title')}</span>
        <button type="button" aria-label={t('result.share')} className={circleBtn}><Icon name="share" size={20} /></button>
      </header>

      <section className="flex flex-col items-center gap-2 text-center">
        <img src={`/3d/rq-3d-${img}.webp`} alt="" className="size-[150px] object-contain" />
        <h1 className="mt-1 font-display text-[24px] font-bold tracking-tight">{t(titleKey)}</h1>
        <div className="font-display text-[52px] font-extrabold leading-none tracking-tighter tabular-nums">{r.points}<span className="text-[22px] font-bold text-muted"> / {r.maxPoints}</span></div>
        <span className="text-[14px] text-muted">{t('result.scoreLine', { p: accuracy })}</span>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        {stats.map(([icon, cls, v, label]) => (
          <div key={label} className="flex items-center gap-2.5 rounded-[20px] bg-surface p-3.5 shadow-card">
            <span className={`grid size-[38px] shrink-0 place-items-center rounded-sm ${cls}`}><Icon name={icon} size={20} strokeWidth={2.4} /></span>
            <span><span className="block font-display text-[20px] font-extrabold leading-[22px] tabular-nums">{v}</span><span className="text-[12px] font-semibold text-muted">{label}</span></span>
          </div>
        ))}
      </div>

      <p className="flex items-center gap-3 rounded-[20px] bg-topic-violet px-4 py-3.5 text-[14px] leading-5 text-ink-2">
        <Icon name="trophy" size={22} className="shrink-0 text-primary" />{t('result.best', { b: r.bestPoints })}
      </p>

      <div className="mt-auto flex flex-col gap-2.5">
        <Link to={`/result/${sid}/review`} className="flex h-14 items-center justify-center gap-2 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary"><Icon name="list" size={20} />{t('result.review')}</Link>
        <div className="grid grid-cols-2 gap-2.5">
          <Link to="/quiz/q-noun" replace className="flex h-[52px] items-center justify-center rounded-control bg-primary-50 text-[15px] font-bold text-primary">{t('result.retry')}</Link>
          <Link to="/" replace className="flex h-[52px] items-center justify-center rounded-control bg-surface text-[15px] font-bold text-ink shadow-card">{t('result.home')}</Link>
        </div>
      </div>
    </div>
  );
}
