import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './App';
import { clearPrerenderedHead, normalizePath, shouldHydrate } from './boot';
import { readEmbedded } from './data/load';
import { preloadRoute } from './site/pages/preloadRoute';

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

/*
 * 011 §7: cookieless analytics, and only when the deploy configured a domain.
 * The env check is out here rather than left to `installAnalytics` so that a
 * build with no domain drops the import entirely - no chunk, no request, and
 * nothing about analytics in the viewer's bundle.
 */
if (import.meta.env.VITE_PLAUSIBLE_DOMAIN) {
  void import('./site/analytics').then((analytics) => analytics.installAnalytics());
}

/*
 * The prerenderer's head tags have done their job the moment a browser has the
 * document: React is about to render the same values, and it appends rather
 * than adopting (see `clearPrerenderedHead`).
 */
clearPrerenderedHead(document);

if (embedded !== null && shouldHydrate(embedded, window.location.pathname, base)) {
  /*
   * The route's lazy chunks first, so hydration never meets a suspended page
   * (see `preloadRoute`). A chunk that fails to load must not leave the page
   * inert: hydrate anyway and let the boundary recover the old way.
   */
  const hydrate = () => hydrateRoot(container, tree);
  preloadRoute(normalizePath(embedded.route)).then(hydrate, hydrate);
} else {
  createRoot(container).render(tree);
}
