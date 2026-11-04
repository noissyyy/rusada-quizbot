import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { can, get, post } from '../lib/api';
import { useLoad, useMe, useToast } from '../lib/hooks';
import type { Page, Question, Topic } from '../lib/types';
import { Button, Card, Empty, ErrorBox, Icon, Input, PageHeader, Pager, Pill, Select, Spinner, Table, diffLabel, statusLabel } from '../components/ui';

const SIZE = 20;

export function QuestionsPage() {
  const me = useMe();
  const toast = useToast();
  const nav = useNavigate();
  const [topic, setTopic] = useState('');
  const [diff, setDiff] = useState('');
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const topics = useLoad(() => get<Topic[]>('/api/admin/topics'));
  const qs = new URLSearchParams({ page: String(page), size: String(SIZE), ...(topic && { topic_id: topic }), ...(diff && { difficulty: diff }), ...(status && { status }), ...(q && { q }) });
  const { state, reload } = useLoad(() => get<Page<Question>>(`/api/admin/questions?${qs}`), [qs.toString()]);
  const editor = can(me, 'admin');

  const bulk = async (action: string) => {
    try {
      await post('/api/admin/questions/bulk', { ids: [...sel], action });
      toast(action === 'duplicate' ? 'Копии созданы как черновики' : action === 'delete' ? 'Вопросы удалены' : 'Готово');
      setSel(new Set());
    } catch (e) { toast((e as Error).message, 'error'); }
    reload();
  };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <>
      <PageHeader title="Банк вопросов" sub={state.status === 'ok' ? `${state.data.total.toLocaleString('ru-RU')} вопросов по фильтру` : ' '}>
        {editor && <Link to="/import" className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-line bg-surface px-4 text-[14px] font-bold"><Icon name="import" size={18} />Импорт Excel</Link>}
        {editor && <Button icon="plus" onClick={() => nav('/questions/new')}>Новый вопрос</Button>}
      </PageHeader>
      <Card>
        <div className="mb-4 flex flex-wrap gap-2.5">
          <div className="relative min-w-[220px] flex-1"><Icon name="search" size={18} className="absolute left-3 top-3 text-muted" /><Input aria-label="Поиск по тексту" placeholder="Поиск по тексту вопроса" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="w-full pl-9" /></div>
          <Select aria-label="Раздел" value={topic} onChange={(e) => { setTopic(e.target.value); setPage(1); }}>
            <option value="">Все разделы</option>
            {topics.state.status === 'ok' && topics.state.data.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
          <Select aria-label="Сложность" value={diff} onChange={(e) => { setDiff(e.target.value); setPage(1); }}>
            <option value="">Любая сложность</option>{Object.entries(diffLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select aria-label="Статус" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Все статусы</option><option value="published">Опубликован</option><option value="draft">Черновик</option><option value="archived">Архив</option>
          </Select>
        </div>
        {editor && sel.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[14px] bg-primary-50 px-3 py-2">
            <span className="mr-2 text-[14px] font-bold text-primary">Выбрано: {sel.size}</span>
            <Button tone="ghost" className="!h-9" onClick={() => bulk('publish')}>Опубликовать</Button>
            <Button tone="ghost" className="!h-9" onClick={() => bulk('duplicate')}>Дублировать</Button>
            <Button tone="ghost" className="!h-9" onClick={() => bulk('archive')}>В архив</Button>
            <Button tone="danger" className="!h-9" icon="trash" onClick={() => { if (confirm(`Удалить выбранные вопросы (${sel.size})? Это нельзя отменить.`)) void bulk('delete'); }}>Удалить</Button>
          </div>
        )}
        {state.status === 'loading' && <Spinner />}
        {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
        {state.status === 'ok' && (
          <>
            <Table head={[editor ? <input key="all" type="checkbox" aria-label="Выбрать все" checked={state.data.items.length > 0 && state.data.items.every((x) => sel.has(x.id))} onChange={(e) => setSel(e.target.checked ? new Set(state.data.items.map((x) => x.id)) : new Set())} /> : '', 'Вопрос', 'Раздел', 'Сложность', 'Баллы', 'Верных ответов', 'Статус', '']}
              empty={state.data.items.length === 0 && <Empty img="E01" title="Ничего не найдено">Измените фильтры или добавьте вопрос.</Empty>}>
              {state.data.items.map((x) => {
                const [tone, label] = statusLabel[x.status] ?? ['neutral', x.status];
                return (
                  <tr key={x.id} className="hover:bg-canvas">
                    <td>{editor && <input type="checkbox" aria-label={`Выбрать: ${x.text}`} checked={sel.has(x.id)} onChange={() => toggle(x.id)} />}</td>
                    <td className="max-w-[420px] font-semibold">{x.text}</td>
                    <td className="text-muted">{x.topicTitle}{x.subtopicTitle ? ` · ${x.subtopicTitle}` : ''}</td>
                    <td>{diffLabel[x.difficulty]}</td>
                    <td className="tabular-nums">{x.points}</td>
                    <td className={x.correctRate != null && x.correctRate < 35 ? 'font-bold text-error-ink' : ''}>{x.correctRate != null ? `${x.correctRate}%` : '—'}</td>
                    <td><Pill tone={tone}>{label}</Pill></td>
                    <td>{editor && <Link to={`/questions/${x.id}`} aria-label="Изменить" className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-primary"><Icon name="edit" size={18} /></Link>}</td>
                  </tr>
                );
              })}
            </Table>
            <Pager page={page} size={SIZE} total={state.data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
