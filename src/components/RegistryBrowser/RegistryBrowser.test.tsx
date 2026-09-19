// @vitest-environment jsdom
/**
 * T723 — the Registry in the rail (R3 scenarios 1–3, R3-FR-641/642).
 *
 * Mounted under the real providers, because what the panel shows comes from the
 * shared index (R3-FR-644); only the video is absent, and its two controls
 * (`onSeek`, `onShare`) are spies — nothing in here may move the broadcast
 * unless the viewer activates a moment.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { ShowProvider } from '../../data/ShowContext';
import { RegistryProvider } from '../../data/RegistryContext';
import { RegistryIndexProvider } from '../../data/RegistryIndexContext';
import { RegistryBrowser } from './RegistryBrowser';
import { copy } from '../../copy';
import { makeEpisode, makeEpisodeRaw, makeRegistry, makeShow } from '../../test/fixtures';

/*
 * The fixture's episode 1 npc beats, which every playhead case below quotes:
 * 112 grull-rep met, 118 the hoarder met, 122 its lair unlocked, 135 the
 * quartermaster seen, 140 an id the registry does not carry, 185 the weakness
 * unlocked, 195 the hoarder defeated.
 */
const EP1 = makeEpisode(1);
/** Past every beat: the panel then shows the whole episode, as R3 did. */
const WHOLE = 10_000;

interface RawEpisode {
  episodeId: number;
  initialState: unknown;
  events: { type: string }[];
}

/**
 * Episode 2's own beats: one amendment to the entity episode 1 kills, so the
 * panel has an appearance that belongs to *another* episode to link to.
 */
function makeEpisode2Raw(): unknown {
  const raw = makeEpisodeRaw(2) as RawEpisode;
  return {
    episodeId: 2,
    initialState: raw.initialState,
    events: [
      ...raw.events.filter((event) => event.type !== 'npc'),
      { t: 90, type: 'npc', id: 'hoarder', action: 'update', unlock: ['weakness'] },
    ],
  };
}

function json(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function stubFetch() {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('show.json')) return json(makeShow());
    if (url.includes('npcs.json')) return json(makeRegistry());
    const episodeId = Number(/ep(\d+)\.json/.exec(url)?.[1] ?? 1);
    return json(episodeId === 2 ? makeEpisode2Raw() : makeEpisodeRaw(episodeId));
  });
}

/** The router's address bar: opening the panel must never navigate. */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="loc" data-path={`${location.pathname}${location.search}`} />;
}

async function mountBrowser(focusId?: string, t = WHOLE) {
  const onSeek = vi.fn();
  const onShare = vi.fn();
  const tree = (at: number) => (
    <MemoryRouter initialEntries={['/ep/1']}>
      <ShowProvider>
        <RegistryProvider>
          <RegistryIndexProvider>
            <RegistryBrowser
              currentEpisodeId={1}
              currentEpisode={EP1}
              t={at}
              focusId={focusId}
              onSeek={onSeek}
              onShare={onShare}
            />
          </RegistryIndexProvider>
        </RegistryProvider>
      </ShowProvider>
      <LocationProbe />
    </MemoryRouter>
  );
  const { rerender } = render(tree(t));
  await waitFor(() => expect(screen.getByTestId('registry-section-1')).toBeInTheDocument());
  // Moving the playhead is the only thing the page does to this panel.
  const seekTo = (at: number) => rerender(tree(at));
  return { onSeek, onShare, seekTo };
}

function entry(id: string): HTMLElement {
  const element = document.querySelector(`[data-testid="registry-entry"][data-npc="${id}"]`);
  if (element === null) throw new Error(`no registry entry for ${id}`);
  return element as HTMLElement;
}

function expand(id: string): void {
  fireEvent.click(within(entry(id)).getByRole('button', { expanded: false }));
}

function appearances(id: string): HTMLElement[] {
  return within(entry(id)).getAllByTestId('registry-appearance');
}

