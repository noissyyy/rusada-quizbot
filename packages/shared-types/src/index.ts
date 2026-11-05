/**
 * Contract types shared between Mini App, Admin and (mirrored) FastAPI schemas.
 * Client-facing question types never contain the correct answer: it arrives
 * only in the server's reveal payload after a submission is evaluated.
 */

export type ID = string;
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuizMode = 'individual' | 'live' | 'group';
export const TOPIC_COLORS = ['blue', 'violet', 'mint', 'peach', 'pink', 'yellow', 'sky', 'indigo', 'lavender', 'plum', 'rose', 'coral', 'orange', 'sand', 'lime', 'green', 'teal', 'olive', 'slate', 'gray'] as const;
export type TopicColor = (typeof TOPIC_COLORS)[number];

export type Role = 'student' | 'host' | 'admin' | 'superadmin';

export interface UserProfile {
  id: ID;
  telegramId: number;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
  languageCode?: string | null;
  /** UI language chosen in the app */
  lang?: 'uz' | 'uz-cyrl' | 'ru' | null;
  role?: Role;
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
  quizId: ID;
  quizTitle: string;
  answered: number;
  total: number;
  /** server-computed; the test timer keeps running while the app is closed */
  remainingSeconds: number;
}

export interface HomeFeed {
  user: UserProfile;
  unreadNotifications: number;
  quickStart: QuickStart | null;
  continueAttempt: InProgressAttempt | null;
  popularTests: TestSummary[];
  /** number of live sessions open right now; 0 hides the LIVE badge */
  liveNow: number;
  /** questions in published tests; the start card shows it rounded down (3549 → «3 000+») */
  questionsTotal: number;
  /** «Xatolarim»: questions to repeat today */
  reviewDue?: number;
}

/** «Xatolarim»: mistakes repeated at growing intervals (1 → 3 → 7 → 14 days → mastered). */
export interface ReviewDeck {
  due: number;
  learning: number;
  mastered: number;
  questions: QuestionPublic[];
}

export interface ReviewAnswer {
  correct: boolean;
  correctOptionId: ID | null;
  explanation: string | null;
  box: number;
  mastered: boolean;
  nextDueAt: string;
}

/* ---------- Topics & tests ---------- */

export interface TopicSummary {
  id: ID;
  slug: string;
  title: string;          // content: Russian
  color: TopicColor;
  illustration: string;
  testsCount: number;
  questionsCount: number;
  /** 0..100 */
  progress: number;
  difficulties: Difficulty[];
  /** short description shown on the topic page */
  description?: string;
  /** subtopics that have published tests (filter chips) */
  subtopics?: { id: ID; title: string }[];
  /** default: tests list; works: a shelf of literary works, tests inside each */
  layout?: 'default' | 'works';
  works?: Work[];
}

/** A literary work in a «works» section (technically a subtopic with an author and a cover). */
export interface Work {
  id: ID;
  title: string;
  author: string;
  coverUrl: string | null;
  testsCount: number;
}

export type TestStatus =
  | { kind: 'new'; answered?: null; bestPercent?: null }
  | { kind: 'in_progress'; answered: number; bestPercent?: null }
  | { kind: 'done'; bestPercent: number; answered?: null };

export interface TopicTest extends TestSummary {
  description: string;
  maxPoints: number;
  status: TestStatus;
  /** subtopics covered by the test's questions */
  subtopicIds?: ID[];
  /** «works» sections: the work this test belongs to */
  workId?: ID | null;
}

/* ---------- Quiz session (server-authoritative) ---------- */

export interface QuestionPublic {
  id: ID;
  text: string;
  points: number;
  imageUrl?: string | null;
  options: { id: ID; label: 'A' | 'B' | 'C' | 'D'; text: string }[];
  // NOTE: no correct answer here — it is revealed only in AnswerResult
}

export interface SessionStart {
  sessionId: ID;
  quizId: ID;
  quizTitle: string;
  topicTitle: string;
  /** one timer for the whole test */
  durationSec: number;
  /** seconds left on the server clock (equals durationSec for a fresh start) */
  remainingSec: number;
  questions: QuestionPublic[];
  /** answers already given when an unfinished attempt is resumed */
  answered: AnswerResult[];
  /** how long the answer is shown (the test timer is paused meanwhile) */
  feedbackMs: number;
  feedbackExplainMs: number;
}

export type AnswerOutcome = 'correct' | 'wrong' | 'unanswered';

export interface AnswerResult {
  questionId: ID;
  outcome: AnswerOutcome;
  chosenOptionId: ID | null;
  correctOptionId: ID;
  pointsAwarded: number;
  explanation?: string | null;
}

export interface SessionResult {
  sessionId: ID;
  quizId: ID | null;
  quizTitle: string;
  mode: 'individual' | 'group';
  assignmentId?: ID | null;
  maxPoints: number;
  points: number;
  correct: number;
  wrong: number;
  unanswered: number;
  usedSec: number;
  timedOut: boolean;
  bestPoints: number;
  review: (AnswerResult & { questionText: string; chosenText?: string | null; correctText: string })[];
}

