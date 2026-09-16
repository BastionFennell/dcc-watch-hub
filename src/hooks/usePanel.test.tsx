// @vitest-environment jsdom
/**
 * The panel state machine (contracts/panels.md, T113). Everything here is
 * viewer state — no episode data is involved, so the hook can be driven bare.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePanel } from './usePanel';

/** A real, focusable trigger in the document, like a crawler frame. */
function makeTrigger(id: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = id;
  document.body.append(button);
  return button;
}

/** A `<header><details>` like the Episodes menu, open by default. */
function makeMenu(): HTMLDetailsElement {
  const header = document.createElement('header');
  const details = document.createElement('details');
  details.open = true;
  header.append(details);
  document.body.append(header);
  return details;
}

function escape(options: KeyboardEventInit = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', ...options }));
  });
}

/** jsdom has no `matchMedia`; the page must survive that (guard in the hook). */
function stubMatchMedia(matches: boolean) {
  const listeners: Array<(event: MediaQueryListEvent) => void> = [];
  const query = {
    matches,
    media: '(max-width: 900px)',
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
      void listeners.push(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  vi.stubGlobal('matchMedia', () => query);
  return {
    set(next: boolean) {
      query.matches = next;
      act(() => {
        for (const listener of [...listeners]) listener({ matches: next } as MediaQueryListEvent);
      });
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
  vi.unstubAllGlobals();
});

describe('usePanel', () => {
  it('opens, switches, and closes one panel at a time', () => {
    const { result } = renderHook(() => usePanel(1));
    expect(result.current.panel).toEqual({ kind: 'none' });
    expect(result.current.isOpen('dossier')).toBe(false);

    act(() => result.current.open({ kind: 'dossier', crawlerId: 'harry' }, null));
    expect(result.current.panel).toEqual({ kind: 'dossier', crawlerId: 'harry' });
    expect(result.current.isOpen('dossier', 'harry')).toBe(true);
    expect(result.current.isOpen('dossier', 'xo')).toBe(false);
    expect(result.current.isOpen('map')).toBe(false);

    // A different target replaces without an intermediate close.
    act(() => result.current.open({ kind: 'map' }, null));
    expect(result.current.panel).toEqual({ kind: 'map' });
    expect(result.current.isOpen('map')).toBe(true);

    act(() => result.current.close());
    expect(result.current.panel).toEqual({ kind: 'none' });
  });

  it('toggles the same target closed and switches a different one', () => {
    const { result } = renderHook(() => usePanel(1));

    act(() => result.current.toggle({ kind: 'dossier', crawlerId: 'harry' }, null));
    expect(result.current.panel).toEqual({ kind: 'dossier', crawlerId: 'harry' });

    act(() => result.current.toggle({ kind: 'dossier', crawlerId: 'xo' }, null));
    expect(result.current.panel).toEqual({ kind: 'dossier', crawlerId: 'xo' });

    act(() => result.current.toggle({ kind: 'dossier', crawlerId: 'xo' }, null));
    expect(result.current.panel).toEqual({ kind: 'none' });
  });

  it('opens, matches and toggles an entity record (007 FR-611)', () => {
    const chip = makeTrigger('hoarder-chip');
    const { result } = renderHook(() => usePanel(1));

    act(() => result.current.open({ kind: 'npc', npcId: 'hoarder' }, chip));
    expect(result.current.panel).toEqual({ kind: 'npc', npcId: 'hoarder' });
    expect(result.current.isOpen('npc')).toBe(true);
    expect(result.current.isOpen('npc', 'hoarder')).toBe(true);
    expect(result.current.isOpen('npc', 'grull-rep')).toBe(false);
    // One slot: a record and a dossier are never open at once (FR-100).
    expect(result.current.isOpen('dossier', 'harry')).toBe(false);

    // Another entity replaces it; the same one toggles closed, and focus goes
    // back to the chip that opened it.
    act(() => result.current.toggle({ kind: 'npc', npcId: 'grull-rep' }, null));
    expect(result.current.panel).toEqual({ kind: 'npc', npcId: 'grull-rep' });

    act(() => result.current.toggle({ kind: 'npc', npcId: 'grull-rep' }, chip));
    expect(result.current.panel).toEqual({ kind: 'none' });
    expect(document.activeElement).toBe(chip);
  });

  it('returns focus to the trigger that opened the panel', () => {
    const harry = makeTrigger('harry');
    const { result } = renderHook(() => usePanel(1));

    act(() => result.current.open({ kind: 'dossier', crawlerId: 'harry' }, harry));
    act(() => harry.blur());
    act(() => result.current.close());
    expect(document.activeElement).toBe(harry);
  });

  it('never focuses a trigger that has left the document', () => {
    const gone = makeTrigger('gone');
    const { result } = renderHook(() => usePanel(1));

    act(() => result.current.open({ kind: 'dossier', crawlerId: 'harry' }, gone));
    gone.remove();
    act(() => result.current.close());
    expect(result.current.panel).toEqual({ kind: 'none' });
    expect(document.activeElement).toBe(document.body);
  });

  it('closes on Escape, ignoring auto-repeat', () => {
    const { result } = renderHook(() => usePanel(1));
    act(() => result.current.open({ kind: 'map' }, null));

    escape({ repeat: true });
    expect(result.current.panel).toEqual({ kind: 'map' });

    escape();
    expect(result.current.panel).toEqual({ kind: 'none' });
  });

  it('lets the Episodes menu win the first Escape (spec edge case)', () => {
    const menu = makeMenu();
    const { result } = renderHook(() => usePanel(1));
    act(() => result.current.open({ kind: 'dossier', crawlerId: 'harry' }, null));

    escape();
    expect(menu.open).toBe(false);
    expect(result.current.panel).toEqual({ kind: 'dossier', crawlerId: 'harry' });

    escape();
    expect(result.current.panel).toEqual({ kind: 'none' });
  });

  it('resets to none when the episode changes', () => {
    const { result, rerender } = renderHook(({ id }) => usePanel(id), {
      initialProps: { id: 1 },
    });
    act(() => result.current.open({ kind: 'dossier', crawlerId: 'harry' }, null));

    rerender({ id: 2 });
    expect(result.current.panel).toEqual({ kind: 'none' });
  });

  it('locks the page behind a full-viewport panel only at phone widths', () => {
    const media = stubMatchMedia(true);
    const { result, unmount } = renderHook(() => usePanel(1));
    expect(document.body.classList.contains('panel-open')).toBe(false);

    act(() => result.current.open({ kind: 'dossier', crawlerId: 'harry' }, null));
    expect(document.body.classList.contains('panel-open')).toBe(true);

    // Rotate to a desktop width while it is open: the rail is a column again.
    media.set(false);
    expect(document.body.classList.contains('panel-open')).toBe(false);

    media.set(true);
    expect(document.body.classList.contains('panel-open')).toBe(true);
    act(() => result.current.close());
    expect(document.body.classList.contains('panel-open')).toBe(false);

    act(() => result.current.open({ kind: 'map' }, null));
    unmount();
    expect(document.body.classList.contains('panel-open')).toBe(false);
  });

  it('never locks the page on a desktop-width viewport', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => usePanel(1));

    act(() => result.current.open({ kind: 'map' }, null));
    expect(document.body.classList.contains('panel-open')).toBe(false);
  });

  it('works where matchMedia does not exist', () => {
    const { result } = renderHook(() => usePanel(1));

    act(() => result.current.open({ kind: 'map' }, null));
    expect(result.current.panel).toEqual({ kind: 'map' });
    expect(document.body.classList.contains('panel-open')).toBe(false);
  });
});
