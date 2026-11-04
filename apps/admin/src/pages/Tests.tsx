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
    if (!confirm(`Удалить тест «${r.title}»? Вопросы останутся в банке.`)) return;
    try { await del(`/api/admin/tests/${r.id}`); toast('Тест удалён'); reload(); } catch (e) { toast((e as Error).message, 'error'); }
  };
  const archive = async (r: QuizRow, status: 'archived' | 'draft') => {
    try { await post(`/api/admin/tests/${r.id}/status`, { status }); toast(status === 'archived' ? 'Тест в архиве — ученики его не видят' : 'Тест возвращён в черновики'); reload(); }
    catch (e) { toast((e as Error).message, 'error'); }
  };
  const shown = filter ? rows.filter((r) => r.status === filter) : rows.filter((r) => r.status !== 'archived');
  return (
    <>
      <PageHeader title="Тесты" sub={`${count('published')} опубликовано · ${count('draft')} черновиков`}>
        {can(me, 'admin') && <Button icon="plus" onClick={() => nav('/tests/new')}>Новый тест</Button>}
      </PageHeader>
      <Card>
        <div className="mb-4"><Segmented label="Статус" value={filter} onChange={setFilter} options={[['', `Все · ${rows.length - count('archived')}`], ['published', `Опубликованные · ${count('published')}`], ['draft', `Черновики · ${count('draft')}`], ['archived', 'Архив']]} /></div>
        {state.status === 'loading' && <Spinner />}
        {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
        {state.status === 'ok' && (
          <Table head={['Тест', 'Раздел', 'Вопросов', 'Время', 'Режимы', 'Попыток', 'Статус', '']} empty={!shown.length && <Empty title="Тестов нет">Создайте тест и добавьте в него вопросы из банка.</Empty>}>
            {shown.map((r) => {
              const [tone, label] = r.isLive ? ['live', '● В эфире'] as const : statusLabel[r.status] ?? ['neutral', r.status];
              return (
                <tr key={r.id} className="hover:bg-canvas">
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
                        ? <button type="button" onClick={() => archive(r, 'draft')} className="h-8 rounded-[10px] px-2.5 text-[12px] font-bold text-primary hover:bg-primary-50">Вернуть</button>
                        : <button type="button" onClick={() => archive(r, 'archived')} className="h-8 rounded-[10px] px-2.5 text-[12px] font-bold text-ink-2 hover:bg-canvas">В архив</button>)}
                      {editor && (r.deletable
                        ? <button type="button" aria-label={`Удалить: ${r.title}`} onClick={() => remove(r)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-error-50 hover:text-error-ink"><Icon name="trash" size={17} /></button>
                        : <span title="Тест уже проходили — удалить нельзя, только в архив" className="grid size-8 place-items-center text-line"><Icon name="trash" size={17} /></span>)}
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
