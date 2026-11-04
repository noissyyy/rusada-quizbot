import type { HomeFeed, LiveState, TestSummary } from '@rq/shared-types';
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

const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));

/** Live demo: a scripted host that opens questions and reveals answers on a timer. */
function liveTick(): LiveState {
  const s = server.liveState();
  return { ...s };
}

export const mockApi: QuizApi = {
  async getHomeFeed(): Promise<HomeFeed> {
    await wait(250);
    const tg = getWebApp()?.initDataUnsafe.user; // display only, never trusted
    return {
      user: tg
        ? { id: String(tg.id), telegramId: tg.id, firstName: tg.first_name, lastName: tg.last_name, username: tg.username, photoUrl: tg.photo_url, languageCode: tg.language_code }
        : { id: 'dev', telegramId: 0, firstName: 'Алексей', lastName: 'Иванов' },
      unreadNotifications: server.notifications.filter((n) => !n.read).length,
      quickStart: { quizId: 'q-quick', questionsCount: 4, durationMinutes: 2 },
      continueAttempt: { sessionId: 's-prev', quizId: 'q-noun', quizTitle: 'Имя существительное', answered: 2, total: 4, remainingSeconds: 112 },
      popularTests: mockTests,
      liveNow: 2,
    };
  },
  getTopics: () => server.topics(),
  getTopic: (slug) => server.topic(slug),
  searchTests: (q) => server.search(q),
  getTest: (id) => server.test(id),
  startSession: (target) => server.start(target),
  submitAnswer: (sid, qid, oid) => server.submit(sid, qid, oid),
  finishSession: (sid, opts) => server.finish(sid, opts),
  getResult: (sid) => server.result(sid),

  getRating: (kind) => server.rating(kind),
  getProfile: () => server.profile(),
  async updateSettings(patch) { await wait(100); return { id: 'dev', telegramId: 0, firstName: 'Алексей', ...patch }; },
  async getNotifications() { await wait(); return server.notifications.map((n) => ({ ...n })); },
  async readAllNotifications() { await wait(100); server.notifications.forEach((n) => { n.read = true; }); },

  async getGroupHub() {
    await wait();
    return [{ id: 'a-demo', groupTitle: '10-Б · Русский язык', quizTitle: 'Имя прилагательное', questionsCount: 4, durationMinutes: 8,
      closesAt: '2026-11-08T15:00:00Z', passed: 14, myStatus: null }];
  },
  getGroupAssignment: (id) => server.group(id),
  getGroupResult: (id) => server.groupResult(id),
  async shareGroupResult() { await wait(); },

  async listLive() {
    await wait();
    const s = server.liveState();
    return [{ id: s.id, code: s.code, title: s.title, hostName: s.hostName, state: s.state, participants: s.participantsCount }];
  },
  async joinLive(code) {
    await wait();
    if (code !== server.liveState().code) throw new Error('live_not_found');
    return liveTick();
  },
  async getLive() { await wait(); return liveTick(); },
  async liveReady() {
    await wait(100);
    const s = server.liveState();
    s.players = s.players.map((p) => (p.me ? { ...p, ready: true } : p));
    s.readyCount += 1;
    return liveTick();
  },
  async liveAnswer(_id, index, optionId) {
    await wait(100);
    const s = server.liveState();
    if (s.state === 'question' && s.index === index && !s.myAnswer) { s.myAnswer = optionId; s.answeredCount += 1; }
    return liveTick();
  },
  subscribeLive(_id, onState) {
    // Scripted host: lobby 3 s → question (20 s or until answered + 2 s) → reveal 5 s → … → finished.
    const s = server.liveState();
    const quiz = { questions: [
      { id: 'n1', text: 'Какое из слов является наречием?', points: 100, options: ['Быстрый', 'Быстро', 'Быстрота', 'Ускорить'], correct: 1, explanation: '«Быстро» отвечает на вопрос «как?» и не изменяется — это признаки наречия.' },
      { id: 'n3', text: 'В каком слове пишется Ь после шипящей?', points: 150, options: ['Луч…', 'Ноч…', 'Врач…', 'Шалаш…'], correct: 1, explanation: 'После шипящих у существительных женского рода 3-го склонения пишется Ь.' },
    ] };
    s.questionsCount = quiz.questions.length;
    let phaseEnd = Date.now() + 3000;
    let myPoints = 0;
    const others = [{ id: 'u1', name: 'Тимур А.', p: 0 }, { id: 'u2', name: 'Ольга С.', p: 0 }, { id: 'u0', name: 'Мадина Р.', p: 0 }];
    const board = () => {
      const all = [...others.map((o) => ({ userId: o.id, name: o.name, points: o.p, me: false })), { userId: 'dev', name: 'Алексей И. (вы)', points: myPoints, me: true }]
        .sort((a, b) => b.points - a.points).map((e, i) => ({ ...e, rank: i + 1, delta: 0 }));
      s.leaderboard = all.slice(0, 5);
      s.meEntry = all.find((e) => e.me) ?? null;
    };
    const h = setInterval(() => {
      const now = Date.now();
      if (s.state === 'question') s.remainingMs = Math.max(0, phaseEnd - now);
      if (now >= phaseEnd || (s.state === 'question' && s.myAnswer && phaseEnd - now > 2000)) {
        if (s.state === 'lobby' || s.state === 'reveal') {
          if (s.index + 1 >= quiz.questions.length) {
            s.state = 'finished';
            board();
            s.final = { rank: s.meEntry?.rank ?? 1, total: 18, points: myPoints, correct: myPoints ? 1 : 0 };
          } else {
            s.index += 1; s.state = 'question'; s.myAnswer = null; s.reveal = null; s.answeredCount = 0;
            const q = quiz.questions[s.index]!;
            s.question = { id: q.id, text: q.text, points: q.points, options: q.options.map((text, i) => ({ id: `${q.id}-${i}`, label: (['A', 'B', 'C', 'D'] as const)[i]!, text })) };
            phaseEnd = now + s.questionSec * 1000; s.remainingMs = s.questionSec * 1000;
          }
        } else if (s.state === 'question') {
          if (s.myAnswer && phaseEnd - now > 2000) { phaseEnd = now + 2000; s.answeredCount = 11; }
          else {
            const q = quiz.questions[s.index]!;
            const correctId = `${q.id}-${q.correct}`;
            const ok = s.myAnswer === correctId;
            if (ok) myPoints += q.points;
            others.forEach((o, i) => { if ((i + s.index) % 2 === 0) o.p += q.points; });
            board();
            s.state = 'reveal'; s.remainingMs = 0;
            s.reveal = { correctOptionId: correctId, correctText: q.options[q.correct]!.replace('…', 'ь'), explanation: q.explanation, correctCount: 12, myOutcome: s.myAnswer ? (ok ? 'correct' : 'wrong') : 'unanswered', myPoints: ok ? q.points : 0 };
            phaseEnd = now + s.revealMs;
          }
        }
      }
      onState({ ...s });
      if (s.state === 'finished') clearInterval(h);
    }, 250);
    return () => clearInterval(h);
  },
};
