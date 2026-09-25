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

  /* Front door fields (011). Every one is optional: a show.json written before
     this feature still loads, and the hub ignores all of them. */
  /** ISO 8601. When the episode went up on YouTube. */
  premiereAt?: string;
  /**
   * ISO 8601. When the System feed (`/ep/:id`) unlocks for this episode.
   * Absent means "live now", so the sample episodes keep working (011 spec).
   */
  hubLiveAt?: string;
  /** One spoiler-safe sentence, shown on `/`, `/watch` and in meta tags. */
  summary?: string;
  /** Share image; defaults to `/og/ep{id}.png` when absent. */
  ogImage?: string;
}

export interface ShowLinks {
  youtube: string;
  discord: string;
  /* 011: the social row on `/community`. Absent means the platform is not shown. */
  tiktok?: string;
  bluesky?: string;
  instagram?: string;
}

export interface Show {
  title: string;
  seasons: Season[];
  episodes: EpisodeMeta[];
  links: ShowLinks;
  /**
   * Optional show-level entity registry (007, FR-600). A leading slash, resolved
   * against `BASE_URL` at fetch time exactly like `EpisodeMeta.dataUrl`. Absent
   * means the show has no registry: no strip, no tab, no `/registry` link.
   */
  registryUrl?: string;
  /**
   * Optional show-level spell registry (008 revision 4). Same rules as
   * `registryUrl`: a leading slash, resolved against `BASE_URL`. Absent means
   * no crawler sheet can carry a `ref`, and every spell entry stands alone.
   */
  spellsUrl?: string;

  /* Front door fields (011). Optional, and unread by the hub. */
  /** The H1 of the home page. */
  tagline?: string;
  /** The paragraph under the tagline: what the show is, in two sentences. */
  pitch?: string;
  /** "New crawls every other week." Shown on `/` and `/community`. */
  cadence?: string;
  /** The hero embed on `/`; falls back to the newest episode when absent. */
  trailerYoutubeId?: string;
}

/* ------------------------------------------------- front door (011) */

/** What the author writes about a crawler; the live numbers come from `status.json`. */
export type CrawlerLiveStatus = 'alive' | 'dead' | 'fused' | 'unknown';

export const CRAWLER_LIVE_STATUSES = [
  'alive',
  'dead',
  'fused',
  'unknown',
] as const satisfies readonly CrawlerLiveStatus[];

/** The real person behind a crawler. Everything but the name is optional. */
export interface CrawlerPlayer {
  name: string;
  pronouns?: string;
  bio?: string;
  /** Photo of the player, if they want one on the page. */
  bust?: string;
  links?: Record<string, string>;
}

/** The System text the crawler entered the dungeon with. */
export interface CrawlerEntryAchievement {
  title: string;
  text: string;
  box?: string;
  item?: string;
  /**
   * The verbatim reward paragraph, as the System read it out - what the box
   * contains and what the item does. Rendered under the "Reward: {box} -> {item}"
   * payout line; absent for an achievement that paid out nothing quotable.
   */
  reward?: string;
}

/**
 * One row of `crawlers.json` (011). `id` is the hub crawler id (`harry`, ...)
 * so the build-time `status.json` joins onto it without a mapping table.
 */
export interface CrawlerProfile {
  id: string;
  /** Archetype name: "The Stuntman". */
  name: string;
  characterName: string;
  handle: string;
  player: CrawlerPlayer;
  concept: string;
  /** "What was in their pockets when the world ended", one item per line. */
  pockets: string[];
  entryAchievement?: CrawlerEntryAchievement;
  art: { bust: string; full?: string };
  og?: string;
  status: CrawlerLiveStatus;
}

/** The whole `crawlers.json` file. `todo` is the author's fill-in list. */
export interface CrawlerRoster {
  crawlers: CrawlerProfile[];
  todo?: string[];
}

/** One crawler's live line, reduced from the newest published episode. */
export interface CrawlerStatus {
  level: number;
  hp: Hp;
  floor: number;
  lastEpisodeId: number;
}

/**
 * `dist/data/status.json`, generated at build time and never committed.
 * `episodeId` is `null` when no episode is past its `hubLiveAt` yet.
 */
export interface StatusFile {
  generatedAt: string;
  episodeId: number | null;
  crawlers: Record<string, CrawlerStatus>;
  /**
   * "Appears in", precomputed: crawler id -> the ids of every published episode
   * whose data names them, ascending. Undefined for a status file written
   * before 011 T1125, which is the signal to derive it on the client instead.
   */
  appearances?: Record<string, number[]>;
}

/**
 * The `<script id="__DCC__">` payload a prerendered page carries (011). `show`
 * and `crawlers` stay `unknown` because they go through the same validators the
 * fetched files do - an embedded blob is not more trusted than a fetched one.
 */
export interface Embedded {
  route: string;
  show: unknown;
  crawlers: unknown;
  status: StatusFile | null;
}

