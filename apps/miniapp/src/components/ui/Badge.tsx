import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type Tone = 'primary' | 'easy' | 'medium' | 'hard' | 'neutral' | 'live';
const tones: Record<Tone, string> = {
  primary: 'bg-primary-50 text-primary',
  easy: 'bg-success-50 text-success-ink',
  medium: 'bg-warning-50 text-warning-ink',
  hard: 'bg-error-50 text-error-ink',
  neutral: 'bg-track text-muted',
  live: 'bg-brand text-white',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 text-micro font-bold', tones[tone], className)}>
      {tone === 'live' && <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-white" />}
      {children}
    </span>
  );
}
