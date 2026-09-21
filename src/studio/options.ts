/**
 * What a form field is allowed to offer (010, FR-1003).
 *
 * Everything here derives from three sources and nothing else: the draft, the
 * show-level registries, and `reduceTo(draft, t)` - the viewer's own reducer,
 * so the Studio's pick lists can never disagree with what the viewer will show
 * (constitution VII, "same truth").
 *
 * Nothing in this module throws. A half-written draft is the normal state of an
 * episode being authored, so a draft `normalizeEpisode` rejects yields empty
 * options rather than an exception.
 */
import type { EpisodeData, Entity, Registry, SpellRegistry } from '../data/types';
import { CHAPTER_KINDS, GEAR_SLOTS, NPC_ACTIONS } from '../data/types';
import { normalizeEpisode } from '../data/validate';
import { reduceTo } from '../engine/reducer';
import type { CrawlerState, OverlayState } from '../engine/state';
import type { StudioDraft } from './draft';
import { draftParty, toEpisodeData } from './draft';
import type { EntryKind, FieldSpec } from './eventForms';

/** The show-level files the Studio loads alongside an episode. Both optional. */
export interface StudioRegistries {
  npcs?: Registry | null;
  spells?: SpellRegistry | null;
}

export const NO_REGISTRIES: StudioRegistries = {};

