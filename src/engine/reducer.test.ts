import { describe, expect, it } from 'vitest';
import { applyEvent, reduceTo } from './reducer';
import { findCrawler, fromInitialState } from './state';
import type { AnyEvent, EpisodeData } from '../data/types';
import { normalizeEpisode } from '../data/validate';
import { makeEpisode, makeEpisodeRaw } from '../test/fixtures';

const episode = makeEpisode();
const init = () => fromInitialState(episode.initialState);

function withEvents(events: unknown[]): EpisodeData {
  const raw = makeEpisodeRaw() as { events: unknown[] };
  return normalizeEpisode({ ...raw, events });
}

describe('applyEvent — one case per event type', () => {
  it('system_message does not change state', () => {
    const before = init();
    expect(applyEvent(before, { t: 1, type: 'system_message', text: 'hi' })).toBe(before);
  });

  it('achievement records the title on the crawler', () => {
    const after = applyEvent(init(), {
      t: 1,
      type: 'achievement',
      actor: 'harry',
      title: 'Gate Crasher',
    });
    expect(findCrawler(after, 'harry')?.achievements).toEqual(['Gate Crasher']);
  });

  it('loot appends to inventory', () => {
    const after = applyEvent(init(), { t: 1, type: 'loot', actor: 'harry', item: 'Crowbar' });
    expect(findCrawler(after, 'harry')?.inventory).toContain('Crowbar');
  });

  it('hp sets current and max', () => {
    const after = applyEvent(init(), { t: 1, type: 'hp', actor: 'harry', current: 4, max: 22 });
    expect(findCrawler(after, 'harry')?.hp).toEqual({ current: 4, max: 22 });
  });

  it('level_up sets the level', () => {
    const after = applyEvent(init(), { t: 1, type: 'level_up', actor: 'xo', level: 2 });
    expect(findCrawler(after, 'xo')?.level).toBe(2);
  });

  it('rank scope party sets partyRank; scope crawler sets the crawler rank', () => {
    expect(applyEvent(init(), { t: 1, type: 'rank', scope: 'party', rank: 61 }).partyRank).toBe(61);
    const after = applyEvent(init(), {
      t: 1,
      type: 'rank',
      scope: 'crawler',
      rank: 9,
      actor: 'xo',
    });
    expect(findCrawler(after, 'xo')?.rank).toBe(9);
    expect(after.partyRank).toBeNull();
  });

  it('map_reveal unions cells and never duplicates', () => {
    const once = applyEvent(init(), {
      t: 1,
      type: 'map_reveal',
      cells: [
        [3, 2],
        [4, 2],
      ],
    });
    const twice = applyEvent(once, { t: 2, type: 'map_reveal', cells: [[3, 2]] });
    expect(once.map.revealed).toEqual([
      [3, 2],
      [4, 2],
    ]);
    expect(twice.map.revealed).toHaveLength(2);
    expect(twice).toBe(once);
  });

  it('sponsor, chapter, and note do not change state', () => {
    const before = init();
    expect(applyEvent(before, { t: 1, type: 'sponsor', text: 's', durationSec: 20 })).toBe(before);
    expect(applyEvent(before, { t: 1, type: 'chapter', label: 'Boss', kind: 'boss' })).toBe(before);
    expect(applyEvent(before, { t: 1, type: 'note', text: 'n' })).toBe(before);
  });

  it('status adds then removes a pip', () => {
    const added = applyEvent(init(), {
      t: 1,
      type: 'status',
      actor: 'psychic',
      add: ['Poisoned'],
      remove: [],
    });
    expect(findCrawler(added, 'psychic')?.statuses).toEqual(['Poisoned']);
    const removed = applyEvent(added, {
      t: 2,
      type: 'status',
      actor: 'psychic',
      add: [],
      remove: ['Poisoned'],
    });
    expect(findCrawler(removed, 'psychic')?.statuses).toEqual([]);
  });

  it('inventory adds and removes items', () => {
    const looted = applyEvent(init(), { t: 1, type: 'loot', actor: 'harry', item: 'Crowbar' });
    const swapped = applyEvent(looted, {
      t: 2,
      type: 'inventory',
      actor: 'harry',
      add: ['Torch'],
      remove: ['Crowbar'],
    });
    expect(findCrawler(swapped, 'harry')?.inventory).toEqual(['Torch']);
  });
});

