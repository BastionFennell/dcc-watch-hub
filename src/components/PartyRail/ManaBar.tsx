import { copy } from '../../copy';
import styles from './PartyRail.module.css';

export interface ManaBarProps {
  current: number;
  max: number;
}

/**
 * The mana meter on a party frame (009, revision 1). The dossier and the glance
 * draw one key per point, which five frames across a rail have no room for, so
 * the frame falls back to a continuous bar - thinner than the HP bar above it
 * and in System blue, so the two never read as the same meter at a glance.
 *
 * The count sits beside the bar rather than in the meta line: "Lv 1 · 20/20"
 * already fills the narrowest frame, and a third figure there wrapped it.
 *
 * Every crawler has a pool, so the row always draws; an empty pool reads 0/0 on
 * an empty track rather than vanishing and shortening the frame mid-seek.
 *
 * Spans, not divs: the frame around it is a `<button>`, which may only contain
 * phrasing content. `role="img"` plus `copy.manaAria` mirrors `HpBar` exactly,
 * so each meter announces one name and never the bare numbers.
 */
export function ManaBar({ current, max }: ManaBarProps) {
  const pct = max > 0 ? Math.round((Math.min(Math.max(current, 0), max) / max) * 100) : 0;
  return (
    <span className={styles.manaRow}>
      <span className={styles.manaTrack} role="img" aria-label={copy.manaAria(current, max)}>
        <span className={styles.manaFill} style={{ width: `${pct}%` }} />
      </span>
      <span className={styles.manaValue} data-testid="frame-mana">
        {copy.hpValue(current, max)}
      </span>
    </span>
  );
}

export default ManaBar;
