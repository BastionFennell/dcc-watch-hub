/**
 * The editor's keyboard (010, T1021, FR-1002).
 *
 * One listener on `document`, one canonical name per combination, one map. The
 * rules, in order:
 *
 *  - A key pressed inside a text box belongs to the text box. `input`,
 *    `textarea`, `select` and anything `contenteditable` swallow bare keys, so
 *    Space in the search field types a space and `d` types a `d`. A combination
 *    with Cmd, Ctrl or Alt is never a character, so those still fire.
 *  - A handled key is always `preventDefault`ed: Space must not scroll the
 *    page, Cmd/Ctrl+S must not open the browser's save dialog, and the arrows
 *    must not scroll the event list.
 *  - `enabled: false` turns the whole map off in one place. The editor uses it
 *    to go quiet while the event form is open - the form owns Escape and
 *    Cmd/Ctrl+Enter itself, and the page hands it a reduced map holding only
 *    undo, redo and save.
 *
 * Combination names are built in one fixed order: `mod`, `alt`, `shift`, then
 * the key, lowercased, with the space bar called `space`. So undo is `mod+z`,
 * redo is `mod+shift+z`, and the bare keys are just `e`, `t`, `d`, `space`,
 * `arrowleft`, `delete`.
 */
import { useEffect, useRef } from 'react';

export type HotkeyHandler = (event: KeyboardEvent) => void;
export type HotkeyMap = Record<string, HotkeyHandler | undefined>;

export interface HotkeyOptions {
  /** False silences every key in the map (the form is open, the dialog is up). */
  enabled?: boolean;
}

/** The canonical name for a keyboard event, per this module's note. */
export function comboOf(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push('mod');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  const key = event.key === ' ' || event.key === 'Spacebar' ? 'space' : event.key.toLowerCase();
  parts.push(key);
  return parts.join('+');
}

/** True when the keypress is someone typing rather than driving the editor. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useStudioHotkeys(map: HotkeyMap, { enabled = true }: HotkeyOptions = {}): void {
  // The map is rebuilt every render (its handlers close over the draft); keeping
  // it in a ref means the listener is registered once and always current.
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent): void {
      // A held key repeats; an editor action should not.
      if (event.repeat) return;
      const combo = comboOf(event);
      const handler = mapRef.current[combo];
      if (handler === undefined) return;
      const modified = event.metaKey || event.ctrlKey || event.altKey;
      if (!modified && isTypingTarget(event.target)) return;
      event.preventDefault();
      handler(event);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

export default useStudioHotkeys;
