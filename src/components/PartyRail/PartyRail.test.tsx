// @vitest-environment jsdom
/**
 * The party rail's two layouts (006 T605). The row layout is the desktop rail
 * and its phone strip; the grid is the phone Party pane. Only the attribute can
 * be asserted here - jsdom applies no CSS module, so the two-column track list
 * and the odd-last-frame span live in `PartyRail.module.css` and are checked at
 * phone widths in T611.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PartyRail } from './PartyRail';
import { copy } from '../../copy';
import { partyFrames } from '../../engine/selectors';
import { reduceTo } from '../../engine/reducer';
import { makeEpisode } from '../../test/fixtures';

afterEach(cleanup);

const episode = makeEpisode();
const frames = partyFrames(reduceTo(episode, 200), episode.events, 200);

function renderRail(layout?: 'row' | 'grid') {
  const onActivate = vi.fn();
  render(<PartyRail frames={frames} activeId={null} onActivate={onActivate} layout={layout} />);
  return { onActivate };
}

describe('PartyRail layout', () => {
  it('defaults to the row layout', () => {
    renderRail();
    expect(screen.getByTestId('party-rail')).toHaveAttribute('data-layout', 'row');
  });

  it('marks the grid layout on the list', () => {
    renderRail('grid');
    expect(screen.getByTestId('party-rail')).toHaveAttribute('data-layout', 'grid');
  });

  it('draws the same frames either way', () => {
    // The layout is presentation only: the pane and the desktop rail are the
    // same five triggers, with the same dossier wiring (FR-503).
    renderRail('grid');
    const drawn = screen.getAllByTestId('crawler-frame');
    expect(drawn).toHaveLength(frames.length);
    expect(drawn.map((node) => node.getAttribute('data-crawler'))).toEqual(
      frames.map((frame) => frame.id),
    );
    for (const node of drawn) expect(node).toHaveAttribute('aria-controls', 'rail-panel');
  });
});

/* ------------------------------------------------------------ 009: mana */

describe('the frame’s mana bar', () => {
  const framesAt = (t: number) => partyFrames(reduceTo(episode, t), episode.events, t);

  function renderFrames(t: number) {
    render(<PartyRail frames={framesAt(t)} activeId={null} onActivate={vi.fn()} />);
  }

  /** The bar inside one crawler's frame, found by the frame's own test id. */
  const barFor = (id: string) =>
    within(
      screen.getAllByTestId('crawler-frame').find((node) => node.dataset.crawler === id)!,
    );

  it('names the pool the way the HP bar names hit points', () => {
    renderFrames(0);
    const frame = barFor('psychic');
    // The Psychic's sheet writes 5/5. Same shape as the HP bar beside it: a
    // role="img" meter carrying its whole reading in one accessible name.
    const bar = frame.getByLabelText(copy.manaAria(5, 5));
    expect(bar).toHaveAttribute('role', 'img');
    expect(frame.getByLabelText(copy.hpAria(20, 20))).toHaveAttribute('role', 'img');
    expect(frame.getByTestId('frame-mana')).toHaveTextContent(copy.hpValue(5, 5));
  });

  it('follows a mana event and restores on a rewind', () => {
    // The fixture spends The Psychic's pool at t = 171 and refills it at 172.
    const { rerender } = render(
      <PartyRail frames={framesAt(170)} activeId={null} onActivate={vi.fn()} />,
    );
    expect(barFor('psychic').getByTestId('frame-mana')).toHaveTextContent(copy.hpValue(5, 5));

    rerender(<PartyRail frames={framesAt(171)} activeId={null} onActivate={vi.fn()} />);
    expect(barFor('psychic').getByTestId('frame-mana')).toHaveTextContent(copy.hpValue(2, 5));
    expect(barFor('psychic').getByLabelText(copy.manaAria(2, 5))).toBeInTheDocument();

    // Scrubbing back is not an undo: the rail is rebuilt from the elapsed log.
    rerender(<PartyRail frames={framesAt(170)} activeId={null} onActivate={vi.fn()} />);
    expect(barFor('psychic').getByTestId('frame-mana')).toHaveTextContent(copy.hpValue(5, 5));
  });

  it('draws the row on every frame, including an empty pool (revision 1)', () => {
    renderFrames(0);
    expect(screen.getAllByTestId('frame-mana')).toHaveLength(frames.length);
    // X.O. has no pool at all; the row stays so the rail never changes height
    // between crawlers or across a seek.
    const xo = barFor('xo');
    expect(xo.getByLabelText(copy.manaAria(0, 0))).toBeInTheDocument();
    expect(xo.getByTestId('frame-mana')).toHaveTextContent(copy.hpValue(0, 0));
  });

  it('leaves the HP bar untouched', () => {
    renderFrames(46);
    // Harry is in danger at t = 46; that is the HP bar's business alone.
    const harry = barFor('harry');
    expect(harry.getByLabelText(copy.hpAria(4, 22))).toHaveAttribute('data-danger', 'true');
    expect(harry.getByLabelText(copy.manaAria(6, 6))).not.toHaveAttribute('data-danger');
  });
});
