/**
 * Contract types shared between Mini App, Admin and (mirrored) FastAPI schemas.
 * Client-facing question types NEVER contain the correct answer: it is only
 * delivered in a reveal/feedback payload after the server evaluates a submission.
 */

export type ID = string;
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuizMode = 'individual' | 'live' | 'group';
export type TopicColor = 'blue' | 'violet' | 'mint' | 'peach' | 'pink' | 'yellow';
export type TopicIllustration =
  | 'morphology' | 'orthography' | 'syntax' | 'punctuation' | 'lexicon' | 'phonetics';

export interface UserProfile {
  id: ID;
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

export interface TopicSummary {
  id: ID;
  slug: string;
  title: string;
  description: string;
  color: TopicColor;
  illustration: TopicIllustration;
  testsCount: number;
  questionsCount: number;
  /** 0..100, computed server-side from the user's completed tests */
  progress: number;
}

export interface InProgressAttempt {
  sessionId: ID;
  quizId: ID;
  quizTitle: string;
  topicTitle: string;
  topicColor: TopicColor;
  answered: number;
  total: number;
}

export interface QuizModeInfo {
  mode: QuizMode;
  title: string;
  description: string;
  /** e.g. number of currently open live sessions */
  badge?: string;
}

export interface HomeFeed {
  user: UserProfile;
  unreadNotifications: number;
  continueAttempt: InProgressAttempt | null;
  modes: QuizModeInfo[];
  featuredTopics: TopicSummary[];
}
