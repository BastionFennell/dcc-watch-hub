import { copy } from '../../copy';
import styles from './PartyRail.module.css';

export interface HpBarProps {
  current: number;
  max: number;
  /** 0–100, already clamped by `partyFrames`. */
  pct: number;
  danger: boolean;
}

/**
 * The 4 px bar from the wireframe. The fill animates purely through a CSS
 * transition on `width`: no timers, no imperative animation (constitution I).
 */
export function HpBar({ current, max, pct, danger }: HpBarProps) {
  return (
    <div
      className={styles.hpTrack}
      role="img"
      aria-label={copy.hpAria(current, max)}
      data-danger={danger ? 'true' : undefined}
    >
      <span className={styles.hpFill} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default HpBar;
