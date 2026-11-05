import { clsx } from 'clsx';
import type { AccessInfo } from '@rq/shared-types';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../data/api';
import { useI18n } from '../lib/i18n';
import { getWebApp, haptic } from '../lib/telegram/webapp';
import { GradientDecor, Icon, toneStyle } from '../components/ui';
import { langCode } from '../components/brand/Flag';

/** 118 → «100», 10 432 → «10 000»: a round number that never overstates the real count. */
export function roundDown(n: number): number {
  if (n < 10) return n;
  const step = n < 100 ? 10 : n < 1000 ? 100 : 1000;
  return Math.floor(n / step) * step;
}

const fmtSum = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ');

/** Shown instead of the app when it is closed for this person: what a subscription gives and how to pay. */
export function PaywallScreen({ access, onChanged, back }: { access: AccessInfo; onChanged: () => void; back?: boolean }) {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const copyId = async () => {
    try { await navigator.clipboard.writeText(String(access.telegramId)); setIdCopied(true); haptic.success(); setTimeout(() => setIdCopied(false), 2000); }
    catch { /* the ID is on screen anyway */ }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(access.cardNumber.replace(/\s/g, '')); setCopied(true); haptic.success(); setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard blocked: the number is on screen anyway */ }
  };
  const send = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setErr(null);
    try { await api().sendReceipt(f); haptic.success(); onChanged(); }
    catch (e) {
      haptic.error();
      const d = e instanceof ApiError ? e.detail : '';
      setErr(d === 'receipt_too_big' ? t('pay.err.big') : d === 'receipt_not_image' ? t('pay.err.image') : d === 'already_pending' ? t('pay.err.pending') : t('pay.err.other'));
    } finally { setBusy(false); if (file.current) file.current.value = ''; }
  };
  const support = () => {
    const url = `https://t.me/${access.supportUsername}`;
    const wa = getWebApp();
    if (wa) wa.openTelegramLink(url); else window.open(url, '_blank', 'noopener');
  };
  const sentAt = access.pending ? new Date(access.pending.createdAt).toLocaleString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-[18px]" style={{ paddingTop: 'calc(var(--safe-top) + 16px)', paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}>
      <div className="flex items-center justify-between">
        {back ? <button type="button" aria-label={t('trial.back')} onClick={() => nav(-1)} className="grid size-10 place-items-center rounded-full bg-surface shadow-card"><Icon name="chevronRight" size={20} className="rotate-180" /></button>
          : <img src="/brand/rusada-uc-square.png" alt="Rusada" className="size-10 rounded-[12px] object-cover" />}
        <Link to="/language" aria-label={t('lang.title')} className="flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-bold shadow-card"><Icon name="globe" size={16} />{langCode[lang]}</Link>
      </div>

      <section style={toneStyle('brand')} className="relative overflow-hidden rounded-hero p-5 text-white">
        <GradientDecor />
        <img src="/3d/rq-3d-H02.webp" alt="" className="absolute -right-3 -top-1 size-[132px] object-contain" />
        <span className="inline-flex h-7 items-center rounded-full bg-white/20 px-3 text-[12px] font-bold">{t('pay.badge')}</span>
        <h1 className="mt-3 max-w-[64%] font-display text-[26px] font-extrabold leading-[30px] tracking-tight">{t('pay.title')}</h1>
        <p className="mt-2 max-w-[80%] text-[14px] leading-5 text-white/85">{t('pay.subtitle')}</p>
        <div className="mt-4 flex items-end gap-2">
          <span className="font-display text-[34px] font-extrabold leading-none tabular-nums">{fmtSum(access.priceUzs)}</span>
          <span className="pb-1 text-[14px] font-bold text-white/85">{t('pay.currency')} {t('pay.per', { d: access.days })}</span>
        </div>
      </section>

      {access.trial && (
        <p className="-mt-2 rounded-[16px] bg-surface px-4 py-3 text-[13px] font-semibold text-ink-2 shadow-card">
          {t('trial.badge')} · {access.trialTestsLeft > 0 ? t('trial.left', { n: access.trialTestsLeft, t: access.trialTests }) : t('trial.none')}
        </p>
      )}
      <section className="flex flex-col gap-2.5" aria-labelledby="benefits">
        <h2 id="benefits" className="font-display text-title font-bold tracking-tight">{t('pay.whatYouGet')}</h2>
        <ul className="flex flex-col gap-2.5">
          {([
            ['H02', access.questionsCount >= 10 ? t('pay.b.testsN', { n: fmtSum(roundDown(access.questionsCount)) }) : t('pay.b.tests'), t('pay.b.testsText')],
            ['T09', t('pay.b.library'), access.booksCount > 0 ? `${t('pay.b.libraryText')} · ${t('pay.b.booksN', { n: access.booksCount })}` : t('pay.b.libraryText')],
            ['R01', t('pay.b.tournaments'), t('pay.b.tournamentsText')],
          ] as const).map(([art, title, text]) => (
            <li key={art} className="flex items-center gap-3.5 rounded-[22px] bg-surface p-3.5 shadow-card">
              <span className="grid size-16 shrink-0 place-items-center rounded-[18px] bg-canvas"><img src={`/3d/rq-3d-${art}.webp`} alt="" className="size-14 object-contain" /></span>
              <span className="flex flex-col gap-0.5"><span className="font-display text-[17px] font-bold leading-[22px]">{title}</span><span className="text-[13px] leading-[18px] text-ink-2">{text}</span></span>
            </li>
          ))}
        </ul>
      </section>

      {access.pending ? (
        <section role="status" className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-card">
          <span className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-warning-50 text-warning-ink"><Icon name="clock" size={24} /></span>
          <span className="flex flex-col"><b className="text-[16px]">{t('pay.pendingTitle')}</b><span className="text-[13px] leading-[18px] text-ink-2">{t('pay.pendingText', { d: sentAt })}</span></span>
        </section>
      ) : (
        <section className="flex flex-col gap-3" aria-labelledby="how">
          <h2 id="how" className="font-display text-title font-bold tracking-tight">{t('pay.how')}</h2>
          {access.rejectedComment && (
            <p role="alert" className="rounded-[16px] bg-error-50 p-3.5 text-[14px] leading-5 text-error-ink"><b>{t('pay.rejected')}</b> {access.rejectedComment}</p>
          )}
          <Step n={1} title={t('pay.step1', { s: fmtSum(access.priceUzs) })}>
            <button type="button" onClick={copy} style={toneStyle('ink')} className="relative mt-2 flex aspect-[1.75] w-full max-w-[320px] flex-col justify-between overflow-hidden rounded-[18px] p-4 text-left text-white">
              <GradientDecor sparkles={false} />
              <span className="flex items-center justify-between">
                <span aria-hidden className="h-7 w-10 rounded-[6px] bg-gradient-to-br from-[#FFE27A] to-[#F5A70B]" />
                <span className={clsx('flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-bold', copied ? 'bg-success text-white' : 'bg-white/15 text-white')}>
                  <Icon name={copied ? 'check' : 'copy'} size={14} />{copied ? t('pay.copied') : t('pay.copy')}
                </span>
              </span>
              <span className="whitespace-nowrap font-display text-[clamp(17px,5.6vw,22px)] font-extrabold tracking-[0.06em] tabular-nums">{access.cardNumber || '—'}</span>
              {access.cardHolder ? <span className="truncate text-[12px] font-semibold uppercase tracking-wide text-white/75">{access.cardHolder}</span> : <span />}
            </button>
            {access.note && <p className="mt-2 text-[12px] leading-4 text-muted">{access.note}</p>}
          </Step>
          <Step n={2} title={t('pay.step2')}>
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => send(e.target.files?.[0])} />
            <button type="button" disabled={busy} onClick={() => file.current?.click()}
              className="mt-2 flex h-[52px] w-full items-center justify-center gap-2 rounded-control bg-primary text-[15px] font-bold text-white shadow-primary disabled:opacity-60">
              <Icon name="image" size={20} />{busy ? t('pay.sending') : t('pay.upload')}
            </button>
            {err && <p role="alert" className="mt-2 text-[13px] font-semibold text-error-ink">{err}</p>}
          </Step>
          <Step n={3} title={t('pay.step3')} last />
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
        <div className="flex items-center gap-3">
          <img src="/3d/rq-3d-T05.webp" alt="" className="size-11 object-contain" />
          <span className="flex flex-1 flex-col"><b className="text-[15px]">{t('pay.studentQ')}</b><span className="text-[13px] leading-[18px] text-ink-2">{access.supportUsername ? t('pay.studentA', { u: access.supportUsername }) : t('pay.studentNoSupport')}</span></span>
        </div>
        <button type="button" onClick={copyId} className="flex items-center justify-between rounded-[14px] bg-canvas px-3.5 py-2.5 text-left">
          <span className="flex flex-col"><span className="text-[12px] font-semibold text-muted">{t('pay.yourId')}</span><span className="font-display text-[18px] font-extrabold tabular-nums">{access.telegramId}</span></span>
          <span className={clsx('flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-bold', idCopied ? 'bg-success-50 text-success-ink' : 'bg-primary-50 text-primary')}><Icon name={idCopied ? 'check' : 'copy'} size={14} />{idCopied ? t('pay.copied') : t('pay.copy')}</span>
        </button>
        {access.supportUsername && (
          <button type="button" onClick={support} className="flex h-11 items-center justify-center gap-1.5 rounded-control bg-primary-50 text-[14px] font-bold text-primary">{t('pay.write', { u: access.supportUsername })}<Icon name="chevronRight" size={16} /></button>
        )}
      </section>
    </main>
  );
}

function Step({ n, title, children, last }: { n: number; title: string; children?: React.ReactNode; last?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-[14px] font-extrabold text-white">{n}</span>
        {!last && <span aria-hidden className="mt-1 w-0.5 flex-1 rounded-full bg-primary/15" />}
      </div>
      <div className={clsx('flex-1', !last && 'pb-2')}>
        <p className="pt-1 text-[15px] font-bold leading-5">{title}</p>
        {children}
      </div>
    </div>
  );
}
