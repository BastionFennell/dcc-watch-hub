import { describe, expect, it } from 'vitest';
import { makeSpells } from '../test/fixtures';
import {
  NO_SPELLS,
  entryKey,
  resolveHotlist,
  resolveSpell,
  spellIndex,
  spellTags,
} from './spells';

const registry = spellIndex(makeSpells());

describe('spellIndex', () => {
  it('keys every spell by id, keeping the first of a duplicate', () => {
    expect([...registry.keys()]).toEqual(['mending-light', 'cinder-snap']);
    const dupes = spellIndex({
      spells: [
        { id: 'a', name: 'First', kind: 'passive', manaCost: 1, description: 'x', upgrades: [] },
        { id: 'a', name: 'Second', kind: 'attack', manaCost: 2, description: 'y', upgrades: [] },
      ],
    });
    expect(dupes.get('a')?.name).toBe('First');
  });

  it('reads a missing registry as an empty one', () => {
    expect(spellIndex(null).size).toBe(0);
    expect(spellIndex(undefined)).toBe(NO_SPELLS);
  });
});

describe('entryKey', () => {
  it('prefers the registry id, then the sheet name', () => {
    expect(entryKey({ ref: 'heal', name: 'Heal' })).toBe('heal');
    expect(entryKey({ name: 'Heal' })).toBe('Heal');
    expect(entryKey({})).toBe('');
  });
});

describe('spellTags', () => {
  it("reads the book's type line back out, in the book's order", () => {
    expect(spellTags(makeSpells().spells[0])).toEqual(['Interrupt', 'Passive']);
    expect(spellTags(makeSpells().spells[1])).toEqual(['Attack', 'Fire', 'Area of Effect']);
  });
});

describe('resolveSpell', () => {
  it('inherits name, cost and the whole entry from the registry', () => {
    expect(resolveSpell({ ref: 'mending-light', rank: 1 }, registry)).toEqual({
      id: 'mending-light',
      name: 'Mending Light',
      rank: 1,
      mana: 2,
      kind: 'passive',
      tags: ['Interrupt', 'Passive'],
      range: 'Self only',
      duration: '5 seconds',
      limitations: 'Rank 1 maximum',
      cooldown: '10 minutes',
      description: 'Heal 2 HB slots.',
      upgrades: [{ rank: 5, text: 'Heal 3 HB slots instead.' }],
      quote: 'Still breathing. Impressive.',
    });
  });

  it("lets the entry override the book's mana cost and text", () => {
    const view = resolveSpell(
      { ref: 'mending-light', rank: 2, mana: 9, desc: 'A scroll copy, half as strong.' },
      registry,
    );
    expect(view.mana).toBe(9);
    expect(view.description).toBe('A scroll copy, half as strong.');
    // Everything the entry did not restate still comes from the book.
    expect(view.range).toBe('Self only');
    expect(view.upgrades).toHaveLength(1);
  });

  it("keeps the sheet's own name when the entry carries both", () => {
    expect(resolveSpell({ ref: 'mending-light', name: "Mimi's Mend" }, registry).name).toBe(
      "Mimi's Mend",
    );
  });

  it('falls back to the entry for a ref the registry does not carry', () => {
    const view = resolveSpell({ ref: 'no-such-spell', rank: 3 }, registry);
    expect(view).toEqual({
      name: 'no-such-spell',
      rank: 3,
      tags: [],
      description: '',
      upgrades: [],
    });
    expect(view.id).toBeUndefined();
  });

  it('leaves a plain sheet entry exactly as it was before revision 4', () => {
    expect(resolveSpell({ name: 'Second Sight', rank: 2, mana: 3, desc: 'One beat early.' })).toEqual(
      {
        name: 'Second Sight',
        rank: 2,
        mana: 3,
        tags: [],
        description: 'One beat early.',
        upgrades: [],
      },
    );
  });

  it("carries an attack's damage and an empty upgrades block", () => {
    const view = resolveSpell({ ref: 'cinder-snap' }, registry);
    expect(view.baseDamage).toBe('1d4 + Int Fire');
    expect(view.aiFavor).toBe(1);
    expect(view.upgrades).toEqual([]);
    expect(view.duration).toBeUndefined();
  });
});

describe('resolveHotlist', () => {
  it('names a ref mark from the registry and carries the spell behind it', () => {
    const view = resolveHotlist({ ref: 'mending-light' }, registry);
    expect(view.name).toBe('Mending Light');
    expect(view.desc).toBe('Heal 2 HB slots.');
    expect(view.spell?.id).toBe('mending-light');
    expect(view.spell?.tags).toEqual(['Interrupt', 'Passive']);
    expect(view.spell?.mana).toBe(2);
  });

  it('keeps a plain mark - name, quantity and text - and gives it no spell', () => {
    const view = resolveHotlist({ name: 'Standard Mana Potion', qty: 5, desc: 'Drink it.' });
    expect(view).toEqual({ name: 'Standard Mana Potion', qty: 5, desc: 'Drink it.' });
    expect(view.spell).toBeUndefined();
  });

  it("lets a mark override the book's text while keeping its fields", () => {
    const view = resolveHotlist({ ref: 'mending-light', desc: "Mimi's own note." }, registry);
    expect(view.desc).toBe("Mimi's own note.");
    expect(view.spell?.description).toBe("Mimi's own note.");
    expect(view.spell?.range).toBe('Self only');
  });

  it('falls back to the ref as a name when the registry does not carry it', () => {
    expect(resolveHotlist({ ref: 'no-such-spell' }, registry)).toEqual({ name: 'no-such-spell' });
  });
});
