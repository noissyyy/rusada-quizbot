import type { Book } from '@rq/shared-types';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { BookCover } from '../books/BookCover';
import { GradientDecor, Icon, toneStyle } from '../ui';

/** Wide banner on Home, after the tests: up to three covers fanned out on the right. */
export function BooksBanner({ books }: { books: Book[] }) {
  const { t } = useI18n();
  const shown = books.slice(0, 3);
  const fan = ['-rotate-[10deg] translate-x-2.5 translate-y-1.5', 'z-10 -translate-y-1', 'rotate-[10deg] -translate-x-2.5 translate-y-1.5'];
  return (
    <Link to="/books" style={toneStyle('ink')} className="relative flex min-h-[150px] items-center overflow-hidden rounded-hero p-5 text-white active:scale-[0.99]">
      <GradientDecor />
      <div className="relative z-10 flex max-w-[56%] flex-col gap-1.5">
        <span className="font-display text-[20px] font-bold leading-6 tracking-tight">{t('books.bannerTitle')}</span>
        <span className="text-[13px] leading-[18px] text-white/80">{t('books.bannerText')}</span>
        <span className="mt-1.5 inline-flex h-9 items-center gap-1 self-start whitespace-nowrap rounded-full bg-white px-3 text-[13px] font-bold text-ink">
          {t('books.open')}<Icon name="chevronRight" size={16} />
        </span>
      </div>
      <div aria-hidden className="absolute right-4 top-1/2 flex -translate-y-1/2 items-end">
        {shown.map((b, i) => <BookCover key={b.id} book={b} bare className={`w-[52px] shrink-0 ring-2 ring-white/70 ${fan[shown.length === 1 ? 1 : i]}`} />)}
      </div>
    </Link>
  );
}