/* -------------------------------------------------------------- registry */

/**
 * The three kinds the author fixed (007 assumptions). Ordinary mobs are not
 * registry entities; `vendor` reads "Vendor / Guide" and `ally` "Ally / Faction".
 */
export type EntityKind = 'boss' | 'vendor' | 'ally';

export const ENTITY_KINDS = ['boss', 'vendor', 'ally'] as const satisfies readonly EntityKind[];

/** One unlockable line of an entity's file. `id` is what an `unlock` names. */
export interface EntityFact {
  id: string;
  text: string;
}

/** A registry entity (FR-600). `intro` is spoiler-free: it may show on first sight. */
export interface Entity {
  id: string;
  name: string;
  kind: EntityKind;
  portrait?: string;
  floor?: number;
  aliases?: string[];
  intro: string;
  facts: EntityFact[];
}

/** The whole `npcs.json` file: nothing but entities. */
export interface Registry {
  entities: Entity[];
}

/* -------------------------------------------------- spell registry (008 R4) */

/** An `Attack` needs a Spell Skill Check; a `Passive` simply happens. */
export type SpellKind = 'attack' | 'passive';

export const SPELL_KINDS = ['attack', 'passive'] as const satisfies readonly SpellKind[];

/** One UPGRADES line: "Rank 5: +1d4 base damage". */
export interface SpellUpgrade {
  rank: number;
  text: string;
}

/**
 * One row of the book's Spell Skills chapter (008 revision 4), transcribed as
 * the show's shared definition so a crawler sheet can point at it instead of
 * restating it. Every field but `id`, `name`, `kind`, `manaCost`,
 * `description` and `upgrades` is optional, because the book leaves them out.
 */
export interface SpellDef {
  id: string;
  name: string;
  /** Parenthesised alternatives on the headline ("Astral Hand, Astral Claw"). */
  aliases?: string[];
  /** The System's flavour line under the headline. */
  quote?: string;
  kind: SpellKind;
  /** "Interrupt" on the type line: the Spell can be cast out of turn. */
  interrupt?: boolean;
  /** Bludgeoning, Necrotic, Fire, Ice, Electric, Force, Sonic, ... */
  damageType?: string;
  areaOfEffect?: boolean;
  /** 0 is the book's "Mana Cost: None" (Protective Shell). */
  manaCost: number;
  range?: string;
  duration?: string;
  aiFavor?: number;
  limitations?: string;
  cooldown?: string;
  description: string;
  baseDamage?: string;
  /** Empty when the book says "None". */
  upgrades: SpellUpgrade[];
  /** The SPELLS CHART's d100 range, inclusive. */
  roll?: [number, number];
  page?: number;
}

/** The whole `spells.json` file: nothing but spell definitions. */
export interface SpellRegistry {
  spells: SpellDef[];
}

/* --------------------------------------------------------------- episode */

/** `[row, col]` into the floor grid. */
export type Cell = [number, number];

export interface Hp {
  current: number;
  max: number;
}

/** One row of the sheet's SKILLS section (v2, FR-113; `desc` added by 008 R2). */
export interface SkillEntry {
  name: string;
  rank?: number;
  /** The sheet's Notes column, shown in the tile's tooltip (008 R2). */
  desc?: string;
}

/**
 * One Hotlist mark (008 revision 2). The sheet writes a short name, sometimes a
 * count, and sometimes a paragraph explaining it; a plain string is still legal
 * everywhere and means `{ name }`.
 */
export interface HotlistEntry {
  /** Absent only when `ref` names a registry spell that supplies the name. */
  name?: string;
  /** A `SpellDef.id` (008 revision 4): the mark is a spell the book carries. */
  ref?: string;
  qty?: number;
  desc?: string;
}

/** One carried item (008 revision 2). Same shape, same string shorthand. */
export interface InventoryEntry {
  name: string;
  qty?: number;
  desc?: string;
}

/**
 * One inscribed spell (008 revision 2): the sheet's name, its rank, what it
 * costs to cast, and the full text the record shows in a tooltip.
 */
export interface SpellEntry {
  /** Absent only when `ref` names a registry spell that supplies the name. */
  name?: string;
  /**
   * A `SpellDef.id` (008 revision 4). The entry then inherits the book's name,
   * mana cost and text; `mana` and `desc` below stay explicit overrides, for
   * homebrew and scroll-only spells the registry has no row for.
   */
  ref?: string;
  rank?: number;
  mana?: number;
  desc?: string;
}

/**
 * The sheet's gear slots (003 revision 2, R2-FR-220). `accessory` is the one
 * slot that holds a list; every other slot holds at most one item.
 */
export type GearSlot = 'head' | 'torso' | 'arms' | 'hands' | 'legs' | 'feet' | 'accessory';

export const GEAR_SLOTS = [
  'head',
  'torso',
  'arms',
  'hands',
  'legs',
  'feet',
  'accessory',
] as const satisfies readonly GearSlot[];

