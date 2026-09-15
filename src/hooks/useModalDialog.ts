import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';

export interface ModalDialogOptions {
  /** While false the hook does nothing: the component renders no dialog. */
  open: boolean;
  onClose(): void;
  /** The control that opened the dialog; focused again on close (FR-210). */
  returnFocusTo: HTMLElement | null;
  /**
   * First refusal on Escape (contracts/dialog.md Revision 2). Return true to
   * consume it — the record's list views step back to the sheet and stay open;
   * a second Escape then finds them on the sheet and closes. Either way the
   * keypress is stopped here and never reaches the page's panel listener.
   */
  onEscape?: () => boolean;
}

export interface ModalDialogApi {
  /** Put this on the dialog element itself, not the backdrop. */
  dialogRef: RefObject<HTMLDivElement | null>;
  /** Backdrop `onClick`: closes only when the backdrop itself was hit. */
  onBackdropClick(event: ReactMouseEvent<HTMLElement>): void;
}

/** Everything a keyboard can land on, in document order (contracts/dialog.md). */
const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]',
].join(',');

function focusables(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => node.getAttribute('tabindex') !== '-1' && !node.hasAttribute('disabled'),
  );
}

/**
 * The one overlay allowed to cover the stage (constitution III, 1.2.0): a modal
 * dialog that traps focus, makes the page behind it inert, and hands focus back
 * to its trigger on close. Per contracts/dialog.md:
 *
 * - open: `body.dialog-open` (scroll lock), `inert` on every child of `#root`
 *   (the dialog is portaled to `document.body`, so it is not one of them), and
 *   initial focus on the close control;
 * - keys: Tab / Shift+Tab wrap inside, Escape closes — registered in the
 *   capture phase on `document` (as `ResumeCard`) and stopping propagation, so
 *   one Escape cannot also reach `usePanel`'s bubble-phase listener;
 * - pointer: a click on the backdrop itself closes; clicks inside never do.
 *
 * It never touches the `TimeSource`: opening the record does not pause anything.
 */
export function useModalDialog({
  open,
  onClose,
  returnFocusTo,
  onEscape,
}: ModalDialogOptions): ModalDialogApi {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(returnFocusTo);
  // In a ref, not the effect's deps: the interceptor closes over view state and
  // changes identity on every step, and re-registering the capture listener
  // mid-interaction is exactly what we do not want.
  const escapeRef = useRef(onEscape);

  // Held in a ref so a trigger that re-renders mid-flight cannot re-run the open
  // effect (which would re-apply `inert` and pull focus back to the close button).
  useEffect(() => {
    returnFocusRef.current = returnFocusTo;
  }, [returnFocusTo]);

  useEffect(() => {
    escapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!open) return;

    const root = document.getElementById('root');
    const inerted: HTMLElement[] = [];
    // `#root` is absent in a bare hook test (and in any host that mounts
    // elsewhere): the trap below is what makes the dialog modal, so skip.
    if (root !== null) {
      for (const child of Array.from(root.children)) {
        if (child instanceof HTMLElement && !child.hasAttribute('inert')) {
          child.setAttribute('inert', '');
          inerted.push(child);
        }
      }
    }
    document.body.classList.add('dialog-open');

    const dialog = dialogRef.current;
    const close = dialog?.querySelector<HTMLElement>('[data-testid="record-close"]') ?? null;
    const initial = close ?? (dialog === null ? null : (focusables(dialog)[0] ?? null));
    initial?.focus();

    return () => {
      for (const child of inerted) child.removeAttribute('inert');
      document.body.classList.remove('dialog-open');
      // The trigger may have been re-rendered away (episode change): only a live node.
      const trigger = returnFocusRef.current;
      if (trigger !== null && trigger.isConnected) trigger.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (event.repeat) return;
        // Capture phase on `document`, so the page's bubble-phase listeners
        // (the panel hook's) never see the keypress that closed the dialog —
        // nor the one an inner view consumed.
        event.stopPropagation();
        if (escapeRef.current?.() === true) return;
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (dialog === null) return;
      // Queried on each keydown: the sections change with the playhead.
      const items = focusables(dialog);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && dialog.contains(active);

      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  const onBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      // Only the backdrop itself: a click that started inside the dialog bubbles
      // through here with a different target and must not close anything.
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  return { dialogRef, onBackdropClick };
}

export default useModalDialog;
