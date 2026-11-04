import { clsx } from 'clsx';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { get, post, put } from '../lib/api';
import { useLoad, useToast } from '../lib/hooks';
import type { Difficulty, Option, Question, Topic } from '../lib/types';
import { Button, Card, ErrorBox, Field, Icon, Input, PageHeader, Segmented, Select, Spinner, Textarea } from '../components/ui';

const LABELS = ['A', 'B', 'C', 'D'];
const blank = (): Draft => ({ topicId: '', subtopicId: null, text: '', imageUrl: null, difficulty: 'medium', points: 100, explanationRu: '', explanationUz: '', status: 'draft', options: LABELS.map(() => ({ text: '', isCorrect: false })) });
type Draft = Pick<Question, 'topicId' | 'subtopicId' | 'text' | 'imageUrl' | 'difficulty' | 'points' | 'explanationRu' | 'explanationUz' | 'status'> & { options: Option[] };

export function validate(d: Draft) {
  return [
    [Boolean(d.topicId), 'Раздел выбран', 'Выберите раздел'],
    [d.text.trim().length > 0, 'Текст вопроса заполнен', 'Нет текста вопроса'],
    [d.options.every((o) => o.text.trim()), 'Все четыре варианта заполнены', `Вариант ${LABELS[d.options.findIndex((o) => !o.text.trim())] ?? ''} пустой`],
    [d.options.filter((o) => o.isCorrect).length === 1, 'Правильный ответ отмечен', 'Отметьте ровно один правильный ответ'],
    [d.points >= 10 && d.points % 10 === 0, `Баллы: ${d.points}`, 'Баллы — от 10, кратно 10'],
  ] as const;
}

