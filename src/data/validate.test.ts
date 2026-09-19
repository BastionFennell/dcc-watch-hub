import { describe, expect, it, vi } from 'vitest';
import {
  DataError,
  isEpisodeData,
  isRegistry,
  isShow,
  normalizeCrawler,
  normalizeEpisode,
  normalizeEvent,
  normalizeRegistry,
  normalizeShow,
  sortEvents,
  toNumber,
} from './validate';
import type { AnyEvent } from './types';
import { makeEpisode, makeEpisodeRaw, makeRegistry, makeShow } from '../test/fixtures';

describe('normalizeEvent', () => {
  it('keeps a well-formed known event', () => {
    expect(normalizeEvent({ t: 10, type: 'note', text: 'hello' })).toEqual({
      t: 10,
      type: 'note',
      text: 'hello',
    });
  });

  it('demotes an unknown event type to `unknown` without throwing', () => {
    const event = normalizeEvent({ t: 100, type: 'future_type', payload: 1 });
    expect(event.type).toBe('unknown');
    expect(event.t).toBe(100);
  });

  it('demotes a malformed hp event to `unknown`', () => {
    expect(normalizeEvent({ t: 5, type: 'hp', actor: 'harry', current: 'x' }).type).toBe(
      'unknown',
    );
    expect(normalizeEvent({ t: 5, type: 'hp', current: 3, max: 10 }).type).toBe('unknown');
  });

  it('demotes a non-object and a typeless row to `unknown`', () => {
    expect(normalizeEvent(null).type).toBe('unknown');
    expect(normalizeEvent('nope').type).toBe('unknown');
    expect(normalizeEvent({ t: 4 }).type).toBe('unknown');
  });

  it('coerces numeric strings and clamps negative t to 0', () => {
    expect(normalizeEvent({ t: '12', type: 'level_up', actor: 'xo', level: '3' })).toEqual({
      t: 12,
      type: 'level_up',
      actor: 'xo',
      level: 3,
    });
    const clamped = normalizeEvent({ t: -4, type: 'note', text: 'early' });
    expect(clamped.t).toBe(0);
  });

  // DCC has individual rank only (T334).
  it('accepts a rank only with an actor', () => {
    expect(normalizeEvent({ t: 1, type: 'rank', rank: 5 }).type).toBe('unknown');
    expect(normalizeEvent({ t: 1, type: 'rank', rank: 5, actor: 'xo' })).toEqual({
      t: 1,
      type: 'rank',
      actor: 'xo',
      rank: 5,
    });
  });

  it('reads a legacy crawler-scoped rank row and drops the scope', () => {
    expect(normalizeEvent({ t: 1, type: 'rank', scope: 'crawler', rank: 5, actor: 'xo' })).toEqual({
      t: 1,
      type: 'rank',
      actor: 'xo',
      rank: 5,
    });
  });

  it('demotes a legacy party rank row to unknown', () => {
    const legacy = normalizeEvent({ t: 1, type: 'rank', scope: 'party', rank: 61 });
    expect(legacy.type).toBe('unknown');
    // Even with an actor attached: a party rank is not a fact DCC has.
    expect(normalizeEvent({ t: 1, type: 'rank', scope: 'party', rank: 61, actor: 'xo' }).type).toBe(
      'unknown',
    );
  });

  it('rejects a sponsor without a positive duration', () => {
    expect(normalizeEvent({ t: 1, type: 'sponsor', text: 'x', durationSec: 0 }).type).toBe(
      'unknown',
    );
  });
});

