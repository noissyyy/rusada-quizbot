/**
 * Contract types shared between Mini App, Admin and (mirrored) FastAPI schemas.
 * Client-facing question types never contain the correct answer: it arrives
 * only in the server's reveal payload after a submission is evaluated.
 */

export type ID = string;
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuizMode = 'individual' | 'live' | 'group';
export type TopicColor = 'blue' | 'violet' | 'mint' | 'peach' | 'pink' | 'yellow';

export interface UserProfile {
  id: ID;
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
}

export interface TestSummary {
  id: ID;
  title: string;          // content: always Russian
  topicTitle: string;     // content: always Russian
  topicColor: TopicColor;
  /** public path of the topic's 3D illustration, e.g. /3d/rq-3d-T01.webp */
  illustration: string;
  questionsCount: number;
  /** one timer for the whole test (minutes) */
  durationMinutes: number;
  difficulty: Difficulty;
}

export interface QuickStart {
  quizId: ID;
  questionsCount: number;
  durationMinutes: number;
}

export interface InProgressAttempt {
  sessionId: ID;
  quizTitle: string;
  answered: number;
  total: number;
  /** server-computed; the test timer keeps running while the app is closed */
  remainingSeconds: number;
}

export interface HomeFeed {
  user: UserProfile;
  unreadNotifications: number;
  quickStart: QuickStart;
  continueAttempt: InProgressAttempt | null;
  popularTests: TestSummary[];
  /** number of live sessions open right now; 0 hides the LIVE badge */
  liveNow: number;
}
