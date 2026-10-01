// @vitest-environment jsdom
/**
 * One component, three renders (011 §4). The assertions here are about what
 * each render is *for*: the card is a link, the hero is a headline, and the OG
 * frame is a picture with the brand on it.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { RosterCard } from './RosterCard';
import { siteCopy } from '../copy';
import { makeCrawlers } from '../../test/fixtures';

const [stuntman] = makeCrawlers().crawlers;

function renderCard(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('RosterCard card', () => {
  it('is a single link to the crawler, naming both the archetype and the character', () => {
    renderCard(<RosterCard profile={stuntman} variant="card" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/crawlers/stuntman');
    expect(within(link).getByText(stuntman.name)).toBeInTheDocument();
    expect(within(link).getByText(stuntman.characterName)).toBeInTheDocument();
  });

  it('takes an explicit href when one is given', () => {
    renderCard(<RosterCard profile={stuntman} variant="card" href="/elsewhere" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/elsewhere');
  });

  it('never shows a level pill, even with live status (author, 2026-09-25)', () => {
    renderCard(<RosterCard profile={stuntman} variant="card" />);
    expect(screen.queryByText(/^Lv /)).toBeNull();
  });

  /* 012: condition is not a property of the roster, so no render of this
     component carries a word about it. */
  it('carries no status pill at all', () => {
    renderCard(<RosterCard profile={stuntman} variant="card" />);
    expect(screen.getByRole('link').textContent).not.toMatch(
      /alive|dead|deceased|fused|unknown/i,
    );
  });

  it('defers its art: every roster card is below the fold', () => {
    renderCard(<RosterCard profile={stuntman} variant="card" />);
    expect(screen.getByRole('link').querySelector('img')).toHaveAttribute('loading', 'lazy');
  });
});

describe('RosterCard hero', () => {
  it('is the page headline, with the handle under it', () => {
    renderCard(<RosterCard profile={stuntman} variant="hero" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(stuntman.characterName);
    expect(screen.getByText(stuntman.handle)).toBeInTheDocument();
  });

  it('uses the full-body art and loads it eagerly', () => {
    renderCard(<RosterCard profile={stuntman} variant="hero" />);
    const art = screen.getByAltText(stuntman.characterName);
    expect(art).toHaveAttribute('src', stuntman.art.full);
    expect(art).toHaveAttribute('loading', 'eager');
  });

  it('falls back to the bust when there is no full-body art', () => {
    const noArt = { ...stuntman, art: { bust: stuntman.art.bust } };
    renderCard(<RosterCard profile={noArt} variant="hero" />);
    expect(screen.getByAltText(stuntman.characterName)).toHaveAttribute('src', stuntman.art.bust);
  });

  /* 012 deleted StatusLine: level, HP and floor are the dossier's to report,
     per episode, inside a card the reader opened. */
  it('carries no live line', () => {
    const { container } = renderCard(<RosterCard profile={stuntman} variant="hero" />);
    expect(screen.queryByTestId('status-line')).toBeNull();
    expect(container.textContent).not.toMatch(/HB|Floor \d/);
  });
});

describe('RosterCard og', () => {
  it('carries the name, the handle, the hook and the brand mark', () => {
    renderCard(<RosterCard profile={stuntman} variant="og" hook="A one-line hook." />);
    expect(screen.getByText(stuntman.name)).toBeInTheDocument();
    expect(screen.getByText(stuntman.characterName)).toBeInTheDocument();
    expect(screen.getByText(stuntman.handle)).toBeInTheDocument();
    expect(screen.getByText('A one-line hook.')).toBeInTheDocument();
    expect(screen.getByText(siteCopy.siteName)).toBeInTheDocument();
  });

  it('loads its art eagerly, because the renderer shoots on network idle', () => {
    const { container } = renderCard(<RosterCard profile={stuntman} variant="og" />);
    for (const img of container.querySelectorAll('img')) {
      expect(img).toHaveAttribute('loading', 'eager');
    }
  });
});
