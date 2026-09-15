/**
 * The pure reducer. `state(t) = reduce(initialState, events.filter(e => e.t <= t))`.
 *
 * Constitution I: no I/O, no clocks, no randomness, no component or DOM reads.
 * Unknown event types and unknown actors leave state untouched (FR-006, edge cases).
 */
import type { AnyEvent, Cell, EpisodeData, GearSlot, SkillEntry } from '../data/types';
import type { CrawlerState, GearState, OverlayState } from './state';
import { ACCESSORY_CAP, cellKey, fromInitialState } from './state';

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

/** Upsert by name: an existing skill keeps its slot and takes the new rank. */
function upsertSkill(existing: SkillEntry[], name: string, rank: number | undefined): SkillEntry[] {
  const index = existing.findIndex((skill) => skill.name === name);
  if (index === -1) {
    return [...existing, rank === undefined ? { name } : { name, rank }];
  }
  if (rank === undefined) return existing;
  const skills = existing.slice();
  skills[index] = { ...skills[index], rank };
  return skills;
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

    case 'level_up':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        level: event.level,
      }));

    case 'loot':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        inventory: union(crawler.inventory, [event.item], []),
      }));

    case 'inventory':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        inventory: union(crawler.inventory, event.add, event.remove),
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
        skills: upsertSkill(crawler.skills, event.name, event.rank),
      }));

    case 'class':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        class: event.class,
      }));

    case 'hotlist':
      return withCrawler(state, event.actor, (crawler) => ({
        ...crawler,
        hotlist: union(crawler.hotlist, event.add, event.remove),
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
      if (event.scope === 'party') {
        return { ...state, partyRank: event.rank };
      }
      return withCrawler(state, event.actor, (crawler) => ({ ...crawler, rank: event.rank }));

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