describe('tolerance', () => {
  it('ignores an unknown event type', () => {
    const before = init();
    expect(applyEvent(before, { t: 1, type: 'unknown', raw: { type: 'future_type' } })).toBe(before);
  });

  it('ignores an unknown actor', () => {
    const before = init();
    const after = applyEvent(before, { t: 1, type: 'hp', actor: 'ghost', current: 1, max: 10 });
    expect(after).toBe(before);
  });

  it('clamps hp into [0, max]', () => {
    const over = applyEvent(init(), { t: 1, type: 'hp', actor: 'harry', current: 999, max: 22 });
    expect(findCrawler(over, 'harry')?.hp.current).toBe(22);
    const under = applyEvent(init(), { t: 1, type: 'hp', actor: 'harry', current: -5, max: 22 });
    expect(findCrawler(under, 'harry')?.hp.current).toBe(0);
  });

  it('never mutates the input state', () => {
    const before = init();
    const snapshot = JSON.parse(JSON.stringify(before));
    applyEvent(before, { t: 1, type: 'hp', actor: 'harry', current: 4, max: 22 });
    expect(before).toEqual(snapshot);
  });
});

describe('reduceTo', () => {
  it('returns the initial state at t = 0', () => {
    const state = reduceTo(episode, 0);
    expect(state).toEqual(fromInitialState(episode.initialState));
    expect(state.party.every((c) => c.statuses.length === 0)).toBe(true);
  });

  it('is deterministic: two calls are deep-equal', () => {
    expect(reduceTo(episode, 137)).toEqual(reduceTo(episode, 137));
  });

  it('recomputes identically whether reached forward or backward', () => {
    const forward = reduceTo(episode, 95);
    reduceTo(episode, 235);
    const backward = reduceTo(episode, 95);
    expect(backward).toEqual(forward);
  });

  it('never reflects an event before its t (checked at every event boundary)', () => {
    for (const event of episode.events) {
      const before = reduceTo(episode, event.t - 0.001);
      const at = reduceTo(episode, event.t);

      switch (event.type) {
        case 'hp':
          expect(findCrawler(before, event.actor)?.hp.current).not.toBe(
            findCrawler(at, event.actor)?.hp.current,
          );
          expect(findCrawler(at, event.actor)?.hp.current).toBe(event.current);
          break;
        case 'level_up':
          expect(findCrawler(before, event.actor)?.level).toBeLessThan(event.level);
          expect(findCrawler(at, event.actor)?.level).toBe(event.level);
          break;
        case 'achievement':
          expect(findCrawler(before, event.actor)?.achievements).not.toContain(event.title);
          expect(findCrawler(at, event.actor)?.achievements).toContain(event.title);
          break;
        case 'rank':
          if (event.scope === 'party') {
            expect(before.partyRank).not.toBe(event.rank);
            expect(at.partyRank).toBe(event.rank);
          }
          break;
        case 'map_reveal':
          expect(before.map.revealed.length).toBeLessThan(at.map.revealed.length);
          break;
        default:
          break;
      }
    }
  });

  it('applies equal-t events in file order', () => {
    const ep = withEvents([
      { t: 50, type: 'hp', actor: 'harry', current: 10, max: 22 },
      { t: 50, type: 'hp', actor: 'harry', current: 3, max: 22 },
    ]);
    expect(findCrawler(reduceTo(ep, 50), 'harry')?.hp.current).toBe(3);
  });

  it('ignores every event past the playhead', () => {
    const ep = withEvents([
      { t: 10, type: 'level_up', actor: 'xo', level: 2 },
      { t: 200, type: 'level_up', actor: 'xo', level: 9 },
    ]);
    expect(findCrawler(reduceTo(ep, 199.999), 'xo')?.level).toBe(2);
  });

  it('a mixed log of every event type folds without throwing', () => {
    const all: AnyEvent[] = episode.events;
    expect(all.some((e) => e.type === 'unknown')).toBe(true);
    expect(() => reduceTo(episode, 1_000)).not.toThrow();
  });
});

/* ------------------------------------------------- v2: skill, class, hotlist */

