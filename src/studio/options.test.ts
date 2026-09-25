import { describe, expect, it } from 'vitest';
import { makeEpisodeRaw, makeRegistry, makeSpells } from '../test/fixtures';
import type { DraftMeta } from './draft';
import { draftFromEpisode, newDraft } from './draft';
import { EVENT_FORMS } from './eventForms';
import {
  actorOptions,
  chapterKindOptions,
  crawlerAt,
  episodeAt,
  factOptions,
  npcActionOptions,
  npcOptions,
  optionsFor,
  removableEntries,
  roomOptions,
  slotOptions,
  spellOptions,
  stateAt,
} from './options';
import type { StudioRegistries } from './options';

const META: DraftMeta = {
  id: 1,
  title: 'Episode 1',
  youtubeId: 'aqz-KE-bpKQ',
  floor: 1,
  durationSec: 240,
};

const draft = draftFromEpisode(META, makeEpisodeRaw());
const registries: StudioRegistries = { npcs: makeRegistry(), spells: makeSpells() };

describe('episodeAt / stateAt', () => {
  it('normalizes the draft and reduces it with the viewer reducer', () => {
    const episode = episodeAt(draft);
    expect(episode?.episodeId).toBe(1);
    const state = stateAt(draft, 46);
    expect(crawlerAt(state, 'harry')?.hp).toEqual({ current: 2, max: 10 });
    expect(crawlerAt(stateAt(draft, 44), 'harry')?.hp).toEqual({ current: 10, max: 10 });
  });

  it('returns null rather than throwing on a draft that cannot normalize', () => {
    const empty = newDraft(META);
    expect(episodeAt(empty)).toBeNull();
    expect(stateAt(empty, 100)).toBeNull();
    expect(crawlerAt(null, 'harry')).toBeNull();
    expect(crawlerAt(stateAt(draft, 10), undefined)).toBeNull();
    expect(crawlerAt(stateAt(draft, 10), 'nobody')).toBeNull();
  });

  it('never throws on a wholly malformed initial state', () => {
    const broken = newDraft(META, 'not an object');
    expect(stateAt(broken, 10)).toBeNull();
    expect(actorOptions(broken)).toEqual([]);
  });
});

describe('actorOptions', () => {
  it('reads the raw party, so it works before the draft normalizes', () => {
    expect(actorOptions(draft).map((option) => option.value)).toEqual([
      'stuntman',
      'psychic',
      'harry',
      'xo',
      'actress',
    ]);
    expect(actorOptions(draft)[2]).toEqual({ value: 'harry', label: 'Harry', hint: 'Harry' });
  });

  it('skips crawlers with no id', () => {
    const partial = newDraft(META, { party: [{ name: 'nameless' }, { id: 'ok' }] });
    expect(actorOptions(partial).map((option) => option.value)).toEqual(['ok']);
  });
});

describe('roomOptions', () => {
  it('lists the distinct neighborhoods the draft already names', () => {
    expect(roomOptions(draft).map((option) => option.value)).toEqual([
      'The Meat District',
      'The Rot Market',
    ]);
  });

  it('is empty for a draft with no labeled reveals', () => {
    expect(roomOptions(newDraft(META))).toEqual([]);
  });
});

describe('registry options', () => {
  it('lists spells and entities', () => {
    const spells = spellOptions(registries);
    expect(spells.length).toBeGreaterThan(0);
    expect(spells[0].value).toMatch(/^[a-z0-9-]+$/);
    expect(spells[0].hint).toMatch(/mana/);

    const npcs = npcOptions(registries);
    expect(npcs.map((option) => option.value)).toContain('hoarder');
  });

  it('lists the chosen entity facts, and nothing for an unknown one', () => {
    expect(factOptions(registries, 'hoarder').map((option) => option.value)).toEqual([
      'lair',
      'weakness',
    ]);
    expect(factOptions(registries, 'unknown-id')).toEqual([]);
    expect(factOptions(registries)).toEqual([]);
  });

  it('is empty when no registry is loaded', () => {
    expect(spellOptions()).toEqual([]);
    expect(npcOptions({ npcs: null })).toEqual([]);
    expect(factOptions({}, 'hoarder')).toEqual([]);
  });
});

describe('fixed lists', () => {
  it('offers exactly the schema values', () => {
    expect(slotOptions().map((option) => option.value)).toEqual([
      'head',
      'torso',
      'arms',
      'hands',
      'legs',
      'feet',
      'accessory',
    ]);
    expect(chapterKindOptions().map((option) => option.value)).toEqual([
      'boss',
      'loot',
      'achievement',
      'levelup',
      'story',
    ]);
    expect(npcActionOptions().map((option) => option.value)).toEqual([
      'met',
      'seen',
      'update',
      'defeated',
    ]);
  });
});

