/**
 * The cross-episode index (T712, research R5/R7). These are pure-data tests: no
 * DOM, no fetch — the page's job is to hand `registryIndex` a map, and this is
 * every rule about what comes back.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EpisodeData, Registry, Show } from '../data/types';
import { normalizeEpisode, normalizeRegistry, normalizeShow } from '../data/validate';
import { orderedEpisodeIds } from '../data/show';
import { makeEpisode, makeRegistry, makeShow } from '../test/fixtures';
import type { RegistryEntry } from './registry';
import {
  clipEpisodeToPlayhead,
  matchesRegistryQuery,
  parseRegistryScope,
  registryIndex,
  registryIndexAt,
  registrySections,
  scopeParam,
  scopeRegistry,
} from './registry';

/** An episode carrying nothing but the `npc` beats a case needs. */
function episodeWith(episodeId: number, events: unknown[]): EpisodeData {
  return normalizeEpisode({
    episodeId,
    initialState: {
      party: [
        {
          id: 'harry',
          name: 'Harry',
          handle: 'Harry',
          player: 'Marcus',
          level: 1,
          hp: { current: 10, max: 10 },
          portrait: '/img/crawlers/harry.svg',
          class: null,
          inventory: [],
          rank: null,
        },
      ],
      map: { floor: 1, grid: { cols: 4, rows: 4 }, revealed: [] },
    },
    events,
  });
}

function map(entries: [number, EpisodeData | null][]): ReadonlyMap<number, EpisodeData | null> {
  return new Map(entries);
}

const show: Show = makeShow();
const registry: Registry = makeRegistry();

