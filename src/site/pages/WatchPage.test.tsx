// @vitest-environment jsdom
/**
 * `/watch` (011 §3.2): deepest floor first, newest episode first inside it, the
 * gate on both sides, and a heading for a floor nobody has reached yet.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { WatchPage } from './WatchPage';
import { siteCopy } from '../copy';
import { makeGatedShow, renderSite } from '../../test/renderSite';
import { makeShow } from '../../test/fixtures';

const LIVE_AT = '2026-10-10T17:00:00Z';
const gate = Date.parse(LIVE_AT);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('WatchPage', () => {
  it('reads the archive upward: the deepest floor first', () => {
    renderSite(<WatchPage />, { path: '/watch', now: gate });
    const floors = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(floors).toEqual(['Floor 2', 'Floor 1']);
  });

  it('puts the newest episode first inside a floor', () => {
    renderSite(<WatchPage />, { path: '/watch', now: gate });
    const floorOne = screen.getByRole('heading', { name: 'Floor 1' }).closest('section');
    const titles = within(floorOne as HTMLElement)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual([
      'Episode 2 - The Meat District',
      'Episode 1 - The World Dungeon',
    ]);
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

  it('carries its own head', () => {
    renderSite(<WatchPage />, { path: '/watch', now: gate });
    expect(document.title).toBe(siteCopy.pageTitle(siteCopy.watchTitle));
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toContain(
      '/watch',
    );
  });
});
