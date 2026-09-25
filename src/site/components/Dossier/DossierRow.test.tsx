// @vitest-environment jsdom
/**
 * The row (012 T1213), in both states.
 *
 * The locked half is the one that matters: it is a button with a neutral name,
 * it is the whole row rather than the pill, and - the requirement the whole
 * feature rests on - its markup is identical whatever card is behind it. The
 * death card and the merch card lock down to the same bytes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DossierRow } from './DossierRow';
import { siteCopy } from '../../copy';
import { makeDossier } from '../../../test/fixtures';
import type { DossierCard } from '../../../data/types';

const { dossier: copy } = siteCopy;
const [card] = makeDossier().updates;

/** A card about the one thing the locked state may never hint at. */
const deathCard: DossierCard = {
  episode: 1,
  floor: 1,
  kind: 'update',
  onCamera: true,
  title: 'The final broadcast from Floor Two',
  body: 'A memorial stream runs where the feed was.',
  chips: ['IN MEMORIAM'],
  level: 9,
  condition: 'deceased',
};

afterEach(cleanup);

function renderRow(props: Partial<Parameters<typeof DossierRow>[0]> = {}) {
  const onReveal = vi.fn();
  const view = render(
    <DossierRow
      card={card}
      revealed={false}
      onReveal={onReveal}
      characterName="Ronald Hudson"
      {...props}
    />,
  );
  return { ...view, onReveal };
}

describe('a locked row', () => {
  it('is one button with a neutral name and no content behind it', () => {
    renderRow();
    const row = screen.getByRole('button', { name: copy.revealAria(card.episode) });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(row).toHaveAttribute('tabindex', '0');
    expect(row).toHaveTextContent(copy.episodeTag(1));
    expect(row).toHaveTextContent(copy.locked);
    expect(row).toHaveTextContent(copy.reveal);
    // Nothing of the card itself, in text or in any attribute.
    expect(row.outerHTML).not.toContain(card.title);
    expect(row.outerHTML).not.toContain(card.body);
    expect(row.outerHTML).not.toContain(card.chips[0]);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('locks down to the same markup whatever the card says', () => {
    const ordinary = renderRow().container.innerHTML;
    cleanup();

    const { container } = render(
      <DossierRow card={deathCard} revealed={false} onReveal={vi.fn()} characterName="Someone" />,
    );
    expect(container.innerHTML).toBe(ordinary);
    expect(container.innerHTML).not.toMatch(/deceased|death|final|killed|memorial/i);
  });

  it('reveals on a click, on Enter and on Space', () => {
    const { onReveal, rerender } = renderRow();
    const row = screen.getByRole('button');

    fireEvent.click(row);
    expect(onReveal).toHaveBeenCalledWith(card.episode);

    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    expect(onReveal).toHaveBeenCalledTimes(3);

    // A key with no business here does nothing.
    fireEvent.keyDown(row, { key: 'ArrowDown' });
    expect(onReveal).toHaveBeenCalledTimes(3);

    rerender(<DossierRow card={card} revealed onReveal={onReveal} characterName="Ronald Hudson" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('a revealed row', () => {
  it('replaces the button with the card, tag column and all', () => {
    renderRow({ revealed: true });
    // The button is gone rather than expanded: there is nothing left to expand.
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('[aria-expanded]')).toBeNull();

    const heading = screen.getByRole('heading', { level: 3, name: card.title });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(screen.getByText(card.body)).toBeInTheDocument();
    expect(screen.getByText(copy.episodeTag(card.episode))).toBeInTheDocument();
    expect(screen.getByText(copy.update)).toBeInTheDocument();
    expect(screen.getByText(card.chips[0])).toBeInTheDocument();
  });

  it('tags a quiet card QUIET, in the same column, and prints its chips-free body', () => {
    const [, quiet] = makeDossier().updates;
    renderRow({ card: quiet, revealed: true });
    expect(screen.getByText(copy.quiet)).toBeInTheDocument();
    expect(screen.queryByText(copy.update)).toBeNull();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(quiet.title);
  });

  it('prints at most three chips', () => {
    renderRow({
      card: { ...card, chips: ['ONE', 'TWO', 'THREE', 'FOUR'] },
      revealed: true,
    });
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'ONE',
      'TWO',
      'THREE',
    ]);
  });
});