describe('registryIndex', () => {
  it('orders entries by first appearance, then timecode, then id', () => {
    const { entries } = registryIndex(show, registry, map([[1, makeEpisode(1)]]));

    // Fixture ep1: grull-rep @112, hoarder @118, quartermaster @135.
    expect(entries.map((entry) => entry.entity.id)).toEqual([
      'grull-rep',
      'hoarder',
      'quartermaster',
    ]);
    expect(entries.map((entry) => [entry.firstEpisode, entry.firstT])).toEqual([
      [1, 112],
      [1, 118],
      [1, 135],
    ]);
  });

  it('files an entity in the episode it first appears in, across episodes', () => {
    const ep1 = episodeWith(1, [{ t: 50, type: 'npc', id: 'hoarder', action: 'met' }]);
    const ep2 = episodeWith(2, [
      { t: 10, type: 'npc', id: 'hoarder', action: 'seen' },
      { t: 20, type: 'npc', id: 'quartermaster', action: 'met' },
    ]);

    const { entries } = registryIndex(
      show,
      registry,
      map([
        [1, ep1],
        [2, ep2],
      ]),
    );

    expect(entries.map((entry) => [entry.entity.id, entry.firstEpisode])).toEqual([
      ['hoarder', 1],
      ['quartermaster', 2],
    ]);
  });

  it('tags each fact with the first episode that unlocks it', () => {
    const ep1 = episodeWith(1, [
      { t: 10, type: 'npc', id: 'hoarder', action: 'met' },
      { t: 20, type: 'npc', id: 'hoarder', action: 'update', unlock: ['lair'] },
    ]);
    const ep2 = episodeWith(2, [
      // Re-unlocking `lair` must not move its tag to episode 2.
      { t: 10, type: 'npc', id: 'hoarder', action: 'update', unlock: ['lair', 'weakness'] },
    ]);

    const { entries } = registryIndex(
      show,
      registry,
      map([
        [1, ep1],
        [2, ep2],
      ]),
    );

    expect(entries[0]?.facts).toEqual([
      { id: 'lair', text: 'It nests behind the crate wall it builds.', episodeId: 1 },
      { id: 'weakness', text: 'It cannot see red.', episodeId: 2 },
    ]);
  });

  it('omits facts no published episode unlocks, and unlocks the entity does not carry', () => {
    const ep1 = episodeWith(1, [
      { t: 10, type: 'npc', id: 'hoarder', action: 'met', unlock: ['no-such-fact'] },
    ]);

    const { entries } = registryIndex(show, registry, map([[1, ep1]]));
    expect(entries[0]?.facts).toEqual([]);
  });

  it('keeps every beat as an appearance, in broadcast order then timecode', () => {
    const ep1 = episodeWith(1, [
      { t: 30, type: 'npc', id: 'hoarder', action: 'update', note: 'It builds.' },
      { t: 10, type: 'npc', id: 'hoarder', action: 'met' },
    ]);
    const ep2 = episodeWith(2, [{ t: 5, type: 'npc', id: 'hoarder', action: 'seen' }]);

    const { entries } = registryIndex(
      show,
      registry,
      map([
        [1, ep1],
        [2, ep2],
      ]),
    );

    expect(entries[0]?.appearances).toEqual([
      { episodeId: 1, t: 10, action: 'met' },
      { episodeId: 1, t: 30, action: 'update', note: 'It builds.' },
      { episodeId: 2, t: 5, action: 'seen' },
    ]);
  });

  it('reports the first episode a defeat lands in, and leaves survivors undefined', () => {
    const ep1 = episodeWith(1, [{ t: 10, type: 'npc', id: 'hoarder', action: 'met' }]);
    const ep2 = episodeWith(2, [
      { t: 10, type: 'npc', id: 'quartermaster', action: 'met' },
      { t: 20, type: 'npc', id: 'hoarder', action: 'defeated' },
    ]);
    const ep3 = episodeWith(3, [{ t: 10, type: 'npc', id: 'hoarder', action: 'defeated' }]);

    const { entries } = registryIndex(
      show,
      registry,
      map([
        [1, ep1],
        [2, ep2],
        [3, ep3],
      ]),
    );

    const hoarder = entries.find((entry) => entry.entity.id === 'hoarder');
    const quartermaster = entries.find((entry) => entry.entity.id === 'quartermaster');
    expect(hoarder?.defeatedIn).toBe(2);
    expect(quartermaster?.defeatedIn).toBeUndefined();
  });

  it('omits entities that appear in no published episode', () => {
    const ep1 = episodeWith(1, [{ t: 10, type: 'npc', id: 'hoarder', action: 'met' }]);

    const { entries } = registryIndex(show, registry, map([[1, ep1]]));
    expect(entries.map((entry) => entry.entity.id)).toEqual(['hoarder']);
  });

  it('ignores beats naming an id the registry does not carry', () => {
    const ep1 = episodeWith(1, [
      { t: 10, type: 'npc', id: 'unknown-id', action: 'met' },
      { t: 20, type: 'npc', id: 'hoarder', action: 'met' },
    ]);

    const { entries } = registryIndex(show, registry, map([[1, ep1]]));
    expect(entries.map((entry) => entry.entity.id)).toEqual(['hoarder']);
  });

  it('reports episodes that failed to load and indexes the rest', () => {
    const ep1 = episodeWith(1, [{ t: 10, type: 'npc', id: 'hoarder', action: 'met' }]);
    const ep3 = episodeWith(3, [{ t: 10, type: 'npc', id: 'quartermaster', action: 'met' }]);

    const { entries, missingEpisodes } = registryIndex(
      show,
      registry,
      map([
        [1, ep1],
        [2, null],
        [3, ep3],
      ]),
    );

    expect(missingEpisodes).toEqual([2]);
    expect(entries.map((entry) => entry.entity.id)).toEqual(['hoarder', 'quartermaster']);
  });

  it('counts an episode absent from the map as missing', () => {
    const { entries, missingEpisodes } = registryIndex(show, registry, map([]));
    expect(missingEpisodes).toEqual([1, 2, 3]);
    expect(entries).toEqual([]);
  });

  it('ignores episode data the show does not list', () => {
    const stray = episodeWith(99, [{ t: 10, type: 'npc', id: 'hoarder', action: 'met' }]);
    const { entries, missingEpisodes } = registryIndex(show, registry, map([[99, stray]]));

    expect(entries).toEqual([]);
    expect(missingEpisodes).toEqual([1, 2, 3]);
  });

  it('indexes nothing when the show has no registry', () => {
    const ep1 = episodeWith(1, [{ t: 10, type: 'npc', id: 'hoarder', action: 'met' }]);
    const { entries, missingEpisodes } = registryIndex(show, null, map([[1, ep1]]));

    expect(entries).toEqual([]);
    expect(missingEpisodes).toEqual([]);
  });

  it('ignores non-npc events, including an unknown type', () => {
    const ep1 = episodeWith(1, [
      { t: 10, type: 'loot', actor: 'harry', item: 'Torch' },
      { t: 20, type: 'future_type', payload: 'nope' },
    ]);
    expect(ep1.events).toHaveLength(2);

    const { entries } = registryIndex(show, registry, map([[1, ep1]]));
    expect(entries).toEqual([]);
  });
});

