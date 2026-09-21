/**
 * The Studio's working document (010, plan "Contracts").
 *
 * A draft is deliberately *raw*: events are the plain JSON objects that will be
 * written to `ep{N}.json`, not normalized events, because the author is allowed
 * to hold a half-written event that `normalizeEvent` would demote to `unknown`.
 * Normalization happens on the way to the preview (`toEpisodeData` +
 * `normalizeEpisode`) and in the issues list, never in the store.
 *
 * React-free by rule (constitution VII).
 */

/** One event exactly as it will be serialized, plus its stable editor identity. */
export type RawEvent = Record<string, unknown> & { t: number; type: string };

export interface DraftMeta {
  /** The episode number; also the draft's storage key and `ep{id}.json`. */
  id: number;
  title: string;
  youtubeId: string;
  floor: number;
  /** 0 until the player (or the author) supplies it. */
  durationSec: number;
}

export interface DraftEvent {
  /** Stable across retimes and sorts; the only safe key for lists and history. */
  uid: string;
  event: RawEvent;
}

export interface StudioDraft {
  version: 1;
  meta: DraftMeta;
  /** Raw `initialState`, exported verbatim. Unvalidated on purpose. */
  initialState: unknown;
  events: DraftEvent[];
  /** ISO-8601; refreshed by every history action that changes something. */
  updatedAt: string;
}

/** The raw episode envelope - what `normalizeEpisode` and the exporter take. */
export interface RawEpisode {
  episodeId: number;
  initialState: unknown;
  events: RawEvent[];
}

/* ------------------------------------------------------------------- uid */

let counter = 0;

/**
 * `crypto.randomUUID` where it exists (every browser the spec targets), and a
 * counter elsewhere - jsdom without a secure context, and old Node.
 */
export function uid(): string {
  try {
    const c = globalThis.crypto;
    if (c !== undefined && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {
    // A locked-down context can throw on the property read alone.
  }
  counter += 1;
  return `uid-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/* ----------------------------------------------------------------- drafts */

/** The map a brand new episode starts with: the author's floor, nothing revealed. */
export function emptyInitialState(floor: number): unknown {
  return {
    party: [],
    map: { floor, grid: { cols: 12, rows: 8 }, revealed: [] },
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Ascending by `t`, ties in array order (the same rule `sortEvents` applies). */
export function sortDraftEvents(events: readonly DraftEvent[]): DraftEvent[] {
  return events
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.event.t - b.entry.event.t || a.index - b.index)
    .map(({ entry }) => entry);
}

export function newDraft(meta: DraftMeta, initialState?: unknown): StudioDraft {
  return {
    version: 1,
    meta: { ...meta },
    initialState: initialState === undefined ? emptyInitialState(meta.floor) : initialState,
    events: [],
    updatedAt: nowIso(),
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** A raw event with a usable `t` and `type`, or `null`. Nothing else is judged. */
export function toRawEvent(raw: unknown): RawEvent | null {
  if (!isRecord(raw)) return null;
  const t = typeof raw.t === 'number' && Number.isFinite(raw.t) ? raw.t : Number(raw.t);
  if (!Number.isFinite(t)) return null;
  if (typeof raw.type !== 'string' || raw.type === '') return null;
  return { ...raw, t, type: raw.type };
}

/**
 * Wraps a published (or exported) episode as a draft. Events keep their file
 * order for equal `t`, so an import followed by an export is byte-stable.
 */
export function draftFromEpisode(meta: DraftMeta, episodeRaw: unknown): StudioDraft {
  const raw = isRecord(episodeRaw) ? episodeRaw : {};
  const rawEvents = Array.isArray(raw.events) ? (raw.events as unknown[]) : [];
  const events: DraftEvent[] = [];
  for (const item of rawEvents) {
    const event = toRawEvent(item);
    if (event !== null) events.push({ uid: uid(), event });
  }
  return {
    version: 1,
    meta: { ...meta },
    initialState: raw.initialState === undefined ? emptyInitialState(meta.floor) : raw.initialState,
    events: sortDraftEvents(events),
    updatedAt: nowIso(),
  };
}

/** The draft as the viewer's loader sees it: raw, ready for `normalizeEpisode`. */
export function toEpisodeData(draft: StudioDraft): RawEpisode {
  return {
    episodeId: draft.meta.id,
    initialState: draft.initialState,
    events: sortDraftEvents(draft.events).map(({ event }) => event),
  };
}

/** The draft's party, as raw crawler objects. Empty when there is no party. */
export function draftParty(draft: StudioDraft): unknown[] {
  const init = draft.initialState;
  if (!isRecord(init) || !Array.isArray(init.party)) return [];
  return init.party as unknown[];
}

/** `initialState` with a new party, keeping whatever else the object carried. */
export function withParty(initialState: unknown, party: readonly unknown[]): unknown {
  const base = isRecord(initialState) ? initialState : {};
  return { ...base, party: [...party] };
}

export function findDraftEvent(draft: StudioDraft, eventUid: string): DraftEvent | undefined {
  return draft.events.find((entry) => entry.uid === eventUid);
}
