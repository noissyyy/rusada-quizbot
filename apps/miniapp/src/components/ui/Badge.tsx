import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type Tone = 'primary' | 'success' | 'error' | 'warning' | 'neutral' | 'live';
const tones: Record<Tone, string> = {
  primary: 'bg-primary-50 text-primary',
  success: 'bg-success-50 text-success',
  error: 'bg-error-50 text-error',
  warning: 'bg-warning-50 text-warning',
  neutral: 'bg-track text-muted',
  live: 'bg-error text-white',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-micro font-semibold', tones[tone], className)}>
      {tone === 'live' && <span className="size-1.5 animate-pulse rounded-full bg-white" />}
      {children}
    </span>
  );
}
