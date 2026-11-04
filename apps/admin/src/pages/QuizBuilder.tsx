import { clsx } from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { can, get, post, put } from '../lib/api';
import { fmtDate, fmtNum, useLoad, useMe, useToast } from '../lib/hooks';
import type { Difficulty, Page, Question, QuizFull, Topic } from '../lib/types';
import { Button, Card, ErrorBox, Field, Icon, Input, NumberInput, PageHeader, Pill, Select, Spinner, Textarea, Toggle, diffLabel, statusLabel } from '../components/ui';

type Draft = Omit<QuizFull, 'id' | 'topicTitle' | 'questionsCount' | 'maxPoints' | 'attempts' | 'publishedAt' | 'updatedAt' | 'updatedByName' | 'status'>;

export function QuizBuilderPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const topicParam = sp.get('topic');
  const nav = useNavigate();
  const toast = useToast();
  const me = useMe();
  const editor = can(me, 'admin');
  const topics = useLoad(() => get<Topic[]>('/api/admin/topics'));
  const cfg = useLoad(() => get<{ minutesPerQuestion?: number }>('/api/admin/settings').catch(() => ({ minutesPerQuestion: 2 })));
  const perQuestionMin = cfg.state.status === 'ok' ? cfg.state.data.minutesPerQuestion ?? 2 : 2;
  const [quiz, setQuiz] = useState<QuizFull | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (id) get<QuizFull>(`/api/admin/tests/${id}`).then((q) => { setQuiz(q); setD(q); }, (e: Error) => setErr(e.message));
  }, [id]);
  useEffect(() => {
    if (!id && !d && topics.state.status === 'ok') {
      setD({ title: '', topicId: (topicParam && topics.state.data.some((t) => t.id === topicParam) ? topicParam : topics.state.data[0]?.id) ?? '', subtopicId: sp.get('work'), description: '', difficulty: 'medium', durationSec: 360, liveQuestionSec: 20, modeIndividual: true, modeLive: false, modeGroup: true, isQuick: false, questions: [] });
    }
  }, [id, d, topics.state]);

  const bankQs = new URLSearchParams({ size: '30', ...(d?.topicId && { topic_id: d.topicId }), ...(search && { q: search }) });
  const bank = useLoad(() => (d ? get<Page<Question>>(`/api/admin/questions?${bankQs}`) : Promise.resolve({ items: [], total: 0 })), [bankQs.toString()]);
  const inTest = useMemo(() => new Set(d?.questions.map((q) => q.id)), [d?.questions]);

  if (err && !d) return <ErrorBox error={new Error(err)} />;
  if (!d || topics.state.status !== 'ok') return <Spinner />;
  const set = (p: Partial<Draft>) => setD({ ...d, ...p });
  const live = d.questions.filter((q) => q.status !== 'archived');
  const maxPoints = live.reduce((n, q) => n + q.points, 0);
  // the whole-test time is automatic: questions × minutes per question (server does the same)
  const minutes = Math.max(1, live.length) * perQuestionMin;
  const move = (i: number, dir: -1 | 1) => { const qs = [...d.questions]; const j = i + dir; if (j < 0 || j >= qs.length) return; [qs[i], qs[j]] = [qs[j]!, qs[i]!]; set({ questions: qs }); };

  const save = async (status?: 'published' | 'draft' | 'archived') => {
    setSaving(true); setErr(null);
    try {
      const body = { ...d, questionIds: d.questions.map((q) => q.id) };
      let saved = id ? await put<QuizFull>(`/api/admin/tests/${id}`, body) : await post<QuizFull>('/api/admin/tests', body);
      if (status && status !== saved.status) saved = await post<QuizFull>(`/api/admin/tests/${saved.id}/status`, { status });
      setQuiz(saved); setD(saved);
      toast(status === 'published' ? 'Тест опубликован' : 'Сохранено');
      if (!id) nav(`/tests/${saved.id}`, { replace: true });
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };
  const [tone, label] = quiz ? statusLabel[quiz.status] ?? ['neutral', quiz.status] : ['draft', '○ Новый'] as const;

  return (
    <>
      <PageHeader crumbs={<><Link to="/tests" className="text-primary">Тесты</Link> / {id ? 'Редактирование' : 'Новый тест'}</>} title={d.title || 'Новый тест'}>
        <Pill tone={tone}>{label}</Pill>
        {editor && <>
          <Button tone="ghost" disabled={saving} onClick={() => save()}>Сохранить{quiz?.status === 'published' ? '' : ' черновик'}</Button>
          {quiz?.status !== 'published' && <Button disabled={saving || !d.title || !live.length} onClick={() => save('published')}>Опубликовать</Button>}
        </>}
      </PageHeader>
      {quiz && quiz.attempts > 0 && (
        <p className="rounded-[16px] bg-primary-50 px-4 py-3 text-[14px] text-ink-2">
          Этот тест уже прошли <b>{fmtNum(quiz.attempts)} раз</b>. Изменения применятся к тесту сразу, без новой версии. Прошлые результаты и разбор ошибок не изменятся — в каждой попытке сохранены вопросы такими, какими они были.
        </p>
      )}
      {err && <p role="alert" className="rounded-[14px] bg-error-50 p-3 text-[14px] font-semibold text-error-ink">{err}</p>}
      <div className="grid items-start gap-5 2xl:grid-cols-[1fr_1.2fr_360px] xl:grid-cols-[1fr_1.2fr]">
        {editor && (
          <Card title="Добавить из банка">
            <Input aria-label="Поиск в банке" placeholder="Поиск по тексту" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 w-full" />
            {bank.state.status === 'loading' && <Spinner />}
            {bank.state.status === 'ok' && (
              <ul className="flex max-h-[560px] flex-col gap-2 overflow-auto">
                {bank.state.data.items.filter((q) => q.status !== 'archived').map((q) => (
                  <li key={q.id} className="flex items-center gap-3 rounded-[14px] bg-canvas p-3">
                    <div className="min-w-0 flex-1"><div className="text-[14px] font-semibold">{q.text}</div><div className="text-[12px] text-muted">{diffLabel[q.difficulty]} · {q.points} баллов{q.status === 'draft' ? ' · черновик' : ''}</div></div>
                    {inTest.has(q.id)
                      ? <span className="flex items-center gap-1 text-[12px] font-bold text-success-ink"><Icon name="check" size={16} />Уже в тесте</span>
                      : <button type="button" aria-label={`Добавить: ${q.text}`} onClick={() => set({ questions: [...d.questions, q] })} className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-white"><Icon name="plus" size={18} /></button>}
                  </li>
                ))}
                {bank.state.data.items.length === 0 && <li className="py-6 text-center text-[13px] text-muted">В этом разделе пока нет вопросов. <Link to="/questions/new" className="font-bold text-primary">Создать вопрос</Link></li>}
              </ul>
            )}
          </Card>
        )}
        <Card title="Вопросы теста" action={<span className="text-[13px] font-bold text-muted">{live.length} вопросов</span>}>
          {d.questions.length === 0 ? <p className="py-8 text-center text-[14px] text-muted">Добавьте вопросы из банка слева.</p> : (
            <ol className="flex flex-col gap-2">
              {(showAll ? d.questions : d.questions.slice(0, 12)).map((q, i) => (
                <li key={q.id} className={clsx('flex items-center gap-3 rounded-[14px] border border-line p-2.5', q.status === 'archived' && 'opacity-50')}>
                  {editor && <span className="flex flex-col"><button type="button" aria-label="Выше" onClick={() => move(i, -1)} className="text-muted hover:text-ink"><Icon name="up" size={16} /></button><button type="button" aria-label="Ниже" onClick={() => move(i, 1)} className="text-muted hover:text-ink"><Icon name="down" size={16} /></button></span>}
                  <span className="w-6 text-center font-extrabold text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-[14px] font-semibold">{q.text}{q.status === 'archived' && <span className="ml-1 text-[12px] text-warning-ink">(в архиве — не показывается)</span>}</span>
                  <span className="font-bold tabular-nums">{q.points}</span>
                  {editor && <button type="button" aria-label={`Убрать: ${q.text}`} onClick={() => set({ questions: d.questions.filter((x) => x.id !== q.id) })} className="grid size-8 place-items-center rounded-full text-muted hover:bg-error-50 hover:text-error-ink"><Icon name="x" size={16} /></button>}
                </li>
              ))}
            </ol>
          )}
          {d.questions.length > 12 && !showAll && <button type="button" onClick={() => setShowAll(true)} className="mt-3 text-[13px] font-bold text-primary">ещё {d.questions.length - 12} вопросов · показать все</button>}
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[[live.length, 'вопросов'], [`${minutes} мин`, 'на весь тест'], [fmtNum(maxPoints), 'макс. баллов']].map(([v, l]) => <div key={String(l)} className="rounded-[14px] bg-canvas p-3"><div className="font-display text-[22px] font-extrabold">{v}</div><div className="text-[12px] text-muted">{l}</div></div>)}
          </div>
        </Card>
        <Card title="Настройки" className="xl:col-span-2 2xl:col-span-1">
          <fieldset disabled={!editor} className="flex flex-col gap-4">
            <Field label="Название"><Input value={d.title} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Раздел"><Select value={d.topicId} onChange={(e) => set({ topicId: e.target.value, subtopicId: null })}>{topics.state.data.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select></Field>
            {(() => {
              const tp = topics.state.data.find((x) => x.id === d.topicId);
              if (tp?.layout !== 'works') return null;
              return (
                <Field label="Произведение" hint="тест появится на обложке этого произведения">
                  <Select value={d.subtopicId ?? ''} onChange={(e) => set({ subtopicId: e.target.value || null })}>
                    <option value="">— не выбрано —</option>
                    {tp.subtopics.map((s) => <option key={s.id ?? s.title} value={s.id ?? ''}>{s.author ? `${s.author} — ` : ''}{s.title}</option>)}
                  </Select>
                </Field>
              );
            })()}
            <Field label="Описание"><Textarea value={d.description} onChange={(e) => set({ description: e.target.value })} /></Field>
            <Field label="Сложность"><Select value={d.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>{Object.entries(diffLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <div className="flex flex-col gap-2.5"><span className="text-[13px] font-bold text-ink-2">Доступные режимы</span>
              <Toggle label="Индивидуальный" checked={d.modeIndividual} onChange={(v) => set({ modeIndividual: v })} />
              <Toggle label="Прямой эфир" checked={d.modeLive} onChange={(v) => set({ modeLive: v })} />
              <Toggle label="Группа" checked={d.modeGroup} onChange={(v) => set({ modeGroup: v })} />
              <Toggle label="Быстрый старт на главной («Начать тест»)" checked={d.isQuick} onChange={(v) => set({ isQuick: v })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold text-ink-2">Время на весь тест</span>
              <span className="rounded-[12px] bg-canvas px-3 py-2.5 text-[14px]"><b>{minutes} мин</b> <span className="text-muted">= {live.length} вопр. × {perQuestionMin} мин · ставится автоматически</span></span>
            </div>
            {d.modeLive && <Field label="В прямом эфире: время на каждый вопрос" hint="секунд — одинаково для всех вопросов"><NumberInput aria-label="Секунд на вопрос в эфире" min={5} max={300} value={d.liveQuestionSec} onCommit={(v) => set({ liveQuestionSec: v })} /></Field>}
            <p className="rounded-[12px] bg-canvas p-3 text-[12px] text-muted">Попытки: без ограничений, в рейтинг идёт лучшая. Показ ответа после вопроса — по настройкам системы (таймер теста в это время на паузе).</p>
          </fieldset>
          {quiz && <p className="mt-4 text-[12px] text-muted">Изменено {fmtDate(quiz.updatedAt)}{quiz.updatedByName ? ` · ${quiz.updatedByName}` : ''}</p>}
          {quiz && editor && quiz.status !== 'archived' && <Button tone="danger" className="mt-4 w-full" onClick={() => save('archived')}>В архив</Button>}
          {quiz && editor && quiz.status === 'archived' && <Button tone="soft" className="mt-4 w-full" onClick={() => save('draft')}>Вернуть из архива</Button>}
        </Card>
      </div>
    </>
  );
}
