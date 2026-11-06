import type { Duel, HomeFeed, LetterMark, LiveState, TestSummary, WordGame } from '@rq/shared-types';
import { getWebApp } from '../lib/telegram/webapp';
import { ApiError, type QuizApi } from './api';
import { server } from './mockServer';

/** MOCK DATA — dev/demo only. Never shown as real metrics. */
export const mockTests: TestSummary[] = [
  { id: 'q-adj', title: 'Имя прилагательное', topicTitle: 'Морфология', topicColor: 'blue', illustration: '/3d/rq-3d-T01.webp', questionsCount: 15, durationMinutes: 6, difficulty: 'medium' },
  { id: 'q-pre', title: 'Приставки ПРЕ- и ПРИ-', topicTitle: 'Орфография', topicColor: 'violet', illustration: '/3d/rq-3d-T02.webp', questionsCount: 12, durationMinutes: 5, difficulty: 'hard' },
  { id: 'q-comma', title: 'Запятые в сложном предложении', topicTitle: 'Пунктуация', topicColor: 'peach', illustration: '/3d/rq-3d-T04.webp', questionsCount: 10, durationMinutes: 5, difficulty: 'medium' },
  { id: 'q-syn', title: 'Синонимы и антонимы', topicTitle: 'Лексика', topicColor: 'pink', illustration: '/3d/rq-3d-T05.webp', questionsCount: 12, durationMinutes: 4, difficulty: 'easy' },
];

