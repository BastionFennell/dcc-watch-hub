/**
 * Runtime guards shared by the app loader and the authoring script.
 * Hand-written on purpose: zero runtime dependency (constitution IV).
 * The formal contract lives in specs/001-watch-hub-v1/contracts/*.schema.json.
 */
import type {
  AnyEvent,
  Cell,
  Crawler,
  EpisodeData,
  EpisodeMeta,
  InitialState,
  MapState,
  Show,
  UnknownEvent,
} from './types';

export class DataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataError';
  }
}

/* ------------------------------------------------------------- primitives */

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Accepts numbers and numeric strings (editors export everything as text). */
export function toNumber(x: unknown): number | null {
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  if (typeof x === 'string' && x.trim() !== '') {
    const n = Number(x.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toString_(x: unknown): string | null {
  if (typeof x === 'string') return x;
  if (typeof x === 'number' && Number.isFinite(x)) return String(x);
  return null;
}

function toStringList(x: unknown): string[] | null {
  if (!Array.isArray(x)) return null;
  const out: string[] = [];
  for (const item of x) {
    const s = toString_(item);
    if (s === null) return null;
    out.push(s);
  }
  return out;
}

function toCell(x: unknown): Cell | null {
  if (!Array.isArray(x) || x.length !== 2) return null;
  const r = toNumber(x[0]);
  const c = toNumber(x[1]);
  if (r === null || c === null) return null;
  return [r, c];
}

function toCells(x: unknown): Cell[] | null {
  if (!Array.isArray(x)) return null;
  const out: Cell[] = [];
  for (const item of x) {
    const cell = toCell(item);
    if (cell === null) return null;
    out.push(cell);
  }
  return out;
}

/* ----------------------------------------------------------- normalization */

function unknownEvent(t: number, raw: unknown): UnknownEvent {
  return { type: 'unknown', t, raw };
}

/**
 * Turns one raw JSON object into a well-typed event, or into an `UnknownEvent`
 * the rest of the app silently ignores. Never throws (FR-006).
 */
export function normalizeEvent(raw: unknown): AnyEvent {
  if (!isRecord(raw)) return unknownEvent(0, raw);

  const tRaw = toNumber(raw.t);
  const t = tRaw === null ? 0 : Math.max(0, tRaw);
  if (tRaw === null) return unknownEvent(0, raw);

  const type = typeof raw.type === 'string' ? raw.type : null;
  if (type === null) return unknownEvent(t, raw);

  const actor = typeof raw.actor === 'string' && raw.actor !== '' ? raw.actor : null;

  switch (type) {
    case 'system_message':
    case 'note': {
      const text = toString_(raw.text);
      if (text === null) return unknownEvent(t, raw);
      return { t, type, text };
    }
    case 'achievement': {
      const title = toString_(raw.title);
      if (actor === null || title === null) return unknownEvent(t, raw);
      const desc = toString_(raw.desc);
      return desc === null
        ? { t, type: 'achievement', actor, title }
        : { t, type: 'achievement', actor, title, desc };
    }
    case 'loot': {
      const item = toString_(raw.item);
      if (actor === null || item === null) return unknownEvent(t, raw);
      const source = toString_(raw.source);
      return source === null
        ? { t, type: 'loot', actor, item }
        : { t, type: 'loot', actor, item, source };
    }
    case 'hp': {
      const current = toNumber(raw.current);
      const max = toNumber(raw.max);
      if (actor === null || current === null || max === null || max <= 0) {
        return unknownEvent(t, raw);
      }
      return { t, type: 'hp', actor, current, max };
    }
    case 'level_up': {
      const level = toNumber(raw.level);
      if (actor === null || level === null) return unknownEvent(t, raw);
      return { t, type: 'level_up', actor, level };
    }
    case 'rank': {
      const rank = toNumber(raw.rank);
      const scope = raw.scope === 'party' || raw.scope === 'crawler' ? raw.scope : null;
      if (rank === null || scope === null) return unknownEvent(t, raw);
      if (scope === 'crawler' && actor === null) return unknownEvent(t, raw);
      return actor === null
        ? { t, type: 'rank', scope, rank }
        : { t, type: 'rank', scope, rank, actor };
    }
    case 'map_reveal': {
      const cells = toCells(raw.cells);
      if (cells === null) return unknownEvent(t, raw);
      const label = toString_(raw.label);
      return label === null
        ? { t, type: 'map_reveal', cells }
        : { t, type: 'map_reveal', cells, label };
    }
    case 'sponsor': {
      const text = toString_(raw.text);
      const durationSec = toNumber(raw.durationSec);
      if (text === null || durationSec === null || durationSec <= 0) {
        return unknownEvent(t, raw);
      }
      return { t, type: 'sponsor', text, durationSec };
    }
    case 'chapter': {
      const label = toString_(raw.label);
      const kind = toString_(raw.kind);
      if (label === null || kind === null) return unknownEvent(t, raw);
      return { t, type: 'chapter', label, kind };
    }
    case 'status':
    case 'inventory': {
      const add = toStringList(raw.add);
      const remove = toStringList(raw.remove);
      if (actor === null || add === null || remove === null) return unknownEvent(t, raw);
      return { t, type, actor, add, remove };
    }
    default:
      return unknownEvent(t, raw);
  }
}

/** Ascending by `t`, stable for equal `t` (file order wins — spec edge case). */
export function sortEvents(events: AnyEvent[]): AnyEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.t - b.event.t || a.index - b.index)
    .map(({ event }) => event);
}

/* ---------------------------------------------------------------- guards */

function isCrawler(x: unknown): x is Crawler {
  if (!isRecord(x)) return false;
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    typeof x.level === 'number' &&
    isRecord(x.hp) &&
    typeof x.hp.current === 'number' &&
    typeof x.hp.max === 'number' &&
    Array.isArray(x.inventory)
  );
}

