import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './App';
import { shouldHydrate } from './boot';
import { readEmbedded } from './data/load';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

/*
 * 011: a prerendered marketing route arrives with its markup and its data
 * already in the page, so React hydrates rather than rebuilding it. Every other
 * entry - the hub, `npm run dev`, a deep link served through 404.html - has no
 * payload, and boots exactly as it did before.
 */
const embedded = readEmbedded();
const base = import.meta.env.BASE_URL;

const tree = (
  <StrictMode>
    <BrowserRouter basename={base}>
      <App embedded={embedded} />
    </BrowserRouter>
  </StrictMode>
);

if (shouldHydrate(embedded, window.location.pathname, base)) {
  hydrateRoot(container, tree);
} else {
  createRoot(container).render(tree);
}
