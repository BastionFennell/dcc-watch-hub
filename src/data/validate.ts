/**
 * Runtime guards shared by the app loader and the authoring script.
 * Hand-written on purpose: zero runtime dependency (constitution IV).
 * The formal contract lives in specs/001-watch-hub-v1/contracts/*.schema.json.
 */
import type {
  AnyEvent,
  Cell,
  Crawler,
  CrawlerStats,
  Entity,
  EntityFact,
  EntityKind,
  EpisodeData,
  EpisodeMeta,
  Gear,
  GearSlot,
  HotlistEntry,
  Hp,
  InitialState,
  InventoryEntry,
  MapState,
  NpcAction,
  Registry,
  Show,
  SkillEntry,
  SpellDef,
  SpellEntry,
  SpellRegistry,
  SpellUpgrade,
  UnknownEvent,
} from './types';
import {
  ENTITY_KINDS,
  GEAR_SLOTS,
  NPC_ACTIONS,
  SPELL_KINDS,
} from './types';

export class DataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataError';
  }
}

/* ------------------------------------------------------------- primitives */

export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Accepts numbers and numeric strings (editors export everything as text). */
export function toNumber(x: unknown): number | null {
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  if (typeof x === 'string' && x.trim() !== '') {
    const n = Number(x.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function toString_(x: unknown): string | null {
  if (typeof x === 'string') return x;
  if (typeof x === 'number' && Number.isFinite(x)) return String(x);
  return null;
}

/**
 * A `SpellDef.id` on an entry or a row (008 revision 4). Kebab-case only, so a
 * sheet cell holding a display name ("Heal") is never mistaken for a registry
 * id - that is the same test the converter applies to field1.
 */
export const SPELL_REF_RE = /^[a-z0-9-]+$/;

function toSpellRef(x: unknown): string | null {
  const ref = toString_(x);
  return ref !== null && SPELL_REF_RE.test(ref) ? ref : null;
}

function toStringList(x: unknown): string[] | null {
  if (!Array.isArray(x)) return null;
  const out: string[] = [];
  for (const item of x) {
    const s = toString_(item);
    if (s === null) return null;
    out.push(s);
  }
  return out;
}

/** Skill ranks are whole numbers ≥ 0; anything else is dropped, never fatal. */
function toSkillRank(x: unknown): number | null {
  if (x === undefined || x === null) return null;
  const n = toNumber(x);
  if (n === null || !Number.isInteger(n) || n < 0) return null;
  return n;
}

/** Drops anything that is not a non-empty string; never fatal (007, FR-601). */
export function toNonEmptyStringList(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  const out: string[] = [];
  for (const item of x) {
    if (typeof item === 'string' && item !== '') out.push(item);
  }
  return out;
}

/** An `npc` action this version understands, or `null` - never guessed. */
function toNpcAction(x: unknown): NpcAction | null {
  return typeof x === 'string' && (NPC_ACTIONS as readonly string[]).includes(x)
    ? (x as NpcAction)
    : null;
}

/** An entity kind the schema knows, or `null` (007 assumptions: exactly three). */
function toEntityKind(x: unknown): EntityKind | null {
  return typeof x === 'string' && (ENTITY_KINDS as readonly string[]).includes(x)
    ? (x as EntityKind)
    : null;
}

/** A gear slot the schema knows, or `null` - an unknown slot is never guessed. */
function toGearSlot(x: unknown): GearSlot | null {
  return typeof x === 'string' && (GEAR_SLOTS as readonly string[]).includes(x)
    ? (x as GearSlot)
    : null;
}

function toCell(x: unknown): Cell | null {
  if (!Array.isArray(x) || x.length !== 2) return null;
  const r = toNumber(x[0]);
  const c = toNumber(x[1]);
  if (r === null || c === null) return null;
  return [r, c];
}

function toCells(x: unknown): Cell[] | null {
  if (!Array.isArray(x)) return null;
  const out: Cell[] = [];
  for (const item of x) {
    const cell = toCell(item);
    if (cell === null) return null;
    out.push(cell);
  }
  return out;
}

/* ----------------------------------------------------------- normalization */

function unknownEvent(t: number, raw: unknown): UnknownEvent {
  return { type: 'unknown', t, raw };
}

/**
 * Turns one raw JSON object into a well-typed event, or into an `UnknownEvent`
 * the rest of the app silently ignores. Never throws (FR-006).
 */
export function normalizeEvent(raw: unknown): AnyEvent {
  if (!isRecord(raw)) return unknownEvent(0, raw);

  const tRaw = toNumber(raw.t);
  const t = tRaw === null ? 0 : Math.max(0, tRaw);
  if (tRaw === null) return unknownEvent(0, raw);

  const type = typeof raw.type === 'string' ? raw.type : null;
  if (type === null) return unknownEvent(t, raw);

  const actor = typeof raw.actor === 'string' && raw.actor !== '' ? raw.actor : null;

  switch (type) {
    case 'system_message':
    case 'note': {
      const text = toString_(raw.text);
      if (text === null) return unknownEvent(t, raw);
      return { t, type, text };
    }
    case 'achievement': {
      const title = toString_(raw.title);
      if (actor === null || title === null) return unknownEvent(t, raw);
      const desc = toString_(raw.desc);
      return desc === null
        ? { t, type: 'achievement', actor, title }
        : { t, type: 'achievement', actor, title, desc };
    }
    case 'loot': {
      const item = toString_(raw.item);
      if (actor === null || item === null) return unknownEvent(t, raw);
      const source = toString_(raw.source);
      return source === null
        ? { t, type: 'loot', actor, item }
        : { t, type: 'loot', actor, item, source };
    }
    case 'hp': {
      const current = toNumber(raw.current);
      const max = toNumber(raw.max);
      if (actor === null || current === null || max === null || max <= 0) {
        return unknownEvent(t, raw);
      }
      warnIfNotTenSlots(`hp event at t = ${t} for "${actor}"`, max);
      return { t, type: 'hp', actor, current, max };
    }
    /*
     * Mana (009): the `hp` row's shape, with two deliberate differences. `max`
     * is optional - a dip that does not move the pool omits it and the reducer
     * keeps the standing max - and a negative `current` is rejected outright
     * rather than clamped, because a mana pool has no wound to read (spec 009,
     * Acceptance). A `current` above `max` still passes here and is clamped by
     * the reducer, exactly as `hp` does.
     */
    case 'mana': {
      const current = toNumber(raw.current);
      if (actor === null || current === null || current < 0) return unknownEvent(t, raw);
      if (raw.max === undefined || raw.max === null) return { t, type: 'mana', actor, current };
      const max = toNumber(raw.max);
      if (max === null || max <= 0) return unknownEvent(t, raw);
      return { t, type: 'mana', actor, current, max };
    }
    case 'level_up': {
      const level = toNumber(raw.level);
      if (actor === null || level === null) return unknownEvent(t, raw);
      return { t, type: 'level_up', actor, level };
    }
    case 'rank': {
      /*
       * DCC has individual rank only (T334). A legacy `scope: 'crawler'` row is
       * still read - the field is simply dropped - while a legacy party row has
       * no crawler to belong to, so it is demoted to `unknown` and ignored.
       */
      if (raw.scope === 'party') return unknownEvent(t, raw);
      const rank = toNumber(raw.rank);
      if (rank === null || actor === null) return unknownEvent(t, raw);
      return { t, type: 'rank', actor, rank };
    }
    case 'map_reveal': {
      const cells = toCells(raw.cells);
      if (cells === null) return unknownEvent(t, raw);
      const label = toString_(raw.label);
      return label === null
        ? { t, type: 'map_reveal', cells }
        : { t, type: 'map_reveal', cells, label };
    }
    case 'sponsor': {
      const text = toString_(raw.text);
      const durationSec = toNumber(raw.durationSec);
      if (text === null || durationSec === null || durationSec <= 0) {
        return unknownEvent(t, raw);
      }
      return { t, type: 'sponsor', text, durationSec };
    }
    case 'chapter': {
      const label = toString_(raw.label);
      const kind = toString_(raw.kind);
      if (label === null || kind === null) return unknownEvent(t, raw);
      return { t, type: 'chapter', label, kind };
    }
    case 'status':
    case 'inventory': {
      const add = toStringList(raw.add);
      const remove = toStringList(raw.remove);
      if (actor === null || add === null || remove === null) return unknownEvent(t, raw);
      return { t, type, actor, add, remove };
    }
    case 'skill': {
      const name = toString_(raw.name);
      if (actor === null || name === null || name === '') return unknownEvent(t, raw);
      const rank = toSkillRank(raw.rank);
      const desc = toString_(raw.desc);
      return {
        t,
        type: 'skill',
        actor,
        name,
        ...(rank === null ? {} : { rank }),
        ...(desc === null ? {} : { desc }),
      };
    }
    case 'spell': {
      /*
       * 008 revision 2: the same shape as `skill` plus a mana cost. A malformed
       * rank or cost is dropped rather than fatal - the spell itself is still
       * the fact the row carries.
       */
      const name = toString_(raw.name);
      const ref = toSpellRef(raw.ref);
      // 008 revision 4: a row may name the spell, point at the registry, or do
      // both. Neither leaves nothing to file, so the row is unknown.
      if (actor === null || ((name === null || name === '') && ref === null)) {
        return unknownEvent(t, raw);
      }
      const rank = toSkillRank(raw.rank);
      const mana = toSkillRank(raw.mana);
      const desc = toString_(raw.desc);
      return {
        t,
        type: 'spell',
        actor,
        ...(name === null || name === '' ? {} : { name }),
        ...(ref === null ? {} : { ref }),
        ...(rank === null ? {} : { rank }),
        ...(mana === null ? {} : { mana }),
        ...(desc === null ? {} : { desc }),
      };
    }
    case 'class': {
      const cls = toString_(raw.class);
      if (actor === null || cls === null || cls === '') return unknownEvent(t, raw);
      return { t, type: 'class', actor, class: cls };
    }
    case 'hotlist': {
      const add = toStringList(raw.add);
      const remove = toStringList(raw.remove);
      if (actor === null || add === null || remove === null) return unknownEvent(t, raw);
      return { t, type: 'hotlist', actor, add, remove };
    }
    case 'equip': {
      const slot = toGearSlot(raw.slot);
      const item = toString_(raw.item);
      if (actor === null || slot === null || item === null || item === '') {
        return unknownEvent(t, raw);
      }
      return { t, type: 'equip', actor, slot, item };
    }
    case 'unequip': {
      const slot = toGearSlot(raw.slot);
      if (actor === null || slot === null) return unknownEvent(t, raw);
      const item = toString_(raw.item);
      return item === null || item === ''
        ? { t, type: 'unequip', actor, slot }
        : { t, type: 'unequip', actor, slot, item };
    }
    case 'npc': {
      /*
       * The entity id is not checked against the registry here: the registry is
       * show-level data the episode loader has never seen, and an id it does not
       * carry still belongs in the feed under its raw id (FR-601, US1 sc. 5).
       */
      const npcId = toString_(raw.id);
      const action = toNpcAction(raw.action);
      if (npcId === null || npcId === '' || action === null) return unknownEvent(t, raw);
      const note = toString_(raw.note);
      const unlock = toNonEmptyStringList(raw.unlock);
      return {
        t,
        type: 'npc',
        id: npcId,
        action,
        ...(note === null || note === '' ? {} : { note }),
        ...(unlock.length === 0 ? {} : { unlock }),
        ...(actor === null ? {} : { actor }),
      };
    }
    default:
      return unknownEvent(t, raw);
  }
}

/* ------------------------------------------- optional crawler sheet fields */

const STAT_KEYS = ['str', 'int', 'con', 'dex', 'cha'] as const;

function toStats(x: unknown): CrawlerStats | null {
  if (!isRecord(x)) return null;
  const stats = {} as CrawlerStats;
  for (const key of STAT_KEYS) {
    const value = toNumber(x[key]);
    if (value === null) return null;
    stats[key] = value;
  }
  return stats;
}

function toSkillEntries(x: unknown): SkillEntry[] | null {
  if (!Array.isArray(x)) return null;
  const out: SkillEntry[] = [];
  for (const item of x) {
    if (!isRecord(item)) return null;
    const name = toString_(item.name);
    if (name === null || name === '') return null;
    const rank = toSkillRank(item.rank);
    const desc = toString_(item.desc);
    out.push({
      name,
      ...(rank === null ? {} : { rank }),
      ...(desc === null || desc === '' ? {} : { desc }),
    });
  }
  return out;
}

/**
 * Hotlist and inventory entries (008 revision 2). A plain string is the v1
 * shorthand and is kept as a string; an object must at least name itself, and
 * its `qty` / `desc` are dropped when malformed rather than costing the entry.
 */
function toNamedEntries<T extends HotlistEntry | InventoryEntry>(
  x: unknown,
  allowRef = false,
): (string | T)[] | null {
  if (!Array.isArray(x)) return null;
  const out: (string | T)[] = [];
  for (const item of x) {
    if (typeof item === 'string') {
      out.push(item);
      continue;
    }
    if (!isRecord(item)) return null;
    const name = toString_(item.name);
    // 008 revision 4: a Hotlist mark may point at the spell registry instead of
    // repeating its name. Inventory has no registry, so it still must name itself.
    const ref = allowRef ? toSpellRef(item.ref) : null;
    if ((name === null || name === '') && ref === null) return null;
    const qty = toSkillRank(item.qty);
    const desc = toString_(item.desc);
    out.push({
      ...(name === null || name === '' ? {} : { name }),
      ...(ref === null ? {} : { ref }),
      ...(qty === null ? {} : { qty }),
      ...(desc === null || desc === '' ? {} : { desc }),
    } as T);
  }
  return out;
}

/** The sheet's spell list (008 revision 2): name, rank, mana cost, full text. */
function toSpellEntries(x: unknown): SpellEntry[] | null {
  if (!Array.isArray(x)) return null;
  const out: SpellEntry[] = [];
  for (const item of x) {
    if (!isRecord(item)) return null;
    const name = toString_(item.name);
    const ref = toSpellRef(item.ref);
    if ((name === null || name === '') && ref === null) return null;
    const rank = toSkillRank(item.rank);
    const mana = toSkillRank(item.mana);
    const desc = toString_(item.desc);
    out.push({
      ...(name === null || name === '' ? {} : { name }),
      ...(ref === null ? {} : { ref }),
      ...(rank === null ? {} : { rank }),
      ...(mana === null ? {} : { mana }),
      ...(desc === null || desc === '' ? {} : { desc }),
    });
  }
  return out;
}

const SINGLE_GEAR_SLOTS = ['head', 'torso', 'arms', 'hands', 'legs', 'feet'] as const;

/**
 * Starting gear (R2-FR-220). One bad field makes the whole block malformed, so
 * the crawler simply starts with nothing worn rather than half a kit.
 */
function toGear(x: unknown): Gear | null {
  if (!isRecord(x)) return null;
  const gear: Gear = {};
  for (const slot of SINGLE_GEAR_SLOTS) {
    if (x[slot] === undefined) continue;
    const item = toString_(x[slot]);
    if (item === null || item === '') return null;
    gear[slot] = item;
  }
  if (x.accessories !== undefined) {
    const accessories = toStringList(x.accessories);
    if (accessories === null) return null;
    gear.accessories = accessories;
  }
  return gear;
}

function toCrawlerNumber(x: unknown): string | number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '') return x;
  return null;
}

/**
 * Copies a crawler, keeping only the optional v2 sheet fields that are well
 * formed. A malformed optional field is dropped with a warning - never fatal,
 * so a v1 file (which has none of them) and a half-edited v2 file both load.
 */
/**
 * The crawler's mana box (009). Negative numbers are not a pool, so a malformed
 * box is dropped and the derivation rule applies instead - a sheet typo costs
 * the crawler nothing.
 */
function toMana(raw: unknown): Hp | null {
  if (!isRecord(raw)) return null;
  const current = toNumber(raw.current);
  const max = toNumber(raw.max);
  if (current === null || max === null || current < 0 || max < 0) return null;
  return { current, max };
}

/**
 * The health bar is ten slots (author, 2026-09-25). A sheet that writes any
 * other `max` is almost always counting hit points instead of HB slots, so say
 * so - once per reading, and only as a warning. The value is kept verbatim:
 * `Hp.max` is still a plain number and the reducer clamps to whatever it says.
 */
function warnIfNotTenSlots(where: string, max: number): void {
  if (max !== 10) console.warn(`${where}: hp max is ${max}; HB is ten slots.`);
}

export function normalizeCrawler(raw: Crawler): Crawler {
  const crawler: Crawler = { ...raw };
  const drop = (field: string): void => {
    delete (crawler as unknown as Record<string, unknown>)[field];
    console.warn(`Crawler "${raw.id}": dropping malformed "${field}".`);
  };

  warnIfNotTenSlots(`Crawler "${raw.id}"`, crawler.hp.max);

  if (crawler.race !== undefined && typeof crawler.race !== 'string') drop('race');
  if (crawler.pronouns !== undefined && typeof crawler.pronouns !== 'string') drop('pronouns');

  if (crawler.crawlerNumber !== undefined) {
    const value = toCrawlerNumber(crawler.crawlerNumber);
    if (value === null) drop('crawlerNumber');
    else crawler.crawlerNumber = value;
  }
  if (crawler.stats !== undefined) {
    const stats = toStats(crawler.stats);
    if (stats === null) drop('stats');
    else crawler.stats = stats;
  }
  if (crawler.mana !== undefined) {
    const mana = toMana(crawler.mana);
    if (mana === null) drop('mana');
    else crawler.mana = mana;
  }
  if (crawler.hotlist !== undefined) {
    const hotlist = toNamedEntries<HotlistEntry>(crawler.hotlist, true);
    if (hotlist === null) drop('hotlist');
    else crawler.hotlist = hotlist;
  }
  {
    // `inventory` is required, so a malformed one empties the bag rather than
    // deleting the field and failing the guard on the way back out.
    const inventory = toNamedEntries<InventoryEntry>(crawler.inventory);
    if (inventory === null) {
      crawler.inventory = [];
      console.warn(`Crawler "${raw.id}": dropping malformed "inventory".`);
    } else {
      crawler.inventory = inventory;
    }
  }
  if (crawler.skills !== undefined) {
    const skills = toSkillEntries(crawler.skills);
    if (skills === null) drop('skills');
    else crawler.skills = skills;
  }
  if (crawler.spells !== undefined) {
    const spells = toSpellEntries(crawler.spells);
    if (spells === null) drop('spells');
    else crawler.spells = spells;
  }
  if (crawler.gear !== undefined) {
    const gear = toGear(crawler.gear);
    if (gear === null) drop('gear');
    else crawler.gear = gear;
  }
  if (crawler.art !== undefined && (typeof crawler.art !== 'string' || crawler.art === '')) {
    drop('art');
  }
  return crawler;
}

/** Ascending by `t`, stable for equal `t` (file order wins - spec edge case). */
export function sortEvents(events: AnyEvent[]): AnyEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.t - b.event.t || a.index - b.index)
    .map(({ event }) => event);
}

