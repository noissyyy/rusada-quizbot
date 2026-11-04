/**
 * In-memory stand-in for the backend (tests and design review only).
 * Keeps the answer key on the "server" side of the API boundary so screens are
 * written against the real contract. MOCK DATA — never shown as real metrics.
 */
import type {
  AnswerResult, AppNotification, GroupAssignmentView, GroupResultView, LiveState, Profile, Rating, RatingKind,
  SessionResult, SessionStart, TopicSummary, TopicTest,
} from '@rq/shared-types';

interface QuestionFull { id: string; text: string; points: number; options: [string, string, string, string]; correct: 0 | 1 | 2 | 3; explanation?: string }
interface QuizFull { id: string; title: string; topicSlug: string; durationSec: number; questions: QuestionFull[] }

export const topics: TopicSummary[] = [
  { id: 't1', slug: 'morphology', title: 'Морфология', color: 'blue', illustration: '/3d/rq-3d-T01.webp', testsCount: 12, questionsCount: 180, progress: 45, difficulties: ['easy', 'medium', 'hard'], description: 'Части речи и их формы: от существительного до наречия', subtopics: [{ id: 'st-noun', title: 'Существительное' }, { id: 'st-adj', title: 'Прилагательное' }, { id: 'st-verb', title: 'Глагол' }, { id: 'st-adv', title: 'Наречие' }] },
  { id: 't2', slug: 'orthography', title: 'Орфография', color: 'violet', illustration: '/3d/rq-3d-T02.webp', testsCount: 15, questionsCount: 240, progress: 20, difficulties: ['medium', 'hard'] },
  { id: 't3', slug: 'syntax', title: 'Синтаксис', color: 'mint', illustration: '/3d/rq-3d-T03.webp', testsCount: 9, questionsCount: 135, progress: 70, difficulties: ['medium'] },
  { id: 't4', slug: 'punctuation', title: 'Пунктуация', color: 'peach', illustration: '/3d/rq-3d-T04.webp', testsCount: 10, questionsCount: 150, progress: 0, difficulties: ['medium', 'hard'] },
  { id: 't5', slug: 'lexicon', title: 'Лексика', color: 'pink', illustration: '/3d/rq-3d-T05.webp', testsCount: 8, questionsCount: 120, progress: 10, difficulties: ['easy'] },
  { id: 't6', slug: 'phonetics', title: 'Фонетика', color: 'yellow', illustration: '/3d/rq-3d-T06.webp', testsCount: 6, questionsCount: 90, progress: 0, difficulties: ['easy', 'medium'] },
];

const nounQuiz: QuizFull = {
  id: 'q-noun', title: 'Имя существительное', topicSlug: 'morphology', durationSec: 120,
  questions: [
    { id: 'n1', text: 'Какое из слов является наречием?', points: 100, options: ['Быстрый', 'Быстро', 'Быстрота', 'Ускорить'], correct: 1, explanation: '«Быстро» отвечает на вопрос «как?» и не изменяется — это признаки наречия.' },
    { id: 'n2', text: 'Укажите имя существительное женского рода', points: 100, options: ['Тюль', 'Кофе', 'Мозоль', 'Шампунь'], correct: 2, explanation: '«Мозоль» — женского рода: «больная мозоль». Тюль, кофе и шампунь — мужского.' },
    { id: 'n3', text: 'В каком слове пишется Ь после шипящей?', points: 150, options: ['Луч…', 'Ноч…', 'Врач…', 'Шалаш…'], correct: 1, explanation: 'У существительных женского рода 3-го склонения после шипящих пишется Ь: ночь.' },
    { id: 'n4', text: 'Какое слово — глагол совершенного вида?', points: 150, options: ['Читать', 'Решать', 'Написать', 'Писать'], correct: 2, explanation: '«Написать» отвечает на вопрос «что сделать?» — это совершенный вид.' },
  ],
};
const quizzes: Record<string, QuizFull> = { 'q-noun': nounQuiz, 'q-quick': { ...nounQuiz, id: 'q-quick', title: 'Быстрый тест' } };

