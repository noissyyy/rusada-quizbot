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

import { fireEvent, render, screen } from '@testing-library/react';
import { NumberInput } from './components/ui';

describe('NumberInput', () => {
  it('lets you clear and retype; applies clamped value on blur', () => {
    const got: number[] = [];
    render(<NumberInput aria-label="min" min={1} max={180} value={10} onCommit={(v) => got.push(v)} />);
    const el = screen.getByLabelText('min') as HTMLInputElement;
    fireEvent.change(el, { target: { value: '' } });
    expect(el.value).toBe('');           // no forced "1" while typing
    fireEvent.change(el, { target: { value: '15' } });
    fireEvent.blur(el);
    expect(got).toEqual([15]);
    fireEvent.change(el, { target: { value: '999' } });
    fireEvent.blur(el);
    expect(got).toEqual([15, 180]);
  });
});
