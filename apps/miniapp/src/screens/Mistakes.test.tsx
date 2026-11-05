import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../lib/i18n';
import { setApi } from '../data/api';
import { mockApi } from '../data/mock';
import { MistakesScreen } from './MistakesScreen';

describe('«Мои ошибки»', () => {
  beforeEach(() => setApi(mockApi));

  it('shows what is due, plays through the questions with right/wrong colours and ends with a summary', async () => {
    render(<I18nProvider initial="ru"><MemoryRouter><MistakesScreen /></MemoryRouter></I18nProvider>);
    expect(await screen.findByText('вопросов повторить сегодня')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить · 3' }));
    for (let i = 0; i < 3; i++) {
      await userEvent.click((await screen.findAllByRole('radio'))[1]!);
      await userEvent.click(await screen.findByRole('button', { name: i < 2 ? 'Дальше' : 'Готово' }));
    }
    expect(await screen.findByText('Повторение окончено')).toBeInTheDocument();
    expect(screen.getByText(/Верно: \d из 3/)).toBeInTheDocument();
  });
});
