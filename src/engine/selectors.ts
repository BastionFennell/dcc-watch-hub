/**
 * View models. Every one is a pure function of the event log and the playhead,
 * so scrubbing in either direction is automatically correct (constitution I).
 * No memoization by design (spec §3.2: do not prematurely optimize).
 */
import type {
  AnyEvent,
  ChapterKind,
  Crawler,
  CrawlerStats,
  Entity,
  EntityFact,
  EntityKind,
  Event,
  EventType,
  GearSlot,
  Hp,
  HotlistEntry,
  InventoryEntry,
  NpcEvent,
  Registry,
  SkillEntry,
} from '../data/types';
import { isKnownEvent } from '../data/types';
import { copy } from '../copy';
import type { GearState, NpcState, OverlayState } from './state';
import { cellKey } from './state';
import type { HotlistView, SpellIndex, SpellView } from './spells';
import { NO_SPELLS, resolveHotlist, resolveSpell } from './spells';

/* ------------------------------------------------------------------ types */

export interface PartyFrame {
  id: string;
  name: string;
  handle: string;
  level: number;
  hp: { current: number; max: number };
  /** 0–100, clamped; drives the HP bar width. */
  pct: number;
  danger: boolean;
  levelUpPulse: boolean;
  statuses: string[];
  portrait: string;
  rank: number | null;
}

export interface FeedItem {
  /** Index in the episode's event array - a stable React key across seeks. */
  id: number;
  t: number;
  kind: EventType;
  label: string;
  text: string;
  actorName?: string;
  /**
   * The crawler the event belongs to, when it has one. The display name is for
   * reading; this is what the log's crawler filter matches on (005 FR-402), so a
   * rename in the data never changes which rows a filter keeps.
   */
  actorId?: string;
  /** Sponsor only. */
  durationSec?: number;
  /** The entity an `npc` row is about, registry-known or not (007, FR-612). */
  npcId?: string;
}

export interface Toast {
  id: number;
  title: string;
  desc?: string;
  actorName?: string;
  /** Queue window, in content seconds. */
  start: number;
  end: number;
}

export type MarkerKind = ChapterKind;

export interface Marker {
  id: number;
  t: number;
  /** 0–1 along the bar. */
  pos: number;
  kind: MarkerKind;
  /** Ready to drop into a style attribute. */
  color: string;
  label: string;
}

export interface MapCellsView {
  floor: number;
  cols: number;
  rows: number;
  revealed: Set<string>;
  total: number;
}

/* --- v2 view models (data-model §3) --- */

export interface RankPoint {
  t: number;
  rank: number;
}

/** One crawler's rank over the elapsed log (FR-140; DCC has no party rank). */
export interface RankSeries {
  points: RankPoint[];
  /** The most recent elapsed rank, or null with no points. */
  current: number | null;
  /** The best (lowest) rank reached so far, or null with no points. */
  best: number | null;
}

/** The ten-segment HP strip from the official sheet (FR-110). */
export interface HpSegments {
  /** 0–10; any HP above zero fills at least one segment. */
  filled: number;
  /** 0–100, rounded. */
  pct: number;
}

export interface DossierAchievement {
  title: string;
  desc?: string;
  t: number;
}

/** Everything FR-110 renders, as of the playhead. */
export interface Dossier {
  id: string;
  name: string;
  handle: string;
  player: string;
  portrait: string;
  race?: string;
  pronouns?: string;
  crawlerNumber?: string | number;
  level: number;
  class: string | null;
  floor: number;
  hp: Hp & HpSegments;
  rank: RankSeries;
  debuffs: string[];
  stats?: CrawlerStats;
  /** Full-figure illustration; the record falls back to the bust (R2-FR-224). */
  art?: string;
  /** Worn gear as of the playhead, one item or null per slot (R2-FR-220). */
  gear: GearState;
  /**
   * Normalized entries (008 R2), resolved against the spell registry (008 R4):
   * a string in the data reads as `{ name }`, and a `{ ref }` mark reads as the
   * book's name with the book's text behind it.
   */
  hotlist: HotlistView[];
  skills: SkillEntry[];
  /** The sheet's SPELLS section as of the playhead, resolved (008 R2/R4). */
  spells: SpellView[];
  inventory: InventoryEntry[];
  achievements: DossierAchievement[];
  history: FeedItem[];
}

