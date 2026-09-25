// @vitest-environment jsdom
/**
 * `/crawlers/:id` (011 §3.4): the hero, the concept, the pockets, the entry
 * achievement as the page's one System box, the player, the appearances derived
 * on the client, and the prev/next pair that walks the roster.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { CrawlerPage } from './CrawlerPage';
import { siteCopy } from '../copy';
import { copy } from '../../copy';
import { renderSite } from '../../test/renderSite';
import { makeCrawlers, makeEpisodeRaw, makeShow, makeStatus } from '../../test/fixtures';

const [stuntman] = makeCrawlers().crawlers;

/** Every episode file answers with the fixture party (stuntman and harry). */
function stubEpisodes() {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const id = Number(/ep(\d+)\.json/.exec(String(input))?.[1] ?? 1);
    return Promise.resolve(
      new Response(JSON.stringify(makeEpisodeRaw(id)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
}

beforeEach(() => stubEpisodes());

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function renderCrawler(id = 'stuntman') {
  return renderSite(<CrawlerPage />, { path: `/crawlers/${id}`, routePath: '/crawlers/:id' });
}

describe('CrawlerPage', () => {
  it('opens on the hero: archetype, character, handle, status and the live line', () => {
    renderCrawler();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(stuntman.characterName);
    expect(screen.getByText(stuntman.name)).toBeInTheDocument();
    expect(screen.getByText(stuntman.handle)).toBeInTheDocument();
    expect(screen.getByText(siteCopy.statusLabel.alive)).toBeInTheDocument();
    expect(screen.getByTestId('status-line')).toHaveTextContent('Level 3 · 18/24 HB · Floor 1');
  });

  it('hides the live line for a crawler the build has no status for', () => {
    renderSite(<CrawlerPage />, {
      path: '/crawlers/stuntman',
      routePath: '/crawlers/:id',
      status: null,
    });
    expect(screen.queryByTestId('status-line')).toBeNull();
  });

  it('states the concept and lists the pockets', () => {
    renderCrawler();
    expect(screen.getByText(stuntman.concept)).toBeInTheDocument();
    const pockets = screen.getByRole('heading', { name: siteCopy.pocketsTitle }).closest('section');
    expect(within(pockets as HTMLElement).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(stuntman.pockets);
  });

  it('renders the entry achievement as the page\'s System box, reward and all', () => {
    renderCrawler();
    const box = screen.getByTestId('system-box');
    expect(within(box).getByText('Method Acting')).toBeInTheDocument();
    expect(within(box).getByText('You committed to the bit.')).toBeInTheDocument();
    expect(within(box).getByText('Reward: Golden Monster Box → Liquid Latex')).toBeInTheDocument();
    // One announce style, used once: the box is what makes it mean something.
    expect(screen.getAllByTestId('system-box')).toHaveLength(1);
  });

  it('omits the achievement section entirely when there is none', () => {
    const roster = makeCrawlers();
    delete roster.crawlers[0].entryAchievement;
    renderSite(<CrawlerPage />, {
      path: '/crawlers/stuntman',
      routePath: '/crawlers/:id',
      crawlers: roster,
    });
    expect(screen.queryByTestId('system-box')).toBeNull();
    expect(screen.queryByRole('heading', { name: siteCopy.entryAchievementTitle })).toBeNull();
  });

  it('introduces the player behind the crawler', () => {
    renderCrawler();
    const player = screen.getByRole('heading', { name: siteCopy.playerTitle }).closest('section');
    expect(within(player as HTMLElement).getAllByText(/Danny/).length).toBeGreaterThan(0);
    expect(within(player as HTMLElement).getByText('he/him')).toBeInTheDocument();
    expect(within(player as HTMLElement).getByText('Two sentences about Danny.')).toBeInTheDocument();
  });

  it('fills in the appearances after mount, and not before', async () => {
    renderCrawler();
    // Nothing on the first render: that is the render the prerendered HTML is
    // compared against (011, `useAppearances`).
    expect(screen.queryByRole('heading', { name: siteCopy.appearsInTitle })).toBeNull();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: siteCopy.appearsInTitle })).toBeInTheDocument(),
    );
    const section = screen.getByRole('heading', { name: siteCopy.appearsInTitle }).closest('section');
    expect(within(section as HTMLElement).getAllByRole('heading', { level: 3 })).toHaveLength(
      makeShow().episodes.length,
    );
  });

  it('prefers the appearances the build precomputed, and fetches nothing', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderSite(<CrawlerPage />, {
      path: '/crawlers/stuntman',
      routePath: '/crawlers/:id',
      status: { ...makeStatus(), appearances: { stuntman: [1, 3] } },
    });

    // First render, no waiting: that is what makes the list survive hydration.
    const section = screen
      .getByRole('heading', { name: siteCopy.appearsInTitle })
      .closest('section');
    expect(
      within(section as HTMLElement)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Episode 1 - The World Dungeon', 'Episode 3 - Descent']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows no appearances section for a crawler the build never saw', () => {
    renderSite(<CrawlerPage />, {
      path: '/crawlers/stuntman',
      routePath: '/crawlers/:id',
      status: { ...makeStatus(), appearances: { harry: [1] } },
    });
    expect(screen.queryByRole('heading', { name: siteCopy.appearsInTitle })).toBeNull();
  });

  it('walks the roster with prev/next links', () => {
    const { unmount } = renderCrawler('stuntman');
    expect(screen.queryByRole('link', { name: new RegExp(siteCopy.prevCrawler) })).toBeNull();
    expect(screen.getByRole('link', { name: new RegExp(siteCopy.nextCrawler) })).toHaveAttribute(
      'href',
      '/crawlers/harry',
    );
    unmount();

    renderCrawler('harry');
    expect(screen.getByRole('link', { name: new RegExp(siteCopy.prevCrawler) })).toHaveAttribute(
      'href',
      '/crawlers/stuntman',
    );
    expect(screen.queryByRole('link', { name: new RegExp(siteCopy.nextCrawler) })).toBeNull();
  });

  it('gives an unknown crawler the System not-found page', () => {
    renderCrawler('nobody');
    expect(screen.getByText(copy.notFoundTitle)).toBeInTheDocument();
  });

  it('shares as a profile, with the crawler card as the image', () => {
    renderCrawler();
    expect(document.title).toBe(siteCopy.pageTitle(stuntman.characterName));
    expect(document.querySelector('meta[property="og:type"]')).toHaveAttribute('content', 'profile');
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toContain(
      '/og/crawler-stuntman.png',
    );
  });
});
