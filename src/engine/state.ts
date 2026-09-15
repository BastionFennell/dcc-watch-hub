/**
 * Overlay state: the result of folding every elapsed event onto the episode's
 * initial state. Never stored — always recomputed (constitution I, Time-Truth).
 *
 * Framework-free by rule: no React, no DOM, no clocks, no randomness.
 */
import type { Crawler, Gear, InitialState, MapState, SkillEntry } from '../data/types';

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

/** `gear` is replaced by the normalized `GearState`, so it is omitted here. */
export interface CrawlerState extends Omit<Crawler, 'gear'> {
  /** Derived; empty at t = 0 (the initial-state schema has no status field). */
  statuses: string[];
  /** Achievement titles earned so far, in order. */
  achievements: string[];
  /** Seeded from `Crawler.skills`; `skill` events upsert by name (v2). */
  skills: SkillEntry[];
  /** Seeded from `Crawler.hotlist`; `hotlist` events add and remove (v2). */
  hotlist: string[];
  /** Seeded from `Crawler.gear`; `equip`/`unequip` events move it (R2). */
  gear: GearState;
}

export interface OverlayState {
  /** Same order as `initialState.party`. */
  party: CrawlerState[];
  partyRank: number | null;
  map: MapState;
}

export function fromInitialState(init: InitialState): OverlayState {
  return {
    party: init.party.map((crawler) => ({
      ...crawler,
      hp: { ...crawler.hp },
      inventory: [...crawler.inventory],
      statuses: [],
      achievements: [],
      skills: (crawler.skills ?? []).map((skill) => ({ ...skill })),
      hotlist: [...(crawler.hotlist ?? [])],
      gear: gearFrom(crawler.gear),
    })),
    partyRank: init.partyRank,
    map: {
      floor: init.map.floor,
      grid: { ...init.map.grid },
      revealed: init.map.revealed.map((cell) => [cell[0], cell[1]] as [number, number]),
    },
  };
}

export function findCrawler(state: OverlayState, id: string): CrawlerState | undefined {
  return state.party.find((crawler) => crawler.id === id);
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}
