import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { download, get } from '../lib/api';
import { fmtDate, fmtNum, useLoad, useToast } from '../lib/hooks';
import type { QuizRow } from '../lib/types';
import { Button, Card, Empty, ErrorBox, Input, PageHeader, Pill, Select, Spinner, Table, modeLabel, statusLabel } from '../components/ui';

interface Row { id: string; userName: string; username: string | null; quizTitle: string; mode: string; points: number; maxPoints: number; accuracy: number | null; correct: number; wrong: number; unanswered: number; status: string; startedAt: string; finishedAt: string | null }
interface Res { total: number; finished: number; timedOut: number; abandoned: number; avgPercent: number | null; items: Row[] }
const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

export function ResultsPage() {
  const toast = useToast();
  const [params] = useSearchParams();
  const [from, setFrom] = useState(day(-6));
  const [to, setTo] = useState(day(0));
  const [quiz, setQuiz] = useState('');
  const [mode, setMode] = useState('');
  const groupId = params.get('group_id') ?? '';
  const tests = useLoad(() => get<QuizRow[]>('/api/admin/tests'));
  const toIso = new Date(new Date(to).getTime() + 864e5).toISOString().slice(0, 10);
  const qs = new URLSearchParams({ from, to: toIso, ...(quiz && { quiz_id: quiz }), ...(mode && { mode }), ...(groupId && { group_id: groupId }) });
  const { state, reload } = useLoad(() => get<Res>(`/api/admin/results?${qs}`), [qs.toString()]);
  const exp = async (fmt: 'csv' | 'xlsx') => { try { await download('GET', `/api/admin/results/export?fmt=${fmt}&${qs}`, `rusada-results.${fmt}`); } catch (e) { toast((e as Error).message, 'error'); } };

  return (
    <>
      <PageHeader title="Результаты" sub={state.status === 'ok' ? `${fmtNum(state.data.total)} попыток за период${groupId ? ' · одна группа' : ''}` : ' '}>
        <Button tone="ghost" icon="download" onClick={() => exp('csv')}>Экспорт CSV</Button>
        <Button tone="ghost" icon="download" onClick={() => exp('xlsx')}>Экспорт XLSX</Button>
      </PageHeader>
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-2.5">
          <label className="text-[12px] font-bold text-muted">С<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-2" /></label>
          <label className="text-[12px] font-bold text-muted">по<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-2" /></label>
          <Select aria-label="Тест" value={quiz} onChange={(e) => setQuiz(e.target.value)}><option value="">Все тесты</option>{tests.state.status === 'ok' && tests.state.data.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select>
          <Select aria-label="Режим" value={mode} onChange={(e) => setMode(e.target.value)}><option value="">Все режимы</option><option value="individual">Личный</option><option value="group">Группа</option></Select>
        </div>
        {state.status === 'loading' && <Spinner />}
        {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
        {state.status === 'ok' && (
          <>
            <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              {[['Средний балл', state.data.avgPercent != null ? `${state.data.avgPercent}%` : '—'], ['Завершено', fmtNum(state.data.finished)], ['Время вышло', fmtNum(state.data.timedOut)], ['Не закончено', fmtNum(state.data.total - state.data.finished - state.data.timedOut)]].map(([l, v]) => (
                <div key={l} className="rounded-[16px] bg-canvas p-3.5"><div className="text-[12px] font-semibold text-muted">{l}</div><div className="font-display text-[24px] font-extrabold">{v}</div></div>
              ))}
            </div>
            <Table head={['Пользователь', 'Тест', 'Режим', 'Баллы', 'Точность', '✓ / ✕ / —', 'Статус', 'Начало → конец']} empty={!state.data.items.length && <Empty img="E02" title="За этот период попыток нет" />}>
              {state.data.items.map((r) => {
                const [tone, label] = statusLabel[r.status] ?? ['neutral', r.status];
                const done = r.status !== 'in_progress';
                return (
                  <tr key={r.id}>
                    <td><div className="font-bold">{r.userName}</div><div className="text-[12px] text-muted">{r.username ? `@${r.username}` : ''}</div></td>
                    <td>{r.quizTitle}</td><td>{modeLabel[r.mode]}</td>
                    <td className="whitespace-nowrap font-bold tabular-nums">{done ? `${fmtNum(r.points)} / ${fmtNum(r.maxPoints)}` : '—'}</td>
                    <td>{done && r.accuracy != null ? `${r.accuracy}%` : '—'}</td>
                    <td className="tabular-nums">{r.correct} / {r.wrong} / {done ? r.unanswered : '—'}</td>
                    <td><Pill tone={tone}>{label}</Pill></td>
                    <td className="whitespace-nowrap text-muted">{fmtDate(r.startedAt)} → {r.finishedAt ? new Date(r.finishedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '…'}</td>
                  </tr>
                );
              })}
            </Table>
          </>
        )}
      </Card>
    </>
  );
}
