import type { ReactNode } from 'react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import styles from './Tooltip.module.css';

/*
 * 008 revision 2: the one explanation surface the record has. A hotbar key, a
 * skill tile, a spell tile and an inventory tile all carry a short name; the
 * sheet's full text for that entry lives here and is shown on hover, on
 * keyboard focus, and on click.
 *
 * Entries with nothing to explain render exactly as they did before revision 2:
 * no button, no affordance, no tooltip (R2 scope: "entries without a
 * description get no tooltip and no affordance"). That is why `content` is
 * optional and an absent one short-circuits the whole component.
 *
 * No portal: the tooltip is a sibling of its trigger and sits above the tiles on
 * its own stacking context, which keeps it positioned by the trigger itself and
 * keeps the DOM order an assistive reader walks intact.
 */

export interface TooltipProps {
  /** The sheet's full text. Absent → `children` render bare (no trigger). */
  content?: ReactNode;
  /** What the viewer sees and points at. */
  children: ReactNode;
  /** Class on the trigger button, so a slot or tile keeps its own layout. */
  className?: string;
  /** The trigger's accessible name; without one it reads its own contents. */
  label?: string;
  testId?: string;
}

/** Below this many pixels of headroom the tooltip flips under the trigger. */
const FLIP_THRESHOLD_PX = 160;

export function Tooltip({ content, children, className, label, testId }: TooltipProps) {
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /*
   * `pinned` is click or keyboard focus; `hovered` is the pointer. Keeping them
   * apart is what lets a click hold the tooltip open while the pointer wanders,
   * and lets the pointer show it without stealing the click's toggle.
   */
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [below, setBelow] = useState(false);
  // A pointer press focuses the button too; without this the focus would open
  // the tooltip and the click that follows would immediately toggle it shut.
  const viaPointer = useRef(false);

  const open = content !== undefined && (pinned || hovered);

  const hide = useCallback(() => {
    setPinned(false);
    setHovered(false);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect === undefined) return;
    setBelow(rect.top < FLIP_THRESHOLD_PX);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    const onPointerDown = (event: Event) => {
      const node = event.target;
      if (node instanceof Node && wrapRef.current?.contains(node)) return;
      hide();
    };
    /*
     * Capture phase: the record dialog takes Escape on `document` in capture
     * and stops it there, so a bubble-phase listener inside would never see the
     * key. `useModalDialog` gives an open tooltip first refusal and leaves the
     * key alone; this is the listener that then acts on it.
     */
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, hide]);

  if (content === undefined) return <>{children}</>;

  return (
    <span
      className={styles.wrap}
      ref={wrapRef}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <button
        type="button"
        ref={triggerRef}
        className={className === undefined ? styles.trigger : `${styles.trigger} ${className}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        aria-label={label}
        data-testid={testId}
        data-open={open ? 'true' : undefined}
        onPointerDown={() => {
          viaPointer.current = true;
        }}
        onFocus={() => {
          if (!viaPointer.current) setPinned(true);
        }}
        onBlur={() => {
          setPinned(false);
          viaPointer.current = false;
        }}
        onClick={() => {
          viaPointer.current = false;
          setPinned((current) => !current);
        }}
      >
        {children}
      </button>
      {open ? (
        <span
          role="tooltip"
          id={id}
          className={styles.tip}
          data-testid="tooltip"
          data-placement={below ? 'below' : 'above'}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

export default Tooltip;