/* ---------------------------------------------------------------- guards */

function isCrawler(x: unknown): x is Crawler {
  if (!isRecord(x)) return false;
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    typeof x.level === 'number' &&
    isRecord(x.hp) &&
    typeof x.hp.current === 'number' &&
    typeof x.hp.max === 'number' &&
    Array.isArray(x.inventory)
  );
}

function isMapState(x: unknown): x is MapState {
  if (!isRecord(x)) return false;
  return (
    typeof x.floor === 'number' &&
    isRecord(x.grid) &&
    typeof x.grid.cols === 'number' &&
    typeof x.grid.rows === 'number' &&
    Array.isArray(x.revealed)
  );
}

function isInitialState(x: unknown): x is InitialState {
  if (!isRecord(x)) return false;
  return (
    Array.isArray(x.party) && x.party.length > 0 && x.party.every(isCrawler) && isMapState(x.map)
  );
}

function isEpisodeMeta(x: unknown): x is EpisodeMeta {
  if (!isRecord(x)) return false;
  return (
    typeof x.id === 'number' &&
    typeof x.title === 'string' &&
    typeof x.youtubeId === 'string' &&
    typeof x.floor === 'number' &&
    typeof x.durationSec === 'number' &&
    typeof x.dataUrl === 'string'
  );
}

