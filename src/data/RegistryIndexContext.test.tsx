// @vitest-environment jsdom
/**
 * T722 - the lazily loaded, once-per-visit registry index (R3-FR-644).
 *
 * What is under test is the *loading policy*, not the index itself (that is
 * `registry.test.ts`): nothing is fetched until someone asks, the fetches
 * happen exactly once however many consumers ask, and an episode file that
 * will not load costs its own beats and nothing else.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { ShowProvider } from './ShowContext';
import { RegistryProvider } from './RegistryContext';
import { RegistryIndexProvider, useRegistryIndex } from './RegistryIndexContext';
import { makeEpisodeRaw, makeRegistry, makeShow, makeSpells } from '../test/fixtures';

/** Every URL the tree asked for, in order. */
let requested: string[] = [];

function json(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function stubFetch({ failing = [] as number[] } = {}) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    if (url.includes('show.json')) return json(makeShow());
    if (url.includes('npcs.json')) return json(makeRegistry());
    if (url.includes('spells.json')) return json(makeSpells());
    const episodeId = Number(/ep(\d+)\.json/.exec(url)?.[1] ?? 1);
    if (failing.includes(episodeId)) return Promise.reject(new Error('transmission lost'));
    return json(makeEpisodeRaw(episodeId));
  });
}

/** How many times the visit asked for any episode file. */
function episodeFetches(): number {
  return requested.filter((url) => /ep\d+\.json/.test(url)).length;
}

/**
 * A consumer that reports the index as data attributes. `loads` is how many
 * times it calls `load()` on mount - twice proves the call is idempotent.
 */
function Probe({ ask = true, loads = 1 }: { ask?: boolean; loads?: number }) {
  const { index, episodes, loading, error, load } = useRegistryIndex();
  useEffect(() => {
    if (!ask) return;
    for (let i = 0; i < loads; i += 1) load();
  }, [ask, loads, load]);
  return (
    <span
      data-testid="probe"
      data-loading={loading ? 'true' : 'false'}
      data-error={error === null ? 'none' : error.message}
      data-entries={index === null ? '' : index.entries.map((e) => e.entity.id).join(',')}
      data-missing={index === null ? '' : index.missingEpisodes.join(',')}
      data-ready={index === null ? 'false' : 'true'}
      data-episodes={
        episodes === null
          ? ''
          : [...episodes.entries()]
              .map(([id, data]) => `${id}:${data === null ? 'null' : data.events.length}`)
              .join(',')
      }
    />
  );
}

function renderProbes(children: ReactNode) {
  return render(
    <ShowProvider>
      <RegistryProvider>
        <RegistryIndexProvider>{children}</RegistryIndexProvider>
      </RegistryProvider>
    </ShowProvider>,
  );
}

const probe = () => screen.getByTestId('probe');

describe('RegistryIndexProvider', () => {
  beforeEach(() => {
    requested = [];
    stubFetch();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('fetches nothing until a consumer asks for the index', async () => {
    renderProbes(<Probe ask={false} />);

    // The show and the registry still load - they are not this provider's doing.
    await waitFor(() => expect(requested.some((url) => url.includes('npcs.json'))).toBe(true));
    expect(episodeFetches()).toBe(0);
    expect(probe()).toHaveAttribute('data-loading', 'false');
    expect(probe()).toHaveAttribute('data-ready', 'false');
  });

  it('loads every episode once and caches the index for the visit', async () => {
    const { rerender } = renderProbes(<Probe loads={2} />);

    await waitFor(() => expect(probe()).toHaveAttribute('data-ready', 'true'));
    // Three published episodes, one fetch each, however often `load()` is called.
    expect(episodeFetches()).toBe(3);
    expect(probe()).toHaveAttribute('data-entries', 'grull-rep,hoarder,quartermaster');
    expect(probe()).toHaveAttribute('data-missing', '');
    expect(probe()).toHaveAttribute('data-loading', 'false');
    expect(probe()).toHaveAttribute('data-error', 'none');

    // A second consumer - the panel after the page, say - re-reads the cache.
    rerender(
      <ShowProvider>
        <RegistryProvider>
          <RegistryIndexProvider>
            <Probe />
          </RegistryIndexProvider>
        </RegistryProvider>
      </ShowProvider>,
    );
    await waitFor(() => expect(probe()).toHaveAttribute('data-ready', 'true'));
    expect(episodeFetches()).toBe(3);
  });

  /*
   * Revision 4: the panel re-indexes from the same inputs with the episode on
   * the stage clipped to the playhead, so the raw map has to come out of the
   * context alongside the index it was built from (R4-FR-651).
   */
  it('exposes the episodes the index was built from, failures included', async () => {
    vi.unstubAllGlobals();
    requested = [];
    stubFetch({ failing: [2] });

    renderProbes(<Probe />);

    await waitFor(() => expect(probe()).toHaveAttribute('data-ready', 'true'));
    const events = makeEpisodeRaw(1) as { events: unknown[] };
    expect(probe()).toHaveAttribute(
      'data-episodes',
      `1:${events.events.length},2:null,3:${events.events.length}`,
    );
  });

  it('carries no episodes until a consumer asks', async () => {
    renderProbes(<Probe ask={false} />);

    await waitFor(() => expect(requested.some((url) => url.includes('npcs.json'))).toBe(true));
    expect(probe()).toHaveAttribute('data-episodes', '');
  });

  it('reports a loading pass between the request and the index', async () => {
    renderProbes(<Probe />);

    await waitFor(() => expect(probe()).toHaveAttribute('data-loading', 'true'));
    await waitFor(() => expect(probe()).toHaveAttribute('data-ready', 'true'));
  });

  it('files an episode that will not load under missingEpisodes, and indexes the rest', async () => {
    vi.unstubAllGlobals();
    requested = [];
    stubFetch({ failing: [2] });

    renderProbes(<Probe />);

    await waitFor(() => expect(probe()).toHaveAttribute('data-ready', 'true'));
    expect(probe()).toHaveAttribute('data-missing', '2');
    // Episode 1's cast is still filed - one bad file is not a failed index.
    expect(probe()).toHaveAttribute('data-entries', 'grull-rep,hoarder,quartermaster');
    expect(probe()).toHaveAttribute('data-error', 'none');
  });
});
