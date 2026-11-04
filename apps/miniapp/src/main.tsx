import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/onest';
import './styles/global.css';
import { App } from './app/App';
import { setApi } from './data/api';
import { mockApi } from './data/mock';
import { createHttpApi } from './data/http';
import { I18nProvider } from './lib/i18n';
import { bootstrapTelegram, getWebApp } from './lib/telegram/webapp';

bootstrapTelegram();
// VITE_API_URL set → real backend; unset → in-memory demo data (design review only)
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
setApi(apiUrl !== undefined ? createHttpApi(apiUrl) : mockApi);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider telegramCode={getWebApp()?.initDataUnsafe.user?.language_code}>
      <App />
    </I18nProvider>
  </StrictMode>,
);
