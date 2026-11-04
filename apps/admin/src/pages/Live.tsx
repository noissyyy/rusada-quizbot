import { clsx } from 'clsx';
import type { LiveState } from '@rq/shared-types';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { get, getToken, post, wsUrl } from '../lib/api';
import { fmtDate, useLoad, useToast } from '../lib/hooks';
import type { QuizRow } from '../lib/types';
import { Button, Card, Empty, ErrorBox, Field, Icon, PageHeader, Pill, Select, Spinner, Table, Toggle } from '../components/ui';

interface LiveRow { id: string; code: string; title: string; state: string; createdAt: string; hostName: string | null }
const BOT = (import.meta.env.VITE_BOT_USERNAME as string | undefined) ?? 'Rusada_QuizBot';
const stateName: Record<string, string> = { lobby: 'Лобби', question: 'Идёт вопрос', reveal: 'Показ ответа', finished: 'Завершён' };

export function LivePage() {
  const nav = useNavigate();
  const toast = useToast();
  const tests = useLoad(() => get<QuizRow[]>('/api/admin/tests?status=published'));
  const groups = useLoad(() => get<{ id: string; title: string }[]>('/api/admin/groups'));
  const { state, reload } = useLoad(() => get<LiveRow[]>('/api/admin/live'));
  const [quizId, setQuizId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [announce, setAnnounce] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const liveTests = tests.state.status === 'ok' ? tests.state.data.filter((t) => t.modes.includes('live')) : [];

  const create = async () => {
    setErr(null);
    try {
      const s = await post<LiveState>('/api/admin/live', { quizId: quizId || liveTests[0]?.id, groupId: groupId || null, announce });
      toast(`Эфир создан · код ${s.code}`); nav(`/live/${s.id}`);
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <>
      <PageHeader title="Прямые эфиры" sub="Все отвечают на один вопрос одновременно. Вы управляете темпом." />
      <div className="grid items-start gap-5 xl:grid-cols-[420px_1fr]">
        <Card title="Новый эфир">
          {liveTests.length === 0 && tests.state.status === 'ok' ? (
            <p className="text-[14px] text-muted">Нет опубликованных тестов с режимом «Прямой эфир». Включите режим в настройках теста.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <Field label="Тест"><Select value={quizId} onChange={(e) => setQuizId(e.target.value)}>{liveTests.map((t) => <option key={t.id} value={t.id}>{t.title} · {t.questionsCount} вопр. · {t.liveQuestionSec} с</option>)}</Select></Field>
              <Field label="Группа Telegram (необязательно)" hint="Бот отправит в группу кнопку входа в эфир"><Select value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">— без группы —</option>{groups.state.status === 'ok' && groups.state.data.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</Select></Field>
              <Toggle label="Уведомить учеников в приложении" checked={announce} onChange={setAnnounce} />
              {err && <p role="alert" className="text-[13px] font-semibold text-error-ink">{err}</p>}
              <Button icon="live" onClick={create}>Создать эфир</Button>
            </div>
          )}
        </Card>
        <Card title="Эфиры">
          {state.status === 'loading' && <Spinner />}
          {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
          {state.status === 'ok' && (
            <Table head={['Эфир', 'Код', 'Ведущий', 'Статус', 'Создан', '']} empty={!state.data.length && <Empty img="L02" title="Эфиров ещё не было" />}>
              {state.data.map((l) => (
                <tr key={l.id}><td className="font-bold">{l.title}</td><td className="font-mono font-bold">{l.code}</td><td>{l.hostName ?? '—'}</td>
                  <td><Pill tone={l.state === 'finished' ? 'neutral' : 'live'}>{stateName[l.state]}</Pill></td><td className="text-muted">{fmtDate(l.createdAt)}</td>
                  <td><Link to={`/live/${l.id}`} className="text-[13px] font-bold text-primary">{l.state === 'finished' ? 'Итоги' : 'Пульт →'}</Link></td></tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}

/** A5 · Пульт эфира — host view with answer distribution (only the host sees it). */
export function LiveControlPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [s, setS] = useState<LiveState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [at, setAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let closed = false;
    let ws: WebSocket | null = null;
    const accept = (x: LiveState) => { if (!closed) { setS(x); setAt(Date.now()); } };
    get<LiveState>(`/api/admin/live/${id}`).then(accept, setError);
    const poll = setInterval(() => { if (ws?.readyState !== WebSocket.OPEN) get<LiveState>(`/api/admin/live/${id}`).then(accept, () => undefined); }, 2000);
    const connect = () => {
      try { ws = new WebSocket(wsUrl(`/api/admin/live/${id}/ws`)); } catch { return; }
      ws.onopen = () => ws?.send(`Bearer ${getToken()}`);
      ws.onmessage = (e) => accept(JSON.parse(e.data as string) as LiveState);
      ws.onclose = () => { if (!closed) setTimeout(connect, 2000); };
    };
    connect();
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => { closed = true; ws?.close(); clearInterval(poll); clearInterval(tick); };
  }, [id]);

  if (error) return <ErrorBox error={error} />;
  if (!s) return <Spinner />;
  const act = async (a: string) => { setBusy(true); try { setS(await post<LiveState>(`/api/admin/live/${id}/${a}`)); setAt(Date.now()); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); } };
  const left = s.paused ? s.remainingMs : Math.max(0, s.remainingMs - (now - at));
  const q = s.question;
  const dist = s.reveal?.distribution ?? {};
  const totalAns = Object.values(dist).reduce((a, b) => a + b, 0);
  const online = new Set(s.online ?? []);
  const link = `https://t.me/${BOT}?startapp=l_${s.id}`;
  const answeredIds = new Set<string>(); // per-player answered state is not exposed; counts are

  return (
    <>
      <PageHeader crumbs={<Link to="/live" className="text-primary">Прямые эфиры</Link>} title={s.title}>
        {s.state !== 'finished' && <Pill tone="live">LIVE</Pill>}
        <span className="rounded-[12px] bg-surface px-3 py-2 text-[14px] font-semibold shadow">код <b className="font-mono text-[18px] tracking-widest">{s.code}</b></span>
        <Button tone="ghost" icon="copy" onClick={() => { void navigator.clipboard?.writeText(link); toast('Ссылка скопирована'); }}>Скопировать ссылку</Button>
        {s.state !== 'finished' && <Button tone="danger" icon="stop" disabled={busy} onClick={() => confirm('Завершить эфир для всех?') && act('finish')}>Завершить эфир</Button>}
      </PageHeader>
      <div className="grid items-start gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          {s.state === 'lobby' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <img src="/3d/rq-3d-L02.webp" alt="" className="size-32 object-contain" />
              <p className="font-display text-[22px] font-bold">Лобби: {s.participantsCount} участников · {s.readyCount} готовы</p>
              <p className="text-[14px] text-muted">Ученики входят по коду <b>{s.code}</b> или по ссылке. Первый вопрос откроется всем одновременно.</p>
              <Button icon="play" disabled={busy || s.participantsCount === 0} onClick={() => act('next')}>Открыть первый вопрос</Button>
            </div>
          )}
          {q && s.state !== 'lobby' && (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-bold text-muted">Вопрос {s.index + 1} из {s.questionsCount} · {q.points} баллов</span>
                {s.state === 'question' && <span className={clsx('grid size-14 place-items-center rounded-full font-display text-[22px] font-extrabold', s.paused ? 'bg-track text-muted' : 'bg-primary-50 text-primary')}>{Math.ceil(left / 1000)}</span>}
              </div>
              <h2 className="mt-2 font-display text-[24px] font-bold leading-8">{q.text}</h2>
              <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-canvas p-3"><span className="text-[14px] font-bold">Ответили</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-track"><div className="h-full bg-primary" style={{ width: `${(100 * s.answeredCount) / Math.max(1, s.participantsCount)}%` }} /></div><span className="font-bold tabular-nums">{s.answeredCount} из {s.participantsCount}</span></div>
              <h3 className="mt-5 text-[13px] font-bold uppercase tracking-wide text-muted">Распределение ответов · видно только ведущему</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {q.options.map((o) => {
                  const n = dist[o.id] ?? 0;
                  const correct = s.reveal?.correctOptionId === o.id && s.state !== 'question';
                  const correctHost = s.state === 'question' ? undefined : correct;
                  return (
                    <li key={o.id} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 truncate text-[14px] font-semibold">{o.label} · {o.text}{correctHost ? ' ✓' : ''}</span>
                      <div className="h-7 flex-1 overflow-hidden rounded-[8px] bg-canvas"><div className={clsx('h-full', correctHost ? 'bg-success' : 'bg-primary/60')} style={{ width: `${totalAns ? (100 * n) / totalAns : 0}%` }} /></div>
                      <span className="w-8 text-right font-bold tabular-nums">{n}</span>
                    </li>
                  );
                })}
              </ul>
              {s.state !== 'finished' && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {s.state === 'question' && (s.paused ? <Button tone="soft" icon="play" disabled={busy} onClick={() => act('resume')}>Продолжить</Button> : <Button tone="ghost" icon="pause" disabled={busy} onClick={() => act('pause')}>Пауза</Button>)}
                  {s.state === 'question' && <Button tone="ghost" disabled={busy} onClick={() => act('reveal')}>Закрыть вопрос досрочно</Button>}
                  {s.state === 'reveal' && <Button icon="play" disabled={busy} onClick={() => act('next')}>{s.index + 1 >= s.questionsCount ? 'Показать итоги' : 'Следующий вопрос сейчас'}</Button>}
                  {s.state === 'reveal' && <span className="self-center text-[13px] text-muted">или автоматически через {Math.max(0, Math.ceil((s.revealMs - (now - at)) / 1000))} с</span>}
                </div>
              )}
            </>
          )}
          {s.state === 'finished' && !q && <Empty img="L01" title="Эфир завершён" />}
        </Card>
        <div className="flex flex-col gap-5">
          <Card title="Таблица эфира">
            {s.leaderboard.length === 0 ? <p className="text-[14px] text-muted">Пока нет баллов.</p> : (
              <ol className="flex flex-col gap-1.5">{s.leaderboard.slice(0, 10).map((e) => <li key={e.userId} className="flex items-center gap-3 rounded-[12px] bg-canvas px-3 py-2"><span className="w-6 font-extrabold text-muted">{e.rank}</span><span className="flex-1 font-semibold">{e.name}</span><span className="font-bold tabular-nums">{e.points}</span></li>)}</ol>
            )}
          </Card>
          <Card title={`Участники · ${s.participantsCount}`} action={s.online && <span className="text-[12px] font-semibold text-muted">{s.players.filter((p) => !online.has(p.userId)).length} не в сети</span>}>
            <div className="flex flex-wrap gap-1.5">
              {s.players.map((p) => (
                <span key={p.userId} className={clsx('inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold', online.has(p.userId) || !s.online ? 'bg-canvas' : 'bg-warning-50 text-warning-ink')}>
                  {online.has(p.userId) || !s.online ? (p.ready || answeredIds.has(p.userId) ? '✓' : '…') : '⚠'} {p.name}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-muted">✓ готов · … ждёт · ⚠ нет связи. Переподключившийся участник вернётся в тот же вопрос, баллы не задвоятся.</p>
          </Card>
          <Card><Icon name="send" className="mb-2 text-primary" /><p className="text-[13px] text-muted">Ссылка для учеников: <span className="break-all font-mono">{link}</span></p></Card>
        </div>
      </div>
    </>
  );
}
