/**
 * Per-episode resume position (contracts/resume-storage.md, FR-130..FR-133).
 *
 * Framework-free and storage-agnostic: the store takes any `Storage`, so tests
 * inject an in-memory (or throwing) stub. Constitution I limits what may live
 * here — the playhead and nothing derived from the event log.
 *
 * Every call is wrapped in try/catch: a browser in private mode, a disabled
 * site-data setting or a full quota must never reach the viewer.
 */

export interface ResumeRecord {
  episodeId: number;
  /** Seconds into the episode. Never negative. */
  t: number;
  /** ISO-8601 timestamp of the write. */
  savedAt: string;
}

export interface ResumeStore {
  load(episodeId: number): ResumeRecord | null;
  save(episodeId: number, t: number): void;
  clear(episodeId: number): void;
}

export const RESUME_KEY_PREFIX = 'dcc-watch-hub:resume:v1:';

export function resumeKey(episodeId: number): string {
  return `${RESUME_KEY_PREFIX}${episodeId}`;
}

/** `globalThis.localStorage` can throw on access alone (sandboxed iframes). */
function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Strict: the shape is ours, so anything else is treated as no saved position. */
function parseRecord(raw: string | null, episodeId: number): ResumeRecord | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.episodeId !== episodeId) return null;
  if (typeof parsed.t !== 'number' || !Number.isFinite(parsed.t) || parsed.t < 0) return null;
  if (typeof parsed.savedAt !== 'string' || parsed.savedAt === '') return null;
  return { episodeId, t: parsed.t, savedAt: parsed.savedAt };
}

/**
 * A store bound to one `Storage`. With no argument it resolves
 * `globalThis.localStorage` lazily on every call, so a module imported before
 * the DOM exists (or in a worker) still behaves.
 */
export function createResumeStore(storage?: Storage): ResumeStore {
  const resolve = (): Storage | null => storage ?? defaultStorage();

  return {
    load(episodeId: number): ResumeRecord | null {
      try {
        const store = resolve();
        if (store === null) return null;
        return parseRecord(store.getItem(resumeKey(episodeId)), episodeId);
      } catch {
        return null;
      }
    },

    save(episodeId: number, t: number): void {
      try {
        const store = resolve();
        if (store === null) return;
        if (!Number.isFinite(t) || t < 0) return;
        const record: ResumeRecord = { episodeId, t, savedAt: new Date().toISOString() };
        store.setItem(resumeKey(episodeId), JSON.stringify(record));
      } catch {
        // Quota, private mode, disabled storage: the viewer never hears about it.
      }
    },

    clear(episodeId: number): void {
      try {
        const store = resolve();
        if (store === null) return;
        store.removeItem(resumeKey(episodeId));
      } catch {
        // As above.
      }
    },
  };
}

/** The app's store: `localStorage`, resolved lazily inside try/catch. */
export const resumeStore: ResumeStore = createResumeStore();

export function loadResume(episodeId: number): ResumeRecord | null {
  return resumeStore.load(episodeId);
}

export function saveResume(episodeId: number, t: number): void {
  resumeStore.save(episodeId, t);
}

export function clearResume(episodeId: number): void {
  resumeStore.clear(episodeId);
}
