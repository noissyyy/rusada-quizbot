import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AccessInfo } from '@rq/shared-types';
import { I18nProvider } from '../lib/i18n';
import { setApi } from '../data/api';
import { mockApi } from '../data/mock';
import { PaywallScreen, roundDown } from './PaywallScreen';

const closed: AccessInfo = {
  telegramId: 123456789, username: null, hasAccess: false, reason: null, mode: 'closed', subscriptionEndsAt: null, priceUzs: 100000, days: 30,
  cardNumber: '8600 1234 5678 9012', cardHolder: 'RUSADA', note: '', supportUsername: 'rusada_admin', pending: null, rejectedComment: null, questionsCount: 10432, booksCount: 4,
};

function renderPaywall(access: AccessInfo, onChanged = () => undefined) {
  return render(<I18nProvider initial="ru"><MemoryRouter><PaywallScreen access={access} onChanged={onChanged} /></MemoryRouter></I18nProvider>);
}

describe('PaywallScreen', () => {
  it('shows what a subscription gives, the price and the card', () => {
    renderPaywall(closed);
    expect(screen.getByText('Что входит')).toBeInTheDocument();
    expect(screen.getByText('Библиотека')).toBeInTheDocument();
    expect(screen.getByText('Сборник из 10 000+ вопросов')).toBeInTheDocument(); // rounded down, never overstated
    expect(screen.getByText('Командные турниры')).toBeInTheDocument();
    expect(screen.getByText('8600 1234 5678 9012')).toBeInTheDocument();
    expect(screen.getAllByText(/@rusada_admin/).length).toBeGreaterThan(0);
    expect(screen.getByText('123456789')).toBeInTheDocument(); // own Telegram ID to send to the admin
  });

  it('uploads a receipt and asks the app to re-check access', async () => {
    setApi(mockApi);
    const onChanged = vi.fn();
    const { container } = renderPaywall(closed, onChanged);
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'check.png', { type: 'image/png' }));
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('while a receipt is being checked, says so instead of the payment steps', () => {
    renderPaywall({ ...closed, pending: { id: 'p', createdAt: new Date().toISOString() } });
    expect(screen.getByText('Чек на проверке')).toBeInTheDocument();
    expect(screen.queryByText('Загрузить чек')).not.toBeInTheDocument();
  });
});

describe('roundDown', () => {
  it('never shows more than there really is', () => {
    expect([roundDown(7), roundDown(118), roundDown(2450), roundDown(10432)]).toEqual([7, 100, 2000, 10000]);
  });
});
