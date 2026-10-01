// @vitest-environment jsdom
/**
 * The dossier panel (012 T1214, T1216-T1219).
 *
 * Four things are being defended here, in this order of importance:
 *  1. the locked panel of two different crawlers is the same document apart
 *     from their name and id (T1216);
 *  2. nothing a card says - and no word from the death register - is in the
 *     DOM before the reader opens it (T1217);
 *  3. every card opens from the keyboard, and focus lands on what arrived
 *     (T1218);
 *  4. the reveals last exactly as long as the visit - a remount starts fully
 *     locked, and the panel never touches storage at all (T1219, superseded:
 *     the author dropped the reveal store on 2026-09-25).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Dossier } from './Dossier';
import { siteCopy } from '../../copy';
import { makeCrawlers, makeDossier } from '../../../test/fixtures';
import type { CrawlerProfile, DossierCard, DossierFile } from '../../../data/types';

const { dossier: copy } = siteCopy;
const [ronald, harold] = makeCrawlers().crawlers;

/** The words a locked panel may never contain, in any form (brief, criterion 3). */
const FORBIDDEN = /deceased|death|final|killed|memorial/i;

/** A dossier whose last card is the one the feature exists to keep quiet. */
function withDeath(id: string): DossierFile {
  const file = makeDossier(id);
  const last: DossierCard = {
    ...file.updates[2],
    kind: 'update',
    title: 'The final descent ends on the Brine Stairs',
    body: 'A memorial banner hangs over Floor Two. The estate is in probate.',
    chips: ['IN MEMORIAM'],
    condition: 'deceased',
  };
  return { ...file, updates: [file.updates[0], file.updates[1], last] };
}

function renderPanel(profile: CrawlerProfile = ronald, file: DossierFile | null = null) {
  return render(<Dossier profile={profile} dossier={file ?? makeDossier(profile.id)} />);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the panel, locked', () => {
  it('opens with the System eyebrow, the pronoun heading and the one-line banner', () => {
    renderPanel();
    expect(screen.getByText(copy.eyebrow)).toBeInTheDocument();
    // Ronald's sheet says he/him, so the heading asks after him (character pronouns, not the player's).
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Where is he now?');
    expect(screen.getByText(copy.bannerWarning)).toBeInTheDocument();
    // The header is the eyebrow and the question; nothing sits under the h2.
    expect(screen.queryByText(/Every card starts hidden/i)).toBeNull();
    // The band names the file and how far it runs, and nothing else.
    expect(screen.getByText(ronald.characterName.toUpperCase())).toBeInTheDocument();
    expect(screen.getByText(copy.fileRange(1, 3))).toBeInTheDocument();
  });

  it('asks after a crawler with no pronouns on file in the plural', () => {
    // No character pronouns on file; "they" is the answer to an empty field.
    renderPanel({ ...harold, pronouns: undefined });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Where are they now?');
  });

  it('shows one locked row per aired episode, ascending, all three cells lidded', () => {
    renderPanel();
    const rows = screen.getAllByTestId('dossier-row');
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      copy.revealAria(1),
      copy.revealAria(2),
      copy.revealAria(3),
    ]);
    expect(within(screen.getByTestId('dossier-strip')).getAllByLabelText(copy.hiddenValue))
      .toHaveLength(3);
    expect(screen.getByText(copy.hidden(3))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.revealAll })).toBeInTheDocument();
  });

  it('is the same document for two crawlers once their name and id are swapped (T1216)', () => {
    const file = makeDossier('harry');
    /*
     * Same pronoun on both, because the heading is the one other place a
     * crawler's own words reach this panel - "Where is he now?" is a fact
     * about them, like their name, and it says nothing about their condition.
     */
    const him = { ...harold, pronouns: 'he/him' };
    const a = render(<Dossier profile={him} dossier={file} />).container.innerHTML;
    cleanup();
    const b = render(
      <Dossier profile={ronald} dossier={{ ...file, id: ronald.id }} />,
    ).container.innerHTML;

    const normalized = b
      .split(ronald.characterName.toUpperCase())
      .join(harold.characterName.toUpperCase())
      .split(ronald.characterName)
      .join(harold.characterName)
      .split(ronald.id)
      .join(harold.id);
    expect(normalized).toBe(a);
  });

  it('keeps every word of every card - and of the death register - out of the DOM (T1217)', () => {
    const file = withDeath(harold.id);
    const { container } = render(<Dossier profile={harold} dossier={file} />);
    expect(container.innerHTML).not.toMatch(FORBIDDEN);
    for (const card of file.updates) {
      expect(container.innerHTML).not.toContain(card.title);
      expect(container.innerHTML).not.toContain(card.body);
      for (const chip of card.chips) expect(container.innerHTML).not.toContain(chip);
    }
    // ...including the strip: no condition is stated before a card states it.
    expect(container.textContent).not.toContain(copy.alive);
    expect(container.textContent).not.toContain(copy.deceased);
  });
});

