// @vitest-environment jsdom
/**
 * The broadcast log (005 T505, research R6). Everything it shows comes from
 * `logItems` over the shared fixture, so these assertions and the selector's
 * agree on the same event log.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { EpisodeLog } from './EpisodeLog';
import { COUNT_THROTTLE_MS } from './EpisodeLog';
import type { FeedItem } from '../../engine/selectors';
import { logItems } from '../../engine/selectors';
import { formatTime } from '../../engine/time';
import { copy } from '../../copy';
import { makeEpisode } from '../../test/fixtures';

const episode = makeEpisode();
const party = episode.initialState.party;

const at = (t: number): FeedItem[] => logItems(episode.events, t, party);

interface Options {
  items?: FeedItem[];
  playing?: boolean;
  initialOpen?: boolean;
  t?: number;
}

function renderLog({ items = at(200), playing = false, initialOpen = true, t = 200 }: Options = {}) {
  const onSeek = vi.fn();
  const onShare = vi.fn();
  const onOpenChange = vi.fn();
  const view = render(
    <EpisodeLog
      items={items}
      party={party}
      t={t}
      playing={playing}
      onSeek={onSeek}
      onShare={onShare}
      initialOpen={initialOpen}
      onOpenChange={onOpenChange}
    />,
  );
  const rerender = (next: Options = {}) =>
    view.rerender(
      <EpisodeLog
        items={next.items ?? items}
        party={party}
        t={next.t ?? t}
        playing={next.playing ?? playing}
        onSeek={onSeek}
        onShare={onShare}
        initialOpen={initialOpen}
        onOpenChange={onOpenChange}
      />,
    );
  return { ...view, rerender, onSeek, onShare, onOpenChange };
}

const rows = () => screen.queryAllByTestId('log-row');
const list = () => screen.getByTestId('log-list');
const toggle = () => screen.getByTestId('log-toggle');
const count = () => screen.getByTestId('log-count');
const chipType = (kind: string) => screen.getByTestId(`log-chip-type-${kind}`);
const chipActor = (id: string) => screen.getByTestId(`log-chip-actor-${id}`);

/** jsdom lays nothing out, so the follow maths gets its numbers by hand. */
function stubScroll(element: HTMLElement, scrollTop: number, clientHeight: number, scrollHeight: number) {
  Object.defineProperty(element, 'scrollTop', { value: scrollTop, writable: true, configurable: true });
  Object.defineProperty(element, 'clientHeight', { value: clientHeight, configurable: true });
  Object.defineProperty(element, 'scrollHeight', { value: scrollHeight, configurable: true });
}

let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // jsdom has no `scrollTo` on elements at all.
  scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    value: scrollTo,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('EpisodeLog - the collapsed bar', () => {
  it('is collapsed by default and renders only the bar (constitution III)', () => {
    renderLog({ initialOpen: false });

    expect(screen.getByTestId('episode-log')).not.toHaveAttribute('data-open');
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).toHaveTextContent(copy.logOpen);
    expect(screen.queryByTestId('log-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('log-filters')).not.toBeInTheDocument();
    expect(rows()).toHaveLength(0);
  });

  it('is a labelled region with the System’s title as its heading (FR-406)', () => {
    renderLog({ initialOpen: false });

    const section = screen.getByTestId('episode-log');
    const heading = screen.getByRole('heading', { level: 2, name: copy.logTitle });
    expect(section).toHaveAttribute('aria-labelledby', heading.id);
    expect(screen.getByRole('region', { name: copy.logTitle })).toBe(section);
  });

  it('counts the elapsed log in the bar, closed or open (FR-403)', () => {
    renderLog({ initialOpen: false });
    expect(count()).toHaveTextContent(copy.logCount(at(200).length));
    expect(count()).toHaveAttribute('aria-live', 'polite');
  });

  it('says how many moments there are in the System’s voice', () => {
    renderLog({ items: at(12), initialOpen: false, t: 12 });
    expect(count()).toHaveTextContent('1 moment on the log');
  });

  it('opens on the toggle, reports the change, and controls the body', () => {
    const { onOpenChange } = renderLog({ initialOpen: false });

    fireEvent.click(toggle());

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('episode-log')).toHaveAttribute('data-open', 'true');
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(toggle()).toHaveTextContent(copy.logClose);
    expect(toggle().getAttribute('aria-controls')).toBe(list().closest('[id]')?.id);
    expect(rows().length).toBeGreaterThan(0);

    fireEvent.click(toggle());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByTestId('log-list')).not.toBeInTheDocument();
  });

  it('opens on mount when the viewer’s preference says so', () => {
    renderLog({ initialOpen: true });
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(rows().length).toBeGreaterThan(0);
  });
});

