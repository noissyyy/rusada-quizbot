import type { TopicColor } from '@rq/shared-types';

/** Raw hex values mirrored from tokens.css for SVG illustrations (which can't read Tailwind classes). */
export const palette: Record<TopicColor, { bg: string; fg: string; deep: string }> = {
  blue: { bg: '#E6F0FF', fg: '#2678F5', deep: '#1553B8' },
  violet: { bg: '#EFEAFE', fg: '#7C5CFA', deep: '#5B3FD6' },
  mint: { bg: '#E3F7EF', fg: '#16A37A', deep: '#0E7A5B' },
  peach: { bg: '#FFEEE3', fg: '#F07A3A', deep: '#C9561A' },
  pink: { bg: '#FDE8F1', fg: '#E2508C', deep: '#B8326A' },
  yellow: { bg: '#FFF5D9', fg: '#D99A06', deep: '#A87400' },
};

/** Static class maps — Tailwind needs full class names present in source. */
export const topicClasses: Record<TopicColor, { bg: string; fg: string; fill: string }> = {
  blue: { bg: 'bg-blue-bg', fg: 'text-blue-fg', fill: 'bg-blue-fg' },
  violet: { bg: 'bg-violet-bg', fg: 'text-violet-fg', fill: 'bg-violet-fg' },
  mint: { bg: 'bg-mint-bg', fg: 'text-mint-fg', fill: 'bg-mint-fg' },
  peach: { bg: 'bg-peach-bg', fg: 'text-peach-fg', fill: 'bg-peach-fg' },
  pink: { bg: 'bg-pink-bg', fg: 'text-pink-fg', fill: 'bg-pink-fg' },
  yellow: { bg: 'bg-yellow-bg', fg: 'text-yellow-fg', fill: 'bg-yellow-fg' },
};