export function isShow(x: unknown): x is Show {
  if (!isRecord(x)) return false;
  if (typeof x.title !== 'string') return false;
  if (!Array.isArray(x.seasons)) return false;
  if (!Array.isArray(x.episodes) || !x.episodes.every(isEpisodeMeta)) return false;
  if (!isRecord(x.links)) return false;
  return (
    typeof x.links.youtube === 'string' &&
    typeof x.links.discord === 'string' &&
    x.seasons.every(
      (season) =>
        isRecord(season) && typeof season.season === 'number' && Array.isArray(season.floors),
    )
  );
}

export function isEpisodeData(x: unknown): x is EpisodeData {
  if (!isRecord(x)) return false;
  return (
    typeof x.episodeId === 'number' && isInitialState(x.initialState) && Array.isArray(x.events)
  );
}

/**
 * Validates the envelope, normalizes every event, and stable-sorts by `t`.
 * Throws `DataError` only when the file is unusable - a bad *event* is demoted
 * to `unknown`, never fatal.
 */
export function normalizeEpisode(raw: unknown): EpisodeData {
  if (!isEpisodeData(raw)) {
    throw new DataError('Episode data does not match the episode schema.');
  }
  const events = sortEvents((raw.events as unknown[]).map(normalizeEvent));
  const initialState: InitialState = {
    ...raw.initialState,
    party: raw.initialState.party.map(normalizeCrawler),
  };
  // A pre-T334 file may still carry `partyRank`. DCC has no party rank, so the
  // field is dropped rather than allowed to reach the reducer (T334).
  if ('partyRank' in initialState) {
    delete (initialState as unknown as Record<string, unknown>).partyRank;
    console.warn('Episode initialState: dropping "partyRank" (DCC has individual rank only).');
  }
  return { episodeId: raw.episodeId, initialState, events };
}

