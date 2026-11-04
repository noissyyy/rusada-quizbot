import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { setApi } from '../data/api';
import { mockApi } from '../data/mock';
import { I18nProvider } from '../lib/i18n';
import { QuizScreen } from './QuizScreen';
import { ResultScreen } from './ResultScreen';
import { ReviewScreen } from './ReviewScreen';
import { TimeUpScreen } from './TimeUpScreen';

function renderQuiz() {
  return render(
    <I18nProvider initial="ru">
      <MemoryRouter initialEntries={['/quiz/q-noun']}>
        <Routes>
          <Route path="/quiz/:id" element={<QuizScreen />} />
          <Route path="/timeup/:sid" element={<TimeUpScreen />} />
          <Route path="/result/:sid" element={<ResultScreen />} />
          <Route path="/result/:sid/review" element={<ReviewScreen />} />
          <Route path="/" element={<p>HOME</p>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

const answer = async (label: string) => {
  await userEvent.click(await screen.findByRole('radio', { name: new RegExp(label) }));
  await userEvent.click(screen.getByRole('button', { name: 'Ответить' }));
};

describe('quiz flow (one timer per test)', () => {
  beforeEach(() => setApi(mockApi));

  it('submit is disabled until an option is chosen; correct answer shows feedback and pauses the timer', async () => {
    renderQuiz();
    expect(await screen.findByText('Вопрос 1 из 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ответить' })).toBeDisabled();
    await answer('Быстро$');
    expect(await screen.findByText('Правильно!')).toBeInTheDocument();
    expect(screen.getByText('+100')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveAccessibleName(/Таймер на паузе/);
  });

  it('wrong answer reveals the correct one; full run reaches result and review', async () => {
    renderQuiz();
    await answer('Быстрый');
    expect(await screen.findByText('Неправильно')).toBeInTheDocument();
    expect(screen.getByText('Быстро', { selector: 'b' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Дальше' }));
    await answer('Мозоль'); await userEvent.click(await screen.findByRole('button', { name: 'Дальше' }));
    await answer('Ноч'); await userEvent.click(await screen.findByRole('button', { name: 'Дальше' }));
    await answer('Написать'); await userEvent.click(await screen.findByRole('button', { name: 'К результатам' }));
    expect(await screen.findByText('Результат')).toBeInTheDocument();
    expect(screen.getByText(/400/, { selector: 'div' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /Разбор ошибок/ }));
    expect(await screen.findByText(/Ваш ответ: Быстрый/)).toBeInTheDocument();
  });

  it('when the whole-test time runs out the test ends and unanswered questions score 0', async () => {
    setApi({ ...mockApi, startSession: async (id) => ({ ...(await mockApi.startSession(id)), durationSec: 1 }) });
    renderQuiz();
    expect(await screen.findByText('Время вышло', {}, { timeout: 3000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('0 из 4')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('link', { name: 'Смотреть результат' }));
    expect(await screen.findByText('Есть над чем поработать')).toBeInTheDocument();
  });
});
