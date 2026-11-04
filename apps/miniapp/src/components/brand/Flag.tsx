import type { Lang } from '../../lib/i18n';

/**
 * Language flags. Both Uzbek variants share a flag, so the script is shown as a
 * small badge (O‘z / Ўз) — otherwise the two options are indistinguishable.
 */
export function Flag({ lang, size = 52, rounded = 16, showScript = true }: { lang: Lang; size?: number; rounded?: number; showScript?: boolean }) {
  const label = lang === 'ru' ? 'Флаг России' : 'Флаг Узбекистана';
  return (
    <span className="relative inline-block shrink-0 overflow-hidden shadow-[inset_0_0_0_1px_rgba(26,21,48,.08)]" style={{ width: size, height: size, borderRadius: rounded }}>
      <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={label}>
        {lang === 'ru' ? (
          <>
            <rect width="48" height="16" fill="#FFFFFF" />
            <rect y="16" width="48" height="16" fill="#0039A6" />
            <rect y="32" width="48" height="16" fill="#D52B1E" />
          </>
        ) : (
          <>
            <rect width="48" height="16" fill="#0099B5" />
            <rect y="16" width="48" height="1.5" fill="#CE1126" />
            <rect y="17.5" width="48" height="13" fill="#FFFFFF" />
            <rect y="30.5" width="48" height="1.5" fill="#CE1126" />
            <rect y="32" width="48" height="16" fill="#1EB53A" />
            <circle cx="10" cy="8" r="5" fill="#FFFFFF" />
            <circle cx="12" cy="8" r="4.3" fill="#0099B5" />
            {[[18, 5], [21.5, 5], [25, 5], [21.5, 9], [25, 9]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="#FFFFFF" />)}
          </>
        )}
      </svg>
      {showScript && lang !== 'ru' && (
        <span aria-hidden className="absolute bottom-[3px] right-[3px] rounded-[6px] bg-night px-[5px] py-px text-[9px] font-extrabold text-white">
          {lang === 'uz' ? 'O‘z' : 'Ўз'}
        </span>
      )}
    </span>
  );
}

export const langCode: Record<Lang, string> = { uz: 'UZ', 'uz-cyrl': 'ЎЗ', ru: 'RU' };
