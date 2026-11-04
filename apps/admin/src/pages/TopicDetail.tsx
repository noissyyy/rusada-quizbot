import { clsx } from 'clsx';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { del, get } from '../lib/api';
import { useLoad, useToast } from '../lib/hooks';
import type { QuizRow, Topic } from '../lib/types';
import { TestsManager } from '../components/TestsManager';
import { Button, Card, ErrorBox, Icon, Pill, Spinner } from '../components/ui';

/** A section with everything inside it: its tests (publish, archive, delete), questions and settings. */
export function TopicDetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const topics = useLoad(() => get<Topic[]>('/api/admin/topics'), [id]);
  const tests = useLoad(() => get<QuizRow[]>('/api/admin/tests'), [id]);
  if (topics.state.status === 'error') return <ErrorBox error={topics.state.error} onRetry={topics.reload} />;
  if (topics.state.status !== 'ok') return <Spinner />;
  const t = topics.state.data.find((x) => x.id === id);
  if (!t) return <ErrorBox error={new Error('Раздел не найден — возможно, его удалили')} />;
  const rows = tests.state.status === 'ok' ? tests.state.data.filter((r) => r.topicId === id) : [];
  const reload = () => { tests.reload(); topics.reload(); };
  const remove = async () => {
    if (!confirm(`Удалить раздел «${t.title}» навсегда?\n\nВместе с ним удалятся все его тесты (${rows.length}) и вопросы (${t.questionsCount}). Результаты учеников сохранятся.`)) return;
    try {
      const r = await del<{ testsDeleted: number; questionsDeleted: number }>(`/api/admin/topics/${t.id}`);
      toast(`Раздел удалён · тестов: ${r.testsDeleted}, вопросов: ${r.questionsDeleted}`);
      nav('/topics', { replace: true });
    } catch (e) { toast((e as Error).message, 'error'); }
  };
  return (
    <>
      <nav className="text-[13px] font-semibold text-muted"><Link to="/topics" className="hover:text-primary">Разделы</Link> / <span className="text-ink">{t.title}</span></nav>
      <header className={clsx('flex flex-wrap items-center gap-4 rounded-[24px] p-5', `bg-topic-${t.color}`)}>
        <img src={t.illustration} alt="" className="size-20 object-contain" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-[26px] font-bold tracking-tight">{t.title}</h1><Pill tone={t.isActive ? 'ok' : 'neutral'}>{t.isActive ? 'Виден ученикам' : 'Скрыт'}</Pill></div>
          <p className="mt-1 text-[14px] text-ink-2">{rows.length} тестов · {t.questionsCount} вопросов · {t.subtopics.length} подразделов</p>
          {t.subtopics.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{t.subtopics.map((s) => <span key={s.id ?? s.title} className="rounded-full bg-white/70 px-2.5 py-1 text-[12px] font-semibold">{s.title}</span>)}</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon="plus" onClick={() => nav(`/tests/new?topic=${t.id}`)}>Новый тест</Button>
          <Button tone="ghost" onClick={() => nav(`/questions?topic_id=${t.id}`)}>Вопросы раздела</Button>
          <Button tone="ghost" icon="edit" onClick={() => nav(`/topics?edit=${t.id}`)}>Настройки</Button>
          <Button tone="danger" icon="trash" onClick={remove}>Удалить раздел</Button>
        </div>
      </header>
      <Card title="Тесты раздела">
        {tests.state.status === 'loading' && <Spinner />}
        {tests.state.status === 'error' && <ErrorBox error={tests.state.error} onRetry={tests.reload} />}
        {tests.state.status === 'ok' && <TestsManager rows={rows} reload={reload} showTopic={false} />}
      </Card>
      <p className="flex items-center gap-1.5 text-[13px] text-muted"><Icon name="check" size={15} />Удаление — навсегда. Результаты учеников остаются: каждая попытка хранит свою копию вопросов.</p>
    </>
  );
}
