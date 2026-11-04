import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { can, get } from '../lib/api';
import { fmtNum, useLoad, useMe } from '../lib/hooks';
import type { QuizRow } from '../lib/types';
import { Button, Card, Empty, ErrorBox, Icon, PageHeader, Pill, Segmented, Spinner, Table, modeLabel, statusLabel } from '../components/ui';

export function TestsPage() {
  const me = useMe();
  const nav = useNavigate();
  const [filter, setFilter] = useState<'' | 'published' | 'draft' | 'archived'>('');
  const { state, reload } = useLoad(() => get<QuizRow[]>('/api/admin/tests'));
  const rows = state.status === 'ok' ? state.data : [];
  const count = (s: string) => rows.filter((r) => r.status === s).length;
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
                  <td><Link to={`/tests/${r.id}`} aria-label="Открыть" className="grid size-9 place-items-center rounded-full text-muted hover:text-primary"><Icon name="chevron" size={18} /></Link></td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