/**
 * Everything the feed needs to name an actor. The static party and the reduced
 * party both satisfy it, and `CrawlerState` re-types `gear`, so selectors take
 * this rather than `Crawler` itself.
 */
export type PartyNames = readonly Pick<Crawler, 'id' | 'name'>[];

/** One named neighborhood on the expanded map (FR-120). */
export interface MapLabel {
  label: string;
  /** Centroid over the union of every cell revealed under this label. */
  row: number;
  col: number;
  /** How many distinct cells carry the label. */
  cells: number;
}

export const TOAST_DURATION_SEC = 6;
export const LEVEL_UP_PULSE_SEC = 1.2;

const CHAPTER_KIND_SET = new Set<string>(['boss', 'loot', 'achievement', 'levelup', 'story']);

function markerKind(kind: string): MarkerKind {
  return CHAPTER_KIND_SET.has(kind) ? (kind as MarkerKind) : 'story';
}

function markerColor(kind: MarkerKind): string {
  return `var(--marker-${kind})`;
}

function nameOf(party: PartyNames, actor: string | undefined): string | undefined {
  if (!actor) return undefined;
  return party.find((crawler) => crawler.id === actor)?.name ?? actor;
}

/* -------------------------------------------------------------- selectors */

/** Every event at or before the playhead, in file order. */
export function elapsed(events: readonly AnyEvent[], t: number): AnyEvent[] {
  return events.filter((event) => event.t <= t);
}

export function partyFrames(
  state: OverlayState,
  events: readonly AnyEvent[],
  t: number,
): PartyFrame[] {
  return state.party.map((crawler) => {
    const max = crawler.hp.max > 0 ? crawler.hp.max : 1;
    const current = Math.min(Math.max(crawler.hp.current, 0), max);
    const levelUpPulse = events.some(
      (event) =>
        event.type === 'level_up' &&
        event.actor === crawler.id &&
        event.t <= t &&
        t < event.t + LEVEL_UP_PULSE_SEC,
    );
    return {
      id: crawler.id,
      name: crawler.name,
      handle: crawler.handle,
      level: crawler.level,
      hp: { current, max: crawler.hp.max },
      pct: Math.round((current / max) * 100),
      danger: current / max < 0.25,
      levelUpPulse,
      statuses: crawler.statuses,
      portrait: crawler.portrait,
      rank: crawler.rank,
    };
  });
}

/**
 * Names an entity the way the feed must: the registry's name when it carries the
 * id, the raw id otherwise, so an unknown entity still reads as a row and never
 * as a blank (spec US1 scenario 5).
 */
function entityName(registry: Registry | null | undefined, id: string): string {
  return registry?.entities.find((entity) => entity.id === id)?.name ?? id;
}

function npcText(event: NpcEvent, name: string): string {
  switch (event.action) {
    case 'met':
      return copy.feedText.npcMet(name, event.note);
    case 'seen':
      return copy.feedText.npcSeen(name, event.note);
    case 'update':
      return copy.feedText.npcUpdate(name, event.note);
    case 'defeated':
      return copy.feedText.npcDefeated(name, event.note);
  }
}

