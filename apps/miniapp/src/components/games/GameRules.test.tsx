import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { I18nProvider } from '../../lib/i18n';
import { GameRules } from './GameRules';

const ui = () => render(<I18nProvider initial="uz"><GameRules game="memory"><p>GAME</p></GameRules></I18nProvider>);
beforeEach(() => localStorage.clear());

it('shows the rules before the game starts, every time until switched off', async () => {
  const user = userEvent.setup();
  const r = ui();
  expect(screen.getByRole('dialog', { name: 'Esla va mosla' })).toBeInTheDocument();
  expect(screen.queryByText('GAME')).toBeNull(); // the game (and its timers) waits
  await user.click(screen.getByRole('button', { name: 'Tushunarli, o‘ynash!' }));
  expect(screen.getByText('GAME')).toBeInTheDocument();
  r.unmount();

  ui(); // next visit: shown again
  await user.click(screen.getByRole('checkbox', { name: 'Boshqa ko‘rsatilmasin' }));
  await user.click(screen.getByRole('button', { name: 'Tushunarli, o‘ynash!' }));
  r.unmount();
});

it('stays hidden after «don’t show again»', () => {
  localStorage.setItem('rq-rules-off', JSON.stringify(['memory']));
  ui();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('GAME')).toBeInTheDocument();
});

it('shows the next game’s rules when switching games directly', async () => {
  const user = userEvent.setup();
  const r = render(<I18nProvider initial="uz"><GameRules game="memory"><p>GAME</p></GameRules></I18nProvider>);
  await user.click(screen.getByRole('button', { name: 'Tushunarli, o‘ynash!' }));
  r.rerender(<I18nProvider initial="uz"><GameRules game="attack"><p>GAME2</p></GameRules></I18nProvider>);
  expect(screen.getByRole('dialog', { name: 'So‘z hujumi' })).toBeInTheDocument();
  expect(screen.queryByText('GAME2')).toBeNull();
});
