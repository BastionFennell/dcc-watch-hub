// @vitest-environment jsdom
/**
 * User Story 2 (T714): the System Registry at `/registry`. The page is mounted
 * through `<App/>`, because the route, the providers and the header link are
 * part of what is under test.
 *
 * The stub gives episode 2 its own `npc` beats — one sighting of an entity that
 * debuts in episode 1, and the only unlock of the Quartermaster's `debt` — so
 * the cross-episode rules (section by *first* appearance, fact tagged with the
 * episode that released it) have something to prove.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { App } from './../App';
import { copy } from '../copy';
import { makeEpisodeRaw, makeRegistry, makeShow } from '../test/fixtures';

interface RawEpisode {
  episodeId: number;
  initialState: unknown;
  events: { type: string }[];
}

/**
 * Episode 2's own beats (this file's helper, not the shared fixture): a second
 * sighting of the vendor that debuts in episode 1, and the one unlock of
 * `debt` — the only fact in the sample whose tag is not "Ep 1".
 */
function makeEpisode2Raw(): unknown {
  const raw = makeEpisodeRaw(2) as RawEpisode;
  return {
    episodeId: 2,
    initialState: raw.initialState,
    events: [
      ...raw.events.filter((event) => event.type !== 'npc'),
      { t: 100, type: 'npc', id: 'grull-rep', action: 'seen' },
      {
        t: 300,
        type: 'npc',
        id: 'quartermaster',
        action: 'update',
        unlock: ['debt'],
        note: 'The ledger is open.',
      },
    ],
  };
}

interface StubOptions {
  /** Episode ids whose fetch rejects, to exercise the missing-episode notice. */
  failing?: number[];
  /** Swaps the show for one that declares no registry. */
  withoutRegistry?: boolean;
}

function json(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function stubFetch({ failing = [], withoutRegistry = false }: StubOptions = {}) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes('show.json')) {
      const show = makeShow();
      if (withoutRegistry) delete (show as { registryUrl?: string }).registryUrl;
      return json(show);
    }
    if (url.includes('npcs.json')) return json(makeRegistry());

    const episodeId = Number(/ep(\d+)\.json/.exec(url)?.[1] ?? 1);
    if (failing.includes(episodeId)) return Promise.reject(new Error('transmission lost'));
    return json(episodeId === 2 ? makeEpisode2Raw() : makeEpisodeRaw(episodeId));
  });
}

/**
 * The memory router's address bar (revision 2): the scope is URL state, so the
 * tests have to be able to read the URL back.
 */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="loc" data-search={location.search} data-hash={location.hash} />;
}

function renderRegistry(path = '/registry') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

/** Every rendered entry, keyed by entity id. */
function entry(id: string): HTMLElement {
  const element = document.querySelector(`[data-testid="registry-entry"][data-npc="${id}"]`);
  if (element === null) throw new Error(`no registry entry for ${id}`);
  return element as HTMLElement;
}

function visibleIds(): string[] {
  return screen
    .getAllByTestId('registry-entry')
    .map((element) => element.getAttribute('data-npc') ?? '');
}

async function waitForIndex() {
  await waitFor(() => expect(screen.getByTestId('registry-section-1')).toBeInTheDocument());
}

