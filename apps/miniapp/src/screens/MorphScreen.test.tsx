import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { setApi } from '../data/api';
import { mockApi } from '../data/mock';
import { I18nProvider } from '../lib/i18n';
import { MorphScreen } from './MorphScreen';

// keep the deck in file order: «под·снеж·ник» (3 parts) is followed by «пере·ход» (2 parts)
vi.mock('../lib/gameContent', async (orig) => ({ ...(await orig<typeof import('../lib/gameContent')>()), shuffle: <T,>(a: T[]) => [...a] }));
vi.mock('../lib/fresh', async (orig) => ({ ...(await orig<typeof import('../lib/fresh')>()), takeFresh: <T,>(_key: string, pool: T[], n: number) => pool.slice(0, n) }));

beforeEach(() => setApi(mockApi));

it('moves from a longer word to a shorter one without crashing', async () => {
  const user = userEvent.setup();
  render(<I18nProvider initial="ru"><MemoryRouter><MorphScreen /></MemoryRouter></I18nProvider>);
  for (const part of ['под', 'снеж', 'ник']) await user.click(screen.getByRole('button', { name: part }));
  await user.click(screen.getByRole('button', { name: 'снеж' })); // the root
  await user.click(screen.getByRole('button', { name: 'Следующее слово' }));
  expect(screen.getByText('Слово 2 из 8')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'пере' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ход' })).toBeInTheDocument();
});
