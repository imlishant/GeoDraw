import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/stix-two-text/400-italic.css';
import './styles/app.css';
import { App } from './app/App';
import { IconGallery } from './app/components/IconGallery';
import { useApp } from './app/store';
import { controller } from './app/controller';

// Test hook for end-to-end tests only (?e2e in the URL); not used by the app.
if (location.search.includes('e2e')) Object.assign(window, { __drawgeo: { useApp, controller } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {location.search.includes('icons') ? <IconGallery /> : <App />}
  </StrictMode>,
);
