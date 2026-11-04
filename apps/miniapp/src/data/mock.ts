import type { HomeFeed, TopicSummary } from '@rq/shared-types';
import { getWebApp } from '../lib/telegram/webapp';
import type { QuizApi } from './api';

/** MOCK DATA — dev/demo only. Never shown as real metrics. */
export const mockTopics: TopicSummary[] = [
  { id: 't1', slug: 'morphology', title: 'Морфология', description: 'Части речи и их формы', color: 'blue', illustration: 'morphology', testsCount: 12, questionsCount: 180, progress: 45 },
  { id: 't2', slug: 'orthography', title: 'Орфография', description: 'Правописание слов', color: 'violet', illustration: 'orthography', testsCount: 15, questionsCount: 240, progress: 20 },
  { id: 't3', slug: 'syntax', title: 'Синтаксис', description: 'Словосочетания и предложения', color: 'mint', illustration: 'syntax', testsCount: 9, questionsCount: 135, progress: 70 },
  { id: 't4', slug: 'punctuation', title: 'Пунктуация', description: 'Знаки препинания', color: 'peach', illustration: 'punctuation', testsCount: 10, questionsCount: 150, progress: 0 },
  { id: 't5', slug: 'lexicon', title: 'Лексика', description: 'Значение и употребление слов', color: 'pink', illustration: 'lexicon', testsCount: 8, questionsCount: 120, progress: 10 },
  { id: 't6', slug: 'phonetics', title: 'Фонетика', description: 'Звуки и ударение', color: 'yellow', illustration: 'phonetics', testsCount: 6, questionsCount: 90, progress: 0 },
];

export const mockApi: QuizApi = {
  async getHomeFeed(): Promise<HomeFeed> {
    await new Promise((r) => setTimeout(r, 250));
    const tg = getWebApp()?.initDataUnsafe.user; // display only
    return {
      user: tg
        ? { id: String(tg.id), telegramId: tg.id, firstName: tg.first_name, lastName: tg.last_name, username: tg.username, photoUrl: tg.photo_url }
        : { id: 'dev', telegramId: 0, firstName: 'Алексей', lastName: 'Иванов' },
      unreadNotifications: 2,
      continueAttempt: {
        sessionId: 's-42', quizId: 'q-7', quizTitle: 'Имя существительное', topicTitle: 'Морфология',
        topicColor: 'blue', answered: 6, total: 15,
      },
      modes: [
        { mode: 'individual', title: 'Индивидуальный тест', description: 'Проходи в своём темпе' },
        { mode: 'live', title: 'Прямой эфир', description: 'Соревнуйся в реальном времени', badge: 'LIVE' },
        { mode: 'group', title: 'Тест в группе', description: 'Играй с друзьями в Telegram' },
      ],
      featuredTopics: mockTopics.slice(0, 4),
    };
  },
};