describe('removableEntries', () => {
  it('lists the inventory the actor holds at that second', () => {
    // Harry loots the crowbar at 30 and swaps it for a torch at 150.
    expect(removableEntries(stateAt(draft, 100), 'harry', 'inventory').map((o) => o.value)).toContain(
      'Enchanted Crowbar',
    );
    const after = removableEntries(stateAt(draft, 155), 'harry', 'inventory').map((o) => o.value);
    expect(after).toContain('Torch');
    expect(after).not.toContain('Enchanted Crowbar');
  });

  it('lists hotlist marks, with a structured entry named by its name', () => {
    expect(removableEntries(stateAt(draft, 170), 'harry', 'hotlist').map((o) => o.value)).toEqual([
      'Crowbar',
    ]);
    expect(removableEntries(stateAt(draft, 170), 'psychic', 'hotlist')).toEqual([
      { value: 'Mana Draught', label: 'Mana Draught', hint: '×5' },
    ]);
  });

  it('lists standing statuses only while they stand', () => {
    expect(removableEntries(stateAt(draft, 135), 'psychic', 'status').map((o) => o.value)).toEqual([
      'Poisoned',
    ]);
    expect(removableEntries(stateAt(draft, 145), 'psychic', 'status')).toEqual([]);
  });

  it('lists worn gear, slots then accessories', () => {
    const worn = removableEntries(stateAt(draft, 160), 'harry', 'gear');
    expect(worn).toEqual([
      { value: 'Patched Jacket', label: 'Patched Jacket', hint: 'torso' },
      { value: 'Enchanted Crowbar', label: 'Enchanted Crowbar', hint: 'hands' },
      { value: 'Lucky Rabbit Foot', label: 'Lucky Rabbit Foot', hint: 'accessory' },
    ]);
    // Unequipped at 168, torch on at 169.
    expect(removableEntries(stateAt(draft, 170), 'harry', 'gear').map((o) => o.value)).toEqual([
      'Patched Jacket',
      'Torch',
      'Lucky Rabbit Foot',
    ]);
  });

  it('is empty for an unknown actor or no state', () => {
    expect(removableEntries(stateAt(draft, 100), 'nobody', 'inventory')).toEqual([]);
    expect(removableEntries(null, 'harry', 'inventory')).toEqual([]);
  });
});

describe('optionsFor', () => {
  const state = stateAt(draft, 160);

  it('routes each field kind to its source', () => {
    const ctx = { draft, registries, state, actorId: 'harry', npcId: 'hoarder' };
    const find = (type: keyof typeof EVENT_FORMS, key: string) => {
      const field = EVENT_FORMS[type].fields.find((f) => f.key === key);
      if (field === undefined) throw new Error(`no ${type}.${key}`);
      return optionsFor(field, ctx);
    };

    expect(find('hp', 'actor').map((o) => o.value)).toContain('harry');
    expect(find('spell', 'ref').length).toBeGreaterThan(0);
    expect(find('npc', 'id').map((o) => o.value)).toContain('hoarder');
    expect(find('npc', 'unlock').map((o) => o.value)).toEqual(['lair', 'weakness']);
    expect(find('npc', 'action').map((o) => o.value)).toEqual(['met', 'seen', 'update', 'defeated']);
    expect(find('equip', 'slot').map((o) => o.value)).toContain('accessory');
    expect(find('chapter', 'kind').map((o) => o.value)).toContain('boss');
    expect(find('map_reveal', 'label').map((o) => o.value)).toContain('The Rot Market');
    expect(find('inventory', 'remove').map((o) => o.value)).toContain('Torch');
    expect(find('unequip', 'item').map((o) => o.value)).toContain('Lucky Rabbit Foot');
  });

  it('offers nothing for free-text and numeric fields', () => {
    const ctx = { draft, registries, state, actorId: 'harry' };
    const field = (type: keyof typeof EVENT_FORMS, key: string) => {
      const found = EVENT_FORMS[type].fields.find((f) => f.key === key);
      if (found === undefined) throw new Error(`no ${type}.${key}`);
      return found;
    };
    expect(optionsFor(field('loot', 'item'), ctx)).toEqual([]);
    expect(optionsFor(field('hp', 'current'), ctx)).toEqual([]);
    expect(optionsFor(field('note', 'text'), ctx)).toEqual([]);
    expect(optionsFor(field('inventory', 'add'), ctx)).toEqual([]);
  });

  it('never throws for any field of any type', () => {
    for (const form of Object.values(EVENT_FORMS)) {
      for (const field of form.fields) {
        expect(Array.isArray(optionsFor(field, { draft }))).toBe(true);
      }
    }
  });
});