/* --- Revision 2 (T718): episode-scoped views of the index --- */

/**
 * A three-episode archive with something to trim at every scope: a boss that
 * debuts, unlocks a fact and dies in episode 1 but is amended again in episode
 * 2; a vendor that debuts in episode 1 and is only re-sighted in episode 3; an
 * ally that debuts in episode 2.
 */
function scopedIndex() {
  const ep1 = episodeWith(1, [
    { t: 50, type: 'npc', id: 'hoarder', action: 'met' },
    { t: 60, type: 'npc', id: 'hoarder', action: 'update', unlock: ['lair'] },
    { t: 70, type: 'npc', id: 'hoarder', action: 'defeated' },
    { t: 80, type: 'npc', id: 'grull-rep', action: 'met' },
  ]);
  const ep2 = episodeWith(2, [
    { t: 10, type: 'npc', id: 'quartermaster', action: 'met', unlock: ['debt'] },
    { t: 20, type: 'npc', id: 'hoarder', action: 'seen' },
    { t: 30, type: 'npc', id: 'hoarder', action: 'update', unlock: ['weakness'] },
  ]);
  const ep3 = episodeWith(3, [{ t: 10, type: 'npc', id: 'grull-rep', action: 'seen' }]);

  return registryIndex(
    show,
    registry,
    map([
      [1, ep1],
      [2, ep2],
      [3, ep3],
    ]),
  ).entries;
}

const ids = (entries: RegistryEntry[]) => entries.map((entry) => entry.entity.id);
const find = (entries: RegistryEntry[], id: string) => {
  const entry = entries.find((candidate) => candidate.entity.id === id);
  if (entry === undefined) throw new Error(`no scoped entry for ${id}`);
  return entry;
};

describe('parseRegistryScope', () => {
  it('reads through-N and ep-N for an episode the show lists', () => {
    expect(parseRegistryScope('through-2', show)).toEqual({ kind: 'through', episodeId: 2 });
    expect(parseRegistryScope('ep-3', show)).toEqual({ kind: 'only', episodeId: 3 });
  });

  it('falls back to the whole archive for anything else', () => {
    // No param at all, an empty one, a shape it does not know, an episode the
    // show does not publish, and a number it cannot read.
    for (const param of [null, '', 'all', 'through', 'ep-', 'through-9', 'ep-99', 'ep-x', 'THROUGH-1']) {
      expect(parseRegistryScope(param, show)).toEqual({ kind: 'all' });
    }
  });
});

describe('scopeParam', () => {
  it('round-trips every scope, and leaves the param off for the whole archive', () => {
    expect(scopeParam({ kind: 'all' })).toBeNull();
    expect(scopeParam({ kind: 'through', episodeId: 2 })).toBe('through-2');
    expect(scopeParam({ kind: 'only', episodeId: 2 })).toBe('ep-2');

    for (const param of ['through-1', 'ep-2', 'through-3']) {
      expect(scopeParam(parseRegistryScope(param, show))).toBe(param);
    }
  });
});

