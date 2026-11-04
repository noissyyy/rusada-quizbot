import type { AnswerResult, HomeFeed, SessionResult, SessionStart, TopicSummary, TopicTest } from '@rq/shared-types';

/**
 * API boundary. Screens depend on this interface only; the mock is swapped for
 * the FastAPI client (Authorization: tma <initData>) in the backend phase.
 * The server owns timing and the answer key — the client never sees correct
 * answers before submitting.
 */
export interface QuizApi {
  getHomeFeed(): Promise<HomeFeed>;
  getTopics(): Promise<TopicSummary[]>;
  getTopic(slug: string): Promise<{ topic: TopicSummary; tests: TopicTest[] }>;
  getTest(id: string): Promise<TopicTest>;
  startSession(quizId: string): Promise<SessionStart>;
  submitAnswer(sessionId: string, questionId: string, optionId: string | null): Promise<AnswerResult>;
  finishSession(sessionId: string, opts: { usedSec: number; timedOut: boolean }): Promise<SessionResult>;
  getResult(sessionId: string): Promise<SessionResult>;
}

let impl: QuizApi | null = null;
export function setApi(api: QuizApi) { impl = api; }
export function api(): QuizApi {
  if (!impl) throw new Error('QuizApi not configured — call setApi() in main.tsx');
  return impl;
}
