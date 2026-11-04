import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { GradientDecor, Icon, toneStyle } from '../ui';

/** Wide banner on Home, after the tests. A drawn shelf of books, not the real covers. */
export function BooksBanner() {
  const { t } = useI18n();
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
      <BookShelf className="absolute -bottom-1 right-2 h-[128px] w-[132px]" />
    </Link>
  );
}

/** Flat book silhouettes: crisp at any size (no filters, no raster). */
function BookShelf({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 132 128" className={className}>
      <defs>
        <linearGradient id="bk1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#9B7BFF" /><stop offset="1" stopColor="#6A3DF0" /></linearGradient>
        <linearGradient id="bk2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FF8A80" /><stop offset="1" stopColor="#F2364F" /></linearGradient>
        <linearGradient id="bk3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFE27A" /><stop offset="1" stopColor="#F5B32B" /></linearGradient>
        <linearGradient id="bk4" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5FE0C6" /><stop offset="1" stopColor="#14A898" /></linearGradient>
      </defs>
      <rect x="2" y="116" width="128" height="8" rx="4" fill="#fff" opacity=".22" />
      <rect x="10" y="22" width="26" height="94" rx="5" fill="url(#bk1)" />
      <rect x="15" y="34" width="16" height="3" rx="1.5" fill="#fff" opacity=".7" />
      <rect x="15" y="40" width="10" height="3" rx="1.5" fill="#fff" opacity=".45" />
      <rect x="15" y="100" width="16" height="3" rx="1.5" fill="#fff" opacity=".7" />
      <rect x="38" y="38" width="22" height="78" rx="5" fill="url(#bk2)" />
      <rect x="42" y="48" width="14" height="10" rx="3" fill="#fff" opacity=".85" />
      <rect x="42" y="102" width="14" height="3" rx="1.5" fill="#fff" opacity=".6" />
      <rect x="62" y="30" width="24" height="86" rx="5" fill="url(#bk3)" />
      <rect x="66" y="40" width="16" height="3" rx="1.5" fill="#1A1530" opacity=".35" />
      <rect x="66" y="46" width="16" height="3" rx="1.5" fill="#1A1530" opacity=".2" />
      <path d="M78 30h6v20l-3-3-3 3z" fill="#F2364F" />
      <g transform="rotate(16 100 116)">
        <rect x="90" y="40" width="24" height="76" rx="5" fill="url(#bk4)" />
        <rect x="94" y="52" width="16" height="3" rx="1.5" fill="#fff" opacity=".7" />
        <rect x="94" y="58" width="10" height="3" rx="1.5" fill="#fff" opacity=".45" />
      </g>
      <path d="M118 8c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5z" fill="#FFE27A" />
    </svg>
  );
}
