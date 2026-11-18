import {
  CastPage,
  CommunityPage,
  CrawlerPage,
  CrawlersPage,
  HomePage,
  SiteLayout,
  WatchPage,
} from './lazy';

/**
 * The chunks one prerendered route is made of, resolved before hydration.
 *
 * `main.tsx` awaits this and only then calls `hydrateRoot`. Without it the
 * first client render meets a `lazy` that suspends, and the moment anything
 * above the boundary updates (the show landing, the registry fetch) React
 * gives up on hydrating it: the server's markup is replaced by the `null`
 * fallback and drawn again when the chunk arrives. That blank quarter-second
 * also undid the browser's own jump to a `#fragment`.
 *
 * The markup is already on screen while this waits, so the reader loses
 * nothing. Its own module, and in the entry chunk on purpose (unlike
 * `preload.ts`, which the browser never loads): it names the pages but pulls
 * in none of them until asked. An unknown route resolves at once and hydrates
 * as it always did.
 */
export function preloadRoute(route: string): Promise<void> {
  const page: { preload: () => Promise<void> } | null =
    route === '/'
      ? HomePage
      : route === '/watch'
        ? WatchPage
        : route === '/crawlers'
          ? CrawlersPage
          : route === '/cast'
            ? CastPage
            : route === '/community'
              ? CommunityPage
              : /^\/crawlers\/[^/]+$/.test(route)
                ? CrawlerPage
                : null;
  if (page === null) return Promise.resolve();
  return Promise.all([SiteLayout.preload(), page.preload()]).then(() => undefined);
}
