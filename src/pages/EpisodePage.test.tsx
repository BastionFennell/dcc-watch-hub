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

/** One section of the open dossier, so "Door" in HISTORY never fools HOTLIST. */
function section(name: string): HTMLElement {
  return screen.getByTestId(`dossier-${name}`);
}

function pressEscape(): void {
  fireEvent.keyDown(document, { key: 'Escape' });
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

  /* ------------------------------------------ v2 US1: the crawler dossier (T119) */

  it('opens a crawler dossier in the rail and hides the feed', async () => {
    const { seek } = await mountEpisode();
    seek(200);

    clickFrame('harry');

    const panel = screen.getByRole('region', { name: copy.dossierTitle('Harry') });
    expect(panel).toHaveAttribute('id', 'rail-panel');
    expect(within(panel).getByTestId('dossier-name')).toHaveTextContent('Harry');
    expect(within(panel).getByText(copy.dossierKicker)).toBeInTheDocument();
    // The rail hosts exactly one thing: the feed is gone while a panel is open (FR-100).
    expect(screen.queryByTestId('feed-items')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('rail-panel')).toHaveLength(1);

    // Sheet identity, straight from the episode's initial state (FR-113).
    const identity = within(section('identity'));
    expect(identity.getByText('Human')).toBeInTheDocument();
    expect(identity.getByText('he/him')).toBeInTheDocument();
    expect(identity.getByText('10,491,201')).toBeInTheDocument();
    expect(identity.getByText('Compensated Anarchist')).toBeInTheDocument(); // class at 95

    // Vitals: the ten-segment strip and the HP readout.
    expect(within(section('vitals')).getAllByTestId('hp-segment')).toHaveLength(10);
    expect(screen.getByTestId('dossier-hp')).toHaveTextContent(copy.hpValue(20, 22));

    // Stats only exist because this fixture crawler carries them.
    expect(within(section('stats')).getByText(copy.statLabels.dex)).toBeInTheDocument();
    expect(within(section('stats')).getByText('7')).toBeInTheDocument();
  });

  it('shows the hotlist as of the playhead, not as of the newest event', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('harry');

    // 105 adds Door, 165 swaps it for Crowbar.
    expect(within(section('hotlist')).getByText('Crowbar')).toBeInTheDocument();
    expect(within(section('hotlist')).queryByText('Door')).not.toBeInTheDocument();

    seek(110);
    expect(within(section('hotlist')).getByText('Door')).toBeInTheDocument();
    expect(within(section('hotlist')).queryByText('Crowbar')).not.toBeInTheDocument();

    seek(20);
    expect(within(section('hotlist')).getByText(copy.dossierEmpty.hotlist)).toBeInTheDocument();
  });

  it('upserts a skill rank while the dossier stays open', async () => {
    const { seek } = await mountEpisode();
    seek(160);
    clickFrame('xo');

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

    const rows = within(section('history')).getAllByTestId('dossier-history-item');
    expect(rows.length).toBeGreaterThan(0);
    // Newest first: Harry's rank at 200.
    expect(within(rows[0]).getByText(copy.feedText.rankCrawler('Harry', 3550))).toBeInTheDocument();
    // The party rank at 80 belongs to nobody's dossier.
    expect(
      within(section('history')).queryByText(copy.feedText.rankParty(61)),
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
    expect(screen.getByTestId('dossier-name')).toHaveTextContent('X.O.');
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

  /* ------------------------------------------- v2 US4: rank sparklines (T121) */

  it('plots every elapsed rank event and summarizes it for assistive tech', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('harry');

    const sparkline = screen.getByTestId('rank-sparkline');
    expect(sparkline).toHaveAttribute(
      'aria-label',
      copy.sparklineSummary(4188, 3550, 3, 3012),
    );
    expect(sparkline.getAttribute('aria-label')).toContain('3 updates');
    expect(sparkline.getAttribute('aria-label')).toContain('#3012');
    expect(sparkline.querySelectorAll('polyline')).toHaveLength(1);
    expect(screen.getByTestId('rank-current')).toHaveTextContent(copy.rankValue(3550));
    expect(screen.getByTestId('rank-best')).toHaveTextContent(copy.rankValue(3012));

    // Before the second rank event: one point, current and best both #4188.
    seek(120);
    const single = screen.getByTestId('rank-sparkline');
    expect(single.querySelectorAll('polyline')).toHaveLength(0);
    expect(single.querySelectorAll('circle')).toHaveLength(2); // best ring + current dot
    expect(single).toHaveAttribute('aria-label', copy.sparklineSummary(4188, 4188, 1, 4188));
    expect(screen.getByTestId('rank-current')).toHaveTextContent(copy.rankValue(4188));
    expect(screen.getByTestId('rank-best')).toHaveTextContent(copy.rankValue(4188));
  });

  it('reads "Unranked" and draws no chart without rank events', async () => {
    const { seek } = await mountEpisode();
    seek(200);
    clickFrame('xo');

    expect(within(screen.getByTestId('dossier-rank')).getByText(copy.unranked)).toBeInTheDocument();
    expect(screen.queryByTestId('rank-sparkline')).not.toBeInTheDocument();
  });

  it('shows the party rank in the feed header only once it has elapsed', async () => {
    const { seek } = await mountEpisode();

    seek(79);
    expect(screen.queryByTestId('party-rank')).not.toBeInTheDocument();

    seek(80);
    expect(screen.getByTestId('party-rank')).toHaveTextContent(copy.partyRankLine(61));
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
    expect(screen.getByTestId('dossier-name')).toHaveTextContent('Harry');
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
});
