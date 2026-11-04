import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../lib/i18n';
import { setApi } from '../data/api';
import { mockApi } from '../data/mock';
import { TopicScreen, WorkScreen } from './TopicScreen';

function renderAt(path: string) {
  return render(
    <I18nProvider initial="ru">
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/topics/:slug" element={<TopicScreen />} />
          <Route path="/topics/:slug/works/:workId" element={<WorkScreen />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('«works» section', () => {
  beforeEach(() => setApi(mockApi));

  it('shows a shelf of works with authors and test counts, and opens a work with only its tests', async () => {
    renderAt('/topics/works');
    expect(await screen.findByText('Евгений Онегин')).toBeInTheDocument();
    expect(screen.getByText('А. С. Пушкин')).toBeInTheDocument();
    expect(screen.getByText('Тесты скоро')).toBeInTheDocument(); // a work without tests yet
    await userEvent.click(screen.getByRole('link', { name: /Евгений Онегин/ }));
    expect(await screen.findByRole('heading', { name: 'Евгений Онегин' })).toBeInTheDocument();
    expect(screen.getAllByText(/Имя (существительное|прилагательное)/)).toHaveLength(2);
  });

  it('keeps ordinary sections as a test list', async () => {
    renderAt('/topics/morphology');
    expect(await screen.findByRole('tab', { name: 'Все' })).toBeInTheDocument();
  });
});
