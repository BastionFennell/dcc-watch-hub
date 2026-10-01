/**
 * The one declarative table every event form is generated from (010, FR-1003).
 *
 * It must cover every member of `KNOWN_EVENT_TYPES` and every field
 * `normalizeEvent` accepts for that member - `eventForms.test.ts` fails if a
 * type is missing, and `buildEvent.test.ts` fails if a field is. Nothing here
 * knows about React: the table is data, the widgets come in Wave B.
 *
 * Copy here is plain and functional, not the System's voice: this is an
 * authoring tool, not a viewer surface (constitution VII).
 */
import type { EventType } from '../data/types';
import { CHAPTER_KINDS, GEAR_SLOTS, KNOWN_EVENT_TYPES, NPC_ACTIONS } from '../data/types';

/**
 * How a field is edited. Everything but `cells` and `factRefs` is in the plan's
 * contract; those two were added in Wave A because no listed kind can express
 * a grid-cell list (`map_reveal.cells`) or a pick list of the selected entity's
 * fact ids (`npc.unlock`). Both are documented in `specs/010-studio/plan.md`.
 */
export type FieldKind =
  | 'actor'
  | 'text'
  | 'longtext'
  | 'int'
  | 'select'
  | 'bool'
  | 'spellRef'
  | 'npcRef'
  | 'slot'
  | 'room'
  | 'chapterKind'
  | 'entryAdd'
  | 'entryRemove'
  | 'cells'
  | 'factRefs';

/**
 * Where a field's suggestions come from. On an `entryRemove` it is the pick
 * list; on a plain `text` field it is a datalist the author may ignore.
 */
export type EntryKind = 'inventory' | 'hotlist' | 'status' | 'gear';

export interface FieldSpec {
  key: string;
  kind: FieldKind;
  label: string;
  required?: boolean;
  min?: number;
  options?: readonly string[];
  help?: string;
  entryKind?: EntryKind;
}

export type FieldGroup = 'story' | 'crawler' | 'items' | 'abilities' | 'world';

export interface EventFormSpec {
  type: EventType;
  group: FieldGroup;
  label: string;
  fields: readonly FieldSpec[];
  /**
   * At least one of these keys must be filled. `spell` is the only type that
   * needs it: `normalizeEvent` takes a name, a registry ref, or both.
   */
  requireOneOf?: readonly string[];
}

/** Every value a form field can hold. `cells` is the only non-scalar shape. */
export type FieldValue = string | number | boolean | string[] | [number, number][] | undefined;

export type FieldValues = Record<string, FieldValue>;

const ACTOR: FieldSpec = { key: 'actor', kind: 'actor', label: 'Crawler', required: true };