describe('revealing', () => {
  it('swaps one row for its card and leaves the others shut', () => {
    const file = makeDossier(ronald.id);
    renderPanel(ronald, file);
    fireEvent.click(screen.getByRole('button', { name: copy.revealAria(2) }));

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(file.updates[1].title);
    expect(screen.getByText(copy.hidden(2))).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Reveal the Episode/ })).toHaveLength(2);
  });

  it('reports only what has been opened, and death stays stuck once it is (T1219 sticky)', () => {
    const file = withDeath(ronald.id);
    renderPanel(ronald, file);
    // Episode 3 is the death; opening it alone is enough to say so.
    fireEvent.click(screen.getByRole('button', { name: copy.revealAria(3) }));
    const strip = screen.getByTestId('dossier-strip');
    expect(within(strip).getByText(copy.deceased)).toBeInTheDocument();
    expect(within(strip).getByText('3')).toBeInTheDocument();
    // Episode 3 is filed off camera, so that cell is still lidded.
    expect(within(strip).getAllByLabelText(copy.hiddenValue)).toHaveLength(1);

    // Opening an earlier, living, on-camera card cannot bring him back.
    fireEvent.click(screen.getByRole('button', { name: copy.revealAria(1) }));
    expect(within(strip).getByText(copy.deceased)).toBeInTheDocument();
    expect(within(strip).queryByText(copy.alive)).toBeNull();
    expect(within(strip).getByText(copy.lastOnCamera(1))).toBeInTheDocument();
  });

  it('opens a card from the keyboard and puts focus on what arrived (T1218)', () => {
    const file = makeDossier(ronald.id);
    renderPanel(ronald, file);

    const first = screen.getByRole('button', { name: copy.revealAria(1) });
    first.focus();
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'Enter' });

    const heading = screen.getByRole('heading', { level: 3, name: file.updates[0].title });
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute('tabindex', '-1');

    // Space opens another, and focus follows that one instead.
    const second = screen.getByRole('button', { name: copy.revealAria(2) });
    fireEvent.keyDown(second, { key: ' ' });
    expect(screen.getByRole('heading', { level: 3, name: file.updates[1].title })).toHaveFocus();

    // The button - and its aria-expanded - left with the row it described.
    expect(screen.queryByRole('button', { name: copy.revealAria(1) })).toBeNull();
    expect(document.querySelectorAll('[aria-expanded]')).toHaveLength(1);
    // One left, and the footer counts it in the singular.
    expect(screen.getByText('1 update hidden')).toBeInTheDocument();
  });

  it('opens and shuts everything from the one bulk control', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: copy.revealAll }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    expect(screen.getByText(copy.hidden(0))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: copy.hideAll }));
    expect(screen.queryAllByRole('heading', { level: 3 })).toEqual([]);
    expect(screen.getByText(copy.hidden(3))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.revealAll })).toBeInTheDocument();
  });
});

describe('the reveals, for this visit only (T1219, superseded 2026-09-25)', () => {
  it('starts fully locked again after a remount', () => {
    const { unmount } = renderPanel(harold, makeDossier(harold.id));
    fireEvent.click(screen.getByRole('button', { name: copy.revealAria(2) }));
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    unmount();

    // A reload is this, from the panel's point of view: nothing came back.
    renderPanel(harold, makeDossier(harold.id));
    expect(screen.queryAllByRole('heading', { level: 3 })).toEqual([]);
    expect(screen.getAllByRole('button', { name: /^Reveal the Episode/ })).toHaveLength(3);
    expect(screen.getByText(copy.hidden(3))).toBeInTheDocument();
  });

  it('re-locks when the reader walks on to the next crawler without unmounting', () => {
    const { rerender } = render(<Dossier profile={harold} dossier={makeDossier(harold.id)} />);
    fireEvent.click(screen.getByRole('button', { name: copy.revealAll }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);

    rerender(<Dossier profile={ronald} dossier={makeDossier(ronald.id)} />);
    expect(screen.queryAllByRole('heading', { level: 3 })).toEqual([]);
    expect(screen.getByText(copy.hidden(3))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.revealAll })).toBeInTheDocument();
  });

  it('never touches storage, reading or writing', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: copy.revealAll }));
    fireEvent.click(screen.getByRole('button', { name: copy.hideAll }));
    fireEvent.click(screen.getByRole('button', { name: copy.revealAria(1) }));
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('the launch state', () => {
  it('says when the first report lands and renders nothing to count', () => {
    const { container } = render(<Dossier profile={ronald} dossier={null} />);
    expect(screen.getByText(copy.launch)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.queryAllByTestId('dossier-row')).toEqual([]);
    expect(screen.queryByTestId('dossier-strip')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.innerHTML).not.toContain(copy.bannerWarning);
  });

  it('treats a dossier with no cards in it exactly the same way', () => {
    render(<Dossier profile={ronald} dossier={{ ...makeDossier(ronald.id), updates: [] }} />);
    expect(screen.getByText(copy.launch)).toBeInTheDocument();
    expect(screen.queryAllByTestId('dossier-row')).toEqual([]);
  });
});
