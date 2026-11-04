import { useId } from 'react';
import type { TopicIllustration as Kind, TopicColor } from '@rq/shared-types';
import { palette } from '../../styles/palette';

/**
 * Vector "soft 3D" topic illustrations: gradients + inner highlight + soft ground shadow.
 * PLACEHOLDER ART — swap for the approved 3D renders (WebP/SVG) by replacing the
 * branch for a given `kind`; component API stays the same.
 */
interface Props {
  kind: Kind;
  color: TopicColor;
  size?: number;
  className?: string;
}

export function TopicIllustration({ kind, color, size = 72, className }: Props) {
  const uid = useId().replace(/:/g, '');
  const c = palette[color];
  const g = (n: string) => `${n}-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={g('main')} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={c.fg} stopOpacity="0.75" />
          <stop offset="1" stopColor={c.deep} />
        </linearGradient>
        <linearGradient id={g('light')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor={c.bg} />
        </linearGradient>
        <radialGradient id={g('shine')} cx="0.3" cy="0.25" r="0.6">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <filter id={g('blur')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <ellipse cx="60" cy="104" rx="34" ry="6" fill={c.deep} opacity="0.18" filter={`url(#${g('blur')})`} />
      {renderKind(kind, g, c)}
    </svg>
  );
}

function renderKind(kind: Kind, g: (n: string) => string, c: { fg: string; deep: string; bg: string }) {
  const main = `url(#${g('main')})`;
  const light = `url(#${g('light')})`;
  const shine = `url(#${g('shine')})`;
  switch (kind) {
    case 'morphology': // open book
      return (
        <g>
          <path d="M16 34c14-6 30-6 44 4v58c-14-9-30-9-44-3z" fill={main} />
          <path d="M104 34c-14-6-30-6-44 4v58c14-9 30-9 44-3z" fill={main} />
          <path d="M20 30c13-5 27-4 40 5v55c-13-8-27-9-40-4z" fill={light} />
          <path d="M100 30c-13-5-27-4-40 5v55c13-8 27-9 40-4z" fill={light} />
          <path d="M29 46h20M29 55h22M29 64h16M71 46h20M69 55h22M75 64h16" stroke={c.fg} strokeOpacity="0.45" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="57" y="34" width="6" height="58" rx="3" fill={c.deep} opacity="0.35" />
        </g>
      );
    case 'orthography': // pencil
      return (
        <g transform="rotate(-38 60 60)">
          <rect x="48" y="14" width="24" height="66" rx="5" fill={main} />
          <rect x="48" y="14" width="10" height="66" rx="5" fill={shine} />
          <rect x="48" y="12" width="24" height="12" rx="5" fill="#F9A8C9" />
          <rect x="48" y="22" width="24" height="5" fill="#E4E8EF" />
          <path d="M48 80h24l-12 22z" fill="#F6D7A7" />
          <path d="M55.5 94h9L60 102z" fill={c.deep} />
        </g>
      );
    case 'syntax': // linked blocks
      return (
        <g>
          <rect x="14" y="26" width="46" height="30" rx="10" fill={main} />
          <rect x="60" y="64" width="46" height="30" rx="10" fill={main} />
          <rect x="14" y="26" width="46" height="30" rx="10" fill={shine} />
          <rect x="60" y="64" width="46" height="30" rx="10" fill={shine} />
          <path d="M48 56v8a8 8 0 0 0 8 8h4" stroke={c.deep} strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="66" y="22" width="36" height="24" rx="8" fill={light} />
          <path d="M24 41h26M70 79h26M74 34h20" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
          <path d="M74 34h20" stroke={c.fg} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
        </g>
      );
    case 'punctuation': // comma + dot
      return (
        <g>
          <circle cx="46" cy="50" r="24" fill={main} />
          <path d="M60 64c0 18-10 30-26 34 8-8 11-16 10-24z" fill={main} />
          <circle cx="46" cy="50" r="24" fill={shine} />
          <circle cx="90" cy="82" r="12" fill={main} />
          <circle cx="90" cy="82" r="12" fill={shine} />
          <circle cx="92" cy="40" r="7" fill={light} />
        </g>
      );
    case 'lexicon': // speech bubbles
      return (
        <g>
          <path d="M14 30a12 12 0 0 1 12-12h44a12 12 0 0 1 12 12v24a12 12 0 0 1-12 12H40l-14 12v-12a12 12 0 0 1-12-12z" fill={main} />
          <path d="M14 30a12 12 0 0 1 12-12h44a12 12 0 0 1 12 12v24a12 12 0 0 1-12 12H40l-14 12v-12a12 12 0 0 1-12-12z" fill={shine} />
          <text x="48" y="51" textAnchor="middle" fontSize="22" fontWeight="800" fill="#fff" fontFamily="Onest Variable, sans-serif">Аа</text>
          <path d="M54 62a10 10 0 0 1 10-10h32a10 10 0 0 1 10 10v16a10 10 0 0 1-10 10v10l-12-10H64a10 10 0 0 1-10-10z" fill={light} />
          <path d="M66 66h28M66 75h18" stroke={c.fg} strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    case 'phonetics': // sound bars in a disc
      return (
        <g>
          <circle cx="60" cy="56" r="40" fill={main} />
          <circle cx="60" cy="56" r="40" fill={shine} />
          {[[34, 14], [46, 24], [58, 34], [70, 22], [82, 12]].map(([x, h]) => (
            <rect key={x} x={x! - 4} y={56 - h!} width="8" height={h! * 2} rx="4" fill="#fff" opacity="0.95" />
          ))}
        </g>
      );
  }
}