export function normalizeShow(raw: unknown): Show {
  if (!isShow(raw)) {
    throw new DataError('Show data does not match the show schema.');
  }
  /*
   * 007: the registry pointer is optional, so a malformed one costs the registry
   * and nothing else - the archive still loads (FR-600). 008 revision 4 adds the
   * spell registry's pointer on exactly the same terms.
   */
  const badRegistry = raw.registryUrl !== undefined && typeof raw.registryUrl !== 'string';
  const badSpells = raw.spellsUrl !== undefined && typeof raw.spellsUrl !== 'string';
  if (!badRegistry && !badSpells) return raw;

  const show: Show = { ...raw };
  if (badRegistry) {
    delete show.registryUrl;
    console.warn('Show: dropping malformed "registryUrl".');
  }
  if (badSpells) {
    delete show.spellsUrl;
    console.warn('Show: dropping malformed "spellsUrl".');
  }
  return show;
}

/* --------------------------------------------------------------- registry */

/** The envelope only: every entity inside is judged one at a time. */
export function isRegistry(x: unknown): x is Registry {
  return isRecord(x) && Array.isArray(x.entities);
}

/** `{ id, text }`, both non-empty. A malformed fact is dropped, never fatal. */
function toFacts(x: unknown, entityId: string): EntityFact[] {
  if (!Array.isArray(x)) {
    if (x !== undefined) console.warn(`Registry entity "${entityId}": dropping malformed "facts".`);
    return [];
  }
  const facts: EntityFact[] = [];
  const seen = new Set<string>();
  for (const raw of x) {
    if (!isRecord(raw)) {
      console.warn(`Registry entity "${entityId}": dropping a malformed fact.`);
      continue;
    }
    const id = toString_(raw.id);
    const text = toString_(raw.text);
    if (id === null || id === '' || text === null || text === '') {
      console.warn(`Registry entity "${entityId}": dropping a fact with no id or text.`);
      continue;
    }
    if (seen.has(id)) {
      console.warn(`Registry entity "${entityId}": dropping duplicate fact "${id}".`);
      continue;
    }
    seen.add(id);
    facts.push({ id, text });
  }
  return facts;
}

