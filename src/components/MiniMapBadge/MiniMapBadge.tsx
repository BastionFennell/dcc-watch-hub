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
}

/**
 * The bottom-right minimap badge (FR-031). Decorative and non-interactive in v1:
 * the grid is hidden from assistive tech and replaced by a one-line summary, and
 * nothing here takes a pointer (constitution III — do not tease v2).
 */
export function MiniMapBadge({ cells, recent }: MiniMapBadgeProps) {
  const { cols, rows, revealed } = cells;
  const total = cols * rows;

  return (
    <div className={styles.badge} data-testid="minimap-badge">
      <div className={styles.header} aria-hidden="true">
        <IconMap className={styles.icon} />
        {copy.stageFloor(cells.floor)}
      </div>
      <div
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
      </div>
      <p className="sr-only">{copy.sectorsRevealed(revealed.size, cells.total)}</p>
    </div>
  );
}

export default MiniMapBadge;