/* ---------- Rating, profile, notifications ---------- */

export type RatingKind = 'individual' | 'live' | 'group';
export type RatingPeriod = 'week' | 'month' | 'all';

export interface RatingEntry { rank: number; userId: ID; name: string; photoUrl?: string | null; points: number; me: boolean }
export interface Rating { kind: RatingKind; period: RatingPeriod; entries: RatingEntry[]; me: RatingEntry | null }

export interface HistoryItem {
  kind: 'individual' | 'group' | 'live';
  id: ID;
  title: string;
  subtitle: string;
  color: TopicColor | 'ink';
  points: number;
  maxPoints?: number | null;
  rank?: number | null;
  participants?: number | null;
  at: string;
}

export interface Profile {
  user: UserProfile;
  memberSince: string;
  tests: number;
  accuracy: number;
  points: number;
  history: HistoryItem[];
  notifyLive: boolean;
  haptics: boolean;
}

export interface SettingsPatch { lang?: 'uz' | 'uz-cyrl' | 'ru'; notifyLive?: boolean; haptics?: boolean }

export interface AppNotification {
  id: ID;
  kind: 'live' | 'group' | 'rating' | 'new_tests' | 'system';
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  read: boolean;
}

/* ---------- Group mode ---------- */

export interface GroupBoardEntry { rank: number; name: string; points: number; me: boolean }

export interface Book {
  id: ID;
  title: string;
  author: string;
  description: string;
  price: string;
  link: string;
  coverUrl: string | null;
  /** 0 = no PDF, nothing to read in the app */
  pages: number;
}

/** What this person may do: everyone (open), staff, a Rusada student, a subscriber — or nothing (paywall). */
export interface AccessInfo {
  telegramId: number;
  username: string | null;
  hasAccess: boolean;
  reason: 'staff' | 'open' | 'member' | 'subscription' | null;
  mode: 'open' | 'closed';
  subscriptionEndsAt: string | null;
  priceUzs: number;
  days: number;
  cardNumber: string;
  cardHolder: string;
  note: string;
  supportUsername: string;
  pending: { id: ID; createdAt: string } | null;
  rejectedComment: string | null;
  /** trial: the app works with limits — a few new tests, the first pages of books; live and group tests locked */
  trial: boolean;
  trialTestsLeft: number;
  trialTests: number;
  trialPages: number;
  /** real counts for the subscription page */
  questionsCount: number;
  booksCount: number;
}

export interface GroupHubItem {
  id: ID;
  groupTitle: string;
  quizTitle: string;
  questionsCount: number;
  durationMinutes: number;
  closesAt: string | null;
  passed: number;
  myStatus: string | null;
}

export interface GroupAssignmentView {
  id: ID;
  access: 'ok' | 'not_member' | 'closed' | 'unknown';
  groupTitle: string;
  groupLink: string | null;
  quizId: ID;
  quizTitle: string;
  authorName: string | null;
  questionsCount: number;
  durationMinutes: number;
  closesAt: string | null;
  passed: number;
  members: number;
  previewNames: string[];
  leaderboard: GroupBoardEntry[];
  mySessionId: ID | null;
  myStatus: string | null;
}

export interface GroupResultView {
  assignmentId: ID;
  groupTitle: string;
  quizTitle: string;
  sessionId: ID;
  rank: number;
  passed: number;
  points: number;
  closesAt: string | null;
  remainingMembers: number;
  leaderboard: GroupBoardEntry[];
}

/* ---------- Live mode ---------- */

export interface LivePlayer { userId: ID; name: string; photoUrl?: string | null; ready: boolean; me: boolean }
export interface LiveBoardEntry { rank: number; userId: ID; name: string; points: number; delta: number; me: boolean }
export interface LiveReveal {
  correctOptionId: ID;
  correctText: string;
  explanation: string | null;
  correctCount: number;
  myOutcome: AnswerOutcome;
  myPoints: number;
  distribution?: Record<ID, number> | null;
}
export interface LiveState {
  id: ID;
  code: string;
  title: string;
  hostName: string | null;
  state: 'lobby' | 'question' | 'reveal' | 'finished';
  index: number;
  questionsCount: number;
  questionSec: number;
  remainingMs: number;
  paused: boolean;
  question: QuestionPublic | null;
  myAnswer: ID | null;
  answeredCount: number;
  participantsCount: number;
  readyCount: number;
  players: LivePlayer[];
  reveal: LiveReveal | null;
  leaderboard: LiveBoardEntry[];
  meEntry: LiveBoardEntry | null;
  final: { rank: number; total: number; points: number; correct: number } | null;
  revealMs: number;
  /** host view only: user ids with an open connection */
  online?: ID[];
}
export interface LiveListItem { id: ID; code: string; title: string; hostName: string | null; state: string; participants: number }
