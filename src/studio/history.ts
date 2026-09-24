/**
 * The Studio's undo stack (010, FR-1007).
 *
 * A pure reducer over `{ past, present, future }`: every action returns a new
 * history, and an action that would change nothing returns the *same* object,
 * so an accidental re-save never costs an undo step.
 *
 * React-free by rule (constitution VII); the hook that wraps it arrives in
 * Wave C.
 */
import type { DraftEvent, DraftMeta, RawEvent, StudioDraft } from './draft';
import { sortDraftEvents, uid as newUid } from './draft';

/** FR-1007: a hundred steps, then the oldest falls off the bottom. */
export const HISTORY_LIMIT = 100;

export interface DraftHistory {
  past: StudioDraft[];
  present: StudioDraft;
  future: StudioDraft[];
}

export type DraftAction =
  /** Appends an event; `uid` lets a caller (or a test) fix the identity. */
  | { kind: 'addEvent'; event: RawEvent; uid?: string }
  /** Replaces one event's payload wholesale, keeping its uid. */
  | { kind: 'updateEvent'; uid: string; event: RawEvent }
  /** Moves an event to `t`, and to the end of that tie group. */
  | { kind: 'retimeEvent'; uid: string; t: number }
  /** Copies an event under a new uid, at `t` when given. */
  | { kind: 'duplicateEvent'; uid: string; t?: number; newUid?: string }
  | { kind: 'removeEvent'; uid: string }
  | { kind: 'setMeta'; meta: Partial<DraftMeta> }
  /** Replaces `initialState.party`, keeping the rest of the initial state. */
  | { kind: 'setParty'; party: readonly unknown[] }
  | { kind: 'setInitialState'; initialState: unknown }
  /** A load or an import: the new draft is the present and history is cleared. */
  | { kind: 'replaceDraft'; draft: StudioDraft }
  | { kind: 'undo' }
  | { kind: 'redo' };

/* ------------------------------------------------------------- utilities */

/** Structural equality over JSON-shaped values; no dependency, no surprises. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => sameValue(item, b[index]));
  }
  if (typeof a !== 'object') return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => key in right && sameValue(left[key], right[key]));
}

export { sameValue as sameDraftValue };

function nowIso(): string {
  return new Date().toISOString();
}

export function initHistory(draft: StudioDraft): DraftHistory {
  return { past: [], present: draft, future: [] };
}

export function canUndo(history: DraftHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: DraftHistory): boolean {
  return history.future.length > 0;
}

/** Pushes `present` onto `past` (capped) and drops any redo branch. */
function commit(history: DraftHistory, next: StudioDraft): DraftHistory {
  const past = [...history.past, history.present];
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    present: { ...next, updatedAt: nowIso() },
    future: [],
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function withEvents(draft: StudioDraft, events: readonly DraftEvent[]): StudioDraft {
  return { ...draft, events: sortDraftEvents(events) };
}

/* -------------------------------------------------------------- reducer */

/**
 * The next history for `action`, or `history` itself when nothing changed.
 * Events are re-sorted after every edit, so the list is the export order.
 */
export function historyReducer(history: DraftHistory, action: DraftAction): DraftHistory {
  const draft = history.present;

  switch (action.kind) {
    case 'addEvent': {
      const entry: DraftEvent = { uid: action.uid ?? newUid(), event: action.event };
      return commit(history, withEvents(draft, [...draft.events, entry]));
    }

    case 'updateEvent': {
      const index = draft.events.findIndex((entry) => entry.uid === action.uid);
      if (index === -1) return history;
      const current = draft.events[index];
      if (sameValue(current.event, action.event)) return history;
      const entry: DraftEvent = { uid: current.uid, event: action.event };
      const events = draft.events.slice();
      if (current.event.t === action.event.t) {
        // The time did not move, so neither does the row.
        events[index] = entry;
      } else {
        // A new time means a new tie group, and the row joins it last.
        events.splice(index, 1);
        events.push(entry);
      }
      return commit(history, withEvents(draft, events));
    }

    case 'retimeEvent': {
      const index = draft.events.findIndex((entry) => entry.uid === action.uid);
      if (index === -1) return history;
      const current = draft.events[index];
      if (current.event.t === action.t) return history;
      const events = draft.events.slice();
      events.splice(index, 1);
      events.push({ uid: current.uid, event: { ...current.event, t: action.t } });
      return commit(history, withEvents(draft, events));
    }

    case 'duplicateEvent': {
      const current = draft.events.find((entry) => entry.uid === action.uid);
      if (current === undefined) return history;
      const event: RawEvent = { ...current.event, t: action.t ?? current.event.t };
      const entry: DraftEvent = { uid: action.newUid ?? newUid(), event };
      return commit(history, withEvents(draft, [...draft.events, entry]));
    }

    case 'removeEvent': {
      const events = draft.events.filter((entry) => entry.uid !== action.uid);
      if (events.length === draft.events.length) return history;
      return commit(history, { ...draft, events });
    }

    case 'setMeta': {
      const meta: DraftMeta = { ...draft.meta, ...action.meta };
      if (sameValue(meta, draft.meta)) return history;
      return commit(history, { ...draft, meta });
    }

    case 'setParty': {
      const base = isRecord(draft.initialState) ? draft.initialState : {};
      const current = Array.isArray(base.party) ? (base.party as unknown[]) : undefined;
      if (current !== undefined && sameValue(current, action.party)) return history;
      return commit(history, { ...draft, initialState: { ...base, party: [...action.party] } });
    }

    case 'setInitialState': {
      if (sameValue(draft.initialState, action.initialState)) return history;
      return commit(history, { ...draft, initialState: action.initialState });
    }

    case 'replaceDraft':
      // A load is not an edit: there is nothing to undo back to.
      return initHistory(action.draft);

    case 'undo': {
      if (history.past.length === 0) return history;
      const present = history.past[history.past.length - 1];
      return {
        past: history.past.slice(0, -1),
        present,
        future: [history.present, ...history.future],
      };
    }

    case 'redo': {
      if (history.future.length === 0) return history;
      const [present, ...future] = history.future;
      return { past: [...history.past, history.present], present, future };
    }

    default:
      return history;
  }
}
