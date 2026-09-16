/**
 * The broadcast log's open/closed preference (005 FR-400, contracts/log.md).
 *
 * Constitution I is explicit about what may be persisted: the playhead and
 * viewer preferences, never overlay state. This is a single boolean saying
 * whether the viewer likes the log open — nothing derived from the event log,
 * so a restored preference cannot leak a future event.
 *
 * Mirrors `src/playback/resume.ts`: storage-agnostic, and every call wrapped in
 * try/catch, because `globalThis.localStorage` can throw on access alone in a
 * sandboxed iframe or with site data disabled.
 */

export const LOG_OPEN_KEY = 'dcc-watch-hub:prefs:v1:log-open';

/** The only truthy value we write; anything else reads as closed. */
const OPEN = '1';

export interface LogOpenStore {
  load(): boolean;
  save(open: boolean): void;
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * A store bound to one `Storage`. With no argument it resolves
 * `globalThis.localStorage` lazily on every call, so importing this module
 * before the DOM exists is harmless.
 */
export function createLogOpenStore(storage?: Storage): LogOpenStore {
  const resolve = (): Storage | null => storage ?? defaultStorage();

  return {
    load(): boolean {
      try {
        const store = resolve();
        if (store === null) return false;
        return store.getItem(LOG_OPEN_KEY) === OPEN;
      } catch {
        // Private mode, disabled storage: the log simply opens closed.
        return false;
      }
    },

    save(open: boolean): void {
      try {
        const store = resolve();
        if (store === null) return;
        if (open) store.setItem(LOG_OPEN_KEY, OPEN);
        else store.removeItem(LOG_OPEN_KEY);
      } catch {
        // Quota or a blocked store: the viewer never hears about it.
      }
    },
  };
}

/** The app's store: `localStorage`, resolved lazily inside try/catch. */
export const logOpenStore: LogOpenStore = createLogOpenStore();

export function loadLogOpen(): boolean {
  return logOpenStore.load();
}

export function saveLogOpen(open: boolean): void {
  logOpenStore.save(open);
}
