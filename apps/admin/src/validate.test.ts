import { validate } from './pages/QuestionForm';

const base = { topicId: 't', subtopicId: null, text: 'Вопрос?', imageUrl: null, difficulty: 'easy' as const, points: 100, explanationRu: '', explanationUz: '', status: 'draft' as const,
  options: ['a', 'b', 'c', 'd'].map((text, i) => ({ text, isCorrect: i === 1 })) };

describe('question form checks', () => {
  it('passes a complete question', () => expect(validate(base).every(([ok]) => ok)).toBe(true));
  it('flags an empty option by its letter', () => {
    const r = validate({ ...base, options: base.options.map((o, i) => (i === 3 ? { ...o, text: ' ' } : o)) });
    expect(r.find(([ok]) => !ok)?.[2]).toBe('Вариант D пустой');
  });
  it('needs exactly one correct answer and points in tens', () => {
    const r = validate({ ...base, points: 55, options: base.options.map((o) => ({ ...o, isCorrect: true })) });
    expect(r.filter(([ok]) => !ok).map(([, , bad]) => bad)).toEqual(['Отметьте ровно один правильный ответ', 'Баллы — от 10, кратно 10']);
  });
});