describe('applyEvent — v2 event types', () => {
  it('seeds skills and hotlist from the crawler sheet fields', () => {
    const harry = findCrawler(init(), 'harry');
    expect(harry?.skills).toEqual([{ name: 'Powerful Strike', rank: 1 }]);
    expect(harry?.hotlist).toEqual([]);
    // A crawler with no sheet fields still gets empty lists, never undefined.
    expect(findCrawler(init(), 'xo')?.skills).toEqual([]);
    expect(findCrawler(init(), 'xo')?.hotlist).toEqual([]);
  });

  it('skill appends a new skill and keeps the seeded ones', () => {
    const after = applyEvent(init(), {
      t: 1,
      type: 'skill',
      actor: 'harry',
      name: 'Crowbar Work',
      rank: 1,
    });
    expect(findCrawler(after, 'harry')?.skills).toEqual([
      { name: 'Powerful Strike', rank: 1 },
      { name: 'Crowbar Work', rank: 1 },
    ]);
  });

  it('skill upserts by name: the rank is replaced, the slot is kept', () => {
    const first = applyEvent(init(), { t: 1, type: 'skill', actor: 'xo', name: 'Strike', rank: 1 });
    const second = applyEvent(first, { t: 2, type: 'skill', actor: 'xo', name: 'Sprint' });
    const third = applyEvent(second, { t: 3, type: 'skill', actor: 'xo', name: 'Strike', rank: 2 });
    expect(findCrawler(third, 'xo')?.skills).toEqual([{ name: 'Strike', rank: 2 }, { name: 'Sprint' }]);
  });

  it('skill without a rank leaves an existing rank alone', () => {
    const first = applyEvent(init(), { t: 1, type: 'skill', actor: 'xo', name: 'Strike', rank: 3 });
    const second = applyEvent(first, { t: 2, type: 'skill', actor: 'xo', name: 'Strike' });
    expect(findCrawler(second, 'xo')?.skills).toEqual([{ name: 'Strike', rank: 3 }]);
  });

  it('class sets the crawler class', () => {
    const after = applyEvent(init(), {
      t: 1,
      type: 'class',
      actor: 'harry',
      class: 'Compensated Anarchist',
    });
    expect(findCrawler(after, 'harry')?.class).toBe('Compensated Anarchist');
    expect(findCrawler(after, 'xo')?.class).toBeNull();
  });

  it('hotlist adds, removes, and never duplicates', () => {
    const added = applyEvent(init(), {
      t: 1,
      type: 'hotlist',
      actor: 'harry',
      add: ['Door', 'The Hoarder'],
      remove: [],
    });
    expect(findCrawler(added, 'harry')?.hotlist).toEqual(['Door', 'The Hoarder']);

    const again = applyEvent(added, {
      t: 2,
      type: 'hotlist',
      actor: 'harry',
      add: ['Door', 'Crowbar'],
      remove: ['The Hoarder'],
    });
    expect(findCrawler(again, 'harry')?.hotlist).toEqual(['Door', 'Crowbar']);
  });

  it('ignores all three for an unknown actor', () => {
    const before = init();
    expect(applyEvent(before, { t: 1, type: 'skill', actor: 'ghost', name: 'Haunt' })).toBe(before);
    expect(applyEvent(before, { t: 1, type: 'class', actor: 'ghost', class: 'Spectre' })).toBe(before);
    expect(
      applyEvent(before, { t: 1, type: 'hotlist', actor: 'ghost', add: ['x'], remove: [] }),
    ).toBe(before);
  });

  it('reduceTo replays them purely in both directions', () => {
    const at94 = reduceTo(episode, 94);
    const at170 = reduceTo(episode, 170);
    expect(findCrawler(at94, 'harry')?.class).toBeNull();
    expect(findCrawler(at170, 'harry')?.class).toBe('Compensated Anarchist');
    expect(findCrawler(at170, 'harry')?.hotlist).toEqual(['Crowbar']);
    expect(findCrawler(reduceTo(episode, 110), 'harry')?.hotlist).toEqual(['Door']);
    // X.O. keeps logging skills; the first one is upserted to rank 2 at 160.
    expect(findCrawler(at170, 'xo')?.skills[0]).toEqual({ name: 'Understudy Strike', rank: 2 });
    expect(findCrawler(reduceTo(episode, 100), 'xo')?.skills[0]).toEqual({
      name: 'Understudy Strike',
      rank: 1,
    });
  });
});

/* --------------------------------------- 003 revision 2: equip and unequip */