/** A crawler's starting gear. Every field is optional; absent means empty. */
export interface Gear {
  head?: string;
  torso?: string;
  arms?: string;
  hands?: string;
  legs?: string;
  feet?: string;
  accessories?: string[];
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
  /** Strings are the v1 shorthand for `{ name }` (008 R2). */
  inventory: (string | InventoryEntry)[];
  rank: number | null;

  /* Optional sheet fields (v2, FR-113). Absent in every v1 file. */
  race?: string;
  pronouns?: string;
  crawlerNumber?: string | number;
  stats?: CrawlerStats;
  /**
   * Mana (009). Absent means the rule applies: max = `stats.int`, current = max
   * (see `fromInitialState`), so a sheet that never wrote a mana box still gets
   * one. Present, it wins verbatim - a sheet is allowed to disagree with the rule.
   */
  mana?: Hp;
  hotlist?: (string | HotlistEntry)[];
  skills?: SkillEntry[];
  /** The sheet's spell list (008 revision 2); absent means none inscribed. */
  spells?: SpellEntry[];

  /* Optional gear and art (003 revision 2, R2-FR-220/224). */
  /** Gear worn at t = 0; `equip`/`unequip` events move it from there. */
  gear?: Gear;
  /** Full-figure illustration path. The bust `portrait` stays for the rail. */
  art?: string;
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

/**
 * A mana reading (009), the `hp` event's shape with an optional `max`: a dip
 * that leaves the pool alone omits it and the reducer keeps the standing max.
 */
export interface ManaEvent extends EventBase {
  type: 'mana';
  actor: string;
  current: number;
  max?: number;
}

export interface LevelUpEvent extends EventBase {
  type: 'level_up';
  actor: string;
  level: number;
}

/**
 * One crawler's standing on the leaderboard. DCC has individual rank only -
 * there is no party rank (003 revision 2, T334; supersedes v1/v2 FR-141).
 */
export interface RankEvent extends EventBase {
  type: 'rank';
  actor: string;
  rank: number;
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

/**
 * Adds a spell, or amends it when rank, mana cost or text is given (008 R2).
 * Upserts by name, exactly like `skill`.
 */
export interface SpellEvent extends EventBase {
  type: 'spell';
  actor: string;
  /** Absent only when `ref` names a registry spell (008 revision 4). */
  name?: string;
  /** A `SpellDef.id`; the upsert key is `ref ?? name`. */
  ref?: string;
  rank?: number;
  mana?: number;
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

/* --- 003 revision 2 events (R2-FR-220). --- */

/** Wears `item` in `slot`; `accessory` appends to the accessory list. */
export interface EquipEvent extends EventBase {
  type: 'equip';
  actor: string;
  slot: GearSlot;
  item: string;
}

/** Clears `slot`; for `accessory`, removes `item` or the last accessory. */
export interface UnequipEvent extends EventBase {
  type: 'unequip';
  actor: string;
  slot: GearSlot;
  item?: string;
}

/* --- 007 events (FR-601). Old files simply do not carry them. --- */

/** What the System filed about an entity at this moment (research R2). */
export type NpcAction = 'met' | 'seen' | 'update' | 'defeated';

export const NPC_ACTIONS = [
  'met',
  'seen',
  'update',
  'defeated',
] as const satisfies readonly NpcAction[];

/**
 * One beat about a registry entity. `id` points at `Registry.entities[].id`;
 * an id the registry does not carry still renders in the feed under its raw id
 * (spec US1 scenario 5). `unlock` names facts on that entity.
 */
export interface NpcEvent extends EventBase {
  type: 'npc';
  id: string;
  action: NpcAction;
  note?: string;
  unlock?: string[];
  /** The crawler the beat belongs to, when it belongs to one. */
  actor?: string;
}

/** A well-formed event of a type this version understands. */
export type Event =
  | SystemMessageEvent
  | AchievementEvent
  | LootEvent
  | HpEvent
  | ManaEvent
  | LevelUpEvent
  | RankEvent
  | MapRevealEvent
  | SponsorEvent
  | ChapterEvent
  | StatusEvent
  | InventoryEvent
  | NoteEvent
  | SkillEvent
  | SpellEvent
  | ClassEvent
  | HotlistEvent
  | EquipEvent
  | UnequipEvent
  | NpcEvent;

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
  'mana',
  'level_up',
  'rank',
  'map_reveal',
  'sponsor',
  'chapter',
  'status',
  'inventory',
  'note',
  'skill',
  'spell',
  'class',
  'hotlist',
  'equip',
  'unequip',
  'npc',
] as const satisfies readonly EventType[];

export const CHAPTER_KINDS = ['boss', 'loot', 'achievement', 'levelup', 'story'] as const;

export function isKnownEvent(event: AnyEvent): event is Event {
  return event.type !== 'unknown';
}
