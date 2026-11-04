import { clsx } from 'clsx';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { del, get, post, put } from '../lib/api';
import { useLoad, useToast } from '../lib/hooks';
import type { Topic } from '../lib/types';
import { Button, Card, ErrorBox, Field, Icon, Input, PageHeader, Pill, Spinner, Textarea, Toggle } from '../components/ui';

const COLORS: [string, string][] = [['blue', 'bg-topic-blue'], ['violet', 'bg-topic-violet'], ['mint', 'bg-topic-mint'], ['peach', 'bg-topic-peach'], ['pink', 'bg-topic-pink'], ['yellow', 'bg-topic-yellow'], ['sky', 'bg-topic-sky'], ['indigo', 'bg-topic-indigo'], ['lavender', 'bg-topic-lavender'], ['plum', 'bg-topic-plum'], ['rose', 'bg-topic-rose'], ['coral', 'bg-topic-coral'], ['orange', 'bg-topic-orange'], ['sand', 'bg-topic-sand'], ['lime', 'bg-topic-lime'], ['green', 'bg-topic-green'], ['teal', 'bg-topic-teal'], ['olive', 'bg-topic-olive'], ['slate', 'bg-topic-slate'], ['gray', 'bg-topic-gray']];
const ARTS = ['T01', 'T02', 'T03', 'T04', 'T05', 'T06'];
type Edit = Omit<Topic, 'id' | 'slug' | 'position' | 'testsCount' | 'questionsCount'> & { id?: string };