function toFeedItem(
  event: Event,
  id: number,
  party: PartyNames,
  registry?: Registry | null,
  spells: SpellIndex = NO_SPELLS,
): FeedItem | null {
  const label = copy.labels[event.type];
  const actorId = 'actor' in event ? event.actor : undefined;
  const actorName = 'actor' in event ? nameOf(party, event.actor) : undefined;
  const who = actorName ?? '';
  const base = {
    id,
    t: event.t,
    kind: event.type,
    label,
    // Only actor events carry the key at all, so a party-scoped row is
    // unambiguously "no crawler" to the log's filter (005 FR-402).
    ...(actorId === undefined ? {} : { actorId }),
  } as const;

  switch (event.type) {
    case 'system_message':
      return { ...base, text: event.text };
    case 'note':
      return { ...base, text: event.text };
    case 'achievement':
      return { ...base, actorName, text: copy.feedText.achievement(who, event.title, event.desc) };
    case 'loot':
      return { ...base, actorName, text: copy.feedText.loot(who, event.item, event.source) };
    case 'hp':
      return { ...base, actorName, text: copy.feedText.hp(who, event.current, event.max) };
    case 'level_up':
      return { ...base, actorName, text: copy.feedText.levelUp(who, event.level) };
    case 'rank':
      return { ...base, actorName, text: copy.feedText.rankCrawler(who, event.rank) };
    case 'map_reveal':
      return { ...base, text: copy.feedText.mapReveal(event.cells.length, event.label) };
    case 'sponsor':
      return { ...base, text: event.text, durationSec: event.durationSec };
    case 'chapter':
      return { ...base, text: copy.feedText.chapter(event.label) };
    case 'status':
      return { ...base, actorName, text: copy.feedText.status(who, event.add, event.remove) };
    case 'inventory':
      return { ...base, actorName, text: copy.feedText.inventory(who, event.add, event.remove) };
    case 'skill':
      return { ...base, actorName, text: copy.feedText.skill(who, event.name, event.rank) };
    case 'spell':
      // 008 revision 4: a row that only carries a `ref` still reads as the
      // book's name, so the feed never files "mimi inscribes heal".
      return {
        ...base,
        actorName,
        text: copy.feedText.spell(who, resolveSpell(event, spells).name, event.rank),
      };
    case 'class':
      return { ...base, actorName, text: copy.feedText.classChange(who, event.class) };
    case 'hotlist':
      return { ...base, actorName, text: copy.feedText.hotlist(who, event.add, event.remove) };
    case 'equip':
      return {
        ...base,
        actorName,
        text: copy.feedText.equip(who, copy.gearSlotLabels[event.slot], event.item),
      };
    case 'unequip':
      return {
        ...base,
        actorName,
        text: copy.feedText.unequip(who, copy.gearSlotLabels[event.slot], event.item),
      };
    case 'npc':
      return {
        ...base,
        ...(actorName === undefined ? {} : { actorName }),
        npcId: event.id,
        text: npcText(event, entityName(registry, event.id)),
      };
    default:
      return null;
  }
}

/** The last `n` elapsed, known events, newest first (FR-020). */
export function feedItems(
  events: readonly AnyEvent[],
  t: number,
  n = 8,
  party: PartyNames = [],
  registry?: Registry | null,
  spells: SpellIndex = NO_SPELLS,
): FeedItem[] {
  const items: FeedItem[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event.t > t) continue;
    if (!isKnownEvent(event)) continue;
    const item = toFeedItem(event, i, party, registry, spells);
    if (item) items.push(item);
  }
  return items.slice(-n).reverse();
}

/** The sponsor whose window contains the playhead; the latest one wins on overlap. */
export function activeSponsor(
  events: readonly AnyEvent[],
  t: number,
  party: PartyNames = [],
): FeedItem | null {
  let active: FeedItem | null = null;
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event.type !== 'sponsor') continue;
    if (event.t <= t && t < event.t + event.durationSec) {
      active = toFeedItem(event, i, party);
    }
  }
  return active;
}

/**
 * The achievement toast queue, expressed as a pure function of the playhead:
 * `start_i = max(t_i, end_{i-1})`, `end_i = start_i + 6` (research R5).
 */
export function activeToast(
  events: readonly AnyEvent[],
  t: number,
  party: PartyNames = [],
): Toast | null {
  let previousEnd = -Infinity;
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event.type !== 'achievement') continue;
    const start = Math.max(event.t, previousEnd);
    const end = start + TOAST_DURATION_SEC;
    previousEnd = end;
    if (start <= t && t < end) {
      const actorName = nameOf(party, event.actor);
      return {
        id: i,
        title: event.title,
        ...(event.desc !== undefined ? { desc: event.desc } : {}),
        ...(actorName !== undefined ? { actorName } : {}),
        start,
        end,
      };
    }
  }
  return null;
}

