import { clsx } from 'clsx';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { can, get } from '../lib/api';
import { ago, fmtNum, useLoad, useMe } from '../lib/hooks';
import { Card, ErrorBox, Icon, PageHeader, Pill, Segmented, Spinner, Table, modeLabel } from '../components/ui';

interface Dash {
  usersTotal: number; usersWeek: number; questionsTotal: number; questionsDrafts: number; testsPublished: number; topics: number;
  attemptsTotal: number; series: { date: string; count: number }[];
  active: ({ kind: 'live'; id: string; title: string; state: string; index: number; total: number; participants: number } | { kind: 'group'; id: string; title: string; passed: number; members: number })[];
  lastResults: { id: string; userName: string; quizTitle: string; mode: string; points: number; accuracy: number | null; status: string; finishedAt: string | null }[];
  hardest: { id: string; text: string; topic: string; rate: number }[];
}

export function DashboardPage() {
  const me = useMe()!;
  const [days, setDays] = useState<'7' | '30'>('7');
  const { state, reload } = useLoad(() => get<Dash>(`/api/admin/dashboard?days=${days}`), [days]);
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  return (
    <>
      <PageHeader title={`${hello}, ${me.name.split(' ')[0]}`} sub={`Сводка по платформе за последние ${days} дней`}>
        {can(me, 'admin') && <Link to="/questions/new" className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-primary px-4 text-[14px] font-bold text-white shadow-[0_8px_18px_rgba(106,61,240,.28)]"><Icon name="plus" size={18} />Новый вопрос</Link>}
      </PageHeader>
      {can(me, 'admin') && <SalesCard />}
      {state.status === 'loading' && <Spinner />}
      {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
      {state.status === 'ok' && <Body d={state.data} days={days} setDays={setDays} />}
    </>
  );
}

function Body({ d, days, setDays }: { d: Dash; days: '7' | '30'; setDays: (v: '7' | '30') => void }) {
  const kpis = [
    ['Пользователи', fmtNum(d.usersTotal), `+${d.usersWeek} за неделю`],
    ['Вопросов в банке', fmtNum(d.questionsTotal), `из них ${d.questionsDrafts} черновиков`],
    ['Опубликовано тестов', fmtNum(d.testsPublished), `в ${d.topics} разделах`],
    ['Активные сессии', String(d.active.length), `${d.active.filter((a) => a.kind === 'live').length} эфир · ${d.active.filter((a) => a.kind === 'group').length} групп`],
  ];
  const max = Math.max(1, ...d.series.map((s) => s.count));
  const peak = d.series.reduce((a, b) => (b.count > a.count ? b : a), d.series[0]!);
  return (
    <>
      <section aria-label="Ключевые показатели" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {kpis.map(([l, v, s]) => (
          <Card key={l}><div className="text-[13px] font-semibold text-muted">{l}</div><div className="mt-1 font-display text-[32px] font-extrabold tabular-nums">{v}</div><div className="text-[12px] text-muted">{s}</div></Card>
        ))}
      </section>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Пройдено тестов по дням" action={<Segmented label="Период" value={days} onChange={setDays} options={[['7', '7 дней'], ['30', '30 дней']]} />}>
          <p className="-mt-3 mb-4 text-[13px] text-muted">Всего {fmtNum(d.attemptsTotal)} попыток</p>
          <div className="flex h-56 items-end gap-1.5" role="img" aria-label={`Попытки по дням, максимум ${peak?.count ?? 0}`}>
            {d.series.map((s) => (
              <div key={s.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] font-bold text-ink-2 opacity-0 group-hover:opacity-100">{s.count}</span>
                <div className={clsx('w-full max-w-10 rounded-t-[8px]', s === peak && s.count ? 'bg-primary' : 'bg-primary/30')} style={{ height: `${(100 * s.count) / max}%`, minHeight: 2 }} title={`${s.date}: ${s.count}`} />
                <span className="text-[11px] text-muted">{new Date(s.date).toLocaleDateString('ru-RU', days === '7' ? { weekday: 'short' } : { day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Активные сессии">
          {d.active.length === 0 ? <p className="text-[14px] text-muted">Сейчас нет эфиров и открытых групповых тестов.</p> : (
            <ul className="flex flex-col gap-3">
              {d.active.map((a) => (
                <li key={a.id} className="rounded-[16px] bg-canvas p-3.5">
                  {a.kind === 'live' ? (
                    <>
                      <div className="flex items-center gap-2"><Pill tone="live">LIVE</Pill><span className="text-[12px] font-semibold text-muted">{a.state === 'lobby' ? 'Лобби' : `Вопрос ${a.index + 1} из ${a.total}`}</span></div>
                      <div className="mt-1 font-bold">{a.title}</div>
                      <div className="flex items-center justify-between text-[13px] text-muted">{a.participants} участников<Link to={`/live/${a.id}`} className="font-bold text-primary">Открыть пульт →</Link></div>
                    </>
                  ) : (
                    <>
                      <span className="text-[12px] font-semibold text-muted">Группа · асинхронно</span>
                      <div className="flex items-center justify-between"><span className="font-bold">{a.title}</span><span className="font-bold tabular-nums">{a.passed} / {a.members}</span></div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Последние результаты" action={<Link to="/results" className="text-[13px] font-bold text-primary">Все результаты · экспорт XLSX</Link>}>
          <Table head={['Пользователь', 'Тест', 'Режим', 'Баллы', 'Точность', 'Когда']} empty={!d.lastResults.length && <p className="py-6 text-center text-[14px] text-muted">Пока нет пройденных тестов.</p>}>
            {d.lastResults.map((r) => (
              <tr key={r.id}><td className="font-semibold">{r.userName}</td><td>{r.quizTitle}</td><td>{modeLabel[r.mode]}</td><td className="font-bold tabular-nums">{fmtNum(r.points)}</td><td>{r.accuracy != null ? `${r.accuracy}%` : '—'}</td><td className="text-muted">{r.finishedAt ? ago(r.finishedAt) : '—'}</td></tr>
            ))}
          </Table>
        </Card>
        <Card title="Самые сложные вопросы">
          <p className="-mt-3 mb-4 text-[13px] text-muted">Меньше всего правильных ответов. Возможно, стоит проверить формулировку.</p>
          {d.hardest.length === 0 ? <p className="text-[14px] text-muted">Нужно хотя бы 5 ответов на вопрос.</p> : (
            <ul className="flex flex-col gap-3">
              {d.hardest.map((h) => (
                <li key={h.id}><Link to={`/questions/${h.id}`} className="flex items-center gap-3 text-ink"><span className="w-12 shrink-0 rounded-[10px] bg-error-50 py-1.5 text-center text-[13px] font-extrabold text-error-ink">{h.rate}%</span><span className="min-w-0"><span className="block truncate text-[14px] font-semibold">{h.text}</span><span className="text-[12px] text-muted">{h.topic}</span></span></Link></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

interface Sales {
  totalCount: number; totalRevenue: number; monthCount: number; monthRevenue: number; activeSubscribers: number; pending: number;
  manualGrants: number; months: { month: string; count: number; revenue: number }[];
  recent: { name: string; username: string | null; amount: number; at: string | null }[];
}
const sumFmt = (n: number) => `${n.toLocaleString('ru-RU')} сум`;
const monthName = (ym: string) => new Date(`${ym}-01T12:00:00`).toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');

/** Money from confirmed card payments — admins only. */
function SalesCard() {
  const { state } = useLoad(() => get<Sales>('/api/admin/sales'));
  if (state.status !== 'ok') return null;
  const s = state.data;
  const max = Math.max(1, ...s.months.map((m) => m.revenue));
  const tiles: [string, string, string][] = [
    ['Выручка за месяц', sumFmt(s.monthRevenue), `${s.monthCount} оплат`],
    ['Выручка всего', sumFmt(s.totalRevenue), `${s.totalCount} подтверждённых оплат`],
    ['Активные подписчики', fmtNum(s.activeSubscribers), s.manualGrants ? `ещё ${s.manualGrants} выдано вручную` : 'с действующей подпиской'],
    ['Чеки на проверке', fmtNum(s.pending), s.pending ? 'ждут подтверждения' : 'всё проверено'],
  ];
  return (
    <Card title="Продажи подписки" action={<Link to="/access" className="text-[13px] font-bold text-primary">Доступ и оплата →</Link>}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {tiles.map(([l, v, sub], i) => (
          <div key={l} className={clsx('rounded-[18px] p-4', i === 3 && s.pending ? 'bg-warning-50' : 'bg-canvas')}>
            <div className="text-[13px] font-semibold text-muted">{l}</div>
            <div className="mt-1 font-display text-[24px] font-extrabold tabular-nums">{v}</div>
            <div className="text-[12px] text-muted">{sub}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-2 text-[13px] font-bold text-ink-2">Выручка по месяцам</div>
          <div className="flex h-[140px] items-end gap-3">
            {s.months.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5" title={`${sumFmt(m.revenue)} · ${m.count} оплат`}>
                <span className="text-[11px] font-bold tabular-nums text-muted">{m.revenue ? `${Math.round(m.revenue / 1000)}k` : ''}</span>
                <span className="w-full max-w-[44px] rounded-t-[8px] bg-primary" style={{ height: `${Math.max(3, (m.revenue / max) * 96)}px`, opacity: m.revenue ? 1 : 0.15 }} />
                <span className="text-[12px] font-semibold text-muted">{monthName(m.month)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[13px] font-bold text-ink-2">Последние оплаты</div>
          {s.recent.length === 0 ? <p className="text-[13px] text-muted">Подтверждённых оплат пока нет.</p> : (
            <ul className="flex flex-col divide-y divide-line">
              {s.recent.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-[14px]">
                  <span className="min-w-0"><span className="block truncate font-semibold">{r.name}</span><span className="text-[12px] text-muted">{r.username ? `@${r.username} · ` : ''}{r.at ? ago(r.at) : ''}</span></span>
                  <span className="shrink-0 font-bold tabular-nums">{sumFmt(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-4 text-[12px] text-muted">Считаются только подтверждённые чеки. Это выручка, а не чистая прибыль: расходы (сервер, налоги, комиссии) здесь не учтены.</p>
    </Card>
  );
}

