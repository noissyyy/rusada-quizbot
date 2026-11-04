import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { setApi } from '../data/api';
import { mockApi } from '../data/mock';
import { I18nProvider, type Lang } from '../lib/i18n';
import { HomeScreen } from './HomeScreen';
import { LanguageScreen } from './LanguageScreen';
import { BottomNav } from '../components/BottomNav';

function renderAt(path: string, lang: Lang = 'ru') {
  return render(
    <I18nProvider initial={lang}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/language" element={<LanguageScreen />} />
          <Route path="/quiz/:id" element={<p>QUIZ_PAGE</p>} />
        </Routes>
        <BottomNav />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('HomeScreen', () => {
  beforeEach(() => { setApi(mockApi); try { localStorage.clear(); } catch { /* noop */ } });

  it('renders start card, test sections and three modes with function hints', async () => {
    renderAt('/');
    expect(await screen.findByText('Привет, Алексей!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Начать тест: 4\s+вопросов · 2\s+мин/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Тесты' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Морфология/ })).toHaveAttribute('href', '/topics/morphology');
    expect(screen.queryByText('Популярные тесты')).not.toBeInTheDocument();
    for (const hint of ['Тесты в своём темпе', 'Все отвечают одновременно', 'Тест для своей группы']) expect(screen.getByText(hint)).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('start card opens the quiz directly', async () => {
    renderAt('/');
    await userEvent.click(await screen.findByRole('link', { name: /Начать тест/ }));
    expect(screen.getByText('QUIZ_PAGE')).toBeInTheDocument();
  });

  it('shows error state when the API fails', async () => {
    setApi({ ...mockApi, getHomeFeed: () => Promise.reject(new Error('network')) });
    renderAt('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить данные');
  });

  it('renders Uzbek Cyrillic generated from Latin strings', async () => {
    renderAt('/', 'uz-cyrl');
    expect(await screen.findByText('Тестни бошлаш')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Тестлар' })).toBeInTheDocument();
  });

  it('bottom nav: Главная, Тесты, Книги, Рейтинг, Профиль', () => {
    renderAt('/');
    const links = within(screen.getByRole('navigation', { name: 'Menu' })).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual(['Главная', 'Тесты', 'Книги', 'Рейтинг', 'Профиль']);
  });
});

describe('LanguageScreen', () => {
  it('switches UI language and returns home', async () => {
    renderAt('/language', 'ru');
    await userEvent.click(screen.getByRole('radio', { name: /O‘zbekcha/ }));
    expect(screen.getByRole('heading', { name: 'Tilni tanlang' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(await screen.findByText('Testni boshlash')).toBeInTheDocument();
  });
});
