import type { PartyFrame } from '../../engine/selectors';
import { copy } from '../../copy';
import { HpBar } from './HpBar';
import { StatusPips } from './StatusPips';
import styles from './PartyRail.module.css';

export interface CrawlerFrameProps {
  frame: PartyFrame;
}

/**
 * One crawler's state at the playhead. Deliberately inert: no `onClick`, no
 * pointer cursor, no hover styling — v2 owns the character sheet and we do not
 * tease it (constitution III / FR-012).
 *
 * `data-danger` and `data-levelup` are set straight from the selector, so the
 * flash and the pulse re-trigger correctly on any seek in either direction.
 */
export function CrawlerFrame({ frame }: CrawlerFrameProps) {
  return (
    <li
      className={styles.frame}
      data-testid="crawler-frame"
      data-crawler={frame.id}
      data-danger={frame.danger ? 'true' : undefined}
      data-levelup={frame.levelUpPulse ? 'true' : undefined}
    >
      <div className={styles.frameTop}>
        <img
          className={styles.portrait}
          src={frame.portrait}
          alt={frame.name}
          width={40}
          height={40}
        />
        <div className={styles.frameMeta}>
          <div className={styles.name}>{frame.name}</div>
          <div className={styles.stats}>
            <span className={styles.level}>{copy.levelShort(frame.level)}</span>
            <span className={styles.hpValue}>{copy.hpValue(frame.hp.current, frame.hp.max)}</span>
          </div>
        </div>
      </div>
      <HpBar
        current={frame.hp.current}
        max={frame.hp.max}
        pct={frame.pct}
        danger={frame.danger}
      />
      <StatusPips statuses={frame.statuses} />
    </li>
  );
}

export default CrawlerFrame;
