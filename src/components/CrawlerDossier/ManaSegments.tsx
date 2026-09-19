import { copy } from '../../copy';
import styles from './CrawlerDossier.module.css';
import labelStyles from './ManaSegments.module.css';

export interface ManaSegmentsProps {
  current: number;
  max: number;
  /** The mono caps "MANA" label before the strip; on everywhere by default. */
  label?: boolean;
}

/**
 * The mana strip (009). It is deliberately not the HP strip: HP scales into the
 * sheet's fixed ten segments, while a mana pool is small enough to draw one
 * segment per point, so a crawler with INT 5 gets five keys and spending one is
 * a single unmistakable notch. The fill is System blue, which is the one colour
 * the overlay reserves for the System's own readouts.
 *
 * A crawler with no pool (no INT, so `max` is 0) gets nothing at all rather than
 * an empty rail: there is no meter to read. The label is `aria-hidden` because
 * the strip's own `aria-label` already opens with the word "Mana".
 */
export function ManaSegments({ current, max, label = true }: ManaSegmentsProps) {
  if (max <= 0) return null;
  return (
    <>
      {label ? (
        <span className={labelStyles.manaLabel} aria-hidden="true">
          {copy.vitalsMana}
        </span>
      ) : null}
      <div
        className={styles.manaStrip}
        role="img"
        aria-label={copy.manaAria(current, max)}
        data-testid="mana-segments"
      >
        {Array.from({ length: max }, (_, index) => (
          <span
            key={index}
            className={styles.manaSegment}
            data-testid="mana-segment"
            data-filled={index < current ? 'true' : undefined}
          />
        ))}
      </div>
    </>
  );
}

export default ManaSegments;
