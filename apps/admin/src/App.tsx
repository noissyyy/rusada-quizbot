import { clsx } from 'clsx';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { can, get, getToken, post, roleName, setToken, setUnauthorizedHandler, type AdminUser, type Role } from './lib/api';
import { MeContext, ToastContext, useMe } from './lib/hooks';
import { Button, Icon, Initials, Spinner, type IconName } from './components/ui';
import { DashboardPage } from './pages/Dashboard';
import { QuestionsPage } from './pages/Questions';
import { QuestionFormPage } from './pages/QuestionForm';
import { TestsPage } from './pages/Tests';
import { QuizBuilderPage } from './pages/QuizBuilder';
import { TopicsPage } from './pages/Topics';
import { TopicDetailPage } from './pages/TopicDetail';
import { BooksPage } from './pages/Books';
import { AccessPage } from './pages/Access';
import { LivePage, LiveControlPage } from './pages/Live';
import { GroupsPage } from './pages/Groups';
import { UsersPage } from './pages/Users';
import { ResultsPage } from './pages/Results';
import { ImportPage } from './pages/Import';
import { SettingsPage } from './pages/Settings';

const NAV: { to: string; label: string; icon: IconName; role: Role }[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', role: 'host' },
  { to: '/questions', label: 'Банк вопросов', icon: 'bank', role: 'host' },
  { to: '/tests', label: 'Тесты', icon: 'tests', role: 'host' },
  { to: '/topics', label: 'Разделы', icon: 'topics', role: 'admin' },
  { to: '/books', label: 'Библиотека', icon: 'books', role: 'admin' },
  { to: '/live', label: 'Прямые эфиры', icon: 'live', role: 'host' },
  { to: '/groups', label: 'Группы', icon: 'groups', role: 'host' },
  { to: '/users', label: 'Пользователи', icon: 'users', role: 'admin' },
  { to: '/access', label: 'Доступ и оплата', icon: 'lock', role: 'admin' },
  { to: '/results', label: 'Результаты', icon: 'results', role: 'host' },
  { to: '/import', label: 'Импорт Excel', icon: 'import', role: 'admin' },
  { to: '/settings', label: 'Настройки', icon: 'settings', role: 'admin' },
];

function Sidebar({ liveCount, onLogout }: { liveCount: number; onLogout: () => void }) {
  const me = useMe()!;
  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 border-b border-line bg-surface px-4 py-6 lg:sticky lg:top-0 lg:h-screen lg:w-[240px] lg:border-b-0 lg:border-r">
      <div className="flex flex-col gap-0.5 px-2">
        <img src="/rusada-uc-wordmark-red.svg" alt="Rusada — учебный центр" className="h-[46px] w-[150px] object-contain object-left" />
        <span className="text-[12px] font-semibold text-muted">QuizBot · Админ-панель</span>
      </div>
      <nav aria-label="Разделы админки" className="flex flex-wrap gap-0.5 lg:flex-col">
        {NAV.filter((n) => can(me, n.role)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) => clsx('flex h-[42px] items-center gap-3 rounded-[12px] px-3 text-[14px]', isActive ? 'bg-primary-50 font-bold text-primary' : 'font-semibold text-ink-2 hover:bg-canvas')}>
            <Icon name={n.icon} />{n.label}
            {n.to === '/live' && liveCount > 0 && <span className="ml-auto inline-flex h-5 items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{liveCount}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 rounded-[14px] bg-canvas p-3">
        <Initials name={me.name} className="!bg-[#FFD84D] !text-ink" />
        <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold">{me.name}</div><div className="text-[12px] text-muted">{roleName[me.role]}</div></div>
        <button type="button" aria-label="Выйти" onClick={onLogout} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"><Icon name="logout" size={18} /></button>
      </div>
    </aside>
  );
}

