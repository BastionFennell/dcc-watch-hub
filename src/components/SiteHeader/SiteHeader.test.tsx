// @vitest-environment jsdom
/**
 * One header, two jobs (011 §1, T1123): the site nav is on every route, and the
 * hub's own controls - the episode-context slot, the Codex link and the show
 * channels - only appear while the viewer is inside the broadcast.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SiteHeader } from './SiteHeader';
import { isHubRoute } from './hubRoutes';
import { copy } from '../../copy';
import { siteCopy } from '../../site/copy';
import { makeShow } from '../../test/fixtures';

const show = makeShow();
const episode = show.episodes[0];

function renderHeader(path: string, current = path.startsWith('/ep/') ? episode : undefined) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SiteHeader show={show} current={current} />
    </MemoryRouter>,
  );
}

describe('isHubRoute', () => {
  it('is the broadcast, the Codex and the Studio, and nothing else', () => {
    for (const path of ['/ep/1', '/ep/12?t=30', '/codex', '/registry', '/studio', '/studio/ep/1']) {
      expect(isHubRoute(path)).toBe(true);
    }
    for (const path of ['/', '/watch', '/crawlers', '/crawlers/harry', '/community']) {
      expect(isHubRoute(path)).toBe(false);
    }
  });
});

describe('SiteHeader', () => {
  it('carries the site nav on a marketing route', () => {
    renderHeader('/');
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('link', { name: siteCopy.navWatch })).toHaveAttribute(
      'href',
      '/watch',
    );
    expect(within(banner).getByRole('link', { name: siteCopy.navCrawlers })).toHaveAttribute(
      'href',
      '/crawlers',
    );
    expect(within(banner).getByRole('link', { name: siteCopy.navCommunity })).toHaveAttribute(
      'href',
      '/community',
    );
  });

  it('carries the same site nav on a hub route', () => {
    renderHeader('/ep/1');
    const banner = screen.getByRole('banner');
    for (const name of [siteCopy.navWatch, siteCopy.navCrawlers, siteCopy.navCommunity]) {
      expect(within(banner).getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('marks the current section', () => {
    renderHeader('/crawlers');
    expect(screen.getByRole('link', { name: siteCopy.navCrawlers })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('keeps the mark pointed at the front door', () => {
    renderHeader('/watch');
    expect(screen.getByRole('link', { name: new RegExp(copy.siteTitle) })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('hides the hub controls off a hub route', () => {
    renderHeader('/');
    const banner = screen.getByRole('banner');
    expect(within(banner).queryByRole('link', { name: copy.youtube })).toBeNull();
    expect(within(banner).queryByRole('link', { name: copy.discord })).toBeNull();
    expect(within(banner).queryByRole('link', { name: copy.registry })).toBeNull();
    expect(within(banner).queryByRole('navigation', { name: copy.episodes })).toBeNull();
  });

  it('shows the hub controls and the episode slot on a hub route', () => {
    renderHeader('/ep/1');
    const banner = screen.getByRole('banner');
    expect(within(banner).getAllByRole('link', { name: copy.youtube }).length).toBeGreaterThan(0);
    expect(within(banner).getAllByRole('link', { name: copy.registry }).length).toBeGreaterThan(0);
    expect(within(banner).getByText(copy.episodeLabel(1, 1, 1))).toBeInTheDocument();
  });

  it('leaves the episode slot empty on the Codex, which has no episode', () => {
    renderHeader('/codex', undefined);
    const banner = screen.getByRole('banner');
    expect(within(banner).getAllByRole('link', { name: copy.registry }).length).toBeGreaterThan(0);
    expect(within(banner).queryByText(copy.episodeLabel(1, 1, 1))).toBeNull();
  });
});