describe('applyEvent — gear (R2-FR-220)', () => {
  const gearOf = (state: ReturnType<typeof init>, id: string) => findCrawler(state, id)?.gear;

  const equip = (slot: string, item: string, actor = 'harry', t = 1): AnyEvent =>
    ({ t, type: 'equip', actor, slot, item }) as AnyEvent;
  const unequip = (slot: string, item?: string, actor = 'harry', t = 2): AnyEvent =>
    ({ t, type: 'unequip', actor, slot, ...(item === undefined ? {} : { item }) }) as AnyEvent;

  it('seeds gear from the crawler sheet and leaves the rest empty', () => {
    expect(gearOf(init(), 'harry')).toEqual({
      head: null,
      torso: null,
      arms: null,
      hands: 'Enchanted Crowbar',
      legs: null,
      feet: null,
      accessories: [],
    });
    // A crawler with no `gear` field still gets every slot, never undefined.
    expect(gearOf(init(), 'xo')).toEqual({
      head: null,
      torso: null,
      arms: null,
      hands: null,
      legs: null,
      feet: null,
      accessories: [],
    });
  });

  it('equip fills a slot and replaces whatever was worn there', () => {
    const after = applyEvent(applyEvent(init(), equip('torso', 'Patched Jacket')), equip('torso', 'Plate'));
    expect(gearOf(after, 'harry')?.torso).toBe('Plate');
    expect(gearOf(after, 'harry')?.hands).toBe('Enchanted Crowbar');
  });

  it('unequip clears a slot and is a no-op on an empty one', () => {
    const cleared = applyEvent(init(), unequip('hands'));
    expect(gearOf(cleared, 'harry')?.hands).toBeNull();
    const again = applyEvent(cleared, unequip('hands'));
    expect(gearOf(again, 'harry')?.hands).toBeNull();
  });

  it('accessory equips append, dedupe by name, and cap at ten', () => {
    let state = init();
    for (let i = 1; i <= 12; i += 1) {
      state = applyEvent(state, equip('accessory', `Charm ${i}`));
    }
    state = applyEvent(state, equip('accessory', 'Charm 1'));
    const accessories = gearOf(state, 'harry')?.accessories ?? [];
    expect(accessories).toHaveLength(10);
    expect(accessories[0]).toBe('Charm 1');
    expect(accessories[9]).toBe('Charm 10');
    expect(accessories).not.toContain('Charm 11');
  });

  it('accessory unequip removes by name, or the last one with no name', () => {
    let state = init();
    state = applyEvent(state, equip('accessory', 'Lucky Rabbit Foot'));
    state = applyEvent(state, equip('accessory', 'Cracked Locket'));
    state = applyEvent(state, equip('accessory', 'Signal Ring'));

    const byName = applyEvent(state, unequip('accessory', 'Cracked Locket'));
    expect(gearOf(byName, 'harry')?.accessories).toEqual(['Lucky Rabbit Foot', 'Signal Ring']);

    const last = applyEvent(state, unequip('accessory'));
    expect(gearOf(last, 'harry')?.accessories).toEqual(['Lucky Rabbit Foot', 'Cracked Locket']);

    // A name nobody is wearing changes nothing.
    expect(gearOf(applyEvent(state, unequip('accessory', 'Nothing')), 'harry')?.accessories).toEqual(
      ['Lucky Rabbit Foot', 'Cracked Locket', 'Signal Ring'],
    );
    // Neither does clearing an empty accessory list.
    expect(gearOf(applyEvent(init(), unequip('accessory')), 'harry')?.accessories).toEqual([]);
  });

  it('ignores gear events for an unknown actor', () => {
    const before = init();
    expect(applyEvent(before, equip('torso', 'Jacket', 'ghost'))).toBe(before);
    expect(applyEvent(before, unequip('hands', undefined, 'ghost'))).toBe(before);
  });

  it('replays the fixture’s gear purely in both directions', () => {
    // Harry: crowbar from the sheet, jacket at 152, charm at 153, crowbar off
    // at 168, torch on at 169.
    expect(gearOf(reduceTo(episode, 151), 'harry')).toMatchObject({
      hands: 'Enchanted Crowbar',
      torso: null,
      accessories: [],
    });
    expect(gearOf(reduceTo(episode, 152), 'harry')?.torso).toBe('Patched Jacket');
    expect(gearOf(reduceTo(episode, 153), 'harry')?.accessories).toEqual(['Lucky Rabbit Foot']);
    expect(gearOf(reduceTo(episode, 168), 'harry')?.hands).toBeNull();
    expect(gearOf(reduceTo(episode, 200), 'harry')).toEqual({
      head: null,
      torso: 'Patched Jacket',
      arms: null,
      hands: 'Torch',
      legs: null,
      feet: null,
      accessories: ['Lucky Rabbit Foot'],
    });
    // Backward seek recomputes: nothing from after the playhead survives.
    expect(gearOf(reduceTo(episode, 100), 'harry')).toEqual(gearOf(init(), 'harry'));
  });

  it('demoted gear events (unknown slot) leave state untouched', () => {
    const broken = withEvents([{ t: 5, type: 'equip', actor: 'harry', slot: 'cape', item: 'Cloak' }]);
    expect(reduceTo(broken, 10).party).toEqual(fromInitialState(broken.initialState).party);
  });
});
