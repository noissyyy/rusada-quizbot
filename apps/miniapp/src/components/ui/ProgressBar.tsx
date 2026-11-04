import { clsx } from 'clsx';

interface ProgressBarProps {
  value: number;
  max?: number;
  label: string;
  /** Tailwind bg-* class for the fill */
  fillClassName?: string;
  trackClassName?: string;
  className?: string;
}

export function ProgressBar({
  value, max = 100, label, fillClassName = 'bg-primary', trackClassName = 'bg-track', className,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={clsx('h-1.5 w-full overflow-hidden rounded-full', trackClassName, className)}
    >
      <div
        className={clsx('h-full rounded-full transition-[width] duration-500 ease-out-soft', fillClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
