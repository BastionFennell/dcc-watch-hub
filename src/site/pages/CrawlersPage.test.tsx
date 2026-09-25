// @vitest-environment jsdom
/**
 * `/crawlers` (011 §3.3). 012 took the status filter chips out: they filtered
 * on a roster field that no longer exists, and a row of chips reading
 * "Alive / Dead" is a spoiler served to everyone who lands here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { CrawlersPage } from './CrawlersPage';
import { siteCopy } from '../copy';
import { renderSite } from '../../test/renderSite';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CrawlersPage', () => {
  it('links every crawler from the grid', () => {
    renderSite(<CrawlersPage />, { path: '/crawlers' });
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href) => href?.startsWith('/crawlers/'));
    expect(hrefs).toEqual(['/crawlers/stuntman', '/crawlers/harry']);
  });

  /*
   * 012: nothing here filters, and nothing here says who is still standing.
   * Every crawler is in the grid, in roster order, always.
   */
  it('offers no status filter, and names no condition anywhere', () => {
    renderSite(<CrawlersPage />, { path: '/crawlers' });
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/alive|dead|deceased|fused/i);
  });

  it('carries its own head', () => {
    renderSite(<CrawlersPage />, { path: '/crawlers' });
    expect(document.title).toBe(siteCopy.pageTitle(siteCopy.crawlersTitle));
  });
});