const base = { topicTitle: 'Морфология', topicColor: 'blue', illustration: '/3d/rq-3d-T01.webp' } as const;
export const morphTests: TopicTest[] = [
  { ...base, subtopicIds: ['st-noun'], id: 'q-noun', title: 'Имя существительное', questionsCount: 4, durationMinutes: 2, difficulty: 'easy', description: 'Род, число и падеж существительных, мягкий знак после шипящих.', maxPoints: 500, status: { kind: 'in_progress', answered: 2 } },
  { ...base, subtopicIds: ['st-adj'], id: 'q-adj', title: 'Имя прилагательное', questionsCount: 15, durationMinutes: 6, difficulty: 'medium', description: 'Разряды прилагательных, краткая и полная форма, степени сравнения и правописание суффиксов.', maxPoints: 1500, status: { kind: 'done', bestPercent: 80 } },
  { ...base, subtopicIds: ['st-verb'], id: 'q-verb', title: 'Глагол: вид и время', questionsCount: 20, durationMinutes: 9, difficulty: 'hard', description: 'Совершенный и несовершенный вид, времена и спряжение глаголов.', maxPoints: 2400, status: { kind: 'new' } },
  { ...base, subtopicIds: ['st-adv'], id: 'q-adv', title: 'Наречие', questionsCount: 12, durationMinutes: 5, difficulty: 'medium', description: 'Разряды наречий и их правописание.', maxPoints: 1200, status: { kind: 'new' } },
];

interface Session { quiz: QuizFull; answers: Map<string, AnswerResult>; assignmentId?: string; finished?: SessionResult }
const sessions = new Map<string, Session>();
let seq = 0;
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const LABELS = ['A', 'B', 'C', 'D'] as const;
const optionId = (q: QuestionFull, i: number) => `${q.id}-${i}`;
const publicQ = (q: QuestionFull) => ({ id: q.id, text: q.text, points: q.points, options: q.options.map((text, i) => ({ id: optionId(q, i), label: LABELS[i]!, text })) });

const names = ['Мадина Р.', 'Тимур А.', 'Ольга С.', 'Джасур К.', 'Анна В.', 'Шахзода Н.'];
const pts = [4820, 4610, 4390, 3950, 3720, 3410];

