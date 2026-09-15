import type { PartyFrame } from '../../engine/selectors';
import { copy } from '../../copy';
import { CrawlerFrame } from './CrawlerFrame';
import styles from './PartyRail.module.css';

export interface PartyRailProps {
  /** Straight from `partyFrames(state, events, t)` — recomputed every render. */
  frames: PartyFrame[];
  /** The crawler whose dossier is open, if any (drives `aria-expanded`). */
  activeId: string | null;
  /** Click or keyboard activation on a frame; the element is the focus target. */
  onActivate(id: string, element: HTMLElement): void;
}

/** The five crawler frames under the stage. Lays out however many exist. */
export function PartyRail({ frames, activeId, onActivate }: PartyRailProps) {
  return (
    <ul className={styles.rail} aria-label={copy.partyRailLabel} data-testid="party-rail">
      {frames.map((frame) => (
        <CrawlerFrame
          key={frame.id}
          frame={frame}
          expanded={frame.id === activeId}
          onActivate={(element) => onActivate(frame.id, element)}
        />
      ))}
    </ul>
  );
}

export default PartyRail;
