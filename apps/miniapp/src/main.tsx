import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/onest';
import './styles/global.css';
import { App } from './app/App';
import { setApi } from './data/api';
import { mockApi } from './data/mock';
import { I18nProvider } from './lib/i18n';
import { bootstrapTelegram, getWebApp } from './lib/telegram/webapp';

bootstrapTelegram();
setApi(mockApi); // Phase 3: replace with the FastAPI client

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider telegramCode={getWebApp()?.initDataUnsafe.user?.language_code}>
      <App />
    </I18nProvider>
  </StrictMode>,
);
