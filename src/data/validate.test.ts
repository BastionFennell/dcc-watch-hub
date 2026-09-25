import {
  describe,
  expect,
  it,
  vi } from 'vitest';
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
  isSpellRegistry,
  validateSpells,
} from './validate';
import { validateCrawlers, validateDossier, validateStatus } from './roster';
import type { AnyEvent } from './types';
import {
  makeCrawlers,
  makeDossier,
  makeEpisode,
  makeEpisodeRaw,
  makeRegistry,
  makeShow,
  makeSpells,
  makeStatus,
} from '../test/fixtures';

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

describe('normalizeEvent - v2 event types', () => {
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

describe('normalizeCrawler - optional sheet fields', () => {
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

describe('normalizeEvent - gear events (R2-FR-220)', () => {
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

describe('normalizeCrawler - gear and art (R2-FR-220/224)', () => {
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

/* ---------------------- 008 revision 2: entries with structure, and spells */

describe('normalizeCrawler - structured entries and spells (008 R2)', () => {
  const base = {
    id: 'mimi',
    name: 'Mimi Rivers',
    handle: 'Crawler Mimi',
    player: '',
    level: 1,
    hp: { current: 20, max: 20 },
    portrait: '/img/crawlers/mimi.png',
    class: null,
    inventory: [],
    rank: null,
  };

  it('keeps string and object entries side by side', () => {
    const crawler = normalizeCrawler({
      ...base,
      hotlist: ['Door', { name: 'Standard Mana Potion', qty: 5, desc: 'Fully restores Mana.' }],
      inventory: [{ name: 'Torch' }, 'Rope'],
    });
    expect(crawler.hotlist).toEqual([
      'Door',
      { name: 'Standard Mana Potion', qty: 5, desc: 'Fully restores Mana.' },
    ]);
    expect(crawler.inventory).toEqual([{ name: 'Torch' }, 'Rope']);
  });

  it('drops a malformed quantity or description without losing the entry', () => {
    const crawler = normalizeCrawler({
      ...base,
      hotlist: [{ name: 'Heal', qty: -1, desc: '' }],
    });
    expect(crawler.hotlist).toEqual([{ name: 'Heal' }]);
  });

  it('drops a hotlist whose entry has no name at all, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const crawler = normalizeCrawler({ ...base, hotlist: [{ qty: 5 }] } as never);
    expect(crawler.hotlist).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('empties a malformed inventory rather than deleting the required field', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const crawler = normalizeCrawler({ ...base, inventory: 'Torch' } as never);
    expect(crawler.inventory).toEqual([]);
    warn.mockRestore();
  });

  it('keeps a skill description and a well-formed spell list', () => {
    const crawler = normalizeCrawler({
      ...base,
      skills: [{ name: 'Frost Scar', rank: 3, desc: 'A scar of rime.' }],
      spells: [{ name: 'Heal', rank: 1, mana: 2, desc: 'Heal 2 HB slots.' }],
    });
    expect(crawler.skills).toEqual([{ name: 'Frost Scar', rank: 3, desc: 'A scar of rime.' }]);
    expect(crawler.spells).toEqual([{ name: 'Heal', rank: 1, mana: 2, desc: 'Heal 2 HB slots.' }]);
  });

  it('drops a malformed spell list, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const crawler = normalizeCrawler({ ...base, spells: [{ rank: 1 }] } as never);
    expect(crawler.spells).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('normalizeEvent - spell (008 R2)', () => {
  it('keeps a well-formed spell row', () => {
    expect(
      normalizeEvent({ t: 72, type: 'spell', actor: 'mimi', name: 'Heal', rank: 1, mana: 2 }),
    ).toEqual({ t: 72, type: 'spell', actor: 'mimi', name: 'Heal', rank: 1, mana: 2 });
  });

  it('keeps a spell with nothing but a name', () => {
    expect(normalizeEvent({ t: 1, type: 'spell', actor: 'mimi', name: 'Heal' })).toEqual({
      t: 1,
      type: 'spell',
      actor: 'mimi',
      name: 'Heal',
    });
  });

  it('drops a malformed rank or cost rather than the row', () => {
    expect(
      normalizeEvent({ t: 1, type: 'spell', actor: 'mimi', name: 'Heal', rank: 'x', mana: -2 }),
    ).toEqual({ t: 1, type: 'spell', actor: 'mimi', name: 'Heal' });
  });

  it('demotes a spell with no actor or no name', () => {
    expect(normalizeEvent({ t: 1, type: 'spell', name: 'Heal' }).type).toBe('unknown');
    expect(normalizeEvent({ t: 1, type: 'spell', actor: 'mimi', name: '' }).type).toBe('unknown');
  });
});

/* --------------------------------------- 008 revision 4: the spell registry */

describe('normalizeEvent - spell refs (008 R4)', () => {
  it('keeps a row that points at the registry instead of naming the spell', () => {
    expect(normalizeEvent({ t: 9, type: 'spell', actor: 'mimi', ref: 'heal', rank: 1 })).toEqual({
      t: 9,
      type: 'spell',
      actor: 'mimi',
      ref: 'heal',
      rank: 1,
    });
  });

  it('keeps both when the row carries a ref and a name', () => {
    expect(normalizeEvent({ t: 9, type: 'spell', actor: 'mimi', ref: 'heal', name: 'Heal' })).toEqual(
      { t: 9, type: 'spell', actor: 'mimi', name: 'Heal', ref: 'heal' },
    );
  });

  it('drops a ref that is not kebab-case rather than the row', () => {
    expect(normalizeEvent({ t: 9, type: 'spell', actor: 'mimi', name: 'Heal', ref: 'Heal' })).toEqual(
      { t: 9, type: 'spell', actor: 'mimi', name: 'Heal' },
    );
  });

  it('demotes a row with neither a name nor a ref', () => {
    expect(normalizeEvent({ t: 9, type: 'spell', actor: 'mimi' }).type).toBe('unknown');
    expect(normalizeEvent({ t: 9, type: 'spell', actor: 'mimi', ref: 'Heal' }).type).toBe('unknown');
  });
});

describe('normalizeCrawler - ref entries (008 R4)', () => {
  const base = { id: 'mimi', name: 'Mimi', handle: '', player: '', level: 1, hp: { current: 1, max: 1 }, portrait: '/p.png', class: null, inventory: [], rank: null };

  it('keeps a hotlist mark and a spell that only carry a ref', () => {
    const crawler = normalizeCrawler({
      ...base,
      hotlist: [{ ref: 'heal' }],
      spells: [{ ref: 'heal', rank: 1 }],
    } as never);
    expect(crawler.hotlist).toEqual([{ ref: 'heal' }]);
    expect(crawler.spells).toEqual([{ ref: 'heal', rank: 1 }]);
  });

  it('drops the whole list when an entry has neither a name nor a ref', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const crawler = normalizeCrawler({ ...base, spells: [{ rank: 1 }] } as never);
    expect(crawler.spells).toBeUndefined();
    warn.mockRestore();
  });

  it('gives inventory no ref of its own - there is no item registry', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const crawler = normalizeCrawler({ ...base, inventory: [{ ref: 'heal' }] } as never);
    expect(crawler.inventory).toEqual([]);
    warn.mockRestore();
  });
});

describe('normalizeShow (spellsUrl)', () => {
  it('preserves a string spellsUrl', () => {
    expect(normalizeShow({ ...makeShow(), spellsUrl: '/data/spells.json' }).spellsUrl).toBe(
      '/data/spells.json',
    );
  });

  it('drops a spellsUrl that is not a string, with a warning, keeping registryUrl', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const show = normalizeShow({ ...makeShow(), spellsUrl: 7 });
    expect(show.spellsUrl).toBeUndefined();
    expect(show.registryUrl).toBe('/data/npcs.json');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('leaves a show with no spellsUrl alone', () => {
    const { spellsUrl: _spellsUrl, ...noSpells } = makeShow();
    expect(normalizeShow(noSpells).spellsUrl).toBeUndefined();
  });
});

describe('validateSpells', () => {
  it('guards the envelope', () => {
    expect(isSpellRegistry({ spells: [] })).toBe(true);
    expect(isSpellRegistry({})).toBe(false);
    expect(() => validateSpells({})).toThrow(DataError);
  });

  it('keeps a whole registry unchanged', () => {
    expect(validateSpells(makeSpells())).toEqual(makeSpells());
  });

  it('drops a spell missing something the UI cannot invent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { spells } = validateSpells({
      spells: [
        { id: 'ok', name: 'Ok', kind: 'passive', manaCost: 0, description: 'x', upgrades: [] },
        { id: 'no-kind', name: 'No Kind', manaCost: 1, description: 'x', upgrades: [] },
        { id: 'Bad Id', name: 'Bad', kind: 'attack', manaCost: 1, description: 'x', upgrades: [] },
        { id: 'no-desc', name: 'No Desc', kind: 'attack', manaCost: 1, upgrades: [] },
      ],
    });
    expect(spells.map((spell) => spell.id)).toEqual(['ok']);
    warn.mockRestore();
  });

  it('keeps the first of two spells sharing an id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { spells } = validateSpells({
      spells: [
        { id: 'heal', name: 'Heal', kind: 'passive', manaCost: 2, description: 'a', upgrades: [] },
        { id: 'heal', name: 'Other', kind: 'attack', manaCost: 9, description: 'b', upgrades: [] },
      ],
    });
    expect(spells).toHaveLength(1);
    expect(spells[0].name).toBe('Heal');
    warn.mockRestore();
  });

  it('drops a malformed upgrade or roll without costing the spell', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { spells } = validateSpells({
      spells: [
        {
          id: 'heal',
          name: 'Heal',
          kind: 'passive',
          manaCost: 2,
          description: 'a',
          upgrades: [{ rank: 5, text: 'good' }, { rank: 0, text: 'bad rank' }, { rank: 6 }],
          roll: [80, 20],
        },
      ],
    });
    expect(spells[0].upgrades).toEqual([{ rank: 5, text: 'good' }]);
    expect(spells[0].roll).toBeUndefined();
    warn.mockRestore();
  });
});

/* ------------------------------------------------------------ 009: mana */

describe('normalizeEvent - the mana event (009)', () => {
  it('keeps a well-formed reading, with and without a max', () => {
    expect(normalizeEvent({ t: 192, type: 'mana', actor: 'mimi', current: 3, max: 5 })).toEqual({
      t: 192,
      type: 'mana',
      actor: 'mimi',
      current: 3,
      max: 5,
    });
    expect(normalizeEvent({ t: 192, type: 'mana', actor: 'mimi', current: 3 })).toEqual({
      t: 192,
      type: 'mana',
      actor: 'mimi',
      current: 3,
    });
  });

  it('reads a missing max the same as an absent one, and coerces numeric strings', () => {
    expect(normalizeEvent({ t: 1, type: 'mana', actor: 'mimi', current: '3', max: null })).toEqual({
      t: 1,
      type: 'mana',
      actor: 'mimi',
      current: 3,
    });
  });

  it('demotes a reading with no actor or no current', () => {
    expect(normalizeEvent({ t: 1, type: 'mana', current: 3, max: 5 }).type).toBe('unknown');
    expect(normalizeEvent({ t: 1, type: 'mana', actor: 'mimi', max: 5 }).type).toBe('unknown');
    expect(normalizeEvent({ t: 1, type: 'mana', actor: 'mimi', current: 'lots' }).type).toBe(
      'unknown',
    );
  });

  it('rejects a negative reading and a max that is not a pool', () => {
    expect(normalizeEvent({ t: 1, type: 'mana', actor: 'mimi', current: -1 }).type).toBe('unknown');
    expect(normalizeEvent({ t: 1, type: 'mana', actor: 'mimi', current: 1, max: 0 }).type).toBe(
      'unknown',
    );
    expect(normalizeEvent({ t: 1, type: 'mana', actor: 'mimi', current: 1, max: -3 }).type).toBe(
      'unknown',
    );
  });

  // The clamp is the reducer's job, exactly as it is for `hp`: a sheet that
  // over-reads the pool is still a reading, not a malformed row.
  it('keeps a current above max and leaves the clamp to the reducer', () => {
    expect(normalizeEvent({ t: 1, type: 'mana', actor: 'mimi', current: 9, max: 5 })).toEqual({
      t: 1,
      type: 'mana',
      actor: 'mimi',
      current: 9,
      max: 5,
    });
  });
});

describe('normalizeCrawler - the mana box (009)', () => {
  const base = {
    id: 'mimi',
    name: 'Mimi Rivers',
    handle: 'Mimi',
    player: 'Lulu',
    level: 1,
    hp: { current: 18, max: 18 },
    portrait: '/img/crawlers/mimi.svg',
    class: null,
    inventory: [],
    rank: null,
  };

  it('keeps a well-formed box', () => {
    expect(normalizeCrawler({ ...base, mana: { current: 3, max: 5 } } as never).mana).toEqual({
      current: 3,
      max: 5,
    });
  });

  it('drops a malformed or negative box so the derivation rule applies', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(normalizeCrawler({ ...base, mana: { current: -1, max: 5 } } as never).mana).toBeUndefined();
    expect(normalizeCrawler({ ...base, mana: { current: 1, max: -5 } } as never).mana).toBeUndefined();
    expect(normalizeCrawler({ ...base, mana: 5 } as never).mana).toBeUndefined();
    expect(normalizeCrawler({ ...base, mana: { current: 1 } } as never).mana).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('allows an empty pool, which is not the same as a missing box', () => {
    expect(normalizeCrawler({ ...base, mana: { current: 0, max: 0 } } as never).mana).toEqual({
      current: 0,
      max: 0,
    });
  });
});

/* ------------------------------------------------- front door (011) */

describe('validateCrawlers', () => {
  it('keeps a well-formed roster verbatim', () => {
    const roster = makeCrawlers();
    expect(validateCrawlers(roster)).toEqual(roster);
  });

  it("carries the author's todo list through, dropping empty entries", () => {
    const roster = validateCrawlers({ ...makeCrawlers(), todo: ['Names', '', 7, 'Bios'] });
    expect(roster.todo).toEqual(['Names', 'Bios']);
  });

  it('drops a crawler missing something no page can invent, and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const roster = makeCrawlers();
    const broken = {
      crawlers: [
        roster.crawlers[0],
        { ...roster.crawlers[1], art: {} },
        { ...roster.crawlers[1], id: 'nameless', name: '' },
        { ...roster.crawlers[1], id: 'unplayed', player: {} },
      ],
    };
    expect(validateCrawlers(broken).crawlers.map((c) => c.id)).toEqual(['stuntman']);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  /* 012: a `status` field is not a reason to drop anyone, and not read either. */
  it('ignores a leftover status field rather than honouring it', () => {
    const [first] = makeCrawlers().crawlers;
    const roster = validateCrawlers({ crawlers: [{ ...first, status: 'dead' }] });
    expect(roster.crawlers).toHaveLength(1);
    expect(roster.crawlers[0]).not.toHaveProperty('status');
  });

  it('drops a duplicate id, keeping the first', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [first, second] = makeCrawlers().crawlers;
    const roster = validateCrawlers({
      crawlers: [first, { ...second, id: 'stuntman', name: 'Impostor' }],
    });
    expect(roster.crawlers).toHaveLength(1);
    expect(roster.crawlers[0].name).toBe('The Stuntman');
    warn.mockRestore();
  });

  it('never throws on rubbish: an empty roster instead', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateCrawlers(null)).toEqual({ crawlers: [] });
    expect(validateCrawlers('nope')).toEqual({ crawlers: [] });
    expect(validateCrawlers({ crawlers: {} })).toEqual({ crawlers: [] });
    warn.mockRestore();
  });

  it('drops a malformed player link but keeps the player', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [first] = makeCrawlers().crawlers;
    const roster = validateCrawlers({
      crawlers: [{ ...first, player: { ...first.player, links: { bluesky: 'x', broken: null } } }],
    });
    expect(roster.crawlers[0].player.links).toEqual({ bluesky: 'x' });
    warn.mockRestore();
  });

  it('drops an entry achievement with no text, keeping the crawler', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [first] = makeCrawlers().crawlers;
    const roster = validateCrawlers({
      crawlers: [{ ...first, entryAchievement: { title: 'Method Acting' } }],
    });
    expect(roster.crawlers).toHaveLength(1);
    expect(roster.crawlers[0].entryAchievement).toBeUndefined();
    warn.mockRestore();
  });
});

