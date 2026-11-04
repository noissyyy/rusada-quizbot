import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { setApi } from '../data/api';
import { mockApi } from '../data/mock';
import { HomeScreen } from './HomeScreen';
import { BottomNav } from '../components/BottomNav';

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/topics" element={<p>TOPICS_PAGE</p>} />
        <Route path="/mode/:mode" element={<p>MODE_PAGE</p>} />
      </Routes>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe('HomeScreen', () => {
  beforeEach(() => setApi(mockApi));

  it('shows skeleton then greeting, hero CTA, 3 modes, featured topics', async () => {
    renderHome();
    expect(screen.getByLabelText('Загрузка')).toBeInTheDocument();
    expect(await screen.findByText('Привет, Алексей!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Начать тест/ })).toBeInTheDocument();
    for (const t of ['Индивидуальный тест', 'Прямой эфир', 'Тест в группе']) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getByText('Морфология')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Прогресс теста' })).toHaveAttribute('aria-valuenow', '6');
  });

  it('hero CTA navigates to topics', async () => {
    renderHome();
    await userEvent.click(await screen.findByRole('button', { name: /Начать тест/ }));
    expect(screen.getByText('TOPICS_PAGE')).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    setApi({ getHomeFeed: () => Promise.reject(new Error('network')) });
    renderHome();
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить данные');
  });

  it('bottom nav has 4 items and marks Главная active', async () => {
    renderHome();
    const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Главная', 'Темы', 'Рейтинг', 'Профиль']);
    expect(links[0]).toHaveAttribute('aria-current', 'page');
  });
});
