// @vitest-environment jsdom
/**
 * Page-level proof of the time-truth invariants (constitution I; SC-002/003/004).
 *
 * The whole page is driven by the dev `FakeStage`'s `FakeTimeSource` — no network,
 * no video host — which is exactly the guarantee constitution II asks for.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '../App';
import { copy } from '../copy';
import { feedItems } from '../engine/selectors';
import { formatTime } from '../engine/time';
import { isKnownEvent } from '../data/types';
import { resumeKey } from '../playback/resume';
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

/** Clicks a crawler frame — the dossier trigger (contracts/panels.md). */
function clickFrame(crawlerId: string): void {
  fireEvent.click(frame(crawlerId));
}

/** The rail's fixed-height glance card (US1). */
function glance(): HTMLElement {
  return screen.getByTestId('crawler-glance');
}

/** The modal full record (US2) — the only overlay allowed over the stage. */
function record(): HTMLElement {
  return screen.getByTestId('crawler-record');
}

/** The glance card's one control, which opens the record (FR-200/FR-203). */
function openRecord(): void {
  fireEvent.click(screen.getByTestId('open-record'));
}

/**
 * One section of the open full record, so "Door" in HISTORY never fools HOTLIST.
 * Since 003 the full lists live in the dialog, not the rail, so every caller
 * opens the record first.
 */
function section(name: string): HTMLElement {
  return within(record()).getByTestId(`dossier-${name}`);
}

function pressEscape(): void {
  fireEvent.keyDown(document, { key: 'Escape' });
}

/**
 * Escape the way a viewer produces one: from the focused element upward. The
 * record listens in the capture phase on `document`, so a press dispatched *at*
 * `document` would reach the panel's bubble-phase listener on the same node too
 * and close both at once (contracts/dialog.md).
 */
function pressEscapeFrom(element: Element): void {
  fireEvent.keyDown(element, { key: 'Escape' });
}

/** The feed sentence a given event produces, used for the never-early sweep. */
function textOf(index: number): string | undefined {
  const event = episode.events[index];
  return feedItems(episode.events, event.t, 100, party).find((item) => item.id === index)?.text;
}

