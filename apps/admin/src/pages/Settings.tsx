import { useEffect, useState } from 'react';
import { can, get, put } from '../lib/api';
import { fmtDate, useLoad, useMe, useToast } from '../lib/hooks';
import type { AppSettings } from '../lib/types';
import { Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Pill, Select, Spinner, Table, Toggle } from '../components/ui';

interface Audit { id: number; actor: string | null; action: string; target: string | null; details: Record<string, unknown> | null; at: string }
const actionName: Record<string, string> = {
  login: 'Вход', 'settings.update': 'Настройки', 'user.role': 'Смена роли', 'user.block': 'Блокировка', 'user.unblock': 'Разблокировка',
  'question.create': 'Новый вопрос', 'question.update': 'Изменён вопрос', 'test.create': 'Новый тест', 'test.update': 'Изменён тест',
  'test.published': 'Тест опубликован', 'test.archived': 'Тест в архиве', 'import': 'Импорт Excel', 'group.assign': 'Тест в группу',
  'live.create': 'Создан эфир', 'live.finish': 'Эфир завершён', 'topic.create': 'Новый раздел', 'topic.update': 'Изменён раздел',
};

export function SettingsPage() {
  const me = useMe();
  const toast = useToast();
  const sup = can(me, 'superadmin');
  const { state, reload } = useLoad(() => get<AppSettings>('/api/admin/settings'));
  const [s, setS] = useState<AppSettings | null>(null);
  const [audit, setAudit] = useState<Audit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (state.status === 'ok') setS(state.data); }, [state]);

  if (state.status === 'error') return <ErrorBox error={state.error} onRetry={reload} />;
  if (!s || state.status !== 'ok') return <Spinner />;
  const set = (p: Partial<AppSettings>) => setS({ ...s, ...p });
  const toggleLang = (l: 'uz' | 'uz-cyrl' | 'ru', on: boolean) => set({ langs: on ? [...new Set([...s.langs, l])] : s.langs.filter((x) => x !== l) });
  const save = async () => {
    setErr(null);
    try { const { botUsername: _b, miniappUrl: _m, botTokenSet: _t, signatureCheck: _c, ...body } = s; await put('/api/admin/settings', body); toast('Настройки сохранены'); reload(); } catch (e) { setErr((e as Error).message); }
  };
  const openAudit = async () => setAudit(await get<Audit[]>('/api/admin/audit'));

  return (
    <>
      <PageHeader title="Настройки" sub={sup ? undefined : 'Изменять настройки может только супер-администратор.'} />
      <fieldset disabled={!sup} className="grid items-start gap-5 xl:grid-cols-2">
        <Card title="Тесты по умолчанию">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Время на один вопрос" hint="мин · время теста = вопросы × это число"><Input type="number" min={1} max={30} value={s.minutesPerQuestion} onChange={(e) => set({ minutesPerQuestion: Number(e.target.value) })} /></Field>
            <Field label="Время на вопрос в эфире" hint="сек"><Input type="number" min={5} value={s.liveQuestionSec} onChange={(e) => set({ liveQuestionSec: Number(e.target.value) })} /></Field>
            <Field label="Показ ответа без объяснения" hint="сек"><Input type="number" min={1} max={10} value={s.feedbackMs / 1000} onChange={(e) => set({ feedbackMs: Number(e.target.value) * 1000 })} /></Field>
            <Field label="Показ ответа с объяснением" hint="сек"><Input type="number" min={1} max={15} value={s.feedbackExplainMs / 1000} onChange={(e) => set({ feedbackExplainMs: Number(e.target.value) * 1000 })} /></Field>
          </div>
          <p className="mt-4 rounded-[12px] bg-canvas p-3 text-[13px] text-muted">Таймер теста стоит на паузе, пока показан ответ.</p>
        </Card>
        <Card title="Языки интерфейса">
          <div className="flex flex-col gap-3">
            <Toggle label="O‘zbekcha (lotin)" checked={s.langs.includes('uz')} onChange={(v) => toggleLang('uz', v)} />
            <Toggle label="Ўзбекча (кирилл) — автоматически из латиницы" checked={s.langs.includes('uz-cyrl')} onChange={(v) => toggleLang('uz-cyrl', v)} />
            <Toggle label="Русский" checked={s.langs.includes('ru')} onChange={(v) => toggleLang('ru', v)} />
            <Field label="Язык по умолчанию"><Select value={s.defaultLang} onChange={(e) => set({ defaultLang: e.target.value as AppSettings['defaultLang'] })}><option value="telegram">По языку Telegram</option><option value="uz">O‘zbekcha</option><option value="uz-cyrl">Ўзбекча</option><option value="ru">Русский</option></Select></Field>
          </div>
        </Card>
        <Card title="Telegram">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-[14px]">
            <dt className="text-muted">Бот</dt><dd className="font-bold">@{s.botUsername}</dd>
            <dt className="text-muted">Токен бота</dt><dd>{s.botTokenSet ? <Pill tone="ok">задан</Pill> : <Pill tone="bad">не задан</Pill>} <span className="text-[12px] text-muted">хранится на сервере, здесь не показывается</span></dd>
            <dt className="text-muted">Адрес Mini App</dt><dd className="break-all font-mono text-[13px]">{s.miniappUrl}</dd>
            <dt className="text-muted">Проверка подписи Telegram</dt><dd>{s.signatureCheck ? <Pill tone="ok">Включена</Pill> : <Pill tone="bad">Выключена (режим разработки)</Pill>}</dd>
          </dl>
        </Card>
        <Card title="Безопасность и резервные копии">
          <Field label="Ограничение запросов" hint="в минуту на одного пользователя"><Input type="number" min={10} value={s.rateLimitPerMin} onChange={(e) => set({ rateLimitPerMin: Number(e.target.value) })} /></Field>
          <p className="mt-4 rounded-[12px] bg-canvas p-3 text-[13px] text-muted">Резервная копия базы делается на сервере каждый день в 03:00 и хранится 14 дней (контейнер <span className="font-mono">backup</span>).</p>
          <button type="button" onClick={openAudit} className="mt-3 text-[14px] font-bold text-primary disabled:opacity-50" disabled={!sup}>Журнал действий администраторов →</button>
        </Card>
      </fieldset>
      {err && <p role="alert" className="rounded-[14px] bg-error-50 p-3 text-[14px] font-semibold text-error-ink">{err}</p>}
      {sup && <div className="flex justify-end gap-2"><Button tone="ghost" onClick={() => setS(state.data)}>Отменить изменения</Button><Button onClick={save}>Сохранить</Button></div>}
      {audit && (
        <Modal wide title="Журнал действий" onClose={() => setAudit(null)}>
          <Table head={['Когда', 'Кто', 'Действие', 'Подробности']}>
            {audit.map((a) => <tr key={a.id}><td className="whitespace-nowrap text-muted">{fmtDate(a.at)}</td><td className="font-semibold">{a.actor ?? '—'}</td><td>{actionName[a.action] ?? a.action}</td><td className="max-w-[320px] truncate font-mono text-[12px] text-muted">{a.details ? JSON.stringify(a.details) : a.target ?? ''}</td></tr>)}
          </Table>
        </Modal>
      )}
    </>
  );
}
