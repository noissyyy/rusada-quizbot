import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { Flag, langCode } from '../brand/Flag';
import { Icon } from '../ui';

export function HomeHeader({ unread }: { unread: number }) {
  const { lang, t } = useI18n();
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <img src="/brand/rusada-uc-square.png" alt="Rusada" className="size-11 rounded-[14px] object-cover" />
        <div className="flex flex-col">
          <span className="font-display text-[20px] font-bold leading-[22px] tracking-tight">Rusada</span>
          <span className="text-micro font-semibold text-muted">QuizBot</span>
        </div>
      </div>
      <div className="flex gap-2">
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
