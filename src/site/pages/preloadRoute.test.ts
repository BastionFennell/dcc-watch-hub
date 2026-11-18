import { describe, expect, it, vi } from 'vitest';
import {
  CastPage,
  CommunityPage,
  CrawlerPage,
  CrawlersPage,
  HomePage,
  SiteLayout,
  WatchPage,
} from './lazy';
import { preloadRoute } from './preloadRoute';

/**
 * `preloadRoute` is what keeps a prerendered page's markup on screen through
 * hydration: the route's chunks are in hand before React starts, so nothing
 * suspends and no boundary falls back to client rendering.
 */
describe('preloadRoute', () => {
  const cases: [string, { preload: () => Promise<void> }][] = [
    ['/', HomePage],
    ['/watch', WatchPage],
    ['/crawlers', CrawlersPage],
    ['/crawlers/ronald', CrawlerPage],
    ['/cast', CastPage],
    ['/community', CommunityPage],
  ];

  it.each(cases)('resolves the layout and the page for %s', async (route, page) => {
    const layout = vi.spyOn(SiteLayout, 'preload');
    const own = vi.spyOn(page, 'preload');
    await preloadRoute(route);
    expect(layout).toHaveBeenCalledTimes(1);
    expect(own).toHaveBeenCalledTimes(1);
    layout.mockRestore();
    own.mockRestore();
  });

  it('resolves at once for a route that was never prerendered', async () => {
    const layout = vi.spyOn(SiteLayout, 'preload');
    await preloadRoute('/ep/3');
    await preloadRoute('/crawlers/ronald/extra');
    expect(layout).not.toHaveBeenCalled();
    layout.mockRestore();
  });
});