function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const me = useMe();
  return can(me, role) ? <>{children}</> : <p className="rounded-[16px] bg-warning-50 p-4 font-semibold text-warning-ink">Недостаточно прав для этого раздела.</p>;
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const [liveCount, setLiveCount] = useState(0);
  useEffect(() => {
    const tick = () => get<{ state: string }[]>('/api/admin/live').then((l) => setLiveCount(l.filter((x) => x.state !== 'finished').length), () => undefined);
    tick();
    const h = setInterval(tick, 15000);
    return () => clearInterval(h);
  }, []);
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar liveCount={liveCount} onLogout={onLogout} />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:pb-10">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/questions" element={<QuestionsPage />} />
          <Route path="/questions/new" element={<Guard role="admin"><QuestionFormPage /></Guard>} />
          <Route path="/questions/:id" element={<Guard role="admin"><QuestionFormPage /></Guard>} />
          <Route path="/tests" element={<TestsPage />} />
          <Route path="/tests/new" element={<Guard role="admin"><QuizBuilderPage /></Guard>} />
          <Route path="/tests/:id" element={<QuizBuilderPage />} />
          <Route path="/topics" element={<Guard role="admin"><TopicsPage /></Guard>} />
          <Route path="/topics/:id" element={<Guard role="admin"><TopicDetailPage /></Guard>} />
          <Route path="/books" element={<Guard role="admin"><BooksPage /></Guard>} />
          <Route path="/access" element={<Guard role="admin"><AccessPage /></Guard>} />
          <Route path="/live" element={<LivePage />} />
          <Route path="/live/:id" element={<LiveControlPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/users" element={<Guard role="admin"><UsersPage /></Guard>} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/import" element={<Guard role="admin"><ImportPage /></Guard>} />
          <Route path="/settings" element={<Guard role="admin"><SettingsPage /></Guard>} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

/** No passwords: the bot sends a one-time link (/admin) → /login?t=… */
function Login({ onLogin }: { onLogin: (u: AdminUser) => void }) {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get('t');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(Boolean(token));
  const bot = (import.meta.env.VITE_BOT_USERNAME as string | undefined) ?? 'Rusada_QuizBot';
  const devLogin = import.meta.env.VITE_DEV_LOGIN === '1';

  useEffect(() => {
    if (!token) return;
    post<{ token: string; user: AdminUser }>('/api/admin/auth/exchange', { token })
      .then((s) => { setToken(s.token); onLogin(s.user); nav('/', { replace: true }); })
      .catch((e: Error) => { setError(e.message); setBusy(false); });
  }, [token, nav, onLogin]);

  const dev = async () => {
    const s = await post<{ token: string; user: AdminUser }>('/api/admin/auth/dev', { telegramId: 1 });
    setToken(s.token); onLogin(s.user); nav('/', { replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-[28px] bg-surface p-8 text-center shadow-xl">
        <img src="/rusada-uc-wordmark-red.svg" alt="Rusada — учебный центр" className="h-14" />
        <h1 className="font-display text-[24px] font-extrabold">Вход в админ-панель</h1>
        {busy ? <Spinner label="Проверяем ссылку" /> : (
          <>
            {error && <p role="alert" className="w-full rounded-[14px] bg-error-50 p-3 text-[14px] font-semibold text-error-ink">{error}</p>}
            <ol className="w-full list-inside list-decimal space-y-1.5 rounded-[16px] bg-canvas p-4 text-left text-[14px] text-ink-2">
              <li>Откройте бота <b>@{bot}</b> в Telegram.</li>
              <li>Отправьте команду <b>/admin</b>.</li>
              <li>Нажмите «Войти в админ-панель» — ссылка действует 5 минут и работает один раз.</li>
            </ol>
            <p className="text-[12px] text-muted">Пароли не нужны: вход только через Telegram. Доступ есть у ведущих и администраторов.</p>
            <a href={`https://t.me/${bot}`} className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-primary font-bold text-white">Открыть бота</a>
            {devLogin && <Button tone="ghost" className="w-full" onClick={dev}>Войти как разработчик (локально)</Button>}
          </>
        )}
      </div>
    </div>
  );
}

export function App() {
  const [me, setMe] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'error' } | null>(null);

  const logout = useCallback(() => { setToken(null); setMe(null); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);
  useEffect(() => {
    if (!getToken()) return;
    get<AdminUser>('/api/admin/me').then(setMe, () => setToken(null)).finally(() => setChecking(false));
  }, []);
  const showToast = useCallback((msg: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2800);
  }, []);

  if (checking) return <Spinner />;
  return (
    <BrowserRouter>
      <ToastContext.Provider value={showToast}>
        <MeContext.Provider value={me}>
          {me ? <Shell onLogout={logout} /> : <Routes><Route path="*" element={<Login onLogin={setMe} />} /></Routes>}
          {toast && <div role="status" className={clsx('fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full px-5 py-3 text-[14px] font-bold text-white shadow-xl', toast.tone === 'ok' ? 'bg-ink' : 'bg-error')}>{toast.msg}</div>}
        </MeContext.Provider>
      </ToastContext.Provider>
    </BrowserRouter>
  );
}