describe('validateStatus', () => {
  it('keeps a well-formed status file verbatim', () => {
    const status = makeStatus();
    expect(validateStatus(status)).toEqual(status);
  });

  it('drops a malformed crawler entry and warns, keeping the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const status = validateStatus({
      generatedAt: '2026-09-01T00:00:00.000Z',
      episodeId: 2,
      crawlers: {
        harry: { level: 2, hp: { current: 22, max: 22 }, floor: 1, lastEpisodeId: 2 },
        mimi: { level: 2, floor: 1, lastEpisodeId: 2 },
      },
    });
    expect(Object.keys(status?.crawlers ?? {})).toEqual(['harry']);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('accepts a file generated before any episode was published', () => {
    expect(validateStatus({ generatedAt: 'x', episodeId: null, crawlers: {} })).toEqual({
      generatedAt: 'x',
      episodeId: null,
      crawlers: {},
    });
  });

  it('keeps the precomputed appearances, dropping anything that is not a list of ids', () => {
    const status = validateStatus({
      generatedAt: 'x',
      episodeId: 3,
      crawlers: {},
      appearances: { harry: [1, 2, 3], mimi: [1, 'two', 3], veil: 'nope' },
    });
    expect(status?.appearances).toEqual({ harry: [1, 2, 3], mimi: [1, 3] });
  });

  it('leaves appearances undefined for a file that carries none', () => {
    const status = validateStatus({ generatedAt: 'x', episodeId: null, crawlers: {} });
    // Undefined, not empty: it is what tells the crawler page to derive them.
    expect(status).not.toHaveProperty('appearances');
  });

  it('never throws: null for a file that is not a status file', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateStatus(null)).toBeNull();
    expect(validateStatus({ crawlers: [] })).toBeNull();
    warn.mockRestore();
  });
});

