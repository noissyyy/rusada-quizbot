import { clsx } from 'clsx';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { del, get, post, put, upload as uploadFile } from '../lib/api';
import { useLoad, useToast } from '../lib/hooks';
import type { QuizRow, Topic } from '../lib/types';
import { TestsManager } from '../components/TestsManager';
import { Button, Card, ErrorBox, Icon, Input, Pill, Spinner } from '../components/ui';
import { useEffect, useRef, useState } from 'react';

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
      <LayoutSwitch topic={t} onSaved={reload} />
      {t.layout === 'works' && <WorksEditor topic={t} rows={rows} onSaved={reload} />}
      <Card title="Тесты раздела">
        {tests.state.status === 'loading' && <Spinner />}
        {tests.state.status === 'error' && <ErrorBox error={tests.state.error} onRetry={tests.reload} />}
        {tests.state.status === 'ok' && <TestsManager rows={rows} reload={reload} showTopic={false} showWork={t.layout === 'works'} />}
      </Card>
      <p className="flex items-center gap-1.5 text-[13px] text-muted"><Icon name="check" size={15} />Удаление — навсегда. Результаты учеников остаются: каждая попытка хранит свою копию вопросов.</p>
    </>
  );
}

const topicBody = (t: Topic, patch: Partial<Topic> = {}) => {
  const x = { ...t, ...patch };
  return { title: x.title, description: x.description, color: x.color, illustration: x.illustration, isActive: x.isActive, layout: x.layout ?? 'default',
    subtopics: x.subtopics.map((s) => ({ id: s.id, title: s.title, author: s.author ?? '' })) };
};

/** How students see the section: a test list, or a shelf of works with covers. */
function LayoutSwitch({ topic, onSaved }: { topic: Topic; onSaved: () => void }) {
  const toast = useToast();
  const set = async (layout: 'default' | 'works') => {
    if (layout === (topic.layout ?? 'default')) return;
    if (layout === 'works' && !confirm('Показывать раздел как полку произведений?\n\nКаждый подраздел станет произведением с обложкой. Уже созданные тесты сами привяжутся к произведению по своим вопросам.')) return;
    try { await put(`/api/admin/topics/${topic.id}`, topicBody(topic, { layout })); toast(layout === 'works' ? 'Раздел — полка произведений. Тесты привязаны к произведениям' : 'Раздел — обычный список тестов'); onSaved(); }
    catch (e) { toast((e as Error).message, 'error'); }
  };
  return (
    <Card title="Как раздел выглядит у учеников">
      <div className="grid gap-2 sm:grid-cols-2">
        {([['default', 'Список тестов', 'Тесты списком, подразделы — фильтры сверху'], ['works', 'Полка произведений', 'Обложки произведений; внутри каждого — его тесты']] as const).map(([v, title, sub]) => (
          <button key={v} type="button" aria-pressed={(topic.layout ?? 'default') === v} onClick={() => set(v)}
            className={clsx('rounded-[16px] border-2 p-3 text-left', (topic.layout ?? 'default') === v ? 'border-primary bg-primary-50' : 'border-line')}>
            <div className="font-bold">{title}</div><div className="mt-0.5 text-[12px] text-muted">{sub}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}

/** Works of a «shelf» section: title, author, cover; tests are linked in the test editor. */
function WorksEditor({ topic, rows, onSaved }: { topic: Topic; rows: QuizRow[]; onSaved: () => void }) {
  const toast = useToast();
  const [works, setWorks] = useState(topic.subtopics.map((s) => ({ ...s, author: s.author ?? '' })));
  const [busy, setBusy] = useState(false);
  const fileFor = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setWorks(topic.subtopics.map((s) => ({ ...s, author: s.author ?? '' }))); }, [topic]);
  const dirty = JSON.stringify(works.map((w) => [w.id, w.title, w.author])) !== JSON.stringify(topic.subtopics.map((w) => [w.id, w.title, w.author ?? '']));
  const save = async () => {
    setBusy(true);
    try { await put(`/api/admin/topics/${topic.id}`, topicBody(topic, { subtopics: works.filter((w) => w.title.trim()) })); toast('Произведения сохранены'); onSaved(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const pickCover = (id: string) => { fileFor.current = id; input.current?.click(); };
  const upload = async (f: File | undefined) => {
    const id = fileFor.current;
    if (!f || !id) return;
    try { await uploadFile(`/api/admin/works/${id}/cover`, f); toast('Обложка загружена'); onSaved(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { if (input.current) input.current.value = ''; }
  };
  const dropCover = async (id: string) => { await del(`/api/admin/works/${id}/cover`); onSaved(); };
  const relink = async () => {
    const r = await post<{ linked: number }>(`/api/admin/topics/${topic.id}/link-works`);
    toast(r.linked ? `Привязано тестов: ${r.linked}` : 'Все тесты уже привязаны или их вопросы без подраздела'); onSaved();
  };
  const unlinked = rows.filter((r) => !r.workId).length;
  return (
    <Card title="Произведения" action={<span className="text-[13px] text-muted">Обложка 3:4 · JPG или PNG · до 10 МБ</span>}>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {works.map((w, i) => {
          const n = rows.filter((r) => r.workId && r.workId === w.id).length;
          return (
            <div key={w.id ?? `new-${i}`} className="flex gap-3 rounded-[16px] border border-line p-3">
              <div className="flex w-[84px] shrink-0 flex-col gap-1.5">
                {w.coverUrl ? <img src={w.coverUrl} alt="" className="aspect-[3/4] w-full rounded-[8px] bg-canvas object-cover shadow-card" />
                  : <span className="grid aspect-[3/4] w-full place-items-center rounded-[8px] border-2 border-dashed border-line px-1 text-center text-[11px] text-muted">нет обложки</span>}
                {w.id ? <button type="button" onClick={() => pickCover(w.id!)} className="text-[12px] font-bold text-primary">{w.coverUrl ? 'Заменить' : 'Загрузить'}</button>
                  : <span className="text-center text-[11px] text-muted">сначала сохраните</span>}
                {w.coverUrl && w.id && <button type="button" onClick={() => dropCover(w.id!)} className="text-[12px] font-bold text-muted">Убрать</button>}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Input aria-label="Произведение" placeholder="Название" value={w.title} onChange={(e) => setWorks(works.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Input aria-label="Автор" placeholder="Автор, напр. А. С. Пушкин" value={w.author} onChange={(e) => setWorks(works.map((x, j) => (j === i ? { ...x, author: e.target.value } : x)))} />
                <div className="mt-auto flex items-center justify-between text-[12px]">
                  <span className="text-muted">{n} тестов</span>
                  {w.id && <Link to={`/tests/new?topic=${topic.id}&work=${w.id}`} className="font-bold text-primary">+ тест</Link>}
                  <button type="button" onClick={() => { if (confirm(`Убрать «${w.title}»? Его тесты останутся в разделе без произведения.`)) setWorks(works.filter((_, j) => j !== i)); }} className="font-bold text-error-ink">Убрать</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button tone="ghost" icon="plus" onClick={() => setWorks([...works, { id: null, title: '', author: '', coverUrl: null }])}>Добавить произведение</Button>
        <Button disabled={!dirty || busy} onClick={save}>{busy ? 'Сохраняем…' : 'Сохранить произведения'}</Button>
        {unlinked > 0 && <Button tone="soft" onClick={relink}>Привязать тесты автоматически · {unlinked} без произведения</Button>}
      </div>
    </Card>
  );
}

