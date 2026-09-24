import { describe, expect, it } from 'vitest';
import type { EventType } from '../data/types';
import { KNOWN_EVENT_TYPES } from '../data/types';
import { normalizeEvent } from '../data/validate';
import { buildEvent, eventToValues } from './buildEvent';
import type { FieldValues } from './eventForms';
import { EVENT_FORMS } from './eventForms';

/** The least a type needs for `normalizeEvent` to keep it. */
const REQUIRED: Record<EventType, FieldValues> = {
  system_message: { text: 'The broadcast is live.' },
  note: { text: 'The System declines to comment.' },
  chapter: { label: 'The Hoarder Fight', kind: 'boss' },
  sponsor: { text: 'Brought to you by Grull Industries.', durationSec: 20 },
  hp: { actor: 'harry', current: 4, max: 22 },
  mana: { actor: 'psychic', current: 2 },
  level_up: { actor: 'xo', level: 2 },
  rank: { actor: 'harry', rank: 4188 },
  achievement: { actor: 'harry', title: 'Gate Crasher' },
  class: { actor: 'harry', class: 'Compensated Anarchist' },
  status: { actor: 'psychic', add: [], remove: [] },
  loot: { actor: 'harry', item: 'Enchanted Crowbar' },
  inventory: { actor: 'harry', add: [], remove: [] },
  equip: { actor: 'harry', slot: 'hands', item: 'Enchanted Crowbar' },
  unequip: { actor: 'harry', slot: 'hands' },
  skill: { actor: 'xo', name: 'Tail Whip' },
  spell: { actor: 'psychic', name: 'Second Sight' },
  hotlist: { actor: 'harry', add: [], remove: [] },
  map_reveal: { cells: [[3, 2]] },
  npc: { id: 'hoarder', action: 'met' },
};

/** Every field the table declares, filled. */
const FULL: Record<EventType, FieldValues> = {
  system_message: { text: 'The broadcast is live.' },
  note: { text: 'The System declines to comment.' },
  chapter: { label: 'The Hoarder Fight', kind: 'boss' },
  sponsor: { text: 'Brought to you by Grull Industries.', durationSec: 20 },
  hp: { actor: 'harry', current: 4, max: 22 },
  mana: { actor: 'psychic', current: 2, max: 5 },
  level_up: { actor: 'xo', level: 2 },
  rank: { actor: 'harry', rank: 4188 },
  achievement: { actor: 'harry', title: 'Gate Crasher', desc: 'Ten mobs, one door.' },
  class: { actor: 'harry', class: 'Compensated Anarchist' },
  status: { actor: 'psychic', add: ['Poisoned'], remove: ['Bleeding'] },
  loot: { actor: 'harry', item: 'Enchanted Crowbar', source: 'Bronze Box' },
  inventory: { actor: 'harry', add: ['Torch'], remove: ['Enchanted Crowbar'] },
  equip: { actor: 'harry', slot: 'accessory', item: 'Lucky Rabbit Foot' },
  unequip: { actor: 'harry', slot: 'accessory', item: 'Lucky Rabbit Foot' },
  skill: { actor: 'xo', name: 'Tail Whip', rank: 4, desc: 'Sweeps the room.' },
  spell: {
    actor: 'psychic',
    ref: 'second-sight',
    name: 'Second Sight',
    rank: 2,
    mana: 3,
    desc: 'Read the room one beat before it happens.',
  },
  hotlist: { actor: 'harry', add: ['The Hoarder'], remove: ['Door'] },
  map_reveal: {
    cells: [
      [3, 2],
      [4, 2],
    ],
    label: 'The Meat District',
  },
  npc: {
    id: 'hoarder',
    action: 'update',
    note: 'It cannot see red.',
    unlock: ['lair', 'weakness'],
    actor: 'harry',
  },
};

describe('buildEvent', () => {
  it('builds every type from its required fields alone', () => {
    for (const type of KNOWN_EVENT_TYPES) {
      const event = buildEvent(type, 42, REQUIRED[type]);
      expect(event.t).toBe(42);
      expect(event.type).toBe(type);
      expect(normalizeEvent(event).type, `${type} required-only`).toBe(type);
    }
  });

  it('builds every type with every field filled', () => {
    for (const type of KNOWN_EVENT_TYPES) {
      const event = buildEvent(type, 42, FULL[type]);
      expect(normalizeEvent(event).type, `${type} fully populated`).toBe(type);
      for (const field of EVENT_FORMS[type].fields) {
        expect(event[field.key], `${type}.${field.key} is written`).toBeDefined();
      }
    }
  });

  it('accepts a spell that only points at the registry', () => {
    const event = buildEvent('spell', 10, { actor: 'psychic', ref: 'heal' });
    expect(normalizeEvent(event).type).toBe('spell');
    expect(event.name).toBeUndefined();
  });

  it('omits empty optionals rather than writing blanks', () => {
    const event = buildEvent('loot', 10, { actor: 'harry', item: 'Torch', source: '' });
    expect(Object.keys(event)).toEqual(['t', 'type', 'actor', 'item']);

    const npc = buildEvent('npc', 10, { id: 'hoarder', action: 'met', note: '', unlock: [] });
    expect(Object.keys(npc)).toEqual(['t', 'type', 'id', 'action']);

    const reveal = buildEvent('map_reveal', 10, { cells: [[1, 1]], label: '' });
    expect(Object.keys(reveal)).toEqual(['t', 'type', 'cells']);
  });

  it('keeps required lists even when they are empty', () => {
    const event = buildEvent('status', 10, { actor: 'psychic' });
    expect(event).toEqual({ t: 10, type: 'status', actor: 'psychic', add: [], remove: [] });
  });

  it('writes numbers as numbers, whatever the input gave back', () => {
    const event = buildEvent('hp', 10, { actor: 'harry', current: '4', max: '22' });
    expect(event.current).toBe(4);
    expect(event.max).toBe(22);
    expect(normalizeEvent(event).type).toBe('hp');
  });

  it('drops a number that is not one', () => {
    const event = buildEvent('skill', 10, { actor: 'xo', name: 'Tail Whip', rank: 'soon' });
    expect(event.rank).toBeUndefined();
    expect(normalizeEvent(event).type).toBe('skill');
  });

  it('writes fields in table order, after t, type', () => {
    expect(Object.keys(buildEvent('spell', 10, FULL.spell))).toEqual([
      't',
      'type',
      'actor',
      'ref',
      'name',
      'rank',
      'mana',
      'desc',
    ]);
  });
});

describe('eventToValues', () => {
  it('is the inverse of buildEvent for every type, required-only and full', () => {
    for (const type of KNOWN_EVENT_TYPES) {
      expect(eventToValues(buildEvent(type, 42, REQUIRED[type])), `${type} required`).toEqual(
        REQUIRED[type],
      );
      expect(eventToValues(buildEvent(type, 42, FULL[type])), `${type} full`).toEqual(FULL[type]);
    }
  });

  it('leaves t and type to the form', () => {
    const values = eventToValues(buildEvent('note', 42, { text: 'x' }));
    expect(values.t).toBeUndefined();
    expect(values.type).toBeUndefined();
  });

  it('hands back a future schema event verbatim', () => {
    expect(eventToValues({ t: 10, type: 'future_type', headline: 'later', tier: 3 })).toEqual({
      headline: 'later',
      tier: 3,
    });
  });

  it('ignores fields the type does not declare', () => {
    expect(eventToValues({ t: 10, type: 'note', text: 'x', stray: 1 })).toEqual({ text: 'x' });
  });
});
