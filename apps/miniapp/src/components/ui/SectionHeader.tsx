import type { ReactNode } from 'react';

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-heading font-bold text-ink">{title}</h2>
      {action}
    </div>
  );
}
