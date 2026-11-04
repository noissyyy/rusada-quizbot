import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { Flag, langCode } from '../brand/Flag';
import { Avatar, Icon } from '../ui';

export function HomeHeader({ unread, firstName, fullName, photoUrl }: { unread: number; firstName: string; fullName: string; photoUrl?: string | null }) {
  const { lang, t } = useI18n();
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={fullName} src={photoUrl} size={44} />
        <h1 className="truncate font-display text-[20px] font-bold leading-[24px] tracking-tight">{t('home.greeting', { name: firstName })}</h1>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link to="/language" aria-label={`${t('lang.title')}: ${langCode[lang]}`}
          className="flex h-11 items-center gap-1.5 rounded-full bg-surface pl-1.5 pr-2.5 text-caption font-bold text-ink shadow-card">
          <Flag lang={lang} size={30} rounded={15} showScript={false} />
          {langCode[lang]}
        </Link>
        <Link to="/notifications" aria-label={unread ? `${t('notifications')}: ${unread}` : t('notifications')}
          className="relative grid size-11 place-items-center rounded-full bg-surface text-ink shadow-card">
          <Icon name="bell" size={22} />
          {unread > 0 && <span className="absolute right-[11px] top-2.5 size-2 rounded-full bg-brand ring-2 ring-surface" />}
        </Link>
      </div>
    </header>
  );
}
