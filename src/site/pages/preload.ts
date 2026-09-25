/**
 * Resolving every lazy chunk the prerenderer needs, up front (011 T1125).
 *
 * Its own module because the browser must never call it: `lazy.tsx` sits in the
 * viewer's entry chunk (the router needs the page objects), and this list plus
 * its loop would ride along for nothing. Nothing in the client graph imports
 * this file, so Rollup never builds it.
 *
 * Two callers, both outside the browser: `src/entry-server.tsx`, because
 * `renderToString` writes a Suspense fallback and never comes back, and
 * `src/test/setup.ts`, because a test that renders a suspending tree races the
 * import's commit.
 */
import {
  CommunityPage,
  CrawlerPage,
  CrawlersPage,
  HomePage,
  HubHead,
  SiteLayout,
  WatchPage,
} from './lazy';

/*
 * `OgRoutes` is deliberately absent: the share-image frames are never
 * prerendered and never asserted on as markup, so only a real browser - the
 * one `scripts/og.mjs` drives - ever loads them.
 */
const PRELOADABLE: { preload: () => Promise<void> }[] = [
  SiteLayout,
  HubHead,
  HomePage,
  WatchPage,
  CrawlersPage,
  CrawlerPage,
  CommunityPage,
];

export async function preloadSitePages(): Promise<void> {
  await Promise.all(PRELOADABLE.map((page) => page.preload()));
}