/** One entity, or `null` when it is missing something the UI cannot invent. */
function toEntity(raw: unknown): Entity | null {
  if (!isRecord(raw)) return null;
  const id = toString_(raw.id);
  const name = toString_(raw.name);
  const intro = toString_(raw.intro);
  const kind = toEntityKind(raw.kind);
  if (id === null || id === '') return null;
  if (name === null || name === '' || intro === null || intro === '' || kind === null) return null;

  const portrait = toString_(raw.portrait);
  const floor = toNumber(raw.floor);
  const aliases = toNonEmptyStringList(raw.aliases);

  return {
    id,
    name,
    kind,
    ...(portrait === null || portrait === '' ? {} : { portrait }),
    ...(floor === null ? {} : { floor }),
    ...(aliases.length === 0 ? {} : { aliases }),
    intro,
    facts: toFacts(raw.facts, id),
  };
}

/**
 * Validates the envelope and keeps every well-formed entity. A malformed entity
 * (no id, no name, no intro, or an unknown kind) is dropped with a warning and a
 * duplicate id keeps the first, so one bad row never costs the whole registry
 * (constitution IV: schema evolution must not crash a page).
 */
export function normalizeRegistry(raw: unknown): Registry {
  if (!isRegistry(raw)) {
    throw new DataError('Registry data does not match the registry schema.');
  }
  const entities: Entity[] = [];
  const seen = new Set<string>();
  for (const item of raw.entities as unknown[]) {
    const entity = toEntity(item);
    if (entity === null) {
      console.warn('Registry: dropping a malformed entity.');
      continue;
    }
    if (seen.has(entity.id)) {
      console.warn(`Registry: dropping duplicate entity "${entity.id}".`);
      continue;
    }
    seen.add(entity.id);
    entities.push(entity);
  }
  return { entities };
}

