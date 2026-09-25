/**
 * Which dossier cards this reader has opened (012), under `dcc.reveals.v1`.
 *
 * The constitution's storage rule (1.5.0) carves this out by name: it is a
 * reader preference, never derived from events, and never a statement about
 * the story. Losing it costs a few clicks and nothing else, which is why every
 * access below is wrapped and why a browser that refuses storage gets an
 * in-memory store instead of an error.
 *
 * Two ways a card is open: it is listed for that crawler, or its episode is at
 * or below `caughtUpThrough`, the watermark "Reveal all - I'm caught up" sets.
 * The watermark is global on purpose - a reader who is caught up is caught up
 * on everyone - while the explicit list is per crawler.
 *
 * The mutators are pure: they take a state and return a new one. Saving is a
 * separate call, so a test can walk the state machine without touching a
 * browser, and so the component decides when to persist.
 */

export const REVEALS_KEY = 'dcc.reveals.v1';

export interface RevealState {
  v: 1;
  /** Crawler id -> the episodes whose cards this reader opened, ascending. */
  revealed: Record<string, number[]>;
  /** Episodes at or below this are open for every crawler. `0` is none. */
  caughtUpThrough: number;
}

/**
 * The server's answer, and the first client render's: nothing is revealed.
 * Frozen and shared, so `useSyncExternalStore` sees one stable reference and
 * hydration cannot disagree with the HTML - the prerendered panel is always
 * fully locked, and the reader's own choices are applied after mount.
 */
export const LOCKED: RevealState = Object.freeze({
  v: 1,
  revealed: Object.freeze({}) as Record<string, number[]>,
  caughtUpThrough: 0,
});

function emptyState(): RevealState {
  return { v: 1, revealed: {}, caughtUpThrough: 0 };
}

/* --------------------------------------------------------------- storage */

/**
 * The live state. It doubles as the memory fallback: when `localStorage`
 * throws - Safari's private mode, a browser with site data blocked, an
 * embedded webview - the state simply stays here for the session.
 */
let current: RevealState | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function parse(raw: string | null): RevealState {
  if (raw === null || raw === '') return emptyState();
  let record: unknown;
  try {
    record = JSON.parse(raw);
  } catch {
    return emptyState();
  }
  if (typeof record !== 'object' || record === null || Array.isArray(record)) return emptyState();

  const source = record as Record<string, unknown>;
  const revealed: Record<string, number[]> = {};
  if (typeof source.revealed === 'object' && source.revealed !== null) {
    for (const [id, value] of Object.entries(source.revealed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      const episodes = value.filter(
        (episode): episode is number => typeof episode === 'number' && Number.isFinite(episode),
      );
      revealed[id] = [...new Set(episodes)].sort((a, b) => a - b);
    }
  }
  const watermark = source.caughtUpThrough;
  return {
    v: 1,
    revealed,
    caughtUpThrough: typeof watermark === 'number' && watermark > 0 ? Math.floor(watermark) : 0,
  };
}

/** Reads the store. Never throws; an unreadable or nonsense value reads empty. */
export function loadReveals(): RevealState {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(REVEALS_KEY) ?? null;
  } catch {
    raw = null;
  }
  current = parse(raw);
  return current;
}

/**
 * Writes the store and tells every subscriber. A write that throws is not an
 * error anyone should see: the state is already live in memory, and the reader
 * keeps their reveals for this session.
 */
export function saveReveals(state: RevealState): void {
  current = state;
  try {
    storage()?.setItem(REVEALS_KEY, JSON.stringify(state));
  } catch {
    /* memory only, for this session. */
  }
  for (const listener of listeners) listener();
}

/** The current state, loading it from storage the first time anyone asks. */
export function getReveals(): RevealState {
  current ??= loadReveals();
  return current;
}

/** The server's snapshot: always fully locked, always the same object. */
export function getLockedSnapshot(): RevealState {
  return LOCKED;
}

/** `useSyncExternalStore`'s first argument. Returns the unsubscribe. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* -------------------------------------------------------------- the state */

export function isRevealed(state: RevealState, id: string, episode: number): boolean {
  if (episode <= state.caughtUpThrough) return true;
  return (state.revealed[id] ?? []).includes(episode);
}

/** One card, opened. Idempotent. */
export function reveal(state: RevealState, id: string, episode: number): RevealState {
  if ((state.revealed[id] ?? []).includes(episode)) return state;
  const episodes = [...(state.revealed[id] ?? []), episode].sort((a, b) => a - b);
  return { ...state, revealed: { ...state.revealed, [id]: episodes } };
}

/**
 * "Reveal all - I'm caught up". The watermark is global, so saying it once on
 * one crawler's page says it everywhere: a reader who has seen Episode 7 has
 * seen everyone's Episode 7.
 *
 * @param highestAired the newest episode this deploy has cards for.
 */
export function revealAll(state: RevealState, id: string, highestAired: number): RevealState {
  const watermark = Math.max(state.caughtUpThrough, highestAired);
  return { ...state, revealed: { ...state.revealed, [id]: [] }, caughtUpThrough: watermark };
}

/**
 * "Hide everything again". Clears this crawler's list and drops the watermark
 * to zero - the watermark is what is holding the other cards open, so leaving
 * it standing would make the button a lie.
 */
export function hideAll(state: RevealState, id: string): RevealState {
  const revealed = { ...state.revealed };
  delete revealed[id];
  return { ...state, revealed, caughtUpThrough: 0 };
}
