import { clsx } from 'clsx';
import type { TopicColor } from '@rq/shared-types';

/**
 * The «gradient card» style chosen in the Idea board (variant O): a soft diagonal
 * gradient, big translucent circles and a few sparkles. Our 3D illustrations stay
 * as the icons. Text on it is white, except on yellow (ink, for contrast).
 */
export type GradientTone = 'brand' | 'primary' | 'ink' | 'teal' | TopicColor;

export const gradient: Record<GradientTone, { bg: string; shadow: string; text: 'light' | 'dark' }> = {
  brand: { bg: 'linear-gradient(135deg, #FF6A6A 0%, #F2364F 45%, #D3142F 100%)', shadow: '0 16px 30px rgba(223,29,56,.30)', text: 'light' },
  primary: { bg: 'linear-gradient(135deg, #9B7BFF 0%, #6A3DF0 50%, #4B2BD6 100%)', shadow: '0 12px 24px rgba(106,61,240,.28)', text: 'light' },
  ink: { bg: 'linear-gradient(135deg, #4A4363 0%, #1A1530 100%)', shadow: '0 12px 24px rgba(26,21,48,.28)', text: 'light' },
  teal: { bg: 'linear-gradient(135deg, #2CC6B5 0%, #0B7D78 100%)', shadow: '0 12px 24px rgba(11,125,120,.28)', text: 'light' },
  blue: { bg: 'linear-gradient(135deg, #5B9BFF 0%, #2F6FD0 55%, #2253A8 100%)', shadow: '0 12px 24px rgba(47,111,208,.28)', text: 'light' },
  violet: { bg: 'linear-gradient(135deg, #A68BFF 0%, #7B55F2 55%, #5A35D8 100%)', shadow: '0 12px 24px rgba(106,61,240,.26)', text: 'light' },
  mint: { bg: 'linear-gradient(135deg, #3FD3A7 0%, #13A57C 55%, #0B7D60 100%)', shadow: '0 12px 24px rgba(15,122,82,.26)', text: 'light' },
  peach: { bg: 'linear-gradient(135deg, #FFB35C 0%, #FF7A45 50%, #E8553A 100%)', shadow: '0 12px 24px rgba(232,85,58,.28)', text: 'light' },
  pink: { bg: 'linear-gradient(135deg, #FF8FB1 0%, #E8457A 55%, #C42A5E 100%)', shadow: '0 12px 24px rgba(196,42,94,.26)', text: 'light' },
  yellow: { bg: 'linear-gradient(135deg, #FFE27A 0%, #FFC83D 55%, #F5A70B 100%)', shadow: '0 12px 24px rgba(245,167,11,.28)', text: 'dark' },
};

export const toneText = (tone: GradientTone) => (gradient[tone].text === 'light' ? 'text-white' : 'text-ink');
export const toneMuted = (tone: GradientTone) => (gradient[tone].text === 'light' ? 'text-white/85' : 'text-ink/75');
// isolation: the decor sits at z-index -1, above the background but under every child
export const toneStyle = (tone: GradientTone) => ({ background: gradient[tone].bg, boxShadow: gradient[tone].shadow, isolation: 'isolate' as const });

const Star = ({ className, size }: { className: string; size: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className={clsx('pointer-events-none absolute -z-10', className)}>
    <path d="M12 1.5c.6 5.6 4.9 9.9 10.5 10.5-5.6.6-9.9 4.9-10.5 10.5C11.4 16.9 7.1 12.6 1.5 12 7.1 11.4 11.4 7.1 12 1.5z" fill="currentColor" />
  </svg>
);

/** Waves + sparkles. Put inside a `relative overflow-hidden` element, before the content. */
export function GradientDecor({ sparkles = true, dark = false }: { sparkles?: boolean; dark?: boolean }) {
  const ink = dark ? 'text-ink/25' : 'text-white/90';
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute -z-10 -left-[42%] top-[45%] aspect-square w-[100%] rounded-full bg-white/10" />
      <span aria-hidden className="pointer-events-none absolute -z-10 -right-[30%] -top-[120%] aspect-square w-[85%] rounded-full bg-white/[0.12]" />
      <span aria-hidden className="pointer-events-none absolute -z-10 -bottom-[95%] -right-[10%] aspect-square w-[60%] rounded-full bg-black/[0.06]" />
      {sparkles && (
        <>
          <Star size={12} className={clsx('right-4 top-3', ink)} />
          <Star size={9} className={clsx('right-[40%] top-[44%]', ink)} />
          <span aria-hidden className={clsx('pointer-events-none absolute -z-10 right-[24%] top-[20%] size-1 rounded-full bg-current', ink)} />
          <span aria-hidden className={clsx('pointer-events-none absolute -z-10 right-[52%] top-[28%] size-[3px] rounded-full bg-current', ink)} />
        </>
      )}
    </>
  );
}
