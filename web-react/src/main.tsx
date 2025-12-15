import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/global.scss';
import App from './App.tsx';
import { UploadProvider } from './state/uploadContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <UploadProvider>
        <App />
      </UploadProvider>
    </BrowserRouter>
  </StrictMode>,
);
