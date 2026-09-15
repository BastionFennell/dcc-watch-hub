/**
 * Overlay state: the result of folding every elapsed event onto the episode's
 * initial state. Never stored — always recomputed (constitution I, Time-Truth).
 *
 * Framework-free by rule: no React, no DOM, no clocks, no randomness.
 */
import type { Crawler, InitialState, MapState } from '../data/types';

export interface CrawlerState extends Crawler {
  /** Derived; empty at t = 0 (the initial-state schema has no status field). */
  statuses: string[];
  /** Achievement titles earned so far, in order. */
  achievements: string[];
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
