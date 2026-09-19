/**
 * Overlay state: the result of folding every elapsed event onto the episode's
 * initial state. Never stored - always recomputed (constitution I, Time-Truth).
 *
 * Framework-free by rule: no React, no DOM, no clocks, no randomness.
 */
import type {
  Crawler,
  Gear,
  HotlistEntry,
  InitialState,
  InventoryEntry,
  MapState,
  SkillEntry,
  SpellEntry,
} from '../data/types';

/**
 * The normalized gear state (R2-FR-220): one item or nothing per worn slot, and
 * the accessory list. Seeded from `Crawler.gear`, moved by equip/unequip.
 */
export interface GearState {
  head: string | null;
  torso: string | null;
  arms: string | null;
  hands: string | null;
  legs: string | null;
  feet: string | null;
  accessories: string[];
}

/** At most this many accessories are worn at once; later equips are ignored. */
export const ACCESSORY_CAP = 10;

export function gearFrom(gear: Gear | undefined): GearState {
  return {
    head: gear?.head ?? null,
    torso: gear?.torso ?? null,
    arms: gear?.arms ?? null,
    hands: gear?.hands ?? null,
    legs: gear?.legs ?? null,
    feet: gear?.feet ?? null,
    accessories: [...(gear?.accessories ?? [])].slice(0, ACCESSORY_CAP),
  };
}

/**
 * Every list the sheet writes as "a string, or a string with structure" is
 * normalized here (008 revision 2), so nothing downstream ever handles both
 * shapes: `'Torch'` and `{ name: 'Torch' }` are the same state.
 */
export function entriesFrom<T extends { name?: string }>(
  entries: readonly (string | T)[] | undefined,
): T[] {
  return (entries ?? []).map((entry) =>
    typeof entry === 'string' ? ({ name: entry } as T) : ({ ...entry } as T),
  );
}

/** `gear` is replaced by the normalized `GearState`, so it is omitted here. */
export interface CrawlerState
  extends Omit<Crawler, 'gear' | 'hotlist' | 'inventory' | 'skills' | 'spells'> {
  /** Derived; empty at t = 0 (the initial-state schema has no status field). */
  statuses: string[];
  /** Achievement titles earned so far, in order. */
  achievements: string[];
  /** Seeded from `Crawler.skills`; `skill` events upsert by name (v2). */
  skills: SkillEntry[];
  /** Seeded from `Crawler.spells`; `spell` events upsert by name (008 R2). */
  spells: SpellEntry[];
  /** Seeded from `Crawler.hotlist`; `hotlist` events add and remove (v2). */
  hotlist: HotlistEntry[];
  /** Seeded from `Crawler.inventory`; `inventory` and `loot` events move it. */
  inventory: InventoryEntry[];
  /** Seeded from `Crawler.gear`; `equip`/`unequip` events move it (R2). */
  gear: GearState;
}

/**
 * What the elapsed log says about one entity (007, FR-602). Created by the first
 * `npc` event of any action - a `seen` before a `met` still counts as an
 * encounter (research R2) - and, like everything here, recomputed on every seek.
 */
export interface NpcState {
  /** `t` of the first event about this entity, whatever its action. */
  firstMet: number;
  /** How many `npc` events about it have elapsed. */
  encounters: number;
  /** Fact ids unlocked so far, in unlock order, deduped. */
  unlocked: string[];
  defeated: boolean;
  /** `t` of the most recent elapsed event about it; the strip orders by this. */
  lastT: number;
}

export interface OverlayState {
  /** Same order as `initialState.party`. */
  party: CrawlerState[];
  map: MapState;
  /** Keyed by entity id, including ids the registry does not carry (007). */
  npcs: Record<string, NpcState>;
}

export function fromInitialState(init: InitialState): OverlayState {
  return {
    party: init.party.map((crawler) => ({
      ...crawler,
      hp: { ...crawler.hp },
      inventory: entriesFrom<InventoryEntry>(crawler.inventory),
      statuses: [],
      achievements: [],
      skills: (crawler.skills ?? []).map((skill) => ({ ...skill })),
      spells: (crawler.spells ?? []).map((spell) => ({ ...spell })),
      hotlist: entriesFrom<HotlistEntry>(crawler.hotlist),
      gear: gearFrom(crawler.gear),
    })),
    map: {
      floor: init.map.floor,
      grid: { ...init.map.grid },
      revealed: init.map.revealed.map((cell) => [cell[0], cell[1]] as [number, number]),
    },
    // Nobody has been met at t = 0: the initial-state schema has no entity field.
    npcs: {},
  };
}

export function findCrawler(state: OverlayState, id: string): CrawlerState | undefined {
  return state.party.find((crawler) => crawler.id === id);
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}
