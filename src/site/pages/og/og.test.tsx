// @vitest-environment jsdom
/**
 * The share-image routes (011 §4). `scripts/og.mjs` shoots whatever carries
 * `[data-og-frame]` and skips anything that does not, so that attribute is the
 * contract these tests are about.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { OgCrawlerPage } from './OgCrawlerPage';
import { OgEpisodePage } from './OgEpisodePage';
import { OgSitePage } from './OgSitePage';
import { ogRoutes } from './ogRoutes';
import { siteCopy } from '../../copy';
import { renderSite } from '../../../test/renderSite';
import { makeCrawlers } from '../../../test/fixtures';

const [stuntman] = makeCrawlers().crawlers;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ogRoutes', () => {
  it('is the list Wave C spreads into the router', () => {
    expect(ogRoutes.map((route) => route.path)).toEqual([
      '/_og/site',
      '/_og/crawler/:id',
      '/_og/episode/:id',
    ]);
    for (const route of ogRoutes) expect(typeof route.Component).toBe('function');
  });
});

describe('OgCrawlerPage', () => {
  it('frames the roster card, hook and all', () => {
    const { container } = renderSite(<OgCrawlerPage />, {
      path: '/_og/crawler/stuntman',
      routePath: '/_og/crawler/:id',
    });
    expect(container.querySelector('[data-og-frame]')).not.toBeNull();
    expect(screen.getByText(stuntman.characterName)).toBeInTheDocument();
    expect(screen.getByText(stuntman.concept)).toBeInTheDocument();
    expect(screen.getByText(siteCopy.siteName)).toBeInTheDocument();
  });

  it('renders no frame for an unknown crawler, so the shot is skipped', () => {
    const { container } = renderSite(<OgCrawlerPage />, {
      path: '/_og/crawler/nobody',
      routePath: '/_og/crawler/:id',
    });
    expect(container.querySelector('[data-og-frame]')).toBeNull();
  });

  it('takes the scrollbars off the document while it is mounted', () => {
    const { unmount } = renderSite(<OgCrawlerPage />, {
      path: '/_og/crawler/stuntman',
      routePath: '/_og/crawler/:id',
    });
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
  });
});

describe('OgEpisodePage', () => {
  it('frames the episode number, floor, title and summary', () => {
    const { container } = renderSite(<OgEpisodePage />, {
      path: '/_og/episode/1',
      routePath: '/_og/episode/:id',
    });
    expect(container.querySelector('[data-og-frame]')).not.toBeNull();
    expect(screen.getByText(siteCopy.episodeLabel(1))).toBeInTheDocument();
    expect(screen.getByText(siteCopy.floorLabel(1))).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Episode 1 - The World Dungeon',
    );
  });

  it('renders no frame for an id the show does not have', () => {
    const { container } = renderSite(<OgEpisodePage />, {
      path: '/_og/episode/99',
      routePath: '/_og/episode/:id',
    });
    expect(container.querySelector('[data-og-frame]')).toBeNull();
  });
});

describe('OgSitePage', () => {
  it('frames the mark, the tagline and the pitch', () => {
    const { container } = renderSite(<OgSitePage />, { path: '/_og/site' });
    expect(container.querySelector('[data-og-frame]')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Heart and chaos in the World Dungeon.',
    );
    expect(screen.getByText(/Five people from a film crew/)).toBeInTheDocument();
  });

  it('loads its art eagerly, so the renderer sees it before network idle', () => {
    const { container } = renderSite(<OgSitePage />, { path: '/_og/site' });
    for (const img of container.querySelectorAll('img')) {
      expect(img).toHaveAttribute('loading', 'eager');
    }
  });
});
