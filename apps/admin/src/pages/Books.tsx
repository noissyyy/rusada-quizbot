import { clsx } from 'clsx';
import { useRef, useState } from 'react';
import { del, get, post, put, upload } from '../lib/api';
import { useLoad, useToast } from '../lib/hooks';
import { Button, Card, Empty, ErrorBox, Field, Icon, Input, PageHeader, Pill, Spinner, Textarea, Toggle } from '../components/ui';

interface Book { id: string; title: string; author: string; description: string; price: string; link: string; coverUrl: string | null; isActive: boolean; position: number; pages: number }
type Edit = Omit<Book, 'id' | 'coverUrl' | 'position' | 'pages'> & { id?: string; coverUrl?: string | null; pages?: number };
const blank: Edit = { title: '', author: '', description: '', price: '', link: '', isActive: true };

export function BooksPage() {
  const toast = useToast();
  const { state, reload, setData } = useLoad(() => get<Book[]>('/api/admin/books'));
  const [edit, setEdit] = useState<Edit | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [dropPdf, setDropPdf] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const open = (b: Edit) => { setEdit(b); setCover(null); setPdf(null); setDropPdf(false); setPreview(null); setErr(null); };
  const pickPdf = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 80 * 1024 * 1024) { setErr('PDF больше 80 МБ'); return; }
    setPdf(f); setDropPdf(false); setErr(null);
  };
  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setErr('Обложка больше 10 МБ — уменьшите картинку'); return; }
    setCover(f); setPreview(URL.createObjectURL(f)); setErr(null);
  };
  const save = async () => {
    if (!edit) return;
    setBusy(true); setErr(null);
    try {
      const body = { title: edit.title, author: edit.author, description: edit.description, price: edit.price, link: edit.link, isActive: edit.isActive };
      const b = edit.id ? await put<Book>(`/api/admin/books/${edit.id}`, body) : await post<Book>('/api/admin/books', body);
      if (cover) await upload<Book>(`/api/admin/books/${b.id}/cover`, cover);
      if (pdf) await upload<Book>(`/api/admin/books/${b.id}/pdf`, pdf);
      else if (dropPdf) await del(`/api/admin/books/${b.id}/pdf`);
      toast('Книга сохранена'); setEdit(null); reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async (b: Book) => {
    if (!confirm(`Удалить книгу «${b.title}»? Это нельзя отменить.`)) return;
    await del(`/api/admin/books/${b.id}`); toast('Книга удалена'); if (edit?.id === b.id) setEdit(null); reload();
  };
  const move = async (list: Book[], i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setData(next);
    await post('/api/admin/books/reorder', next.map((b) => b.id));
  };
  const shownCover = preview ?? edit?.coverUrl ?? null;

  return (
    <>
      <PageHeader title="Библиотека" sub="Книги для чтения в приложении: вкладка «Библиотека» и баннер на главной. Порядок здесь = порядок в приложении.">
        <Button icon="plus" onClick={() => open({ ...blank })}>Новая книга</Button>
      </PageHeader>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_420px]">
        <Card>
          {state.status === 'loading' && <Spinner />}
          {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
          {state.status === 'ok' && state.data.length === 0 && <Empty img="L01" title="Книг пока нет">Добавьте первую книгу с обложкой — она появится в приложении.</Empty>}
          {state.status === 'ok' && state.data.length > 0 && (
            <ul className="flex flex-col gap-2">
              {state.data.map((b, i) => (
                <li key={b.id} className={clsx('flex items-center gap-3 rounded-[16px] border p-3', edit?.id === b.id ? 'border-primary bg-primary-50' : 'border-line')}>
                  <span className="flex flex-col"><button type="button" aria-label="Выше" onClick={() => move(state.data, i, -1)} className="text-muted hover:text-ink"><Icon name="up" size={16} /></button><button type="button" aria-label="Ниже" onClick={() => move(state.data, i, 1)} className="text-muted hover:text-ink"><Icon name="down" size={16} /></button></span>
                  {b.coverUrl ? <img src={b.coverUrl} alt="" className="h-16 w-12 rounded-[6px] object-cover shadow-card" /> : <span className="grid h-16 w-12 place-items-center rounded-[6px] bg-track text-[10px] font-bold text-muted">нет<br />обл.</span>}
                  <div className="min-w-0 flex-1"><div className="truncate font-bold">{b.title}</div><div className="truncate text-[13px] text-muted">{[b.author, b.price, b.pages ? `PDF · ${b.pages} стр.` : ''].filter(Boolean).join(' · ') || '—'}</div></div>
                  <Pill tone={b.isActive ? 'ok' : 'neutral'}>{b.isActive ? 'Видна' : 'Скрыта'}</Pill>
                  <button type="button" aria-label={`Изменить: ${b.title}`} onClick={() => open({ ...b })} className="grid size-9 place-items-center rounded-full text-muted hover:text-primary"><Icon name="edit" size={18} /></button>
                  <button type="button" aria-label={`Удалить: ${b.title}`} onClick={() => remove(b)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-error-50 hover:text-error-ink"><Icon name="trash" size={18} /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {edit && (
          <Card title={edit.id ? edit.title || 'Книга' : 'Новая книга'}>
            <div className="flex flex-col gap-4">
              <div className="flex items-end gap-4">
                {shownCover ? <img src={shownCover} alt="Обложка" className="h-[150px] w-[106px] rounded-[8px] object-cover shadow-card" /> : <span className="grid h-[150px] w-[106px] place-items-center rounded-[8px] border-2 border-dashed border-line text-center text-[12px] text-muted">Обложка<br />3:4</span>}
                <div className="flex flex-col gap-1.5">
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
                  <Button tone="ghost" icon="upload" onClick={() => fileRef.current?.click()}>{shownCover ? 'Заменить обложку' : 'Загрузить обложку'}</Button>
                  <span className="text-[12px] text-muted">JPG, PNG или WebP · до 10 МБ · уменьшится автоматически</span>
                </div>
              </div>
              <div className="rounded-[14px] bg-canvas p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => pickPdf(e.target.files?.[0])} />
                  <span className="flex-1 text-[14px]"><b>PDF для чтения</b><br /><span className="text-[13px] text-muted">{pdf ? `${pdf.name} · ${Math.round(pdf.size / 1048576)} МБ — загрузится при сохранении` : edit.pages && !dropPdf ? `Загружен · ${edit.pages} стр.` : 'Не загружен — книгу нельзя читать в приложении'}</span></span>
                  <Button tone="ghost" icon="upload" onClick={() => pdfRef.current?.click()}>{edit.pages || pdf ? 'Заменить' : 'Загрузить PDF'}</Button>
                  {(edit.pages || pdf) && !dropPdf ? <Button tone="danger" onClick={() => { setPdf(null); setDropPdf(!!edit.pages); }}>Убрать</Button> : null}
                </div>
                <p className="mt-2 text-[12px] text-muted">Ученики читают книгу внутри приложения постранично. Файл PDF им не отдаётся, каждая страница помечена Telegram ID читателя. Без обложки обложкой станет первая страница.</p>
              </div>
              <Field label="Название"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label="Автор"><Input value={edit.author} onChange={(e) => setEdit({ ...edit, author: e.target.value })} /></Field>
              <Field label="Описание"><Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
              <Field label="Цена" hint="необязательно, например «85 000 сум»"><Input value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
              <Field label="Ссылка для покупки" hint="Telegram, сайт или магазин — откроется по кнопке «Купить»"><Input value={edit.link} placeholder="https://t.me/…" onChange={(e) => setEdit({ ...edit, link: e.target.value })} /></Field>
              <Toggle label="Показывать в приложении" checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} />
              {err && <p role="alert" className="text-[13px] font-semibold text-error-ink">{err}</p>}
              <div className="flex gap-2"><Button tone="ghost" onClick={() => setEdit(null)}>Отмена</Button><Button className="flex-1" disabled={!edit.title.trim() || busy} onClick={save}>{busy ? 'Сохраняем…' : 'Сохранить'}</Button></div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
