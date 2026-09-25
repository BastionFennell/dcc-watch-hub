/**
 * Mounting a front-door page the way a prerendered page mounts (011): both
 * providers seeded from one `__DCC__`-shaped payload, so nothing fetches and
 * the test renders exactly what the server would have.
 *
 * `now` pins the clock before the render, because every time-dependent surface
 * on the front door reads it through `useNow` after mount.
 */
import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';
import { ShowProvider } from '../data/ShowContext';
import { CrawlersProvider } from '../data/CrawlersContext';
import type { CrawlerRoster, Show, StatusFile } from '../data/types';
import { makeCrawlers, makeShow, makeStatus } from './fixtures';

export interface RenderSiteOptions {
  /** The route to mount at; also the payload's `route`. */
  path?: string;
  show?: Show | null;
  crawlers?: CrawlerRoster | null;
  status?: StatusFile | null;
  /** Epoch ms the clock is pinned to for this render. */
  now?: number;
  /**
   * Mount the page under a route pattern, for a page that reads `useParams`.
   * Without it the page is rendered directly, which is all a static route needs.
   */
  routePath?: string;
}

export function renderSite(ui: ReactNode, options: RenderSiteOptions = {}) {
  const {
    path = '/',
    show = makeShow(),
    crawlers = makeCrawlers(),
    status = makeStatus(),
    now,
    routePath,
  } = options;

  if (now !== undefined) {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  }

  const embedded = { route: path, show, crawlers, status };
  const element =
    routePath === undefined ? ui : <Routes><Route path={routePath} element={ui} /></Routes>;

  return render(
    <MemoryRouter initialEntries={[path]}>
      <ShowProvider embedded={embedded}>
        <CrawlersProvider embedded={embedded}>{element}</CrawlersProvider>
      </ShowProvider>
    </MemoryRouter>,
  );
}

/** `makeShow()` with a `hubLiveAt` on the newest episode, for gate tests. */
export function makeGatedShow(hubLiveAt: string): Show {
  const show = makeShow();
  const newest = show.episodes[show.episodes.length - 1];
  newest.hubLiveAt = hubLiveAt;
  newest.summary = 'The stairs down are open.';
  return show;
}
