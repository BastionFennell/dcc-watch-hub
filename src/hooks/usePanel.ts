import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The right rail's one-slot panel state (contracts/panels.md, FR-100..FR-104).
 *
 * Viewer state, never overlay state: the panel says *which* record is open, the
 * selectors say what it contains at the playhead (constitution I). Nothing here
 * is persisted, and the panel resets whenever the episode changes.
 */
export type Panel =
  | { kind: 'none' }
  | { kind: 'dossier'; crawlerId: string }
  | { kind: 'map' }
  /** 007: one registry entity's record (FR-611). */
  | { kind: 'npc'; npcId: string }
  /**
   * 007 R3: the whole Registry, beside the broadcast (R3-FR-640). `focusId` is
   * the entity to open it on - the record's "Open in the Registry" sets it, the
   * strip's own trigger leaves it off.
   */
  | { kind: 'registry'; focusId?: string };

/** Anything that can actually be opened - i.e. every panel but `none`. */
export type OpenPanel = Exclude<Panel, { kind: 'none' }>;

export interface PanelApi {
  panel: Panel;
  /** Open, or switch to, `next`; remembers the trigger for focus return. */
  open(next: OpenPanel, trigger: HTMLElement | null): void;
  /** Same as `open`, except re-activating the open panel closes it. */
  toggle(next: OpenPanel, trigger: HTMLElement | null): void;
  /** Close and return focus to the trigger that opened the panel. */
  close(): void;
  /** `id` is the crawler id for a dossier, and the entity id for a record or the Registry. */
  isOpen(kind: Panel['kind'], id?: string): boolean;
}

/** One frozen object, so a redundant close cannot re-render the page. */
const CLOSED: Panel = { kind: 'none' };

/** The stacked layout's breakpoint: below it a panel is a full-viewport overlay. */
const OVERLAY_QUERY = '(max-width: 900px)';

function samePanel(a: Panel, b: Panel): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'dossier' && b.kind === 'dossier') return a.crawlerId === b.crawlerId;
  if (a.kind === 'npc' && b.kind === 'npc') return a.npcId === b.npcId;
  /*
   * The Registry panel is one panel however it was opened: re-activating the
   * strip's trigger closes the panel the record opened focused, which is what
   * its own `aria-expanded` promises (R3-FR-643).
   */
  return true;
}

/**
 * @param resetKey the episode id; any change closes the panel (spec edge case:
 *   navigating to another episode opens it ambient).
 */
export function usePanel(resetKey: unknown): PanelApi {
  const [panel, setPanel] = useState<Panel>(CLOSED);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setPanel(CLOSED);
    const trigger = triggerRef.current;
    triggerRef.current = null;
    // The frame may have been re-rendered away (episode switch): only focus a live node.
    if (trigger && trigger.isConnected) trigger.focus();
  }, []);

  // Not memoized on purpose: they close over the current panel, and a handler
  // identity change costs nothing here (constitution V - no idle optimization).
  function open(next: OpenPanel, trigger: HTMLElement | null): void {
    triggerRef.current = trigger;
    setPanel(next);
  }

  function toggle(next: OpenPanel, trigger: HTMLElement | null): void {
    if (samePanel(panel, next)) {
      triggerRef.current = trigger ?? triggerRef.current;
      close();
      return;
    }
    open(next, trigger);
  }

  function isOpen(kind: Panel['kind'], id?: string): boolean {
    if (panel.kind !== kind) return false;
    if (panel.kind === 'dossier' && id !== undefined) return panel.crawlerId === id;
    if (panel.kind === 'npc' && id !== undefined) return panel.npcId === id;
    if (panel.kind === 'registry' && id !== undefined) return panel.focusId === id;
    return true;
  }

  // Escape: the Episodes menu wins the first press (spec edge case), the panel the second.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.repeat) return;
      const menu = document.querySelector('header details[open]');
      if (menu instanceof HTMLDetailsElement) {
        menu.open = false;
        return;
      }
      close();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close]);

  // A new episode always opens ambient.
  useEffect(() => {
    triggerRef.current = null;
    setPanel(CLOSED);
  }, [resetKey]);

  // ≤ 900 px the panel covers the viewport, so the page behind it must not scroll
  // (FR-102). Re-evaluated on every breakpoint change while the panel is open.
  const open900 = panel.kind !== 'none';
  useEffect(() => {
    if (!open900) return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(OVERLAY_QUERY);
    const apply = () => {
      document.body.classList.toggle('panel-open', query.matches);
    };
    apply();
    const listen = typeof query.addEventListener === 'function';
    if (listen) query.addEventListener('change', apply);
    return () => {
      if (listen) query.removeEventListener('change', apply);
      document.body.classList.remove('panel-open');
    };
  }, [open900]);

  return { panel, open, toggle, close, isOpen };
}

export default usePanel;
