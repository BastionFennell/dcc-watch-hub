// @vitest-environment jsdom
/**
 * `/crawlers` (011 §3.3). The chips are the interesting rule: a roster where
 * everyone is alive gets none, because a filter that cannot filter is chrome.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { CrawlersPage } from './CrawlersPage';
import { siteCopy } from '../copy';
import { renderSite } from '../../test/renderSite';
import { makeCrawlers } from '../../test/fixtures';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** The fixture roster with Harry killed off, so two statuses exist. */
function mixedRoster() {
  const roster = makeCrawlers();
  roster.crawlers[1] = { ...roster.crawlers[1], status: 'dead' };
  return roster;
}

describe('CrawlersPage', () => {
  it('links every crawler from the grid', () => {
    renderSite(<CrawlersPage />, { path: '/crawlers' });
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href) => href?.startsWith('/crawlers/'));
    expect(hrefs).toEqual(['/crawlers/stuntman', '/crawlers/harry']);
  });

  it('shows no filter chips while every crawler shares one status', () => {
    renderSite(<CrawlersPage />, { path: '/crawlers' });
    expect(screen.queryByRole('group', { name: siteCopy.filterLabel })).toBeNull();
  });

  it('offers chips once the roster has more than one status, and filters on them', () => {
    renderSite(<CrawlersPage />, { path: '/crawlers', crawlers: mixedRoster() });
    const chips = screen.getByRole('group', { name: siteCopy.filterLabel });
    expect(chips).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: siteCopy.statusLabel.dead }));
    expect(screen.getByRole('link', { name: /Harold/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ronald/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: siteCopy.filterAll }));
    expect(screen.getByRole('link', { name: /Ronald/ })).toBeInTheDocument();
  });

  it('carries its own head', () => {
    renderSite(<CrawlersPage />, { path: '/crawlers' });
    expect(document.title).toBe(siteCopy.pageTitle(siteCopy.crawlersTitle));
  });
});