export function TopicsPage() {
  const toast = useToast();
  const { state, reload, setData } = useLoad(() => get<Topic[]>('/api/admin/topics'));
  const [edit, setEdit] = useState<Edit | null>(null);
  const [params, setParams] = useSearchParams();
  // «Настройки» on a section page opens the editor here
  useEffect(() => {
    const id = params.get('edit');
    if (!id || state.status !== 'ok') return;
    const t = state.data.find((x) => x.id === id);
    if (t) setEdit({ ...t });
    setParams({}, { replace: true });
  }, [params, state, setParams]);
  const [newSub, setNewSub] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const move = async (list: Topic[], i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setData(next);
    await post('/api/admin/topics/reorder', next.map((t) => t.id));
  };
  const save = async () => {
    if (!edit) return;
    setErr(null);
    try {
      const body = { title: edit.title, description: edit.description, color: edit.color, illustration: edit.illustration, isActive: edit.isActive, subtopics: edit.subtopics };
      if (edit.id) await put(`/api/admin/topics/${edit.id}`, body); else await post('/api/admin/topics', body);
      toast('Раздел сохранён'); setEdit(null); reload();
    } catch (e) { setErr((e as Error).message); }
  };
  const remove = async (t: Topic) => {
    if (!confirm(`Удалить раздел «${t.title}» навсегда?\n\nВместе с ним удалятся все его тесты (${t.testsCount}) и вопросы (${t.questionsCount}). Результаты учеников сохранятся.`)) return;
    try {
      const r = await del<{ testsDeleted: number; questionsDeleted: number }>(`/api/admin/topics/${t.id}`);
      toast(`Раздел удалён · тестов: ${r.testsDeleted}, вопросов: ${r.questionsDeleted}`);
      if (edit?.id === t.id) setEdit(null);
      reload();
    } catch (e) { toast((e as Error).message); }
  };

  return (
    <>
      <PageHeader title="Разделы" sub="Нажмите на раздел, чтобы управлять его тестами. Порядок здесь = порядок в приложении.">
        <Button icon="plus" onClick={() => setEdit({ title: '', description: '', color: 'blue', illustration: '/3d/rq-3d-T01.webp', isActive: true, subtopics: [] })}>Новый раздел</Button>
      </PageHeader>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_420px]">
        <Card>
          {state.status === 'loading' && <Spinner />}
          {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
          {state.status === 'ok' && (
            <ul className="flex flex-col gap-2">
              {state.data.map((t, i) => (
                <li key={t.id} className={clsx('flex items-center gap-3 rounded-[16px] border p-3', edit?.id === t.id ? 'border-primary bg-primary-50' : 'border-line')}>
                  <span className="flex flex-col"><button type="button" aria-label="Выше" onClick={() => move(state.data, i, -1)} className="text-muted hover:text-ink"><Icon name="up" size={16} /></button><button type="button" aria-label="Ниже" onClick={() => move(state.data, i, 1)} className="text-muted hover:text-ink"><Icon name="down" size={16} /></button></span>
                  <img src={t.illustration} alt="" className={clsx('size-12 rounded-[12px] object-contain p-1', COLORS.find(([c]) => c === t.color)?.[1])} />
                  <Link to={`/topics/${t.id}`} className="min-w-0 flex-1 hover:text-primary"><div className="font-bold">{t.title} <span className="text-primary">→</span></div><div className="text-[13px] text-muted">{t.subtopics.length} подразделов · {t.testsCount} тестов · {t.questionsCount} вопросов</div></Link>
                  <Pill tone={t.isActive ? 'ok' : 'neutral'}>{t.isActive ? 'Активен' : 'Скрыт'}</Pill>
                  <button type="button" aria-label={`Изменить: ${t.title}`} onClick={() => { setEdit({ ...t }); setErr(null); }} className="grid size-9 place-items-center rounded-full text-muted hover:text-primary"><Icon name="edit" size={18} /></button>
                  <button type="button" aria-label={`Удалить: ${t.title}`} onClick={() => remove(t)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-error-50 hover:text-error-ink"><Icon name="trash" size={18} /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {edit && (
          <Card title={edit.id ? edit.title || 'Раздел' : 'Новый раздел'}>
            <div className="flex flex-col gap-4">
              <Field label="Название"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label="Короткое описание"><Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
              <div><span className="mb-1.5 block text-[13px] font-bold text-ink-2">Цвет карточки</span>
                <div className="flex flex-wrap gap-2">{COLORS.map(([c, cls]) => <button key={c} type="button" aria-label={c} aria-pressed={edit.color === c} onClick={() => setEdit({ ...edit, color: c })} className={clsx('size-9 rounded-full', cls, edit.color === c && 'ring-2 ring-primary ring-offset-2')} />)}</div>
              </div>
              <div><span className="mb-1.5 block text-[13px] font-bold text-ink-2">Иллюстрация</span>
                <div className="flex flex-wrap gap-2">{ARTS.map((a) => { const src = `/3d/rq-3d-${a}.webp`; return <button key={a} type="button" aria-label={a} aria-pressed={edit.illustration === src} onClick={() => setEdit({ ...edit, illustration: src })} className={clsx('size-12 rounded-[12px] bg-canvas p-1', edit.illustration === src && 'ring-2 ring-primary')}><img src={src} alt="" className="size-full object-contain" /></button>; })}</div>
              </div>
              <div><span className="mb-1.5 block text-[13px] font-bold text-ink-2">Подразделы</span>
                <div className="flex flex-wrap gap-2">
                  {edit.subtopics.map((s, i) => (
                    <span key={`${s.id}-${i}`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-canvas pl-3 pr-1 text-[13px] font-semibold">{s.title}
                      <button type="button" aria-label={`Удалить ${s.title}`} onClick={() => setEdit({ ...edit, subtopics: edit.subtopics.filter((_, j) => j !== i) })} className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface"><Icon name="x" size={14} /></button>
                    </span>
                  ))}
                </div>
                <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newSub.trim()) { setEdit({ ...edit, subtopics: [...edit.subtopics, { id: null, title: newSub.trim() }] }); setNewSub(''); } }}>
                  <Input aria-label="Новый подраздел" placeholder="Новый подраздел" value={newSub} onChange={(e) => setNewSub(e.target.value)} className="flex-1" />
                  <Button tone="soft" type="submit">+ Добавить</Button>
                </form>
              </div>
              <Toggle label="Показывать раздел ученикам" checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} />
              {err && <p role="alert" className="text-[13px] font-semibold text-error-ink">{err}</p>}
              <div className="flex gap-2"><Button tone="ghost" onClick={() => setEdit(null)}>Отмена</Button><Button className="flex-1" disabled={!edit.title.trim()} onClick={save}>Сохранить</Button></div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
