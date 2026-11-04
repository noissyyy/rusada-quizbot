import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { SessionResult } from '@rq/shared-types';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { getWebApp, haptic } from '../lib/telegram/webapp';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon, Skeleton } from '../components/ui';

const BOT = (import.meta.env.VITE_BOT_USERNAME as string | undefined) ?? 'Rusada_QuizBot';

/** Deep link that opens the same test for a friend. */
export const testLink = (quizId: string | null) => `https://t.me/${BOT}?startapp=${quizId ? `t_${quizId}` : 'home'}`;

/** Draws the share card into a PNG (no external libraries, works offline). */
async function renderCard(r: SessionResult, lines: { headline: string; line: string; challenge: string }): Promise<Blob | null> {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#6A3DF0'); grad.addColorStop(1, '#3B1FA8');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const load = (src: string) => new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  const [logo, cup] = await Promise.all([load('/brand/rusada-uc-square.png'), load('/3d/rq-3d-R01.webp')]);
  if (logo) g.drawImage(logo, 80, 80, 120, 120);
  g.fillStyle = '#fff'; g.font = '700 54px Onest Variable, sans-serif'; g.fillText('Rusada', 230, 140);
  g.globalAlpha = 0.7; g.font = '700 30px Onest Variable, sans-serif'; g.fillText('QUIZBOT', 230, 185); g.globalAlpha = 1;
  if (cup) g.drawImage(cup, W - 460, 230, 380, 380);
  g.font = '700 64px Onest Variable, sans-serif';
  wrap(g, lines.headline, 80, 720, W - 160, 76);
  g.font = '800 220px Onest Variable, sans-serif'; g.fillText(String(r.points), 80, 1080);
  g.globalAlpha = 0.8; g.font = '600 44px Onest Variable, sans-serif'; g.fillText(lines.line, 80, 1150); g.globalAlpha = 1;
  g.font = '700 44px Onest Variable, sans-serif'; g.fillText(lines.challenge, 80, 1260);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > max && line) { g.fillText(line, x, y); line = word; y += lh; } else line = test;
  }
  g.fillText(line, x, y);
}

/** 15b · Поделиться результатом */
export function ShareResultScreen() {
  const { sid = '' } = useParams();
  const { t } = useI18n();
  const state = useAsync(() => api().getResult(sid), [sid]);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flash = (msg: string) => { setToast(msg); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 2000); };

  if (state.status !== 'success') return <div className="mx-auto max-w-[480px] p-5"><Skeleton className="h-[420px] rounded-hero" /></div>;
  const r = state.data;
  const pct = r.review.length ? Math.round((100 * r.correct) / r.review.length) : 0;
  const lines = { headline: t('share.headline', { t: r.quizTitle }), line: t('share.line', { m: r.maxPoints, p: pct }), challenge: t('share.challenge') };
  const link = testLink(r.quizId);
  const text = t('share.text', { p: r.points, m: r.maxPoints, t: r.quizTitle });

  const toTelegram = () => {
    haptic.tap();
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    const wa = getWebApp();
    if (wa) wa.openTelegramLink(url); else window.open(url, '_blank');
  };
  const savePhoto = async () => {
    const blob = await renderCard(r, lines);
    if (!blob) return;
    const file = new File([blob], 'rusada-result.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }).catch(() => undefined); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const copyLink = async () => { await navigator.clipboard?.writeText(link).catch(() => undefined); flash(t('share.copied')); };

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-[18px]" style={{ paddingTop: 'calc(var(--safe-top) + 20px)', paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
      <ScreenHeader back={`/result/${sid}`} title={t('share.title')} />
      <section className="relative overflow-hidden rounded-hero bg-gradient-to-br from-primary to-[#3B1FA8] p-6 text-white shadow-primary">
        <div className="flex items-center gap-2.5">
          <img src="/brand/rusada-uc-square.png" alt="" className="size-10 rounded-[12px]" />
          <div><div className="font-display text-[18px] font-bold leading-5">Rusada</div><div className="text-[10px] font-bold tracking-[0.18em] text-white/70">QUIZBOT</div></div>
        </div>
        <img src="/3d/rq-3d-R01.webp" alt="" className="absolute -right-3 top-12 size-[130px] object-contain" />
        <h1 className="mt-14 max-w-[70%] font-display text-[22px] font-bold leading-7">{lines.headline}</h1>
        <div className="mt-4 font-display text-[64px] font-extrabold leading-none tracking-tighter tabular-nums">{r.points}</div>
        <div className="mt-1 text-[14px] font-semibold text-white/80">{lines.line}</div>
        <div className="mt-5 text-[15px] font-bold">{lines.challenge}</div>
      </section>
      <div className="flex flex-col gap-2.5">
        <button type="button" onClick={toTelegram} className="flex h-14 items-center justify-center gap-2 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary"><Icon name="send" size={20} />{t('share.telegram')}</button>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={savePhoto} className="flex h-[52px] items-center justify-center gap-2 rounded-control bg-surface text-[15px] font-bold shadow-card"><Icon name="image" size={20} />{t('share.save')}</button>
          <button type="button" onClick={copyLink} className="flex h-[52px] items-center justify-center gap-2 rounded-control bg-surface text-[15px] font-bold shadow-card"><Icon name="link" size={20} />{t('share.link')}</button>
        </div>
      </div>
      {toast && <div role="status" className="fixed inset-x-0 bottom-8 mx-auto w-fit rounded-full bg-night px-4 py-2.5 text-caption font-bold text-white">{toast}</div>}
    </main>
  );
}
