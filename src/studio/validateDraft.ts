/**
 * The issues list behind the Studio's Issues tab (010, FR-1006 / US6).
 *
 * It runs the viewer's own `normalizeEvent` over the draft, so "the viewer will
 * ignore this row" is not a guess - it is the same call the episode loader
 * makes. Everything else it checks is a cross-reference the loader deliberately
 * does not make (an actor who is not in the party, a spell id the registry has
 * not got), because at runtime those are survivable and at authoring time they
 * are almost always a typo.
 *
 * Severity: an `error` means the exported file will not say what the author
 * meant (a row the reducer drops, an actor nobody will match, a time outside
 * the video, missing meta). A `warning` means the file is valid but suspicious
 * (a type this build does not know, a ref no loaded registry carries, a row
 * entered twice, a duration nobody has filled in, an empty party).
 */
import { KNOWN_EVENT_TYPES } from '../data/types';
import { normalizeEpisode, normalizeEvent } from '../data/validate';
import type { RawEvent, StudioDraft } from './draft';
import { draftParty, toEpisodeData } from './draft';
import { eventTypeLabel } from './eventForms';
import type { StudioRegistries } from './options';
import { NO_REGISTRIES } from './options';
import { formatTimecode } from './timecode';

export type IssueSeverity = 'error' | 'warning';

export interface Issue {
  severity: IssueSeverity;
  message: string;
  /** The event the issue is about; absent for meta and party issues. */
  uid?: string;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Key-sorted JSON, so two events that say the same thing hash the same. */
function stableKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableKey(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function partyIds(draft: StudioDraft): Set<string> {
  const ids = new Set<string>();
  for (const raw of draftParty(draft)) {
    if (isRecord(raw) && typeof raw.id === 'string' && raw.id !== '') ids.add(raw.id);
  }
  return ids;
}

function where(event: RawEvent): string {
  return `${eventTypeLabel(event.type)} at ${formatTimecode(event.t)}`;
}

/**
 * Everything wrong with `draft`, meta first and then events in export order.
 * Never throws: a draft too broken to normalize is itself one of the findings.
 */
export function issuesFor(
  draft: StudioDraft,
  registries: StudioRegistries = NO_REGISTRIES,
): Issue[] {
  const issues: Issue[] = [];
  const { meta } = draft;

  /* ------------------------------------------------------------ the file */

  if (meta.youtubeId.trim() === '') {
    issues.push({ severity: 'error', message: 'The episode has no YouTube video id.' });
  }
  if (meta.title.trim() === '') {
    issues.push({ severity: 'error', message: 'The episode has no title.' });
  }
  if (!(meta.durationSec > 0)) {
    issues.push({
      severity: 'warning',
      message: 'The episode duration is 0. Load the video, or type it in, to check event times.',
    });
  }

  const ids = partyIds(draft);
  if (ids.size === 0) {
    issues.push({ severity: 'warning', message: 'The party is empty.' });
  }

  try {
    normalizeEpisode(toEpisodeData(draft));
  } catch (cause) {
    issues.push({
      severity: 'error',
      message: `The initial state is not valid episode data: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    });
  }

  /* ---------------------------------------------------------- the events */

  const spellIds = new Set((registries.spells?.spells ?? []).map((spell) => spell.id));
  const npcIds = new Set((registries.npcs?.entities ?? []).map((entity) => entity.id));
  const seen = new Map<string, string>();

  for (const { uid, event } of draft.events) {
    const known = (KNOWN_EVENT_TYPES as readonly string[]).includes(event.type);

    if (normalizeEvent(event).type === 'unknown') {
      issues.push(
        known
          ? {
              severity: 'error',
              message: `${where(event)} is missing something it needs; the viewer will ignore it.`,
              uid,
            }
          : {
              severity: 'warning',
              message: `${where(event)} is a type this build does not know. It stays in the file and the viewer ignores it.`,
              uid,
            },
      );
    }

    if (!(event.t >= 0)) {
      issues.push({ severity: 'error', message: `${where(event)} has a negative time.`, uid });
    } else if (meta.durationSec > 0 && event.t > meta.durationSec) {
      issues.push({
        severity: 'error',
        message: `${where(event)} is past the end of the video (${formatTimecode(meta.durationSec)}).`,
        uid,
      });
    }

    if (typeof event.actor === 'string' && event.actor !== '' && !ids.has(event.actor)) {
      issues.push({
        severity: 'error',
        message: `${where(event)} names "${event.actor}", who is not in the party.`,
        uid,
      });
    }

    if (
      registries.spells != null &&
      typeof event.ref === 'string' &&
      event.ref !== '' &&
      !spellIds.has(event.ref)
    ) {
      issues.push({
        severity: 'warning',
        message: `${where(event)} points at spell "${event.ref}", which the spell registry has not got.`,
        uid,
      });
    }

    if (
      registries.npcs != null &&
      event.type === 'npc' &&
      typeof event.id === 'string' &&
      event.id !== '' &&
      !npcIds.has(event.id)
    ) {
      issues.push({
        severity: 'warning',
        message: `${where(event)} is about "${event.id}", which the entity registry has not got.`,
        uid,
      });
    }

    const key = stableKey(event);
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, uid);
    } else {
      issues.push({
        severity: 'warning',
        message: `${where(event)} is an exact duplicate of an earlier event.`,
        uid,
      });
    }
  }

  return issues;
}

export function countIssues(issues: readonly Issue[]): { errors: number; warnings: number } {
  return {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
  };
}