/** Chapter, achievement, and level-up markers positioned by `t / durationSec` (FR-040). */
export function timelineMarkers(
  events: readonly AnyEvent[],
  durationSec: number,
  party: PartyNames = [],
): Marker[] {
  const span = durationSec > 0 ? durationSec : 1;
  const markers: Marker[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    let kind: MarkerKind;
    let label: string;
    if (event.type === 'chapter') {
      kind = markerKind(event.kind);
      label = event.label;
    } else if (event.type === 'achievement') {
      kind = 'achievement';
      label = event.title;
    } else if (event.type === 'level_up') {
      kind = 'levelup';
      label = copy.feedText.markerLevelUp(nameOf(party, event.actor) ?? '', event.level);
    } else {
      continue;
    }
    markers.push({
      id: i,
      t: event.t,
      pos: Math.min(1, Math.max(0, event.t / span)),
      kind,
      color: markerColor(kind),
      label,
    });
  }
  return markers;
}

export function mapCells(state: OverlayState): MapCellsView {
  const { cols, rows } = state.map.grid;
  return {
    floor: state.map.floor,
    cols,
    rows,
    revealed: new Set(state.map.revealed.map((cell) => cellKey(cell[0], cell[1]))),
    total: cols * rows,
  };
}

/**
 * Cells whose `map_reveal` landed within the last `windowSec` seconds
 * (`t_e <= t < t_e + windowSec`). The minimap uses it to tint just-revealed
 * sectors - a pure function of the playhead, so a backward seek un-tints them
 * without any timer (research R5, T034).
 */
export function recentlyRevealed(
  events: readonly AnyEvent[],
  t: number,
  windowSec = 5,
): Set<string> {
  const recent = new Set<string>();
  for (const event of events) {
    if (event.type !== 'map_reveal') continue;
    if (event.t <= t && t < event.t + windowSec) {
      for (const cell of event.cells) recent.add(cellKey(cell[0], cell[1]));
    }
  }
  return recent;
}

/* ------------------------------------------------------------- v2 selectors */

/**
 * One crawler's elapsed, known events, newest first and uncapped - the dossier's
 * HISTORY section (data-model §3). Party-scoped events belong to no crawler.
 */
export function crawlerHistory(
  events: readonly AnyEvent[],
  t: number,
  actorId: string,
  party: PartyNames = [],
  registry?: Registry | null,
  spells: SpellIndex = NO_SPELLS,
): FeedItem[] {
  const items: FeedItem[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event.t > t) continue;
    if (!isKnownEvent(event)) continue;
    if (!('actor' in event) || event.actor !== actorId) continue;
    const item = toFeedItem(event, i, party, registry, spells);
    if (item) items.push(item);
  }
  return items.reverse();
}

/** Elapsed rank events for one crawler, oldest first (FR-140; T334). */
export function rankSeries(
  events: readonly AnyEvent[],
  t: number,
  actorId: string,
): RankSeries {
  const points: RankPoint[] = [];
  for (const event of events) {
    if (event.type !== 'rank' || event.t > t) continue;
    if (event.actor !== actorId) continue;
    points.push({ t: event.t, rank: event.rank });
  }
  if (points.length === 0) return { points, current: null, best: null };
  return {
    points,
    current: points[points.length - 1].rank,
    best: points.reduce((best, point) => Math.min(best, point.rank), Infinity),
  };
}

/**
 * The sheet's ten-segment HP strip: `ceil(current / max * 10)`, clamped, so any
 * living crawler keeps at least one segment and only 0 HP shows none (FR-110).
 */
export function hpSegments(hp: Hp): HpSegments {
  const max = hp.max > 0 ? hp.max : 1;
  const current = Math.min(Math.max(hp.current, 0), max);
  const ratio = current / max;
  return {
    filled: Math.min(10, Math.max(0, Math.ceil(ratio * 10))),
    pct: Math.round(ratio * 100),
  };
}

