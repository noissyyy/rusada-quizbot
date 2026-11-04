import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';

/** Thin banner while the device is offline; answers already sent are safe on the server. */
export function OfflineBanner() {
  const { t } = useI18n();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (online) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[60] mx-auto max-w-[480px] bg-night px-4 py-2 text-center text-caption font-bold text-white" style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}>
      {t('offline.title')} · {t('offline.text')}
    </div>
  );
}
