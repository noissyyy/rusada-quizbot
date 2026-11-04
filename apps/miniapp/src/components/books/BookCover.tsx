import { clsx } from 'clsx';
import type { Book } from '@rq/shared-types';
import { GradientDecor, toneStyle, type GradientTone } from '../ui';

const tones: GradientTone[] = ['primary', 'brand', 'teal', 'blue', 'peach', 'pink'];

/** Book cover (3:4). Without an uploaded cover we draw a neat placeholder from the title. */
export function BookCover({ book, className, bare }: { book: Pick<Book, 'id' | 'title' | 'author' | 'coverUrl'>; className?: string; bare?: boolean }) {
  const base = clsx('relative aspect-[3/4] overflow-hidden rounded-[10px] shadow-[0_10px_22px_rgba(26,21,48,.18)]', className);
  if (book.coverUrl) return <img src={book.coverUrl} alt={book.title} loading="lazy" className={clsx(base, 'bg-surface object-cover')} />;
  const tone = tones[[...book.id].reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length]!;
  return (
    <div role="img" aria-label={book.title} style={toneStyle(tone)} className={clsx(base, 'flex flex-col justify-end p-3 text-white')}>
      <GradientDecor sparkles={false} />
      <span aria-hidden className="absolute inset-y-0 left-2 w-px bg-white/25" />
      {!bare && <span className="line-clamp-4 font-display text-[15px] font-bold leading-[18px]">{book.title}</span>}
      {!bare && book.author && <span className="mt-1 line-clamp-1 text-[10px] font-semibold text-white/80">{book.author}</span>}
    </div>
  );
}