export const EVENT_FORMS: Record<EventType, EventFormSpec> = {
  /* ------------------------------------------------------------- story */
  system_message: {
    type: 'system_message',
    group: 'story',
    label: 'System message',
    fields: [{ key: 'text', kind: 'longtext', label: 'Message', required: true }],
  },
  note: {
    type: 'note',
    group: 'story',
    label: 'Note',
    fields: [{ key: 'text', kind: 'longtext', label: 'Note', required: true }],
  },
  chapter: {
    type: 'chapter',
    group: 'story',
    label: 'Chapter marker',
    fields: [
      { key: 'label', kind: 'text', label: 'Chapter title', required: true },
      { key: 'kind', kind: 'chapterKind', label: 'Kind', required: true, options: CHAPTER_KINDS },
    ],
  },
  sponsor: {
    type: 'sponsor',
    group: 'story',
    label: 'Sponsor break',
    fields: [
      { key: 'text', kind: 'longtext', label: 'Sponsor copy', required: true },
      {
        key: 'durationSec',
        kind: 'int',
        label: 'On screen for (s)',
        required: true,
        min: 1,
        help: 'How long the slot stays in the feed.',
      },
    ],
  },

  /* ----------------------------------------------------------- crawler */
  hp: {
    type: 'hp',
    group: 'crawler',
    label: 'HB',
    fields: [
      ACTOR,
      {
        key: 'current',
        kind: 'int',
        label: 'HB slots (of 10)',
        required: true,
        min: 0,
        help: 'The health bar is ten slots. Log slots, not hit points.',
      },
      { key: 'max', kind: 'int', label: 'Slots on the bar', required: true, min: 1 },
    ],
  },
  mana: {
    type: 'mana',
    group: 'crawler',
    label: 'Mana',
    fields: [
      ACTOR,
      { key: 'current', kind: 'int', label: 'Current mana', required: true, min: 0 },
      {
        key: 'max',
        kind: 'int',
        label: 'Max mana',
        min: 1,
        help: 'Leave blank to keep the pool the crawler already has.',
      },
    ],
  },
  level_up: {
    type: 'level_up',
    group: 'crawler',
    label: 'Level up',
    fields: [ACTOR, { key: 'level', kind: 'int', label: 'New level', required: true, min: 1 }],
  },
  rank: {
    type: 'rank',
    group: 'crawler',
    label: 'Rank',
    fields: [ACTOR, { key: 'rank', kind: 'int', label: 'Leaderboard rank', required: true, min: 1 }],
  },
  achievement: {
    type: 'achievement',
    group: 'crawler',
    label: 'Achievement',
    fields: [
      ACTOR,
      { key: 'title', kind: 'text', label: 'Title', required: true },
      { key: 'desc', kind: 'longtext', label: 'Description' },
    ],
  },
  class: {
    type: 'class',
    group: 'crawler',
    label: 'Class',
    fields: [ACTOR, { key: 'class', kind: 'text', label: 'Class', required: true }],
  },
  status: {
    type: 'status',
    group: 'crawler',
    label: 'Status',
    fields: [
      ACTOR,
      { key: 'add', kind: 'entryAdd', label: 'Add', required: true, entryKind: 'status' },
      { key: 'remove', kind: 'entryRemove', label: 'Remove', required: true, entryKind: 'status' },
    ],
  },

  /* ------------------------------------------------------------- items */
  loot: {
    type: 'loot',
    group: 'items',
    label: 'Loot',
    fields: [
      ACTOR,
      { key: 'item', kind: 'text', label: 'Item', required: true },
      { key: 'source', kind: 'text', label: 'Source', help: 'Box, mob, vendor, ...' },
    ],
  },
  inventory: {
    type: 'inventory',
    group: 'items',
    label: 'Inventory',
    fields: [
      ACTOR,
      { key: 'add', kind: 'entryAdd', label: 'Add', required: true, entryKind: 'inventory' },
      {
        key: 'remove',
        kind: 'entryRemove',
        label: 'Remove',
        required: true,
        entryKind: 'inventory',
      },
    ],
  },
  equip: {
    type: 'equip',
    group: 'items',
    label: 'Equip',
    fields: [
      ACTOR,
      { key: 'slot', kind: 'slot', label: 'Slot', required: true, options: GEAR_SLOTS },
      { key: 'item', kind: 'text', label: 'Item', required: true },
    ],
  },
  unequip: {
    type: 'unequip',
    group: 'items',
    label: 'Unequip',
    fields: [
      ACTOR,
      { key: 'slot', kind: 'slot', label: 'Slot', required: true, options: GEAR_SLOTS },
      {
        key: 'item',
        kind: 'text',
        label: 'Item',
        entryKind: 'gear',
        help: 'Accessories only: blank removes the last one worn.',
      },
    ],
  },

  /* --------------------------------------------------------- abilities */
  skill: {
    type: 'skill',
    group: 'abilities',
    label: 'Skill',
    fields: [
      ACTOR,
      { key: 'name', kind: 'text', label: 'Skill', required: true },
      { key: 'rank', kind: 'int', label: 'Rank', min: 0 },
      { key: 'desc', kind: 'longtext', label: 'Notes' },
    ],
  },
  spell: {
    type: 'spell',
    group: 'abilities',
    label: 'Spell',
    requireOneOf: ['name', 'ref'],
    fields: [
      ACTOR,
      {
        key: 'ref',
        kind: 'spellRef',
        label: 'Registry spell',
        help: 'Inherits the name, cost and text from spells.json.',
      },
      { key: 'name', kind: 'text', label: 'Name', help: 'Only for a spell the registry has not got.' },
      { key: 'rank', kind: 'int', label: 'Rank', min: 0 },
      { key: 'mana', kind: 'int', label: 'Mana cost', min: 0 },
      { key: 'desc', kind: 'longtext', label: 'Text' },
    ],
  },
  hotlist: {
    type: 'hotlist',
    group: 'abilities',
    label: 'Hotlist',
    fields: [
      ACTOR,
      { key: 'add', kind: 'entryAdd', label: 'Add', required: true, entryKind: 'hotlist' },
      { key: 'remove', kind: 'entryRemove', label: 'Remove', required: true, entryKind: 'hotlist' },
    ],
  },

  /* ------------------------------------------------------------- world */
  map_reveal: {
    type: 'map_reveal',
    group: 'world',
    label: 'Map reveal',
    fields: [
      { key: 'cells', kind: 'cells', label: 'Cells', required: true, help: 'Row, column pairs.' },
      { key: 'label', kind: 'room', label: 'Neighborhood' },
    ],
  },
  npc: {
    type: 'npc',
    group: 'world',
    label: 'Entity',
    fields: [
      { key: 'id', kind: 'npcRef', label: 'Entity', required: true },
      { key: 'action', kind: 'select', label: 'Action', required: true, options: NPC_ACTIONS },
      { key: 'note', kind: 'longtext', label: 'Note' },
      { key: 'unlock', kind: 'factRefs', label: 'Unlock facts' },
      { key: 'actor', kind: 'actor', label: 'Crawler', help: 'Only when the beat belongs to one.' },
    ],
  },
};

export const FIELD_GROUPS = ['story', 'crawler', 'items', 'abilities', 'world'] as const;

export const GROUP_LABELS: Record<FieldGroup, string> = {
  story: 'Story',
  crawler: 'Crawler',
  items: 'Items',
  abilities: 'Abilities',
  world: 'World',
};

/** The table in group order, then table order inside each group. */
export function formsByGroup(): { group: FieldGroup; forms: EventFormSpec[] }[] {
  const all = KNOWN_EVENT_TYPES.map((type) => EVENT_FORMS[type]);
  return FIELD_GROUPS.map((group) => ({
    group,
    forms: all.filter((form) => form.group === group),
  }));
}

export function formFor(type: string): EventFormSpec | undefined {
  return (EVENT_FORMS as Record<string, EventFormSpec | undefined>)[type];
}

export function isKnownEventType(type: string): type is EventType {
  return (KNOWN_EVENT_TYPES as readonly string[]).includes(type);
}

/** The human label for a type, falling back to the raw type for a future one. */
export function eventTypeLabel(type: string): string {
  return formFor(type)?.label ?? type;
}
