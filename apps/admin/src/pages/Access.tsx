import { clsx } from 'clsx';
import { useEffect, useState } from 'react';
import { blobUrl, del, get, post, put } from '../lib/api';
import { fmtDate, useLoad, useToast } from '../lib/hooks';
import { Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pill, Segmented, Spinner, Table, Textarea } from '../components/ui';

interface AccessSettings { mode: 'open' | 'closed'; priceUzs: number; days: number; cardNumber: string; cardHolder: string; note: string; supportUsername: string }
interface Stats { pending: number; activeSubscribers: number; members: number }
interface Payment { id: string; userId: string; name: string; username: string | null; status: 'pending' | 'approved' | 'rejected'; amount: number; days: number; comment: string; createdAt: string; decidedAt: string | null; subscriptionEndsAt: string | null }
interface MemberRow { id: string; username: string; note: string; seen: boolean; name: string | null; addedAt: string }
interface Subscriber { userId: string; name: string; username: string | null; endsAt: string; active: boolean }

const sum = (n: number) => `${n.toLocaleString('ru-RU')} сум`;

/** Who may use the app: open/closed, Rusada students, card payments and subscriptions. */
export function AccessPage() {
  const stats = useLoad(() => get<Stats>('/api/admin/access/stats'));
  const [tab, setTab] = useState<'payments' | 'members' | 'subs'>('payments');
  const s = stats.state.status === 'ok' ? stats.state.data : null;
  return (
    <>
      <PageHeader title="Доступ и оплата" sub="Кто может пользоваться ботом: все, или только ученики Rusada и подписчики." />
      <div className="grid gap-3 sm:grid-cols-3">
        {[['Чеки на проверке', s?.pending, 'payments', s && s.pending > 0], ['Активные подписчики', s?.activeSubscribers, 'subs', false], ['Ученики Rusada в списке', s?.members, 'members', false]].map(([label, n, to, hot]) => (
          <button key={String(to)} type="button" onClick={() => setTab(to as typeof tab)} className={clsx('rounded-[20px] p-4 text-left shadow-card', hot ? 'bg-warning-50' : 'bg-surface')}>
            <div className="font-display text-[30px] font-extrabold tabular-nums">{n ?? '—'}</div>
            <div className="text-[13px] font-semibold text-muted">{label as string}</div>
          </button>
        ))}
      </div>
      <SettingsCard />
      <Card>
        <div className="mb-4"><Segmented label="Раздел" value={tab} onChange={setTab} options={[['payments', `Чеки${s?.pending ? ` · ${s.pending}` : ''}`], ['members', 'Ученики Rusada'], ['subs', 'Подписчики']]} /></div>
        {tab === 'payments' && <Payments onChange={stats.reload} />}
        {tab === 'members' && <Members onChange={stats.reload} />}
        {tab === 'subs' && <Subscribers onChange={stats.reload} />}
      </Card>
    </>
  );
}

function SettingsCard() {
  const toast = useToast();
  const { state, reload } = useLoad(() => get<AccessSettings>('/api/admin/access'));
  const [s, setS] = useState<AccessSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (state.status === 'ok') setS(state.data); }, [state]);
  if (state.status === 'error') return <ErrorBox error={state.error} onRetry={reload} />;
  if (!s) return <Spinner />;
  const save = async (next: AccessSettings, msg: string) => {
    setErr(null);
    try { setS(await put<AccessSettings>('/api/admin/access', next)); toast(msg); } catch (e) { setErr((e as Error).message); }
  };
  const setMode = (mode: AccessSettings['mode']) => {
    if (mode === s.mode) return;
    const q = mode === 'closed'
      ? 'Закрыть бот? Пользоваться смогут только ученики из списка, сотрудники и подписчики. Остальные увидят страницу подписки.'
      : 'Открыть бот для всех? Любой человек сможет проходить тесты бесплатно.';
    if (confirm(q)) void save({ ...s, mode }, mode === 'closed' ? 'Бот закрыт: только ученики и подписчики' : 'Бот открыт для всех');
  };
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,420px)_1fr]">
      <Card title="Режим">
        <div className="grid grid-cols-1 gap-2">
          {([['open', 'Открыт для всех', 'Бесплатно для любого человека'], ['closed', 'Только ученики и подписчики', 'Остальные видят страницу оплаты']] as const).map(([m, t, sub]) => (
            <button key={m} type="button" aria-pressed={s.mode === m} onClick={() => setMode(m)}
              className={clsx('rounded-[16px] border-2 p-3 text-left', s.mode === m ? 'border-primary bg-primary-50' : 'border-line')}>
              <div className="font-bold">{t}</div><div className="mt-0.5 text-[12px] text-muted">{sub}</div>
            </button>
          ))}
        </div>
      </Card>
      <Card title="Оплата картой">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_1fr_1.6fr_1.6fr]">
            <Field label="Цена, сум"><Input type="number" min={0} step={1000} value={s.priceUzs} onChange={(e) => setS({ ...s, priceUzs: Number(e.target.value) })} /></Field>
            <Field label="Дней доступа"><Input type="number" min={1} max={366} value={s.days} onChange={(e) => setS({ ...s, days: Number(e.target.value) })} /></Field>
            <Field label="Номер карты" className="col-span-2 lg:col-span-1"><Input value={s.cardNumber} placeholder="8600 0000 0000 0000" onChange={(e) => setS({ ...s, cardNumber: e.target.value })} /></Field>
            <Field label="Владелец карты" className="col-span-2 lg:col-span-1"><Input value={s.cardHolder} placeholder="Как на карте" onChange={(e) => setS({ ...s, cardHolder: e.target.value })} /></Field>
          </div>
          <Field label="Подсказка ученику" hint="необязательно"><Textarea value={s.note} placeholder="Например: в комментарии к переводу укажите ваш @username" onChange={(e) => setS({ ...s, note: e.target.value })} /></Field>
          <Field label="Кому писать ученикам Rusada" hint="@username администратора"><Input value={s.supportUsername} placeholder="@rusada_admin" onChange={(e) => setS({ ...s, supportUsername: e.target.value })} /></Field>
          {err && <p role="alert" className="text-[13px] font-semibold text-error-ink">{err}</p>}
          <Button onClick={() => save(s, 'Сохранено')}>Сохранить</Button>
        </div>
      </Card>
    </div>
  );
}

