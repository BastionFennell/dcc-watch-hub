import type { PartyFrame } from '../../engine/selectors';
import { copy } from '../../copy';
import { HpBar } from './HpBar';
import { StatusPips } from './StatusPips';
import styles from './PartyRail.module.css';

export interface CrawlerFrameProps {
  frame: PartyFrame;
  /** True while this crawler's dossier is the open panel (`aria-expanded`). */
  expanded: boolean;
  /** Receives the button so the panel can return focus here on close (FR-101). */
  onActivate(element: HTMLElement): void;
}

/**
 * One crawler's state at the playhead, and the trigger for their dossier
 * (contracts/panels.md, research R9). A real `<button>` rather than a clickable
 * `<li>`: keyboard reachable, and the affordances are honest now that the frame
 * actually opens something (constitution III).
 *
 * `data-danger` and `data-levelup` are set straight from the selector, so the
 * flash and the pulse re-trigger correctly on any seek in either direction.
 */
export function CrawlerFrame({ frame, expanded, onActivate }: CrawlerFrameProps) {
  return (
    <li className={styles.frameItem}>
      <button
        type="button"
        className={styles.frame}
        data-testid="crawler-frame"
        data-crawler={frame.id}
        data-danger={frame.danger ? 'true' : undefined}
        data-levelup={frame.levelUpPulse ? 'true' : undefined}
        data-panel-trigger={`dossier:${frame.id}`}
        aria-expanded={expanded}
        aria-controls="rail-panel"
        onClick={(event) => onActivate(event.currentTarget)}
      >
        <span className={styles.frameTop}>
          <img
            className={styles.portrait}
            src={frame.portrait}
            alt={frame.name}
            width={40}
            height={40}
          />
          <span className={styles.frameMeta}>
            <span className={styles.name}>{frame.name}</span>
            <span className={styles.stats}>
              <span className={styles.level}>{copy.levelShort(frame.level)}</span>
              <span className={styles.hpValue}>{copy.hpValue(frame.hp.current, frame.hp.max)}</span>
            </span>
          </span>
        </span>
        <HpBar
          current={frame.hp.current}
          max={frame.hp.max}
          pct={frame.pct}
          danger={frame.danger}
        />
        <StatusPips statuses={frame.statuses} />
      </button>
    </li>
  );
}

export default CrawlerFrame;
