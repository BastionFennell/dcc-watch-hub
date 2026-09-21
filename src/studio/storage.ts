/**
 * Local draft storage (010, FR-1008; constitution VII, "local only").
 *
 * Everything lives under the `dcc.studio.v1.` prefix and nothing leaves the
 * browser. An index of summaries keeps the drafts list cheap; each draft is its
 * own key so a big episode never blocks reading the list.
 *
 * Every single access is wrapped: a private window, a disabled site-data
 * setting, or a full quota must surface as a save state in the header, never as
 * an exception in the editor.
 */
import type { StudioDraft } from './draft';

export const STORAGE_PREFIX = 'dcc.studio.v1.';
export const INDEX_KEY = `${STORAGE_PREFIX}index`;

export function draftKey(id: number | string): string {
  return `${STORAGE_PREFIX}draft.${id}`;
}

/** One row of the drafts list; enough to render it without loading any draft. */
export interface DraftSummary {
  id: number;
  title: string;
  updatedAt: string;
  /** How many events the draft holds, for the list's second line. */
  events: number;
}

export type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' };

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Reading the property alone can throw in a sandboxed iframe.
    return null;
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** A quota failure is recoverable by deleting a draft; anything else is not. */
function reasonFor(cause: unknown): 'quota' | 'unavailable' {
  if (cause instanceof DOMException) {
    if (cause.name === 'QuotaExceededError' || cause.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return 'quota';
    }
    if (cause.code === 22 || cause.code === 1014) return 'quota';
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  return /quota|exceed/i.test(message) ? 'quota' : 'unavailable';
}

function parseSummary(x: unknown): DraftSummary | null {
  if (!isRecord(x)) return null;
  if (typeof x.id !== 'number' || !Number.isFinite(x.id)) return null;
  return {
    id: x.id,
    title: typeof x.title === 'string' ? x.title : `Episode ${x.id}`,
    updatedAt: typeof x.updatedAt === 'string' ? x.updatedAt : '',
    events: typeof x.events === 'number' && Number.isFinite(x.events) ? x.events : 0,
  };
}

function readIndex(store: Storage): DraftSummary[] {
  try {
    const raw = store.getItem(INDEX_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: DraftSummary[] = [];
    for (const item of parsed) {
      const summary = parseSummary(item);
      if (summary !== null) out.push(summary);
    }
    return out;
  } catch {
    return [];
  }
}

function summarize(draft: StudioDraft): DraftSummary {
  return {
    id: draft.meta.id,
    title: draft.meta.title,
    updatedAt: draft.updatedAt,
    events: draft.events.length,
  };
}

/** A stored draft, or `null` when the value is missing or not one of ours. */
function parseDraft(raw: string | null): StudioDraft | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.version !== 1) return null;
  if (!isRecord(parsed.meta) || typeof parsed.meta.id !== 'number') return null;
  if (!Array.isArray(parsed.events)) return null;
  return parsed as unknown as StudioDraft;
}

/** Newest first. Never throws; an unreadable index reads as no drafts. */
export function listDrafts(storage?: Storage): DraftSummary[] {
  const store = storage ?? defaultStorage();
  if (store === null) return [];
  return readIndex(store).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadDraft(id: number | string, storage?: Storage): StudioDraft | null {
  const store = storage ?? defaultStorage();
  if (store === null) return null;
  try {
    return parseDraft(store.getItem(draftKey(id)));
  } catch {
    return null;
  }
}

/**
 * Writes the draft and refreshes its index row. The index is written second:
 * a quota failure on the draft itself must not leave a row pointing at
 * something that is not there.
 */
export function saveDraft(draft: StudioDraft, storage?: Storage): SaveResult {
  const store = storage ?? defaultStorage();
  if (store === null) return { ok: false, reason: 'unavailable' };
  try {
    store.setItem(draftKey(draft.meta.id), JSON.stringify(draft));
  } catch (cause) {
    return { ok: false, reason: reasonFor(cause) };
  }
  try {
    const index = readIndex(store).filter((summary) => summary.id !== draft.meta.id);
    index.push(summarize(draft));
    store.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (cause) {
    return { ok: false, reason: reasonFor(cause) };
  }
  return { ok: true };
}

/** Removes the draft and its index row. Silent about a storage that is gone. */
export function deleteDraft(id: number | string, storage?: Storage): void {
  const store = storage ?? defaultStorage();
  if (store === null) return;
  try {
    store.removeItem(draftKey(id));
  } catch {
    // Nothing to do: the draft is unreachable either way.
  }
  try {
    const index = readIndex(store).filter((summary) => String(summary.id) !== String(id));
    store.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // As above.
  }
}

/** True when drafts can actually be written here (private mode says no). */
export function storageAvailable(storage?: Storage): boolean {
  const store = storage ?? defaultStorage();
  if (store === null) return false;
  const probe = `${STORAGE_PREFIX}probe`;
  try {
    store.setItem(probe, '1');
    store.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
