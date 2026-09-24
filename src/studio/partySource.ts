/**
 * Where a new episode's party comes from (010, FR-1011).
 *
 * Two sources, both reading a published episode file:
 *  - `partyFromInitial` copies the party that episode *started* with, verbatim.
 *  - `partyFromFinalState` runs the viewer's reducer over the whole log and
 *    turns the resulting `CrawlerState` back into a sheet, so episode N + 1
 *    starts where episode N ended.
 *
 * The state -> sheet mapping is lossy in exactly one direction, and only where
 * the crawler schema has no room:
 *  - kept: id, name, handle, player, level, portrait, class, rank, race,
 *    pronouns, crawlerNumber, stats, art, hp, mana, inventory, hotlist, skills,
 *    spells, gear. Structured entries keep their `qty` / `desc`, and a `ref`
 *    into the spell registry is preserved rather than resolved.
 *  - dropped: `statuses` and `achievements`. A `Crawler` has no field for
 *    either (the initial-state schema has no status), and both are derived from
 *    the previous episode's log, so carrying them would be state the next
 *    episode's events could not have produced (constitution I).
 */
import type { Crawler, Gear, HotlistEntry, InventoryEntry } from '../data/types';
import { normalizeEpisode } from '../data/validate';
import { reduceTo } from '../engine/reducer';
import type { CrawlerState, GearState } from '../engine/state';
import type { StudioRegistries } from './options';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** JSON deep copy: a draft must never alias the file it was seeded from. */
function clone<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

/** The party at t = 0, exactly as the file wrote it. Empty when there is none. */
export function partyFromInitial(episodeRaw: unknown): unknown[] {
  if (!isRecord(episodeRaw) || !isRecord(episodeRaw.initialState)) return [];
  const party = episodeRaw.initialState.party;
  if (!Array.isArray(party)) return [];
  return clone(party as unknown[]);
}

/** `{ name }` writes the string shorthand; anything richer stays an object. */
function entryToRaw<T extends { name?: string; ref?: string; qty?: number; desc?: string }>(
  entry: T,
): string | T {
  const keys = Object.keys(entry).filter((key) => entry[key as keyof T] !== undefined);
  if (keys.length === 1 && keys[0] === 'name' && entry.name !== undefined) return entry.name;
  const out: Record<string, unknown> = {};
  if (entry.name !== undefined) out.name = entry.name;
  if (entry.ref !== undefined) out.ref = entry.ref;
  if (entry.qty !== undefined) out.qty = entry.qty;
  if (entry.desc !== undefined) out.desc = entry.desc;
  return out as T;
}

/** Worn gear as the sheet writes it; `undefined` when nothing is worn. */
function gearToRaw(gear: GearState): Gear | undefined {
  const out: Gear = {};
  for (const slot of ['head', 'torso', 'arms', 'hands', 'legs', 'feet'] as const) {
    const item = gear[slot];
    if (item !== null) out[slot] = item;
  }
  if (gear.accessories.length > 0) out.accessories = [...gear.accessories];
  return Object.keys(out).length === 0 ? undefined : out;
}

/** One crawler's state as a fresh sheet. See the module note for what is lost. */
export function crawlerFromState(state: CrawlerState): Crawler {
  const {
    statuses: _statuses,
    achievements: _achievements,
    hp,
    mana,
    inventory,
    hotlist,
    skills,
    spells,
    gear,
    ...sheet
  } = state;

  const gearRaw = gearToRaw(gear);
  return {
    ...sheet,
    hp: { ...hp },
    // A crawler with no pool writes no box: `manaFrom` derives the same 0/0.
    ...(mana.max > 0 ? { mana: { ...mana } } : {}),
    inventory: inventory.map((entry) => entryToRaw<InventoryEntry>(entry)),
    ...(hotlist.length === 0 ? {} : { hotlist: hotlist.map((entry) => entryToRaw<HotlistEntry>(entry)) }),
    ...(skills.length === 0 ? {} : { skills: skills.map((skill) => ({ ...skill })) }),
    ...(spells.length === 0 ? {} : { spells: spells.map((spell) => ({ ...spell })) }),
    ...(gearRaw === undefined ? {} : { gear: gearRaw }),
  };
}

/**
 * The party as it stands after the whole episode. Empty when the file cannot
 * be normalized - a source episode has to be valid before it can seed another.
 *
 * `registries` is part of the plan's signature and is deliberately unused: a
 * `ref` is copied through rather than resolved, so no registry is needed to
 * produce a faithful sheet.
 */
export function partyFromFinalState(
  episodeRaw: unknown,
  _registries?: StudioRegistries,
): Crawler[] {
  let final;
  try {
    const episode = normalizeEpisode(episodeRaw);
    final = reduceTo(episode, Number.POSITIVE_INFINITY);
  } catch {
    return [];
  }
  return final.party.map((crawler) => clone(crawlerFromState(crawler)));
}
