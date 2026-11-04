import { clsx } from 'clsx';
import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './ui';
import { haptic } from '../lib/telegram/webapp';

const items: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Главная', icon: 'home' },
  { to: '/topics', label: 'Темы', icon: 'grid' },
  { to: '/leaderboard', label: 'Рейтинг', icon: 'trophy' },
  { to: '/profile', label: 'Профиль', icon: 'user' },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 z-40 mx-auto max-w-[480px] px-4"
      style={{ bottom: 'calc(var(--safe-bottom) + 12px)' }}
    >
      <ul className="flex h-[var(--nav-height)] items-center justify-around rounded-[24px] bg-surface/95 px-2 shadow-raised ring-1 ring-line/60 backdrop-blur-md">
        {items.map((it) => (
          <li key={it.to} className="flex-1">
            <NavLink
              to={it.to}
              end={it.to === '/'}
              onClick={() => haptic.select()}
              className={({ isActive }) =>
                clsx(
                  'mx-auto flex h-14 w-full max-w-[84px] flex-col items-center justify-center gap-0.5 rounded-[18px] text-micro font-semibold transition-colors',
                  isActive ? 'bg-primary-50 text-primary' : 'text-muted hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={it.icon} size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                  {it.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