export function QuestionFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const topics = useLoad(() => get<Topic[]>('/api/admin/topics'));
  const [d, setD] = useState<Draft | null>(id ? null : blank());
  const [loadErr, setLoadErr] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lang, setLang] = useState<'ru' | 'uz'>('ru');

  useEffect(() => {
    if (!id) return;
    get<Question>(`/api/admin/questions/${id}`).then((q) => setD({ ...q, explanationRu: q.explanationRu ?? '', explanationUz: q.explanationUz ?? '' }), setLoadErr);
  }, [id]);
  useEffect(() => {
    if (d && !d.topicId && topics.state.status === 'ok' && topics.state.data[0]) setD({ ...d, topicId: topics.state.data[0].id });
  }, [topics.state, d]);

  if (loadErr) return <ErrorBox error={loadErr} />;
  if (!d || topics.state.status !== 'ok') return <Spinner />;
  const topic = topics.state.data.find((t) => t.id === d.topicId);
  const checks = validate(d);
  const ok = checks.every(([pass]) => pass);
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });
  const setOpt = (i: number, patch: Partial<Option>) => set({ options: d.options.map((o, j) => (j === i ? { ...o, ...patch } : patch.isCorrect ? { ...o, isCorrect: false } : o)) });

  const save = async (status: Draft['status'], next: boolean) => {
    setSaving(true); setErr(null);
    try {
      const body = { ...d, status, explanationRu: d.explanationRu || null, explanationUz: d.explanationUz || null };
      if (id) await put(`/api/admin/questions/${id}`, body); else await post('/api/admin/questions', body);
      toast(id ? 'Вопрос сохранён. Прошлые результаты не изменились.' : 'Вопрос добавлен');
      if (next) setD({ ...blank(), topicId: d.topicId, subtopicId: d.subtopicId, difficulty: d.difficulty, points: d.points });
      else nav('/questions');
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader crumbs={<><Link to="/questions" className="text-primary">Банк вопросов</Link> / {id ? 'Редактирование' : 'Новый вопрос'}</>} title={id ? 'Редактирование вопроса' : 'Новый вопрос'} />
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <Card title="1 · Основное">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Раздел"><Select value={d.topicId} onChange={(e) => set({ topicId: e.target.value, subtopicId: null })}>{topics.state.data.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select></Field>
              <Field label="Подраздел"><Select value={d.subtopicId ?? ''} onChange={(e) => set({ subtopicId: e.target.value || null })}><option value="">—</option>{topic?.subtopics.map((s) => <option key={s.id} value={s.id ?? ''}>{s.title}</option>)}</Select></Field>
            </div>
            <div className="mt-4"><span className="mb-1.5 block text-[13px] font-bold text-ink-2">Сложность</span>
              <Segmented label="Сложность" value={d.difficulty} onChange={(v: Difficulty) => set({ difficulty: v })} options={[['easy', 'Лёгкий'], ['medium', 'Средний'], ['hard', 'Сложный']]} />
            </div>
          </Card>
          <Card title="2 · Вопрос">
            <Field label="Текст вопроса · всегда на русском"><Textarea value={d.text} onChange={(e) => set({ text: e.target.value })} placeholder="Какое из слов является наречием?" /></Field>
            <Field className="mt-4" label="Изображение (необязательно)" hint="Ссылка на JPG, PNG или WebP"><Input value={d.imageUrl ?? ''} onChange={(e) => set({ imageUrl: e.target.value || null })} placeholder="https://…" /></Field>
          </Card>
          <Card title="3 · Варианты ответа">
            <p className="-mt-3 mb-4 text-[13px] text-muted">Отметьте ровно один правильный ответ.</p>
            <div className="flex flex-col gap-2.5">
              {d.options.map((o, i) => (
                <div key={i} className={clsx('flex items-center gap-3 rounded-[16px] border-2 p-2', o.isCorrect ? 'border-success bg-success-50' : 'border-line')}>
                  <span className={clsx('grid size-9 shrink-0 place-items-center rounded-[10px] font-extrabold', o.isCorrect ? 'bg-success text-white' : 'bg-track text-ink-2')}>{LABELS[i]}</span>
                  <input aria-label={`Вариант ${LABELS[i]}`} value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none" placeholder={`Вариант ${LABELS[i]}`} />
                  <label className="flex shrink-0 items-center gap-1.5 pr-2 text-[13px] font-bold text-ink-2"><input type="radio" name="correct" checked={o.isCorrect} onChange={() => setOpt(i, { isCorrect: true })} className="accent-[var(--color-success)]" />Правильный</label>
                </div>
              ))}
            </div>
          </Card>
          <Card title="4 · Баллы">
            <div className="flex flex-wrap items-center gap-2">
              {[50, 100, 150, 200].map((p) => <Button key={p} tone={d.points === p ? 'primary' : 'ghost'} onClick={() => set({ points: p })}>{p}</Button>)}
              <Input type="number" min={10} step={10} aria-label="Свои баллы" value={d.points} onChange={(e) => set({ points: Number(e.target.value) })} className="w-28" />
              <span className="text-[13px] text-muted">кратно 10</span>
            </div>
          </Card>
          <Card title="5 · Объяснение правильного ответа" action={<Segmented label="Язык объяснения" value={lang} onChange={setLang} options={[['ru', 'RU · обязательно'], ['uz', 'UZ · по желанию']]} />}>
            {lang === 'ru'
              ? <Textarea aria-label="Объяснение (RU)" value={d.explanationRu ?? ''} onChange={(e) => set({ explanationRu: e.target.value })} placeholder="«Быстро» отвечает на вопрос «как?» и не изменяется — это признаки наречия." />
              : <Textarea aria-label="Объяснение (UZ)" value={d.explanationUz ?? ''} onChange={(e) => set({ explanationUz: e.target.value })} placeholder="Кириллица (ЎЗ) создаётся автоматически из латиницы." />}
          </Card>
        </div>
        <aside className="flex flex-col gap-5 xl:sticky xl:top-6">
          <Card title="Как увидит ученик">
            <div className="rounded-[22px] bg-canvas p-3.5">
              <div className="rounded-[18px] bg-surface p-4"><span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary">{d.points} баллов</span><p className="mt-2 text-[16px] font-bold leading-6">{d.text || 'Текст вопроса'}</p></div>
              <div className="mt-2 flex flex-col gap-1.5">{d.options.map((o, i) => <div key={i} className="flex items-center gap-2 rounded-[14px] bg-surface p-2 text-[14px] font-semibold"><span className="grid size-7 place-items-center rounded-[8px] bg-track text-[12px] font-extrabold">{LABELS[i]}</span>{o.text || <span className="text-muted">пусто</span>}</div>)}</div>
            </div>
          </Card>
          <Card title="Проверка перед сохранением">
            <ul className="flex flex-col gap-2 text-[14px]">
              {checks.map(([pass, good, bad]) => <li key={good} className={clsx('flex items-center gap-2 font-semibold', pass ? 'text-success-ink' : 'text-error-ink')}><Icon name={pass ? 'check' : 'x'} size={16} />{pass ? good : bad}</li>)}
            </ul>
            <p className="mt-3 rounded-[12px] bg-canvas p-3 text-[12px] text-muted">Время задаётся не у вопроса, а у всего теста — в конструкторе теста. Изменения применяются сразу; уже пройденные попытки сохраняют вопрос таким, каким он был.</p>
          </Card>
          {err && <p role="alert" className="rounded-[14px] bg-error-50 p-3 text-[14px] font-semibold text-error-ink">{err}</p>}
          <div className="flex flex-col gap-2">
            <Button disabled={!ok || saving} onClick={() => save('published', false)}>Сохранить и опубликовать</Button>
            <Button tone="soft" disabled={!ok || saving} onClick={() => save(id ? d.status : 'draft', false)}>{id ? 'Сохранить' : 'Сохранить черновик'}</Button>
            {!id && <Button tone="ghost" disabled={!ok || saving} onClick={() => save('draft', true)}>Сохранить и добавить следующий</Button>}
            <Button tone="ghost" onClick={() => nav('/questions')}>Отмена</Button>
          </div>
        </aside>
      </div>
    </>
  );
}
