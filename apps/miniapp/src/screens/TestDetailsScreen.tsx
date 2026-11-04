import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { Badge, Icon } from '../components/ui';

/** Test details as a bottom sheet — one step fewer than a separate page. */
export function TestDetailsScreen() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { t } = useI18n();
  const state = useAsync(() => api().getTest(id), [id]);
  const close = () => (history.length > 1 ? nav(-1) : nav('/tests'));

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label={t('result.close')} onClick={close} className="absolute inset-0 bg-ink/45" />
      {state.status === 'success' && (
        <section role="dialog" aria-modal="true" aria-labelledby="test-title"
          className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[480px] flex-col gap-4 rounded-t-hero bg-surface px-5 pt-3 shadow-raised"
          style={{ paddingBottom: 'calc(var(--safe-bottom) + 28px)' }}>
          <span aria-hidden className="mx-auto h-[5px] w-10 rounded-full bg-line" />
          <div className="flex flex-col gap-1.5">
            <Badge tone={state.data.difficulty} className="self-start">{t(`difficulty.${state.data.difficulty}`)}</Badge>
            <h2 id="test-title" className="font-display text-[24px] font-bold leading-7 tracking-tight">{state.data.title}</h2>
            <span className="text-caption text-muted">{state.data.topicTitle}</span>
          </div>
          <p className="text-[14px] leading-5 text-ink-2">{state.data.description}</p>
          <div className="grid grid-cols-3 gap-2">
            {[[state.data.questionsCount, t('test.factQuestions')], [state.data.durationMinutes, t('test.factMinutes')], [state.data.maxPoints, t('test.factPoints')]].map(([v, l]) => (
              <div key={String(l)} className="rounded-control bg-canvas px-2 py-3 text-center">
                <div className="font-display text-[22px] font-extrabold">{v}</div>
                <div className="text-micro font-semibold text-muted">{l}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-caption font-bold">{t('test.rules')}</span>
            <ul className="flex list-disc flex-col gap-1 pl-[18px] text-caption text-ink-2">
              <li>{t('test.rule1', { m: state.data.durationMinutes })}</li><li>{t('test.rule2')}</li><li>{t('test.rule3')}</li><li>{t('test.rule4')}</li>
            </ul>
          </div>
          <div className="flex gap-2.5">
            <button type="button" aria-label={t('test.share')} className="grid size-14 shrink-0 place-items-center rounded-control bg-primary-50 text-primary"><Icon name="share" size={22} /></button>
            <Link to={`/quiz/${state.data.id}`} className="flex h-14 flex-1 items-center justify-center rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{t('home.start')}</Link>
          </div>
        </section>
      )}
    </div>
  );
}
