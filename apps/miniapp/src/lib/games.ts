import type { GradientTone } from '../components/ui';
import type { MessageKey } from './i18n/dict';

/** Every game in the app. Adding a game = one entry here + its screen and route. */
export interface GameInfo {
  key: string;
  to: string;
  img: string;
  tone: GradientTone;
  title: MessageKey;
  short: MessageKey;
  long: MessageKey;
  kind: 'solo' | 'friend' | 'practice';
  badge?: MessageKey;
}

export const GAMES: GameInfo[] = [
  { key: 'duel', to: '/games/duel', img: 'M02', tone: 'primary', title: 'games.duel', short: 'games.duelShort', long: 'games.duelText', kind: 'friend', badge: 'games.badgeNew' },
  { key: 'word', to: '/games/word', img: 'T07', tone: 'teal', title: 'games.word', short: 'games.wordShort', long: 'games.wordText', kind: 'solo', badge: 'games.badgeDaily' },
  { key: 'stress', to: '/games/stress', img: 'T14', tone: 'peach', title: 'games.stress', short: 'games.stressShort', long: 'games.stressText', kind: 'solo', badge: 'games.badge60' },
  { key: 'wordsearch', to: '/games/search', img: 'T12', tone: 'indigo', title: 'games.search', short: 'games.searchShort', long: 'games.searchText', kind: 'solo', badge: 'games.badgeNew' },
  { key: 'memory', to: '/games/memory', img: 'T16', tone: 'orange', title: 'games.memory', short: 'games.memoryShort', long: 'games.memoryText', kind: 'solo', badge: 'games.badgeNew' },
  { key: 'morph', to: '/games/morph', img: 'T13', tone: 'violet', title: 'games.morph', short: 'games.morphShort', long: 'games.morphText', kind: 'solo', badge: 'games.badgeNew' },
  { key: 'grammar', to: '/games/grammar', img: 'T10', tone: 'mint', title: 'games.grammar', short: 'games.grammarShort', long: 'games.grammarText', kind: 'solo', badge: 'games.badgeNew' },
  { key: 'review', to: '/mistakes', img: 'T15', tone: 'pink', title: 'games.review', short: 'games.reviewShort', long: 'games.reviewText', kind: 'practice' },
];
