import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { can, del, get, post } from '../lib/api';
import { fmtNum, useLoad, useMe, useToast } from '../lib/hooks';
import type { QuizRow } from '../lib/types';
import { Button, Card, Empty, ErrorBox, Icon, PageHeader, Pill, Segmented, Spinner, Table, modeLabel, statusLabel } from '../components/ui';

export function TestsPage() {
  const me = useMe();
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<'' | 'published' | 'draft' | 'archived'>((params.get('status') as 'draft') ?? '');
  const { state, reload } = useLoad(() => get<QuizRow[]>('/api/admin/tests'));
  const rows = state.status === 'ok' ? state.data : [];
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const editor = can(me, 'admin');
  const remove = async (r: QuizRow) => {
    if (!confirm(`Удалить тест «${r.title}» вместе с его вопросами? Это нельзя отменить.`)) return;
    try {
      const x = await del<{ questionsDeleted: number; questionsKept: number }>(`/api/admin/tests/${r.id}`);
      toast(`Тест удалён, вопросов удалено: ${x.questionsDeleted}${x.questionsKept ? ` (оставлено ${x.questionsKept} — они есть в других тестах)` : ''}`);
      reload();
    } catch (e) { toast((e as Error).message, 'error'); }
  };
  const archive = async (r: QuizRow, status: 'archived' | 'draft') => {
    try { await post(`/api/admin/tests/${r.id}/status`, { status }); toast(status === 'archived' ? 'Тест в архиве — ученики его не видят' : 'Тест возвращён в черновики'); reload(); }
    catch (e) { toast((e as Error).message, 'error'); }
  };
  const shown = filter ? rows.filter((r) => r.status === filter) : rows.filter((r) => r.status !== 'archived');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const drafts = rows.filter((r) => r.status === 'draft');
  const toggle = (id: string) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const bulk = async (ids: string[], action: 'publish' | 'archive' | 'draft' | 'delete') => {
    if (!ids.length) return;
    if (action === 'delete' && !confirm(`Удалить выбранные тесты (${ids.length}) вместе с их вопросами? Это нельзя отменить. Тесты, которые уже проходили, останутся — их можно только в архив.`)) return;
    setBusy(true);
    try {
      const r = await post<{ done: number; failed: { title: string; reason: string }[]; questionsDeleted: number }>('/api/admin/tests/bulk', { ids, action });
      const verb = action === 'publish' ? 'Опубликовано' : action === 'archive' ? 'В архиве' : action === 'delete' ? `Удалено тестов: ${r.done}, вопросов: ${r.questionsDeleted}` : 'В черновиках';
      const head = action === 'delete' ? verb : `${verb}: ${r.done}`;
      toast(r.failed.length ? `${head}. Не получилось: ${r.failed.map((f) => `«${f.title}» — ${f.reason}`).join('; ')}` : head, r.failed.length ? 'error' : 'ok');
      setSel(new Set());
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); reload(); }
  };
  const allShownSelected = shown.length > 0 && shown.every((r) => sel.has(r.id));
  return (
    <>
      <PageHeader title="Тесты" sub={`${count('published')} опубликовано · ${count('draft')} черновиков`}>
        {editor && drafts.length > 0 && (
          <Button tone="soft" icon="check" disabled={busy}
            onClick={() => { if (confirm(`Опубликовать все черновики (${drafts.length})? Их вопросы тоже станут видны ученикам.`)) void bulk(drafts.map((d) => d.id), 'publish'); }}>
            Опубликовать все черновики · {drafts.length}
          </Button>
        )}
        {editor && <Button icon="plus" onClick={() => nav('/tests/new')}>Новый тест</Button>}
      </PageHeader>
      <Card>
        <div className="mb-4"><Segmented label="Статус" value={filter} onChange={setFilter} options={[['', `Все · ${rows.length - count('archived')}`], ['published', `Опубликованные · ${count('published')}`], ['draft', `Черновики · ${count('draft')}`], ['archived', 'Архив']]} /></div>
        {editor && sel.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[14px] bg-primary-50 px-3 py-2">
            <span className="mr-2 text-[14px] font-bold text-primary">Выбрано: {sel.size}</span>
            <Button className="!h-9" icon="check" disabled={busy} onClick={() => bulk([...sel], 'publish')}>Опубликовать</Button>
            <Button tone="ghost" className="!h-9" disabled={busy} onClick={() => bulk([...sel], 'draft')}>В черновики</Button>
            <Button tone="ghost" className="!h-9" disabled={busy} onClick={() => bulk([...sel], 'archive')}>В архив</Button>
            <Button tone="danger" className="!h-9" icon="trash" disabled={busy} onClick={() => bulk([...sel], 'delete')}>Удалить</Button>
            <button type="button" onClick={() => setSel(new Set())} className="ml-auto text-[13px] font-bold text-muted">Снять выбор</button>
          </div>
        )}
        {state.status === 'loading' && <Spinner />}
        {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
        {state.status === 'ok' && (
          <Table head={[editor ? <input key="all" type="checkbox" aria-label="Выбрать все" checked={allShownSelected} onChange={(e) => setSel(e.target.checked ? new Set(shown.map((r) => r.id)) : new Set())} /> : '', 'Тест', 'Раздел', 'Вопросов', 'Время', 'Режимы', 'Попыток', 'Статус', '']} empty={!shown.length && <Empty title="Тестов нет">Создайте тест и добавьте в него вопросы из банка.</Empty>}>
            {shown.map((r) => {
              const [tone, label] = r.isLive ? ['live', '● В эфире'] as const : statusLabel[r.status] ?? ['neutral', r.status];
              return (
                <tr key={r.id} className="hover:bg-canvas">
                  <td>{editor && <input type="checkbox" aria-label={`Выбрать: ${r.title}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} />}</td>
                  <td className="font-bold"><Link to={`/tests/${r.id}`} className="text-ink hover:text-primary">{r.title}</Link></td>
                  <td className="text-muted">{r.topicTitle}</td>
                  <td className="tabular-nums">{r.questionsCount}</td>
                  <td className="whitespace-nowrap">{Math.round(r.durationSec / 60)} мин{r.modes.includes('live') ? ` · эфир ${r.liveQuestionSec} с/вопрос` : ''}</td>
                  <td><div className="flex flex-wrap gap-1">{r.modes.map((m) => <Pill key={m} tone="neutral">{modeLabel[m]}</Pill>)}</div></td>
                  <td className="tabular-nums">{fmtNum(r.attempts)}</td>
                  <td><Pill tone={tone}>{label}</Pill></td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      {editor && (r.status === 'archived'
                        ? <button type="button" onClick={() => archive(r, 'draft')} className="h-8 whitespace-nowrap rounded-[10px] px-2.5 text-[12px] font-bold text-primary hover:bg-primary-50">Вернуть</button>
                        : <button type="button" onClick={() => archive(r, 'archived')} className="h-8 whitespace-nowrap rounded-[10px] px-2.5 text-[12px] font-bold text-ink-2 hover:bg-canvas">В архив</button>)}
                      {editor && (r.deletable
                        ? <button type="button" aria-label={`Удалить: ${r.title}`} onClick={() => remove(r)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-error-50 hover:text-error-ink"><Icon name="trash" size={17} /></button>
                        : <span title="Тест уже проходили или он был в эфире/группе — удалить нельзя, только в архив" className="grid size-8 place-items-center text-line"><Icon name="trash" size={17} /></span>)}
                      <Link to={`/tests/${r.id}`} aria-label="Открыть" className="grid size-8 place-items-center rounded-full text-muted hover:text-primary"><Icon name="chevron" size={18} /></Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
