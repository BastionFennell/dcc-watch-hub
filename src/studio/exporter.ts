/**
 * Draft -> the exact files the viewer loads (010, FR-1009).
 *
 * There is no second format: `toEpisodeJson` writes `ep{N}.json` as
 * `normalizeEpisode` will read it, and `toShowEntry` writes the row `show.json`
 * needs (constitution VII, "same truth").
 *
 * Two formatting rules exist for the diff's sake, not the parser's: two-space
 * indentation with a trailing newline, and a stable key order - `t`, `type`,
 * `actor`, then the fields in `EVENT_FORMS` order, then anything a later schema
 * added, in the order it arrived.
 */
import type { EpisodeMeta } from '../data/types';
import type { RawEpisode, RawEvent, StudioDraft } from './draft';
import { toEpisodeData } from './draft';
import { formFor } from './eventForms';

const LEADING_KEYS = ['t', 'type', 'actor'] as const;

/** One event with its keys in export order. Values are untouched. */
export function orderEventKeys(event: RawEvent): RawEvent {
  const form = formFor(event.type);
  const order: string[] = [...LEADING_KEYS];
  for (const field of form?.fields ?? []) {
    if (!order.includes(field.key)) order.push(field.key);
  }
  // A key the table does not know (a later schema's field) keeps its own place
  // at the end rather than being dropped: the Studio never eats data.
  for (const key of Object.keys(event)) {
    if (!order.includes(key)) order.push(key);
  }

  const ordered: Record<string, unknown> = {};
  for (const key of order) {
    if (event[key] === undefined) continue;
    ordered[key] = event[key];
  }
  return ordered as RawEvent;
}

/** The episode object the exporter serializes; events sorted and key-ordered. */
export function toExportEpisode(draft: StudioDraft): RawEpisode {
  const episode = toEpisodeData(draft);
  return {
    episodeId: episode.episodeId,
    initialState: episode.initialState,
    events: episode.events.map(orderEventKeys),
  };
}

/** `ep{N}.json`, ready to write. Two-space indent, one trailing newline. */
export function toEpisodeJson(draft: StudioDraft): string {
  return `${JSON.stringify(toExportEpisode(draft), null, 2)}\n`;
}

/** The file name the viewer expects for this episode. */
export function episodeFileName(draft: StudioDraft): string {
  return `ep${draft.meta.id}.json`;
}

/** The `show.json` row for this episode, in the schema's own key order. */
export function toShowEntry(draft: StudioDraft): EpisodeMeta {
  const { id, title, youtubeId, floor, durationSec } = draft.meta;
  return { id, title, youtubeId, floor, durationSec, dataUrl: `/data/ep${id}.json` };
}

/** The same row as text, for the header's "copy show entry" control (Wave C). */
export function toShowEntryJson(draft: StudioDraft): string {
  return `${JSON.stringify(toShowEntry(draft), null, 2)}\n`;
}
