import { clsx } from 'clsx';
import type { Book } from '@rq/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../components/ui';
import { useTrial } from '../components/trial/Trial';
import { ErrorView, LoadingView } from '../components/states/StateViews';

const ZOOMS = [1, 1.5, 2] as const;
const lastPageKey = (id: string) => `rq-book-page-${id}`;

function readLastPage(id: string): number {
  try { return Number(localStorage.getItem(lastPageKey(id))) || 1; } catch { return 1; }
}
function saveLastPage(id: string, n: number) {
  try { localStorage.setItem(lastPageKey(id), String(n)); } catch { /* private mode */ }
}

/**
 * In-app book reader. The PDF never reaches the phone: each page comes from the
 * server as an image already stamped with the reader's Telegram ID and is drawn
 * onto a <canvas> (no <img>, so there is no «save image» on long press).
 * Pages far from the screen are released to keep memory low on big books.
 */
export function ReaderScreen() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const state = useAsync(() => api().getBooks(), [id]);
  const [current, setCurrent] = useState(1);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const [ratio, setRatio] = useState(1.3);
  const trial = useTrial();
  const [loading, setLoading] = useState<Set<number>>(new Set());
  const onLoading = useCallback((n: number, on: boolean) => setLoading((s) => {
    if (s.has(n) === on) return s;
    const next = new Set(s); if (on) next.add(n); else next.delete(n); return next;
  }), []);
  const scroller = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  const book: Book | undefined = state.status === 'success' ? state.data.find((b) => b.id === id) : undefined;

  // return to where the reader stopped last time
  useEffect(() => {
    if (!book || restored.current) return;
    restored.current = true;
    const n = Math.min(readLastPage(book.id), book.pages);
    if (n > 1) requestAnimationFrame(() => document.getElementById(`page-${n}`)?.scrollIntoView());
  }, [book]);

  useEffect(() => { if (book) saveLastPage(book.id, current); }, [book, current]);

  if (state.status === 'loading') return <LoadingView />;
  if (state.status === 'error') return <ErrorView error={state.error} onRetry={state.reload} />;
  if (!book || !book.pages) return <ErrorView error={new Error('not found')} onRetry={state.reload} />;
  // trial: only the first pages; the rest is behind a lock card
  const open = trial ? Math.min(book.pages, trial.trialPages) : book.pages;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] select-none flex-col bg-track" onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}>
      <div className="sticky top-0 z-20 bg-canvas/95 px-[18px] pb-2 backdrop-blur" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
        <ScreenHeader back={`/books/${book.id}`} title={book.title} />
        <div className="mt-2 flex items-center justify-between text-[13px] font-bold text-muted">
          <span className="tabular-nums">{current} / {book.pages}</span>
          <span role="group" aria-label={t('books.zoom')} className="flex gap-1">
            {ZOOMS.map((z) => (
              <button key={z} type="button" aria-pressed={zoom === z} onClick={() => setZoom(z)}
                className={clsx('h-8 rounded-full px-3', zoom === z ? 'bg-primary text-white' : 'bg-surface text-ink shadow-card')}>{Math.round(z * 100)}%</button>
            ))}
          </span>
        </div>
        {loading.size > 0 && (
          <div role="status" className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-primary">
            <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            {t('books.loading')}
            <span aria-hidden className="ml-1 h-1 flex-1 overflow-hidden rounded-full bg-primary/15"><span className="block h-full w-1/3 animate-[reader-bar_1.1s_ease-in-out_infinite] rounded-full bg-primary" /></span>
          </div>
        )}
      </div>
      <div ref={scroller} className="flex-1 overflow-x-auto" style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}>
        <div className="flex flex-col gap-2 px-2 pt-2" style={{ width: `${zoom * 100}%` }}>
          {Array.from({ length: open }, (_, i) => (
            <Page key={i + 1} bookId={book.id} n={i + 1} ratio={ratio} onRatio={setRatio} onVisible={setCurrent} onLoading={onLoading} />
          ))}
          {open < book.pages && (
            <div className="flex flex-col items-center gap-3 rounded-[16px] bg-surface p-6 text-center shadow-card">
              <span className="grid size-14 place-items-center rounded-full bg-night text-white"><Icon name="lock" size={24} /></span>
              <b className="font-display text-[20px]">{t('trial.pagesTitle')}</b>
              <p className="max-w-[280px] text-[14px] text-ink-2">{t('trial.pagesText', { n: open })}</p>
              <Link to="/subscribe" className="flex h-12 w-full max-w-[280px] items-center justify-center rounded-control bg-primary text-[15px] font-bold text-white shadow-primary">{t('trial.see')}</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Decode off-screen: an <img> is never put in the page, so there is nothing to long-press and save. */
async function decode(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function' && blob.type !== 'image/svg+xml') {
    try {
      const bmp = await createImageBitmap(blob);
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch { /* fall back to an off-screen image */ }
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  try { await img.decode(); } catch (e) { URL.revokeObjectURL(url); throw e; }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

function Page({ bookId, n, ratio, onRatio, onVisible, onLoading }: { bookId: string; n: number; ratio: number; onRatio: (r: number) => void; onVisible: (n: number) => void; onLoading: (n: number, on: boolean) => void }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);

  // report loading up (header indicator); after 4 s say that the connection is slow
  useEffect(() => {
    onLoading(n, status === 'loading');
    if (status !== 'loading') { setSlow(false); return; }
    const id = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(id);
  }, [status, n, onLoading]);
  useEffect(() => () => onLoading(n, false), [n, onLoading]);

  // load when within ~2 screens, release when far away
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const far = new IntersectionObserver(([e]) => setNear(!!e?.isIntersecting), { rootMargin: '1600px 0px' });
    const seen = new IntersectionObserver(([e]) => { if (e?.isIntersecting) onVisible(n); }, { threshold: 0.5 });
    far.observe(el); seen.observe(el);
    return () => { far.disconnect(); seen.disconnect(); };
  }, [n, onVisible]);

  useEffect(() => {
    const c = canvas.current;
    if (!near || !c) {
      if (c) { c.width = 0; c.height = 0; }
      setStatus('idle');
      return;
    }
    let alive = true;
    setStatus('loading');
    api().getBookPage(bookId, n)
      .then(decode)
      .then((img) => {
        if (!alive) return;
        c.width = img.width; c.height = img.height;
        c.getContext('2d')?.drawImage(img.source, 0, 0, img.width, img.height);
        if (n === 1) onRatio(img.height / img.width);
        img.release();
        setStatus('ready');
      })
      .catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, [near, bookId, n, attempt, onRatio]);

  return (
    <div ref={box} id={`page-${n}`} className="relative w-full overflow-hidden rounded-[6px] bg-white shadow-card" style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas ref={canvas} aria-label={`${n}`} className="pointer-events-none block size-full" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col gap-3 p-[8%]">
          {[70, 92, 84, 96, 60, 88, 78].map((w, i) => <span key={i} className="h-2.5 animate-pulse rounded-full bg-track" style={{ width: `${w}%` }} />)}
          <div className="mt-auto flex flex-col items-center gap-2 pb-[10%] text-center">
            <span aria-hidden className="size-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
            <span className="text-[13px] font-bold text-ink-2">{t('books.pageLoading', { n })}</span>
            {slow && <span className="max-w-[240px] text-[12px] text-muted">{t('books.slow')}</span>}
          </div>
        </div>
      )}
      {status === 'error' && (
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className="absolute inset-0 grid place-items-center p-6 text-center text-[13px] font-semibold text-error-ink">{t('books.pageError')}</button>
      )}
    </div>
  );
}
