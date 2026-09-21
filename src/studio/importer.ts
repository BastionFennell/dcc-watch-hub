/**
 * Episode JSON -> draft (010, FR-1010).
 *
 * Deliberately more forgiving than `normalizeEpisode`: the author may open a
 * file that is half finished, or one from a later schema, and the Studio has to
 * show it rather than refuse it. Anything the import could not make sense of
 * comes back as a warning, not an exception - only JSON that is not an episode
 * envelope at all throws.
 */
import { KNOWN_EVENT_TYPES } from '../data/types';
import { normalizeEvent } from '../data/validate';
import type { DraftMeta, RawEvent, StudioDraft } from './draft';
import { draftFromEpisode } from './draft';
import { formatTimecode } from './timecode';

export interface ImportResult {
  draft: StudioDraft;
  warnings: string[];
}

export class StudioImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudioImportError';
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function parse(raw: string | unknown): Record<string, unknown> {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch (cause) {
      throw new StudioImportError(
        `That file is not JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }
  if (!isRecord(value)) throw new StudioImportError('That file is not an episode object.');
  if (!Array.isArray(value.events)) {
    throw new StudioImportError('That file has no "events" array, so it is not an episode.');
  }
  return value;
}

function floorOf(initialState: unknown): number | undefined {
  if (!isRecord(initialState) || !isRecord(initialState.map)) return undefined;
  const floor = initialState.map.floor;
  return typeof floor === 'number' && Number.isFinite(floor) ? floor : undefined;
}

/**
 * A draft for `raw`. `metaGuess` wins over anything read from the file, which
 * is how a published episode brings its `show.json` row (title, video id,
 * duration) along with it.
 */
export function fromEpisodeJson(
  raw: string | unknown,
  metaGuess: Partial<DraftMeta> = {},
): ImportResult {
  const episode = parse(raw);
  const warnings: string[] = [];

  const fileId =
    typeof episode.episodeId === 'number' && Number.isInteger(episode.episodeId)
      ? episode.episodeId
      : undefined;
  if (fileId === undefined) warnings.push('The file has no episodeId; the draft starts at 0.');
  if (metaGuess.id !== undefined && fileId !== undefined && metaGuess.id !== fileId) {
    warnings.push(
      `The file says episode ${fileId} but it was opened as episode ${metaGuess.id}; the draft keeps ${metaGuess.id}.`,
    );
  }

  const id = metaGuess.id ?? fileId ?? 0;
  const meta: DraftMeta = {
    id,
    title: metaGuess.title ?? (id === 0 ? 'Untitled episode' : `Episode ${id}`),
    youtubeId: metaGuess.youtubeId ?? '',
    floor: metaGuess.floor ?? floorOf(episode.initialState) ?? 1,
    durationSec: metaGuess.durationSec ?? 0,
  };
  if (meta.youtubeId === '') {
    warnings.push('No video id came with the file; set one before exporting.');
  }

  const events = episode.events as unknown[];
  const usable: unknown[] = [];
  let dropped = 0;
  for (const item of events) {
    if (isRecord(item) && typeof item.type === 'string' && item.type !== '') usable.push(item);
    else dropped += 1;
  }
  if (dropped > 0) {
    warnings.push(`${dropped} row${dropped === 1 ? '' : 's'} had no usable time or type and were dropped.`);
  }

  if (!isRecord(episode.initialState)) {
    warnings.push('The file has no initial state; the draft starts with an empty party.');
  }

  const draft = draftFromEpisode(meta, { ...episode, events: usable });

  for (const { event } of draft.events) {
    if (normalizeEvent(event).type !== 'unknown') continue;
    const known = (KNOWN_EVENT_TYPES as readonly string[]).includes(event.type);
    warnings.push(
      known
        ? `The ${event.type} row at ${formatTimecode(event.t)} is missing something it needs.`
        : `The row at ${formatTimecode(event.t)} is of type "${event.type}", which this build does not know. It is kept verbatim.`,
    );
  }

  return { draft, warnings };
}

/** The raw events of a parsed episode, for callers that only want the log. */
export function eventsOf(episodeRaw: unknown): RawEvent[] {
  if (!isRecord(episodeRaw) || !Array.isArray(episodeRaw.events)) return [];
  const out: RawEvent[] = [];
  for (const item of episodeRaw.events as unknown[]) {
    if (!isRecord(item)) continue;
    const t = typeof item.t === 'number' ? item.t : Number(item.t);
    if (!Number.isFinite(t) || typeof item.type !== 'string') continue;
    out.push({ ...item, t, type: item.type });
  }
  return out;
}