/** Everything the dossier renders as of `t`; `null` for an actor nobody knows. */
export function crawlerDossier(
  state: OverlayState,
  events: readonly AnyEvent[],
  t: number,
  actorId: string,
  party: PartyNames = state.party,
  spells: SpellIndex = NO_SPELLS,
): Dossier | null {
  const crawler = state.party.find((entry) => entry.id === actorId);
  if (crawler === undefined) return null;

  const achievements: DossierAchievement[] = [];
  for (const event of events) {
    if (event.type !== 'achievement' || event.t > t || event.actor !== actorId) continue;
    achievements.push({
      title: event.title,
      ...(event.desc === undefined ? {} : { desc: event.desc }),
      t: event.t,
    });
  }

  const max = crawler.hp.max > 0 ? crawler.hp.max : 1;
  const current = Math.min(Math.max(crawler.hp.current, 0), max);

  return {
    id: crawler.id,
    name: crawler.name,
    handle: crawler.handle,
    player: crawler.player,
    portrait: crawler.portrait,
    ...(crawler.race === undefined ? {} : { race: crawler.race }),
    ...(crawler.pronouns === undefined ? {} : { pronouns: crawler.pronouns }),
    ...(crawler.crawlerNumber === undefined ? {} : { crawlerNumber: crawler.crawlerNumber }),
    level: crawler.level,
    class: crawler.class,
    floor: state.map.floor,
    hp: { current, max: crawler.hp.max, ...hpSegments(crawler.hp) },
    rank: rankSeries(events, t, actorId),
    debuffs: crawler.statuses,
    ...(crawler.stats === undefined ? {} : { stats: crawler.stats }),
    ...(crawler.art === undefined ? {} : { art: crawler.art }),
    gear: crawler.gear,
    hotlist: crawler.hotlist.map((entry) => resolveHotlist(entry, spells)),
    skills: crawler.skills,
    spells: crawler.spells.map((entry) => resolveSpell(entry, spells)),
    inventory: crawler.inventory,
    achievements,
    history: crawlerHistory(events, t, actorId, party, undefined, spells),
  };
}

/**
 * One label per distinct neighborhood name among elapsed reveals, placed at the
 * centroid of the union of its cells and ordered by first reveal (FR-120).
 * Unlabeled reveals contribute nothing.
 */
export function mapLabels(events: readonly AnyEvent[], t: number): MapLabel[] {
  const groups = new Map<string, { cells: Map<string, [number, number]>; first: number }>();
  for (const event of events) {
    if (event.type !== 'map_reveal' || event.t > t) continue;
    if (event.label === undefined || event.label === '') continue;
    let group = groups.get(event.label);
    if (group === undefined) {
      group = { cells: new Map(), first: event.t };
      groups.set(event.label, group);
    }
    for (const cell of event.cells) {
      group.cells.set(cellKey(cell[0], cell[1]), [cell[0], cell[1]]);
    }
  }

  return [...groups.entries()]
    .sort((a, b) => a[1].first - b[1].first)
    .map(([label, group]) => {
      const cells = [...group.cells.values()];
      const rows = cells.reduce((sum, cell) => sum + cell[0], 0);
      const cols = cells.reduce((sum, cell) => sum + cell[1], 0);
      return {
        label,
        row: rows / cells.length,
        col: cols / cells.length,
        cells: cells.length,
      };
    });
}

/* ------------------------------------------------------- 003 glance card */

/**
 * The fixed-height rail card's view model (FR-200..FR-203): the same facts the
 * dossier holds, reduced to one line per list so the card cannot grow with the
 * episode.
 */
export interface Glance {
  id: string;
  name: string;
  handle: string;
  player: string;
  portrait: string;
  class: string | null;
  level: number;
  hp: Hp & HpSegments;
  rank: RankSeries;
  debuffs: string[];
  /** Worn gear in sheet order, accessories expanded one row each (R2-FR-201). */
  equipped: EquippedItem[];
  /** The newest achievement earned so far; absent when there is none. */
  latestAchievement?: DossierAchievement;
  /** At most three, newest first. */
  recentHistory: FeedItem[];
}

/** One worn item on the glance card: which slot, and what is in it. */
export interface EquippedItem {
  slot: GearSlot;
  item: string;
}

/** Sheet order for every gear view (glance rows, record section) (R2-FR-220). */
export const GEAR_SLOT_ORDER = [
  'head',
  'torso',
  'arms',
  'hands',
  'legs',
  'feet',
  'accessory',
] as const satisfies readonly GearSlot[];