function isMapState(x: unknown): x is MapState {
  if (!isRecord(x)) return false;
  return (
    typeof x.floor === 'number' &&
    isRecord(x.grid) &&
    typeof x.grid.cols === 'number' &&
    typeof x.grid.rows === 'number' &&
    Array.isArray(x.revealed)
  );
}

function isInitialState(x: unknown): x is InitialState {
  if (!isRecord(x)) return false;
  return (
    Array.isArray(x.party) &&
    x.party.length > 0 &&
    x.party.every(isCrawler) &&
    (x.partyRank === null || typeof x.partyRank === 'number') &&
    isMapState(x.map)
  );
}

function isEpisodeMeta(x: unknown): x is EpisodeMeta {
  if (!isRecord(x)) return false;
  return (
    typeof x.id === 'number' &&
    typeof x.title === 'string' &&
    typeof x.youtubeId === 'string' &&
    typeof x.floor === 'number' &&
    typeof x.durationSec === 'number' &&
    typeof x.dataUrl === 'string'
  );
}

export function isShow(x: unknown): x is Show {
  if (!isRecord(x)) return false;
  if (typeof x.title !== 'string') return false;
  if (!Array.isArray(x.seasons)) return false;
  if (!Array.isArray(x.episodes) || !x.episodes.every(isEpisodeMeta)) return false;
  if (!isRecord(x.links)) return false;
  return (
    typeof x.links.youtube === 'string' &&
    typeof x.links.discord === 'string' &&
    x.seasons.every(
      (season) =>
        isRecord(season) && typeof season.season === 'number' && Array.isArray(season.floors),
    )
  );
}

export function isEpisodeData(x: unknown): x is EpisodeData {
  if (!isRecord(x)) return false;
  return (
    typeof x.episodeId === 'number' && isInitialState(x.initialState) && Array.isArray(x.events)
  );
}

/**
 * Validates the envelope, normalizes every event, and stable-sorts by `t`.
 * Throws `DataError` only when the file is unusable — a bad *event* is demoted
 * to `unknown`, never fatal.
 */
export function normalizeEpisode(raw: unknown): EpisodeData {
  if (!isEpisodeData(raw)) {
    throw new DataError('Episode data does not match the episode schema.');
  }
  const events = sortEvents((raw.events as unknown[]).map(normalizeEvent));
  return { episodeId: raw.episodeId, initialState: raw.initialState, events };
}

export function normalizeShow(raw: unknown): Show {
  if (!isShow(raw)) {
    throw new DataError('Show data does not match the show schema.');
  }
  return raw;
}