describe('scopeRegistry', () => {
  it('leaves the whole archive alone', () => {
    const entries = scopedIndex();
    expect(scopeRegistry(entries, { kind: 'all' }, show)).toEqual(entries);
  });

  it('through N keeps the debuts up to N and trims everything later away', () => {
    const entries = scopedIndex();
    const through1 = scopeRegistry(entries, { kind: 'through', episodeId: 1 }, show);

    expect(ids(through1)).toEqual(['hoarder', 'grull-rep']);

    const hoarder = find(through1, 'hoarder');
    expect(hoarder.facts.map((fact) => fact.id)).toEqual(['lair']);
    expect(hoarder.appearances.map((a) => [a.episodeId, a.t])).toEqual([
      [1, 50],
      [1, 60],
      [1, 70],
    ]);
    expect(hoarder.defeatedIn).toBe(1);
  });

  it('through N keeps a later episode once the scope reaches it', () => {
    const through2 = scopeRegistry(scopedIndex(), { kind: 'through', episodeId: 2 }, show);

    // Order is the index's own: debut episode, then timecode.
    expect(ids(through2)).toEqual(['hoarder', 'grull-rep', 'quartermaster']);
    expect(find(through2, 'hoarder').facts.map((fact) => fact.id)).toEqual(['lair', 'weakness']);
    expect(find(through2, 'hoarder').appearances).toHaveLength(5);
    // Episode 3's sighting is still beyond the scope.
    expect(find(through2, 'grull-rep').appearances.map((a) => a.episodeId)).toEqual([1]);
  });

  it('does not announce a defeat the scope has not reached', () => {
    const ep1 = episodeWith(1, [{ t: 10, type: 'npc', id: 'hoarder', action: 'met' }]);
    const ep2 = episodeWith(2, [{ t: 10, type: 'npc', id: 'hoarder', action: 'defeated' }]);
    const entries = registryIndex(
      show,
      registry,
      map([
        [1, ep1],
        [2, ep2],
      ]),
    ).entries;

    expect(entries[0].defeatedIn).toBe(2);
    expect(
      scopeRegistry(entries, { kind: 'through', episodeId: 1 }, show)[0],
    ).not.toHaveProperty('defeatedIn');
    expect(scopeRegistry(entries, { kind: 'through', episodeId: 2 }, show)[0].defeatedIn).toBe(2);
  });

  it('only N keeps whoever appears in N, narrowed to that episode', () => {
    const only2 = scopeRegistry(scopedIndex(), { kind: 'only', episodeId: 2 }, show);

    // The vendor never appears in episode 2, so it is not in this cast.
    expect(ids(only2)).toEqual(['hoarder', 'quartermaster']);

    const hoarder = find(only2, 'hoarder');
    expect(hoarder.appearances.map((a) => [a.episodeId, a.t])).toEqual([
      [2, 20],
      [2, 30],
    ]);
    // Context from episode 1 is kept — the viewer already watched it — and so
    // is the defeat it recorded (spec R2 scenario 3).
    expect(hoarder.facts.map((fact) => fact.id)).toEqual(['lair', 'weakness']);
    expect(hoarder.defeatedIn).toBe(1);
    // The debut is still what it was; "only" does not re-file anyone.
    expect(hoarder.firstEpisode).toBe(1);
  });

  it('only N never leaks a later episode', () => {
    const only1 = scopeRegistry(scopedIndex(), { kind: 'only', episodeId: 1 }, show);

    expect(ids(only1)).toEqual(['hoarder', 'grull-rep']);
    expect(find(only1, 'hoarder').facts.map((fact) => fact.id)).toEqual(['lair']);
    expect(find(only1, 'hoarder').appearances.every((a) => a.episodeId === 1)).toBe(true);

    const only3 = scopeRegistry(scopedIndex(), { kind: 'only', episodeId: 3 }, show);
    expect(ids(only3)).toEqual(['grull-rep']);
    expect(find(only3, 'grull-rep').appearances.map((a) => a.episodeId)).toEqual([3]);
  });

  it('never mutates the entries it is handed', () => {
    const entries = scopedIndex();
    const before = JSON.stringify(entries);
    scopeRegistry(entries, { kind: 'through', episodeId: 1 }, show);
    scopeRegistry(entries, { kind: 'only', episodeId: 2 }, show);
    expect(JSON.stringify(entries)).toBe(before);
  });
});

/**
 * R2-SC-605: the same rules against the shipped sample archive, read off disk
 * exactly as `samples.test.ts` does — the hand-computed subsets the quickstart
 * quotes.
 */