/** The record's ten-slot hotbar, plus how many entries did not fit (R2-FR-221). */
export interface Hotbar {
  slots: (HotlistView | null)[];
  overflow: number;
}

/**
 * Pads the hotlist to `n` fixed slots and counts the rest, so the hotbar is a
 * pure function of the elapsed hotlist and never changes size (R2-FR-221).
 */
export function hotbarSlots(
  hotlist: readonly (HotlistEntry | HotlistView)[],
  n = 10,
  spells: SpellIndex = NO_SPELLS,
): Hotbar {
  // Already-resolved views pass straight through: `crawlerDossier` resolves the
  // whole hotlist, so the hotbar is only asked to pad and count.
  const views = hotlist.map((entry) => ('spell' in entry ? entry : resolveHotlist(entry, spells)));
  const slots: (HotlistView | null)[] = [];
  for (let i = 0; i < n; i += 1) slots.push(views[i] ?? null);
  return { slots, overflow: Math.max(0, views.length - n) };
}

/** Worn gear as rows: one per filled slot, then one per accessory. */
export function equippedItems(gear: GearState): EquippedItem[] {
  const rows: EquippedItem[] = [];
  for (const slot of GEAR_SLOT_ORDER) {
    if (slot === 'accessory') {
      for (const item of gear.accessories) rows.push({ slot, item });
      continue;
    }
    const item = gear[slot];
    if (item !== null) rows.push({ slot, item });
  }
  return rows;
}

/** The number of history rows the glance card always shows (research R4). */
export const GLANCE_HISTORY_ROWS = 3;

/**
 * The glance card's view model, derived from an already-elapsed `Dossier`, so it
 * inherits time-truth for free (constitution I, FR-202). "Newest" is the last
 * element of each current list - after a removal that is the most recently
 * gained item still held (research R3).
 */
export function crawlerGlance(dossier: Dossier): Glance {
  const achievements = dossier.achievements;
  const lastAchievement =
    achievements.length === 0 ? undefined : achievements[achievements.length - 1];

  return {
    id: dossier.id,
    name: dossier.name,
    handle: dossier.handle,
    player: dossier.player,
    portrait: dossier.portrait,
    class: dossier.class,
    level: dossier.level,
    hp: dossier.hp,
    rank: dossier.rank,
    debuffs: dossier.debuffs,
    equipped: equippedItems(dossier.gear),
    ...(lastAchievement === undefined ? {} : { latestAchievement: lastAchievement }),
    recentHistory: dossier.history.slice(0, GLANCE_HISTORY_ROWS),
  };
}

/* ---------------------------------------------------- 005 broadcast log */

/** Per-chip elapsed counts behind the log's filters (005 FR-402). */
export interface LogCounts {
  total: number;
  byType: Partial<Record<EventType, number>>;
  byActor: Record<string, number>;
}

/** What the viewer has selected. Empty sets mean "everything" (005 FR-402). */
export interface LogFilters {
  types: ReadonlySet<EventType>;
  actors: ReadonlySet<string>;
}

/**
 * Every elapsed known event, oldest first and uncapped - the broadcast log
 * (005 FR-401). The feed is a rolling eight-item window read newest-first; the
 * log is the whole transcript read top-down, so it is its own loop rather than
 * `feedItems` reversed: nothing here may ever be capped.
 *
 * Events arrive stable-sorted by `t` (`sortEvents`), so ties keep file order.
 */
export function logItems(
  events: readonly AnyEvent[],
  t: number,
  party: PartyNames = [],
  registry?: Registry | null,
  spells: SpellIndex = NO_SPELLS,
): FeedItem[] {
  const items: FeedItem[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event.t > t) continue;
    if (!isKnownEvent(event)) continue;
    const item = toFeedItem(event, i, party, registry, spells);
    if (item) items.push(item);
  }
  return items;
}

/**
 * How many elapsed rows each chip would match, counted on the *unfiltered*
 * elapsed log so the viewer can see what else is on offer (research R3).
 */
