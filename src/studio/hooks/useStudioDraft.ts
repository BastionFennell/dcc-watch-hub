/**
 * The draft the editor is holding (010, T1021, FR-1007 / FR-1008).
 *
 * One `useReducer` over `historyReducer` plus a debounced write to
 * `localStorage`. Everything about *what* an action does lives in
 * `history.ts`; this only decides when the result is written down and what the
 * header says about it.
 *
 * The save is debounced by half a second and flushed on `pagehide` and on
 * unmount, so the worst a crash can cost is the keystrokes since the last
 * pause - and leaving the page (or navigating back to the drafts list) costs
 * nothing at all.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { DraftAction, DraftHistory } from '../history';
import { canRedo, canUndo, historyReducer, initHistory } from '../history';
import type { StudioDraft } from '../draft';
import { loadDraft, saveDraft, storageAvailable } from '../storage';

/** FR-1008: "within one second of a change". Half of it, so a slow write still lands. */
export const AUTOSAVE_MS = 500;

export type SaveState =
  | { status: 'saved' }
  | { status: 'saving' }
  | { status: 'error'; reason: 'quota' | 'unavailable' };

export interface StudioDraftApi {
  /** `null` while loading, and for an id this browser has no draft for. */
  draft: StudioDraft | null;
  loading: boolean;
  dispatch(action: DraftAction): void;
  canUndo: boolean;
  canRedo: boolean;
  save: SaveState;
  /** Writes any pending change straight away (the header's Cmd/Ctrl+S path). */
  flush(): void;
  /** False in a private window: the header warns and the author exports instead. */
  storageOk: boolean;
}

type State = DraftHistory | null;

/**
 * `replaceDraft` is the only action that means anything before a draft is
 * loaded - it is how the loader, an import and "create it" all arrive.
 */
function reducer(state: State, action: DraftAction): State {
  if (state === null) {
    return action.kind === 'replaceDraft' ? initHistory(action.draft) : null;
  }
  return historyReducer(state, action);
}

export function useStudioDraft(id: string | number | undefined): StudioDraftApi {
  const [history, dispatch] = useReducer(reducer, null);
  const [loading, setLoading] = useState(true);
  const [save, setSave] = useState<SaveState>({ status: 'saved' });
  const [storageOk] = useState(() => storageAvailable());

  /* The draft as storage last saw it; a change of identity is a change worth writing. */
  const persisted = useRef<StudioDraft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<StudioDraft | null>(null);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const draft = pending.current;
    if (draft === null) return;
    pending.current = null;
    const result = saveDraft(draft);
    if (result.ok) {
      persisted.current = draft;
      setSave({ status: 'saved' });
    } else {
      setSave({ status: 'error', reason: result.reason });
    }
  }, []);

  // Held in a ref so the unmount and `pagehide` handlers can stay registered once.
  const flushRef = useRef(flush);
  flushRef.current = flush;

  /* ------------------------------------------------------------- loading */

  useEffect(() => {
    if (id === undefined) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const stored = loadDraft(id);
    persisted.current = stored;
    pending.current = null;
    if (stored !== null) dispatch({ kind: 'replaceDraft', draft: stored });
    setLoading(false);
    setSave({ status: 'saved' });
  }, [id]);

  /* ------------------------------------------------------------ autosave */

  const draft = history?.present ?? null;

  useEffect(() => {
    if (draft === null) return;
    if (draft === persisted.current) return;
    pending.current = draft;
    setSave({ status: 'saving' });
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      flushRef.current();
    }, AUTOSAVE_MS);
  }, [draft]);

  useEffect(() => {
    const onHide = () => flushRef.current();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      // Leaving the editor writes whatever was still in flight (FR-1008).
      flushRef.current();
    };
  }, []);

  return {
    draft,
    loading,
    dispatch,
    canUndo: history !== null && canUndo(history),
    canRedo: history !== null && canRedo(history),
    save,
    flush,
    storageOk,
  };
}

export default useStudioDraft;
