// @vitest-environment jsdom
/**
 * The party rail's two layouts (006 T605). The row layout is the desktop rail
 * and its phone strip; the grid is the phone Party pane. Only the attribute can
 * be asserted here — jsdom applies no CSS module, so the two-column track list
 * and the odd-last-frame span live in `PartyRail.module.css` and are checked at
 * phone widths in T611.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PartyRail } from './PartyRail';
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