describe('scopeRegistry over public/data', () => {
  const root = resolve(__dirname, '../..');
  const readJson = (name: string): unknown =>
    JSON.parse(readFileSync(resolve(root, 'public/data', name), 'utf8')) as unknown;

  const sampleShow = normalizeShow(readJson('show.json'));
  const sampleRegistry = normalizeRegistry(readJson('npcs.json'));
  const sampleEpisodes = new Map<number, EpisodeData | null>(
    orderedEpisodeIds(sampleShow).map((id) => [id, normalizeEpisode(readJson(`ep${id}.json`))]),
  );
  const sample = registryIndex(sampleShow, sampleRegistry, sampleEpisodes).entries;

  const scoped = (param: string) =>
    scopeRegistry(sample, parseRegistryScope(param, sampleShow), sampleShow);

  it('indexes every sample entity, in broadcast order', () => {
    // `the-listener-below` is episode 1's deliberate unknown id: no entry.
    expect(ids(sample)).toEqual([
      'the-hoarder',
      'grull-rep',
      'quartermaster-vel',
      'mother-of-pipes',
      'signal-choir',
      'the-tollkeeper',
      'the-lamplighter',
      'ghaza-provisioner',
    ]);
  });

  it('through-1 holds episode 1 debuts only, with only episode 1 facts', () => {
    const entries = scoped('through-1');
    expect(ids(entries)).toEqual(['the-hoarder', 'grull-rep', 'quartermaster-vel']);
    expect(find(entries, 'the-hoarder').facts.map((fact) => fact.id)).toEqual(['lair']);
    expect(find(entries, 'the-hoarder').defeatedIn).toBe(1);
  });

  it('through-2 adds episode 2 debuts and the amendment to the episode 1 boss', () => {
    const entries = scoped('through-2');
    expect(ids(entries)).toEqual([
      'the-hoarder',
      'grull-rep',
      'quartermaster-vel',
      'mother-of-pipes',
      'signal-choir',
    ]);
    expect(find(entries, 'the-hoarder').facts.map((fact) => fact.id)).toEqual(['lair', 'ledger']);
  });

  it('ep-2 holds only episode 2 appearances, keeping earlier context', () => {
    const entries = scoped('ep-2');
    expect(ids(entries)).toEqual([
      'the-hoarder',
      'grull-rep',
      'mother-of-pipes',
      'signal-choir',
    ]);

    const hoarder = find(entries, 'the-hoarder');
    expect(hoarder.appearances.map((a) => [a.episodeId, a.t])).toEqual([[2, 330]]);
    expect(hoarder.facts.map((fact) => fact.id)).toEqual(['lair', 'ledger']);
    // Beaten in episode 1: history the episode 2 viewer already has.
    expect(hoarder.defeatedIn).toBe(1);
  });

  it('ep-3 holds episode 3 and nobody else', () => {
    const entries = scoped('ep-3');
    expect(ids(entries)).toEqual(['the-tollkeeper', 'the-lamplighter', 'ghaza-provisioner']);
    expect(entries.every((entry) => entry.appearances.every((a) => a.episodeId === 3))).toBe(true);
  });
});

/* --- Revision 3 (T723): the shelving and the search the page and panel share --- */

describe('registrySections', () => {
  it('files entries under the episode they debut in, newest shelf first', () => {
    const entries = scopedIndex();
    const sections = registrySections(entries, { kind: 'all' }, show);

    // R4-FR-650: episode 2 leads, and inside episode 1 the entity met last does.
    expect(sections.map((section) => section.episodeId)).toEqual([2, 1]);
    expect(sections[0].title).toBe(show.episodes[1].title);
    expect(sections.map((section) => ids(section.entries))).toEqual([
      ['quartermaster'],
      ['grull-rep', 'hoarder'],
    ]);
  });

  it('stops at the scope under through N', () => {
    const entries = scopeRegistry(scopedIndex(), { kind: 'through', episodeId: 1 }, show);
    const sections = registrySections(entries, { kind: 'through', episodeId: 1 }, show);

    expect(sections.map((section) => section.episodeId)).toEqual([1]);
    expect(ids(sections[0].entries)).toEqual(['grull-rep', 'hoarder']);
  });

  it('puts the whole cast under one bar in only N, latest debut first', () => {
    const entries = scopeRegistry(scopedIndex(), { kind: 'only', episodeId: 2 }, show);
    const sections = registrySections(entries, { kind: 'only', episodeId: 2 }, show);

    expect(sections).toHaveLength(1);
    expect(sections[0].episodeId).toBe(2);
    // The Hoarder debuts in episode 1 and still shelves here (R2 scenario 3) —
    // below the ally this episode introduced.
    expect(ids(sections[0].entries)).toEqual(['quartermaster', 'hoarder']);
  });

  it('breaks a same-second tie on the id, and never mutates its input', () => {
    const ep1 = episodeWith(1, [
      { t: 40, type: 'npc', id: 'quartermaster', action: 'met' },
      { t: 40, type: 'npc', id: 'grull-rep', action: 'met' },
      { t: 40, type: 'npc', id: 'hoarder', action: 'met' },
    ]);
    const entries = registryIndex(show, registry, map([[1, ep1]])).entries;
    const before = ids(entries);

    expect(ids(registrySections(entries, { kind: 'all' }, show)[0].entries)).toEqual([
      'grull-rep',
      'hoarder',
      'quartermaster',
    ]);
    expect(ids(entries)).toEqual(before);
  });

  it('shelves nothing for an episode the show does not list', () => {
    expect(registrySections(scopedIndex(), { kind: 'only', episodeId: 99 }, show)).toEqual([]);
  });
});

