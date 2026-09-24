/**
 * Smart defaults for a new event (010, FR-1004).
 *
 * The author is marking a moment, not filling a form: the numbers a type needs
 * are usually the ones the crawler already has at that second. Everything here
 * reads `reduceTo(draft, t)` through `options.stateAt`, so a default can never
 * disagree with the overlay the viewer will compute.
 */
import type { EventType } from '../data/types';
import type { OverlayState } from '../engine/state';
import { entryKey } from '../engine/spells';
import type { FieldValues } from './eventForms';
import { EVENT_FORMS } from './eventForms';
import type { StudioRegistries } from './options';
import { crawlerAt } from './options';

function hasActorField(type: EventType): boolean {
  return EVENT_FORMS[type].fields.some((field) => field.key === 'actor');
}

/**
 * The rank a `skill` or `spell` event should offer for `key`: one past what the
 * actor holds, or nothing when they do not hold it yet (a first inscription has
 * no rank to advance). `key` is a skill name, or a spell's `ref ?? name`.
 */
export function nextRankFor(
  state: OverlayState | null,
  actorId: string | undefined,
  kind: 'skill' | 'spell',
  key: string | undefined,
): number | undefined {
  const crawler = crawlerAt(state, actorId);
  if (crawler === null || key === undefined || key === '') return undefined;
  const entry =
    kind === 'skill'
      ? crawler.skills.find((skill) => skill.name === key)
      : crawler.spells.find((spell) => entryKey(spell) === key);
  if (entry === undefined) return undefined;
  return (entry.rank ?? 0) + 1;
}

/**
 * The values a fresh form of `type` opens with. Only fields the state can
 * actually answer are filled; everything else is left for the author.
 *
 * `registries` is accepted so a later wave can seed registry-backed fields; the
 * defaults below need only the draft's own state.
 */
export function defaultsFor(
  type: EventType,
  actorId: string | undefined,
  state: OverlayState | null,
  _registries?: StudioRegistries,
): FieldValues {
  const crawler = crawlerAt(state, actorId);
  const values: FieldValues = {};
  if (actorId !== undefined && actorId !== '' && hasActorField(type)) values.actor = actorId;

  switch (type) {
    case 'hp':
      if (crawler !== null) {
        values.current = crawler.hp.current;
        values.max = crawler.hp.max;
      }
      break;

    case 'mana':
      if (crawler !== null && crawler.mana.max > 0) {
        values.current = crawler.mana.current;
        values.max = crawler.mana.max;
      }
      break;

    case 'level_up':
      if (crawler !== null) values.level = crawler.level + 1;
      break;

    case 'rank':
      if (crawler !== null && crawler.rank !== null) values.rank = crawler.rank;
      break;

    case 'class':
      if (crawler !== null && crawler.class !== null) values.class = crawler.class;
      break;

    case 'chapter':
      values.kind = 'story';
      break;

    case 'npc':
      values.action = 'met';
      // `npc.actor` is the one optional actor field: an entity beat usually
      // belongs to the party, not to one crawler, so it starts blank.
      delete values.actor;
      break;

    case 'status':
    case 'inventory':
    case 'hotlist':
      values.add = [];
      values.remove = [];
      break;

    case 'map_reveal':
      values.cells = [];
      break;

    default:
      break;
  }

  return values;
}
