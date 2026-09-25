// @vitest-environment jsdom
/**
 * `/community` (011 §3.5): the URL every social bio points at. Discord first,
 * then everywhere else, then the cadence, then the one paragraph about support.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { CommunityPage } from './CommunityPage';
import { siteCopy } from '../copy';
import { renderSite } from '../../test/renderSite';
import { makeShow } from '../../test/fixtures';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CommunityPage', () => {
  it('leads with the Discord button', () => {
    renderSite(<CommunityPage />, { path: '/community' });
    const cta = screen.getByRole('link', { name: siteCopy.discordCta });
    expect(cta).toHaveAttribute('href', makeShow().links.discord);
    expect(cta).toHaveAttribute('target', '_blank');
    expect(cta).toHaveAttribute('rel', 'noopener');
  });

  it('carries the platform row, the cadence and the support paragraph', () => {
    renderSite(<CommunityPage />, { path: '/community' });
    // The platforms are the tile grid here, not the inline pill row (011 R2 polish).
    expect(screen.getByTestId('social-row')).toHaveAttribute('data-variant', 'tiles');
    // The cadence is a chip beside the heading, not a line adrift under the row.
    const cadence = screen.getByText('New crawls every other week.');
    expect(cadence).toBeInTheDocument();
    expect(cadence.previousElementSibling).toBe(
      screen.getByRole('heading', { name: siteCopy.followTitle }),
    );
    // The closing paragraph has no heading (author copy, 2026-09-25); the landmark is named instead.
    expect(screen.getByRole('region', { name: siteCopy.supportAria })).toBeInTheDocument();
    expect(screen.getByText(siteCopy.supportBody)).toBeInTheDocument();
    expect(screen.getByText(siteCopy.communityDiscordBody)).toBeInTheDocument();
  });

  it('carries its own head', () => {
    renderSite(<CommunityPage />, { path: '/community' });
    expect(document.title).toBe(siteCopy.pageTitle(siteCopy.navCommunity));
  });
});
