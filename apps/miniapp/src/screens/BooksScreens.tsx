import type { Book } from '@rq/shared-types';
import { Link, useParams } from 'react-router-dom';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { getWebApp, haptic } from '../lib/telegram/webapp';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Skeleton } from '../components/ui';
import { ErrorView } from '../components/states/StateViews';
import { BookCover } from '../components/books/BookCover';

export function openExternal(url: string) {
  const wa = getWebApp();
  if (!wa) { window.open(url, '_blank', 'noopener'); return; }
  if (/^https:\/\/t\.me\//.test(url)) wa.openTelegramLink(url); else wa.openLink(url);
}

/** «Книги» tab: covers in a two-column shelf */
export function BooksScreen() {
  const { t } = useI18n();
  const state = useAsync(() => api().getBooks());
  if (state.status === 'error') return <ErrorView error={state.error} onRetry={state.reload} />;
  return (
    <Screen className="flex flex-col gap-5">
      <h1 className="font-display text-display font-bold tracking-tight">{t('nav.books')}</h1>
      {state.status === 'loading' ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-[10px]" />)}</div>
      ) : state.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card bg-surface p-6 text-center shadow-card">
          <img src="/3d/rq-3d-T01.webp" alt="" className="size-28 object-contain" />
          <p className="text-body font-semibold text-ink-2">{t('books.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5">
          {state.data.map((b) => (
            <Link key={b.id} to={`/books/${b.id}`} className="flex flex-col gap-2 active:scale-[0.98]">
              <BookCover book={b} />
              <span className="line-clamp-2 text-[14px] font-bold leading-[18px]">{b.title}</span>
              {(b.author || b.price) && <span className="-mt-1 truncate text-[12px] font-semibold text-muted">{b.price || b.author}</span>}
            </Link>
          ))}
        </div>
      )}
    </Screen>
  );
}

export function BookScreen() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const state = useAsync(() => api().getBooks(), [id]);
  if (state.status === 'error') return <ErrorView error={state.error} onRetry={state.reload} />;
  const book: Book | undefined = state.status === 'success' ? state.data.find((b) => b.id === id) : undefined;
  return (
    <Screen className="flex flex-col gap-5">
      <ScreenHeader back="/books" title={t('nav.books')} />
      {state.status === 'loading' ? <Skeleton className="mx-auto aspect-[3/4] w-[200px] rounded-[10px]" /> : !book ? (
        <p className="text-center text-body text-muted">{t('books.empty')}</p>
      ) : (
        <>
          <BookCover book={book} className="mx-auto w-[200px]" />
          <section className="flex flex-col gap-1 text-center">
            <h1 className="font-display text-[24px] font-bold leading-7 tracking-tight">{book.title}</h1>
            {book.author && <span className="text-caption font-semibold text-muted">{book.author}</span>}
            {book.price && <span className="mt-1 font-display text-[20px] font-extrabold text-primary">{book.price}</span>}
          </section>
          {book.description && <p className="whitespace-pre-line rounded-card bg-surface p-4 text-body leading-6 text-ink-2 shadow-card">{book.description}</p>}
          {book.link && (
            <button type="button" onClick={() => { haptic.tap(); openExternal(book.link); }}
              className="h-14 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{t('books.buy')}</button>
          )}
        </>
      )}
    </Screen>
  );
}
