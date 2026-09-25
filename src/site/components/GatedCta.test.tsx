// @vitest-environment jsdom
/**
 * The broadcast-delay button, on both sides of the gate (011 §8). `gate.ts`
 * owns the decision; this is about the element the decision produces, because
 * "in-app route" and "somewhere else entirely" are not the same link.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { GatedCta } from './GatedCta';
import { siteCopy } from '../copy';
import { makeShow } from '../../test/fixtures';
import type { EpisodeMeta } from '../../data/types';

const LIVE_AT = '2026-10-10T17:00:00Z';
const gate = Date.parse(LIVE_AT);
const links = makeShow().links;

const episode: EpisodeMeta = {
  ...makeShow().episodes[0],
  id: 4,
  youtubeId: 'aqz-KE-bpKQ',
  hubLiveAt: LIVE_AT,
};

function renderCta(now: number, props: Partial<React.ComponentProps<typeof GatedCta>> = {}) {
  return render(
    <MemoryRouter>
      <GatedCta episode={episode} now={now} links={links} {...props} />
    </MemoryRouter>,
  );
}

describe('GatedCta', () => {
  it('points at YouTube in a new tab before the gate', () => {
    renderCta(gate - 1);
    const link = screen.getByRole('link', { name: siteCopy.watchOnYouTube });
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
    expect(link).toHaveAttribute('data-kind', 'youtube');
  });

  it('points at the System feed on the gate, in the app', () => {
    renderCta(gate);
    const link = screen.getByRole('link', { name: siteCopy.openSystemFeed });
    expect(link).toHaveAttribute('href', '/ep/4');
    expect(link).not.toHaveAttribute('target');
    expect(link).toHaveAttribute('data-kind', 'hub');
  });

  it('marks exactly the button it was told is primary', () => {
    const { unmount } = renderCta(gate, { primary: true });
    expect(screen.getByRole('link')).toHaveAttribute('data-variant', 'primary');
    unmount();
    renderCta(gate);
    expect(screen.getByRole('link')).toHaveAttribute('data-variant', 'secondary');
  });

  it('hands the click to the tracker with the decision that was rendered', () => {
    const onTrack = vi.fn();
    renderCta(gate - 1, { onTrack });
    fireEvent.click(screen.getByRole('link'));
    expect(onTrack).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'youtube', label: siteCopy.watchOnYouTube }),
    );
  });

  it('falls back to the channel when the episode has no video id', () => {
    render(
      <MemoryRouter>
        <GatedCta episode={{ ...episode, youtubeId: '' }} now={gate - 1} links={links} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', links.youtube);
  });
});