describe('RegistryBrowser', () => {
  beforeEach(() => stubFetch());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('says the System is indexing until the archive lands', async () => {
    render(
      <MemoryRouter>
        <ShowProvider>
          <RegistryProvider>
            <RegistryIndexProvider>
              <RegistryBrowser
                currentEpisodeId={1}
                currentEpisode={EP1}
                t={WHOLE}
                onSeek={vi.fn()}
                onShare={vi.fn()}
              />
            </RegistryIndexProvider>
          </RegistryProvider>
        </ShowProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('registry-browser-loading')).toHaveTextContent(copy.registryLoading);
    await waitFor(() =>
      expect(screen.queryByTestId('registry-browser-loading')).not.toBeInTheDocument(),
    );
  });

  it('opens scoped to the episode being watched', async () => {
    await mountBrowser();

    const scope = screen.getByTestId('registry-scope');
    expect(scope).toHaveValue('through-1');
    // Episode 1's cast, filed under episode 1 (R3 scenario 1), latest debut
    // first: the quartermaster @135, the hoarder @118, grull-rep @112 (R4-FR-650).
    expect(
      screen.getAllByTestId('registry-entry').map((el) => el.getAttribute('data-npc')),
    ).toEqual(['quartermaster', 'hoarder', 'grull-rep']);
    expect(screen.queryByTestId('registry-section-2')).toBeNull();
  });

  it('keeps a scope change inside the panel — it never navigates', async () => {
    await mountBrowser();

    fireEvent.change(screen.getByTestId('registry-scope'), { target: { value: 'all' } });

    expect(screen.getByTestId('registry-scope')).toHaveValue('all');
    // The whole archive now, and the page behind the panel has not moved.
    expect(screen.getByTestId('loc')).toHaveAttribute('data-path', '/ep/1');
    expect(screen.getByTestId('registry-browser-full')).toHaveAttribute('href', '/codex');
  });

  it('narrows by search and by kind, as the page does', async () => {
    await mountBrowser();

    fireEvent.change(screen.getByTestId('registry-search'), { target: { value: 'crate king' } });
    // "The Crate King" is one of the Hoarder's aliases (US2 scenario 2).
    expect(
      screen.getAllByTestId('registry-entry').map((el) => el.getAttribute('data-npc')),
    ).toEqual(['hoarder']);

    fireEvent.change(screen.getByTestId('registry-search'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('registry-chip-ally'));
    expect(
      screen.getAllByTestId('registry-entry').map((el) => el.getAttribute('data-npc')),
    ).toEqual(['quartermaster']);

    fireEvent.change(screen.getByTestId('registry-search'), { target: { value: 'nobody' } });
    expect(screen.getByTestId('registry-empty')).toHaveTextContent(copy.registryNoMatch);
  });

  it('seeks the broadcast from an appearance in this episode, and shares it', async () => {
    const { onSeek, onShare } = await mountBrowser();

    expand('hoarder');
    // 118 met, 122 update, 185 update, 195 defeated — all in episode 1.
    const rows = appearances('hoarder');
    expect(rows).toHaveLength(4);
    rows.forEach((row) => {
      expect(row.tagName).toBe('BUTTON');
      expect(row).toHaveAttribute('data-current', 'true');
    });

    fireEvent.click(rows[0]);
    expect(onSeek).toHaveBeenCalledWith(118);

    fireEvent.click(within(entry('hoarder')).getAllByTestId('share-row')[0]);
    expect(onShare).toHaveBeenCalledWith(118);
    // Sharing never moves the broadcast (004 FR-306).
    expect(onSeek).toHaveBeenCalledTimes(1);
  });

  it('leaves an appearance in another episode a link', async () => {
    const { onSeek } = await mountBrowser();

    // Episode 2's amendment is outside "through episode 1"; widen the scope.
    fireEvent.change(screen.getByTestId('registry-scope'), { target: { value: 'all' } });
    expand('hoarder');

    const elsewhere = appearances('hoarder').filter(
      (row) => row.getAttribute('data-episode') === '2',
    );
    expect(elsewhere).toHaveLength(1);
    expect(elsewhere[0].tagName).toBe('A');
    expect(elsewhere[0]).toHaveAttribute('href', '/ep/2?t=90');
    expect(elsewhere[0]).not.toHaveAttribute('data-current');
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('opens on the entity the record named, expanded', async () => {
    await mountBrowser('hoarder');

    expect(entry('hoarder')).toHaveAttribute('data-expanded', 'true');
    expect(entry('grull-rep')).toHaveAttribute('data-expanded', 'false');
    // The footer carries the same entity out to the page, at the panel's scope.
    expect(screen.getByTestId('registry-browser-full')).toHaveAttribute(
      'href',
      '/codex?scope=through-1#hoarder',
    );
    expect(screen.getByTestId('registry-browser-full')).toHaveTextContent(copy.registryOpenFull);
  });

  /* --- Revision 4: the panel follows the playhead (R4-FR-651, R4-SC-609) --- */

  /** Whoever the panel lists, in the order it lists them. */
  const listed = () =>
    screen.queryAllByTestId('registry-entry').map((el) => el.getAttribute('data-npc'));
  const facts = (id: string) =>
    within(entry(id))
      .queryAllByTestId('registry-fact')
      .map((el) => el.getAttribute('data-fact'));

  it('lists only what the playhead has reached, and keeps up as it moves', async () => {
    const { seekTo } = await mountBrowser(undefined, 112);

    // 1:52 — grull-rep and nobody else.
    expect(listed()).toEqual(['grull-rep']);

    // 1:57 — still nothing new; the hoarder is five seconds away (R4 scenario 2).
    seekTo(117);
    expect(listed()).toEqual(['grull-rep']);

    // 1:58 — met, with one appearance and no facts yet.
    seekTo(118);
    expect(listed()).toEqual(['hoarder', 'grull-rep']);
    expand('hoarder');
    expect(appearances('hoarder')).toHaveLength(1);
    expect(facts('hoarder')).toEqual([]);
    expect(within(entry('hoarder')).queryByTestId('registry-defeated')).toBeNull();

    // 2:02 — the lair is released.
    seekTo(122);
    expect(facts('hoarder')).toEqual(['lair']);

    // 2:15 — the quartermaster is sighted and leads the shelf; the unknown id
    // at 2:20 never appears, registry or no registry.
    seekTo(140);
    expect(listed()).toEqual(['quartermaster', 'hoarder', 'grull-rep']);

    // 3:05 — the weakness; 3:15 — defeated.
    seekTo(185);
    expect(facts('hoarder')).toEqual(['lair', 'weakness']);
    expect(within(entry('hoarder')).queryByTestId('registry-defeated')).toBeNull();
    seekTo(195);
    expect(within(entry('hoarder')).getByTestId('registry-defeated')).toHaveTextContent(
      copy.registryDefeatedIn(1),
    );
    expect(appearances('hoarder')).toHaveLength(4);
  });

  it('gives back what a scrub backwards un-watches', async () => {
    const { seekTo } = await mountBrowser(undefined, 200);

    expand('hoarder');
    expect(facts('hoarder')).toEqual(['lair', 'weakness']);

    // 2:30, after 3:20: the weakness and the defeat are un-told (R4 scenario 2).
    seekTo(150);
    expect(facts('hoarder')).toEqual(['lair']);
    expect(within(entry('hoarder')).queryByTestId('registry-defeated')).toBeNull();
    expect(appearances('hoarder')).toHaveLength(2);

    // All the way back before the first beat: the shelf itself goes.
    seekTo(0);
    expect(listed()).toEqual([]);
    expect(screen.getByTestId('registry-empty')).toHaveTextContent(copy.encounterEmpty);
  });
});
