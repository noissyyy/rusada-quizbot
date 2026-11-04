import type { HomeFeed, TestSummary } from '@rq/shared-types';
import { getWebApp } from '../lib/telegram/webapp';
import type { QuizApi } from './api';
import { server } from './mockServer';

/** MOCK DATA — dev/demo only. Never shown as real metrics. */
export const mockTests: TestSummary[] = [
  { id: 'q-adj', title: 'Имя прилагательное', topicTitle: 'Морфология', topicColor: 'blue', illustration: '/3d/rq-3d-T01.webp', questionsCount: 15, durationMinutes: 6, difficulty: 'medium' },
  { id: 'q-pre', title: 'Приставки ПРЕ- и ПРИ-', topicTitle: 'Орфография', topicColor: 'violet', illustration: '/3d/rq-3d-T02.webp', questionsCount: 12, durationMinutes: 5, difficulty: 'hard' },
  { id: 'q-comma', title: 'Запятые в сложном предложении', topicTitle: 'Пунктуация', topicColor: 'peach', illustration: '/3d/rq-3d-T04.webp', questionsCount: 10, durationMinutes: 5, difficulty: 'medium' },
  { id: 'q-syn', title: 'Синонимы и антонимы', topicTitle: 'Лексика', topicColor: 'pink', illustration: '/3d/rq-3d-T05.webp', questionsCount: 12, durationMinutes: 4, difficulty: 'easy' },
];

export const mockApi: QuizApi = {
  async getHomeFeed(): Promise<HomeFeed> {
    await new Promise((r) => setTimeout(r, 250));
    const tg = getWebApp()?.initDataUnsafe.user; // display only, never trusted
    return {
      user: tg
        ? { id: String(tg.id), telegramId: tg.id, firstName: tg.first_name, lastName: tg.last_name, username: tg.username, photoUrl: tg.photo_url, languageCode: tg.language_code }
        : { id: 'dev', telegramId: 0, firstName: 'Алексей', lastName: 'Иванов' },
      unreadNotifications: 2,
      quickStart: { quizId: 'q-quick', questionsCount: 4, durationMinutes: 2 },
      continueAttempt: { sessionId: 'q-noun', quizTitle: 'Имя существительное', answered: 2, total: 4, remainingSeconds: 112 },
      popularTests: mockTests,
      liveNow: 2,
    };
  },
  getTopics: () => server.topics(),
  getTopic: (slug) => server.topic(slug),
  getTest: (id) => server.test(id),
  startSession: (quizId) => server.start(quizId),
  submitAnswer: (sid, qid, oid) => server.submit(sid, qid, oid),
  finishSession: (sid, opts) => server.finish(sid, opts),
  getResult: (sid) => server.result(sid),
};
