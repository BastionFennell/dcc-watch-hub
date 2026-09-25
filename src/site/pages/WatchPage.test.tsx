// @vitest-environment jsdom
/**
 * `/watch` (011 §3.2, R3): oldest first - floors ascending, episodes ascending
 * inside a floor - with a jump to the newest row and a way back up, the gate on
 * both sides, and a heading for a floor nobody has reached yet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { WatchPage } from './WatchPage';
import { siteCopy } from '../copy';
import { makeGatedShow, renderSite } from '../../test/renderSite';
import { makeShow } from '../../test/fixtures';

const LIVE_AT = '2026-10-10T17:00:00Z';
const gate = Date.parse(LIVE_AT);

/* jsdom has no layout, so it has no `scrollIntoView` either (011 R3). */
const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('WatchPage', () => {
  it('reads the archive forward: the first floor first', () => {
    renderSite(<WatchPage />, { path: '/watch', now: gate });
    const floors = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(floors).toEqual(['Floor 1', 'Floor 2']);
  });

  it('puts the oldest episode first inside a floor', () => {
    renderSite(<WatchPage />, { path: '/watch', now: gate });
    const floorOne = screen.getByRole('heading', { name: 'Floor 1' }).closest('section');
    const titles = within(floorOne as HTMLElement)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual([
      'Episode 1 - The World Dungeon',
      'Episode 2 - The Meat District',
    ]);
  });

  it('orders every episode oldest first across floors', () => {
    const { container } = renderSite(<WatchPage />, { path: '/watch', now: gate });
    const rows = [...container.querySelectorAll('[data-testid^="episode-row-"]')].map((row) =>
      row.getAttribute('data-testid'),
    );
    expect(rows).toEqual(['episode-row-1', 'episode-row-2', 'episode-row-3']);
  });

  it('marks the newest row, anchors it, and jumps to it', () => {
    renderSite(<WatchPage />, { path: '/watch', now: gate });
    const newest = screen.getByTestId('episode-row-3');
    expect(newest).toHaveAttribute('id', 'ep-3');
    expect(within(newest).getByText(siteCopy.latestChip)).toBeInTheDocument();
    expect(screen.getByTestId('episode-row-1')).not.toHaveAttribute('id');

    fireEvent.click(screen.getByRole('button', { name: siteCopy.jumpToLatest }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(newest);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    expect(document.activeElement).toBe(within(newest).getByRole('link'));
  });

  it('offers the way back up at the bottom of the list', () => {
    renderSite(<WatchPage />, { path: '/watch', now: gate });
    expect(screen.getByRole('link', { name: siteCopy.backToTop })).toHaveAttribute('href', '#top');
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('id', 'top');
  });

  it('offers neither control when there is only one episode', () => {
    const show = makeShow();
    show.episodes = show.episodes.slice(0, 1);
    show.seasons[0].floors = [{ floor: 1, label: 'Floor 1', episodes: [1] }];
    renderSite(<WatchPage />, { show, path: '/watch', now: gate });
    expect(screen.queryByRole('button', { name: siteCopy.jumpToLatest })).toBeNull();
    expect(screen.queryByRole('link', { name: siteCopy.backToTop })).toBeNull();
  });

  it('gates the row: a countdown chip before, a feed link after', () => {
    const show = makeGatedShow(LIVE_AT);
    const { unmount } = renderSite(<WatchPage />, { show, path: '/watch', now: gate - 60 * 60 * 1000 });
    const row = screen.getByTestId('episode-row-3');
    expect(within(row).getByTestId('countdown-3')).toHaveTextContent(siteCopy.countdownChip('1h'));
    expect(within(row).getByRole('link')).toHaveTextContent(siteCopy.watchOnYouTube);
    unmount();

    renderSite(<WatchPage />, { show, path: '/watch', now: gate });
    const after = screen.getByTestId('episode-row-3');
    expect(within(after).queryByTestId('countdown-3')).toBeNull();
    expect(within(after).getByRole('link')).toHaveAttribute('href', '/ep/3');
  });

  it('keeps an empty floor, and says what it is', () => {
    const show = makeShow();
    show.seasons[0].floors.push({ floor: 3, label: 'Floor 3', episodes: [] });
    renderSite(<WatchPage />, { show, path: '/watch', now: gate });
    const floorThree = screen.getByRole('heading', { name: 'Floor 3' }).closest('section');
    expect(within(floorThree as HTMLElement).getByText('Floor 3 - the descent continues.'))
      .toBeInTheDocument();
    expect(within(floorThree as HTMLElement).queryByRole('link')).toBeNull();
  });

  it('says the archive once more as an ItemList of VideoObjects', () => {
    const { container } = renderSite(<WatchPage />, { path: '/watch', now: gate });
    const script = container.querySelector('script[type="application/ld+json"]');
    const ld = JSON.parse(script?.innerHTML ?? '{}');
    expect(ld['@type']).toBe('ItemList');
    expect(ld.itemListElement.map((entry: { item: { name: string } }) => entry.item.name)).toEqual([
      'Episode 1 - The World Dungeon',
      'Episode 2 - The Meat District',
      'Episode 3 - Descent',
    ]);
  });

  it('carries its own head', () => {
    renderSite(<WatchPage />, { path: '/watch', now: gate });
    expect(document.title).toBe(siteCopy.pageTitle(siteCopy.watchTitle));
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toContain(
      '/watch',
    );
  });
});
