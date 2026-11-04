import type { SVGProps } from 'react';

/** Single-stroke 24px icon set (1.8px stroke, round caps). Add icons here, never inline ad-hoc SVGs in screens. */
const paths = {
  book: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7h6" />
    </>
  ),
  home: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5.5a.5.5 0 0 0-.5.5C5 9 6.5 10.5 8.3 10.8M16 6h2.5a.5.5 0 0 1 .5.5c0 2.5-1.5 4-3.3 4.3" />
      <path d="M12 13v3.5M8.5 20h7M9.5 20l.6-3.5h3.8l.6 3.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c.8-3.6 3.8-5.8 7.5-5.8s6.7 2.2 7.5 5.8" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="9" r="3.3" />
      <path d="M3 19c.6-3 3-4.8 6-4.8s5.4 1.8 6 4.8" />
      <path d="M15.5 5.9a3.2 3.2 0 0 1 0 6.2M17.5 14.6c1.8.6 3 2.1 3.5 4.4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  broadcast: (
    <>
      <circle cx="12" cy="12" r="2.2" />
      <path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 5.4a9.3 9.3 0 0 0 0 13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2" />
    </>
  ),
  chevronRight: <path d="m10 6 6 6-6 6" />,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.2l2.8 1.8" />
    </>
  ),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>),
  share: <path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  x: <path d="M7 7l10 10M17 7 7 17" />,
  hourglass: <path d="M7 4h10M7 20h10M8 4c0 5 8 5 8 8s-8 3-8 8M16 4c0 5-8 5-8 8s8 3 8 8" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  stopwatch: (<><circle cx="12" cy="13" r="7.5" /><path d="M12 9.5V13l2.5 1.5M10 3h4" /></>),
  pause: (<><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" stroke="none" /></>),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  sparkle: <path d="M12 3.5c.5 4.3 2.2 6 6.5 6.5-4.3.5-6 2.2-6.5 6.5-.5-4.3-2.2-6-6.5-6.5 4.3-.5 6-2.2 6.5-6.5z" />,
  globe: (<><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16" /></>),
  question: (<><circle cx="12" cy="12" r="8" /><path d="M9.8 9.5a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.4v.5M12 16.5h.01" /></>),
  copy: (<><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" /></>),
  lock: (<><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  send: <path d="M20 4 3.5 10.6l6.4 2.5L20 4zm0 0-6.9 16-3.2-6.9" />,
  image: (<><rect x="4" y="5" width="16" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m5 17 4.5-4.5 3 3 2.5-2.5L19 17" /></>),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.5 6.8M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.3-1.3" />,
  upload: <path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />,
} as const;

export type IconName = keyof typeof paths;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  filled?: boolean;
}

export function Icon({ name, size = 24, filled = false, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
