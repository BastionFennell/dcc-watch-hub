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
import type { CrawlerRoster, DossierFile, Show, StatusFile } from '../data/types';
import { makeCrawlers, makeDossier, makeShow, makeStatus } from './fixtures';

export interface RenderSiteOptions {
  /** The route to mount at; also the payload's `route`. */
  path?: string;
  show?: Show | null;
  crawlers?: CrawlerRoster | null;
  status?: StatusFile | null;
  /**
   * 012: the compiled dossier the payload carries. Defaults to one for the
   * crawler in `path`, which is what a prerendered `/crawlers/:id` carries -
   * pass `null` for the launch state (a deploy with no cards yet).
   */
  dossier?: DossierFile | null;
  /** Epoch ms the clock is pinned to for this render. */
  now?: number;
  /**
   * Mount the page under a route pattern, for a page that reads `useParams`.
   * Without it the page is rendered directly, which is all a static route needs.
   */
  routePath?: string;
}

/**
 * The dossier a prerendered page would carry: one for `/crawlers/:id`, none
 * anywhere else. Without it every crawler-page test would go to the network
 * for a file that is generated at build time.
 */
function dossierIn(path: string): DossierFile | null {
  const id = /^\/crawlers\/([^/]+)$/.exec(path)?.[1];
  return id === undefined ? null : makeDossier(id);
}

export function renderSite(ui: ReactNode, options: RenderSiteOptions = {}) {
  const {
    path = '/',
    show = makeShow(),
    crawlers = makeCrawlers(),
    status = makeStatus(),
    dossier = dossierIn(path),
    now,
    routePath,
  } = options;

  if (now !== undefined) {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  }

  const embedded = { route: path, show, crawlers, status, dossier };
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

/**
 * `makeShow()` with a `hubLiveAt` on one episode, for gate tests: the newest by
 * default (the watch rows and the latest card), or `which: 'first'` for the home
 * hero, which points at the opener.
 */
export function makeGatedShow(hubLiveAt: string, which: 'newest' | 'first' = 'newest'): Show {
  const show = makeShow();
  const target =
    which === 'first'
      ? show.episodes.reduce((a, b) => (b.id < a.id ? b : a))
      : show.episodes[show.episodes.length - 1];
  target.hubLiveAt = hubLiveAt;
  target.summary = 'The stairs down are open.';
  return show;
}