describe('matchesRegistryQuery', () => {
  const hoarder = find(scopedIndex(), 'hoarder');

  it('matches everything on an empty or blank query', () => {
    expect(matchesRegistryQuery(hoarder, '')).toBe(true);
    expect(matchesRegistryQuery(hoarder, '   ')).toBe(true);
  });

  it('matches the name and every alias, case-insensitively', () => {
    expect(matchesRegistryQuery(hoarder, 'HOARD')).toBe(true);
    expect(matchesRegistryQuery(hoarder, 'crate king')).toBe(true);
    expect(matchesRegistryQuery(hoarder, 'quartermaster')).toBe(false);
  });
});

/* --- Revision 4 (T726): newest first, and the panel's clipped current episode --- */

describe('registrySections over public/data', () => {
  const root = resolve(__dirname, '../..');
  const readJson = (name: string): unknown =>
    JSON.parse(readFileSync(resolve(root, 'public/data', name), 'utf8')) as unknown;
  const publishedShow = normalizeShow(readJson('show.json'));
  const published = registryIndex(
    publishedShow,
    normalizeRegistry(readJson('npcs.json')),
    new Map<number, EpisodeData | null>(
      orderedEpisodeIds(publishedShow).map((id) => [id, normalizeEpisode(readJson(`ep${id}.json`))]),
    ),
  ).entries;

  it('reads Episode 3, Episode 2, Episode 1 top to bottom (R4 acceptance 1)', () => {
    const sections = registrySections(published, { kind: 'all' }, publishedShow);

    expect(sections.map((section) => section.episodeId)).toEqual([3, 2, 1]);
    expect(sections.map((section) => ids(section.entries))).toEqual([
      // Episode 3 debuts: 310, 230, 90.
      ['ghaza-provisioner', 'the-lamplighter', 'the-tollkeeper'],
      // Episode 2 debuts: 810, 100.
      ['signal-choir', 'mother-of-pipes'],
      // Episode 1 debuts: 205, 165, 130 — the entity met last leads.
      ['quartermaster-vel', 'grull-rep', 'the-hoarder'],
    ]);
  });

  it('keeps the index itself in broadcast order', () => {
    // Only the shelving is reversed; every scope still reads oldest first.
    expect(ids(published).slice(0, 3)).toEqual([
      'the-hoarder',
      'grull-rep',
      'quartermaster-vel',
    ]);
  });
});

describe('clipEpisodeToPlayhead', () => {
  const ep1 = makeEpisode(1);

  it('keeps every event at or before t, and drops the rest', () => {
    expect(clipEpisodeToPlayhead(ep1, 117).events.every((event) => event.t <= 117)).toBe(true);
    expect(clipEpisodeToPlayhead(ep1, 117).events).toEqual(
      ep1.events.filter((event) => event.t <= 117),
    );
    expect(clipEpisodeToPlayhead(ep1, 0).events).toEqual([]);
  });

  it('returns the episode itself when nothing is after the playhead', () => {
    expect(clipEpisodeToPlayhead(ep1, 10_000)).toBe(ep1);
  });

  it('never mutates the episode it is handed', () => {
    const before = ep1.events.length;
    clipEpisodeToPlayhead(ep1, 100);
    expect(ep1.events).toHaveLength(before);
    expect(clipEpisodeToPlayhead(ep1, 100).initialState).toBe(ep1.initialState);
  });
});

