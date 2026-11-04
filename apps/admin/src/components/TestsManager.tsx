import { useState } from 'react';
import { Link } from 'react-router-dom';
import { can, del, post } from '../lib/api';
import { fmtNum, useMe, useToast } from '../lib/hooks';
import type { QuizRow } from '../lib/types';
import { Button, Empty, Icon, Pill, Segmented, Table, modeLabel, statusLabel } from './ui';

type Filter = '' | 'published' | 'draft' | 'archived';

/** Table of tests with filters, bulk actions and per-row actions. Used on «Тесты» and inside a section. */
export function TestsManager({ rows, reload, showTopic = true, initialFilter = '' }: { rows: QuizRow[]; reload: () => void; showTopic?: boolean; initialFilter?: Filter }) {
  const me = useMe();
  const toast = useToast();
  const editor = can(me, 'admin');
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const shown = filter ? rows.filter((r) => r.status === filter) : rows.filter((r) => r.status !== 'archived');
  const toggle = (id: string) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShownSelected = shown.length > 0 && shown.every((r) => sel.has(r.id));

  const remove = async (r: QuizRow) => {
    if (!confirm(`Удалить тест «${r.title}» навсегда вместе с его вопросами?\n\nРезультаты учеников, которые его уже прошли, сохранятся.`)) return;
    try {
      const x = await del<{ questionsDeleted: number; questionsKept: number }>(`/api/admin/tests/${r.id}`);
      toast(`Тест удалён · вопросов удалено: ${x.questionsDeleted}${x.questionsKept ? ` · ${x.questionsKept} оставлено — они есть в других тестах` : ''}`);
      reload();
    } catch (e) { toast((e as Error).message, 'error'); }
  };
  const setStatus = async (r: QuizRow, action: 'publish' | 'archive' | 'draft') => {
    try {
      const x = await post<{ done: number; failed: { title: string; reason: string }[] }>('/api/admin/tests/bulk', { ids: [r.id], action });
      if (x.failed.length) toast(`«${r.title}» — ${x.failed[0]!.reason}`, 'error');
      else toast(action === 'publish' ? 'Опубликован — ученики видят тест' : action === 'archive' ? 'В архиве — ученики его не видят' : 'Возвращён в черновики');
      reload();
    } catch (e) { toast((e as Error).message, 'error'); }
  };
  const bulk = async (ids: string[], action: 'publish' | 'archive' | 'draft' | 'delete') => {
    if (!ids.length) return;
    if (action === 'delete' && !confirm(`Удалить выбранные тесты (${ids.length}) навсегда вместе с их вопросами?\n\nРезультаты учеников сохранятся.`)) return;
    setBusy(true);
    try {
      const r = await post<{ done: number; failed: { title: string; reason: string }[]; questionsDeleted: number }>('/api/admin/tests/bulk', { ids, action });
      const head = action === 'delete' ? `Удалено тестов: ${r.done}, вопросов: ${r.questionsDeleted}`
        : `${action === 'publish' ? 'Опубликовано' : action === 'archive' ? 'В архиве' : 'В черновиках'}: ${r.done}`;
      toast(r.failed.length ? `${head}. Не получилось: ${r.failed.map((f) => `«${f.title}» — ${f.reason}`).join('; ')}` : head, r.failed.length ? 'error' : 'ok');
      setSel(new Set());
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); reload(); }
  };

  return (
    <>
      <div className="mb-4"><Segmented label="Статус" value={filter} onChange={(v) => { setFilter(v); setSel(new Set()); }} options={[['', `Все · ${rows.length - count('archived')}`], ['published', `Опубликованные · ${count('published')}`], ['draft', `Черновики · ${count('draft')}`], ['archived', `Архив · ${count('archived')}`]]} /></div>
      {editor && sel.size > 0 && (
        <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-[14px] bg-primary-50 px-3 py-2 shadow-card">
          <span className="mr-2 text-[14px] font-bold text-primary">Выбрано: {sel.size}</span>
          <Button className="!h-9" icon="check" disabled={busy} onClick={() => bulk([...sel], 'publish')}>Опубликовать</Button>
          <Button tone="ghost" className="!h-9" disabled={busy} onClick={() => bulk([...sel], 'draft')}>В черновики</Button>
          <Button tone="ghost" className="!h-9" disabled={busy} onClick={() => bulk([...sel], 'archive')}>В архив</Button>
          <Button tone="danger" className="!h-9" icon="trash" disabled={busy} onClick={() => bulk([...sel], 'delete')}>Удалить</Button>
          <button type="button" onClick={() => setSel(new Set())} className="ml-auto text-[13px] font-bold text-muted">Снять выбор</button>
        </div>
      )}
      <Table head={[editor ? <input key="all" type="checkbox" aria-label="Выбрать все" checked={allShownSelected} onChange={(e) => setSel(e.target.checked ? new Set(shown.map((r) => r.id)) : new Set())} /> : '', 'Тест', ...(showTopic ? ['Раздел'] : []), 'Вопросов', 'Время', 'Режимы', 'Попыток', 'Статус', '']}
        empty={!shown.length && <Empty title={filter === 'archived' ? 'Архив пуст' : 'Тестов нет'}>Создайте тест и добавьте в него вопросы из банка.</Empty>}>
        {shown.map((r) => {
          const [tone, label] = r.isLive ? ['live', '● В эфире'] as const : statusLabel[r.status] ?? ['neutral', r.status];
          return (
            <tr key={r.id} className="hover:bg-canvas">
              <td>{editor && <input type="checkbox" aria-label={`Выбрать: ${r.title}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} />}</td>
              <td className="font-bold"><Link to={`/tests/${r.id}`} className="text-ink hover:text-primary">{r.title}</Link></td>
              {showTopic && <td className="text-muted"><Link to={`/topics/${r.topicId}`} className="hover:text-primary">{r.topicTitle}</Link></td>}
              <td className="tabular-nums">{r.questionsCount}</td>
              <td className="whitespace-nowrap">{Math.round(r.durationSec / 60)} мин</td>
              <td><div className="flex flex-wrap gap-1">{r.modes.map((m) => <Pill key={m} tone="neutral">{modeLabel[m]}</Pill>)}</div></td>
              <td className="tabular-nums">{fmtNum(r.attempts)}</td>
              <td><Pill tone={tone}>{label}</Pill></td>
              <td>
                <div className="flex items-center justify-end gap-1">
                  {editor && r.status === 'draft' && <button type="button" onClick={() => setStatus(r, 'publish')} className="h-8 whitespace-nowrap rounded-[10px] px-2.5 text-[12px] font-bold text-primary hover:bg-primary-50">Опубликовать</button>}
                  {editor && r.status === 'published' && <button type="button" onClick={() => setStatus(r, 'archive')} className="h-8 whitespace-nowrap rounded-[10px] px-2.5 text-[12px] font-bold text-ink-2 hover:bg-canvas">В архив</button>}
                  {editor && r.status === 'archived' && <button type="button" onClick={() => setStatus(r, 'draft')} className="h-8 whitespace-nowrap rounded-[10px] px-2.5 text-[12px] font-bold text-primary hover:bg-primary-50">Вернуть</button>}
                  <Link to={`/tests/${r.id}`} aria-label={`Изменить: ${r.title}`} className="grid size-8 place-items-center rounded-full text-muted hover:text-primary"><Icon name="edit" size={17} /></Link>
                  {editor && (r.deletable
                    ? <button type="button" aria-label={`Удалить: ${r.title}`} onClick={() => remove(r)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-error-50 hover:text-error-ink"><Icon name="trash" size={17} /></button>
                    : <span title="Сейчас идёт эфир по этому тесту — завершите его, потом удаляйте" className="grid size-8 place-items-center text-line"><Icon name="trash" size={17} /></span>)}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
