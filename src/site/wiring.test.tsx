// @vitest-environment jsdom
/**
 * T1127: the analytics events are not just defined, they are attached. One test
 * per surface the addendum names - "outbound clicks to YouTube/Discord, hub
 * opens, crawler page views" - clicked through the real components, with
 * `window.plausible` standing in for the script.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { CommunityPage } from './pages/CommunityPage';
import { CrawlerPage } from './pages/CrawlerPage';
import { HomePage } from './pages/HomePage';
import { WatchPage } from './pages/WatchPage';
import { siteCopy } from './copy';
import { makeCrawlers, makeEpisodeRaw, makeStatus } from '../test/fixtures';
import { makeGatedShow, renderSite } from '../test/renderSite';

let calls: unknown[][] = [];

beforeEach(() => {
  calls = [];
  window.plausible = ((...args: unknown[]) => calls.push(args)) as typeof window.plausible;
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const id = Number(/ep(\d+)\.json/.exec(String(input))?.[1] ?? 1);
    return Promise.resolve(
      new Response(JSON.stringify(makeEpisodeRaw(id)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete window.plausible;
});

/** Names only - the props are the analytics unit test's business. */
function names(): string[] {
  return calls.map((call) => String(call[0]));
}

const LIVE_AT = '2026-10-10T17:00:00Z';
const gate = Date.parse(LIVE_AT);

describe('analytics wiring', () => {
  it('counts an open feed as hub_open', () => {
    renderSite(<WatchPage />, { path: '/watch', now: gate });
    fireEvent.click(screen.getAllByRole('link', { name: siteCopy.openSystemFeed })[0]);
    expect(names()).toEqual(['hub_open']);
  });

  it('counts a shut feed as an outbound click to YouTube', () => {
    renderSite(<WatchPage />, {
      show: makeGatedShow(LIVE_AT),
      path: '/watch',
      now: gate - 60 * 60 * 1000,
    });
    fireEvent.click(screen.getAllByRole('link', { name: siteCopy.watchOnYouTube })[0]);
    expect(calls).toEqual([['outbound', { props: { to: 'youtube', episode: 3 } }]]);
  });

  it('counts the social row, on the home page and on /community', () => {
    const { unmount } = renderSite(<HomePage />, { path: '/' });
    fireEvent.click(screen.getAllByRole('link', { name: siteCopy.platform.discord })[0]);
    expect(calls).toEqual([['outbound', { props: { to: 'discord' } }]]);
    unmount();

    calls = [];
    renderSite(<CommunityPage />, { path: '/community' });
    fireEvent.click(screen.getByRole('link', { name: siteCopy.discordCta }));
    expect(calls).toEqual([['outbound', { props: { to: 'discord' } }]]);
  });

  it('counts a crawler page as one crawler_view on mount', () => {
    renderSite(<CrawlerPage />, {
      path: '/crawlers/harry',
      routePath: '/crawlers/:id',
      status: { ...makeStatus(), appearances: {} },
    });
    expect(calls).toEqual([['crawler_view', { props: { crawler: 'harry' } }]]);
  });

  it('counts nothing for a crawler id the roster does not have', () => {
    renderSite(<CrawlerPage />, {
      path: '/crawlers/nobody',
      routePath: '/crawlers/:id',
      crawlers: makeCrawlers(),
    });
    expect(names()).toEqual([]);
  });
});