describe('EpisodeLog - the list', () => {
  it('lists every elapsed moment oldest first, with time, category and text', () => {
    renderLog({ items: at(62), t: 62 });

    const listed = rows();
    expect(listed).toHaveLength(6);
    expect(listed.map((row) => within(row).getByTestId('feed-time').textContent)).toEqual([
      formatTime(12),
      formatTime(30),
      formatTime(45),
      formatTime(60),
      formatTime(61),
      formatTime(62),
    ]);

    const loot = listed[1];
    expect(within(loot).getByText(copy.labels.loot)).toBeInTheDocument();
    expect(loot).toHaveTextContent('Enchanted Crowbar');
    expect(loot).toHaveTextContent('Harry');
  });

  it('marks the newest row and only the newest row (research R4)', () => {
    renderLog({ items: at(62), t: 62 });
    const listed = rows();
    expect(listed.filter((row) => row.hasAttribute('data-latest'))).toEqual([listed[5]]);
    expect(listed[5]).toHaveTextContent(formatTime(62));
  });

  it('shrinks on a backward seek and keeps the rest of the rows', () => {
    const { rerender } = renderLog({ items: at(200), t: 200 });
    const before = rows().length;

    act(() => rerender({ items: at(62), t: 62 }));

    expect(rows()).toHaveLength(6);
    expect(before).toBeGreaterThan(6);
    expect(screen.queryByText(/Grull Industries/)).not.toBeInTheDocument();
  });

  it('reuses the feed’s rows: System boxes and purple sponsor slots', () => {
    renderLog({ items: at(115), t: 115 });
    const listed = rows();

    expect(within(listed[0]).getByText(copy.systemLabel)).toBeInTheDocument();
    const sponsorRow = listed.find((row) => within(row).queryByTestId('sponsor') !== null);
    expect(sponsorRow).toBeDefined();
    expect(sponsorRow).toHaveTextContent(copy.sponsoredTag);
  });

  it('is a list even with its bullets removed, and scrolls inside itself', () => {
    renderLog();
    expect(list()).toHaveAttribute('role', 'list');
    expect(screen.getAllByRole('listitem').length).toBe(rows().length);
  });

  it('seeks on a row click and shares without seeking (FR-401, 004 FR-306)', async () => {
    const { onSeek, onShare } = renderLog({ items: at(62), t: 62 });
    const row = rows()[1];

    fireEvent.click(within(row).getByRole('button', { name: /^0:30/ }));
    expect(onSeek).toHaveBeenCalledWith(30);

    await act(async () => {
      fireEvent.click(within(row).getByTestId('share-row'));
    });
    expect(onShare).toHaveBeenCalledWith(30);
    expect(onSeek).toHaveBeenCalledTimes(1);
  });
});

