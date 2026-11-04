/**
 * In-memory stand-in for the backend. Keeps the answer key on the "server"
 * side of the API boundary so screens are written against the real contract.
 * MOCK DATA — dev/demo only.
 */
import type { AnswerResult, SessionResult, SessionStart, TopicSummary, TopicTest } from '@rq/shared-types';

interface QuestionFull { id: string; text: string; points: number; options: [string, string, string, string]; correct: 0 | 1 | 2 | 3; explanation?: string }
interface QuizFull { id: string; title: string; topicSlug: string; durationSec: number; questions: QuestionFull[] }

export const topics: TopicSummary[] = [
  { id: 't1', slug: 'morphology', title: 'Морфология', color: 'blue', illustration: '/3d/rq-3d-T01.webp', testsCount: 12, questionsCount: 180, progress: 45, difficulties: ['easy', 'medium', 'hard'] },
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

const morphTests: TopicTest[] = [
  { id: 'q-noun', title: 'Имя существительное', topicTitle: 'Морфология', topicColor: 'blue', illustration: '/3d/rq-3d-T01.webp', questionsCount: 4, durationMinutes: 2, difficulty: 'easy', description: 'Род, число и падеж существительных, мягкий знак после шипящих.', maxPoints: 500, status: { kind: 'in_progress', answered: 2 } },
  { id: 'q-adj', title: 'Имя прилагательное', topicTitle: 'Морфология', topicColor: 'blue', illustration: '/3d/rq-3d-T01.webp', questionsCount: 15, durationMinutes: 6, difficulty: 'medium', description: 'Разряды прилагательных, краткая и полная форма, степени сравнения и правописание суффиксов.', maxPoints: 1500, status: { kind: 'done', bestPercent: 80 } },
  { id: 'q-verb', title: 'Глагол: вид и время', topicTitle: 'Морфология', topicColor: 'blue', illustration: '/3d/rq-3d-T01.webp', questionsCount: 20, durationMinutes: 9, difficulty: 'hard', description: 'Совершенный и несовершенный вид, времена и спряжение глаголов.', maxPoints: 2400, status: { kind: 'new' } },
  { id: 'q-adv', title: 'Наречие', topicTitle: 'Морфология', topicColor: 'blue', illustration: '/3d/rq-3d-T01.webp', questionsCount: 12, durationMinutes: 5, difficulty: 'medium', description: 'Разряды наречий и их правописание.', maxPoints: 1200, status: { kind: 'new' } },
];

interface Session { quiz: QuizFull; answers: Map<string, AnswerResult>; finished?: SessionResult }
const sessions = new Map<string, Session>();
let seq = 0;
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));

export const server = {
  async topics() { await wait(); return topics; },
  async topic(slug: string) {
    await wait();
    const topic = topics.find((t) => t.slug === slug) ?? topics[0]!;
    return { topic, tests: morphTests.map((t) => ({ ...t, topicTitle: topic.title, topicColor: topic.color, illustration: topic.illustration })) };
  },
  async test(id: string) { await wait(); return morphTests.find((t) => t.id === id) ?? morphTests[1]!; },
  async start(quizId: string): Promise<SessionStart> {
    await wait();
    const quiz = quizzes[quizId] ?? nounQuiz;
    const sessionId = `s-${++seq}`;
    sessions.set(sessionId, { quiz, answers: new Map() });
    return {
      sessionId, quizTitle: quiz.title, topicTitle: 'Морфология', durationSec: quiz.durationSec,
      questions: quiz.questions.map((q) => ({ id: q.id, text: q.text, points: q.points, options: q.options.map((text, i) => ({ id: `${q.id}-${i}`, label: (['A', 'B', 'C', 'D'] as const)[i]!, text })) })),
    };
  },
  async submit(sessionId: string, questionId: string, optionId: string | null): Promise<AnswerResult> {
    await wait(120);
    const s = sessions.get(sessionId);
    if (!s) throw new Error('Session not found');
    const prev = s.answers.get(questionId);
    if (prev) return prev; // idempotent: a repeated submit never scores twice
    const q = s.quiz.questions.find((x) => x.id === questionId)!;
    const correctOptionId = `${q.id}-${q.correct}`;
    const outcome = optionId === null ? 'unanswered' : optionId === correctOptionId ? 'correct' : 'wrong';
    const res: AnswerResult = { questionId, outcome, chosenOptionId: optionId, correctOptionId, pointsAwarded: outcome === 'correct' ? q.points : 0, explanation: q.explanation };
    s.answers.set(questionId, res);
    return res;
  },
  async finish(sessionId: string, opts: { usedSec: number; timedOut: boolean }): Promise<SessionResult> {
    await wait();
    const s = sessions.get(sessionId);
    if (!s) throw new Error('Session not found');
    if (s.finished) return s.finished;
    const review = s.quiz.questions.map((q) => {
      const a = s.answers.get(q.id) ?? { questionId: q.id, outcome: 'unanswered' as const, chosenOptionId: null, correctOptionId: `${q.id}-${q.correct}`, pointsAwarded: 0, explanation: q.explanation };
      const chosenIdx = a.chosenOptionId ? Number(a.chosenOptionId.split('-').pop()) : -1;
      return { ...a, questionText: q.text, chosenText: chosenIdx >= 0 ? q.options[chosenIdx] : undefined, correctText: q.options[q.correct] };
    });
    const points = review.reduce((n, r) => n + r.pointsAwarded, 0);
    s.finished = {
      sessionId, quizTitle: s.quiz.title, maxPoints: s.quiz.questions.reduce((n, q) => n + q.points, 0), points,
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
};
