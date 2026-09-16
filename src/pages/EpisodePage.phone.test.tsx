// @vitest-environment jsdom
/**
 * T609 — the phone composition (006 US1–US4). The page is the same `App` the
 * desktop suite drives; only the environment changes: `matchMedia` answers
 * "≤ 900 px" with a match, and `IntersectionObserver` is a stub whose callback
 * the test fires, so "the stage scrolled past the header" is a function call.
 *
 * Everything the panes show is still the pure function of `(episode, t)` the
 * desktop tests assert (constitution I); what is proved here is the layout:
 * which tree renders, in what order, and what the tabs, the sheet and the
 * mini-player do.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '../App';
import { copy } from '../copy';
import { resumeKey } from '../playback/resume';
import { __fakeSources } from '../components/VideoStage/FakeStage';
import { makeEpisodeRaw, makeRegistry, makeShow } from '../test/fixtures';

/** The one media query the page branches on (`useIsPhone`, `usePanel`). */
const PHONE_QUERY = '(max-width: 900px)';

function stubFetch() {
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
    if (url.includes('npcs.json')) {
      return Promise.resolve(
        new Response(JSON.stringify(makeRegistry()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    const episodeId = Number(/ep(\d+)\.json/.exec(url)?.[1] ?? 1);
    return Promise.resolve(
      new Response(JSON.stringify(makeEpisodeRaw(episodeId)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
}

/**
 * A phone-width viewport: only the breakpoint query matches, so reduced motion
 * stays off and every other query answers the way a plain browser would.
 */
function stubPhoneMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches: query === PHONE_QUERY,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }));
}

interface StubObserver {
  callback: IntersectionObserverCallback;
  observed: Element[];
}

/** Hands every observer the page builds back to the test (as in T601). */
function stubIntersectionObserver(): StubObserver[] {
  const instances: StubObserver[] = [];
  class Stub {
    private readonly self: StubObserver;
    constructor(callback: IntersectionObserverCallback) {
      this.self = { callback, observed: [] };
      instances.push(this.self);
    }
    observe(element: Element) {
      this.self.observed.push(element);
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', Stub as unknown as typeof IntersectionObserver);
  return instances;
}

/** The two facts `useMiniPlayer` reads off an entry (research R1). */
function fireIntersection(observer: StubObserver, isIntersecting: boolean, top: number): void {
  act(() => {
    observer.callback(
      [{ isIntersecting, boundingClientRect: { top } } as unknown as IntersectionObserverEntry],
      null as unknown as IntersectionObserver,
    );
  });
}

let observers: StubObserver[] = [];
let scrollTo: ReturnType<typeof vi.fn>;

async function mountEpisode(entry = '/ep/1?fake=1') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByTestId('fake-stage')).toBeInTheDocument());
  await waitFor(() => expect(__fakeSources.length).toBeGreaterThan(0));
  await waitFor(() => expect(screen.getAllByTestId('crawler-frame')).toHaveLength(5));
  const source = __fakeSources[__fakeSources.length - 1];
  return {
    source,
    seek(t: number) {
      act(() => source.set(t));
    },
  };
}

/** The observer watching the stage's sentinel; there is exactly one. */
function stageObserver(): StubObserver {
  expect(observers.length).toBeGreaterThan(0);
  return observers[observers.length - 1];
}

/** Scrolls the stage up past the header — or back into view. */
function dock(): void {
  fireIntersection(stageObserver(), false, -10);
}

function undock(): void {
  fireIntersection(stageObserver(), true, 8);
}

function tab(id: string): HTMLElement {
  return screen.getByTestId(`tab-${id}`);
}

function openTab(id: string): void {
  fireEvent.click(tab(id));
}

function frame(crawlerId: string): HTMLElement {
  const element = document.querySelector(`[data-crawler="${crawlerId}"]`);
  if (!element) throw new Error(`No crawler frame for ${crawlerId}`);
  return element as HTMLElement;
}

/** jsdom has no `PointerEvent`; a bubbling MouseEvent carries the fields React reads. */
function firePointer(type: string, clientX: number, clientY: number): void {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(event, 'pointerId', { value: 7 });
  fireEvent(screen.getByTestId('mobile-tabpanels'), event);
}

/** One whole horizontal gesture on the pane area: down, move by dx, up. */
function swipe(dx: number, dy = 0): void {
  firePointer('pointerdown', 200, 300);
  firePointer('pointermove', 200 + dx, 300 + dy);
  firePointer('pointerup', 200 + dx, 300 + dy);
}

/** True when `first` comes before `second` in document order. */
function precedes(first: Element, second: Element): boolean {
  return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

function seedResume(episodeId: number, t: number): void {
  localStorage.setItem(
    resumeKey(episodeId),
    JSON.stringify({ episodeId, t, savedAt: new Date('2026-09-15T12:00:00.000Z').toISOString() }),
  );
}

beforeEach(() => {
  __fakeSources.length = 0;
  localStorage.clear();
  stubFetch();
  stubPhoneMedia();
  observers = stubIntersectionObserver();
  scrollTo = vi.fn();
  vi.stubGlobal('scrollTo', scrollTo);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.className = '';
});

describe('EpisodePage on a phone', () => {
  /* ------------------------------------------------- US2: the tabbed layout */

  it('stacks stage, caption, timeline and tabs, and drops the desktop rail and log', async () => {
    await mountEpisode();

    const slot = screen.getByTestId('stage-slot');
    const caption = screen.getByTestId('stage-caption-row');
    const timeline = screen.getByTestId('event-timeline');
    const tabs = screen.getByTestId('mobile-tabs');
    expect(precedes(slot, caption)).toBe(true);
    expect(precedes(caption, timeline)).toBe(true);
    expect(precedes(timeline, tabs)).toBe(true);

    // The sentinel is the stage's immediate previous sibling (FR-500).
    expect(slot.previousElementSibling).toBe(screen.getByTestId('stage-sentinel'));
    expect(stageObserver().observed).toEqual([screen.getByTestId('stage-sentinel')]);

    // No rail column, and the log is the Log tab's, not a full-width block.
    expect(document.querySelector('aside')).toBeNull();
    expect(screen.queryByTestId('rail-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('episode-log')).toHaveAttribute('data-embedded', 'true');
    expect(screen.queryByTestId('log-toggle')).not.toBeInTheDocument();
  });

  it('opens on the Feed pane with the feed the playhead says', async () => {
    const { seek } = await mountEpisode();

    expect(tab('feed')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tabpanel-feed')).not.toHaveAttribute('hidden');
    expect(screen.getByTestId('tabpanel-party')).toHaveAttribute('hidden');

    seek(50);
    expect(screen.getAllByTestId('feed-item')).toHaveLength(3); // 12, 30, 45
    expect(within(screen.getByTestId('tabpanel-feed')).getByTestId('feed-items')).toBeInTheDocument();
  });

  it('shows the party as a two-column grid of five frames', async () => {
    await mountEpisode();

    openTab('party');
    const rail = screen.getByTestId('party-rail');
    expect(rail).toHaveAttribute('data-layout', 'grid');
    expect(within(rail).getAllByTestId('crawler-frame')).toHaveLength(5);
    expect(screen.getByTestId('tabpanel-party')).not.toHaveAttribute('hidden');
  });

  it('shows the floor map inline and never the stage badge', async () => {
    const { seek } = await mountEpisode();

    seek(60); // past the first map reveal
    openTab('map');
    expect(screen.getByTestId('floormap')).toBeInTheDocument();
    expect(screen.getByTestId('floormap-count')).toBeInTheDocument();
    expect(screen.queryByTestId('minimap-badge')).not.toBeInTheDocument();
  });

  it('shows the broadcast log open, with no toggle of its own', async () => {
    const { seek } = await mountEpisode();

    seek(60);
    openTab('log');
    const log = screen.getByTestId('episode-log');
    expect(log).toHaveAttribute('data-embedded', 'true');
    expect(within(log).getByTestId('log-list')).toBeInTheDocument();
    expect(within(log).queryByTestId('log-toggle')).not.toBeInTheDocument();
  });

  it('switches panes with the arrow keys and with a swipe', async () => {
    await mountEpisode();

    tab('feed').focus();
    fireEvent.keyDown(tab('feed'), { key: 'ArrowRight' });
    expect(tab('party')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tabpanel-party')).not.toHaveAttribute('hidden');

    // A swipe left on the pane area pulls the next pane in (FR-502).
    swipe(-100);
    expect(tab('map')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tabpanel-map')).not.toHaveAttribute('hidden');

    // …and right goes back.
    swipe(100);
    expect(tab('party')).toHaveAttribute('aria-selected', 'true');
  });

  /* ----------------------------------------------- US3: panels as sheets */

  it('opens a tapped frame as a bottom sheet over the page, with the glance inside', async () => {
    await mountEpisode();

    openTab('party');
    fireEvent.click(frame('harry'));

    const panel = screen.getByTestId('rail-panel');
    expect(panel).toHaveAttribute('data-presentation', 'sheet');
    expect(within(panel).getByTestId('crawler-glance')).toBeInTheDocument();
    expect(within(panel).getByTestId('sheet-handle')).toBeInTheDocument();

    // Portalled to the body, so nothing in the tab panes can clip it (FR-504).
    const backdrop = screen.getByTestId('sheet-backdrop');
    expect(backdrop.parentElement).toBe(document.body);
    expect(backdrop).toContainElement(panel);
    // The page behind it does not scroll while it is open.
    expect(document.body).toHaveClass('panel-open');
  });

  it('opens the full record above the sheet and keeps the sheet behind it', async () => {
    await mountEpisode();

    openTab('party');
    fireEvent.click(frame('harry'));
    fireEvent.click(screen.getByTestId('open-record'));

    const record = screen.getByTestId('crawler-record');
    expect(record).toBeInTheDocument();
    // The sheet is still mounted underneath: closing the record returns to it.
    expect(screen.getByTestId('rail-panel')).toHaveAttribute('data-presentation', 'sheet');
    expect(precedes(screen.getByTestId('sheet-backdrop'), record)).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('crawler-record')).not.toBeInTheDocument();
    expect(screen.getByTestId('rail-panel')).toBeInTheDocument();
  });

  it('closes the sheet on Escape and hands focus back to the frame', async () => {
    await mountEpisode();

    openTab('party');
    const harry = frame('harry');
    fireEvent.click(harry);
    expect(screen.getByTestId('rail-panel')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByTestId('rail-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sheet-backdrop')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(harry);
  });

  it('closes the sheet when the dim area above it is tapped', async () => {
    await mountEpisode();

    openTab('party');
    fireEvent.click(frame('harry'));
    fireEvent.click(screen.getByTestId('sheet-backdrop'));

    expect(screen.queryByTestId('rail-panel')).not.toBeInTheDocument();
  });

  /* ------------------------------------------------ US1: the mini-player */

  it('docks the stage once the sentinel has scrolled past, and undocks on the way back', async () => {
    await mountEpisode();

    const slot = screen.getByTestId('stage-slot');
    expect(slot).not.toHaveAttribute('data-mini');
    // The slot keeps its box whether docked or not (FR-500).
    expect(screen.getByTestId('stage-placeholder')).toBeInTheDocument();
    const stage = screen.getByTestId('video-stage');

    dock();
    expect(slot).toHaveAttribute('data-mini', 'true');
    expect(screen.getByTestId('mini-return')).toBeInTheDocument();
    expect(screen.getByTestId('stage-placeholder')).toBeInTheDocument();
    // The same player element, never a remount (constitution II, FR-500).
    expect(screen.getByTestId('video-stage')).toBe(stage);
    expect(screen.getByTestId('fake-stage')).toBeInTheDocument();

    undock();
    expect(slot).not.toHaveAttribute('data-mini');
    expect(screen.queryByTestId('mini-return')).not.toBeInTheDocument();
  });

  it('scrolls back to the full stage from the mini-player control', async () => {
    await mountEpisode();

    dock();
    fireEvent.click(screen.getByTestId('mini-return'));

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it('does not dock while a resume offer is standing', async () => {
    seedResume(1, 120);
    await mountEpisode();

    expect(screen.getByTestId('resume-card')).toBeInTheDocument();
    dock();
    expect(screen.getByTestId('stage-slot')).not.toHaveAttribute('data-mini');
    expect(screen.queryByTestId('mini-return')).not.toBeInTheDocument();

    // Answering the offer frees the stage to dock again.
    fireEvent.click(screen.getByRole('button', { name: copy.resumeStartOver }));
    dock();
    expect(screen.getByTestId('stage-slot')).toHaveAttribute('data-mini', 'true');
  });

  it('does not dock once the broadcast has ended', async () => {
    const { source } = await mountEpisode();

    act(() => source.end());
    dock();

    expect(screen.getByTestId('stage-slot')).not.toHaveAttribute('data-mini');
    expect(screen.getByRole('link', { name: copy.nextEpisodeCard })).toBeInTheDocument();
  });
});
