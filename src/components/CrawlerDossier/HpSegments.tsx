import { copy } from '../../copy';
import styles from './CrawlerDossier.module.css';
import labelStyles from './HpSegments.module.css';

export interface HpSegmentsProps {
  current: number;
  max: number;
  /** 0–10, straight from the `hpSegments` selector. */
  filled: number;
  /** The mono caps "HP" label before the strip; on everywhere by default (T344). */
  label?: boolean;
}

/**
 * The official sheet's ten-segment HP strip (FR-110, research R3). The colors
 * ramp red → amber → green across `--hp-seg-1..10`, so a strip that is one
 * segment long reads as danger without any extra state.
 *
 * The author kept that sheet fidelity and asked for a label instead (UX review
 * 1.3), so the strip now leads with a mono caps "HP" wherever it renders. The
 * label is `aria-hidden`: the strip's own `aria-label` already opens with the
 * numbers and ends in "HP", and a second one would only be read twice.
 */
export function HpSegments({ current, max, filled, label = true }: HpSegmentsProps) {
  return (
    <>
      {label ? (
        <span className={labelStyles.hpLabel} aria-hidden="true">
          {copy.hpLabel}
        </span>
      ) : null}
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
    </>
  );
}

export default HpSegments;
