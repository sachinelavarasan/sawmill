import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { ConfirmProvider } from './components/confirm';
import { ToastProvider } from './components/toast';
import { I18nProvider } from './i18n';
import { queryClient } from './lib/query';
import { initTheme } from './theme';
// Fonts ship with the app (no Google Fonts call): works on a weak connection and keeps a strict CSP.
// Each file declares unicode-range subsets, so the browser only downloads the scripts a page uses.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/noto-sans-tamil/400.css';
import '@fontsource/noto-sans-tamil/500.css';
import '@fontsource/noto-sans-tamil/600.css';
import '@fontsource/noto-sans-tamil/700.css';
import './index.css';

initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ConfirmProvider>
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </ConfirmProvider>
      </I18nProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
