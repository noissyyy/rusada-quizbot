import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { setApi } from '../data/api';
import { mockApi } from '../data/mock';
import { I18nProvider } from '../lib/i18n';
import { TopicScreen } from './TopicScreen';

describe('TopicScreen', () => {
  beforeEach(() => setApi(mockApi));

  it('shows the section description and filters tests by subtopic', async () => {
    render(<I18nProvider initial="ru"><MemoryRouter initialEntries={['/topics/morphology']}><Routes><Route path="/topics/:slug" element={<TopicScreen />} /></Routes></MemoryRouter></I18nProvider>);
    expect(await screen.findByText('Части речи и их формы: от существительного до наречия')).toBeInTheDocument();
    expect(screen.getByText('Имя прилагательное')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Глагол' }));
    expect(screen.getByText('Глагол: вид и время')).toBeInTheDocument();
    expect(screen.queryByText('Имя прилагательное')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Все' }));
    expect(screen.getByText('Имя прилагательное')).toBeInTheDocument();
  });
});