describe('the System Registry', () => {
  beforeEach(() => stubFetch());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('files every entity under the episode it first appears in, with a count', async () => {
    renderRegistry();
    await waitForIndex();

    const section = screen.getByTestId('registry-section-1');
    // The sample titles already carry "Episode N — ", so the bar must not say it
    // twice (007 fix).
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Episode 1 — The World Dungeon',
    );
    expect(copy.registryEpisodeSection(1, makeShow().episodes[0].title)).toBe(
      'Episode 1 — The World Dungeon',
    );
    expect(copy.registryEpisodeSection(4, 'The Meat District')).toBe(
      'Episode 4 — The Meat District',
    );
    // "Episode 10 — …" must not be mistaken for episode 1's own prefix.
    expect(copy.registryEpisodeSection(1, 'Episode 10 — Deeper')).toBe(
      'Episode 1 — Episode 10 — Deeper',
    );
    expect(within(section).getByText(copy.registryCount(3))).toBeInTheDocument();

    // Fixture episode 1: grull-rep @112, hoarder @118, quartermaster @135.
    expect(visibleIds()).toEqual(['grull-rep', 'hoarder', 'quartermaster']);
  });

  it('omits an episode that debuts nobody', async () => {
    renderRegistry();
    await waitForIndex();

    // Episode 2 only re-sights entities episode 1 introduced.
    expect(screen.queryByTestId('registry-section-2')).toBeNull();
    expect(screen.queryByTestId('registry-section-3')).toBeNull();
  });

  it('titles the document in the System voice', async () => {
    renderRegistry();
    await waitFor(() => expect(document.title).toBe(copy.pageTitle(copy.registryTitle)));
  });

  it('searches names and aliases, and says so when nothing matches', async () => {
    renderRegistry();
    await waitForIndex();

    const search = screen.getByTestId('registry-search');
    expect(search).toHaveAttribute('type', 'search');
    expect(search).toHaveAccessibleName(copy.registrySearch);

    // "The Crate King" is an alias of The Hoarder, and of nothing else.
    fireEvent.change(search, { target: { value: 'Crate' } });
    expect(visibleIds()).toEqual(['hoarder']);

    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.queryAllByTestId('registry-entry')).toHaveLength(0);
    expect(screen.getByTestId('registry-empty')).toHaveTextContent(copy.registryNoMatch);

    fireEvent.change(search, { target: { value: '' } });
    expect(visibleIds()).toHaveLength(3);
  });

  it('filters by kind chips, which carry counts and combine as any-of', async () => {
    renderRegistry();
    await waitForIndex();

    const boss = screen.getByTestId('registry-chip-boss');
    const ally = screen.getByTestId('registry-chip-ally');
    expect(boss).toHaveTextContent(copy.kindLabels.boss);
    expect(boss).toHaveTextContent('1');
    expect(boss).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(boss);
    expect(boss).toHaveAttribute('aria-pressed', 'true');
    expect(visibleIds()).toEqual(['hoarder']);

    fireEvent.click(ally);
    expect(visibleIds()).toEqual(['hoarder', 'quartermaster']);

    fireEvent.click(boss);
    fireEvent.click(ally);
    expect(visibleIds()).toHaveLength(3);
  });

  it('expands an entry onto its facts, tagged with the episode that released them', async () => {
    renderRegistry();
    await waitForIndex();

    const hoarder = entry('hoarder');
    expect(hoarder).toHaveAttribute('data-expanded', 'false');
    const trigger = within(hoarder).getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(hoarder).toHaveAttribute('data-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const facts = within(hoarder).getAllByTestId('registry-fact');
    expect(facts.map((fact) => fact.getAttribute('data-fact'))).toEqual(['lair', 'weakness']);
    // Both of the Hoarder's facts are released in episode 1.
    for (const fact of facts) {
      expect(fact).toHaveAttribute('data-episode', '1');
      expect(fact).toHaveTextContent(copy.registryFactTag(1));
    }

    // The Quartermaster's only fact is unlocked in episode 2, though it debuts
    // in episode 1 — the tag follows the release, not the debut.
    const quartermaster = entry('quartermaster');
    fireEvent.click(within(quartermaster).getByRole('button'));
    const debt = within(quartermaster).getByTestId('registry-fact');
    expect(debt).toHaveAttribute('data-episode', '2');
    expect(debt).toHaveTextContent(copy.registryFactTag(2));

    fireEvent.click(trigger);
    expect(hoarder).toHaveAttribute('data-expanded', 'false');
  });

  it('says so when no published episode has released a fact', async () => {
    renderRegistry();
    await waitForIndex();

    const vendor = entry('grull-rep');
    fireEvent.click(within(vendor).getByRole('button'));
    expect(within(vendor).queryAllByTestId('registry-fact')).toHaveLength(0);
    expect(vendor).toHaveTextContent(copy.npcFactsEmpty);
  });

  it('deep-links every appearance to its moment, and marks a defeat', async () => {
    renderRegistry();
    await waitForIndex();

    const hoarder = entry('hoarder');
    fireEvent.click(within(hoarder).getByRole('button'));

    const appearances = within(hoarder).getAllByTestId('registry-appearance');
    expect(appearances[0]).toHaveAttribute('href', '/ep/1?t=118');
    expect(appearances[0]).toHaveTextContent(makeShow().episodes[0].title);
    expect(appearances[0]).toHaveTextContent('1:58');
    expect(appearances[0]).toHaveTextContent(copy.registryActions.met);

    expect(within(hoarder).getByTestId('registry-defeated')).toHaveTextContent(
      copy.registryDefeatedIn(1),
    );

    const vendor = entry('grull-rep');
    fireEvent.click(within(vendor).getByRole('button'));
    expect(within(vendor).queryByTestId('registry-defeated')).toBeNull();
    // Episode 2's own sighting, from this file's helper.
    expect(
      within(vendor)
        .getAllByTestId('registry-appearance')
        .map((link) => link.getAttribute('href')),
    ).toContain('/ep/2?t=100');
  });

  it('opens and marks the entry /registry#<id> names', async () => {
    renderRegistry('/registry#hoarder');
    await waitForIndex();

    await waitFor(() => expect(entry('hoarder')).toHaveAttribute('data-expanded', 'true'));
    expect(entry('hoarder')).toHaveAttribute('data-target');
    expect(entry('hoarder')).toHaveAttribute('id', 'hoarder');
    expect(entry('grull-rep')).toHaveAttribute('data-expanded', 'false');
    expect(entry('grull-rep')).not.toHaveAttribute('data-target');
  });

  it('renders the episodes it could index and names the one it could not', async () => {
    stubFetch({ failing: [3] });
    renderRegistry();
    await waitForIndex();

    const missing = await screen.findByTestId('registry-missing');
    expect(missing).toHaveTextContent(copy.registryMissing(1));
    expect(missing).toHaveAttribute('data-count', '1');
    expect(visibleIds()).toEqual(['grull-rep', 'hoarder', 'quartermaster']);
  });

  it('stands down entirely for a show that publishes no registry', async () => {
    stubFetch({ withoutRegistry: true });
    renderRegistry();

    await waitFor(() =>
      expect(screen.getByText(copy.registryUnavailable)).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('registry-search')).toBeNull();
    expect(screen.queryAllByTestId('registry-entry')).toHaveLength(0);
  });
});

