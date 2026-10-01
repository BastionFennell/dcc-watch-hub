// @vitest-environment jsdom
/**
 * The small pieces every front-door page is built from (011 §3, §6): the one
 * announce style, the platform row and the footer. The live line went with
 * StatusLine in 012 - level, HP and floor are the dossier's to report now.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SiteFooter } from './SiteFooter';
import { SocialRow } from './SocialRow';
import { SystemBox } from './SystemBox';
import { siteCopy } from '../copy';
import { copy } from '../../copy';
import { makeShow } from '../../test/fixtures';

describe('SystemBox', () => {
  it('is the System speaking: the tag, a title, the text and an optional reward', () => {
    render(
      <SystemBox title="Method Acting" footer={siteCopy.reward('Golden Monster Box', 'Liquid Latex')}>
        <p>You committed to the bit.</p>
      </SystemBox>,
    );
    expect(screen.getByText(copy.systemTag)).toBeInTheDocument();
    expect(screen.getByText('Method Acting')).toBeInTheDocument();
    expect(screen.getByText('You committed to the bit.')).toBeInTheDocument();
    expect(screen.getByText('Reward: Golden Monster Box → Liquid Latex')).toBeInTheDocument();
  });

  it('has no footer rule when there is nothing to put in it', () => {
    render(<SystemBox title="No reward">Nothing paid out.</SystemBox>);
    expect(screen.getByTestId('system-box').textContent).not.toContain('Reward');
  });
});

describe('SocialRow', () => {
  it('shows only the platforms the show actually has', () => {
    render(<SocialRow links={makeShow().links} />);
    expect(screen.getByRole('link', { name: siteCopy.platform.youtube })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: siteCopy.platform.discord })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: siteCopy.platform.tiktok })).toBeNull();
  });

  it('claims identity and opens safely on every link', () => {
    render(<SocialRow links={{ ...makeShow().links, bluesky: 'https://bsky.app/profile/x' }} />);
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('rel', 'me noopener');
      expect(link).toHaveAttribute('target', '_blank');
    }
    expect(screen.getByRole('link', { name: siteCopy.platform.bluesky })).toHaveAttribute(
      'href',
      'https://bsky.app/profile/x',
    );
  });

  it('keeps the pill row by default and switches to tiles on request', () => {
    const { rerender } = render(<SocialRow links={makeShow().links} />);
    expect(screen.getByTestId('social-row')).toHaveAttribute('data-variant', 'pills');
    rerender(<SocialRow links={makeShow().links} variant="tiles" />);
    const tiles = screen.getByTestId('social-row');
    expect(tiles).toHaveAttribute('data-variant', 'tiles');
    // The tiles are the same links: identity claim and safe target are unchanged.
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('rel', 'me noopener');
      expect(link).toHaveAttribute('target', '_blank');
    }
  });

  it('renders nothing at all when the show has no links', () => {
    render(<SocialRow links={{ youtube: '', discord: '' }} />);
    expect(screen.queryByTestId('social-row')).toBeNull();
  });
});

describe('SiteFooter', () => {
  it('repeats the nav and carries the disclaimer the show must show', () => {
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: siteCopy.navWatch })).toHaveAttribute('href', '/watch');
    expect(screen.getByRole('link', { name: siteCopy.navCrawlers })).toHaveAttribute(
      'href',
      '/crawlers',
    );
    expect(screen.getByRole('link', { name: siteCopy.navCommunity })).toHaveAttribute(
      'href',
      '/community',
    );
    expect(
      screen.getByText('Not affiliated with Matt Dinniman or Renegade Game Studios.'),
    ).toBeInTheDocument();
  });
});