describe('EpisodeLog - filters', () => {
  it('shows both chip groups with elapsed counts per chip', () => {
    renderLog();

    expect(screen.getByTestId('log-filters')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: copy.logFiltersTypes })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: copy.logFiltersCrawlers })).toBeInTheDocument();

    expect(chipType('achievement')).toHaveTextContent('3');
    expect(chipActor('harry')).toHaveTextContent(String(at(200).filter((i) => i.actorId === 'harry').length));
    expect(chipType('achievement')).toHaveAttribute('aria-pressed', 'false');
  });

  it('draws no chip for a kind with nothing elapsed', () => {
    renderLog({ items: at(12), t: 12 });

    expect(screen.queryByTestId('log-chip-type-achievement')).not.toBeInTheDocument();
    // Only what the log actually holds is offered.
    const shown = screen.getAllByTestId(/^log-chip-type-/);
    const kinds = new Set(at(12).map((item) => item.kind));
    expect(shown).toHaveLength(kinds.size);
  });

  it('retires a chip, and the selection on it, when a backward seek empties it', () => {
    const { rerender } = renderLog();

    fireEvent.click(chipType('achievement'));
    expect(rows()).toHaveLength(3);

    // Back before the first achievement: the chip goes, and so does the filter
    // standing on it - the log reads as the whole elapsed log again, not empty.
    act(() => {
      rerender({ items: at(12), t: 12 });
    });

    expect(screen.queryByTestId('log-chip-type-achievement')).not.toBeInTheDocument();
    expect(screen.queryByTestId('log-empty')).not.toBeInTheDocument();
    expect(rows()).toHaveLength(at(12).length);
    expect(screen.getByTestId('log-clear')).toBeDisabled();
  });

  it('shows no filters at all before the first moment', () => {
    renderLog({ items: [], t: 0 });

    expect(screen.queryByTestId('log-filters')).not.toBeInTheDocument();
    expect(screen.getByTestId('log-empty')).toHaveTextContent(copy.feedStandby);
  });

  it('filters by type and reports "N of M moments"', () => {
    renderLog();
    const total = at(200).length;

    fireEvent.click(chipType('achievement'));

    expect(chipType('achievement')).toHaveAttribute('aria-pressed', 'true');
    expect(rows()).toHaveLength(3);
    expect(count()).toHaveTextContent(copy.logCountFiltered(3, total));
  });

  it('combines type-any AND crawler-any and drops rows with no crawler', () => {
    renderLog();

    fireEvent.click(chipType('achievement'));
    fireEvent.click(chipActor('harry'));

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('Gate Crasher');

    fireEvent.click(chipActor('xo'));
    expect(rows().map((row) => within(row).getByTestId('feed-time').textContent)).toEqual([
      formatTime(60),
      formatTime(61),
    ]);

    // A crawler filter alone never keeps the System, the sponsor or the map.
    fireEvent.click(chipType('achievement'));
    fireEvent.click(chipActor('xo'));
    expect(within(list()).queryByText(copy.systemLabel)).not.toBeInTheDocument();
    expect(within(list()).queryByTestId('sponsor')).not.toBeInTheDocument();
    expect(rows().every((row) => row.textContent?.includes('Harry'))).toBe(true);
  });

  it('says so when a filter matches nothing, without emptying the log', () => {
    renderLog();

    fireEvent.click(chipType('system_message'));
    fireEvent.click(chipActor('harry'));

    expect(screen.getByTestId('log-empty')).toHaveTextContent(copy.logNoMatch);
    expect(screen.queryByTestId('log-list')).not.toBeInTheDocument();
    expect(rows()).toHaveLength(0);
  });

  it('clears every chip, and offers nothing to clear until there is', () => {
    renderLog();
    const clear = screen.getByTestId('log-clear');
    expect(clear).toBeDisabled();

    fireEvent.click(chipType('achievement'));
    fireEvent.click(chipActor('harry'));
    expect(clear).toBeEnabled();

    fireEvent.click(clear);

    expect(chipType('achievement')).toHaveAttribute('aria-pressed', 'false');
    expect(chipActor('harry')).toHaveAttribute('aria-pressed', 'false');
    expect(rows()).toHaveLength(at(200).length);
    expect(clear).toBeDisabled();
  });

  it('keeps filters while the playhead moves, and re-counts against it', () => {
    const { rerender } = renderLog({ items: at(62), t: 62 });

    fireEvent.click(chipType('achievement'));
    expect(rows()).toHaveLength(3);

    act(() => rerender({ items: at(60), t: 60 }));

    expect(chipType('achievement')).toHaveAttribute('aria-pressed', 'true');
    expect(rows()).toHaveLength(1);
  });
});

