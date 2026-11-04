import { clsx } from 'clsx';
import { NavLink } from 'react-router-dom';
import type { MessageKey } from '../lib/i18n/dict';
import { useI18n } from '../lib/i18n';
import { haptic } from '../lib/telegram/webapp';
import { Icon, type IconName } from './ui';

const items: { to: string; label: MessageKey; icon: IconName }[] = [
  { to: '/', label: 'nav.home', icon: 'home' },
  { to: '/tests', label: 'nav.tests', icon: 'grid' },
  { to: '/books', label: 'nav.books', icon: 'book' },
  { to: '/rating', label: 'nav.rating', icon: 'trophy' },
  { to: '/profile', label: 'nav.profile', icon: 'user' },
];

/** Floating pill nav: the active item shows its label, others are icon-only. */
export function BottomNav() {
  const { t } = useI18n();
  return (
    <nav aria-label="Menu" className="fixed inset-x-0 z-40 mx-auto max-w-[480px] px-[18px]" style={{ bottom: 'calc(var(--safe-bottom) + 24px)' }}>
      <ul className="flex h-[66px] items-center justify-between rounded-full bg-surface p-2 shadow-raised">
        {items.map((it) => (
          <li key={it.to}>
            <NavLink to={it.to} end={it.to === '/'} onClick={() => haptic.select()} aria-label={t(it.label)}
              className={({ isActive }) => clsx('flex h-[50px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-[13px] font-bold transition-colors',
                isActive ? 'bg-primary-50 px-3 text-primary' : 'w-[44px] text-muted hover:text-ink')}>
              {({ isActive }) => (<><Icon name={it.icon} size={22} strokeWidth={isActive ? 2.2 : 1.9} />{isActive && t(it.label)}</>)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
