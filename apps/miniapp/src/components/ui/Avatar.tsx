import { clsx } from 'clsx';
import { useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  className?: string;
}

export function Avatar({ name, src, size = 44, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span
      className={clsx(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-100 font-semibold text-primary ring-2 ring-surface',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {src && !failed ? (
        <img src={src} alt={name} className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-label={name}>{initials}</span>
      )}
    </span>
  );
}