const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
let mockPending: { id: string; createdAt: string } | null = null;
let stressBest = 17;
const mockXp = { xp: 340, level: 3, levelStart: 300, levelNext: 600 };
const mockDuels: Duel[] = [
  { id: 'd-1', role: 'opponent', questionsCount: 10, topicTitle: 'Морфология', me: { name: 'Алексей И.', finished: false, correct: null, timeMs: null }, rival: { name: 'Тимур А.', finished: true, correct: null, timeMs: null }, outcome: null, expired: false, link: '', createdAt: new Date().toISOString() },
  { id: 'd-2', role: 'creator', questionsCount: 10, topicTitle: null, me: { name: 'Алексей И.', finished: true, correct: 8, timeMs: 62000 }, rival: { name: 'Мадина Р.', finished: true, correct: 7, timeMs: 55000 }, outcome: 'win', expired: false, link: '', createdAt: new Date().toISOString() },
];
// demo «So‘z topish»
const WORD_ANSWERS = { daily: 'школа', practice: 'песок' } as const;
const wordGames = new Map<'daily' | 'practice', WordGame>();
function newWordGame(mode: 'daily' | 'practice'): WordGame {
  const g: WordGame = { id: `w-${mode}-${Date.now()}`, mode, number: mode === 'daily' ? 6 : null, length: 5, tries: 6, guesses: [], status: 'playing', answer: null };
  wordGames.set(mode, g);
  return g;
}
function markWord(guess: string, answer: string): LetterMark[] {
  const out: LetterMark[] = Array(5).fill('absent');
  const left: Record<string, number> = {};
  [...guess].forEach((c, i) => { if (c === answer[i]) out[i] = 'correct'; else left[answer[i]!] = (left[answer[i]!] ?? 0) + 1; });
  [...guess].forEach((c, i) => { if (out[i] !== 'correct' && (left[c] ?? 0) > 0) { out[i] = 'present'; left[c]!--; } });
  return out;
}
// demo: open the app with ?paywall=1 to see the subscription page (read once, before any redirect)
const DEMO_PAYWALL = typeof location !== 'undefined' && new URLSearchParams(location.search).has('paywall');
// demo: ?trial=1 shows the trial (2 of 3 free tests left, 3 free book pages)
const DEMO_TRIAL = typeof location !== 'undefined' && new URLSearchParams(location.search).has('trial');

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
      questionsTotal: 3549,
      reviewDue: 3,
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

  async getAccess() {
    await wait();
    const closed = DEMO_PAYWALL || DEMO_TRIAL;
    return {
      telegramId: 123456789, username: null, hasAccess: !closed, reason: closed ? null : 'open', mode: closed ? 'closed' : 'open', subscriptionEndsAt: null,
      priceUzs: 100000, days: 30, cardNumber: '8600 1234 5678 9012', cardHolder: 'RUSADA O‘QUV MARKAZI', note: '',
      supportUsername: 'rusada_admin', pending: mockPending, rejectedComment: null, questionsCount: 3000, booksCount: 4,
      trial: DEMO_TRIAL, trialTestsLeft: DEMO_TRIAL ? 2 : 0, trialTests: 3, trialPages: 3,
    } as const;
  },
  async sendReceipt() {
    await wait(800);
    mockPending = { id: 'p1', createdAt: new Date().toISOString() };
    return mockPending;
  },
  async wordDaily() { await wait(); return wordGames.get('daily') ?? newWordGame('daily'); },
  async wordPractice() {
    await wait();
    const open = wordGames.get('practice');
    return open && open.status === 'playing' ? open : newWordGame('practice');
  },
  async wordGuess(id: string, word: string) {
    await wait(120);
    const g = [...wordGames.values()].find((x) => x.id === id)!;
    const answer = WORD_ANSWERS[g.mode];
    const w = word.toLowerCase().replace(/ё/g, 'е');
    if (!/^[а-я]{5}$/.test(w)) throw new ApiError(422, 'need_5_letters');
    g.guesses = [...g.guesses, { word: w, marks: markWord(w, answer) }];
    if (w === answer) g.status = 'won'; else if (g.guesses.length >= 6) g.status = 'lost';
    if (g.status !== 'playing') g.answer = answer;
    return { ...g };
  },
  async wordStats() { await wait(); return { played: 12, won: 10, streak: 4, bestStreak: 7, distribution: [0, 1, 3, 4, 2, 0], practiceWon: 23 }; },
  async stressWords() {
    await wait();
    return ['звонИт', 'тОрты', 'красИвее', 'бАнты', 'каталОг', 'щавЕль', 'досУг', 'жалюзИ', 'цемЕнт', 'портфЕль', 'понялА', 'включИт']
      .map((w) => ({ word: w.toLowerCase(), stress: [...w].findIndex((c) => c !== c.toLowerCase()) }));
  },
  async stressScore(score: number) {
    await wait();
    stressBest = Math.max(stressBest, score);
    return { best: stressBest, bestWeek: stressBest, rounds: 3, week: [{ rank: 1, name: 'Мадина Р.', score: 31, me: false }, { rank: 2, name: 'Алексей И.', score: stressBest, me: true }, { rank: 3, name: 'Тимур А.', score: 14, me: false }] };
  },
  async stressBoard() {
    await wait();
    return { best: stressBest, bestWeek: stressBest, rounds: 2, week: [{ rank: 1, name: 'Мадина Р.', score: 31, me: false }, { rank: 2, name: 'Алексей И.', score: stressBest, me: true }] };
  },
  async gamesHub() {
    await wait();
    return { xp: { ...mockXp }, plays: { word: 41, duel: 28, stress: 19, review: 12 }, reviewDue: 3 };
  },
  async gameResult(_game: string, score: number) {
    await wait();
    const earned = Math.min(50, score);
    mockXp.xp += earned;
    return { best: Math.max(score, 20), xpEarned: earned, xp: { ...mockXp } };
  },
  async lastWordStart() {
    await wait();
    return { ok: true, word: 'кошка', error: null, bot: 'кошка', botGaveUp: false, need: 'а' };
  },
  async lastWordTurn(word: string, used: string[]) {
    await wait();
    const w = word.trim().toLowerCase().replace(/ё/g, 'е');
    const lastOf = (x: string) => [...x].reverse().find((c) => !'ьъы'.includes(c)) ?? x.slice(-1);
    const need = used.length ? lastOf(used[used.length - 1]!) : null;
    if (need && w[0] !== need) return { ok: false, word: w, error: 'wrong_letter' as const, bot: null, botGaveUp: false, need };
    if (used.includes(w)) return { ok: false, word: w, error: 'used' as const, bot: null, botGaveUp: false, need };
    const bank = ['арбуз', 'зонт', 'танк', 'кран', 'нос', 'сок', 'кот', 'торт', 'тигр', 'рыба', 'автобус', 'слон', 'нота', 'дом', 'море', 'ель', 'лес', 'лук', 'ключ', 'чай', 'йогурт', 'утка', 'окно', 'облако', 'игра', 'ножницы'];
    const bot = used.length > 8 ? undefined : bank.find((b) => b[0] === lastOf(w) && !used.includes(b) && b !== w);
    return bot ? { ok: true, word: w, error: null, bot, botGaveUp: false, need: lastOf(bot) } : { ok: true, word: w, error: null, bot: null, botGaveUp: true, need: null };
  },
  async duelCreate() {
    await wait();
    const d: Duel = { id: `d${Date.now()}`, role: 'creator', questionsCount: 4, topicTitle: null, me: { name: 'Алексей И.', finished: false, correct: null, timeMs: null },
      rival: null, outcome: null, expired: false, link: 'https://t.me/Rusada_QuizBot/app?startapp=d_demo', createdAt: new Date().toISOString() };
    mockDuels.unshift(d);
    return d;
  },
  async duels() { await wait(); return mockDuels; },
  async duel(id: string) { await wait(); return mockDuels.find((d) => d.id === id) ?? mockDuels[0]!; },
  async duelStart() { await wait(); return { questions: (await server.start({ quizId: 'q-noun' })).questions, answered: {} }; },
  async duelAnswer(_id: string, index: number, optionId: string) {
    await wait(120);
    const q = (await server.start({ quizId: 'q-noun' })).questions[index]!;
    const correct = server.correctOf(q.id)!;
    return { correct: optionId === correct, correctOptionId: correct };
  },
  async duelFinish(id: string) {
    await wait();
    const d = mockDuels.find((x) => x.id === id) ?? mockDuels[0]!;
    d.me = { name: 'Алексей И.', finished: true, correct: 3, timeMs: 41000 };
    d.rival = { name: 'Мадина Р.', finished: true, correct: 2, timeMs: 38000 };
    d.outcome = 'win';
    return { ...d };
  },
  async getReview() {
    await wait();
    const qs = (await server.start({ quizId: 'q-noun' })).questions.slice(0, 3);
    return { due: 3, learning: 5, mastered: 2, questions: qs };
  },
  async answerReview(questionId: string, optionId: string) {
    await wait(150);
    const correct = server.correctOf(questionId);
    return { correct: optionId === correct, correctOptionId: correct, explanation: 'Объяснение к вопросу.', box: optionId === correct ? 1 : 0, mastered: false,
      nextDueAt: new Date(Date.now() + 864e5).toISOString() };
  },
  async getBooks() {
    await wait();
    return [
      { id: 'b1', title: 'Тесты по литературе', author: 'Д. Алиева, Е. Торкунова', price: '85 000 сум', link: 'https://t.me/rusada_uz', coverUrl: null, pages: 12,
        description: 'Сборник тестов по русской литературе: от Жуковского до Булгакова. Варианты с ответами для подготовки к экзаменам.' },
      { id: 'b2', title: 'Русский язык. Морфология', author: 'Rusada', price: '70 000 сум', link: 'https://t.me/rusada_uz', coverUrl: null, pages: 0,
        description: 'Правила и упражнения по частям речи с ключами.' },
      { id: 'b3', title: 'Орфография без ошибок', author: 'Rusada', price: '', link: '', coverUrl: null, pages: 0, description: 'Справочник с примерами.' },
    ];
  },
  async getBookPage(_id: string, page: number) {
    await wait(1500); // like a real page over mobile internet
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#fff"/><text x="300" y="400" font-size="48" text-anchor="middle" fill="#6A3DF0">Страница ${page}</text></svg>`;
    return new Blob([svg], { type: 'image/svg+xml' });
  },
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