/**
 * Revision 2 (T719): the scope control. The stub's episode 3 reuses episode 1's
 * beats, so every entity debuts in episode 1 — which makes "only episode 2"
 * (where just the vendor and the ally appear) the sharpest case.
 */
describe('scoping the Registry by episode', () => {
  beforeEach(() => stubFetch());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function waitForEntries() {
    await waitFor(() => expect(screen.getAllByTestId('registry-entry').length).toBeGreaterThan(0));
  }

  function scopeSelect(): HTMLSelectElement {
    return screen.getByTestId('registry-scope') as HTMLSelectElement;
  }

  it('offers all episodes, through each, and only each — defaulting to all', async () => {
    renderRegistry();
    await waitForEntries();

    const select = scopeSelect();
    expect(select).toHaveAccessibleName(copy.registryScope);
    expect(select.value).toBe('all');
    // The scope decides what there is to search, so it leads the toolbar.
    expect(select.compareDocumentPosition(screen.getByTestId('registry-search'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    const titles = makeShow().episodes.map((meta) => meta.title);
    expect([...select.options].map((option) => option.value)).toEqual([
      'all',
      'through-1',
      'through-2',
      'through-3',
      'ep-1',
      'ep-2',
      'ep-3',
    ]);
    expect(within(select).getByRole('option', { name: copy.registryScopeAll })).toBeInTheDocument();
    expect(
      within(select).getByRole('option', { name: copy.registryScopeThrough(titles[1]) }),
    ).toHaveValue('through-2');
    expect(
      within(select).getByRole('option', { name: copy.registryScopeOnly(titles[1]) }),
    ).toHaveValue('ep-2');
    expect(select.querySelectorAll('optgroup')).toHaveLength(2);
    expect([...select.querySelectorAll('optgroup')].map((group) => group.label)).toEqual([
      copy.registryScopeGroupThrough,
      copy.registryScopeGroupOnly,
    ]);
  });

  it('through an episode drops the facts and appearances released later', async () => {
    renderRegistry('/registry?scope=through-1');
    await waitForEntries();

    expect(scopeSelect().value).toBe('through-1');
    // All three debut in episode 1, so the cast is unchanged...
    expect(visibleIds()).toEqual(['grull-rep', 'hoarder', 'quartermaster']);

    // ...but the Quartermaster's only fact is released in episode 2.
    const quartermaster = entry('quartermaster');
    fireEvent.click(within(quartermaster).getByRole('button'));
    expect(within(quartermaster).queryAllByTestId('registry-fact')).toHaveLength(0);
    expect(quartermaster).toHaveTextContent(copy.npcFactsEmpty);

    // And nothing links out of episode 1.
    const vendor = entry('grull-rep');
    fireEvent.click(within(vendor).getByRole('button'));
    const hrefs = within(vendor)
      .getAllByTestId('registry-appearance')
      .map((link) => link.getAttribute('href'));
    expect(hrefs.every((href) => href?.startsWith('/ep/1'))).toBe(true);

    // Only episode 1 has a section.
    expect(screen.queryByTestId('registry-section-2')).toBeNull();
    expect(screen.queryByTestId('registry-section-3')).toBeNull();
  });

  it('through a later episode lets that episode back in', async () => {
    renderRegistry('/registry?scope=through-2');
    await waitForEntries();

    const quartermaster = entry('quartermaster');
    fireEvent.click(within(quartermaster).getByRole('button'));
    expect(within(quartermaster).getByTestId('registry-fact')).toHaveAttribute(
      'data-episode',
      '2',
    );

    const vendor = entry('grull-rep');
    fireEvent.click(within(vendor).getByRole('button'));
    expect(
      within(vendor)
        .getAllByTestId('registry-appearance')
        .map((link) => link.getAttribute('href')),
    ).toContain('/ep/2?t=100');
  });

  it('only an episode keeps its own cast, filed under that episode', async () => {
    renderRegistry('/registry?scope=ep-2');
    await waitForEntries();

    expect(scopeSelect().value).toBe('ep-2');
    // Episode 2 sights the vendor and amends the ally; the boss is not in it.
    expect(visibleIds()).toEqual(['grull-rep', 'quartermaster']);

    const section = screen.getByTestId('registry-section-2');
    expect(screen.queryByTestId('registry-section-1')).toBeNull();
    expect(within(section).getByText(copy.registryCount(2))).toBeInTheDocument();
    // Counts follow the scope, and a kind with nobody left loses its chip.
    expect(screen.getByTestId('registry-chip-vendor')).toHaveTextContent('1');
    expect(screen.queryByTestId('registry-chip-boss')).toBeNull();

    const vendor = entry('grull-rep');
    fireEvent.click(within(vendor).getByRole('button'));
    expect(
      within(vendor)
        .getAllByTestId('registry-appearance')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/ep/2?t=100']);
  });

  it('writes the scope into the URL, and takes it back out for all episodes', async () => {
    renderRegistry();
    await waitForEntries();

    fireEvent.change(scopeSelect(), { target: { value: 'ep-2' } });
    await waitFor(() => expect(visibleIds()).toEqual(['grull-rep', 'quartermaster']));
    expect(screen.getByTestId('loc')).toHaveAttribute('data-search', '?scope=ep-2');

    fireEvent.change(scopeSelect(), { target: { value: 'all' } });
    await waitFor(() => expect(visibleIds()).toHaveLength(3));
    expect(screen.getByTestId('loc')).toHaveAttribute('data-search', '');
  });

  it('keeps the other search params and the hash when the scope changes', async () => {
    renderRegistry('/registry?q=keep#hoarder');
    await waitForEntries();

    fireEvent.change(scopeSelect(), { target: { value: 'through-2' } });
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveAttribute('data-search', '?q=keep&scope=through-2'),
    );
    expect(screen.getByTestId('loc')).toHaveAttribute('data-hash', '#hoarder');
  });

  it('opens the whole archive for a scope it cannot read', async () => {
    renderRegistry('/registry?scope=banana');
    await waitForEntries();

    expect(scopeSelect().value).toBe('all');
    expect(visibleIds()).toEqual(['grull-rep', 'hoarder', 'quartermaster']);
  });

  it('says the Registry has no such entity when a scope and a search agree', async () => {
    // "Crate" is the Hoarder's alias, and the Hoarder is not in episode 2.
    renderRegistry('/registry?scope=ep-2');
    await waitForEntries();

    fireEvent.change(screen.getByTestId('registry-search'), { target: { value: 'Crate' } });
    expect(screen.queryAllByTestId('registry-entry')).toHaveLength(0);
    expect(screen.getByTestId('registry-empty')).toHaveTextContent(copy.registryNoMatch);
    // The scope survives the empty view, so the viewer can widen it again.
    expect(scopeSelect().value).toBe('ep-2');
  });

  it('still opens the entry the hash names inside a scope', async () => {
    renderRegistry('/registry?scope=ep-2#grull-rep');
    await waitForEntries();

    await waitFor(() => expect(entry('grull-rep')).toHaveAttribute('data-expanded', 'true'));
    expect(entry('grull-rep')).toHaveAttribute('data-target');
  });
});
