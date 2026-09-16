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
import { makeEpisodeRaw, makeRegistry, makeShow } from '../../test/fixtures';

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

async function mountBrowser(focusId?: string) {
  const onSeek = vi.fn();
  const onShare = vi.fn();
  render(
    <MemoryRouter initialEntries={['/ep/1']}>
      <ShowProvider>
        <RegistryProvider>
          <RegistryIndexProvider>
            <RegistryBrowser
              currentEpisodeId={1}
              focusId={focusId}
              onSeek={onSeek}
              onShare={onShare}
            />
          </RegistryIndexProvider>
        </RegistryProvider>
      </ShowProvider>
      <LocationProbe />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByTestId('registry-section-1')).toBeInTheDocument());
  return { onSeek, onShare };
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
              <RegistryBrowser currentEpisodeId={1} onSeek={vi.fn()} onShare={vi.fn()} />
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
    // Episode 1's cast, filed under episode 1 (R3 scenario 1).
    expect(
      screen.getAllByTestId('registry-entry').map((el) => el.getAttribute('data-npc')),
    ).toEqual(['grull-rep', 'hoarder', 'quartermaster']);
    expect(screen.queryByTestId('registry-section-2')).toBeNull();
  });

  it('keeps a scope change inside the panel — it never navigates', async () => {
    await mountBrowser();

    fireEvent.change(screen.getByTestId('registry-scope'), { target: { value: 'all' } });

    expect(screen.getByTestId('registry-scope')).toHaveValue('all');
    // The whole archive now, and the page behind the panel has not moved.
    expect(screen.getByTestId('loc')).toHaveAttribute('data-path', '/ep/1');
    expect(screen.getByTestId('registry-browser-full')).toHaveAttribute('href', '/registry');
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
      '/registry?scope=through-1#hoarder',
    );
    expect(screen.getByTestId('registry-browser-full')).toHaveTextContent(copy.registryOpenFull);
  });
});
