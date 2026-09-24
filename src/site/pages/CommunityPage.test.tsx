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
    expect(screen.getByTestId('social-row')).toBeInTheDocument();
    expect(screen.getByText('New crawls every other week.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: siteCopy.supportTitle })).toBeInTheDocument();
    expect(screen.getByText(siteCopy.supportBody)).toBeInTheDocument();
  });

  it('carries its own head', () => {
    renderSite(<CommunityPage />, { path: '/community' });
    expect(document.title).toBe(siteCopy.pageTitle(siteCopy.navCommunity));
  });
});
