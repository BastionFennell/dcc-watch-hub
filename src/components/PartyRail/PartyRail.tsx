import type { PartyFrame } from '../../engine/selectors';
import { copy } from '../../copy';
import { CrawlerFrame } from './CrawlerFrame';
import styles from './PartyRail.module.css';

export interface PartyRailProps {
  /** Straight from `partyFrames(state, events, t)` — recomputed every render. */
  frames: PartyFrame[];
}

/** The five crawler frames under the stage. Lays out however many exist. */
export function PartyRail({ frames }: PartyRailProps) {
  return (
    <ul className={styles.rail} aria-label={copy.partyRailLabel} data-testid="party-rail">
      {frames.map((frame) => (
        <CrawlerFrame key={frame.id} frame={frame} />
      ))}
    </ul>
  );
}

export default PartyRail;
