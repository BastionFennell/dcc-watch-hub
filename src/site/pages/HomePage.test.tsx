// @vitest-environment jsdom
/**
 * `/` (011 §3.1): the order a stranger reads it in, the CTA on both sides of
 * `hubLiveAt`, and the latest-episode card that only earns its place once a
 * trailer is configured.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { HomePage } from './HomePage';
import { siteCopy } from '../copy';
import { makeGatedShow, renderSite } from '../../test/renderSite';
import { makeShow } from '../../test/fixtures';

const LIVE_AT = '2026-10-10T17:00:00Z';
const gate = Date.parse(LIVE_AT);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('HomePage', () => {
  it('leads with the eyebrow, the tagline and the pitch', () => {
    renderSite(<HomePage />, { now: gate });
    expect(screen.getByText(siteCopy.heroEyebrow)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Heart and chaos in the World Dungeon.',
    );
    expect(screen.getByText(/Five people from a film crew/)).toBeInTheDocument();
  });

  it('sends the primary CTA to YouTube before the gate, with the archive beside it', () => {
    renderSite(<HomePage />, { show: makeGatedShow(LIVE_AT, 'first'), now: gate - 1 });
    const primary = screen.getByRole('link', { name: siteCopy.watchOnYouTube });
    expect(primary).toHaveAttribute('data-variant', 'primary');
    expect(primary.getAttribute('href')).toContain('youtube.com/watch');
    // The feed is shut, so the second button cannot point at it (011 §2.1).
    expect(screen.getByRole('link', { name: siteCopy.browseEveryEpisode })).toHaveAttribute(
      'href',
      '/watch',
    );
    expect(screen.queryByRole('link', { name: siteCopy.openSystemFeed })).toBeNull();
  });

  it('flips to the System feed on the gate, with YouTube as the second button', () => {
    // The hero targets the opener, not the newest episode (author, 2026-09-25).
    renderSite(<HomePage />, { show: makeGatedShow(LIVE_AT, 'first'), now: gate });
    const primary = screen.getByRole('link', { name: siteCopy.openSystemFeed });
    expect(primary).toHaveAttribute('href', '/ep/1');
    expect(primary).toHaveAttribute('data-variant', 'primary');
    const secondary = screen.getByRole('link', { name: siteCopy.watchOnYouTube });
    expect(secondary).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('link', { name: siteCopy.browseEveryEpisode })).toBeNull();
  });

  it('embeds the newest episode and hides the latest card when no trailer is configured', () => {
    const { container } = renderSite(<HomePage />, { now: gate });
    expect(screen.queryByRole('heading', { name: siteCopy.latestEpisodeTitle })).toBeNull();
    expect(container.querySelector('[data-testid="trailer"] img')).toHaveAttribute(
      'src',
      `https://i.ytimg.com/vi/${makeShow().episodes[2].youtubeId}/hqdefault.jpg`,
    );
  });

  it('shows the latest card once a trailer takes the hero embed', () => {
    const show = { ...makeShow(), trailerYoutubeId: 'TRAILERID00' };
    const { container } = renderSite(<HomePage />, { show, now: gate });
    expect(screen.getByRole('heading', { name: siteCopy.latestEpisodeTitle })).toBeInTheDocument();
    expect(screen.getByTestId('episode-row-3')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="trailer"] img')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/TRAILERID00/hqdefault.jpg',
    );
  });

  it('links every roster card at its crawler page', () => {
    renderSite(<HomePage />, { now: gate });
    const roster = screen.getByRole('heading', { name: siteCopy.meetTheCrawlersTitle }).closest('section');
    const links = within(roster as HTMLElement).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/crawlers/stuntman',
      '/crawlers/harry',
    ]);
  });

  it('closes with the newcomer System box, the Discord card and the footer', () => {
    renderSite(<HomePage />, { now: gate });
    const box = screen.getByTestId('system-box');
    expect(within(box).getByText(siteCopy.newcomerTitle)).toBeInTheDocument();
    expect(within(box).getByRole('link', { name: siteCopy.newcomerLink })).toHaveAttribute(
      'href',
      makeShow().links.youtube,
    );
    expect(screen.getByRole('heading', { name: siteCopy.discordTitle })).toBeInTheDocument();
    expect(screen.getByText('New crawls every other week.')).toBeInTheDocument();
    expect(screen.getByTestId('social-row')).toBeInTheDocument();
    expect(screen.getByText(siteCopy.footerDisclaimer)).toBeInTheDocument();
  });

  it('describes itself with the show pitch and the site share card', () => {
    renderSite(<HomePage />, { now: gate });
    expect(document.title).toBe(siteCopy.defaultTitle);
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toContain(
      '/og/site.png',
    );
  });
});
