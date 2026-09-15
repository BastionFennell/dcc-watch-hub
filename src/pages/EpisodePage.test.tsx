// @vitest-environment jsdom
/**
 * Page-level proof of the time-truth invariants (constitution I; SC-002/003/004).
 *
 * The whole page is driven by the dev `FakeStage`'s `FakeTimeSource` — no network,
 * no video host — which is exactly the guarantee constitution II asks for.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
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
    return Promise.resolve(
      new Response(JSON.stringify(makeEpisodeRaw(1)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
}

/** Mounts `/ep/1?fake=1` and returns the stage's `FakeTimeSource`. */
async function mountEpisode() {
  render(
    <MemoryRouter initialEntries={['/ep/1?fake=1']}>
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

  it('shows the System not-found copy for a non-integer episode id', async () => {
    render(
      <MemoryRouter initialEntries={['/ep/not-a-number']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(copy.notFoundTitle)).toBeInTheDocument());
  });
});