/** One choice in a picker: the value written to the event, and what to read. */
export interface Option {
  value: string;
  label: string;
  /** A second line - a crawler's handle, a spell's cost, an entry's quantity. */
  hint?: string;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function str(x: unknown): string | undefined {
  return typeof x === 'string' && x !== '' ? x : undefined;
}

/* ------------------------------------------------------- draft-derived */

/**
 * The draft as normalized episode data, or `null` when it is not there yet
 * (no party, a malformed initial state - both normal mid-edit).
 */
export function episodeAt(draft: StudioDraft): EpisodeData | null {
  try {
    return normalizeEpisode(toEpisodeData(draft));
  } catch {
    return null;
  }
}

/** Overlay state at `t`, by the viewer's reducer. `null` when the draft cannot normalize. */
export function stateAt(draft: StudioDraft, t: number): OverlayState | null {
  const episode = episodeAt(draft);
  if (episode === null) return null;
  try {
    return reduceTo(episode, t);
  } catch {
    return null;
  }
}

export function crawlerAt(state: OverlayState | null, actorId: string | undefined): CrawlerState | null {
  if (state === null || actorId === undefined || actorId === '') return null;
  return state.party.find((crawler) => crawler.id === actorId) ?? null;
}

/**
 * The party, read from the *raw* initial state: the author has to be able to
 * pick a crawler before the draft is complete enough to normalize.
 */
export function actorOptions(draft: StudioDraft): Option[] {
  const options: Option[] = [];
  for (const raw of draftParty(draft)) {
    if (!isRecord(raw)) continue;
    const id = str(raw.id);
    if (id === undefined) continue;
    const name = str(raw.name) ?? id;
    const handle = str(raw.handle);
    options.push({ value: id, label: name, ...(handle === undefined ? {} : { hint: handle }) });
  }
  return options;
}

/** Distinct neighborhood names already used by this draft's map reveals. */
export function roomOptions(draft: StudioDraft): Option[] {
  const seen = new Set<string>();
  const options: Option[] = [];
  for (const { event } of draft.events) {
    if (event.type !== 'map_reveal') continue;
    const label = str(event.label);
    if (label === undefined || seen.has(label)) continue;
    seen.add(label);
    options.push({ value: label, label });
  }
  return options;
}

/* ---------------------------------------------------- registry-derived */

export function spellOptions(registries: StudioRegistries = NO_REGISTRIES): Option[] {
  const spells = registries.spells?.spells;
  if (!Array.isArray(spells)) return [];
  return spells
    .filter((spell) => typeof spell?.id === 'string' && spell.id !== '')
    .map((spell) => ({
      value: spell.id,
      label: spell.name ?? spell.id,
      hint: `${spell.kind === 'attack' ? 'Attack' : 'Passive'} · ${spell.manaCost} mana`,
    }));
}

export function npcOptions(registries: StudioRegistries = NO_REGISTRIES): Option[] {
  const entities = registries.npcs?.entities;
  if (!Array.isArray(entities)) return [];
  return entities
    .filter((entity) => typeof entity?.id === 'string' && entity.id !== '')
    .map((entity) => ({
      value: entity.id,
      label: entity.name ?? entity.id,
      hint: entity.kind,
    }));
}

function entityById(registries: StudioRegistries, id: string | undefined): Entity | undefined {
  if (id === undefined || id === '') return undefined;
  const entities = registries.npcs?.entities;
  if (!Array.isArray(entities)) return undefined;
  return entities.find((entity) => entity.id === id);
}

/** The fact ids an `npc` event may unlock, for the entity it is about. */
export function factOptions(
  registries: StudioRegistries = NO_REGISTRIES,
  npcId?: string,
): Option[] {
  const entity = entityById(registries, npcId);
  if (entity === undefined || !Array.isArray(entity.facts)) return [];
  return entity.facts.map((fact) => ({ value: fact.id, label: fact.id, hint: fact.text }));
}

/* --------------------------------------------------------- fixed lists */

export function slotOptions(): Option[] {
  return GEAR_SLOTS.map((slot) => ({ value: slot, label: slot }));
}

export function chapterKindOptions(): Option[] {
  return CHAPTER_KINDS.map((kind) => ({ value: kind, label: kind }));
}

export function npcActionOptions(): Option[] {
  return NPC_ACTIONS.map((action) => ({ value: action, label: action }));
}

/* ------------------------------------------------------ state-derived */

function entryOptions(
  entries: readonly { name?: string; ref?: string; qty?: number }[] | undefined,
): Option[] {
  const options: Option[] = [];
  for (const entry of entries ?? []) {
    // The reducer removes an entry by its name *or* its registry ref, so the
    // value offered is whichever one the author wrote (name wins).
    const value = entry.name ?? entry.ref;
    if (value === undefined || value === '') continue;
    const hint = entry.qty === undefined ? entry.ref : `×${entry.qty}`;
    options.push({ value, label: value, ...(hint === undefined ? {} : { hint }) });
  }
  return options;
}

/**
 * What the actor can actually lose at this moment: carried items, hotlist
 * marks, standing statuses, or worn gear. Empty when the actor is unknown.
 */
export function removableEntries(
  state: OverlayState | null,
  actorId: string | undefined,
  kind: EntryKind,
): Option[] {
  const crawler = crawlerAt(state, actorId);
  if (crawler === null) return [];
  switch (kind) {
    case 'inventory':
      return entryOptions(crawler.inventory);
    case 'hotlist':
      return entryOptions(crawler.hotlist);
    case 'status':
      return crawler.statuses.map((status) => ({ value: status, label: status }));
    case 'gear': {
      const worn: Option[] = [];
      for (const slot of ['head', 'torso', 'arms', 'hands', 'legs', 'feet'] as const) {
        const item = crawler.gear[slot];
        if (item !== null) worn.push({ value: item, label: item, hint: slot });
      }
      for (const item of crawler.gear.accessories) {
        worn.push({ value: item, label: item, hint: 'accessory' });
      }
      return worn;
    }
    default:
      return [];
  }
}

/* ------------------------------------------------------------ one call */

/** What a field needs to know to answer "what may I offer?". */
export interface OptionContext {
  draft: StudioDraft;
  registries?: StudioRegistries;
  /** Overlay state at the event's time; pass `stateAt(draft, t)`. */
  state?: OverlayState | null;
  /** The actor currently chosen in the form, for the entry pick lists. */
  actorId?: string;
  /** The entity currently chosen in the form, for `npc.unlock`. */
  npcId?: string;
}

/**
 * The options for one field. The form never has to know which source a kind
 * comes from - it asks here.
 */
export function optionsFor(field: FieldSpec, ctx: OptionContext): Option[] {
  const registries = ctx.registries ?? NO_REGISTRIES;
  switch (field.kind) {
    case 'actor':
      return actorOptions(ctx.draft);
    case 'spellRef':
      return spellOptions(registries);
    case 'npcRef':
      return npcOptions(registries);
    case 'factRefs':
      return factOptions(registries, ctx.npcId);
    case 'slot':
      return slotOptions();
    case 'chapterKind':
      return chapterKindOptions();
    case 'room':
      return roomOptions(ctx.draft);
    case 'select':
      return (field.options ?? []).map((value) => ({ value, label: value }));
    case 'entryRemove':
    case 'text':
      return field.entryKind === undefined
        ? []
        : removableEntries(ctx.state ?? null, ctx.actorId, field.entryKind);
    default:
      return [];
  }
}
