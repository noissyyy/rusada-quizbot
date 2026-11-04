import { useState } from 'react';
import { can, get, put, roleName, type AdminUser, type Role } from '../lib/api';
import { ago, useLoad, useMe, useToast } from '../lib/hooks';
import type { Page } from '../lib/types';
import { Card, ErrorBox, Icon, Initials, Input, PageHeader, Pager, Select, Spinner, Table } from '../components/ui';

const ROLES: Role[] = ['student', 'host', 'admin', 'superadmin'];
const roleHelp: [Role, string][] = [
  ['student', 'Проходит тесты, эфиры и групповые тесты.'],
  ['host', 'Запускает эфиры и групповые тесты, видит их результаты.'],
  ['admin', 'Разделы, вопросы, тесты, импорт, все результаты.'],
  ['superadmin', 'Всё выше + роли и настройки системы.'],
];

export function UsersPage() {
  const me = useMe();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), size: '50', ...(q && { q }), ...(role && { role }) });
  const { state, reload } = useLoad(() => get<Page<AdminUser>>(`/api/admin/users?${qs}`), [qs.toString()]);
  const sup = can(me, 'superadmin');

  const setUserRole = async (u: AdminUser, r: Role) => {
    if (!confirm(`Изменить роль «${u.name}»: ${roleName[u.role]} → ${roleName[r]}?`)) return;
    try { await put(`/api/admin/users/${u.id}/role`, { role: r }); toast('Роль изменена и записана в журнал'); reload(); } catch (e) { toast((e as Error).message, 'error'); }
  };
  const block = async (u: AdminUser) => {
    try { await put(`/api/admin/users/${u.id}/block`, { blocked: !u.isBlocked }); toast(u.isBlocked ? 'Разблокирован' : 'Заблокирован'); reload(); } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <>
      <PageHeader title="Пользователи" sub={`${state.status === 'ok' ? state.data.total.toLocaleString('ru-RU') : '…'} · входят через Telegram, пароли не хранятся`} />
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-4 flex flex-wrap gap-2.5">
            <div className="relative min-w-[220px] flex-1"><Icon name="search" size={18} className="absolute left-3 top-3 text-muted" /><Input aria-label="Поиск" placeholder="Имя или @username" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="w-full pl-9" /></div>
            <Select aria-label="Роль" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">Все роли</option>{ROLES.map((r) => <option key={r} value={r}>{roleName[r]}</option>)}</Select>
          </div>
          {state.status === 'loading' && <Spinner />}
          {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
          {state.status === 'ok' && (
            <>
              <Table head={['Пользователь', 'Роль', 'Тестов', 'Точность', 'Был', '']}>
                {state.data.items.map((u) => (
                  <tr key={u.id} className={u.isBlocked ? 'opacity-50' : ''}>
                    <td><div className="flex items-center gap-2.5">{u.photoUrl ? <img src={u.photoUrl} alt="" className="size-9 rounded-full" /> : <Initials name={u.name} />}<div><div className="font-bold">{u.name}</div><div className="text-[12px] text-muted">{u.username ? `@${u.username}` : `id ${u.telegramId}`}</div></div></div></td>
                    <td>{sup && u.id !== me?.id
                      ? <Select aria-label={`Роль: ${u.name}`} value={u.role} onChange={(e) => setUserRole(u, e.target.value as Role)} className="!h-9">{ROLES.map((r) => <option key={r} value={r}>{roleName[r]}</option>)}</Select>
                      : <span className="font-semibold">{roleName[u.role]}</span>}</td>
                    <td className="tabular-nums">{u.role === 'student' ? u.tests : '—'}</td>
                    <td>{u.accuracy != null ? `${u.accuracy}%` : '—'}</td>
                    <td className="text-muted">{ago(u.lastSeenAt)}</td>
                    <td>{u.id !== me?.id && <button type="button" onClick={() => block(u)} className="text-[13px] font-bold text-error-ink">{u.isBlocked ? 'Разблокировать' : 'Заблокировать'}</button>}</td>
                  </tr>
                ))}
              </Table>
              <Pager page={page} size={50} total={state.data.total} onPage={setPage} />
            </>
          )}
        </Card>
        <Card title="Что может каждая роль">
          <dl className="flex flex-col gap-3 text-[14px]">{roleHelp.map(([r, h]) => <div key={r}><dt className="font-bold">{roleName[r]}</dt><dd className="text-muted">{h}</dd></div>)}</dl>
          <p className="mt-4 rounded-[12px] bg-canvas p-3 text-[12px] text-muted">Каждая смена роли записывается в журнал действий. Менять роли может только супер-администратор.</p>
        </Card>
      </div>
    </>
  );
}
