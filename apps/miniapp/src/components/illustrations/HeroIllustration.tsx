import { useId } from 'react';

/** Hero art: stacked books + «Я» letter cube + trophy star. PLACEHOLDER for approved 3D render. */
export function HeroIllustration({ size = 140, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const u = (n: string) => `url(#${n}-${id})`;
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`b1-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFB86B" /><stop offset="1" stopColor="#F07A3A" /></linearGradient>
        <linearGradient id={`b2-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9D86FF" /><stop offset="1" stopColor="#6A4BEA" /></linearGradient>
        <linearGradient id={`b3-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5EE0B0" /><stop offset="1" stopColor="#16A37A" /></linearGradient>
        <linearGradient id={`cube-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#DCE8FF" /></linearGradient>
        <linearGradient id={`star-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE07A" /><stop offset="1" stopColor="#F5A70B" /></linearGradient>
        <filter id={`sh-${id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <ellipse cx="80" cy="146" rx="52" ry="7" fill="#0B3A8C" opacity="0.35" filter={u('sh')} />
      {/* books */}
      <rect x="28" y="118" width="104" height="22" rx="7" fill={u('b1')} />
      <rect x="28" y="118" width="104" height="6" rx="3" fill="#fff" opacity="0.35" />
      <rect x="38" y="98" width="90" height="22" rx="7" fill={u('b2')} />
      <rect x="38" y="98" width="90" height="6" rx="3" fill="#fff" opacity="0.3" />
      <rect x="32" y="78" width="96" height="22" rx="7" fill={u('b3')} />
      <rect x="32" y="78" width="96" height="6" rx="3" fill="#fff" opacity="0.3" />
      <rect x="112" y="78" width="6" height="62" rx="3" fill="#fff" opacity="0.25" />
      {/* letter cube */}
      <g transform="rotate(-8 74 52)">
        <rect x="46" y="22" width="56" height="56" rx="14" fill={u('cube')} />
        <rect x="46" y="22" width="56" height="56" rx="14" fill="none" stroke="#fff" strokeWidth="2" opacity="0.8" />
        <text x="74" y="63" textAnchor="middle" fontSize="36" fontWeight="800" fill="#2678F5" fontFamily="Onest Variable, sans-serif">Я</text>
      </g>
      {/* star */}
      <path d="M128 18l5.2 10.6 11.7 1.7-8.5 8.2 2 11.6L128 44.6l-10.4 5.5 2-11.6-8.5-8.2 11.7-1.7z" fill={u('star')} />
      <circle cx="22" cy="48" r="5" fill="#fff" opacity="0.7" />
      <circle cx="140" cy="70" r="3.5" fill="#fff" opacity="0.6" />
    </svg>
  );
}