describe('sortEvents', () => {
  it('sorts ascending and is stable for equal t (file order wins)', () => {
    const events: AnyEvent[] = [
      { t: 10, type: 'note', text: 'c' },
      { t: 5, type: 'note', text: 'a' },
      { t: 10, type: 'note', text: 'd' },
      { t: 5, type: 'note', text: 'b' },
    ];
    expect(sortEvents(events).map((e) => (e.type === 'note' ? e.text : ''))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });
});

describe('guards', () => {
  it('accepts the fixtures', () => {
    expect(isShow(makeShow())).toBe(true);
    expect(isEpisodeData(makeEpisode())).toBe(true);
  });

  it('rejects junk', () => {
    expect(isShow({})).toBe(false);
    expect(isEpisodeData({ episodeId: 1, events: [] })).toBe(false);
    expect(() => normalizeEpisode({ nope: true })).toThrow(DataError);
  });

  it('drops a legacy initialState.partyRank with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const episode = normalizeEpisode({
      episodeId: 1,
      initialState: { ...makeEpisode().initialState, partyRank: 61 },
      events: [],
    });
    expect(episode.initialState).not.toHaveProperty('partyRank');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('normalizeEpisode sorts and normalizes events', () => {
    const episode = normalizeEpisode({
      episodeId: 1,
      initialState: makeEpisode().initialState,
      events: [
        { t: 20, type: 'nonsense' },
        { t: 5, type: 'note', text: 'first' },
      ],
    });
    expect(episode.events.map((e) => e.t)).toEqual([5, 20]);
    expect(episode.events[1].type).toBe('unknown');
  });
});

describe('toNumber', () => {
  it('handles numbers, numeric strings, and rejects the rest', () => {
    expect(toNumber(3)).toBe(3);
    expect(toNumber(' 4.5 ')).toBe(4.5);
    expect(toNumber('abc')).toBeNull();
    expect(toNumber('')).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
  });
});

/* --------------------------------------------------- v2: new events + fields */

describe('normalizeEvent — v2 event types', () => {
  it('keeps a skill event with and without its optional fields', () => {
    expect(normalizeEvent({ t: 80, type: 'skill', actor: 'xo', name: 'Understudy Strike' })).toEqual(
      { t: 80, type: 'skill', actor: 'xo', name: 'Understudy Strike' },
    );
    expect(
      normalizeEvent({
        t: 80,
        type: 'skill',
        actor: 'xo',
        name: 'Understudy Strike',
        rank: '2',
        desc: 'Second run at it.',
      }),
    ).toEqual({
      t: 80,
      type: 'skill',
      actor: 'xo',
      name: 'Understudy Strike',
      rank: 2,
      desc: 'Second run at it.',
    });
  });

  it('drops a malformed skill rank instead of the whole event', () => {
    expect(
      normalizeEvent({ t: 80, type: 'skill', actor: 'xo', name: 'Strike', rank: 'high' }),
    ).toEqual({ t: 80, type: 'skill', actor: 'xo', name: 'Strike' });
    expect(
      normalizeEvent({ t: 80, type: 'skill', actor: 'xo', name: 'Strike', rank: 1.5 }),
    ).toEqual({ t: 80, type: 'skill', actor: 'xo', name: 'Strike' });
  });

  it('demotes a skill event with no actor or no name', () => {
    expect(normalizeEvent({ t: 80, type: 'skill', name: 'Strike' }).type).toBe('unknown');
    expect(normalizeEvent({ t: 80, type: 'skill', actor: 'xo', name: '' }).type).toBe('unknown');
  });

  it('keeps a class event and demotes an empty one', () => {
    expect(normalizeEvent({ t: 95, type: 'class', actor: 'harry', class: 'Compensated Anarchist' })).toEqual(
      { t: 95, type: 'class', actor: 'harry', class: 'Compensated Anarchist' },
    );
    expect(normalizeEvent({ t: 95, type: 'class', actor: 'harry', class: '' }).type).toBe('unknown');
    expect(normalizeEvent({ t: 95, type: 'class', class: 'Anarchist' }).type).toBe('unknown');
  });

  it('keeps a hotlist event and demotes one with a non-list', () => {
    expect(
      normalizeEvent({ t: 105, type: 'hotlist', actor: 'harry', add: ['Door'], remove: [] }),
    ).toEqual({ t: 105, type: 'hotlist', actor: 'harry', add: ['Door'], remove: [] });
    expect(
      normalizeEvent({ t: 105, type: 'hotlist', actor: 'harry', add: 'Door', remove: [] }).type,
    ).toBe('unknown');
  });
});

