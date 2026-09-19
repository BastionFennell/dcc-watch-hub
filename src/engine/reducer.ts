/**
 * The pure reducer. `state(t) = reduce(initialState, events.filter(e => e.t <= t))`.
 *
 * Constitution I: no I/O, no clocks, no randomness, no component or DOM reads.
 * Unknown event types and unknown actors leave state untouched (FR-006, edge cases).
 */
import type {
  AnyEvent,
  Cell,
  EpisodeData,
  GearSlot,
  SkillEntry,
  SpellEntry,
} from '../data/types';
import type { CrawlerState, GearState, NpcState, OverlayState } from './state';
import { ACCESSORY_CAP, cellKey, fromInitialState } from './state';
import { entryKey } from './spells';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Replaces one crawler by id, returning a new state. Unknown ids are a no-op. */
function withCrawler(
  state: OverlayState,
  actor: string | undefined,
  update: (crawler: CrawlerState) => CrawlerState,
): OverlayState {
  if (!actor) return state;
  const index = state.party.findIndex((crawler) => crawler.id === actor);
  if (index === -1) return state;
  const party = state.party.slice();
  party[index] = update(party[index]);
  return { ...state, party };
}

function union(existing: string[], add: string[], remove: string[]): string[] {
  const removed = new Set(remove);
  const kept = existing.filter((item) => !removed.has(item));
  for (const item of add) {
    if (!kept.includes(item)) kept.push(item);
  }
  return kept;
}

/**
 * The same union over entries that carry structure (008 revision 2). Events
 * name items by their short `name` alone, so a `remove` drops the whole entry -
 * quantity, description and all - and an `add` that the crawler is not already
 * carrying appends a bare `{ name }`. A string list and an entry list therefore
 * behave identically, which is the point.
 */
function unionEntries<T extends { name?: string; ref?: string }>(
  existing: readonly T[],
  add: readonly string[],
  remove: readonly string[],
): T[] {
  const removed = new Set(remove);
  // A mark that only carries a `ref` (008 R4) is named by that ref here, so a
  // row can clear it by id as well as by the name the registry gives it.
  const names = (entry: T) => [entry.name, entry.ref].filter((x) => x !== undefined);
  const kept = existing.filter((entry) => !names(entry).some((name) => removed.has(name)));
  for (const name of add) {
    if (!kept.some((entry) => names(entry).includes(name))) kept.push({ name } as T);
  }
  return kept;
}

/** Upsert by name: an existing skill keeps its slot and takes the new rank. */
function upsertSkill(
  existing: SkillEntry[],
  name: string,
  rank: number | undefined,
  desc: string | undefined,
): SkillEntry[] {
  const patch = {
    ...(rank === undefined ? {} : { rank }),
    ...(desc === undefined ? {} : { desc }),
  };
  const index = existing.findIndex((skill) => skill.name === name);
  if (index === -1) return [...existing, { name, ...patch }];
  if (rank === undefined && desc === undefined) return existing;
  const skills = existing.slice();
  skills[index] = { ...skills[index], ...patch };
  return skills;
}

/**
 * The same upsert for spells (008 revision 2): rank, mana cost and text each
 * replace what the sheet held when the event carries them, and leave it alone
 * when it does not.
 */
function upsertSpell(
  existing: SpellEntry[],
  key: Pick<SpellEntry, 'name' | 'ref'>,
  rank: number | undefined,
  mana: number | undefined,
  desc: string | undefined,
): SpellEntry[] {
  const patch = {
    ...(rank === undefined ? {} : { rank }),
    ...(mana === undefined ? {} : { mana }),
    ...(desc === undefined ? {} : { desc }),
  };
  // 008 revision 4: the identity of a spell is its registry id when it has one,
  // so a `ref` row amends the sheet's `{ ref }` entry rather than adding a second.
  const wanted = entryKey(key);
  const index = existing.findIndex((spell) => entryKey(spell) === wanted);
  if (index === -1) {
    return [
      ...existing,
      {
        ...(key.name === undefined ? {} : { name: key.name }),
        ...(key.ref === undefined ? {} : { ref: key.ref }),
        ...patch,
      },
    ];
  }
  if (rank === undefined && mana === undefined && desc === undefined) return existing;
  const spells = existing.slice();
  spells[index] = { ...spells[index], ...patch };
  return spells;
}

/**
 * Worn gear after an `equip` (R2-FR-220): a single slot is replaced outright;
 * accessories append, deduped by name and capped at ten.
 */