describe('EpisodeLog - empty and standby', () => {
  it('shows the System’s standby line before anything has elapsed', () => {
    renderLog({ items: [], t: 0 });

    expect(screen.getByTestId('log-empty')).toHaveTextContent(copy.feedStandby);
    expect(count()).toHaveTextContent(copy.logCount(0));
    expect(screen.queryByTestId('log-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('log-follow')).not.toBeInTheDocument();
  });
});

describe('EpisodeLog - following the broadcast', () => {
  it('scrolls to the newest row as rows arrive while playing (FR-404)', () => {
    const { rerender } = renderLog({ items: at(62), playing: true, t: 62 });
    stubScroll(list(), 0, 100, 100);
    scrollTo.mockClear();

    act(() => rerender({ items: at(70), t: 70 }));

    expect(scrollTo).toHaveBeenCalled();
    expect(scrollTo.mock.calls[0][0]).toMatchObject({ top: expect.any(Number) });
    expect(screen.queryByTestId('log-follow')).not.toBeInTheDocument();
  });

  it('does not scroll while the broadcast is paused', () => {
    const { rerender } = renderLog({ items: at(62), playing: false, t: 62 });
    scrollTo.mockClear();

    act(() => rerender({ items: at(70), t: 70 }));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('stops following when the viewer scrolls up, and offers the way back', () => {
    const { rerender } = renderLog({ items: at(200), playing: true, t: 200 });

    stubScroll(list(), 0, 200, 900);
    fireEvent.scroll(list());

    const follow = screen.getByTestId('log-follow');
    expect(follow).toHaveTextContent(copy.logFollow);

    // …and a new row no longer drags the list away from what they are reading.
    scrollTo.mockClear();
    act(() => rerender({ items: at(210), t: 210 }));
    expect(scrollTo).not.toHaveBeenCalled();

    scrollTo.mockClear();
    fireEvent.click(screen.getByTestId('log-follow'));

    expect(scrollTo).toHaveBeenCalled();
    expect(screen.queryByTestId('log-follow')).not.toBeInTheDocument();
  });

  it('re-arms itself when the viewer scrolls back to the end', () => {
    renderLog({ items: at(200), playing: true, t: 200 });

    stubScroll(list(), 0, 200, 900);
    fireEvent.scroll(list());
    expect(screen.getByTestId('log-follow')).toBeInTheDocument();

    stubScroll(list(), 700, 200, 900);
    fireEvent.scroll(list());
    expect(screen.queryByTestId('log-follow')).not.toBeInTheDocument();
  });

  it('honours prefers-reduced-motion: no smooth scrolling', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    try {
      const { rerender } = renderLog({ items: at(62), playing: true, t: 62 });
      scrollTo.mockClear();

      act(() => rerender({ items: at(70), t: 70 }));

      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('EpisodeLog - the live region’s cadence', () => {
  it('changes the count at most once a second (FR-406, research R5)', () => {
    vi.useFakeTimers();
    const total = at(200).length;
    const { rerender } = renderLog({ items: at(200), t: 200 });

    // The first change is worth saying at once.
    fireEvent.click(chipType('achievement'));
    expect(count()).toHaveTextContent(copy.logCountFiltered(3, total));

    // A second change inside the same second waits its turn…
    act(() => rerender({ items: at(62), t: 62 }));
    expect(rows()).toHaveLength(3);
    expect(count()).toHaveTextContent(copy.logCountFiltered(3, total));

    // …and then says the latest truth, not the queue of everything it missed.
    act(() => {
      vi.advanceTimersByTime(COUNT_THROTTLE_MS);
    });
    expect(count()).toHaveTextContent(copy.logCountFiltered(3, at(62).length));
  });
});

describe('EpisodeLog - embedded in the phone Log pane (006 T605)', () => {
  function renderEmbedded(initialOpen = false) {
    const onOpenChange = vi.fn();
    render(
      <EpisodeLog
        items={at(200)}
        party={party}
        t={200}
        playing={false}
        onSeek={vi.fn()}
        onShare={vi.fn()}
        initialOpen={initialOpen}
        onOpenChange={onOpenChange}
        embedded
      />,
    );
    return { onOpenChange };
  }

  it('opens without a toggle, whatever the remembered preference says', () => {
    // The tab is the open/closed control, so the section has no second one
    // and `initialOpen` does not apply (FR-503).
    renderEmbedded(false);
    expect(screen.queryByTestId('log-toggle')).toBeNull();
    expect(screen.getByTestId('episode-log')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('episode-log')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByTestId('log-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('log-row').length).toBeGreaterThan(0);
  });

  it('keeps the title and the elapsed count in the bar', () => {
    renderEmbedded();
    expect(screen.getByText(copy.logTitle)).toBeInTheDocument();
    expect(screen.getByTestId('log-count')).toHaveTextContent(copy.logCount(at(200).length));
  });

  it('still filters, and the filters still narrow the count', () => {
    renderEmbedded();
    const total = at(200).length;
    fireEvent.click(chipType('achievement'));
    expect(screen.getByTestId('log-count')).toHaveTextContent(copy.logCountFiltered(3, total));
  });

  it('leaves the free-standing log unchanged: toggle present, closed by default', () => {
    renderLog({ initialOpen: false });
    expect(screen.getByTestId('log-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('episode-log')).not.toHaveAttribute('data-embedded');
    expect(screen.queryByTestId('log-list')).toBeNull();
  });
});
