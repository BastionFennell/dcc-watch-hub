import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { copy } from '../../copy';
import styles from './MobileTabs.module.css';

/** The four phone panes, in strip order (FR-502). */
export type TabId = 'feed' | 'party' | 'map' | 'log';

export interface MobileTab {
  id: TabId;
  label: string;
  content: ReactNode;
}

export interface MobileTabsProps {
  /** The panes, in the order they appear in the strip and under a swipe. */
  tabs: MobileTab[];
  /** Which pane opens first; the feed by default (SC-502). */
  initial?: TabId;
  onChange?(id: TabId): void;
  /** Overrides the tablist's accessible name. */
  label?: string;
}

/** Horizontal travel that counts as a swipe rather than a tap (research R2). */
export const SWIPE_PX = 40;
/** …and how much more horizontal than vertical it has to be. */
export const SWIPE_RATIO = 2;

interface Swipe {
  pointerId: number;
  x: number;
  y: number;
  /** Set once the gesture has switched a tab, so one drag moves one pane. */
  done: boolean;
}

/**
 * The phone tab strip under the timeline (US2, FR-502): feed, party, map and
 * log as a WAI-ARIA tabs widget with automatic activation.
 *
 * All four panels stay mounted and are hidden with `hidden`, not unmounted, so
 * the log's follow position and the map's zoom survive a tab switch — the
 * content itself is derived from the playhead on every render anyway
 * (constitution I). Selection moves by tap, by arrow key (focus follows, wrap),
 * and by a horizontal swipe on the panel area; `touch-action: pan-y` leaves
 * vertical scrolling entirely to the browser.
 */
export function MobileTabs({ tabs, initial, onChange, label }: MobileTabsProps) {
  const first = tabs[0]?.id;
  const known = initial !== undefined && tabs.some((tab) => tab.id === initial);
  const [selected, setSelected] = useState<TabId | undefined>(known ? initial : first);
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement>());
  const swipeRef = useRef<Swipe | null>(null);

  const index = tabs.findIndex((tab) => tab.id === selected);
  const current = index >= 0 ? index : 0;

  const select = useCallback(
    (id: TabId, focus: boolean) => {
      if (id !== selected) {
        setSelected(id);
        onChange?.(id);
      }
      if (focus) tabRefs.current.get(id)?.focus();
    },
    [onChange, selected],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (tabs.length === 0) return;
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        next = (current + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        next = (current - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    // Automatic activation: the arrow both moves focus and opens the pane.
    select(tabs[next].id, true);
  }

  const startSwipe = useCallback((event: PointerEvent<HTMLDivElement>) => {
    // Panes may own the horizontal axis themselves — the floor map is dragged
    // to pan, and a pan that crossed the 40 px threshold would also flick the
    // strip to the next tab. A pane opts out by marking its gesture surface
    // `data-swipe-ignore`; the gesture is then simply never started.
    const target = event.target;
    if (target instanceof Element && target.closest('[data-swipe-ignore]') !== null) {
      swipeRef.current = null;
      return;
    }
    swipeRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      done: false,
    };
  }, []);

  const moveSwipe = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const swipe = swipeRef.current;
      if (swipe === null || swipe.done || swipe.pointerId !== event.pointerId) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      // A drag that is mostly vertical is the page scrolling, not a swipe.
      if (Math.abs(dx) <= SWIPE_PX || Math.abs(dx) <= SWIPE_RATIO * Math.abs(dy)) return;
      swipe.done = true;
      // Dragging left pulls the next pane in; no wrap, so the ends hold.
      const next = dx < 0 ? current + 1 : current - 1;
      if (next < 0 || next >= tabs.length) return;
      select(tabs[next].id, false);
    },
    [current, select, tabs],
  );

  const endSwipe = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (swipe !== null && swipe.pointerId === event.pointerId) swipeRef.current = null;
  }, []);

  return (
    <div className={styles.tabs} data-testid="mobile-tabs-root">
      <div
        className={styles.strip}
        role="tablist"
        aria-label={label ?? copy.tabsLabel}
        data-testid="mobile-tabs"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, position) => {
          const isSelected = position === current;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              className={styles.tab}
              data-testid={`tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`tabpanel-${tab.id}`}
              /* Roving focus: one stop for the whole strip (research R2). */
              tabIndex={isSelected ? 0 : -1}
              ref={(element) => {
                if (element === null) tabRefs.current.delete(tab.id);
                else tabRefs.current.set(tab.id, element);
              }}
              onClick={() => select(tab.id, false)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        className={styles.panels}
        data-testid="mobile-tabpanels"
        onPointerDown={startSwipe}
        onPointerMove={moveSwipe}
        onPointerUp={endSwipe}
        onPointerCancel={endSwipe}
      >
        {tabs.map((tab, position) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`tabpanel-${tab.id}`}
            className={styles.panel}
            data-testid={`tabpanel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            tabIndex={0}
            hidden={position !== current}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MobileTabs;
