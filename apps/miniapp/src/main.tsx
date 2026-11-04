import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/onest';
import './styles/global.css';
import { App } from './app/App';
import { setApi } from './data/api';
import { mockApi } from './data/mock';
import { bootstrapTelegram } from './lib/telegram/webapp';

bootstrapTelegram();
setApi(mockApi); // Phase 3: replace with httpApi(getInitData())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
