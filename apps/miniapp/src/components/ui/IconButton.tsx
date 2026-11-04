import { clsx } from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  dot?: boolean;
}

export function IconButton({ icon, label, dot, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={clsx(
        'relative grid size-11 place-items-center rounded-control bg-surface text-ink shadow-card',
        'transition-transform duration-150 active:scale-95',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={22} />
      {dot && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-error ring-2 ring-surface" />}
    </button>
  );
}
