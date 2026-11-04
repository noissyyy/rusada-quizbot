import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'inverse';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white shadow-primary hover:bg-primary-600 active:bg-primary-700',
  secondary: 'bg-primary-50 text-primary hover:bg-primary-100',
  ghost: 'bg-transparent text-ink hover:bg-track',
  inverse: 'bg-white text-primary shadow-card hover:bg-primary-50',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-caption gap-1.5',
  md: 'h-11 px-5 text-body gap-2',
  lg: 'h-14 px-6 text-[16px] gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Button({
  variant = 'primary', size = 'md', block, leading, trailing, className, children, type = 'button', ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex select-none items-center justify-center rounded-control font-semibold',
        'transition-[transform,background-color,box-shadow] duration-150 ease-out-soft active:scale-[0.97]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant], sizes[size], block && 'w-full', className,
      )}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  );
}