/* -------------------------------------------------- spell registry (008 R4) */

/** The envelope only: every spell inside is judged one at a time. */
export function isSpellRegistry(x: unknown): x is SpellRegistry {
  return isRecord(x) && Array.isArray(x.spells);
}

function toSpellKind(x: unknown): SpellDef['kind'] | null {
  return typeof x === 'string' && (SPELL_KINDS as readonly string[]).includes(x)
    ? (x as SpellDef['kind'])
    : null;
}

/** `{ rank, text }`. A malformed upgrade is dropped, never fatal. */
function toUpgrades(x: unknown, spellId: string): SpellUpgrade[] {
  if (!Array.isArray(x)) {
    if (x !== undefined) console.warn(`Spell "${spellId}": dropping malformed "upgrades".`);
    return [];
  }
  const upgrades: SpellUpgrade[] = [];
  for (const raw of x) {
    if (!isRecord(raw)) {
      console.warn(`Spell "${spellId}": dropping a malformed upgrade.`);
      continue;
    }
    const rank = toNumber(raw.rank);
    const text = toString_(raw.text);
    if (rank === null || !Number.isInteger(rank) || rank < 1 || text === null || text === '') {
      console.warn(`Spell "${spellId}": dropping an upgrade with no rank or text.`);
      continue;
    }
    upgrades.push({ rank, text });
  }
  return upgrades;
}

