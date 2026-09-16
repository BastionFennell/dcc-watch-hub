import { useCallback, useRef, useState } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from '../icons';
import { copy } from '../../copy';
import styles from './RailPanel.module.css';

/** `'rail'` is the desktop/stacked frame; `'sheet'` is the phone bottom sheet (FR-504). */
export type RailPanelPresentation = 'rail' | 'sheet';

export interface RailPanelProps {
  /** Always the rail slot's one id — triggers point `aria-controls` at it. */
  id?: string;
  title: string;
  /** Mono caps line above the title ("CRAWLER DOSSIER"). */
  kicker?: string;
  /** How the frame is presented; `'rail'` renders exactly as it always has. */
  presentation?: RailPanelPresentation;
  onClose(): void;
  children: ReactNode;
}

/** Release past a quarter of the sheet's height dismisses it (research R3). */
const DISMISS_FRACTION = 0.25;

interface SheetDrag {
  pointerId: number;
  startY: number;
  height: number;
}

/**
 * The right rail's panel frame (contracts/panels.md). It replaces the feed in
 * the rail column — on desktop it never covers the stage, and at ≤ 900 px it is
 * a full-viewport overlay with the close control at the top (FR-102).
 *
 * Not a modal dialog: on desktop the page around it stays usable, so a labelled
 * `region` is the honest role (research R2).
 *
 * `presentation="sheet"` (006, FR-504) portals the same region to `document.body`
 * as a bottom sheet over a dim backdrop: ~70 vh, a grab handle, drag-to-dismiss,
 * backdrop tap to close. Escape, focus return and the `body.panel-open` scroll
 * lock all stay where they already are, in `usePanel` — nothing here duplicates
 * them. The full record still sits above the sheet (its backdrop is
 * `calc(var(--panel-z) + 10)`, the sheet is `var(--panel-z)`).
 */
export function RailPanel({
  id = 'rail-panel',
  title,
  kicker,
  presentation = 'rail',
  onClose,
  children,
}: RailPanelProps) {
  const titleId = `${id}-title`;
  const sheet = presentation === 'sheet';

  const sheetRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<SheetDrag | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    // The close control lives in the header: a press on it is a click, not a drag
    // (and capturing the pointer here would retarget that click away from it).
    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, select, textarea') !== null) {
      return;
    }
    const element = sheetRef.current;
    if (element === null) return;
    const height = element.getBoundingClientRect().height;
    const handle = event.currentTarget;
    if (typeof handle.setPointerCapture === 'function') {
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        // Environments without a live pointer (jsdom) simply skip capture.
      }
    }
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY, height };
    setDragging(true);
    setOffset(0);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    // Downward only: an upward pull does not stretch the sheet (research R3).
    setOffset(Math.max(0, event.clientY - drag.startY));
  }, []);

  const releasePointer = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const handle = event.currentTarget;
    if (typeof handle.releasePointerCapture === 'function') {
      try {
        handle.releasePointerCapture(event.pointerId);
      } catch {
        // Capture may already have been lost; nothing to release.
      }
    }
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      releasePointer(event);
      dragRef.current = null;
      setDragging(false);
      // Always drop the offset: closing unmounts the sheet, staying snaps it back
      // (the transition lives in CSS, so reduced motion turns it off there).
      setOffset(0);
      const dy = Math.max(0, event.clientY - drag.startY);
      if (drag.height > 0 && dy > DISMISS_FRACTION * drag.height) onClose();
    },
    [onClose, releasePointer],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      releasePointer(event);
      dragRef.current = null;
      setDragging(false);
      setOffset(0);
    },
    [releasePointer],
  );

  const dragHandlers = sheet
    ? {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
      }
    : undefined;

  const onBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      // Only the dim area itself: a click inside the sheet bubbles through here
      // with a different target and must not close anything.
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  const panel = (
    <section
      id={id}
      role="region"
      aria-labelledby={titleId}
      className={sheet ? `${styles.panel} ${styles.sheet}` : styles.panel}
      data-testid="rail-panel"
      data-presentation={sheet ? 'sheet' : undefined}
      data-dragging={sheet && dragging ? 'true' : undefined}
      ref={sheet ? sheetRef : undefined}
      style={sheet && offset > 0 ? { transform: `translateY(${offset}px)` } : undefined}
    >
      {sheet ? (
        <div
          className={styles.handle}
          role="presentation"
          data-testid="sheet-handle"
          {...dragHandlers}
        >
          <span className={styles.grip} />
        </div>
      ) : null}
      <header className={styles.header} {...dragHandlers}>
        <div className={styles.heading}>
          {kicker === undefined ? null : <p className={styles.kicker}>{kicker}</p>}
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
        </div>
        {/*
          The grab handle is `role="presentation"` and so cannot carry a name:
          the gesture is announced here instead, outside the `aria-labelledby`
          target so the region's accessible name is still just the title.
        */}
        {sheet ? <p className="sr-only">{copy.sheetHandle}</p> : null}
        <button
          type="button"
          className={styles.close}
          aria-label={copy.panelClose}
          onClick={onClose}
          data-testid="panel-close"
        >
          <IconClose className={styles.closeIcon} />
        </button>
      </header>
      <div className={styles.body} data-testid="rail-panel-body">
        {children}
      </div>
    </section>
  );

  if (!sheet) return panel;

  return createPortal(
    <div className={styles.backdrop} data-testid="sheet-backdrop" onClick={onBackdropClick}>
      {panel}
    </div>,
    document.body,
  );
}

export default RailPanel;
