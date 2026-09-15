// @vitest-environment jsdom
/**
 * Page-level proof of the time-truth invariants (constitution I; SC-002/003/004).
 *
 * The whole page is driven by the dev `FakeStage`'s `FakeTimeSource` — no network,
 * no video host — which is exactly the guarantee constitution II asks for.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '../App';
import { copy } from '../copy';
import { feedItems } from '../engine/selectors';
import { isKnownEvent } from '../data/types';
import { __fakeSources } from '../components/VideoStage/FakeStage';
import { makeEpisode, makeEpisodeRaw, makeShow } from '../test/fixtures';

const episode = makeEpisode(1);
const party = episode.initialState.party;

function stubFetch(episodeOk = true) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('show.json')) {
      return Promise.resolve(
        new Response(JSON.stringify(makeShow()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    if (!episodeOk) return Promise.resolve(new Response('gone', { status: 500 }));
    // The loader checks `episodeId` against the meta, so answer for the episode asked for.
    const episodeId = Number(/ep(\d+)\.json/.exec(url)?.[1] ?? 1);
    return Promise.resolve(
      new Response(JSON.stringify(makeEpisodeRaw(episodeId)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
}

/** Mounts an episode route with the dev stage and returns its `FakeTimeSource`. */
async function mountEpisode(entry = '/ep/1?fake=1') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByTestId('fake-stage')).toBeInTheDocument());
  await waitFor(() => expect(__fakeSources.length).toBeGreaterThan(0));
  // The party rail only exists once the episode JSON has landed.
  await waitFor(() => expect(screen.getAllByTestId('crawler-frame')).toHaveLength(5));
  const source = __fakeSources[__fakeSources.length - 1];
  return {
    source,
    seek(t: number) {
      act(() => source.set(t));
    },
  };
}

function frame(crawlerId: string): HTMLElement {
  const element = document.querySelector(`[data-crawler="${crawlerId}"]`);
  if (!element) throw new Error(`No crawler frame for ${crawlerId}`);
  return element as HTMLElement;
}

function feedCount(): number {
  return screen.queryAllByTestId('feed-item').length;
}

/** The feed sentence a given event produces, used for the never-early sweep. */
function textOf(index: number): string | undefined {
  const event = episode.events[index];
  return feedItems(episode.events, event.t, 100, party).find((item) => item.id === index)?.text;
}