function Payments({ onChange }: { onChange: () => void }) {
  const toast = useToast();
  const [filter, setFilter] = useState<'pending' | ''>('pending');
  const { state, reload } = useLoad(() => get<Payment[]>(`/api/admin/payments${filter ? `?status=${filter}` : ''}`), [filter]);
  const [view, setView] = useState<{ p: Payment; url: string } | null>(null);
  const open = async (p: Payment) => setView({ p, url: await blobUrl(`/api/admin/payments/${p.id}/receipt`) });
  const close = () => { if (view) URL.revokeObjectURL(view.url); setView(null); };
  const decide = async (p: Payment, ok: boolean) => {
    let comment = '';
    if (!ok) { const c = prompt('Почему чек не подходит? Ученик увидит этот текст.', 'Сумма или карта не совпадают'); if (c === null) return; comment = c; }
    try {
      await post(`/api/admin/payments/${p.id}/${ok ? 'approve' : 'reject'}`, ok ? {} : { comment });
      toast(ok ? `Доступ для ${p.name} открыт на ${p.days} дн.` : 'Чек отклонён — ученик получил сообщение');
      close(); reload(); onChange();
    } catch (e) { toast((e as Error).message, 'error'); }
  };
  return (
    <>
      <div className="mb-3"><Segmented label="Чеки" value={filter} onChange={setFilter} options={[['pending', 'На проверке'], ['', 'Все']]} /></div>
      {state.status === 'loading' && <Spinner />}
      {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
      {state.status === 'ok' && (
        <Table head={['Кто', 'Сумма', 'Отправлен', 'Доступ сейчас', 'Статус', '']} empty={!state.data.length && <Empty img="E02" title={filter ? 'Новых чеков нет' : 'Чеков пока нет'}>Когда ученик отправит чек, он появится здесь, а вам придёт сообщение в боте.</Empty>}>
          {state.data.map((p) => (
            <tr key={p.id}>
              <td><div className="font-bold">{p.name}</div><div className="text-[12px] text-muted">{p.username ? `@${p.username}` : 'без @username'}</div></td>
              <td className="whitespace-nowrap">{sum(p.amount)} · {p.days} дн.</td>
              <td className="whitespace-nowrap text-muted">{fmtDate(p.createdAt)}</td>
              <td className="whitespace-nowrap text-muted">{p.subscriptionEndsAt && new Date(p.subscriptionEndsAt) > new Date() ? `до ${fmtDate(p.subscriptionEndsAt, false)}` : 'нет'}</td>
              <td>{p.status === 'pending' ? <Pill tone="archived">На проверке</Pill> : p.status === 'approved' ? <Pill tone="ok">Подтверждён</Pill> : <Pill tone="bad">Отклонён</Pill>}{p.comment && <div className="mt-1 max-w-[200px] text-[12px] text-muted">{p.comment}</div>}</td>
              <td><div className="flex justify-end gap-1.5">
                <Button tone="ghost" className="!h-9" onClick={() => open(p)}>Чек</Button>
                {p.status === 'pending' && <><Button className="!h-9" icon="check" onClick={() => decide(p, true)}>Подтвердить</Button><Button tone="danger" className="!h-9" onClick={() => decide(p, false)}>Отклонить</Button></>}
              </div></td>
            </tr>
          ))}
        </Table>
      )}
      {view && (
        <Modal title={`Чек · ${view.p.name}`} onClose={close}>
          <img src={view.url} alt="Чек" className="max-h-[70vh] w-full rounded-[12px] object-contain" />
          <p className="mt-3 text-[14px]">Ожидается: <b>{sum(view.p.amount)}</b> · {view.p.username ? `@${view.p.username}` : view.p.name}</p>
          {view.p.status === 'pending' && <div className="mt-3 flex gap-2"><Button className="flex-1" icon="check" onClick={() => decide(view.p, true)}>Подтвердить · {view.p.days} дн.</Button><Button tone="danger" onClick={() => decide(view.p, false)}>Отклонить</Button></div>}
        </Modal>
      )}
    </>
  );
}

function Members({ onChange }: { onChange: () => void }) {
  const toast = useToast();
  const { state, reload } = useLoad(() => get<MemberRow[]>('/api/admin/members'));
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const add = async () => {
    try {
      const r = await post<{ added: number; already: number; invalid: string[] }>('/api/admin/members', { usernames: text });
      toast(`Добавлено: ${r.added}${r.already ? `, уже были: ${r.already}` : ''}${r.invalid.length ? `. Не похожи на @username: ${r.invalid.join(', ')}` : ''}`, r.invalid.length ? 'error' : 'ok');
      setText(''); reload(); onChange();
    } catch (e) { toast((e as Error).message, 'error'); }
  };
  const remove = async (m: MemberRow) => {
    if (!confirm(`Убрать @${m.username} из учеников Rusada? Если бот закрыт, он увидит страницу оплаты.`)) return;
    await del(`/api/admin/members/${m.id}`); reload(); onChange();
  };
  const rows = state.status === 'ok' ? state.data.filter((m) => !q || m.username.includes(q.toLowerCase().replace('@', '')) || (m.name ?? '').toLowerCase().includes(q.toLowerCase())) : [];
  return (
    <>
      <div className="mb-4 flex flex-col gap-2 rounded-[16px] bg-canvas p-3">
        <Field label="Добавить учеников" hint="вставьте @username — по одному или списком (через пробел, запятую или с новой строки)">
          <Textarea value={text} placeholder={'@student_one\n@student_two'} onChange={(e) => setText(e.target.value)} />
        </Field>
        <div className="flex items-center gap-3"><Button icon="plus" disabled={!text.trim()} onClick={add}>Добавить</Button><span className="text-[12px] text-muted">Ученики из списка пользуются ботом бесплатно, даже когда он закрыт. Если ученик сменит @username, доступ сохранится — бот запоминает его после первого входа.</span></div>
      </div>
      <Input placeholder="Поиск по @username или имени" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 max-w-[320px]" />
      {state.status === 'loading' && <Spinner />}
      {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
      {state.status === 'ok' && (
        <Table head={['@username', 'Имя в Telegram', 'Заходил', 'Добавлен', '']} empty={!rows.length && <Empty img="M03" title="Список пуст">Добавьте @username учеников Rusada.</Empty>}>
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="font-bold">@{m.username}</td>
              <td>{m.name ?? <span className="text-muted">—</span>}</td>
              <td>{m.seen ? <Pill tone="ok">Да</Pill> : <Pill tone="neutral">Ещё нет</Pill>}</td>
              <td className="whitespace-nowrap text-muted">{fmtDate(m.addedAt, false)}</td>
              <td className="text-right"><button type="button" onClick={() => remove(m)} className="text-[13px] font-bold text-error-ink">Убрать</button></td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

function Subscribers({ onChange }: { onChange: () => void }) {
  const toast = useToast();
  const { state, reload } = useLoad(() => get<Subscriber[]>('/api/admin/subscriptions'));
  const [username, setUsername] = useState('');
  const [days, setDays] = useState(30);
  const grant = async () => {
    try {
      const r = await post<Subscriber>('/api/admin/subscriptions', { username, days });
      toast(`Доступ для ${r.name} до ${fmtDate(r.endsAt, false)}`); setUsername(''); reload(); onChange();
    } catch (e) { toast((e as Error).message, 'error'); }
  };
  const revoke = async (s: Subscriber) => {
    if (!confirm(`Закрыть доступ для ${s.name} прямо сейчас?`)) return;
    await del(`/api/admin/subscriptions/${s.userId}`); toast('Доступ закрыт'); reload(); onChange();
  };
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-[16px] bg-canvas p-3">
        <Field label="Выдать или продлить доступ вручную" hint="например, оплатили наличными"><Input value={username} placeholder="@username" onChange={(e) => setUsername(e.target.value)} /></Field>
        <Field label="Дней"><Input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-24" /></Field>
        <Button icon="plus" disabled={!username.trim()} onClick={grant}>Выдать</Button>
      </div>
      {state.status === 'loading' && <Spinner />}
      {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
      {state.status === 'ok' && (
        <Table head={['Кто', 'Доступ до', 'Статус', '']} empty={!state.data.length && <Empty img="R01" title="Подписчиков пока нет">После подтверждения чека человек появится здесь.</Empty>}>
          {state.data.map((s) => (
            <tr key={s.userId}>
              <td><div className="font-bold">{s.name}</div><div className="text-[12px] text-muted">{s.username ? `@${s.username}` : ''}</div></td>
              <td className="whitespace-nowrap">{fmtDate(s.endsAt, false)}</td>
              <td>{s.active ? <Pill tone="ok">Активна</Pill> : <Pill tone="neutral">Закончилась</Pill>}</td>
              <td className="text-right">{s.active && <button type="button" onClick={() => revoke(s)} className="text-[13px] font-bold text-error-ink">Закрыть доступ</button>}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
