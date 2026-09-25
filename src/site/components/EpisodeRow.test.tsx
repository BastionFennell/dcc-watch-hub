// @vitest-environment jsdom
/**
 * One episode as it appears in every list (011 §3.2), including the chip that
 * says how long the System feed stays shut.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { EpisodeRow } from './EpisodeRow';
import { siteCopy } from '../copy';
import { makeShow } from '../../test/fixtures';
import type { EpisodeMeta } from '../../data/types';

const LIVE_AT = '2026-10-10T17:00:00Z';
const gate = Date.parse(LIVE_AT);
const links = makeShow().links;

const episode: EpisodeMeta = {
  ...makeShow().episodes[2],
  hubLiveAt: LIVE_AT,
  summary: 'The stairs down are open.',
  durationSec: 734,
};

function renderRow(now: number, meta: EpisodeMeta = episode) {
  return render(
    <MemoryRouter>
      <EpisodeRow episode={meta} now={now} links={links} />
    </MemoryRouter>,
  );
}

describe('EpisodeRow', () => {
  it('states the episode, its floor, its running time and its summary', () => {
    renderRow(gate);
    expect(screen.getByRole('heading')).toHaveTextContent(episode.title);
    expect(screen.getByText(siteCopy.episodeLabel(3))).toBeInTheDocument();
    expect(screen.getByText(siteCopy.floorLabel(2))).toBeInTheDocument();
    expect(screen.getByText('12:14')).toBeInTheDocument();
    expect(screen.getByText('The stairs down are open.')).toBeInTheDocument();
  });

  it('counts down to the feed before the gate and drops the chip after it', () => {
    const { unmount } = renderRow(gate - 2 * 24 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000);
    expect(screen.getByTestId('countdown-3')).toHaveTextContent(
      siteCopy.countdownChip('2d 4h'),
    );
    expect(screen.getByRole('link')).toHaveTextContent(siteCopy.watchOnYouTube);
    unmount();

    renderRow(gate);
    expect(screen.queryByTestId('countdown-3')).toBeNull();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/ep/3');
  });

  it('falls back to the host still and defers it', () => {
    const { container } = renderRow(gate);
    const thumb = container.querySelector('img');
    expect(thumb).toHaveAttribute('src', `https://i.ytimg.com/vi/${episode.youtubeId}/hqdefault.jpg`);
    expect(thumb).toHaveAttribute('loading', 'lazy');
  });

  it('prefers an authored share image for the thumbnail', () => {
    const { container } = renderRow(gate, { ...episode, ogImage: '/og/ep3.png' });
    expect(container.querySelector('img')).toHaveAttribute('src', '/og/ep3.png');
  });
});