describe('EpisodePage', () => {
  beforeEach(() => {
    __fakeSources.length = 0;
    stubFetch();
  });

  it('shows initial party state and an empty feed at t = 0', async () => {
    await mountEpisode();

    expect(within(frame('harry')).getByText(copy.hpValue(22, 22))).toBeInTheDocument();
    expect(within(frame('xo')).getByText(copy.levelShort(1))).toBeInTheDocument();
    expect(feedCount()).toBe(0);
    expect(screen.getByText(copy.feedHeader('0:00'))).toBeInTheDocument();
  });

  it('updates HP and flashes danger once an hp event has elapsed', async () => {
    const { seek } = await mountEpisode();

    seek(50);
    expect(within(frame('harry')).getByText(copy.hpValue(4, 22))).toBeInTheDocument();
    expect(frame('harry')).toHaveAttribute('data-danger');
    expect(frame('xo')).not.toHaveAttribute('data-danger');

    // Harry heals at t = 170: the danger state is a function of t, not history.
    seek(180);
    expect(within(frame('harry')).getByText(copy.hpValue(20, 22))).toBeInTheDocument();
    expect(frame('harry')).not.toHaveAttribute('data-danger');
  });

  it('rewinds the feed and the rail on a backward seek', async () => {
    const { seek } = await mountEpisode();

    seek(50);
    expect(feedCount()).toBe(3); // 12, 30, 45

    seek(20);
    expect(feedCount()).toBe(1);
    expect(frame('harry')).not.toHaveAttribute('data-danger');
    expect(within(frame('harry')).getByText(copy.hpValue(22, 22))).toBeInTheDocument();
  });

  it('caps the feed at the 8 most recent events, newest first', async () => {
    const { seek } = await mountEpisode();

    seek(180);
    const items = screen.getAllByTestId('feed-item');
    expect(items).toHaveLength(8);

    const newest = textOf(episode.events.length - 1);
    expect(newest).toBeDefined();
    expect(within(items[0]).getByText(newest!)).toBeInTheDocument();
  });

  it('never renders an event before its time', async () => {
    const { seek } = await mountEpisode();

    episode.events.forEach((event, index) => {
      if (!isKnownEvent(event)) return;
      const text = textOf(index);
      if (!text) return;

      seek(event.t - 0.001);
      expect(screen.queryAllByText(text)).toHaveLength(0);

      seek(event.t);
      // The active sponsor is pinned AND listed, so count matches instead of one node.
      expect(within(screen.getByTestId('feed-items')).getAllByText(text).length).toBeGreaterThan(
        0,
      );
    });
  });

  it('never renders an unknown event type', async () => {
    const { seek } = await mountEpisode();

    seek(240);
    expect(screen.queryByText(/must never render/)).not.toBeInTheDocument();
    expect(episode.events.some((event) => event.type === 'unknown')).toBe(true);
  });

  it('adds and removes a status pip with the playhead', async () => {
    const { seek } = await mountEpisode();

    seek(129);
    expect(within(frame('psychic')).queryByText('Poisoned')).not.toBeInTheDocument();

    seek(135);
    expect(within(frame('psychic')).getByText('Poisoned')).toBeInTheDocument();

    seek(145);
    expect(within(frame('psychic')).queryByText('Poisoned')).not.toBeInTheDocument();
  });

  it('pins the active sponsor and lets it fall back into the feed', async () => {
    const { seek } = await mountEpisode();

    seek(115);
    expect(screen.getByTestId('active-sponsor')).toBeInTheDocument();

    seek(135);
    expect(screen.queryByTestId('active-sponsor')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('sponsor').length).toBeGreaterThan(0);
  });

  it('keeps the stage and shows the System failure notice when the episode data cannot load', async () => {
    stubFetch(false);
    render(
      <MemoryRouter initialEntries={['/ep/1?fake=1']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(copy.feedUnavailable)).toBeInTheDocument());
    expect(screen.getByTestId('video-stage')).toBeInTheDocument();
    expect(screen.getByTestId('fake-stage')).toBeInTheDocument();
  });

  /* ---------------------------------------------- US3: the event timeline (T032) */

  it('marks every chapter, achievement, and level-up on the timeline', async () => {
    await mountEpisode();

    const expected = episode.events.filter((event) =>
      ['chapter', 'achievement', 'level_up'].includes(event.type),
    );
    const markers = screen.getAllByTestId('timeline-marker');
    expect(markers).toHaveLength(expected.length);

    markers.forEach((marker, index) => {
      const event = expected[index];
      // Positioned by t / durationSec (FR-040) …
      expect(parseFloat(marker.style.left)).toBeCloseTo((event.t / 240) * 100, 3);
      // … and colored by kind, straight from the selector's token.
      const kind =
        event.type === 'achievement'
          ? 'achievement'
          : event.type === 'level_up'
            ? 'levelup'
            : 'boss';
      expect(marker).toHaveAttribute('data-kind', kind);
      expect(marker.getAttribute('style')).toContain(`var(--marker-${kind})`);
    });

    // Real buttons, named by their label, inside the labelled marker list.
    expect(screen.getByRole('list', { name: copy.timelineLabel })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'The Hoarder Fight' })).toBeInTheDocument();
  });

  it('fills the timeline up to the playhead', async () => {
    const { seek } = await mountEpisode();

    expect(parseFloat(screen.getByTestId('timeline-fill').style.width)).toBeCloseTo(0, 3);
    seek(60);
    expect(parseFloat(screen.getByTestId('timeline-fill').style.width)).toBeCloseTo(25, 3);
  });

  it('seeks the source and the overlay when a marker is clicked', async () => {
    const { source } = await mountEpisode();

    expect(feedCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'The Hoarder Fight' }));

    expect(source.getTime()).toBe(120);
    expect(screen.getByText(copy.feedHeader('2:00'))).toBeInTheDocument();
    expect(within(screen.getByTestId('feed-items')).getByText('The Hoarder Fight')).toBeInTheDocument();

    // And backwards: the click is a plain seek, so the feed rewinds too.
    fireEvent.click(screen.getByRole('button', { name: 'Gate Crasher' }));
    expect(source.getTime()).toBe(60);
    expect(feedCount()).toBe(4); // 12, 30, 45, 60
  });

  /* ------------------------------ US4: toast, minimap, pinned sponsor (T035) */

  it('shows one achievement toast at a time, in FIFO order', async () => {
    const { seek } = await mountEpisode();

    seek(59);
    expect(screen.queryByTestId('achievement-toast')).not.toBeInTheDocument();

    seek(60);
    const toast = screen.getByTestId('achievement-toast');
    expect(within(toast).getByText(copy.newAchievementTag)).toBeInTheDocument();
    expect(within(toast).getByText('Gate Crasher')).toBeInTheDocument();

    // The queue holds the first toast for its full 6 s window …
    seek(65.9);
    expect(within(screen.getByTestId('achievement-toast')).getByText('Gate Crasher')).toBeInTheDocument();

    // … then hands over to the achievements that landed at 61 and 62.
    seek(66);
    expect(within(screen.getByTestId('achievement-toast')).getByText('Understudy')).toBeInTheDocument();
    seek(72);
    expect(within(screen.getByTestId('achievement-toast')).getByText('Stunt Double')).toBeInTheDocument();

    seek(78);
    expect(screen.queryByTestId('achievement-toast')).not.toBeInTheDocument();
  });

  it('reveals minimap sectors only once their map_reveal has elapsed', async () => {
    const { seek } = await mountEpisode();

    const lit = () =>
      document.querySelectorAll('[data-testid="minimap-cell"]:not([data-state="hidden"])').length;
    const recent = () =>
      document.querySelectorAll('[data-testid="minimap-cell"][data-state="recent"]').length;

    expect(screen.getAllByTestId('minimap-cell')).toHaveLength(96);
    seek(89);
    expect(lit()).toBe(0);
    expect(screen.getByText(copy.sectorsRevealed(0, 96))).toBeInTheDocument();

    seek(90);
    expect(lit()).toBe(2);
    expect(recent()).toBe(2);
    expect(screen.getByText(copy.sectorsRevealed(2, 96))).toBeInTheDocument();

    // The "just revealed" tint is a 5 s window; the reveal itself is permanent.
    seek(96);
    expect(lit()).toBe(2);
    expect(recent()).toBe(0);

    seek(50);
    expect(lit()).toBe(0);
  });

  it('pins the sponsor for exactly its duration', async () => {
    const { seek } = await mountEpisode();

    seek(110);
    expect(screen.getByTestId('active-sponsor')).toBeInTheDocument();

    seek(130); // t + durationSec — the window is half-open
    expect(screen.queryByTestId('active-sponsor')).not.toBeInTheDocument();
  });

  /* ----------------------------------------- US2 scenario 5: ended card (T030) */

  it('offers the next recap episode when the broadcast ends', async () => {
    const { source } = await mountEpisode();

    expect(screen.queryByRole('link', { name: copy.nextEpisodeCard })).not.toBeInTheDocument();

    act(() => source.end());

    const stage = within(screen.getByTestId('video-stage'));
    expect(stage.getByText('Episode 2 — The Meat District')).toBeInTheDocument();
    expect(stage.getByRole('link', { name: copy.nextEpisodeCard })).toHaveAttribute(
      'href',
      '/ep/2',
    );
  });

  it('offers the archive when the final episode ends', async () => {
    const { source } = await mountEpisode('/ep/3?fake=1');

    act(() => source.end());

    expect(screen.queryByRole('link', { name: copy.nextEpisodeCard })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.returnToArchive })).toHaveAttribute('href', '/');
  });

  it('shows the System not-found copy for a non-integer episode id', async () => {
    render(
      <MemoryRouter initialEntries={['/ep/not-a-number']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(copy.notFoundTitle)).toBeInTheDocument());
  });
});
