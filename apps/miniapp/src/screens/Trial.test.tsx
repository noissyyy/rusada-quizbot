import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { AccessInfo } from '@rq/shared-types';
import { I18nProvider } from '../lib/i18n';
import { TrialBanner, TrialLocked } from '../components/trial/Trial';
import { AccessCtxForTests } from '../lib/access';

const trial = {
  telegramId: 1, username: null, hasAccess: false, reason: null, mode: 'closed', subscriptionEndsAt: null, priceUzs: 100000, days: 30,
  cardNumber: '', cardHolder: '', note: '', supportUsername: '', pending: null, rejectedComment: null, questionsCount: 3000, booksCount: 0,
  trial: true, trialTestsLeft: 1, trialTests: 3, trialPages: 10,
} satisfies AccessInfo;

const wrap = (ui: React.ReactNode, access: AccessInfo | null) => render(
  <I18nProvider initial="ru"><MemoryRouter><AccessCtxForTests value={access}>{ui}</AccessCtxForTests></MemoryRouter></I18nProvider>,
);

describe('trial', () => {
  it('home banner says how many free tests are left and links to the subscription', () => {
    wrap(<TrialBanner />, trial);
    expect(screen.getByText('Бесплатных тестов осталось: 1 из 3')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/subscribe');
  });

  it('shows nothing for people with access', () => {
    const { container } = wrap(<TrialBanner />, { ...trial, trial: false, hasAccess: true, reason: 'subscription' });
    expect(container).toBeEmptyDOMElement();
  });

  it('limit screen explains and offers the subscription', () => {
    wrap(<TrialLocked reason="tests" />, trial);
    expect(screen.getByText('Бесплатные тесты закончились')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Посмотреть подписку' })).toHaveAttribute('href', '/subscribe');
  });
});