function equipGear(gear: GearState, slot: GearSlot, item: string): GearState {
  if (slot !== 'accessory') return { ...gear, [slot]: item };
  if (gear.accessories.includes(item) || gear.accessories.length >= ACCESSORY_CAP) return gear;
  return { ...gear, accessories: [...gear.accessories, item] };
}

/** An `unequip` clears a slot; an accessory goes by name, or the last one. */
function unequipGear(gear: GearState, slot: GearSlot, item: string | undefined): GearState {
  if (slot !== 'accessory') return { ...gear, [slot]: null };
  if (gear.accessories.length === 0) return gear;
  if (item === undefined) return { ...gear, accessories: gear.accessories.slice(0, -1) };
  if (!gear.accessories.includes(item)) return gear;
  return { ...gear, accessories: gear.accessories.filter((worn) => worn !== item) };
}

export function applyEvent(state: OverlayState, event: AnyEvent): OverlayState {
  switch (event.type) {
    case 'hp':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        hp: { current: clamp(event.current, 0, event.max), max: event.max },
      }));

    /*
     * Mana (009) clamps like hp. The only difference is the optional `max`: a
     * row that only reads the pool keeps the standing max, so a dip event never
     * has to restate a number the sheet already settled.
     */
    case 'mana':
      return withCrawler(state, event.actor, (crawler) => {
        const max = event.max ?? crawler.mana.max;
        return { ...crawler, mana: { current: clamp(event.current, 0, max), max } };
      });

    case 'level_up':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        level: event.level,
      }));

    case 'loot':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        inventory: unionEntries(crawler.inventory, [event.item], []),
      }));

    case 'inventory':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        inventory: unionEntries(crawler.inventory, event.add, event.remove),
      }));

    case 'status':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        statuses: union(crawler.statuses, event.add, event.remove),
      }));

    case 'achievement':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        achievements: [...crawler.achievements, event.title],
      }));

    case 'skill':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        skills: upsertSkill(crawler.skills, event.name, event.rank, event.desc),
      }));

    case 'spell':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        spells: upsertSpell(
          crawler.spells,
          {
            ...(event.name === undefined ? {} : { name: event.name }),
            ...(event.ref === undefined ? {} : { ref: event.ref }),
          },
          event.rank,
          event.mana,
          event.desc,
        ),
      }));

    case 'class':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        class: event.class,
      }));

    case 'hotlist':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        hotlist: unionEntries(crawler.hotlist, event.add, event.remove),
      }));

    case 'equip':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        gear: equipGear(crawler.gear, event.slot, event.item),
      }));

    case 'unequip':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        gear: unequipGear(crawler.gear, event.slot, event.item),
      }));

    case 'rank':
      // Individual rank only - DCC has no party rank (T334).
      return withCrawler(state, event.actor, (crawler) => ({ ...crawler, rank: event.rank }));

    case 'npc': {
      /*
       * Every action creates or updates the entry (research R2): a `seen` before
       * a `met` still means the party has met it, so `firstMet` is the first
       * event of any action. There is no registry here - an id the registry does
       * not carry gets state like any other, and the strip omits it later.
       */
      const prior = state.npcs[event.id] as NpcState | undefined;
      const unlocked = prior === undefined ? [] : prior.unlocked.slice();
      for (const fact of event.unlock ?? []) {
        if (!unlocked.includes(fact)) unlocked.push(fact);
      }
      const npc: NpcState = {
        firstMet: prior === undefined ? event.t : prior.firstMet,
        encounters: (prior?.encounters ?? 0) + 1,
        unlocked,
        defeated: (prior?.defeated ?? false) || event.action === 'defeated',
        lastT: event.t,
      };
      return { ...state, npcs: { ...state.npcs, [event.id]: npc } };
    }

    case 'map_reveal': {
      const seen = new Set(state.map.revealed.map((cell) => cellKey(cell[0], cell[1])));
      const revealed: Cell[] = state.map.revealed.slice();
      for (const cell of event.cells) {
        const key = cellKey(cell[0], cell[1]);
        if (!seen.has(key)) {
          seen.add(key);
          revealed.push([cell[0], cell[1]]);
        }
      }
      if (revealed.length === state.map.revealed.length) return state;
      return { ...state, map: { ...state.map, revealed } };
    }

    // Feed-only events: no state transition.
    case 'system_message':
    case 'sponsor':
    case 'chapter':
    case 'note':
    case 'unknown':
      return state;

    default:
      return state;
  }
}

/** `reduceTo` is the only way to obtain overlay state. Recomputed on every tick. */
export function reduceTo(episode: EpisodeData, t: number): OverlayState {
  return episode.events
    .filter((event) => event.t <= t)
    .reduce(applyEvent, fromInitialState(episode.initialState));
}
