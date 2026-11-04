import { Link, useParams } from 'react-router-dom';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { mmss } from '../components/home/ContinueCard';
import { Icon } from '../components/ui';

export function TimeUpScreen() {
  const { sid = '' } = useParams();
  const { t } = useI18n();
  const state = useAsync(() => api().getResult(sid), [sid]);
  const r = state.status === 'success' ? state.data : null;
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-[18px]" style={{ paddingTop: 'calc(var(--safe-top) + 20px)', paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
      <section role="alertdialog" aria-labelledby="timeup-title" className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="grid size-[132px] place-items-center rounded-full bg-warning-50">
          <span className="grid size-[92px] place-items-center rounded-full bg-warning text-white shadow-[0_12px_26px_rgba(245,158,11,.4)]"><Icon name="hourglass" size={44} strokeWidth={2} /></span>
        </span>
        <h1 id="timeup-title" className="mt-2 font-display text-[30px] font-extrabold tracking-tight">{t('timeup.title')}</h1>
        <p className="max-w-[290px] text-body text-ink-2">{t('timeup.text')}</p>
        {r && (
          <div className="mt-2.5 grid w-full grid-cols-2 gap-2.5">
            <div className="rounded-[20px] bg-surface p-4 shadow-card"><div className="font-display text-[28px] font-extrabold">{t('timeup.answered', { a: r.correct + r.wrong, n: r.review.length })}</div><div className="text-[12px] font-semibold text-muted">{t('timeup.answeredLabel')}</div></div>
            <div className="rounded-[20px] bg-surface p-4 shadow-card"><div className="font-display text-[28px] font-extrabold">{mmss(r.usedSec)}</div><div className="text-[12px] font-semibold text-muted">{t('timeup.timeLabel')}</div></div>
          </div>
        )}
        <p className="flex w-full gap-2.5 rounded-control bg-warning-50 px-3.5 py-3 text-left text-caption text-[#6B3D00]"><Icon name="clock" size={18} className="mt-0.5 shrink-0" />{t('timeup.note')}</p>
      </section>
      <Link to={`/result/${sid}`} replace className="flex h-14 items-center justify-center rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{t('timeup.cta')}</Link>
    </div>
  );
}
