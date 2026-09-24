/**
 * The share-image routes (011 §4), mounted by `App` at `/_og/*` so the three
 * frames and everything they draw stay out of the viewer's entry chunk. They
 * exist only so `scripts/og.mjs` has something to screenshot: nothing links to
 * them, they are not prerendered, and they are not in the sitemap.
 *
 * The paths are relative because this is a descendant `<Routes>`: React Router
 * matches them against whatever is left of the URL after `/_og/`.
 */
import { lazy } from 'react';
import { Route, Routes } from 'react-router';

const OgSitePage = lazy(() => import('./OgSitePage'));
const OgCrawlerPage = lazy(() => import('./OgCrawlerPage'));
const OgEpisodePage = lazy(() => import('./OgEpisodePage'));

/** The prefix `App` mounts this under, and `scripts/og.mjs` asks for. */
export const OG_PREFIX = '/_og';

export function OgRoutes() {
  return (
    <Routes>
      <Route path="site" element={<OgSitePage />} />
      <Route path="crawler/:id" element={<OgCrawlerPage />} />
      <Route path="episode/:id" element={<OgEpisodePage />} />
    </Routes>
  );
}

export default OgRoutes;
