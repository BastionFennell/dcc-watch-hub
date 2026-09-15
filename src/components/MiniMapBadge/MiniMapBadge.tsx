import { useId } from 'react';
import type { MouseEvent } from 'react';
import type { MapCellsView } from '../../engine/selectors';
import { cellKey } from '../../engine/state';
import { IconMap } from '../icons';
import { copy } from '../../copy';
import styles from './MiniMapBadge.module.css';

export interface MiniMapBadgeProps {
  /** `mapCells(state)` — the revealed set as of the playhead. */
  cells: MapCellsView;
  /** `recentlyRevealed(events, t)` — cells revealed in the last 5 s. */
  recent: Set<string>;
  /** Whether the expanded map panel is currently open (FR-104). */
  expanded?: boolean;
  /** Called with the button so the panel can return focus here on close. */
  onActivate?: (element: HTMLButtonElement) => void;
}

/**
 * The bottom-right minimap badge (FR-031) and, since v2, the expanded map's
 * trigger (FR-122, `contracts/panels.md`). It keeps its ambient, non-expanded
 * look until hovered or focused; the grid stays decorative and the accessible
 * name is the System's invitation, described by the revealed-sector summary.
 *
 * `expanded` and `onActivate` are optional only so this component could land
 * before the page wiring: T125 MUST pass both from `usePanel`, otherwise the
 * badge advertises a panel it never opens.
 */
export function MiniMapBadge({ cells, recent, expanded = false, onActivate }: MiniMapBadgeProps) {
  const { cols, rows, revealed } = cells;
  const total = cols * rows;
  const summaryId = useId();

  return (
    <button
      type="button"
      className={styles.badge}
      data-testid="minimap-badge"
      data-panel-trigger="map"
      aria-label={copy.mapTriggerLabel}
      aria-describedby={summaryId}
      aria-expanded={expanded}
      aria-controls="rail-panel"
      onClick={(event: MouseEvent<HTMLButtonElement>) => onActivate?.(event.currentTarget)}
    >
      <span className={styles.header} aria-hidden="true">
        <IconMap className={styles.icon} />
        {copy.stageFloor(cells.floor)}
      </span>
      <span
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        aria-hidden="true"
      >
        {Array.from({ length: total }, (_, index) => {
          const key = cellKey(Math.floor(index / cols), index % cols);
          const state = recent.has(key) ? 'recent' : revealed.has(key) ? 'revealed' : 'hidden';
          return (
            <span key={key} className={styles.cell} data-state={state} data-testid="minimap-cell" />
          );
        })}
      </span>
      <span className="sr-only" id={summaryId}>
        {copy.sectorsRevealed(revealed.size, cells.total)}
      </span>
    </button>
  );
}

export default MiniMapBadge;
