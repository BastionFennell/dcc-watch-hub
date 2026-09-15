/**
 * Static data contracts. Framework-free: this module is imported by the engine,
 * the app, and the authoring script alike (constitution: Author-Friendly Data Pipeline).
 *
 * Source of truth: dcc-watch-hub-spec.md §4 and
 * specs/001-watch-hub-v1/contracts/{show,episode}.schema.json
 */

/* ------------------------------------------------------------------ show */

export interface Floor {
  floor: number;
  label: string;
  episodes: number[];
}

export interface Season {
  season: number;
  floors: Floor[];
}

export interface EpisodeMeta {
  id: number;
  title: string;
  youtubeId: string;
  floor: number;
  durationSec: number;
  dataUrl: string;
}

export interface ShowLinks {
  youtube: string;
  discord: string;
}

export interface Show {
  title: string;
  seasons: Season[];
  episodes: EpisodeMeta[];
  links: ShowLinks;
}

/* --------------------------------------------------------------- episode */

/** `[row, col]` into the floor grid. */
export type Cell = [number, number];

export interface Hp {
  current: number;
  max: number;
}

/** One row of the sheet's SKILLS section (v2, FR-113). */
export interface SkillEntry {
  name: string;
  rank?: number;
}

/** The sheet's five stats. All five are present or the block is absent (v2, FR-113). */
export interface CrawlerStats {
  str: number;
  int: number;
  con: number;
  dex: number;
  cha: number;
}

export interface Crawler {
  id: string;
  name: string;
  handle: string;
  player: string;
  level: number;
  hp: Hp;
  portrait: string;
  class: string | null;
  inventory: string[];
  rank: number | null;

  /* Optional sheet fields (v2, FR-113). Absent in every v1 file. */
  race?: string;
  pronouns?: string;
  crawlerNumber?: string | number;
  stats?: CrawlerStats;
  hotlist?: string[];
  skills?: SkillEntry[];
}

export interface Grid {
  cols: number;
  rows: number;
}

export interface MapState {
  floor: number;
  grid: Grid;
  revealed: Cell[];
}

export interface InitialState {
  party: Crawler[];
  partyRank: number | null;
  map: MapState;
}

export interface EpisodeData {
  episodeId: number;
  initialState: InitialState;
  events: AnyEvent[];
}

/* ----------------------------------------------------------------- events */

interface EventBase {
  /** Seconds into the final edited video. Never negative. */
  t: number;
}

export interface SystemMessageEvent extends EventBase {
  type: 'system_message';
  text: string;
}

export interface AchievementEvent extends EventBase {
  type: 'achievement';
  actor: string;
  title: string;
  desc?: string;
}

export interface LootEvent extends EventBase {
  type: 'loot';
  actor: string;
  item: string;
  source?: string;
}

export interface HpEvent extends EventBase {
  type: 'hp';
  actor: string;
  current: number;
  max: number;
}

export interface LevelUpEvent extends EventBase {
  type: 'level_up';
  actor: string;
  level: number;
}

export type RankScope = 'party' | 'crawler';

export interface RankEvent extends EventBase {
  type: 'rank';
  scope: RankScope;
  rank: number;
  actor?: string;
}

export interface MapRevealEvent extends EventBase {
  type: 'map_reveal';
  cells: Cell[];
  label?: string;
}

export interface SponsorEvent extends EventBase {
  type: 'sponsor';
  text: string;
  durationSec: number;
}

export type ChapterKind = 'boss' | 'loot' | 'achievement' | 'levelup' | 'story';

export interface ChapterEvent extends EventBase {
  type: 'chapter';
  label: string;
  kind: string;
}

export interface StatusEvent extends EventBase {
  type: 'status';
  actor: string;
  add: string[];
  remove: string[];
}

export interface InventoryEvent extends EventBase {
  type: 'inventory';
  actor: string;
  add: string[];
  remove: string[];
}

export interface NoteEvent extends EventBase {
  type: 'note';
  text: string;
}

/* --- v2 events (FR-112). Old files simply do not carry them. --- */

/** Adds a skill, or updates its rank when one is given. */
export interface SkillEvent extends EventBase {
  type: 'skill';
  actor: string;
  name: string;
  rank?: number;
  desc?: string;
}

export interface ClassEvent extends EventBase {
  type: 'class';
  actor: string;
  class: string;
}

export interface HotlistEvent extends EventBase {
  type: 'hotlist';
  actor: string;
  add: string[];
  remove: string[];
}

/** A well-formed event of a type this version understands. */
export type Event =
  | SystemMessageEvent
  | AchievementEvent
  | LootEvent
  | HpEvent
  | LevelUpEvent
  | RankEvent
  | MapRevealEvent
  | SponsorEvent
  | ChapterEvent
  | StatusEvent
  | InventoryEvent
  | NoteEvent
  | SkillEvent
  | ClassEvent
  | HotlistEvent;

/**
 * Anything the reducer, feed, toast, and timeline must ignore without crashing:
 * a future schema's event type, or a known type missing required fields (FR-006).
 */
export interface UnknownEvent extends EventBase {
  type: 'unknown';
  raw: unknown;
}

export type AnyEvent = Event | UnknownEvent;

export type EventType = Event['type'];

export const KNOWN_EVENT_TYPES = [
  'system_message',
  'achievement',
  'loot',
  'hp',
  'level_up',
  'rank',
  'map_reveal',
  'sponsor',
  'chapter',
  'status',
  'inventory',
  'note',
  'skill',
  'class',
  'hotlist',
] as const satisfies readonly EventType[];

export const CHAPTER_KINDS = ['boss', 'loot', 'achievement', 'levelup', 'story'] as const;

export function isKnownEvent(event: AnyEvent): event is Event {
  return event.type !== 'unknown';
}
