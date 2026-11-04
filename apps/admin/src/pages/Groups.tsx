import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../lib/api';
import { fmtDate, useLoad, useToast } from '../lib/hooks';
import type { QuizRow } from '../lib/types';
import { Button, Card, Empty, ErrorBox, Field, Input, PageHeader, Pill, Segmented, Select, Spinner } from '../components/ui';

interface GroupRow {
  id: string; title: string; chatId: number; botIsAdmin: boolean; membersCount: number; hostName: string | null;
  current: { id: string; quizTitle: string; passed: number; closesAt: string | null; open: boolean } | null;
}
const BOT = (import.meta.env.VITE_BOT_USERNAME as string | undefined) ?? 'Rusada_QuizBot';

export function GroupsPage() {
  const toast = useToast();
  const nav = useNavigate();
  const { state, reload } = useLoad(() => get<GroupRow[]>('/api/admin/groups'));
  const tests = useLoad(() => get<QuizRow[]>('/api/admin/tests?status=published'));
  const [groupId, setGroupId] = useState('');
  const [quizId, setQuizId] = useState('');
  const [format, setFormat] = useState<'async' | 'live'>('async');
  const [until, setUntil] = useState(() => new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 16));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const groups = state.status === 'ok' ? state.data : [];
  const quizzes = tests.state.status === 'ok' ? tests.state.data.filter((t) => (format === 'live' ? t.modes.includes('live') : t.modes.includes('group'))) : [];
  const g = groups.find((x) => x.id === (groupId || groups[0]?.id));
  const qz = quizzes.find((x) => x.id === (quizId || quizzes[0]?.id));

  const send = async () => {
    if (!g || !qz) return;
    setBusy(true); setErr(null);
    try {
      const r = await post<{ kind: string; liveId?: string }>('/api/admin/assignments', { groupId: g.id, quizId: qz.id, format, closesAt: format === 'async' && until ? new Date(until).toISOString() : null });
      toast('Тест отправлен в группу'); reload();
      if (r.kind === 'live' && r.liveId) nav(`/live/${r.liveId}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const close = async (id: string) => { await post(`/api/admin/assignments/${id}/close`); toast('Тест закрыт'); reload(); };

  return (
    <>
      <PageHeader title="Группы Telegram" sub={`Группы, куда добавлен бот @${BOT}`} />
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_440px]">
        <div className="flex flex-col gap-3">
          {state.status === 'loading' && <Spinner />}
          {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
          {state.status === 'ok' && groups.length === 0 && (
            <Card><Empty img="M03" title="Бот ещё не добавлен ни в одну группу">Добавьте @{BOT} в группу Telegram и сделайте его администратором — группа появится здесь автоматически.</Empty></Card>
          )}
          {groups.map((x) => (
            <Card key={x.id}>
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-[18px] font-bold">{x.title}</h2>{x.botIsAdmin ? <Pill tone="ok">✓ бот — админ</Pill> : <Pill tone="bad">✕ бот без прав</Pill>}</div>
              <p className="mt-1 text-[13px] text-muted">{x.membersCount} участников{x.hostName ? ` · ведущий: ${x.hostName}` : ''}</p>
              {!x.botIsAdmin && <p className="mt-2 rounded-[12px] bg-warning-50 p-3 text-[13px] text-warning-ink">Сделайте бота администратором, чтобы проверять участников группы.</p>}
              {x.current && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[14px] bg-canvas p-3">
                  <Pill tone={x.current.open ? 'info' : 'neutral'}>{x.current.open ? 'Идёт' : 'Закрыт'}</Pill>
                  <span className="flex-1 text-[14px]"><b>{x.current.quizTitle}</b> · {x.current.passed} из {x.membersCount} прошли{x.current.closesAt ? ` · до ${fmtDate(x.current.closesAt)}` : ''}</span>
                  <Button tone="ghost" className="!h-9" onClick={() => nav(`/results?group_id=${x.id}`)}>Результаты</Button>
                  {x.current.open && <Button tone="danger" className="!h-9" onClick={() => close(x.current!.id)}>Закрыть</Button>}
                </div>
              )}
            </Card>
          ))}
        </div>
        <Card title="Отправить тест в группу">
          <div className="flex flex-col gap-4">
            <Field label="Группа"><Select value={g?.id ?? ''} onChange={(e) => setGroupId(e.target.value)}>{groups.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</Select></Field>
            <div><span className="mb-1.5 block text-[13px] font-bold text-ink-2">Формат</span>
              <Segmented label="Формат" value={format} onChange={setFormat} options={[['async', 'Каждый сам · до дедлайна'], ['live', 'Все вместе · как эфир']]} />
            </div>
            <Field label="Тест"><Select value={qz?.id ?? ''} onChange={(e) => setQuizId(e.target.value)}>{quizzes.map((t) => <option key={t.id} value={t.id}>{t.title} · {t.questionsCount} вопр. · {Math.round(t.durationSec / 60)} мин</option>)}</Select></Field>
            {format === 'async' && <Field label="Открыт до"><Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></Field>}
            {g && qz && (
              <div className="rounded-[16px] bg-[#E7F0FB] p-3.5 text-[14px]">
                <div className="text-[12px] font-bold text-muted">Сообщение бота в группе</div>
                <p className="mt-1">📝 <b>Новый тест:</b> {qz.title}<br />{qz.questionsCount} вопросов · {Math.round(qz.durationSec / 60)} мин{format === 'async' && until ? ` · до ${fmtDate(new Date(until).toISOString())}` : ''}</p>
                <span className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-[10px] bg-white font-bold text-primary">{format === 'live' ? 'Войти в эфир' : 'Пройти тест'}</span>
              </div>
            )}
            {err && <p role="alert" className="text-[13px] font-semibold text-error-ink">{err}</p>}
            <Button icon="send" disabled={!g || !qz || busy} onClick={send}>Отправить в группу</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