export const server = {
  async topics() { await wait(); return topics; },
  async topic(slug: string) {
    await wait();
    const topic = topics.find((t) => t.slug === slug) ?? topics[0]!;
    return { topic, tests: morphTests.map((t) => ({ ...t, topicTitle: topic.title, topicColor: topic.color, illustration: topic.illustration })) };
  },
  async search(q: string) {
    await wait(120);
    const n = q.trim().toLowerCase();
    return morphTests.filter((t) => !n || t.title.toLowerCase().includes(n) || t.topicTitle.toLowerCase().includes(n));
  },
  async test(id: string) { await wait(); return morphTests.find((t) => t.id === id) ?? morphTests[1]!; },
  async start(target: { quizId?: string; assignmentId?: string }): Promise<SessionStart> {
    await wait();
    const quiz = quizzes[target.quizId ?? 'q-noun'] ?? nounQuiz;
    const sessionId = `s-${++seq}`;
    sessions.set(sessionId, { quiz, answers: new Map(), assignmentId: target.assignmentId });
    return {
      sessionId, quizId: quiz.id, quizTitle: quiz.title, topicTitle: 'Морфология', durationSec: quiz.durationSec, remainingSec: quiz.durationSec,
      questions: quiz.questions.map(publicQ), answered: [], feedbackMs: 3000, feedbackExplainMs: 5000,
    };
  },
  async submit(sessionId: string, questionId: string, chosen: string | null): Promise<AnswerResult> {
    await wait(120);
    const s = sessions.get(sessionId);
    if (!s) throw new Error('Session not found');
    const prev = s.answers.get(questionId);
    if (prev) return prev; // idempotent: a repeated submit never scores twice
    const q = s.quiz.questions.find((x) => x.id === questionId)!;
    const correctOptionId = optionId(q, q.correct);
    const outcome = chosen === null ? 'unanswered' : chosen === correctOptionId ? 'correct' : 'wrong';
    const res: AnswerResult = { questionId, outcome, chosenOptionId: chosen, correctOptionId, pointsAwarded: outcome === 'correct' ? q.points : 0, explanation: q.explanation };
    s.answers.set(questionId, res);
    return res;
  },
  async finish(sessionId: string, opts: { usedSec: number; timedOut: boolean }): Promise<SessionResult> {
    await wait();
    const s = sessions.get(sessionId);
    if (!s) throw new Error('Session not found');
    if (s.finished) return s.finished;
    const review = s.quiz.questions.map((q) => {
      const a = s.answers.get(q.id) ?? { questionId: q.id, outcome: 'unanswered' as const, chosenOptionId: null, correctOptionId: optionId(q, q.correct), pointsAwarded: 0, explanation: q.explanation };
      const chosenIdx = a.chosenOptionId ? Number(a.chosenOptionId.split('-').pop()) : -1;
      return { ...a, questionText: q.text, chosenText: chosenIdx >= 0 ? q.options[chosenIdx] : undefined, correctText: q.options[q.correct] };
    });
    const points = review.reduce((n, r) => n + r.pointsAwarded, 0);
    s.finished = {
      sessionId, quizId: s.quiz.id, quizTitle: s.quiz.title, mode: s.assignmentId ? 'group' : 'individual', assignmentId: s.assignmentId ?? null,
      maxPoints: s.quiz.questions.reduce((n, q) => n + q.points, 0), points,
      correct: review.filter((r) => r.outcome === 'correct').length, wrong: review.filter((r) => r.outcome === 'wrong').length,
      unanswered: review.filter((r) => r.outcome === 'unanswered').length,
      usedSec: opts.usedSec, timedOut: opts.timedOut, bestPoints: Math.max(points, 400), review,
    };
    return s.finished;
  },
  async result(sessionId: string) {
    const s = sessions.get(sessionId);
    if (!s?.finished) throw new Error('Result not ready');
    return s.finished;
  },

  async rating(kind: RatingKind): Promise<Rating> {
    await wait();
    const k = kind === 'individual' ? 1 : kind === 'live' ? 0.3 : 0.25;
    const entries = names.map((name, i) => ({ rank: i + 1, userId: `u${i}`, name, points: Math.round(pts[i]! * k), me: false }));
    const me = { rank: 7, userId: 'dev', name: 'Алексей И.', points: Math.round(3120 * k), me: true };
    return { kind, period: 'week', entries: [...entries, me], me };
  },
  async profile(): Promise<Profile> {
    await wait();
    return {
      user: { id: 'dev', telegramId: 0, firstName: 'Алексей', lastName: 'Иванов', username: 'alexey_iv' },
      memberSince: '2026-10-01T00:00:00Z', tests: 24, accuracy: 78, points: 3120, notifyLive: true, haptics: true,
      history: [
        { kind: 'individual', id: 'h1', title: 'Имя прилагательное', subtitle: 'Морфология', color: 'blue', points: 1200, maxPoints: 1500, at: new Date(Date.now() - 864e5).toISOString() },
        { kind: 'individual', id: 'h2', title: 'Запятые в ССП', subtitle: 'Пунктуация', color: 'peach', points: 600, maxPoints: 1000, at: '2026-11-02T10:00:00Z' },
        { kind: 'live', id: 'h3', title: 'Эфир «Финал недели»', subtitle: '', color: 'ink', points: 900, rank: 4, participants: 18, at: '2026-11-01T10:00:00Z' },
      ],
    };
  },
  notifications: [
    { id: 'n1', kind: 'live', title: 'Эфир начнётся через 10 минут', body: '«Морфология: финал недели». Нажмите, чтобы войти в лобби.', link: '/live/l-demo', createdAt: new Date(Date.now() - 5 * 6e4).toISOString(), read: false },
    { id: 'n2', kind: 'group', title: 'Новый тест в группе 10-Б', body: 'Мария Петровна отправила «Имя прилагательное». Пройти до 8 ноября.', link: '/group/a-demo', createdAt: new Date(Date.now() - 2 * 36e5).toISOString(), read: false },
    { id: 'n3', kind: 'rating', title: 'Вы поднялись на 7 место', body: 'Рейтинг недели · индивидуальные тесты', link: '/rating', createdAt: new Date(Date.now() - 864e5).toISOString(), read: true },
    { id: 'n4', kind: 'new_tests', title: '3 новых теста по орфографии', body: 'Правописание приставок ПРЕ- и ПРИ-', link: '/topics/orthography', createdAt: '2026-11-02T09:00:00Z', read: true },
  ] as AppNotification[],

  async group(id: string): Promise<GroupAssignmentView> {
    await wait();
    const mine = [...sessions.entries()].find(([, s]) => s.assignmentId === id && s.finished);
    return {
      id, access: id === 'a-closed' ? 'not_member' : 'ok', groupTitle: '10-Б · Русский язык', groupLink: 'https://t.me/rusada_10b',
      quizId: 'q-noun', quizTitle: 'Имя прилагательное', authorName: 'Мария Петровна', questionsCount: 4, durationMinutes: 2,
      closesAt: '2026-11-08T15:00:00Z', passed: 14, members: 27, previewNames: ['Мадина Р.', 'Тимур А.', 'Ольга С.'],
      leaderboard: [{ rank: 1, name: 'Мадина Р.', points: 1450, me: false }, { rank: 2, name: 'Тимур А.', points: 1300, me: false }, { rank: 3, name: 'Ольга С.', points: 1200, me: false }],
      mySessionId: mine?.[0] ?? null, myStatus: mine ? 'finished' : null,
    };
  },
  async groupResult(id: string): Promise<GroupResultView> {
    await wait();
    const mine = [...sessions.entries()].find(([, s]) => s.assignmentId === id && s.finished);
    const points = mine?.[1].finished?.points ?? 1200;
    return {
      assignmentId: id, groupTitle: '10-Б', quizTitle: 'Имя прилагательное', sessionId: mine?.[0] ?? 's-0', rank: 3, passed: 15, points,
      closesAt: '2026-11-08T15:00:00Z', remainingMembers: 12,
      leaderboard: [
        { rank: 1, name: 'Мадина Р.', points: 1450, me: false }, { rank: 2, name: 'Тимур А.', points: 1300, me: false },
        { rank: 3, name: 'Алексей И. (вы)', points, me: true }, { rank: 4, name: 'Ольга С.', points: 1200, me: false }, { rank: 5, name: 'Джасур К.', points: 950, me: false },
      ],
    };
  },

  live: null as LiveState | null,
  liveState(): LiveState {
    if (!this.live) {
      this.live = {
        id: 'l-demo', code: '4821', title: 'Морфология: финал недели', hostName: 'Мария Петровна', state: 'lobby', index: -1,
        questionsCount: nounQuiz.questions.length, questionSec: 20, remainingMs: 0, paused: false, question: null, myAnswer: null,
        answeredCount: 0, participantsCount: 18, readyCount: 12,
        players: [{ userId: 'dev', name: 'Вы', ready: false, me: true }, ...names.slice(0, 4).map((n, i) => ({ userId: `u${i}`, name: n, ready: true, me: false }))],
        reveal: null, leaderboard: [], meEntry: null, final: null, revealMs: 5000,
      };
    }
    return this.live;
  },
};
