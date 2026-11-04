import type {
  AnswerResult, AppNotification, GroupAssignmentView, GroupResultView, HomeFeed, LiveListItem, LiveState, Profile,
  Rating, RatingKind, RatingPeriod, SessionResult, SessionStart, SettingsPatch, TestSummary, TopicSummary, TopicTest,
  UserProfile,
} from '@rq/shared-types';

/**
 * API boundary. Screens depend on this interface only: `httpApi` talks to the
 * FastAPI backend (Authorization: tma <initData>), `mockApi` is an in-memory
 * stand-in for tests and design review. The server owns timing and the answer
 * key — the client never sees correct answers before submitting.
 */
export interface QuizApi {
  getHomeFeed(): Promise<HomeFeed>;
  getTopics(): Promise<TopicSummary[]>;
  getTopic(slug: string): Promise<{ topic: TopicSummary; tests: TopicTest[] }>;
  searchTests(q: string): Promise<TestSummary[]>;
  getTest(id: string): Promise<TopicTest>;
  /** starts a test or resumes the unfinished attempt of it */
  startSession(target: { quizId?: string; assignmentId?: string }): Promise<SessionStart>;
  submitAnswer(sessionId: string, questionId: string, optionId: string | null): Promise<AnswerResult>;
  finishSession(sessionId: string, opts: { usedSec: number; timedOut: boolean }): Promise<SessionResult>;
  getResult(sessionId: string): Promise<SessionResult>;

  getRating(kind: RatingKind, period: RatingPeriod): Promise<Rating>;
  getProfile(): Promise<Profile>;
  updateSettings(patch: SettingsPatch): Promise<UserProfile>;
  getNotifications(): Promise<AppNotification[]>;
  readAllNotifications(): Promise<void>;

  getGroupAssignment(id: string): Promise<GroupAssignmentView>;
  getGroupResult(id: string): Promise<GroupResultView>;
  shareGroupResult(id: string): Promise<void>;

  listLive(): Promise<LiveListItem[]>;
  joinLive(code: string): Promise<LiveState>;
  getLive(id: string): Promise<LiveState>;
  liveReady(id: string): Promise<LiveState>;
  liveAnswer(id: string, index: number, optionId: string): Promise<LiveState>;
  /** realtime updates; returns an unsubscribe function */
  subscribeLive(id: string, onState: (s: LiveState) => void): () => void;
}

/** Error with the server's machine-readable `detail` (e.g. "already_taken"). */
export class ApiError extends Error {
  constructor(public status: number, public detail: string) { super(detail); }
}

/** Network is down / server unreachable (drives the "Нет соединения" screen). */
export class OfflineError extends Error {
  constructor() { super('offline'); }
}

let impl: QuizApi | null = null;
export function setApi(api: QuizApi) { impl = api; }
export function api(): QuizApi {
  if (!impl) throw new Error('QuizApi not configured — call setApi() in main.tsx');
  return impl;
}
