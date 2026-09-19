/**
 * Spell resolution (008 revision 4).
 *
 * A crawler sheet used to restate the book's Heal text on every crawler who had
 * it. Since revision 4 a sheet entry may instead carry `ref`, a `SpellDef.id`,
 * and inherit the book's name, cost and prose from `public/data/spells.json`.
 * This module is the one place that join happens, so the reducer, the selectors
 * and the UI all read the same resolved view.
 *
 * Framework-free (constitution I/IV): no React, no DOM, no fetch.
 */
import type { HotlistEntry, SpellDef, SpellEntry, SpellRegistry, SpellUpgrade } from '../data/types';

/** `id → definition`, built once per registry by `spellIndex`. */
export type SpellIndex = ReadonlyMap<string, SpellDef>;

/** The empty registry every caller that has none yet may pass. */
export const NO_SPELLS: SpellIndex = new Map<string, SpellDef>();

/** Index a loaded registry by id; a duplicate id keeps the first row. */
export function spellIndex(registry: SpellRegistry | null | undefined): SpellIndex {
  if (!registry) return NO_SPELLS;
  const index = new Map<string, SpellDef>();
  for (const spell of registry.spells) {
    if (!index.has(spell.id)) index.set(spell.id, spell);
  }
  return index;
}

/**
 * What identifies an entry across a reducer upsert or a hotbar key: the
 * registry id when there is one, else the sheet's own name. Two entries sharing
 * a key are the same spell, whichever half of the pair the author wrote.
 */
export function entryKey(entry: { name?: string; ref?: string }): string {
  return entry.ref ?? entry.name ?? '';
}

/** The record's view of one spell, registry-backed or not. */
export interface SpellView {
  /** The registry id, when the entry resolved to one. */
  id?: string;
  name: string;
  rank?: number;
  mana?: number;
  kind?: SpellDef['kind'];
  /** The type line, already split: "Interrupt", "Attack", "Fire", ... */
  tags: string[];
  range?: string;
  duration?: string;
  aiFavor?: number;
  limitations?: string;
  cooldown?: string;
  /** May be empty: an unresolved entry the sheet never explained. */
  description: string;
  baseDamage?: string;
  upgrades: SpellUpgrade[];
  quote?: string;
}

/** A Hotlist mark as the hotbar draws it, with its spell when it points at one. */
export interface HotlistView {
  name: string;
  qty?: number;
  desc?: string;
  /** Present only when `ref` named a spell the registry carries. */
  spell?: SpellView;
}

/**
 * The book's type line, in reading order: Interrupt first (it qualifies how the
 * Spell is cast), then Attack or Passive, then the damage type and Area of
 * Effect. "Interrupt, Passive" and "Attack, Fire, Area of Effect" both come
 * straight back out.
 */
export function spellTags(def: SpellDef): string[] {
  const tags: string[] = [];
  if (def.interrupt === true) tags.push('Interrupt');
  tags.push(def.kind === 'attack' ? 'Attack' : 'Passive');
  if (def.damageType !== undefined) tags.push(def.damageType);
  if (def.areaOfEffect === true) tags.push('Area of Effect');
  return tags;
}

/**
 * Join one sheet entry to the registry.
 *
 * Precedence is the sheet's: `rank` is always the crawler's, and `mana` / `desc`
 * written on the entry beat the book, so homebrew and scroll-only spells keep
 * working. An entry whose `ref` the registry does not carry falls back to its
 * own fields, and to the ref itself as a name - the page still renders, the
 * converter is where the typo gets reported (spec R4: "a validation warning").
 */
export function resolveSpell(entry: SpellEntry, registry: SpellIndex = NO_SPELLS): SpellView {
  const def = entry.ref === undefined ? undefined : registry.get(entry.ref);
  const name = entry.name ?? def?.name ?? entry.ref ?? '';
  const mana = entry.mana ?? def?.manaCost;
  const description = entry.desc ?? def?.description ?? '';

  if (def === undefined) {
    return {
      name,
      ...(entry.rank === undefined ? {} : { rank: entry.rank }),
      ...(mana === undefined ? {} : { mana }),
      tags: [],
      description,
      upgrades: [],
    };
  }

  return {
    id: def.id,
    name,
    ...(entry.rank === undefined ? {} : { rank: entry.rank }),
    ...(mana === undefined ? {} : { mana }),
    kind: def.kind,
    tags: spellTags(def),
    ...(def.range === undefined ? {} : { range: def.range }),
    ...(def.duration === undefined ? {} : { duration: def.duration }),
    ...(def.aiFavor === undefined ? {} : { aiFavor: def.aiFavor }),
    ...(def.limitations === undefined ? {} : { limitations: def.limitations }),
    ...(def.cooldown === undefined ? {} : { cooldown: def.cooldown }),
    description,
    ...(def.baseDamage === undefined ? {} : { baseDamage: def.baseDamage }),
    upgrades: def.upgrades,
    ...(def.quote === undefined ? {} : { quote: def.quote }),
  };
}

/**
 * The same join for a Hotlist mark. A mark with a `ref` reads the registry for
 * its short name and carries the whole spell for its tooltip; a plain mark is
 * exactly what it was before revision 4.
 */
export function resolveHotlist(
  entry: HotlistEntry,
  registry: SpellIndex = NO_SPELLS,
): HotlistView {
  const def = entry.ref === undefined ? undefined : registry.get(entry.ref);
  const name = entry.name ?? def?.name ?? entry.ref ?? '';
  const desc = entry.desc ?? (def === undefined ? undefined : def.description);
  return {
    name,
    ...(entry.qty === undefined ? {} : { qty: entry.qty }),
    ...(desc === undefined ? {} : { desc }),
    ...(def === undefined
      ? {}
      : { spell: resolveSpell({ ref: entry.ref, ...(entry.desc === undefined ? {} : { desc: entry.desc }) }, registry) }),
  };
}