/* --------------------------------------------- 012: the compiled dossier */

describe('validateDossier', () => {
  it('keeps a well-formed file verbatim', () => {
    const dossier = makeDossier('harry');
    expect(validateDossier(dossier)).toEqual(dossier);
  });

  it('sorts ascending rather than trusting the order on disk', () => {
    const dossier = makeDossier('harry');
    const shuffled = { ...dossier, updates: [dossier.updates[2], dossier.updates[0]] };
    expect(validateDossier(shuffled)?.updates.map((u) => u.episode)).toEqual([1, 3]);
  });

  it('drops a card it cannot render and warns, keeping the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dossier = makeDossier('harry');
    const file = validateDossier({
      ...dossier,
      updates: [dossier.updates[0], { ...dossier.updates[1], kind: 'rumour' }],
    });
    expect(file?.updates.map((u) => u.episode)).toEqual([1]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('refuses a card with no onCamera flag: the strip would guess', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dossier = makeDossier('harry');
    const { onCamera: _dropped, ...withoutFlag } = dossier.updates[0];
    expect(validateDossier({ ...dossier, updates: [withoutFlag] })?.updates).toEqual([]);
    warn.mockRestore();
  });

  it('refuses a condition it does not know, rather than assuming alive', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dossier = makeDossier('harry');
    const file = validateDossier({
      ...dossier,
      updates: [{ ...dossier.updates[0], condition: 'missing' }],
    });
    expect(file?.updates).toEqual([]);
    warn.mockRestore();
  });

  it('never throws: null for a file that is not a dossier', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateDossier(null)).toBeNull();
    expect(validateDossier({ id: 'harry' })).toBeNull();
    warn.mockRestore();
  });
});