describe('registryIndexAt', () => {
  const episodes = map([[1, makeEpisode(1)]]);
  const at = (t: number) => registryIndexAt(show, registry, episodes, 1, t).entries;
  const hoarderAt = (t: number) => at(t).find((entry) => entry.entity.id === 'hoarder');

  /*
   * The fixture's episode 1 npc beats: grull-rep met @112, the hoarder met @118,
   * its lair unlocked @122, the quartermaster seen @135, an unknown id @140, the
   * weakness unlocked @185, the hoarder defeated @195.
   */
  it('lists nobody before the first beat', () => {
    expect(at(0)).toEqual([]);
    expect(at(111)).toEqual([]);
  });

  it('adds an entity on the second it is met', () => {
    expect(ids(at(112))).toEqual(['grull-rep']);
    expect(hoarderAt(117)).toBeUndefined();

    const hoarder = hoarderAt(118);
    expect(hoarder?.appearances).toHaveLength(1);
    expect(hoarder?.facts).toEqual([]);
    expect(hoarder).not.toHaveProperty('defeatedIn');
  });

  it('releases a fact only once its unlock has elapsed', () => {
    expect(hoarderAt(121)?.facts.map((fact) => fact.id)).toEqual([]);
    expect(hoarderAt(122)?.facts.map((fact) => fact.id)).toEqual(['lair']);
    expect(hoarderAt(184)?.facts.map((fact) => fact.id)).toEqual(['lair']);
    expect(hoarderAt(185)?.facts.map((fact) => fact.id)).toEqual(['lair', 'weakness']);
    // The fact tag still names the episode that released it.
    expect(hoarderAt(185)?.facts.every((fact) => fact.episodeId === 1)).toBe(true);
  });

  it('announces a defeat only once it has elapsed', () => {
    expect(hoarderAt(194)).not.toHaveProperty('defeatedIn');
    expect(hoarderAt(195)?.defeatedIn).toBe(1);
  });

  it('is symmetric: scrubbing back is only a smaller t', () => {
    // Every step of R4-SC-609's sweep, forward and then back again.
    const sweep = [112, 118, 122, 135, 185, 195, 150, 117];
    const seen = sweep.map((t) => ids(at(t)));

    expect(seen).toEqual([
      ['grull-rep'],
      ['grull-rep', 'hoarder'],
      ['grull-rep', 'hoarder'],
      ['grull-rep', 'hoarder', 'quartermaster'],
      ['grull-rep', 'hoarder', 'quartermaster'],
      ['grull-rep', 'hoarder', 'quartermaster'],
      ['grull-rep', 'hoarder', 'quartermaster'],
      ['grull-rep'],
    ]);
    // 5:00 after 9:00: the weakness and the defeat are gone again (R4 scenario 2).
    expect(hoarderAt(150)?.facts.map((fact) => fact.id)).toEqual(['lair']);
    expect(hoarderAt(150)).not.toHaveProperty('defeatedIn');
    expect(at(10_000)).toEqual(registryIndex(show, registry, episodes).entries);
  });

  it('reads every other episode whole', () => {
    const both = map([
      [1, makeEpisode(1)],
      [2, episodeWith(2, [{ t: 900, type: 'npc', id: 'quartermaster', action: 'met' }])],
    ]);
    // Watching episode 2 at 0:00: episode 1 is complete, episode 2 is not yet.
    const watching2 = registryIndexAt(show, registry, both, 2, 0).entries;
    expect(ids(watching2)).toEqual(['grull-rep', 'hoarder', 'quartermaster']);
    expect(find(watching2, 'quartermaster').appearances.map((a) => a.episodeId)).toEqual([1]);
    expect(find(watching2, 'hoarder').defeatedIn).toBe(1);
  });

  it('falls back to the plain index when the current episode is missing', () => {
    const missing = map([
      [1, makeEpisode(1)],
      [2, null],
    ]);
    expect(registryIndexAt(show, registry, missing, 2, 0)).toEqual(
      registryIndex(show, registry, missing),
    );
    expect(registryIndexAt(show, registry, missing, 99, 0).entries).toEqual(
      registryIndex(show, registry, missing).entries,
    );
  });

  it('never mutates the map it is handed', () => {
    const before = new Map(episodes);
    registryIndexAt(show, registry, episodes, 1, 120);
    expect(episodes).toEqual(before);
  });
});