describe('normalizeCrawler — optional sheet fields', () => {
  const base = {
    id: 'harry',
    name: 'Harry',
    handle: 'Harry',
    player: 'Marcus',
    level: 2,
    hp: { current: 22, max: 22 },
    portrait: '/img/crawlers/harry.svg',
    class: null,
    inventory: [],
    rank: null,
  };

  it('keeps well-formed sheet fields', () => {
    const crawler = normalizeCrawler({
      ...base,
      race: 'Human',
      pronouns: 'he/him',
      crawlerNumber: '10,491,201',
      stats: { str: 5, int: 6, con: 6, dex: 7, cha: 4 },
      hotlist: ['Door'],
      skills: [{ name: 'Powerful Strike', rank: 1 }, { name: 'Crowbar Work' }],
    });
    expect(crawler).toMatchObject({
      race: 'Human',
      pronouns: 'he/him',
      crawlerNumber: '10,491,201',
      stats: { str: 5, int: 6, con: 6, dex: 7, cha: 4 },
      hotlist: ['Door'],
      skills: [{ name: 'Powerful Strike', rank: 1 }, { name: 'Crowbar Work' }],
    });
  });

  it('keeps a v1 crawler exactly as it is', () => {
    expect(normalizeCrawler(base as never)).toEqual(base);
  });

  it('drops each malformed optional field with a warning, never throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const crawler = normalizeCrawler({
      ...base,
      race: 7,
      pronouns: {},
      crawlerNumber: null,
      stats: { str: 5 },
      hotlist: 'Door',
      skills: [{ rank: 2 }],
    } as never);

    expect(crawler.race).toBeUndefined();
    expect(crawler.pronouns).toBeUndefined();
    expect(crawler.crawlerNumber).toBeUndefined();
    expect(crawler.stats).toBeUndefined();
    expect(crawler.hotlist).toBeUndefined();
    expect(crawler.skills).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(6);
    warn.mockRestore();
  });

  it('normalizeEpisode runs every crawler through it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = makeEpisodeRaw() as { initialState: { party: unknown[] } };
    const broken = { ...(raw.initialState.party[2] as object), stats: 'unfiled' };
    const episode = normalizeEpisode({
      ...raw,
      initialState: { ...raw.initialState, party: [...raw.initialState.party.slice(0, 2), broken] },
    });
    expect(episode.initialState.party[2].stats).toBeUndefined();
    expect(episode.initialState.party[2].skills).toEqual([{ name: 'Powerful Strike', rank: 1 }]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

/* ------------------------------------------ 003 revision 2: equip / unequip */

describe('normalizeEvent — gear events (R2-FR-220)', () => {
  it('keeps an equip event for every sheet slot', () => {
    for (const slot of ['head', 'torso', 'arms', 'hands', 'legs', 'feet', 'accessory']) {
      expect(normalizeEvent({ t: 152, type: 'equip', actor: 'harry', slot, item: 'Jacket' })).toEqual(
        { t: 152, type: 'equip', actor: 'harry', slot, item: 'Jacket' },
      );
    }
  });

  it('demotes an equip with an unknown slot, no actor, or no item', () => {
    expect(
      normalizeEvent({ t: 152, type: 'equip', actor: 'harry', slot: 'cape', item: 'Cloak' }).type,
    ).toBe('unknown');
    expect(normalizeEvent({ t: 152, type: 'equip', slot: 'torso', item: 'Cloak' }).type).toBe(
      'unknown',
    );
    expect(
      normalizeEvent({ t: 152, type: 'equip', actor: 'harry', slot: 'torso', item: '' }).type,
    ).toBe('unknown');
  });

  it('keeps an unequip with and without its optional item', () => {
    expect(normalizeEvent({ t: 168, type: 'unequip', actor: 'harry', slot: 'hands' })).toEqual({
      t: 168,
      type: 'unequip',
      actor: 'harry',
      slot: 'hands',
    });
    expect(
      normalizeEvent({
        t: 168,
        type: 'unequip',
        actor: 'harry',
        slot: 'accessory',
        item: 'Lucky Rabbit Foot',
      }),
    ).toEqual({
      t: 168,
      type: 'unequip',
      actor: 'harry',
      slot: 'accessory',
      item: 'Lucky Rabbit Foot',
    });
  });

  it('demotes an unequip with an unknown slot or no actor', () => {
    expect(
      normalizeEvent({ t: 168, type: 'unequip', actor: 'harry', slot: 'backpack' }).type,
    ).toBe('unknown');
    expect(normalizeEvent({ t: 168, type: 'unequip', slot: 'hands' }).type).toBe('unknown');
  });
});

describe('normalizeCrawler — gear and art (R2-FR-220/224)', () => {
  const base = {
    id: 'harry',
    name: 'Harry',
    handle: 'Harry',
    player: 'Marcus',
    level: 2,
    hp: { current: 22, max: 22 },
    portrait: '/img/crawlers/harry.svg',
    class: null,
    inventory: [],
    rank: null,
  };

  it('keeps well-formed gear and art', () => {
    const crawler = normalizeCrawler({
      ...base,
      gear: { hands: 'Enchanted Crowbar', accessories: ['Lucky Rabbit Foot'] },
      art: '/img/crawlers/harry-art.svg',
    });
    expect(crawler.gear).toEqual({
      hands: 'Enchanted Crowbar',
      accessories: ['Lucky Rabbit Foot'],
    });
    expect(crawler.art).toBe('/img/crawlers/harry-art.svg');
  });

  it('drops malformed gear and art with a warning, never throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const badSlot = normalizeCrawler({ ...base, gear: { torso: { name: 'Jacket' } } } as never);
    const badList = normalizeCrawler({ ...base, gear: { accessories: 'Ring' } } as never);
    const notAnObject = normalizeCrawler({ ...base, gear: 'a jacket' } as never);
    const badArt = normalizeCrawler({ ...base, art: ['/img/a.svg'] } as never);
    const emptyArt = normalizeCrawler({ ...base, art: '' });
    expect(badSlot.gear).toBeUndefined();
    expect(badList.gear).toBeUndefined();
    expect(notAnObject.gear).toBeUndefined();
    expect(badArt.art).toBeUndefined();
    expect(emptyArt.art).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(5);
    warn.mockRestore();
  });

  it('leaves a crawler with neither field untouched', () => {
    const crawler = normalizeCrawler({ ...base });
    expect(crawler.gear).toBeUndefined();
    expect(crawler.art).toBeUndefined();
  });
});

/* ---------------------------------------------------- 007: npc + registry */

describe('normalizeEvent (npc)', () => {
  it('keeps a well-formed npc event with every optional field', () => {
    expect(
      normalizeEvent({
        t: 118,
        type: 'npc',
        id: 'hoarder',
        action: 'update',
        note: 'It cannot see red.',
        unlock: ['lair', 'weakness'],
        actor: 'harry',
      }),
    ).toEqual({
      t: 118,
      type: 'npc',
      id: 'hoarder',
      action: 'update',
      note: 'It cannot see red.',
      unlock: ['lair', 'weakness'],
      actor: 'harry',
    });
  });

  it('keeps the bare form and omits the optional keys entirely', () => {
    const event = normalizeEvent({ t: 10, type: 'npc', id: 'grull-rep', action: 'met' });
    expect(event).toEqual({ t: 10, type: 'npc', id: 'grull-rep', action: 'met' });
    expect(event).not.toHaveProperty('note');
    expect(event).not.toHaveProperty('unlock');
    expect(event).not.toHaveProperty('actor');
  });

  it('keeps an id the registry has never heard of (US1 scenario 5)', () => {
    expect(normalizeEvent({ t: 140, type: 'npc', id: 'unknown-id', action: 'met' })).toMatchObject({
      type: 'npc',
      id: 'unknown-id',
    });
  });

  it.each([
    [{ t: 1, type: 'npc', action: 'met' }],
    [{ t: 1, type: 'npc', id: '', action: 'met' }],
    [{ t: 1, type: 'npc', id: 'hoarder' }],
    [{ t: 1, type: 'npc', id: 'hoarder', action: 'befriended' }],
    [{ t: 1, type: 'npc', id: ['hoarder'], action: 'met' }],
  ])('demotes %j to `unknown`', (raw) => {
    expect(normalizeEvent(raw).type).toBe('unknown');
  });

  it('filters `unlock` down to non-empty strings', () => {
    expect(
      normalizeEvent({ t: 1, type: 'npc', id: 'hoarder', action: 'update', unlock: ['lair', '', 7, null] }),
    ).toEqual({ t: 1, type: 'npc', id: 'hoarder', action: 'update', unlock: ['lair'] });
    expect(
      normalizeEvent({ t: 1, type: 'npc', id: 'hoarder', action: 'update', unlock: 'lair' }),
    ).toEqual({ t: 1, type: 'npc', id: 'hoarder', action: 'update' });
  });
});

describe('isRegistry', () => {
  it('accepts anything with an entities array', () => {
    expect(isRegistry({ entities: [] })).toBe(true);
    expect(isRegistry(makeRegistry())).toBe(true);
  });

  it.each([[null], [undefined], [[]], ['entities'], [{}], [{ entities: {} }]])(
    'rejects %j',
    (raw) => {
      expect(isRegistry(raw)).toBe(false);
    },
  );
});

describe('normalizeRegistry', () => {
  it('keeps every well-formed entity, with its optional fields', () => {
    const registry = normalizeRegistry(makeRegistry());
    expect(registry.entities.map((entity) => entity.id)).toEqual([
      'hoarder',
      'grull-rep',
      'quartermaster',
    ]);
    expect(registry.entities[0].facts.map((fact) => fact.id)).toEqual(['lair', 'weakness']);
    expect(registry.entities[1].aliases).toEqual(['Grull']);
  });

  it('throws only when the envelope itself is unusable', () => {
    expect(() => normalizeRegistry({ nope: true })).toThrow(DataError);
    expect(() => normalizeRegistry(null)).toThrow(DataError);
    expect(normalizeRegistry({ entities: [] })).toEqual({ entities: [] });
  });

  it('drops malformed entities with a warning and keeps the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = normalizeRegistry({
      entities: [
        { id: '', name: 'Nameless', kind: 'boss', intro: 'x', facts: [] },
        { id: 'a', name: '', kind: 'boss', intro: 'x', facts: [] },
        { id: 'b', name: 'B', kind: 'mob', intro: 'x', facts: [] },
        { id: 'c', name: 'C', kind: 'ally', intro: '', facts: [] },
        'not an entity',
        { id: 'd', name: 'D', kind: 'vendor', intro: 'Sells things.', facts: [] },
      ],
    });
    expect(registry.entities.map((entity) => entity.id)).toEqual(['d']);
    expect(warn).toHaveBeenCalledTimes(5);
    warn.mockRestore();
  });

  it('drops malformed facts but keeps the entity', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = normalizeRegistry({
      entities: [
        {
          id: 'a',
          name: 'A',
          kind: 'boss',
          intro: 'Large.',
          facts: [
            { id: 'one', text: 'Good.' },
            { id: '', text: 'No id.' },
            { id: 'two' },
            { id: 'one', text: 'Duplicate.' },
            'nope',
          ],
        },
        { id: 'b', name: 'B', kind: 'ally', intro: 'Helpful.', facts: 'many' },
      ],
    });
    expect(registry.entities[0].facts).toEqual([{ id: 'one', text: 'Good.' }]);
    expect(registry.entities[1].facts).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(5);
    warn.mockRestore();
  });

  it('keeps the first of two entities sharing an id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = normalizeRegistry({
      entities: [
        { id: 'a', name: 'First', kind: 'boss', intro: 'One.', facts: [] },
        { id: 'a', name: 'Second', kind: 'ally', intro: 'Two.', facts: [] },
      ],
    });
    expect(registry.entities).toHaveLength(1);
    expect(registry.entities[0].name).toBe('First');
    warn.mockRestore();
  });

  it('drops an alias list that is not a list of strings', () => {
    const registry = normalizeRegistry({
      entities: [
        { id: 'a', name: 'A', kind: 'boss', intro: 'Large.', facts: [], aliases: ['Al', '', 3] },
        { id: 'b', name: 'B', kind: 'ally', intro: 'Small.', facts: [], aliases: 'Bee' },
      ],
    });
    expect(registry.entities[0].aliases).toEqual(['Al']);
    expect(registry.entities[1].aliases).toBeUndefined();
  });
});

describe('normalizeShow (registryUrl)', () => {
  it('preserves a string registryUrl', () => {
    expect(normalizeShow({ ...makeShow(), registryUrl: '/data/npcs.json' }).registryUrl).toBe(
      '/data/npcs.json',
    );
  });

  it('drops a registryUrl that is not a string, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const show = normalizeShow({ ...makeShow(), registryUrl: 7 });
    expect(show.registryUrl).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('leaves a show with no registry alone', () => {
    const { registryUrl: _registryUrl, ...noRegistry } = makeShow();
    expect(normalizeShow(noRegistry).registryUrl).toBeUndefined();
  });
});
