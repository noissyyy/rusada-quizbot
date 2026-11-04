import { clsx } from 'clsx';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { download, post, upload } from '../lib/api';
import { useToast } from '../lib/hooks';
import { Button, Card, Icon, PageHeader, Segmented, Table, Toggle, diffLabel } from '../components/ui';

interface Row { row: number; topic: string; subtopic: string | null; text: string; options: string[]; correct: string; difficulty: string; points: number | null; explanation: string | null; test: string | null; errors: string[]; duplicate: boolean; topicId: string | null; suggestion: string | null }
interface Preview { fileName: string; rows: Row[]; ready: number; withErrors: number; duplicates: number }

export function ImportPage() {
  const toast = useToast();
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [p, setP] = useState<Preview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'bad' | 'all'>('bad');
  const [dups, setDups] = useState<Set<number>>(new Set());
  const [publish, setPublish] = useState(false);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setFile(f); setErr(null); setP(null); setBusy(true); setDups(new Set());
    try { setP(await upload<Preview>('/api/admin/import/preview', f)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const fix = (r: Row) => { if (!p || !r.suggestion) return; setP({ ...p, rows: p.rows.map((x) => (x.row === r.row ? { ...x, topic: r.suggestion! } : x)) }); toast('Раздел исправлен — проверка обновится при импорте'); };
  const commit = async () => {
    if (!p) return;
    setBusy(true);
    try {
      const r = await post<{ created: number; skipped: number; tests: number }>('/api/admin/import/commit', { rows: p.rows, includeDuplicates: [...dups], publish });
      toast(`Импортировано ${r.created} вопросов${r.tests ? `, тестов: ${r.tests} (черновики)` : ''}, пропущено ${r.skipped}`);
      nav(r.tests ? '/tests?status=draft' : `/questions${publish ? '' : '?status=draft'}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const step = p ? 2 : file ? 1 : 0;
  const shown = p ? (view === 'bad' ? p.rows.filter((r) => r.errors.length || r.duplicate) : p.rows) : [];
  const fixedTopics = p ? p.rows.filter((r) => r.errors.some((e) => e.startsWith('Раздел')) && r.suggestion === r.topic).length : 0;
  const willImport = p ? p.ready + dups.size + fixedTopics : 0;

  return (
    <>
      <PageHeader title="Импорт вопросов из Excel" sub={<>XLSX или CSV · колонки как в <button type="button" className="font-bold text-primary" onClick={() => download('GET', '/api/admin/import/template', 'rusada-template.xlsx')}>шаблоне</button></>} />
      <ol className="flex flex-wrap gap-2 text-[13px] font-bold">
        {['Файл загружен', 'Проверка', 'Импорт'].map((s, i) => <li key={s} className={clsx('flex items-center gap-2 rounded-full px-3 py-1.5', i <= step ? 'bg-primary-50 text-primary' : 'bg-track text-muted')}>{i < step ? '✓' : i + 1} · {s}</li>)}
      </ol>
      <Card>
        <input ref={input} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files[0]); }}
          className="flex flex-wrap items-center gap-4 rounded-[18px] border-2 border-dashed border-line p-5">
          <span className="grid size-12 place-items-center rounded-[14px] bg-success-50 text-[12px] font-extrabold text-success-ink">{file?.name.split('.').pop()?.toUpperCase() ?? 'XLSX'}</span>
          <div className="flex-1">{file ? <><div className="font-bold">{file.name}</div><div className="text-[13px] text-muted">{p ? `${p.rows.length} строк · ` : ''}{Math.round(file.size / 1024)} КБ</div></> : <div className="text-[14px] text-muted">Перетащите файл сюда или выберите на компьютере</div>}</div>
          <Button tone="ghost" icon="upload" onClick={() => input.current?.click()}>{file ? 'Заменить файл' : 'Выбрать файл'}</Button>
        </div>
        {busy && <p className="mt-3 text-[14px] text-muted">Проверяем…</p>}
        {err && <p role="alert" className="mt-3 rounded-[12px] bg-error-50 p-3 text-[14px] font-semibold text-error-ink">{err}</p>}
      </Card>
      {p && (
        <Card>
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[[p.ready, 'готовы к импорту', 'text-success-ink'], [p.withErrors, 'с ошибками', 'text-error-ink'], [p.duplicates, 'похожи на дубликаты', 'text-warning-ink']].map(([n, l, c]) => <div key={String(l)} className="rounded-[16px] bg-canvas p-4"><div className={clsx('font-display text-[28px] font-extrabold', c)}>{n}</div><div className="text-[13px] text-muted">{l}</div></div>)}
          </div>
          <div className="mb-3"><Segmented label="Строки" value={view} onChange={setView} options={[['bad', `Проблемные · ${p.withErrors + p.duplicates}`], ['all', `Все строки · ${p.rows.length}`]]} /></div>
          <Table head={['Строка', 'Раздел', 'Вопрос', 'Ответ', 'Сложн.', 'Баллы', ...(p.rows.some((r) => r.test) ? ['Тест'] : []), 'Что не так']}>
            {shown.map((r) => (
              <tr key={r.row} className={r.errors.length ? 'bg-error-50/40' : r.duplicate ? 'bg-warning-50/50' : ''}>
                <td className="font-mono">{r.row}</td><td>{r.topic || <i className="text-muted">пусто</i>}</td>
                <td className="max-w-[340px]">{r.text || <i className="text-muted">пусто</i>}</td><td className="font-bold">{r.correct}</td>
                <td>{diffLabel[r.difficulty] ?? r.difficulty}</td><td>{r.points ?? '—'}</td>
                {p.rows.some((x) => x.test) && <td className="whitespace-nowrap text-[13px] text-muted">{r.test ?? '—'}</td>}
                <td className="text-[13px]">
                  {r.errors.map((e) => <div key={e} className="font-semibold text-error-ink">{e}</div>)}
                  {r.suggestion && r.suggestion !== r.topic && <button type="button" onClick={() => fix(r)} className="mt-1 text-[12px] font-bold text-primary">Исправить</button>}
                  {!r.errors.length && r.duplicate && <label className="flex items-center gap-1.5 font-semibold text-warning-ink"><input type="checkbox" checked={dups.has(r.row)} onChange={(e) => setDups((s) => { const n = new Set(s); if (e.target.checked) n.add(r.row); else n.delete(r.row); return n; })} />Такой вопрос уже есть · всё равно добавить</label>}
                  {!r.errors.length && !r.duplicate && <span className="font-semibold text-success-ink">✓</span>}
                </td>
              </tr>
            ))}
          </Table>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button tone="ghost" icon="download" onClick={() => download('POST', '/api/admin/import/errors', 'import-errors.xlsx', { rows: p.rows })}>Скачать файл с пометками ошибок</Button>
            <Toggle label="Сразу опубликовать" checked={publish} onChange={setPublish} />
            <span className="ml-auto text-[13px] text-muted">Строки с ошибками будут пропущены</span>
            <Button disabled={busy || willImport === 0} onClick={commit}>Импортировать {willImport} вопросов{publish ? '' : ' как черновики'}</Button>
          </div>
        </Card>
      )}
      <Card title="Как подготовить файл">
        <ul className="list-inside list-disc space-y-1 text-[14px] text-ink-2">
          <li>Колонки: <b>Раздел, Подраздел, Вопрос, A, B, C, D, Правильный, Сложность, Баллы, Объяснение, Тест</b>.</li>
          <li>«Тест» — необязательно: строки с одинаковым названием теста сразу собираются в один тест (черновик) в порядке файла. Время теста ставится автоматически: 2 минуты на каждый вопрос (меняется в Настройках). Останется проверить и опубликовать.</li>
          <li>«Правильный» — буква A, B, C или D. «Сложность» — лёгкий, средний или сложный. Баллы — от 10, кратно 10.</li>
          <li>Новые подразделы создаются автоматически. Вопросы, которые уже есть в банке, помечаются как дубликаты.</li>
          <li><button type="button" onClick={() => download('GET', '/api/admin/import/template', 'rusada-template.xlsx')} className="inline-flex items-center gap-1 font-bold text-primary"><Icon name="download" size={16} />Скачать шаблон</button></li>
        </ul>
      </Card>
    </>
  );
}