describe('EpisodePage', () => {
  beforeEach(() => {
    __fakeSources.length = 0;
    localStorage.clear();
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

    // The newest event that has actually elapsed at 180 (the fixture runs past it).
    const lastElapsed = episode.events.reduce(
      (latest, event, index) => (event.t <= 180 ? index : latest),
      -1,
    );
    const newest = textOf(lastElapsed);
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
      // A sponsor inside its window is pinned rather than listed, so look page-wide.
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
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
    expect(within(screen.getByTestId('feed-items')).queryByTestId('sponsor')).toBeNull();

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
    expect(screen.getByRole('button', { name: copy.markerUpcoming(copy.markerKinds.boss, '2:00') })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: copy.markerUpcoming(copy.markerKinds.boss, '2:00') }));

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
      '/ep/2?fake=1',
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

  /* ------------------------------------------ polish: strip scrubbing + episode switch */

  it('seeks to any point on the timeline strip, not just the markers', async () => {
    const { source } = await mountEpisode();
    const strip = screen.getByTestId('event-timeline');
    vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({
      x: 100, y: 0, left: 100, top: 0, width: 400, height: 20, right: 500, bottom: 20, toJSON: () => ({}),
    } as DOMRect);

    fireEvent.click(strip, { clientX: 200 }); // a quarter of the way along a 240 s episode
    expect(source.getTime()).toBe(60);
    expect(screen.getByText(copy.feedHeader('1:00'))).toBeInTheDocument();

    // Clamped at both ends.
    fireEvent.click(strip, { clientX: 900 });
    expect(source.getTime()).toBe(240);
    fireEvent.click(strip, { clientX: -50 });
    expect(source.getTime()).toBe(0);
  });

  it('starts the next recap episode from the beginning', async () => {
    const { seek } = await mountEpisode();
    seek(100);
    expect(screen.getByText(copy.feedHeader('1:40'))).toBeInTheDocument();
    expect(feedCount()).toBeGreaterThan(0);

    const header = screen.getByRole('banner');
    fireEvent.click(within(header).getByRole('link', { name: copy.nextEpisode }));

    await waitFor(() => expect(screen.getByText(copy.feedHeader('0:00'))).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByTestId('crawler-frame')).toHaveLength(5));
    expect(feedCount()).toBe(0);
    expect(document.title).toBe(copy.pageTitle(makeShow().episodes[1].title));
  });

  /* ---------------------------- v2 US1 / 003 US1: the rail's glance card (T119, T310) */

  it('opens a crawler glance card in the rail and hides the feed', async () => {
    const { seek } = await mountEpisode();
    seek(200);

    clickFrame('harry');

    const panel = screen.getByRole('region', { name: copy.dossierTitle('Harry') });
    expect(panel).toHaveAttribute('id', 'rail-panel');
    expect(within(panel).getByTestId('glance-name')).toHaveTextContent('Harry');
    expect(within(panel).getByText(copy.glanceKicker)).toBeInTheDocument();
    // The rail hosts exactly one thing: the feed is gone while a panel is open (FR-100).
    expect(screen.queryByTestId('feed-items')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('rail-panel')).toHaveLength(1);

    // A glance, not the sheet: the worn kit and the newest award, never the
    // full lists, so the card cannot grow with the episode (R2-FR-201). The
    // ledger rows the card used to carry are gone with revision 2.
    expect(within(panel).queryByTestId('glance-ledger')).not.toBeInTheDocument();
    for (const kind of ['hotlist', 'skills', 'inventory', 'achievements']) {
      expect(within(panel).queryByTestId(`ledger-${kind}`)).not.toBeInTheDocument();
      expect(within(panel).queryByTestId(`dossier-${kind}`)).not.toBeInTheDocument();
    }
    expect(within(panel).queryByTestId('dossier-identity')).not.toBeInTheDocument();
    // …and nothing covers the stage until the viewer asks (constitution III).
    expect(screen.queryByTestId('crawler-record')).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('dialog-open');

    // Worn gear as of the playhead, in sheet order: Harry took the jacket at
    // 152, the charm at 153, dropped the crowbar at 168 and took the torch at
    // 169 (R2-FR-201/FR-202).
    const equipped = within(panel).getByTestId('glance-equipped');
    const worn = within(equipped).getAllByTestId('glance-equipped-row');
    expect(worn.map((row) => row.getAttribute('data-slot'))).toEqual([
      'torso',
      'hands',
      'accessory',
    ]);
    expect(worn[1]).toHaveTextContent('Torch');

    // The newest award, with its time — one line, not the whole list.
    const latest = within(panel).getByTestId('glance-latest-achievement');
    expect(within(latest).getByText('Gate Crasher')).toBeInTheDocument();
    expect(within(latest).getByText(formatTime(60))).toBeInTheDocument();

    // Vitals: the ten-segment strip and the HP readout, in the card.
    expect(within(panel).getAllByTestId('hp-segment')).toHaveLength(10);
    expect(within(panel).getByTestId('glance-hp')).toHaveTextContent(copy.hpValue(20, 22));

    // Three history rows here, and never a placeholder dash: the card holds its
    // height in CSS instead (review 0.1, R2-FR-201).
    expect(within(panel).getAllByTestId('glance-history-row')).toHaveLength(3);
    expect(within(panel).queryByText(/^—$/)).not.toBeInTheDocument();

    // The single control that leads deeper, and nothing else (FR-203).
    expect(within(panel).getByTestId('open-record')).toHaveTextContent(copy.openRecord);
  });

  /* ------------------------------------------ 003 US2: the full record (T310) */

  it('opens the full record from the glance card with every section in full', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('harry');

    openRecord();

    const dialog = record();
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(copy.recordTitle('Harry'));
    expect(within(dialog).getByText(copy.recordKicker)).toBeInTheDocument();
    // The glance card is still behind it: the record covers the stage, it does
    // not replace the rail (US2 scenario 3).
    expect(glance()).toBeInTheDocument();
    expect(document.body).toHaveClass('dialog-open');

    // Sheet identity, straight from the episode's initial state (FR-113).
    const identity = within(section('identity'));
    expect(identity.getByText('Human')).toBeInTheDocument();
    expect(identity.getByText('he/him')).toBeInTheDocument();
    expect(identity.getByText('10,491,201')).toBeInTheDocument();
    expect(identity.getByText('Compensated Anarchist')).toBeInTheDocument(); // class at 95

    // Vitals: the ten-segment strip, the HP readout, current and best rank.
    expect(within(section('vitals')).getAllByTestId('hp-segment')).toHaveLength(10);
    expect(within(dialog).getByTestId('dossier-hp')).toHaveTextContent(copy.hpValue(20, 22));
    expect(within(dialog).getByTestId('rank-current')).toHaveTextContent(copy.rankValue(3550));
    expect(within(dialog).getByTestId('rank-best')).toHaveTextContent(copy.rankValue(3012));

    // Stats only exist because this fixture crawler carries them.
    expect(within(section('stats')).getByText(copy.statLabels.dex)).toBeInTheDocument();
    expect(within(section('stats')).getByText('7')).toBeInTheDocument();

    // Every list in full — this is the deep view the glance card summarizes (FR-211).
    expect(within(section('hotlist')).getByText('Crowbar')).toBeInTheDocument();
    expect(within(section('skills')).getByText('Powerful Strike')).toBeInTheDocument();
    expect(within(section('inventory')).getByText('Torch')).toBeInTheDocument();
    expect(within(section('achievements')).getByText('Gate Crasher')).toBeInTheDocument();
    // …and History is not clipped to the card's three moments.
    expect(
      within(section('history')).getAllByTestId('dossier-history-item').length,
    ).toBeGreaterThan(3);
  });

  it('closes the record on Escape, on the backdrop, and on its close control', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('harry');

    // Escape: only the record closes, the glance card stays, focus comes back
    // to the button that opened it (US2 scenario 3, FR-210).
    openRecord();
    expect(document.activeElement).toBe(screen.getByTestId('record-close'));
    pressEscapeFrom(document.body);
    expect(screen.queryByTestId('crawler-record')).not.toBeInTheDocument();
    expect(glance()).toBeInTheDocument();
    expect(screen.getByTestId('rail-panel')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId('open-record'));
    expect(document.body).not.toHaveClass('dialog-open');

    // The dimmed backdrop (US2 scenario 4). A click inside it does nothing.
    openRecord();
    fireEvent.click(within(record()).getByTestId('record-body'));
    expect(record()).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('record-backdrop'));
    expect(screen.queryByTestId('crawler-record')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId('open-record'));

    // The close control.
    openRecord();
    fireEvent.click(screen.getByTestId('record-close'));
    expect(screen.queryByTestId('crawler-record')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId('open-record'));

    // With no record open the next Escape belongs to the panel again — one
    // press, one dismissal, menu first (spec edge case, FR-104).
    pressEscapeFrom(document.body);
    expect(screen.queryByTestId('rail-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('feed-items')).toBeInTheDocument();
    expect(document.activeElement).toBe(frame('harry'));
  });

  it('keeps the open record on the playhead, in both directions', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('harry');
    openRecord();

    expect(within(section('inventory')).getByText('Torch')).toBeInTheDocument();
    expect(within(section('inventory')).queryByText('Enchanted Crowbar')).not.toBeInTheDocument();

    // The trade at 150 has not happened yet: the dialog stays open and restates
    // itself rather than closing or remounting (US2 scenario 2, FR-212).
    const before = record();
    seek(110);
    expect(record()).toBe(before);
    expect(within(section('inventory')).getByText('Enchanted Crowbar')).toBeInTheDocument();
    expect(within(section('inventory')).queryByText('Torch')).not.toBeInTheDocument();
    expect(within(section('hotlist')).getByText('Door')).toBeInTheDocument();

    // And the glance card behind it moves with it: at 110 the crowbar is still
    // in Harry's hands, because he trades it for the torch at 169.
    expect(
      within(screen.getByTestId('glance-equipped')).getByText('Enchanted Crowbar'),
    ).toBeInTheDocument();

    seek(20);
    expect(within(section('achievements')).getByText(copy.dossierEmpty.achievements)).toBeInTheDocument();
    expect(record()).toBe(before);
  });

  it('closes the record when the panel switches crawlers or closes', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('harry');
    openRecord();
    expect(record()).toHaveAttribute('data-crawler', 'harry');

    // Another frame switches the glance and drops the record: the record only
    // ever exists for the crawler whose card opened it (FR-213).
    clickFrame('xo');
    expect(screen.queryByTestId('crawler-record')).not.toBeInTheDocument();
    expect(glance()).toHaveAttribute('data-crawler', 'xo');
    expect(document.body).not.toHaveClass('dialog-open');

    // Closing the panel outright takes the record with it.
    openRecord();
    expect(record()).toHaveAttribute('data-crawler', 'xo');
    fireEvent.click(screen.getByTestId('panel-close'));
    expect(screen.queryByTestId('crawler-record')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crawler-glance')).not.toBeInTheDocument();
    expect(screen.getByTestId('feed-items')).toBeInTheDocument();
    expect(document.activeElement).toBe(frame('xo'));
  });

  it('opens the record on load from the DEV `&record=1` flag', async () => {
    await mountEpisode('/ep/1?fake=1&t=200&panel=dossier:harry&record=1');

    // The flag waits for the panel it names: the record cannot open before the
    // episode data behind it has landed (spec Edge Cases).
    await waitFor(() => expect(screen.getByTestId('crawler-record')).toBeInTheDocument());
    expect(glance()).toHaveAttribute('data-crawler', 'harry');
    expect(within(section('inventory')).getByText('Torch')).toBeInTheDocument();

    // Once dismissed the flag does not re-open it.
    fireEvent.click(screen.getByTestId('record-close'));
    expect(screen.queryByTestId('crawler-record')).not.toBeInTheDocument();
  });

  /* ------------------- 003 revision 2: the record as a crawler sheet (T328) */

  it('lays the hotlist out as a ten-slot hotbar with a "+N" overflow marker', async () => {
    const { seek } = await mountEpisode();
    seek(210);
    clickFrame('harry');
    openRecord();

    // 105 adds Door, 165 swaps it for Crowbar, 210 adds ten more names: the bar
    // is always ten keys, filled in hotlist order, and the eleventh entry
    // becomes the marker rather than a row of its own (R2-FR-221).
    const slots = within(section('hotlist')).getAllByTestId('hotbar-slot');
    expect(slots).toHaveLength(10);
    expect(slots.map((slot) => slot.getAttribute('data-name'))).toEqual([
      'Crowbar',
      'The Hoarder',
      'Bronze Box Runner',
      'The Doorway',
      'Quadrant C',
      'The Rot Market',
      'Signal Tower',
      'The Meat District',
      'Grull Industries',
      'The Understudy',
    ]);
    expect(within(section('hotlist')).getByTestId('hotbar-overflow')).toHaveTextContent(
      copy.hotbarOverflow(1),
    );

    // Each key says which key it is and what is on it, because the visible name
    // is clamped to two lines inside the square (T330).
    expect(slots[0]).toHaveAttribute('aria-label', copy.hotbarSlotAria(1, 'Crowbar'));
    expect(slots[9]).toHaveAttribute('aria-label', copy.hotbarSlotAria(10, 'The Understudy'));

    // A second before the bulk add: the same ten keys, one lit, no marker — the
    // bar never reflows with the playhead (R2 US2 scenario 2).
    seek(200);
    const earlier = within(section('hotlist')).getAllByTestId('hotbar-slot');
    expect(earlier).toHaveLength(10);
    expect(earlier.filter((slot) => slot.hasAttribute('data-filled'))).toHaveLength(1);
    expect(earlier[1]).toHaveAttribute('aria-label', copy.hotbarSlotEmptyAria(2));
    expect(within(section('hotlist')).queryByTestId('hotbar-overflow')).not.toBeInTheDocument();
  });

  it('files worn gear by slot on the record, and empty slots as "—"', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('harry');
    openRecord();

    // Every slot on the official sheet, in sheet order (R2 US2 scenario 3).
    const rows = within(section('gear')).getAllByTestId('gear-row');
    expect(rows.map((row) => row.getAttribute('data-slot'))).toEqual([
      'head',
      'torso',
      'arms',
      'hands',
      'legs',
      'feet',
      'accessory',
    ]);
    const bySlot = new Map(rows.map((row) => [row.getAttribute('data-slot'), row]));
    // Jacket at 152, charm at 153, crowbar dropped at 168, torch taken at 169.
    expect(bySlot.get('torso')).toHaveTextContent('Patched Jacket');
    expect(bySlot.get('hands')).toHaveTextContent('Torch');
    expect(bySlot.get('accessory')).toHaveTextContent('Lucky Rabbit Foot');
    expect(bySlot.get('head')).toHaveTextContent(copy.dossierEmpty.gearSlot);
    expect(bySlot.get('head')).not.toHaveAttribute('data-filled');

    // Back before the swap the crowbar is in his hands again, and the jacket is
    // not on his back (constitution I, through the gear reducer).
    seek(160);
    const at160 = new Map(
      within(section('gear'))
        .getAllByTestId('gear-row')
        .map((row) => [row.getAttribute('data-slot'), row]),
    );
    expect(at160.get('hands')).toHaveTextContent('Enchanted Crowbar');
    expect(at160.get('torso')).toHaveTextContent('Patched Jacket');

    seek(140);
    const at140 = new Map(
      within(section('gear'))
        .getAllByTestId('gear-row')
        .map((row) => [row.getAttribute('data-slot'), row]),
    );
    expect(at140.get('torso')).toHaveTextContent(copy.dossierEmpty.gearSlot);
    expect(at140.get('accessory')).toHaveTextContent(copy.dossierEmpty.gearSlot);
  });

  it('follows the playhead across every equip boundary on the glance card', async () => {
    const { seek } = await mountEpisode();
    clickFrame('harry');

    const worn = () =>
      within(screen.getByTestId('glance-equipped'))
        .getAllByTestId('glance-equipped-row')
        .map((row) => `${row.getAttribute('data-slot')}:${row.textContent}`);

    // Only the crowbar he starts with.
    seek(140);
    expect(worn().map((row) => row.split(':')[0])).toEqual(['hands']);

    // 152 jacket, 153 charm — the crowbar is still in hand until 168.
    seek(160);
    expect(worn().map((row) => row.split(':')[0])).toEqual(['torso', 'hands', 'accessory']);
    expect(worn()[1]).toContain('Enchanted Crowbar');

    // 168 clears the slot: the row disappears rather than going blank.
    seek(168);
    expect(worn().map((row) => row.split(':')[0])).toEqual(['torso', 'accessory']);

    // 169 fills it again with the torch.
    seek(169);
    expect(worn()[1]).toContain('Torch');

    // And at the very start nothing has been logged but the starting kit.
    seek(0);
    expect(worn().map((row) => row.split(':')[0])).toEqual(['hands']);
  });

  it('caps the record’s tile grids at eight and opens the rest in a list view', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('xo');
    openRecord();

    // Nine skills logged by 200; the sheet shows eight tiles and offers the
    // whole list behind one control (R2 US2 scenario 4).
    expect(within(section('skills')).getAllByTestId('tile')).toHaveLength(8);
    const viewAll = within(section('skills')).getByTestId('view-all-skills');
    expect(viewAll).toHaveTextContent(copy.viewAll(9));
    expect(viewAll).toHaveAttribute('aria-controls', 'crawler-record-body');

    fireEvent.click(viewAll);

    // The body swaps to the full list; the dialog itself is the same element,
    // so nothing about the modal is torn down (R2-FR-223).
    const dialog = record();
    expect(dialog).toHaveAttribute('data-view', 'skills');
    expect(dialog).toHaveAccessibleName(
      copy.recordListTitle('X.O.', copy.dossierSections.skills),
    );
    expect(within(dialog).queryByTestId('record-art')).not.toBeInTheDocument();
    expect(within(section('skills')).getAllByRole('listitem')).toHaveLength(9);
    // Focus lands on the list's heading (contracts/dialog.md Revision 2).
    expect(document.activeElement).toBe(
      within(section('skills')).getByRole('heading', { name: copy.dossierSections.skills }),
    );

    // Live updating holds inside the list view (R2 US2 scenario 6): at 100
    // X.O. has logged three of the nine.
    seek(100);
    expect(within(section('skills')).getAllByRole('listitem')).toHaveLength(3);
    expect(within(section('skills')).queryByText('Death Roll')).not.toBeInTheDocument();

    seek(200);
    fireEvent.click(within(record()).getByTestId('record-back'));

    // Back on the sheet, with the title and the focus the viewer left behind.
    expect(record()).toHaveAttribute('data-view', 'sheet');
    expect(record()).toHaveAccessibleName(copy.recordTitle('X.O.'));
    expect(within(section('skills')).getAllByTestId('tile')).toHaveLength(8);
    expect(document.activeElement).toBe(
      within(section('skills')).getByTestId('view-all-skills'),
    );
  });

  it('lets Escape step out of a list view before it closes the record', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('xo');
    openRecord();
    fireEvent.click(within(section('skills')).getByTestId('view-all-skills'));
    expect(record()).toHaveAttribute('data-view', 'skills');

    // First Escape: back to the sheet, record still open (R2 US2 scenario 5).
    pressEscapeFrom(document.body);
    expect(record()).toHaveAttribute('data-view', 'sheet');
    expect(glance()).toBeInTheDocument();
    expect(document.body).toHaveClass('dialog-open');

    // Second Escape: the record closes and nothing else does — the glance card
    // and its panel survive, and focus returns to the trigger (FR-210).
    pressEscapeFrom(document.body);
    expect(screen.queryByTestId('crawler-record')).not.toBeInTheDocument();
    expect(glance()).toBeInTheDocument();
    expect(screen.getByTestId('rail-panel')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId('open-record'));
    expect(document.body).not.toHaveClass('dialog-open');

    // Reopening always lands on the sheet, never mid-navigation (R2-FR-223).
    openRecord();
    expect(record()).toHaveAttribute('data-view', 'sheet');
  });

  it('draws the crawler’s full-figure art, and falls back to the bust', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('harry');
    openRecord();

    const art = within(record()).getByTestId('record-art-image');
    expect(art).toHaveAttribute('src', '/img/crawlers/harry-art.svg');
    expect(art).not.toHaveAttribute('data-fallback');
    expect(art).toHaveAccessibleName(copy.artAlt('Harry'));

    // X.O. has no `art` in the data, so the same column carries the bust
    // instead — the record never opens with a hole in it (R2 US2 scenario 1).
    fireEvent.click(screen.getByTestId('record-close'));
    clickFrame('xo');
    openRecord();
    const bust = within(record()).getByTestId('record-art-image');
    expect(bust).toHaveAttribute('src', '/img/crawlers/xo.svg');
    expect(bust).toHaveAttribute('data-fallback', 'bust');
    expect(bust).toHaveAccessibleName(copy.artAlt('X.O.'));
  });

  it('adds no second banner landmark when the record opens (T313)', async () => {
    const { seek } = await mountEpisode();
    seek(100);
    clickFrame('harry');
    openRecord();

    // The record's title bar is a plain box. A <header> whose nearest section
    // is the dialog maps to a banner landmark next to the site header's (axe
    // landmark-unique / landmark-no-duplicate-banner), and the record is what
    // has to hold Lighthouse accessibility at 100 (SC-204). The glance card's
    // own <header> is scoped by its <article>, so it is not a landmark.
    expect(screen.getByTestId('record-header').tagName).toBe('DIV');
    // Any <header> left inside the dialog must be scoped by sectioning content,
    // which is what stops it computing as a banner.
    for (const node of record().querySelectorAll('header')) {
      expect(node.closest('article, aside, main, nav, section')).not.toBeNull();
    }
    expect(glance().closest('article')).toBe(glance());
  });

  it('closes the record and the glance when the viewer changes episode', async () => {
    const { seek } = await mountEpisode();
    seek(100);
    const nextLink = within(screen.getByRole('banner')).getByRole('link', {
      name: copy.nextEpisode,
    });
    clickFrame('harry');
    openRecord();
    expect(record()).toBeInTheDocument();

    fireEvent.click(nextLink);

    // A new episode always opens ambient (US2 scenario 7).
    await waitFor(() => expect(screen.getByText(copy.feedHeader('0:00'))).toBeInTheDocument());
    expect(screen.queryByTestId('crawler-record')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crawler-glance')).not.toBeInTheDocument();
    expect(screen.getByTestId('feed-items')).toBeInTheDocument();
    expect(document.body).not.toHaveClass('dialog-open');
  });

  it('shows the hotlist as of the playhead, not as of the newest event', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('harry');
    openRecord();

    // 105 adds Door, 165 swaps it for Crowbar.
    expect(within(section('hotlist')).getByText('Crowbar')).toBeInTheDocument();
    expect(within(section('hotlist')).queryByText('Door')).not.toBeInTheDocument();

    seek(110);
    expect(within(section('hotlist')).getByText('Door')).toBeInTheDocument();
    expect(within(section('hotlist')).queryByText('Crowbar')).not.toBeInTheDocument();

    seek(20);
    // The sheet's ten-slot hotbar keeps its shape; only the marks rewind (T324).
    expect(section('hotlist').querySelectorAll('[data-item="hotlist"]')).toHaveLength(0);
  });

  it('upserts a skill rank while the record stays open', async () => {
    const { seek } = await mountEpisode();
    seek(160);
    clickFrame('xo');
    openRecord();

    const skills = () => within(section('skills'));
    expect(skills().getByText('Understudy Strike')).toBeInTheDocument();
    expect(skills().getByText(copy.skillRank(2))).toBeInTheDocument();

    seek(100);
    expect(skills().getByText(copy.skillRank(1))).toBeInTheDocument();
    expect(skills().queryByText(copy.skillRank(2))).not.toBeInTheDocument();

    seek(20);
    expect(skills().getByText(copy.dossierEmpty.skills)).toBeInTheDocument();
  });

  it('drops inventory the crawler has not looted yet on a backward seek', async () => {
    const { seek } = await mountEpisode();
    seek(110);
    clickFrame('harry');
    openRecord();

    // Looted at 30 …
    expect(within(section('inventory')).getByText('Enchanted Crowbar')).toBeInTheDocument();

    seek(20);
    expect(within(section('inventory')).queryByText('Enchanted Crowbar')).not.toBeInTheDocument();
    expect(within(section('inventory')).getByText(copy.dossierEmpty.inventory)).toBeInTheDocument();

    // … and traded for a Torch at 150.
    seek(200);
    expect(within(section('inventory')).getByText('Torch')).toBeInTheDocument();
    expect(within(section('inventory')).queryByText('Enchanted Crowbar')).not.toBeInTheDocument();
  });

  it('lists the achievements the crawler has earned, with their times', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('harry');

    openRecord();

    const achievements = within(section('achievements'));
    expect(achievements.getByText('Gate Crasher')).toBeInTheDocument();
    expect(achievements.getByText(formatTime(60))).toBeInTheDocument();
    // X.O.'s achievement at 61 belongs to X.O., not to Harry.
    expect(achievements.queryByText('Understudy')).not.toBeInTheDocument();

    seek(59);
    expect(
      within(section('achievements')).getByText(copy.dossierEmpty.achievements),
    ).toBeInTheDocument();
  });

  it('shows only that crawler in the history, newest first', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('harry');

    openRecord();

    const rows = within(section('history')).getAllByTestId('dossier-history-item');
    expect(rows.length).toBeGreaterThan(0);
    // Newest first: Harry's rank at 200.
    expect(within(rows[0]).getByText(copy.feedText.rankCrawler('Harry', 3550))).toBeInTheDocument();
    // X.O.'s moments are X.O.'s: rank is individual, and there is no party rank
    // for a dossier to inherit (T334).
    expect(
      within(section('history')).queryByText(copy.feedText.rankCrawler('X.O.', 3550)),
    ).not.toBeInTheDocument();
  });

  it('switches dossiers, toggles closed, and tracks aria-expanded', async () => {
    const { seek } = await mountEpisode();
    seek(200);

    clickFrame('harry');
    expect(frame('harry')).toHaveAttribute('aria-expanded', 'true');
    expect(frame('xo')).toHaveAttribute('aria-expanded', 'false');

    // A different frame switches without closing (US1 scenario 4).
    clickFrame('xo');
    expect(screen.getAllByTestId('rail-panel')).toHaveLength(1);
    expect(screen.getByTestId('glance-name')).toHaveTextContent('X.O.');
    expect(frame('harry')).toHaveAttribute('aria-expanded', 'false');
    expect(frame('xo')).toHaveAttribute('aria-expanded', 'true');

    // The same frame again closes it.
    clickFrame('xo');
    expect(screen.queryByTestId('rail-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('feed-items')).toBeInTheDocument();
    expect(frame('xo')).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on the panel close control and on Escape, returning focus to the frame', async () => {
    const { seek } = await mountEpisode();
    seek(200);

    clickFrame('harry');
    fireEvent.click(screen.getByRole('button', { name: copy.panelClose }));
    expect(screen.queryByTestId('rail-panel')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(frame('harry'));

    clickFrame('harry');
    expect(screen.getByTestId('rail-panel')).toBeInTheDocument();
    pressEscape();
    expect(screen.queryByTestId('rail-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('feed-items')).toBeInTheDocument();
    expect(document.activeElement).toBe(frame('harry'));
  });

  it('lets the Episodes menu win the first Escape (spec edge case)', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('harry');

    const menu = document.querySelector('header details') as HTMLDetailsElement;
    act(() => {
      menu.open = true;
    });

    pressEscape();
    expect(menu.open).toBe(false);
    expect(screen.getByTestId('rail-panel')).toBeInTheDocument();

    pressEscape();
    expect(screen.queryByTestId('rail-panel')).not.toBeInTheDocument();
  });


  /* ------------------------ revision 2 polish: T335 / T340 / T341 / T342 */

  it('stands by until the first event has elapsed (T335)', async () => {
    const { seek } = await mountEpisode();

    expect(screen.getByTestId('feed-standby')).toHaveTextContent(copy.feedStandby);

    seek(12);
    expect(screen.queryByTestId('feed-standby')).not.toBeInTheDocument();

    // It is a function of the playhead like everything else, so it comes back.
    seek(0);
    expect(screen.getByTestId('feed-standby')).toBeInTheDocument();
  });

  it('names the episode in a caption row under the stage, with the playhead (T340)', async () => {
    const { seek } = await mountEpisode();

    const row = screen.getByTestId('stage-caption-row');
    const heading = within(row).getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(copy.captionLeft(1, 1, makeShow().episodes[0].title));
    expect(screen.getByTestId('stage-caption-time')).toHaveTextContent(formatTime(0));

    seek(125);
    expect(screen.getByTestId('stage-caption-time')).toHaveTextContent(formatTime(125));

    // It no longer sits over the player, where the host's own chrome covered it.
    expect(within(screen.getByTestId('video-stage')).queryByTestId('stage-caption')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('legends the marker colours and marks the playhead apart from the fill (T341)', async () => {
    const { seek } = await mountEpisode();

    const legend = screen.getByTestId('timeline-legend');
    expect(within(legend).getAllByRole('listitem')).toHaveLength(5);
    for (const kind of ['story', 'boss', 'loot', 'achievement', 'levelup'] as const) {
      expect(within(legend).getByText(copy.markerKinds[kind])).toBeInTheDocument();
    }

    seek(60);
    const playhead = screen.getByTestId('timeline-playhead');
    expect(parseFloat(playhead.style.left)).toBeCloseTo(25, 3);
    expect(playhead).not.toBe(screen.getByTestId('timeline-fill'));
  });

  it('gives every marker its own tooltip rather than a native title (T341)', async () => {
    const { seek } = await mountEpisode();

    const markers = screen.getAllByTestId('timeline-marker');
    expect(markers[0]).not.toHaveAttribute('title');
    expect(screen.getByTestId('event-timeline')).not.toHaveAttribute('title');

    const tips = screen.getAllByRole('tooltip');
    expect(tips).toHaveLength(markers.length);
    // Spoiler-safe: before the playhead reaches it, a marker names only its kind.
    expect(tips[0]).toHaveTextContent(
      copy.markerUpcoming(copy.markerKinds.achievement, formatTime(60)),
    );

    seek(60);
    expect(screen.getAllByRole('tooltip')[0]).toHaveTextContent('Gate Crasher');
  });

  it('seeks the broadcast when a feed row is clicked (T342)', async () => {
    const { source, seek } = await mountEpisode();
    seek(60);

    const rows = screen.getAllByTestId('feed-item');
    expect(rows).toHaveLength(4); // 12, 30, 45, 60

    // Newest first, so the last row is the System's opener at t = 12. Since 004
    // the row holds two controls, so the seek half is named explicitly.
    const oldest = within(rows[3]).getByRole('button', {
      name: copy.feedSeek(formatTime(12), `${copy.labels.system_message} · Attention crawlers. The broadcast is live.`),
    });
    expect(within(rows[3]).getByTestId('feed-time')).toHaveTextContent(formatTime(12));
    expect(oldest).toHaveAccessibleName(
      copy.feedSeek(formatTime(12), `${copy.labels.system_message} · Attention crawlers. The broadcast is live.`),
    );

    fireEvent.click(oldest);
    expect(source.getTime()).toBe(12);
    expect(feedCount()).toBe(1);
    expect(screen.getByText(copy.feedHeader(formatTime(12)))).toBeInTheDocument();
  });

  it('seeks from the pinned sponsor too (T342)', async () => {
    const { source, seek } = await mountEpisode();
    seek(115);

    const pinned = screen.getByTestId('active-sponsor');
    expect(pinned.tagName).toBe('BUTTON');
    expect(within(pinned).getByTestId('feed-time')).toHaveTextContent(formatTime(110));

    fireEvent.click(pinned);
    expect(source.getTime()).toBe(110);
  });

  /* ------------------------------------------- v2 US4: rank sparklines (T121) */

  it('plots every elapsed rank event and summarizes it for assistive tech', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('harry');

    // The sparkline is part of the glance card now; the record carries its own.
    const sparkline = within(glance()).getByTestId('rank-sparkline');
    expect(sparkline).toHaveAttribute(
      'aria-label',
      copy.sparklineSummary(4188, 3550, 3, 3012),
    );
    expect(sparkline.getAttribute('aria-label')).toContain('3 updates');
    expect(sparkline.getAttribute('aria-label')).toContain('#3012');
    expect(sparkline.querySelectorAll('polyline')).toHaveLength(1);
    expect(screen.getByTestId('glance-rank-current')).toHaveTextContent(copy.rankValue(3550));
    expect(screen.getByTestId('glance-rank-best')).toHaveTextContent(copy.rankValue(3012));

    // Before the second rank event: one point, current and best both #4188.
    seek(120);
    const single = within(glance()).getByTestId('rank-sparkline');
    expect(single.querySelectorAll('polyline')).toHaveLength(0);
    expect(single.querySelectorAll('circle')).toHaveLength(2); // best ring + current dot
    expect(single).toHaveAttribute('aria-label', copy.sparklineSummary(4188, 4188, 1, 4188));
    expect(screen.getByTestId('glance-rank-current')).toHaveTextContent(copy.rankValue(4188));
    expect(screen.getByTestId('glance-rank-best')).toHaveTextContent(copy.rankValue(4188));

    // The record repeats it in the sheet's vitals band, at the same playhead.
    openRecord();
    expect(within(record()).getByTestId('rank-current')).toHaveTextContent(copy.rankValue(4188));
    expect(within(record()).getByTestId('rank-best')).toHaveTextContent(copy.rankValue(4188));
  });

  it('reads "Unranked" and draws no chart without rank events', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('xo');

    expect(within(screen.getByTestId('glance-rank')).getByText(copy.unranked)).toBeInTheDocument();
    expect(screen.queryByTestId('rank-sparkline')).not.toBeInTheDocument();

    // …and the record says the same thing, with no chart either (edge case).
    openRecord();
    expect(within(screen.getByTestId('dossier-rank')).getByText(copy.unranked)).toBeInTheDocument();
    expect(screen.queryByTestId('rank-sparkline')).not.toBeInTheDocument();
  });

  // DCC has individual rank only (T334): the feed header never carried a party
  // standing, and a rank event names the crawler who climbed.
  it('narrates a rank as one crawler climbing, and never a party line', async () => {
    const { seek } = await mountEpisode();

    seek(99);
    expect(
      screen.queryByText(copy.feedText.rankCrawler('Harry', 4188)),
    ).not.toBeInTheDocument();

    seek(100);
    expect(screen.getByText(copy.feedText.rankCrawler('Harry', 4188))).toBeInTheDocument();
    expect(screen.queryByTestId('party-rank')).not.toBeInTheDocument();
  });

  /* ------------------------------------------- v2 US2: the expanded floor map (T125) */

  /** The minimap badge — the map panel's trigger (contracts/panels.md). */
  function badge(): HTMLElement {
    return screen.getByTestId('minimap-badge');
  }

  /** The labels currently drawn on the open map, in reveal order. */
  function mapLabelText(): string[] {
    return screen.queryAllByTestId('floormap-label').map((label) => label.textContent ?? '');
  }

  it('opens the expanded floor map from the badge and labels only elapsed reveals', async () => {
    const { seek } = await mountEpisode();
    seek(100);
    expect(badge()).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(badge());

    const panel = screen.getByRole('region', { name: copy.mapTitle(1) });
    expect(panel).toHaveAttribute('id', 'rail-panel');
    expect(within(panel).getByText(copy.mapKicker)).toBeInTheDocument();
    expect(within(panel).getByTestId('floormap')).toBeInTheDocument();
    expect(badge()).toHaveAttribute('aria-expanded', 'true');
    // One rail slot: the feed is gone while the map is open (FR-100).
    expect(screen.queryByTestId('feed-items')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('rail-panel')).toHaveLength(1);

    // The reveal at 90 has elapsed; the one at 175 has not (US2 scenario 2).
    expect(mapLabelText()).toEqual(['The Meat District']);

    seek(180);
    expect(mapLabelText()).toEqual(['The Meat District', 'The Rot Market']);

    // And backwards, with the panel still open (FR-103).
    seek(100);
    expect(mapLabelText()).toEqual(['The Meat District']);
  });

  it('lets a dossier replace the open map — one panel at a time', async () => {
    const { seek } = await mountEpisode();
    seek(100);

    fireEvent.click(badge());
    expect(screen.getByTestId('floormap')).toBeInTheDocument();

    clickFrame('harry');

    expect(screen.getAllByTestId('rail-panel')).toHaveLength(1);
    expect(screen.queryByTestId('floormap')).not.toBeInTheDocument();
    expect(screen.getByTestId('glance-name')).toHaveTextContent('Harry');
    expect(badge()).toHaveAttribute('aria-expanded', 'false');
    expect(frame('harry')).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the map on Escape and on the badge again, returning focus to the badge', async () => {
    const { seek } = await mountEpisode();
    seek(100);

    fireEvent.click(badge());
    pressEscape();
    expect(screen.queryByTestId('rail-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('floormap')).not.toBeInTheDocument();
    expect(screen.getByTestId('feed-items')).toBeInTheDocument();
    expect(document.activeElement).toBe(badge());
    expect(badge()).toHaveAttribute('aria-expanded', 'false');

    // The trigger toggles: the same badge again closes what it opened.
    fireEvent.click(badge());
    expect(screen.getByTestId('floormap')).toBeInTheDocument();
    fireEvent.click(badge());
    expect(screen.queryByTestId('floormap')).not.toBeInTheDocument();
    expect(screen.getByTestId('feed-items')).toBeInTheDocument();
    expect(badge()).toHaveAttribute('aria-expanded', 'false');
  });

  /* ------------------------------------------------- v2 US3: resume (T129) */

  /** Seeds a saved position the way the store writes one (contracts/resume-storage.md). */
  function seedResume(episodeId: number, t: number): void {
    localStorage.setItem(
      resumeKey(episodeId),
      JSON.stringify({ episodeId, t, savedAt: new Date('2026-09-15T12:00:00.000Z').toISOString() }),
    );
  }

  it('offers the saved position over the stage and rejoins the broadcast there', async () => {
    seedResume(1, 120);
    const { source } = await mountEpisode();

    const card = screen.getByTestId('resume-card');
    expect(within(card).getByText(copy.resumeTitle('2:00'))).toBeInTheDocument();
    expect(within(card).getByText(copy.resumeKicker)).toBeInTheDocument();
    // The card lives over the stage, not in the rail (FR-131).
    expect(within(screen.getByTestId('video-stage')).getByTestId('resume-card')).toBe(card);

    fireEvent.click(within(card).getByRole('button', { name: copy.resumeRejoin }));

    expect(source.getTime()).toBe(120);
    expect(screen.getByText(copy.feedHeader('2:00'))).toBeInTheDocument();
    expect(screen.queryByTestId('resume-card')).not.toBeInTheDocument();
  });

  it('discards the saved position when the viewer starts from the beginning', async () => {
    seedResume(1, 120);
    const { source } = await mountEpisode();

    fireEvent.click(screen.getByRole('button', { name: copy.resumeStartOver }));

    expect(screen.queryByTestId('resume-card')).not.toBeInTheDocument();
    expect(localStorage.getItem(resumeKey(1))).toBeNull();
    expect(source.getTime()).toBe(0);
    expect(screen.getByText(copy.feedHeader('0:00'))).toBeInTheDocument();
  });

  it('clears the saved position when the broadcast ends, and never stacks the two cards', async () => {
    seedResume(1, 120);
    const { source } = await mountEpisode();
    expect(screen.getByTestId('resume-card')).toBeInTheDocument();

    act(() => source.end());

    // The ended card owns the stage; the offer has nothing left to restore.
    expect(screen.queryByTestId('resume-card')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.nextEpisodeCard })).toBeInTheDocument();
    expect(localStorage.getItem(resumeKey(1))).toBeNull();
  });

  it('clears the saved position once the playhead reaches the end', async () => {
    seedResume(1, 120);
    const { source, seek } = await mountEpisode();

    seek(100); // the broadcast ran past the offer on its own: it is answered
    expect(screen.queryByTestId('resume-card')).not.toBeInTheDocument();

    act(() => source.end());
    expect(localStorage.getItem(resumeKey(1))).toBeNull();
  });

  it('does not offer a position under 30 seconds', async () => {
    seedResume(1, 10);
    await mountEpisode();

    expect(screen.queryByTestId('resume-card')).not.toBeInTheDocument();
  });

  it('keeps saved positions per episode', async () => {
    seedResume(2, 120);
    await mountEpisode('/ep/1?fake=1');

    expect(screen.queryByTestId('resume-card')).not.toBeInTheDocument();
  });

  it('opens the dev scrubber at ?t= with no offer left standing', async () => {
    seedResume(1, 120);
    const { source } = await mountEpisode('/ep/1?fake=1&t=157');

    // The scrubber starts past the grace window, which answers the offer itself.
    expect(source.getTime()).toBe(157);
    await waitFor(() => expect(screen.getByText(copy.feedHeader('2:37'))).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId('resume-card')).not.toBeInTheDocument());
  });

  it('never surfaces a card or an error when storage is blocked', async () => {
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    try {
      const { seek } = await mountEpisode();
      expect(screen.queryByTestId('resume-card')).not.toBeInTheDocument();

      // …and the page keeps playing as if nothing had happened (FR-133).
      seek(120);
      expect(screen.getByText(copy.feedHeader('2:00'))).toBeInTheDocument();
    } finally {
      blocked.mockRestore();
    }
  });
  /* ------------------------------------- v2 Phase 7: a11y & layout polish (T131/T132) */

  /** Everything a keyboard can land on inside `element`, in document order. */
  function focusables(element: HTMLElement): HTMLElement[] {
    return Array.from(
      element.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'),
    ).filter((node) => !node.hasAttribute('disabled') && node.getAttribute('tabindex') !== '-1');
  }

  it('puts the close control first in every panel\u2019s focus order (T131)', async () => {
    const { seek } = await mountEpisode();
    seek(200);

    clickFrame('harry');
    const dossierPanel = screen.getByTestId('rail-panel');
    expect(focusables(dossierPanel)[0]).toBe(screen.getByTestId('panel-close'));

    fireEvent.click(badge());
    const mapPanel = screen.getByTestId('rail-panel');
    expect(focusables(mapPanel)[0]).toBe(screen.getByTestId('panel-close'));
    // …and the map's own controls come after it, never before. Zoom out is
    // disabled at the fit step, so it is not in the tab order at all.
    expect(focusables(mapPanel).slice(1)).toEqual([
      screen.getByTestId('floormap-zoom-in'),
      screen.getByTestId('floormap-fit'),
      screen.getByTestId('floormap-viewport'),
    ]);
  });

  it('names the region and the map viewport for assistive tech (T131)', async () => {
    const { seek } = await mountEpisode();
    seek(200);

    clickFrame('harry');
    expect(screen.getByTestId('rail-panel')).toHaveAccessibleName(copy.dossierTitle('Harry'));

    fireEvent.click(badge());
    expect(screen.getByTestId('rail-panel')).toHaveAccessibleName(copy.mapTitle(1));
    expect(screen.getByTestId('floormap-viewport')).toHaveAccessibleName(copy.mapViewportLabel);
  });

  it('opens a panel without disturbing the stage column (T132)', async () => {
    const { seek } = await mountEpisode();
    seek(200);

    const stage = screen.getByTestId('video-stage');
    const stageColumn = stage.parentElement as HTMLElement;
    const rail = document.querySelector('aside') as HTMLElement;
    const before = Array.from(stageColumn.children).map((child) => child.tagName);

    expect(rail).toHaveAttribute('data-panel', 'none');
    expect(screen.getByTestId('feed-items')).toBeInTheDocument();

    clickFrame('harry');

    // The rail swaps its contents; the stage column keeps the same nodes in the
    // same order, so nothing above or beside the video can reflow (FR-102).
    // jsdom has no layout, so this is the structural half of the claim — the
    // geometric half is CSS-only and recorded in the quickstart Results.
    expect(rail).toHaveAttribute('data-panel', 'dossier');
    expect(screen.getByTestId('video-stage')).toBe(stage);
    expect(stage.parentElement).toBe(stageColumn);
    expect(Array.from(stageColumn.children).map((child) => child.tagName)).toEqual(before);
    expect(screen.getByTestId('rail-panel').parentElement).toBe(rail);

    fireEvent.click(badge());
    expect(rail).toHaveAttribute('data-panel', 'map');
    expect(screen.getByTestId('video-stage')).toBe(stage);
    expect(Array.from(stageColumn.children).map((child) => child.tagName)).toEqual(before);
  });

  it('lets the resume card own Escape even while a dossier is open', async () => {
    seedResume(1, 120);
    await mountEpisode();
    expect(screen.getByTestId('resume-card')).toBeInTheDocument();

    fireEvent.click(frame('harry'));
    expect(screen.getByTestId('rail-panel')).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByTestId('resume-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('rail-panel')).toBeInTheDocument();
    expect(localStorage.getItem(resumeKey(1))).toBeNull();
  });

  /* ------------------------------ 004 US1: deep links to a moment (T408) */

  /**
   * jsdom serves the page from `http://localhost:3000` and vitest's
   * `BASE_URL` is `/`, so this is the exact link a share produces here.
   */
  const MOMENT_URL = 'http://localhost:3000/ep/1?t=156';

  /** The clipboard is not implemented in jsdom; every test that shares stubs it. */
  function stubClipboard(writeText = vi.fn().mockResolvedValue(undefined)) {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    return writeText;
  }

  /** No clipboard and no share sheet: the fallback path (FR-304). */
  function removeClipboard() {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  }

  it('opens a deep-linked moment with the overlay already at that time', async () => {
    const { source } = await mountEpisode('/ep/1?fake=1&t=156');

    expect(source.getTime()).toBe(156);
    await waitFor(() =>
      expect(screen.getByTestId('stage-caption-time')).toHaveTextContent('2:36'),
    );
    expect(screen.getByText(copy.feedHeader('2:36'))).toBeInTheDocument();
    // The overlay is the state at 2:36, not a replay of it: Harry's 2:32 equip
    // has landed and the feed is not empty.
    expect(feedCount()).toBeGreaterThan(0);
  });

  it('lets the deep link win over a saved position for that visit (FR-301)', async () => {
    seedResume(1, 120);
    const { source } = await mountEpisode('/ep/1?fake=1&t=156');

    expect(source.getTime()).toBe(156);
    await waitFor(() => expect(screen.getByText(copy.feedHeader('2:36'))).toBeInTheDocument());
    expect(screen.queryByTestId('resume-card')).not.toBeInTheDocument();
    // The record is not destroyed by the deep link; it is simply not offered.
    expect(localStorage.getItem(resumeKey(1))).not.toBeNull();
  });

  it('still offers the saved position on a plain visit', async () => {
    seedResume(1, 120);
    await mountEpisode('/ep/1?fake=1');

    expect(screen.getByTestId('resume-card')).toBeInTheDocument();
    expect(screen.getByText(copy.feedHeader('0:00'))).toBeInTheDocument();
  });

  it('ignores an invalid moment entirely (US1 scenario 3)', async () => {
    for (const bad of ['t=abc', 't=-5', 't=99999', 't=']) {
      localStorage.clear();
      __fakeSources.length = 0;
      seedResume(1, 120);
      const { source } = await mountEpisode(`/ep/1?fake=1&${bad}`);

      expect(source.getTime()).toBe(0);
      expect(screen.getByText(copy.feedHeader('0:00'))).toBeInTheDocument();
      // Behaves exactly like a bare visit, so the offer is allowed again.
      expect(screen.getByTestId('resume-card')).toBeInTheDocument();
      cleanup();
    }
  });

  it('applies to one visit of one episode (US1 scenario 5)', async () => {
    await mountEpisode('/ep/1?fake=1&t=156');
    expect(screen.getByText(copy.feedHeader('2:36'))).toBeInTheDocument();

    const header = screen.getByRole('banner');
    fireEvent.click(within(header).getByRole('link', { name: copy.nextEpisode }));

    await waitFor(() => expect(screen.getByText(copy.feedHeader('0:00'))).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByTestId('crawler-frame')).toHaveLength(5));
    expect(screen.getByTestId('stage-caption-time')).toHaveTextContent('0:00');
  });

  /* ---------------------------------- 004 US2: share this moment (T408) */

  it('copies the caption row moment and confirms in the System voice', async () => {
    const writeText = stubClipboard();
    const { source } = await mountEpisode('/ep/1?fake=1&t=156');

    await act(async () => {
      fireEvent.click(screen.getByTestId('share-moment'));
    });

    expect(writeText).toHaveBeenCalledWith(MOMENT_URL);
    const notice = screen.getByTestId('share-notice');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('aria-live', 'polite');
    expect(notice).toHaveTextContent(copy.shareCopied);
    // Sharing never touches playback (FR-306).
    expect(source.getTime()).toBe(156);
  });

  it('names the caption control in the System voice', async () => {
    await mountEpisode();
    expect(screen.getByTestId('share-moment')).toHaveAccessibleName(copy.shareMoment);
    // Nothing is announced until the viewer asks for something.
    expect(screen.getByTestId('share-notice')).toHaveTextContent('');
  });

  it('shares a feed row without seeking to it (FR-303)', async () => {
    const writeText = stubClipboard();
    const { source, seek } = await mountEpisode();
    seek(60);

    const rows = screen.getAllByTestId('feed-item');
    const oldest = rows[3]; // the System's opener at 0:12
    expect(within(oldest).getByTestId('feed-time')).toHaveTextContent(formatTime(12));

    const rowShare = within(oldest).getByTestId('share-row');
    expect(rowShare).toHaveAccessibleName(copy.shareRow(formatTime(12)));

    await act(async () => {
      fireEvent.click(rowShare);
    });

    expect(writeText).toHaveBeenCalledWith('http://localhost:3000/ep/1?t=12');
    // The row's own seek did not fire: the broadcast has not moved.
    expect(source.getTime()).toBe(60);
    expect(screen.getByText(copy.feedHeader('1:00'))).toBeInTheDocument();
  });

  it('shares the pinned sponsor break too', async () => {
    const writeText = stubClipboard();
    const { source, seek } = await mountEpisode();
    seek(115);

    const pinned = screen.getByTestId('active-sponsor');
    // Siblings, not nested: the share button is not inside the seek button.
    expect(pinned.contains(screen.getAllByTestId('share-row')[0])).toBe(false);

    await act(async () => {
      fireEvent.click(within(pinned.parentElement as HTMLElement).getByTestId('share-row'));
    });

    expect(writeText).toHaveBeenCalledWith('http://localhost:3000/ep/1?t=110');
    expect(source.getTime()).toBe(115);
  });

  it('shows the link to copy by hand when nothing can deliver it (FR-304)', async () => {
    removeClipboard();
    await mountEpisode('/ep/1?fake=1&t=156');

    await act(async () => {
      fireEvent.click(screen.getByTestId('share-moment'));
    });

    expect(screen.getByTestId('share-notice')).toHaveTextContent(copy.shareShown);
    const field = screen.getByTestId('share-url') as HTMLInputElement;
    expect(field).toHaveValue(MOMENT_URL);
    expect(field.selectionEnd).toBe(MOMENT_URL.length);

    fireEvent.click(screen.getByTestId('share-dismiss'));
    expect(screen.getByTestId('share-notice')).toHaveTextContent('');
  });

  it('never puts a dev flag in a shared link (FR-305)', async () => {
    const writeText = stubClipboard();
    await mountEpisode('/ep/1?fake=1&t=156&panel=map&record=1');

    await act(async () => {
      fireEvent.click(screen.getByTestId('share-moment'));
    });

    const shared = writeText.mock.calls[0][0] as string;
    expect(shared).toBe(MOMENT_URL);
    for (const flag of ['fake', 'panel', 'record']) expect(shared).not.toContain(flag);
  });
});
