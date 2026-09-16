/**
 * The cross-episode index (T712, research R5/R7). These are pure-data tests: no
 * DOM, no fetch — the page's job is to hand `registryIndex` a map, and this is
 * every rule about what comes back.
 */
import { describe, expect, it } from 'vitest';
import type { EpisodeData, Registry, Show } from '../data/types';
import { normalizeEpisode } from '../data/validate';
import { makeEpisode, makeRegistry, makeShow } from '../test/fixtures';
import { registryIndex } from './registry';

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