export function logCounts(items: readonly FeedItem[]): LogCounts {
  const byType: Partial<Record<EventType, number>> = {};
  const byActor: Record<string, number> = {};
  for (const item of items) {
    byType[item.kind] = (byType[item.kind] ?? 0) + 1;
    if (item.actorId !== undefined) byActor[item.actorId] = (byActor[item.actorId] ?? 0) + 1;
  }
  return { total: items.length, byType, byActor };
}

/**
 * Type-any AND crawler-any (005 FR-402). An empty set is no constraint; once a
 * crawler is selected, party-scoped rows (system, sponsor, chapter, map, note)
 * belong to nobody and drop out.
 */
export function applyLogFilters(
  items: readonly FeedItem[],
  { types, actors }: LogFilters,
): FeedItem[] {
  return items.filter(
    (item) =>
      (types.size === 0 || types.has(item.kind)) &&
      (actors.size === 0 || (item.actorId !== undefined && actors.has(item.actorId))),
  );
}

/* ------------------------------------------- 007 encounters + entity record */

/**
 * One chip on the Encountered strip, and the head of the entity record: what the
 * registry says about an entity joined to what the elapsed log says (FR-610).
 * Only facts unlocked at or before the playhead are carried, in registry order.
 */
export interface Encounter {
  id: string;
  name: string;
  kind: EntityKind;
  portrait?: string;
  floor?: number;
  intro: string;
  state: NpcState;
  unlockedFacts: EntityFact[];
}

/** The record panel (FR-611): an encounter plus every moment about it so far. */
export interface NpcRecordView extends Encounter {
  /** `npc` rows for this entity at or before the playhead, newest first. */
  moments: FeedItem[];
}

function toEncounter(entity: Entity, state: NpcState): Encounter {
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    ...(entity.portrait === undefined ? {} : { portrait: entity.portrait }),
    ...(entity.floor === undefined ? {} : { floor: entity.floor }),
    intro: entity.intro,
    state,
    unlockedFacts: entity.facts.filter((fact) => state.unlocked.includes(fact.id)),
  };
}

/**
 * The strip's chips, newest encounter first (FR-610). Entity state is already a
 * pure function of the playhead, so this inherits time-truth for free; an id the
 * registry does not carry has nothing to show and is left out - it stays in the
 * feed under its raw id (spec US1 scenario 5).
 */
export function encounteredNpcs(
  state: OverlayState,
  registry: Registry | null | undefined,
): Encounter[] {
  if (!registry) return [];
  const encounters: Encounter[] = [];
  for (const entity of registry.entities) {
    const npc = state.npcs[entity.id];
    if (npc === undefined) continue;
    encounters.push(toEncounter(entity, npc));
  }
  // Newest first; two entities touched in the same beat fall back to the newer
  // first meeting, then to the id, so the order never depends on object keys.
  return encounters.sort(
    (a, b) =>
      b.state.lastT - a.state.lastT ||
      b.state.firstMet - a.state.firstMet ||
      a.id.localeCompare(b.id),
  );
}

/** Every elapsed `npc` row about one entity, newest first (FR-611, research R4). */
export function npcMoments(
  events: readonly AnyEvent[],
  t: number,
  id: string,
  party: PartyNames = [],
  registry?: Registry | null,
  spells: SpellIndex = NO_SPELLS,
): FeedItem[] {
  const moments: FeedItem[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event.type !== 'npc' || event.t > t || event.id !== id) continue;
    const item = toFeedItem(event, i, party, registry, spells);
    if (item) moments.push(item);
  }
  return moments.reverse();
}

/**
 * Everything the record panel renders as of `t`; `null` for an entity the
 * registry does not carry, or one the party has not met yet (FR-611).
 */
export function npcRecord(
  state: OverlayState,
  events: readonly AnyEvent[],
  registry: Registry | null | undefined,
  id: string,
  party: PartyNames = [],
  t = 0,
): NpcRecordView | null {
  const entity = registry?.entities.find((candidate) => candidate.id === id);
  const npc = state.npcs[id];
  if (entity === undefined || npc === undefined) return null;
  return { ...toEncounter(entity, npc), moments: npcMoments(events, t, id, party, registry) };
}
