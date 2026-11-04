import { clsx } from 'clsx';
import type { ReactNode } from 'react';

/** Page container: mobile column, safe areas, room for floating nav when present. */
export function Screen({ children, withNav = true, className }: { children: ReactNode; withNav?: boolean; className?: string }) {
  return (
    <main
      className={clsx('mx-auto w-full max-w-[480px] px-4', className)}
      style={{
        paddingTop: 'calc(var(--safe-top) + 16px)',
        paddingBottom: withNav ? 'calc(var(--safe-bottom) + var(--nav-height) + 32px)' : 'calc(var(--safe-bottom) + 24px)',
      }}
    >
      {children}
    </main>
  );
}