/** The chart's inclusive d100 range, or `undefined` when it is not a pair. */
function toRoll(x: unknown): [number, number] | undefined {
  if (!Array.isArray(x) || x.length !== 2) return undefined;
  const lo = toNumber(x[0]);
  const hi = toNumber(x[1]);
  if (lo === null || hi === null) return undefined;
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < 1 || hi > 100 || lo > hi) {
    return undefined;
  }
  return [lo, hi];
}

/** One spell, or `null` when it is missing something the UI cannot invent. */
function toSpellDef(raw: unknown): SpellDef | null {
  if (!isRecord(raw)) return null;
  const id = toString_(raw.id);
  const name = toString_(raw.name);
  const kind = toSpellKind(raw.kind);
  const manaCost = toNumber(raw.manaCost);
  const description = toString_(raw.description);
  if (id === null || !SPELL_REF_RE.test(id)) return null;
  if (name === null || name === '' || kind === null) return null;
  if (manaCost === null || manaCost < 0) return null;
  if (description === null || description === '') return null;

  const aliases = toNonEmptyStringList(raw.aliases);
  const quote = toString_(raw.quote);
  const damageType = toString_(raw.damageType);
  const range = toString_(raw.range);
  const duration = toString_(raw.duration);
  const aiFavor = toNumber(raw.aiFavor);
  const limitations = toString_(raw.limitations);
  const cooldown = toString_(raw.cooldown);
  const baseDamage = toString_(raw.baseDamage);
  const roll = toRoll(raw.roll);
  const page = toNumber(raw.page);

  return {
    id,
    name,
    ...(aliases.length === 0 ? {} : { aliases }),
    ...(quote === null || quote === '' ? {} : { quote }),
    kind,
    ...(raw.interrupt === true ? { interrupt: true } : {}),
    ...(damageType === null || damageType === '' ? {} : { damageType }),
    ...(raw.areaOfEffect === true ? { areaOfEffect: true } : {}),
    manaCost,
    ...(range === null || range === '' ? {} : { range }),
    ...(duration === null || duration === '' ? {} : { duration }),
    ...(aiFavor === null ? {} : { aiFavor }),
    ...(limitations === null || limitations === '' ? {} : { limitations }),
    ...(cooldown === null || cooldown === '' ? {} : { cooldown }),
    description,
    ...(baseDamage === null || baseDamage === '' ? {} : { baseDamage }),
    upgrades: toUpgrades(raw.upgrades, id),
    ...(roll === undefined ? {} : { roll }),
    ...(page === null ? {} : { page }),
  };
}

/**
 * Validates the envelope and keeps every well-formed spell (008 revision 4).
 * `normalizeRegistry`'s twin, and deliberately as forgiving: a malformed spell
 * (no id, no name, an unknown kind, no cost or no description) is dropped with a
 * warning and a duplicate id keeps the first, so one bad row never costs the
 * whole book (constitution IV).
 */
export function validateSpells(raw: unknown): SpellRegistry {
  if (!isSpellRegistry(raw)) {
    throw new DataError('Spell data does not match the spell registry schema.');
  }
  const spells: SpellDef[] = [];
  const seen = new Set<string>();
  for (const item of raw.spells as unknown[]) {
    const spell = toSpellDef(item);
    if (spell === null) {
      console.warn('Spells: dropping a malformed spell.');
      continue;
    }
    if (seen.has(spell.id)) {
      console.warn(`Spells: dropping duplicate spell "${spell.id}".`);
      continue;
    }
    seen.add(spell.id);
    spells.push(spell);
  }
  return { spells };
}
