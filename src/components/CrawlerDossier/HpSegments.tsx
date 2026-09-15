import { copy } from '../../copy';
import styles from './CrawlerDossier.module.css';

export interface HpSegmentsProps {
  current: number;
  max: number;
  /** 0–10, straight from the `hpSegments` selector. */
  filled: number;
}

/**
 * The official sheet's ten-segment HP strip (FR-110, research R3). The colors
 * ramp red → amber → green across `--hp-seg-1..10`, so a strip that is one
 * segment long reads as danger without any extra state.
 */
export function HpSegments({ current, max, filled }: HpSegmentsProps) {
  return (
    <div
      className={styles.hpStrip}
      role="img"
      aria-label={copy.hpAria(current, max)}
      data-testid="hp-segments"
    >
      {Array.from({ length: 10 }, (_, index) => (
        <span
          key={index}
          className={styles.hpSegment}
          data-testid="hp-segment"
          data-filled={index < filled ? 'true' : undefined}
          style={index < filled ? { background: `var(--hp-seg-${index + 1})` } : undefined}
        />
      ))}
    </div>
  );
}

export default HpSegments;
