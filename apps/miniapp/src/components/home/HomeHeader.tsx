import type { UserProfile } from '@rq/shared-types';
import { Avatar, IconButton } from '../ui';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-[12px] bg-primary text-[15px] font-extrabold tracking-tight text-white shadow-primary">
        Rq
      </span>
      <span className="text-[17px] font-bold tracking-tight text-ink">
        Russian <span className="text-primary">Quiz</span>
      </span>
    </div>
  );
}

export function HomeHeader({ user, unread }: { user: UserProfile; unread: number }) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return (
    <header className="space-y-5">
      <div className="flex items-center justify-between">
        <Logo />
        <IconButton icon="bell" label={unread ? `Уведомления: ${unread} новых` : 'Уведомления'} dot={unread > 0} />
      </div>
      <div className="flex items-center gap-3">
        <Avatar name={fullName} src={user.photoUrl} size={48} />
        <div className="min-w-0">
          <p className="truncate text-title font-bold text-ink">Привет, {user.firstName}!</p>
          <p className="text-caption text-muted">Готов проверить свои знания?</p>
        </div>
      </div>
    </header>
  );
}
