import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import HomePage from './home-page';
import './i18n';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('#root element missing from index.html');
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <HomePage />
  </StrictMode>,
);
